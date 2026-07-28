/**
 * study/app.js — Central orchestrator for EFS Study AI.
 *
 * Pipeline:
 *   sanitizeInput → validateInput → callAPI
 *   → cleanResponse → fixLatex → protectLatex
 *   → marked.parse → restoreLatex → DOMPurify.sanitize
 *   → detectMode → renderAIMessage
 */
import { sanitizeInput }  from './js/sanitizer.js';
import { validateInput }  from './js/validator.js';
import { callAPI, clearHistory, getHistory } from './js/api.js';
import {
  renderUserMessage,
  renderAIMessage,
  renderContinueButton,
  renderLoading,
  renderError,
} from './js/render.js';
import { cleanResponse }  from './utils/textCleaner.js';
import { fixLatex, protectLatex, restoreLatex } from './utils/mathFixer.js';
import { detectMode }     from './utils/modeDetector.js';
import { SETTINGS }       from './config/settings.js';

const inputEl   = document.getElementById('user-input');
const subjectEl = document.querySelector('#subject');
const btnEl     = document.querySelector('#btn');
const chatEl    = () => document.querySelector('#chat');

const CHAT_HTML_KEY    = 'efs_study_chat_html';
const CHAT_SUBJECT_KEY = 'efs_study_subject';

// Save rendered chat HTML + subject to localStorage
const saveChatToStorage = () => {
  try {
    const chat = chatEl();
    if (chat) localStorage.setItem(CHAT_HTML_KEY, chat.innerHTML);
    if (subjectEl.value) localStorage.setItem(CHAT_SUBJECT_KEY, subjectEl.value);
  } catch { /* storage full — skip */ }
};

// Restore previous chat session on page load
const restoreChat = () => {
  try {
    const savedHtml    = localStorage.getItem(CHAT_HTML_KEY);
    const savedSubject = localStorage.getItem(CHAT_SUBJECT_KEY);

    if (savedSubject) subjectEl.value = savedSubject;

    if (savedHtml) {
      const chat = chatEl();
      if (chat) {
        // Use DOMPurify to safely restore saved HTML
        chat.innerHTML = DOMPurify.sanitize(savedHtml);
        chat.scrollTop = chat.scrollHeight;
        // Re-render any math in restored content
        if (window.MathJax) MathJax.typesetPromise([chat]).catch(() => {});
      }
    }
  } catch { /* ignore restore errors */ }
};

// ── File attachment state ────────────────────────────────────────────────────
const addFileBtn    = document.getElementById('study-attach-btn');
const cancelFileBtn = document.getElementById('study-cancel-file');
const fileInput     = document.getElementById('study-file-input');
const fileWrapper   = document.getElementById('study-file-preview');  // the container div
const filePreview   = document.getElementById('study-img-preview');   // the actual <img> tag inside it
const fileIconDisp  = document.getElementById('study-file-name');

let attachedFile = null;   // { base64, mimeType, name }

addFileBtn?.addEventListener('click', () => fileInput?.click());

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl   = e.target.result;
    const base64    = dataUrl.split(',')[1];
    attachedFile    = { base64, mimeType: file.type, name: file.name };
    fileWrapper.classList.add('study-active');
    if (file.type.startsWith('image/')) {
      fileWrapper.classList.add('study-img');
      filePreview.src = dataUrl;
      filePreview.style.display = 'block';
      fileIconDisp.style.display = 'none';
    } else {
      fileWrapper.classList.add('study-doc');
      fileIconDisp.style.display = 'flex';
      filePreview.style.display = 'none';
    }
    addFileBtn?.classList.add('hidden');
    cancelFileBtn.style.display = 'flex';
  };
  reader.readAsDataURL(file);
  fileInput.value = '';
});

cancelFileBtn.addEventListener('click', () => {
  attachedFile = null;
  fileWrapper.classList.remove('study-active','study-img','study-doc');
  filePreview.style.display    = 'none';
  fileIconDisp.style.display   = 'none';
  addFileBtn?.classList.remove('hidden');
  cancelFileBtn.style.display  = 'none';
});

let isProcessing = false;

function setProcessing(state) {
  isProcessing     = state;
  inputEl.disabled = state;
  btnEl.disabled   = state;
}

function buildHtml(rawText) {
  const cleaned           = cleanResponse(rawText);
  const fixed             = fixLatex(cleaned);
  const { safe, store }   = protectLatex(fixed);
  const markedHtml        = marked.parse(safe);
  const restoredHtml      = restoreLatex(markedHtml, store);
  const html              = DOMPurify.sanitize(restoredHtml);
  const mode              = detectMode(cleaned);
  return { html, mode };
}

async function renderTurn(subject, rawText, finishReason, loader) {
  const { html, mode } = buildHtml(rawText);
  loader.remove();
  await renderAIMessage(html, mode);
  if (finishReason === 'length') {
    renderContinueButton(() => handleContinuation(subject));
  }
  // Save rendered chat HTML so it survives page reload
  saveChatToStorage();
}

async function handleSubmit() {
  if (isProcessing) return;

  const cleanInput = sanitizeInput(inputEl.value);
  const subject    = subjectEl.value;

  const check = validateInput(cleanInput, subject);
  if (!check.ok) {
    if (!subject) subjectEl.reportValidity();
    else          inputEl.reportValidity();
    if (check.error) console.warn(check.error);
    return;
  }

  // Capture attached file BEFORE rendering so preview shows in the bubble
  const fileToSend = attachedFile;
  if (attachedFile) cancelFileBtn.click(); // clears UI and resets attachedFile

  renderUserMessage(cleanInput, fileToSend);
  inputEl.value = '';
  inputEl.style.height = 'auto';
  saveChatToStorage();

  setProcessing(true);
  const loader = renderLoading();

  try {
    const { text, finishReason } = await callAPI(subject, cleanInput, fileToSend);
    await renderTurn(subject, text, finishReason, loader);
  } catch (err) {
    console.error(err);
    loader.remove();
    renderError(err.message || SETTINGS.errorMessage);
  } finally {
    setProcessing(false);
    inputEl.focus();
  }
}

async function handleContinuation(subject) {
  if (isProcessing) return;
  setProcessing(true);
  const loader = renderLoading();

  try {
    const { text, finishReason } = await callAPI(
      subject,
      'Please continue exactly from where you stopped. Do not repeat anything already written.'
    );
    await renderTurn(subject, text, finishReason, loader);
  } catch (err) {
    console.error(err);
    loader.remove();
    renderError(err.message || SETTINGS.errorMessage);
  } finally {
    setProcessing(false);
    inputEl.focus();
  }
}

btnEl.addEventListener('click', handleSubmit);
// Enter key intentionally NOT bound to send — users tap the button.
// This lets Enter/Return always create a new line on mobile and desktop.
subjectEl.addEventListener('change', () => {
  clearHistory();
  const chat = chatEl();
  if (chat) chat.innerHTML = '';
  localStorage.removeItem(CHAT_HTML_KEY);
  localStorage.removeItem(CHAT_SUBJECT_KEY);
});

// Restore previous session when page loads
document.addEventListener('DOMContentLoaded', restoreChat);
// Also try immediately in case DOM is already ready
if (document.readyState !== 'loading') restoreChat();
