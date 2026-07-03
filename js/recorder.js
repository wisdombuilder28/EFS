export let currentAudioBlob = null;
let mediaRecorder;
let audioChunks = [];

// Build check icon purely via DOM — zero innerHTML
const makeCheckIcon = () => {
    const svg      = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width',        '16');
    svg.setAttribute('height',       '16');
    svg.setAttribute('viewBox',      '0 0 24 24');
    svg.setAttribute('fill',         'none');
    svg.setAttribute('stroke',       '#16a34a');
    svg.setAttribute('stroke-width', '2.5');
    svg.setAttribute('stroke-linecap',  'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', '20 6 9 17 4 12');
    svg.appendChild(poly);
    return svg;
};

function getSupportedMimeType() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
}

const MAX_SECONDS = 60; // max recording duration
let autoStopTimer  = null;
let countdownTimer = null;

export async function startRecording() {
    const statusText = document.getElementById('record-status');
    const stopBtn    = document.getElementById('stop-btn');
    const startBtn   = document.getElementById('start-btn');

    try {
        const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = getSupportedMimeType();
        const options  = mimeType ? { mimeType } : {};

        mediaRecorder = new MediaRecorder(stream, options);
        audioChunks   = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            // Clear timers when recording stops
            clearTimeout(autoStopTimer);
            clearInterval(countdownTimer);

            const recordedType   = mediaRecorder.mimeType || 'audio/webm';
            currentAudioBlob     = new Blob(audioChunks, { type: recordedType });
            const preview        = document.getElementById('audio-preview');
            preview.src          = URL.createObjectURL(currentAudioBlob);
            preview.classList.remove('hidden');

            // Build status purely via DOM — zero innerHTML
            const readySpan = document.createElement('span');
            readySpan.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
            readySpan.appendChild(makeCheckIcon());
            readySpan.appendChild(document.createTextNode(' Voice note ready!'));
            statusText.replaceChildren(readySpan);
            statusText.style.color = '#16a34a';

            startBtn.classList.remove('hidden');
            stopBtn.classList.add('hidden');
        };

        mediaRecorder.start();

        // ── Countdown timer displayed while recording ──────────────────────
        let elapsed = 0;
        const buildRecordingStatus = (secs) => {
            const remaining = MAX_SECONDS - secs;
            const recSpan   = document.createElement('span');
            recSpan.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
            const dot = document.createElement('span');
            dot.style.cssText = 'width:10px;height:10px;background:#dc2626;border-radius:50%;display:inline-block;';
            recSpan.appendChild(dot);
            recSpan.appendChild(document.createTextNode(` Recording... ${remaining}s left`));
            statusText.replaceChildren(recSpan);
            statusText.style.color = remaining <= 10 ? '#f97316' : '#dc2626';
        };

        buildRecordingStatus(0);
        countdownTimer = setInterval(() => {
            elapsed++;
            buildRecordingStatus(elapsed);
        }, 1000);

        // ── Auto-stop at MAX_SECONDS ───────────────────────────────────────
        autoStopTimer = setTimeout(() => {
            stopRecording();
        }, MAX_SECONDS * 1000);

        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');

    } catch (err) {
        console.error('Mic error:', err);
        if (err.name === 'NotAllowedError') {
            alert('Microphone access was denied. Please allow microphone permission in your browser settings.');
        } else {
            alert('Could not access your microphone: ' + err.message);
        }
    }
}

export function stopRecording() {
    clearTimeout(autoStopTimer);
    clearInterval(countdownTimer);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        // UI update handled in mediaRecorder.onstop
    }
}

export function clearAudio() {
    currentAudioBlob = null;
    audioChunks      = [];
    const preview    = document.getElementById('audio-preview');
    preview.src      = "";
    preview.classList.add('hidden');
    document.getElementById('record-status').innerText = "";
}