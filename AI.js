// ============================================================
// AI CHAT — Emeakaroha Foundation School
//
// This file contains ZERO API keys.
// All AI calls go through /.netlify/functions/ai-chat which
// handles provider routing, caching, and rate limiting on the
// server side where keys are safe.
// ============================================================

const FUNCTION_URL = "/api/ai-chat"; // Vercel serverless function

// ── Globals ───────────────────────────────────────────────────────────────────
let controller;
let typingInterval;
const userData = { message: "", file: {} };

// ── All DOM logic inside DOMContentLoaded ─────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

    const container        = document.querySelector(".container");
    const chatsContainer   = document.querySelector(".chats-container");
    const promptForm       = document.querySelector(".prompt-form");
    if (!container || !chatsContainer || !promptForm) return;

    const promptInput       = promptForm.querySelector(".prompt-input");

    // ── Textarea auto-resize ──────────────────────────────────────────────
    if (promptInput && promptInput.tagName === 'TEXTAREA') {
      promptInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 140) + 'px';
      });
      
      // Enter sends, Shift+Enter creates new line
      promptInput.addEventListener('keydown', function (e) {

    // Ctrl + Enter (Windows/Linux)
    // Cmd + Enter (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {

        e.preventDefault();

        promptForm.dispatchEvent(new Event('submit'));
    }

    // Normal Enter = New line
});
    }
    const sendBtn           = document.getElementById("send-prompt-btn");
    const fileInput         = document.getElementById("file-input");
    const fileUploadWrapper = document.querySelector(".file-upload-wrapper");
    const filePreview       = fileUploadWrapper?.querySelector(".file-preview");
    const fileIconDisplay   = fileUploadWrapper?.querySelector(".file-icon-display");

    // ── Safe DOM builders — no innerHTML for user content ──────────────────
    const makeDiv = (...classes) => {
        const el = document.createElement("div");
        el.classList.add("message", ...classes);
        return el;
    };
    const makeTextP = (text) => {
        const p       = document.createElement("p");
        p.className   = "message-text";
        p.textContent = text;
        return p;
    };
    const scrollToBottom = () =>
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });

    // ── Typing animation ────────────────────────────────────────────────────
    const typingEffect = (text, textEl, botDiv) => {
        textEl.textContent = "";
        let i = 0;
        typingInterval = setInterval(() => {
            if (i < text.length) {
                textEl.textContent += text[i++];
                scrollToBottom();
            } else {
                clearInterval(typingInterval);
                botDiv.classList.remove("loading");
                document.body.classList.remove("bot-responding");
            }
        }, 14);
    };

    // ── Cooldown timer ──────────────────────────────────────────────────────
    const startCoolDown = (seconds) => {
        if (!sendBtn) return;
        sendBtn.disabled = true;
        if (promptInput) promptInput.disabled = true;
        const original = sendBtn.innerHTML;
        let timeLeft   = seconds;
        const t = setInterval(() => {
            if (sendBtn) sendBtn.innerHTML = `<span style="font-size:.82rem;font-weight:700;color:#fff">${timeLeft}s</span>`;
            if (--timeLeft < 0) {
                clearInterval(t);
                if (sendBtn)     { sendBtn.disabled = false; sendBtn.innerHTML = original; }
                if (promptInput) { promptInput.disabled = false; }
                document.body.classList.remove("bot-responding");
            }
        }, 1000);
    };

    // ── LocalStorage ────────────────────────────────────────────────────────
    const STORAGE_KEY = "emeakaroha_chat_v3";
    const saveChat = () => {
        const safe = chatHistory.map(msg => ({
            role:    msg.role,
            content: typeof msg.content === "string"
                ? msg.content
                : "[User attached a file]",
        }));
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(safe)); }
        catch { localStorage.removeItem(STORAGE_KEY); }
    };
    const loadChat = () => {
        let saved;
        try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
        catch { localStorage.removeItem(STORAGE_KEY); return; }
        if (!saved || !Array.isArray(saved)) return;
        chatHistory = saved;
        chatHistory.forEach(msg => {
            const isUser = msg.role === "user";
            const div    = makeDiv(isUser ? "user-message" : "bot-message");
            div.appendChild(makeTextP(msg.content || ""));
            chatsContainer.appendChild(div);
        });
        document.body.classList.add("chats-active");
        scrollToBottom();
    };

    const addBotBubble = () => {
        const div = makeDiv("bot-message", "loading");
        div.appendChild(makeTextP("Just a sec..."));
        chatsContainer.appendChild(div);
        scrollToBottom();
        return div;
    };

    // Trim history — keep last 6 messages, always start with user
    const trimHistory = () => {
        if (chatHistory.length > 6) chatHistory = chatHistory.slice(-6);
        while (chatHistory.length && chatHistory[0].role !== "user") chatHistory.shift();
    };

    // ── Core: call the Netlify function ─────────────────────────────────────
    const generateResponse = async (botDiv) => {
        const textEl = botDiv.querySelector(".message-text");
        controller   = new AbortController();

        // Build the message for this turn — include image if attached
        let userContent;
        if (userData.file?.data && userData.file?.mime_type?.startsWith('image/')) {
            // Send as multimodal content array so AI can actually see the image
            userContent = [
                { type: 'text',       text: userData.message || 'What is in this image?' },
                { type: 'image_url',  image_url: { url: `data:${userData.file.mime_type};base64,${userData.file.data}` } }
            ];
            chatHistory.push({ role: 'user', content: userData.message || 'Image attached' });
        } else {
            userContent = userData.message;
            chatHistory.push({ role: 'user', content: userContent });
        }
        trimHistory();
        saveChat();

        try {
            const res = await fetch(FUNCTION_URL, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ messages: chatHistory }),
                signal:  controller.signal,
            });

            const data = await res.json();

            if (res.status === 429) {
                // Rate limited by our own function
                throw new Error("rate_limited:" + (data.error || "Too many questions."));
            }

            if (!res.ok) {
                throw new Error(data.error || `Server error ${res.status}`);
            }

            const reply = data.reply || "No response received.";
            typingEffect(reply, textEl, botDiv);
            chatHistory.push({ role: "assistant", content: reply });
            saveChat();

        } catch (err) {
            // Roll back failed user message
            if (chatHistory.at(-1)?.role === "user") { chatHistory.pop(); saveChat(); }

            console.error("AI Error:", err.name, err.message);

            if (err.name === "AbortError") {
                textEl.textContent = "Response stopped.";
                document.body.classList.remove("bot-responding");

            } else if (err.message.startsWith("rate_limited:")) {
                const msg = err.message.replace("rate_limited:", "");
                textEl.textContent = `⏳ ${msg} Please wait 60 seconds.`;
                if (promptInput) promptInput.value = userData.message;
                startCoolDown(60);

            } else if (err.message.includes("overloaded") || err.message.includes("503")) {
                textEl.textContent = "⏳ All AI systems are busy right now. Please try again in 30 seconds.";
                if (promptInput) promptInput.value = userData.message;
                startCoolDown(30);

            } else {
                textEl.textContent = err.message || "Something went wrong. Please try again.";
                document.body.classList.remove("bot-responding");
            }

            textEl.style.color = "#d62939";
            botDiv.classList.remove("loading");
            scrollToBottom();

        } finally {
            userData.file = {};
        }
    };

    // ── Form submit ─────────────────────────────────────────────────────────
    promptForm.addEventListener("submit", (e) => {
        e.preventDefault();

        // Silent cooldown — no alert popup, just ignore the submit
        if (Date.now() - lastRequestTime < 3000) return;
        lastRequestTime = Date.now();

        const text = promptInput?.value.trim() || "";
        if ((!text && !userData.file.data) || document.body.classList.contains("bot-responding")) return;

        userData.message = text || "Please analyse this attached file.";
        if (promptInput) { promptInput.value = ""; promptInput.style.height = "auto"; }
        document.body.classList.add("chats-active", "bot-responding");
        if (fileUploadWrapper) fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");

        // User bubble
        const userDiv = makeDiv("user-message");
        userDiv.appendChild(makeTextP(userData.message));
        if (userData.file.data && userData.file.isImage) {
            const img     = document.createElement("img");
            img.src       = `data:${userData.file.mime_type};base64,${userData.file.data}`;
            img.alt       = "Attached image";
            img.className = "img-attachment";
            userDiv.appendChild(img);
        } else if (userData.file.data) {
            const p        = document.createElement("p");
            p.className    = "file-attachment";
            const icon     = document.createElement("i");
            icon.className = "fas fa-file-alt";
            p.appendChild(icon);
            p.append(" " + userData.file.fileName);
            userDiv.appendChild(p);
        }
        chatsContainer.appendChild(userDiv);
        scrollToBottom();
        setTimeout(() => generateResponse(addBotBubble()), 600);
    });

    // ── File attach ─────────────────────────────────────────────────────────
    document.getElementById("add-file-btn")?.addEventListener("click", () => fileInput?.click());

    fileInput?.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (!file) return;
        const isImage = file.type.startsWith("image/");
        const reader  = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (ev) => {
            const base64 = ev.target.result.split(",")[1];
            if (filePreview) {
                filePreview.src           = isImage ? ev.target.result : "#";
                filePreview.style.display = isImage ? "block" : "none";
            }
            if (fileIconDisplay) fileIconDisplay.style.display = isImage ? "none" : "block";
            if (fileUploadWrapper) {
                fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");
            }
            userData.file = { fileName: file.name, data: base64, mime_type: file.type, isImage };
            fileInput.value = "";
        };
    });

    document.getElementById("cancel-file-btn")?.addEventListener("click", () => {
        userData.file = {};
        fileUploadWrapper?.classList.remove("file-attached", "img-attached", "active");
    });

    document.getElementById("stop-response-btn")?.addEventListener("click", () => {
        controller?.abort();
        clearInterval(typingInterval);
        chatsContainer.querySelector(".bot-message.loading")?.classList.remove("loading");
        document.body.classList.remove("bot-responding");
    });

    document.getElementById("delete-chats-btn")?.addEventListener("click", () => {
        localStorage.removeItem(STORAGE_KEY);
        chatHistory = [];
        chatsContainer.replaceChildren();
        document.body.classList.remove("chats-active", "bot-responding");
        // Also clear any attached file/image
        userData.file = {};
        fileUploadWrapper?.classList.remove("file-attached", "img-attached", "active");
    });

    document.querySelectorAll(".suggestions-item").forEach(item => {
        item.addEventListener("click", () => {
            const textEl = item.querySelector(".text");
            if (textEl && promptInput) {
                promptInput.value = textEl.textContent;
                promptForm.dispatchEvent(new Event("submit"));
            }
        });
    });

    loadChat();

}); // end DOMContentLoaded
