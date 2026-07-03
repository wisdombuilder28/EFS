// Step 1 of the pipeline.
// Strip control chars, collapse whitespace, and trim.
// Keep it lossless for normal text — we only want to remove junk.
export function sanitizeInput(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, " ") // control chars
    .replace(/\s+/g, " ")                    // collapse whitespace
    .trim();
}
