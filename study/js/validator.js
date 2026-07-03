// Step 2 of the pipeline.
// Returns { ok: boolean, error?: string }.
import { SETTINGS } from "../config/settings.js";

export function validateInput(text, subject) {
  if (!subject) {
    return { ok: false, error: "Please select a subject first." };
  }
  if (!text || text.length < SETTINGS.minInputLength) {
    return { ok: false, error: "Please type a question." };
  }
  if (text.length > SETTINGS.maxInputLength) {
    return {
      ok: false,
      error: `Question is too long (max ${SETTINGS.maxInputLength} characters).`,
    };
  }
  return { ok: true };
}
