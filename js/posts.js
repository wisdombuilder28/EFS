// No Firebase Storage — images and audio stored as base64 in Firestore
import { postsCollection, addDoc } from "./firebase.js";
import { currentAudioBlob }         from "./recorder.js";
import { resetAndCloseForm }        from "./form.js"; // FIX: was ./main.js (circular dep)

const setStatus = (msg, color = '#374151') => {
    const el = document.getElementById('upload-status');
    if (el) { el.innerText = msg || ''; el.style.color = color; }
};

const compressImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.onload  = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not decode image."));
        img.onload  = () => {
            const MAX = 900;
            let w = img.width;
            let h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else       { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }

            const canvas = document.createElement('canvas');
            canvas.width  = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);

            let base64   = canvas.toDataURL('image/jpeg', 0.70);
            let approxKB = Math.round(base64.length * 0.75 / 1024);
            if (approxKB > 700) {
                base64   = canvas.toDataURL('image/jpeg', 0.45);
                approxKB = Math.round(base64.length * 0.75 / 1024);
            }
            if (approxKB > 700) {
                reject(new Error(`Image too large after compression (${approxKB}KB).\nChoose a smaller image.`));
                return;
            }
            resolve(base64);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

const audioToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror   = () => reject(new Error("Could not read audio."));
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
});

export async function handlePublish() {
    const author    = document.getElementById('post-author').value;
    const category  = document.getElementById('post-category').value;
    const title     = document.getElementById('post-title').value.trim();
    const body      = document.getElementById('post-body').value.trim();
    const pinned    = document.getElementById('post-pin').checked;
    const imageFile = document.getElementById('post-image').files[0];

    const expiryInput = document.getElementById('post-expiry');
    const expiresAt   = expiryInput && expiryInput.value
        ? new Date(expiryInput.value).toISOString()
        : null;

    if (expiresAt && new Date(expiresAt) <= new Date()) {
        alert("The expiry date must be in the future.");
        return;
    }
    if (!title || !body) {
        alert("Please fill in both the Headline and the Message before publishing.");
        return;
    }

    const publishBtn     = document.getElementById('publish-btn');
    publishBtn.disabled  = true;
    publishBtn.innerText = "Preparing...";
    setStatus('');

    try {
        let imageData = "";
        let audioData = "";

        if (imageFile) {
            setStatus('Compressing image...', '#2563eb');
            publishBtn.innerText = "Image...";
            imageData = await compressImage(imageFile);
            setStatus('Image ready!', '#16a34a');
        }

        if (currentAudioBlob) {
            setStatus('Processing voice note...', '#2563eb');
            publishBtn.innerText = "Audio...";
            audioData = await audioToBase64(currentAudioBlob);
            const audioKB = Math.round(audioData.length * 0.75 / 1024);
            if (audioKB > 1200) {
                throw new Error(`Voice note too large (${audioKB}KB).\nKeep recordings under 60 seconds.`);
            }
            setStatus('Voice note ready!', '#16a34a');
        }

        publishBtn.innerText = "Saving...";
        setStatus('Saving announcement...', '#2563eb');

        await addDoc(postsCollection, {
            author,
            category,
            title,
            body,
            pinned,
            date:      new Date().toISOString(),
            expiresAt: expiresAt,
            image:     imageData,
            audio:     audioData,
            reacts:    { like: 0, heart: 0, wow: 0, handshake: 0 },
            views:     0,
        });

        // ── Trigger push notification to all subscribed browsers ────────────
        // Fire-and-forget: notification failure should not block the UI
        sendPushNotification(title, body, category).catch(err =>
            console.warn("Push notification skipped:", err.message)
        );

        setStatus('');
        alert("Announcement published successfully!");
        resetAndCloseForm();

    } catch (err) {
        console.error("Publish error:", err);
        setStatus(err.message.split('\n')[0], '#dc2626');
        alert(err.message);
    } finally {
        publishBtn.innerText = "Publish";
        publishBtn.disabled  = false;
    }
}

// ── Send push notification via Netlify Function ────────────────────────────
async function sendPushNotification(title, body, category) {
    const res = await fetch('/.netlify/functions/send-notification', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, body, category }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
    }
}
