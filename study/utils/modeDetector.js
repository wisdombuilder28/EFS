// Decide whether an AI response should render as a chat bubble
// (short, casual) or a centered study panel (long, academic).
//
// Heuristics (any one triggers STUDY mode):
//   - raw text length > 300 chars
//   - contains math: =, ^, fractions, \[, \(, $$, common operators with numbers
//   - has 2+ paragraphs (double newline) OR 3+ list items
//   - has a markdown heading (#, ##) or 3+ lines that look like steps
export function detectMode(rawText) {
  if (!rawText) return "chat";
  const text = String(rawText);

  if (text.length > 300) return "study";

  const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
  if (paragraphs.length >= 2) return "study";

  const listItems = (text.match(/^\s*([-*]|\d+\.)\s+/gm) || []).length;
  if (listItems >= 3) return "study";

  if (/^#{1,6}\s+/m.test(text)) return "study";

  // Math / equation indicators
  const hasLatex = /\\\[|\\\(|\$\$/.test(text);
  const hasEquation = /[A-Za-z0-9)]\s*=\s*[-+(]?\s*\d/.test(text);
  const hasFormulaOps = /[\^√∑∫π]|\b\d+\s*[\/×x*]\s*\d+/.test(text);
  if (hasLatex || hasEquation || hasFormulaOps) return "study";

  return "chat";
}
