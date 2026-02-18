"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  STORAGE_KEYS,
  DIVISIONS,
  LANG_LABELS,
  normalizeContest,
  normalizeOutput,
  readStorage,
  writeStorage,
  saveHistory,
} from "../../../lib/contest";

// ─── Compile helper (client → API) ────────────────────────────────────────────
async function runCompiler(code, input, language) {
  const res = await fetch("/api/compile", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ code, input, language }),
  });
  const data = await res.json();
  if (!res.ok) {
    const type   = data.errorType ? String(data.errorType).toUpperCase() : "ERROR";
    const stderr = data.details?.stderr ? `\n${data.details.stderr.trim()}` : "";
    throw new Error(`${type}: ${data.error || "Compile failed"}${stderr}`);
  }
  return normalizeOutput(data.output);
}

// ─── Custom hook: all contest state, effects, and handlers ────────────────────
// Returns everything needed by ContestPage and its sub-components.
export default function useContestState() {
  const router = useRouter();

  const [users,       setUsers]       = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [contest,     setContest]     = useState(null);
  const [hydrated,    setHydrated]    = useState(false);
  const [tick,        setTick]        = useState(0);
  const [busyQ,       setBusyQ]       = useState(""); // id of question being submitted
  const [runBusy,     setRunBusy]     = useState(false);
  const [output,      setOutput]      = useState({ text: "", status: "idle" });
  const [showResult,  setShowResult]  = useState(false);

  // ── Hydration ───────────────────────────────────────────────────────────────
  useEffect(() => {
    setUsers(readStorage(STORAGE_KEYS.users, []));
    setCurrentUser(readStorage(STORAGE_KEYS.current, null));
    setContest(normalizeContest(readStorage(STORAGE_KEYS.contest, null)));
    setTick(Date.now());
    setHydrated(true);
  }, []);

  // ── Persistence ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (hydrated) writeStorage(STORAGE_KEYS.users, users);
  }, [users, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    currentUser
      ? writeStorage(STORAGE_KEYS.current, currentUser)
      : localStorage.removeItem(STORAGE_KEYS.current);
  }, [currentUser, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    contest
      ? writeStorage(STORAGE_KEYS.contest, contest)
      : localStorage.removeItem(STORAGE_KEYS.contest);
  }, [contest, hydrated]);

  // ── Timer tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hydrated]);

  // ── Auth guard (redirect if not logged in or no active contest) ─────────────
  useEffect(() => {
    if (!hydrated) return;
    if (!currentUser) { router.replace("/auth"); return; }
    if (!contest || contest.username !== currentUser.username) router.replace("/");
  }, [hydrated, currentUser, contest, router]);

  // ── Computed values ─────────────────────────────────────────────────────────
  const selQ      = contest ? (contest.questions.find((q) => q.id === contest.selectedId) || contest.questions[0]) : null;
  const timeLeft  = contest ? contest.endTime - tick : 0;
  const timerEnd  = timeLeft <= 0;
  const allPerfect = contest ? contest.questions.every((q) => q.score === 100) : false;

  // ── Show result overlay when all problems are perfect ───────────────────────
  // IMPORTANT: this effect must come before any early return in the page component.
  useEffect(() => {
    if (allPerfect && hydrated) setShowResult(true);
  }, [allPerfect, hydrated]);

  // ── State helpers ────────────────────────────────────────────────────────────
  const setSelId = (id) =>
    setContest((p) => p ? { ...p, selectedId: id } : p);

  const patchQ = (id, patch) =>
    setContest((p) =>
      !p ? p : { ...p, questions: p.questions.map((q) => q.id === id ? { ...q, ...patch } : q) }
    );

  // ── Run against sample input ─────────────────────────────────────────────────
  const handleRun = async () => {
    if (!selQ || runBusy) return;
    setRunBusy(true);
    setOutput({ text: "Running…", status: "running" });
    try {
      const input = typeof selQ.runInput === "string" ? selQ.runInput : selQ.sampleInput;
      const out = await runCompiler(selQ.code, input, selQ.language);
      setOutput({ text: out || "(empty)", status: "ok" });
    } catch (e) {
      setOutput({ text: e.message, status: "err" });
    } finally {
      setRunBusy(false);
    }
  };

  // ── Submit against all test cases ───────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selQ || timerEnd) return;
    const lang      = selQ.language;
    const langLabel = LANG_LABELS[lang];
    setBusyQ(selQ.id);
    setOutput({ text: "Judging…", status: "running" });
    try {
      const logs  = Array.isArray(selQ.submissionLogs) ? selQ.submissionLogs : [];
      const total = selQ.tests.length;
      let passed = 0, failDetail = "";

      for (let i = 0; i < total; i++) {
        const t   = selQ.tests[i];
        const out = await runCompiler(selQ.code, t.input, lang);
        if (normalizeOutput(out) === normalizeOutput(t.output)) {
          passed++;
          setOutput({ text: `[${langLabel}] Running… ${i + 1}/${total} ✓`, status: "running" });
        } else {
          failDetail = `Wrong Answer on test #${i + 1} — expected "${normalizeOutput(t.output)}", got "${normalizeOutput(out)}"`;
          break;
        }
      }

      const score   = Math.floor((passed / total) * 100);
      const verdict = score === 100 ? "Accepted" : "Wrong Answer";
      const logLine = score === 100
        ? `✓ [${langLabel}] ${verdict} — ${passed}/${total} tests — ${score}/100`
        : `✗ [${langLabel}] ${verdict} — ${passed}/${total} tests — ${score}/100 | ${failDetail}`;

      patchQ(selQ.id, { submitted: true, score, status: verdict, submissionLogs: [...logs, logLine] });
      setOutput({
        text:   score === 100
          ? `✓ All ${total} tests passed  [${langLabel}]  Score: 100/100`
          : `✗ ${passed}/${total} tests passed  [${langLabel}]  Score: ${score}/100\n\n${failDetail}`,
        status: score === 100 ? "ok" : "err",
      });
    } catch (e) {
      const logs      = Array.isArray(selQ.submissionLogs) ? selQ.submissionLogs : [];
      const msg       = e instanceof Error ? e.message : "Error";
      const errorType = msg.startsWith("COMPILE") ? "Compile Error"
                      : msg.startsWith("RUNTIME") ? "Runtime Error"
                      : "Error";
      const langLabel = LANG_LABELS[selQ.language];
      const logLine   = `✗ [${langLabel}] ${errorType} — 0/${selQ.tests.length} tests — 0/100 | ${msg}`;
      patchQ(selQ.id, { submitted: true, score: 0, status: errorType, submissionLogs: [...logs, logLine] });
      setOutput({ text: `[${langLabel}] ${msg}`, status: "err" });
    } finally {
      setBusyQ("");
    }
  };

  // ── Exit contest: save history, optionally promote user ──────────────────────
  const exitContest = (promoted) => {
    saveHistory(currentUser, contest, promoted);
    if (promoted) {
      const idx = DIVISIONS.indexOf(currentUser.division);
      if (idx >= 0 && idx < DIVISIONS.length - 1) {
        // Promote to next division
        const next      = DIVISIONS[idx + 1];
        const promoted2 = { ...currentUser, division: next };
        setCurrentUser(promoted2);
        setUsers((prev) => prev.map((u) => u.username === currentUser.username ? promoted2 : u));
      } else {
        // Platinum complete — set flag so home page shows congratulations
        const updated = { ...currentUser, platinumComplete: true };
        setCurrentUser(updated);
        setUsers((prev) => prev.map((u) => u.username === currentUser.username ? updated : u));
      }
    }
    setContest(null);
    router.push("/");
  };

  return {
    // State
    users, currentUser, contest, hydrated, tick,
    busyQ, runBusy, output, showResult,
    // Computed
    selQ, timeLeft, timerEnd, allPerfect,
    // Handlers
    setSelId, patchQ, handleRun, handleSubmit, exitContest,
  };
}
