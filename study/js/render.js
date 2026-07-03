/**
 * js/render.js  — Render messages to the DOM.
 *
 * Modes:
 *   "chat"  → left-aligned bubble (short / casual answers)
 *   "study" → centered reading panel (long / academic answers)
 *
 * Math optimisation:
 *   When the HTML contains MathJax delimiters (\[ or \(), we skip the
 *   character-by-character typing animation (which shows raw LaTeX during
 *   its reveal) and instead insert the whole block instantly, then let
 *   MathJax render it cleanly with a fade-in animation.
 */
import { SETTINGS } from '../config/settings.js';

const chat = () => document.querySelector('#chat');

function scrollToBottom() {
  const c = chat();
  if (c) c.scrollTop = c.scrollHeight;
}

/* ─── User message ──────────────────────────────────────────────────────── */
export function renderUserMessage(text) {
  const el = document.createElement('div');
  el.className = 'bubble userBubble';
  el.textContent = text;
  chat().append(el);
  scrollToBottom();
  return el;
}

/* ─── Animated "Thinking…" loader ───────────────────────────────────────── */
export function renderLoading() {
  const wrap = document.createElement('div');
  wrap.className = 'bubble aiBubble loadingBubble';
  wrap.setAttribute('aria-live', 'polite');
  wrap.innerHTML = `
    <span class="loading-label">${SETTINGS.thinkingLabel}</span>
    <span class="dots"><span></span><span></span><span></span></span>
  `;
  chat().append(wrap);
  scrollToBottom();
  return wrap;
}

/* ─── Error bubble ──────────────────────────────────────────────────────── */
export function renderError(message) {
  const el = document.createElement('div');
  el.className = 'bubble errorBubble';
  el.textContent = message || SETTINGS.errorMessage;
  chat().append(el);
  scrollToBottom();
  return el;
}

/* ─── Continue button (shown when model response was cut off) ───────────── */
export function renderContinueButton(onContinue) {
  const btn = document.createElement('button');
  btn.className = 'continueBtn';
  btn.setAttribute('aria-label', 'Continue reading the response');
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6"/>
    </svg>
    Continue
  `;
  btn.addEventListener('click', () => { btn.remove(); onContinue(); });
  chat().append(btn);
  scrollToBottom();
  return btn;
}

/* ─── AI message (chat bubble or study panel) ────────────────────────────── */
export async function renderAIMessage(html, mode = 'chat') {
  const hasMath = /\\\[|\\\(/.test(html);
  let target;

  if (mode === 'study') {
    const panel = document.createElement('article');
    panel.className = 'studyPanel';
    panel.innerHTML = `
      <header class="studyPanel__header">
        <span class="studyPanel__badge">📘 Study Mode</span>
      </header>
      <div class="studyPanel__body"></div>
    `;
    chat().append(panel);
    target = panel.querySelector('.studyPanel__body');
  } else {
    target = document.createElement('div');
    target.className = 'bubble aiBubble';
    chat().append(target);
  }

  if (hasMath) {
    // Instant render for math content: avoids exposing raw LaTeX mid-animation.
    // CSS fade-in handles the visual transition.
    target.innerHTML = html;
    target.classList.add('mathReveal');
  } else {
    await typeInto(target, html, SETTINGS.typingSpeedMs);
  }

  // Trigger MathJax after all content is in the DOM.
  if (window.MathJax?.typesetPromise) {
    try { await window.MathJax.typesetPromise([target]); } catch { /* ignore */ }
  }

  scrollToBottom();
  return target;
}

/* ─── Character-by-character typing animation ────────────────────────────── */
// Walks parsed DOM nodes; animates only text nodes so inline tags / HTML
// structure are never broken.
async function typeInto(target, html, speedMs) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  async function walk(srcNode, dstParent) {
    for (const child of Array.from(srcNode.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const span = document.createTextNode('');
        dstParent.append(span);
        const full = child.textContent || '';
        for (let i = 0; i < full.length; i++) {
          span.textContent += full[i];
          if (i % 4 === 0) {
            await new Promise((r) => setTimeout(r, speedMs));
            scrollToBottom();
          }
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const clone = child.cloneNode(false);
        dstParent.append(clone);
        await walk(child, clone);
      }
    }
  }

  await walk(tmp, target);
}
