/**
 * study/js/api.js — calls /.netlify/functions/study-ai
 * No API key in browser. Key lives in Netlify environment variables.
 */
import { BasePrompt }   from '../prompts/basePrompt.js';
import { MODEL_CONFIG } from '../config/models.js';

const STORAGE_KEY = 'efs_study_history';

// Load history from localStorage on startup
let history = (() => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
})();

// Save history to localStorage
const saveHistory = () => {
    try {
        // Don't store image base64 data — too large for localStorage
        const toSave = history.map(msg => {
            if (Array.isArray(msg.content)) {
                return { ...msg, content: msg.content.filter(p => p.type === 'text') };
            }
            return msg;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
        // localStorage full — clear and start fresh
        localStorage.removeItem(STORAGE_KEY);
    }
};

export function clearHistory() {
    history = [];
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('efs_study_chat_html');
    localStorage.removeItem('efs_study_subject');
}

export function getHistory() {
    return history;
}

export async function callAPI(subject, question, file = null) {
    if (history.length === 0) {
        history.push({ role: 'system', content: BasePrompt(subject) });
    }

    // Build user message — text only, or text + file
    if (file) {
        history.push({
            role: 'user',
            content: [
                { type: 'text', text: question },
                { type: 'image_url', image_url: { url: `data:${file.mimeType};base64,${file.base64}` } }
            ]
        });
    } else {
        history.push({ role: 'user', content: question });
    }

    // Keep system prompt + last 10 messages
    if (history.length > 12) {
        history = [history[0], ...history.slice(-10)];
    }

    const res = await fetch(MODEL_CONFIG.functionUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages:  history,
            model:     MODEL_CONFIG.model,
            maxTokens: MODEL_CONFIG.maxTokens,
        }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        history.pop();
        throw new Error(
            res.status === 404
                ? 'Study AI function not found. Please ensure the site is deployed to Netlify with GROQ_API_KEY set.'
                : `Unexpected response (HTTP ${res.status})`
        );
    }

    const data = await res.json();

    if (!res.ok || data.error) {
        history.pop();
        throw new Error(data.error || `Request failed (${res.status})`);
    }

    const text        = data.text        ?? '';
    const finishReason = data.finishReason ?? 'stop';

    history.push({ role: 'assistant', content: text });
    saveHistory(); // persist to localStorage
    return { text, finishReason };
}
