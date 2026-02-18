// ─── Central re-export point ───────────────────────────────────────────────────
// Import from here to get everything at once.
// Sub-modules can also be imported directly for more granular access.

export * from "./constants";
export * from "./templates";
export * from "./problems";
export * from "./utils";
export * from "./history";

// Internal imports used by the functions below
import { LANGUAGES, CONTEST_MS } from "./constants";
import { CODE_TEMPLATES }        from "./templates";
import { QUESTION_BANK }         from "./problems";

// ─── Contest normalisation ─────────────────────────────────────────────────────
// Called on values read from localStorage to fill in missing fields
// (handles data saved by older versions of the app).
export const normalizeContest = (rawContest) => {
  if (!rawContest || !Array.isArray(rawContest.questions)) return rawContest;
  return {
    ...rawContest,
    questions: rawContest.questions.map((q) => ({
      ...q,
      language:       LANGUAGES.includes(q.language) ? q.language : "python",
      code:           typeof q.code === "string" && q.code.length > 0 ? q.code : CODE_TEMPLATES.python,
      runInput:       typeof q.runInput === "string" ? q.runInput : (q.sampleInput || ""),
      submissionLogs: Array.isArray(q.submissionLogs) ? q.submissionLogs : [],
    })),
  };
};

// ─── Contest factory ───────────────────────────────────────────────────────────
// Creates a fresh contest object for the given division / username.
export const makeContest = (division, username) => ({
  username,
  division,
  startTime:  Date.now(),
  endTime:    Date.now() + CONTEST_MS,
  selectedId: QUESTION_BANK[division][0].id,
  questions:  QUESTION_BANK[division].map((q) => ({
    ...q,
    language:       "python",
    code:           CODE_TEMPLATES.python,
    runInput:       q.sampleInput || "",
    submitted:      false,
    score:          0,
    status:         "Not submitted",
    submissionLogs: [],
  })),
});
