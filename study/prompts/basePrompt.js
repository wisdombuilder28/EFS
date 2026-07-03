// Step 3 of the pipeline: build the system prompt.
// Maps the dropdown value (e.g. "physics") to the right specialised prompt.
import { sciencePrompt } from "./Science Prompt.js";
import { theoryPrompt } from "./Theory Prompt.js";
import { languagePrompt } from "./Language Prompt.js";

// Display labels shown back to the model.
const SUBJECT_LABELS = {
  english: "English Language",
  mathematics: "General Mathematics",
  civic_edu: "Civic Education",
  biology: "Biology",
  chemistry: "Chemistry",
  physics: "Physics",
  agric_science: "Agricultural Science",
  further_maths: "Further Mathematics",
  literature: "Literature in English",
  government: "Government",
  economics: "Economics",
  commerce: "Commerce",
  financial_accounting: "Financial Accounting",
  igbo: "Igbo Language",
  geography: "Geography",
  crs: "Christian Religious Studies",
  digi_tech: "Digital Technology",
};

// Which family each subject belongs to.
const SUBJECT_FAMILY = {
  // Science family
  mathematics: "science",
  further_maths: "science",
  physics: "science",
  chemistry: "science",
  biology: "science",
  agric_science: "science",
  data_processing: "science",
  // Language family
  english: "language",
  literature: "language",
  igbo: "language",
  // Theory family (everything else)
  civic_edu: "theory",
  government: "theory",
  economics: "theory",
  commerce: "theory",
  financial_accounting: "theory",
  geography: "theory",
  crs: "theory",
};

export function BasePrompt(subjectKey) {
  const key = (subjectKey || "").toLowerCase().trim();
  const label = SUBJECT_LABELS[key] || subjectKey || "the selected subject";
  const family = SUBJECT_FAMILY[key] || "theory";

  switch (family) {
    case "science":  return sciencePrompt(label);
    case "language": return languagePrompt(label);
    case "theory":
    default:         return theoryPrompt(label);
  }
}
