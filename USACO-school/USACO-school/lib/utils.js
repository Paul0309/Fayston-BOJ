// ─── Output normalisation ──────────────────────────────────────────────────────
// Strips \r (Windows line endings) and leading/trailing whitespace before compare
export const normalizeOutput = (t) => String(t || "").replace(/\r/g, "").trim();

// ─── Timer formatting ──────────────────────────────────────────────────────────
// Returns "MM:SS" from a millisecond duration (clamps at 0)
export const formatTime = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// ─── localStorage helpers (browser-only) ──────────────────────────────────────
export const readStorage  = (k, fb) => {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; }
};
export const writeStorage = (k, v) => localStorage.setItem(k, JSON.stringify(v));
