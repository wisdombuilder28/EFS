/**
 * utils/mathFixer.js
 *
 * THREE-STAGE LaTeX pipeline:
 *   fixLatex()     → normalise model output (fix bare brackets, $$ => \[ \])
 *   protectLatex() → extract all \[ ... \] and \( ... \) into placeholders
 *                    BEFORE marked.parse() can mangle the backslashes
 *   restoreLatex() → put real LaTeX back AFTER marked.parse()
 *
 * Why this matters:
 *   In CommonMark / marked.js, \[ is an escaped bracket that renders as [.
 *   If we pass \[formula\] straight into marked.parse(), MathJax later
 *   sees [formula] and renders nothing.  Protecting first guarantees survival.
 */

// Unique sentinels — guillemet chars (U+00AB U+00BB) never appear in maths.
const PH_PRE  = '\u00AB\u00ABEFS_MATH_';
const PH_POST = '\u00BB\u00BB';
const ph = (n) => `${PH_PRE}${n}${PH_POST}`;
const PH_RE   = new RegExp(
  PH_PRE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
  '(\\d+)' +
  PH_POST.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  'g'
);

/* --- Stage 1: Fix / normalise the model's LaTeX output ------------------- */
export function fixLatex(text) {
  if (!text) return '';
  let t = text;

  // Remove double-wrapping artefacts: [ \[ ... \] ] => \[ ... \]
  t = t.replace(/\[\s*\\\[([\s\S]*?)\\\]\s*\]/g, '\\[$1\\]');

  // $$ ... $$ display math => \[ ... \]
  t = t.replace(/\$\$([\s\S]*?)\$\$/g, (_, c) => `\\[${c}\\]`);

  // $ ... $ inline math => \( ... \)  (skip $$)
  t = t.replace(/(?<!\$)\$([^\$\n]{1,200}?)\$(?!\$)/g, (_, c) => `\\(${c}\\)`);

  // Bare [ ... ] on its own line that looks like maths => \[ ... \]
  t = t.replace(/^[ \t]*\[([^\[\]\n]+)\][ \t]*$/gm, (match, inner) => {
    if (/[\\^_{}|=]/.test(inner) || /\d+\s*[+\-*/=]\s*\d/.test(inner)) {
      return `\\[${inner}\\]`;
    }
    return match;
  });

  // Bare [ ... ] inline that look like maths (not markdown links [text](url))
  t = t.replace(/\[([^\[\]\n]{3,200})\](?!\()/g, (match, inner) => {
    if (/[\\^_{}]/.test(inner) || /\d+\s*[+\-*/=]\s*[-\d]/.test(inner)) {
      return `\\[${inner}\\]`;
    }
    return match;
  });

  return t;
}

/* --- Stage 2: Protect LaTeX BEFORE marked.parse() ------------------------ */
export function protectLatex(text) {
  if (!text) return { safe: '', store: [] };
  const store = [];

  const safe = text
    // Display math \[ ... \]
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, c) => {
      store.push(`\\[${c}\\]`);
      return ph(store.length - 1);
    })
    // Inline math \( ... \)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, c) => {
      store.push(`\\(${c}\\)`);
      return ph(store.length - 1);
    });

  return { safe, store };
}

/* --- Stage 3: Restore LaTeX AFTER marked.parse() ------------------------- */
export function restoreLatex(html, store) {
  return html.replace(PH_RE, (_, i) => store[+i] ?? '');
}
