// Step 5 of the pipeline.
// Tidy up raw model output before rendering.
export function cleanResponse(text) {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")     // trailing spaces on lines
    .replace(/\n{3,}/g, "\n\n")     // collapse big gaps
    .replace(/[ \t]{2,}/g, " ")     // collapse runs of spaces
    .trim();
}
