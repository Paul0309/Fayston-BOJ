import { STORAGE_KEYS } from "./constants";

// ─── Persist a completed contest to the history list ──────────────────────────
// Saves per-problem code and submission logs so the profile page can replay them.
export function saveHistory(currentUser, contest, promoted) {
  if (!currentUser || !contest) return;
  try {
    const hist = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || "[]");
    hist.push({
      username:  currentUser.username,
      division:  contest.division,
      date:      Date.now(),
      duration:  Date.now() - contest.startTime,
      promoted,
      problems:  contest.questions.map((q) => ({
        id:              q.id,
        title:           q.title,
        score:           q.score,
        language:        q.language,
        code:            q.code,
        submissionLogs:  q.submissionLogs || [],
        attempts:        (q.submissionLogs || []).length,
      })),
    });
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(hist));
  } catch {}
}
