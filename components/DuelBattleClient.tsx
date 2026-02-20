"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { LANGUAGE_META, type SupportedLanguage } from "@/lib/languages";
import MarkdownMath from "@/components/MarkdownMath";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type BattleState = {
  battle: {
    id: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    durationSec: number;
    winnerId: string | null;
    player1: { id: string; name: string | null; rating: number };
    player2: { id: string; name: string | null; rating: number };
    ratings: Array<{ userId: string; ratingBefore: number; ratingAfter: number; ratingChange: number }>;
  };
  problem: {
    id: string;
    number: number;
    title: string;
    difficulty: string;
    description: string;
    inputDesc: string | null;
    outputDesc: string | null;
    timeLimit: number;
    memoryLimit: number;
    testCases: Array<{ input: string; output: string }>;
  };
  mySubmissions: Array<{
    id: string;
    status: string;
    totalScore: number | null;
    maxScore: number | null;
    failedCase: number | null;
    createdAt: string;
  }>;
  opponentSubmissionCount: number;
  opponentAccepted: boolean;
};

const langs: SupportedLanguage[] = ["python", "cpp", "java", "javascript"];

export default function DuelBattleClient({ battleId, myUserId }: { battleId: string; myUserId: string }) {
  const [state, setState] = useState<BattleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState<SupportedLanguage>("python");
  const [code, setCode] = useState<string>(LANGUAGE_META.python.defaultCode);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [opponentDraft, setOpponentDraft] = useState<{ language: string; code: string; cursorMeta?: string | null; updatedAt: string } | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [myCursorMeta, setMyCursorMeta] = useState<{
    line: number;
    column: number;
    selectionStartLine: number;
    selectionStartColumn: number;
    selectionEndLine: number;
    selectionEndColumn: number;
  } | null>(null);
  const [showFinishOverlay, setShowFinishOverlay] = useState(false);
  const [confettiSeed, setConfettiSeed] = useState(0);
  const finished = state?.battle.status === "FINISHED";

  const loadState = async () => {
    try {
      const res = await fetch(`/api/duel/battle/${battleId}/state`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as BattleState;
      setState(json);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load battle");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadState();
  }, [battleId]);

  useEffect(() => {
    const timer = setInterval(() => void loadState(), 2000);
    return () => clearInterval(timer);
  }, [battleId]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/duel/battle/${battleId}/draft`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          myDraft: { language: string; code: string; cursorMeta: string | null; updatedAt: string } | null;
          opponentDraft: { language: string; code: string; cursorMeta: string | null; updatedAt: string } | null;
        };
        if (json.opponentDraft) setOpponentDraft(json.opponentDraft);
      } catch {
        // ignore
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [battleId]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!state || finished || draftBusy) return;
      setDraftBusy(true);
      try {
        await fetch(`/api/duel/battle/${battleId}/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language, code, cursorMeta: myCursorMeta })
        });
      } catch {
        // ignore
      } finally {
        setDraftBusy(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [battleId, code, draftBusy, finished, language, myCursorMeta, state]);

  useEffect(() => {
    if (finished) {
      setShowFinishOverlay(true);
      setConfettiSeed((v) => v + 1);
    }
  }, [finished]);

  const remaining = useMemo(() => {
    if (!state) return 0;
    const end = new Date(state.battle.startedAt).getTime() + state.battle.durationSec * 1000;
    return Math.max(0, Math.floor((end - nowTick) / 1000));
  }, [nowTick, state]);

  const myAccepted = useMemo(() => state?.mySubmissions.some((s) => s.status === "ACCEPTED") || false, [state]);

  const submit = async () => {
    if (submitBusy || !state || finished) return;
    setSubmitBusy(true);
    try {
      const res = await fetch(`/api/duel/battle/${battleId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language })
      });
      if (!res.ok) throw new Error(await res.text());
      await loadState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitBusy(false);
    }
  };

  if (loading && !state) return <div className="text-neutral-300">Loading battle...</div>;
  if (!state) return <div className="text-red-300">{error || "No battle state"}</div>;

  const meIsP1 = state.battle.player1.id === myUserId;
  const opponent = meIsP1 ? state.battle.player2 : state.battle.player1;
  const myRatingDelta = state.battle.ratings.find((r) => r.userId === myUserId)?.ratingChange || 0;

  const myLatest = state.mySubmissions[0];
  const winnerName = state.battle.winnerId
    ? state.battle.winnerId === state.battle.player1.id
      ? state.battle.player1.name || "Player1"
      : state.battle.player2.name || "Player2"
    : "DRAW";
  const myResult = !finished ? "RUNNING" : state.battle.winnerId === null ? "DRAW" : state.battle.winnerId === myUserId ? "WIN" : "LOSE";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-4 min-h-[70vh]">
      {showFinishOverlay && finished ? (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-[2px] flex items-center justify-center">
          <div className="duel-confetti-wrap" key={confettiSeed}>
            {Array.from({ length: 32 }).map((_, idx) => (
              <span key={idx} className="duel-confetti" style={{ left: `${(idx * 17) % 100}%`, animationDelay: `${(idx % 8) * 0.12}s` }} />
            ))}
          </div>
          <div className="rounded-xl border border-emerald-500/40 bg-neutral-900 p-8 text-center relative z-[1]">
            <h2 className="text-3xl font-black text-neutral-100 mb-2">{myResult === "WIN" ? "Victory!" : myResult === "LOSE" ? "Defeat" : "Draw"}</h2>
            <div className="text-sm text-neutral-300 mb-1">Winner: {winnerName}</div>
            <div className={`text-lg font-bold ${myRatingDelta >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              Rating {myRatingDelta >= 0 ? `+${myRatingDelta}` : myRatingDelta}
            </div>
            <button
              type="button"
              className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              onClick={() => setShowFinishOverlay(false)}
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}
      {error ? <div className="xl:col-span-2 rounded border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-200">{error}</div> : null}

      <aside className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-4 overflow-auto">
        <div>
          <h1 className="text-xl font-bold text-neutral-100">{state.problem.title}</h1>
          <div className="text-xs text-neutral-400 mt-1">
            #{state.problem.number} | {state.problem.difficulty} | {state.problem.timeLimit}ms | {state.problem.memoryLimit}MB
          </div>
        </div>
        <section>
          <h2 className="text-sm font-semibold text-neutral-100 mb-1">Problem</h2>
          <MarkdownMath className="prose prose-invert max-w-none text-sm" statementMode content={state.problem.description} />
        </section>
        <section>
          <h2 className="text-sm font-semibold text-neutral-100 mb-1">Input</h2>
          <MarkdownMath className="prose prose-invert max-w-none text-sm" statementMode content={state.problem.inputDesc || "-"} />
        </section>
        <section>
          <h2 className="text-sm font-semibold text-neutral-100 mb-1">Output</h2>
          <MarkdownMath className="prose prose-invert max-w-none text-sm" statementMode content={state.problem.outputDesc || "-"} />
        </section>
        <section>
          <h2 className="text-sm font-semibold text-neutral-100 mb-1">Sample</h2>
          <div className="rounded border border-neutral-700 p-2 text-xs">
            <div className="text-neutral-400">Input</div>
            <pre className="text-neutral-100 whitespace-pre-wrap">{state.problem.testCases[0]?.input || "-"}</pre>
            <div className="text-neutral-400 mt-2">Output</div>
            <pre className="text-neutral-100 whitespace-pre-wrap">{state.problem.testCases[0]?.output || "-"}</pre>
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-neutral-100 mb-1">Battle</h2>
          <div className="text-xs text-neutral-300 space-y-1">
            <div>Opponent: {opponent.name || "Unknown"} ({opponent.rating})</div>
            <div>Status: {state.battle.status}</div>
            <div>Remaining: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</div>
            <div>Opponent submissions: {state.opponentSubmissionCount}</div>
            <div>Opponent accepted: {state.opponentAccepted ? "YES" : "NO"}</div>
            <div>My accepted: {myAccepted ? "YES" : "NO"}</div>
            {finished ? (
              <>
                <div>Winner: {winnerName}</div>
                <div>My result: {myResult}</div>
                <div>Rating Δ: {myRatingDelta >= 0 ? `+${myRatingDelta}` : myRatingDelta}</div>
              </>
            ) : null}
          </div>
        </section>
      </aside>

      <section className="rounded-xl border border-neutral-700 bg-neutral-900 flex flex-col">
        <div className="border-b border-neutral-700 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {langs.map((lang) => (
              <button
                key={lang}
                type="button"
                className={`rounded px-3 py-1 text-xs ${language === lang ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-200"}`}
                onClick={() => {
                  setLanguage(lang);
                  setCode(LANGUAGE_META[lang].defaultCode);
                }}
                disabled={finished || submitBusy}
              >
                {LANGUAGE_META[lang].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => void submit()}
            disabled={finished || submitBusy}
          >
            {submitBusy ? "Submitting..." : "Submit"}
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 h-[65vh] min-h-[420px] max-h-[780px] flex-none">
          <div className="border-r border-neutral-700">
            <div className="px-3 py-1 text-xs text-neutral-400 border-b border-neutral-700">My code</div>
            <Editor
              key={opponentDraft?.updatedAt || "opp-editor"}
              height="100%"
              theme="vs-dark"
              language={LANGUAGE_META[language].monaco}
              value={code}
              onChange={(value) => setCode(value || "")}
              options={{
                minimap: { enabled: false },
                automaticLayout: true,
                fontSize: 14,
                scrollBeyondLastLine: false
              }}
              onMount={(editor) => {
                editor.onDidChangeCursorPosition((e) => {
                  const sel = editor.getSelection();
                  setMyCursorMeta({
                    line: e.position.lineNumber,
                    column: e.position.column,
                    selectionStartLine: sel?.startLineNumber || e.position.lineNumber,
                    selectionStartColumn: sel?.startColumn || e.position.column,
                    selectionEndLine: sel?.endLineNumber || e.position.lineNumber,
                    selectionEndColumn: sel?.endColumn || e.position.column
                  });
                });
                editor.onDidChangeCursorSelection((e) => {
                  const s = e.selection;
                  setMyCursorMeta((prev) => ({
                    line: prev?.line || s.positionLineNumber,
                    column: prev?.column || s.positionColumn,
                    selectionStartLine: s.startLineNumber,
                    selectionStartColumn: s.startColumn,
                    selectionEndLine: s.endLineNumber,
                    selectionEndColumn: s.endColumn
                  }));
                });
              }}
            />
          </div>
          <div>
            <div className="px-3 py-1 text-xs text-neutral-400 border-b border-neutral-700">
              Opponent live code {opponentDraft?.updatedAt ? `(${new Date(opponentDraft.updatedAt).toLocaleTimeString()})` : ""}
            </div>
            <Editor
              height="100%"
              theme="vs-dark"
              language={LANGUAGE_META[(opponentDraft?.language as SupportedLanguage) || "python"].monaco}
              value={opponentDraft?.code || "// Waiting for opponent draft..."}
              onMount={(editor, monaco) => {
                const raw = opponentDraft?.cursorMeta;
                if (!raw) return;
                try {
                  const parsed = JSON.parse(raw) as {
                    line: number;
                    column: number;
                    selectionStartLine: number;
                    selectionStartColumn: number;
                    selectionEndLine: number;
                    selectionEndColumn: number;
                  };
                  editor.deltaDecorations(
                    [],
                    [
                      {
                        range: new monaco.Range(
                          parsed.line || 1,
                          parsed.column || 1,
                          parsed.line || 1,
                          Math.max((parsed.column || 1) + 1, 2)
                        ),
                        options: { inlineClassName: "duel-opp-cursor" }
                      },
                      {
                        range: new monaco.Range(
                          parsed.selectionStartLine || parsed.line || 1,
                          parsed.selectionStartColumn || parsed.column || 1,
                          parsed.selectionEndLine || parsed.line || 1,
                          parsed.selectionEndColumn || parsed.column || 1
                        ),
                        options: { inlineClassName: "duel-opp-selection" }
                      }
                    ]
                  );
                } catch {
                  // ignore parse error
                }
              }}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                automaticLayout: true,
                fontSize: 14,
                scrollBeyondLastLine: false
              }}
            />
          </div>
        </div>
        <div className="border-t border-neutral-700 p-3">
          <h3 className="text-sm font-semibold text-neutral-100 mb-2">My submissions</h3>
          <div className="mb-2 text-xs text-neutral-300">
            Latest: {myLatest ? `${myLatest.status}${myLatest.totalScore !== null ? ` ${myLatest.totalScore}/${myLatest.maxScore}` : ""}` : "None"}
          </div>
          <div className="space-y-1 max-h-44 overflow-auto">
            {state.mySubmissions.map((s) => (
              <div key={s.id} className="rounded border border-neutral-800 px-2 py-1 text-xs flex items-center justify-between">
                <span className={s.status === "ACCEPTED" ? "text-emerald-300" : s.status === "PENDING" ? "text-amber-300" : "text-red-300"}>{s.status}</span>
                <span className="text-neutral-400">{new Date(s.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
            {state.mySubmissions.length === 0 ? <div className="text-xs text-neutral-500">No submissions yet.</div> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
