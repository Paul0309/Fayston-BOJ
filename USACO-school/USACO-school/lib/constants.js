// ─── Storage keys ─────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  users:   "usaco_next_users",
  current: "usaco_next_current_user",
  contest: "usaco_next_active_contest",
  history: "usaco_next_history",
};

// ─── Contest structure ─────────────────────────────────────────────────────────
export const DIVISIONS  = ["Bronze", "Silver", "Gold", "Platinum"];
export const LANGUAGES  = ["c", "cpp", "java", "python"];
export const CONTEST_MS = 30 * 60 * 1000; // 30 minutes in ms
export const CONTEST_WEEKDAY = 5; // Friday (0=Sunday ... 6=Saturday)

// ─── Language display maps (used in contest page and profile page) ─────────────
export const LANG_LABELS = { c: "C", cpp: "C++17", java: "Java 11", python: "Python 3" };
export const LANG_EXT    = { c: "main.c", cpp: "main.cpp", java: "Main.java", python: "main.py" };
export const LANG_ICON   = { c: "🔵", cpp: "🔵", java: "☕", python: "🐍" };
export const MONACO_LANG = { c: "c", cpp: "cpp", java: "java", python: "python" };
