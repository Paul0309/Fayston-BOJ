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

  const remaining = useMemo(() => {
    if (!state) return 0;
    const end = new Date(state.battle.startedAt).getTime() + state.battle.durationSec * 1000;
    return Math.max(0, Math.floor((end - Date.now()) / 1000));
  }, [state]);

  const myAccepted = useMemo(() => state?.mySubmissions.some((s) => s.status === "ACCEPTED") || false, [state]);
  const finished = state?.battle.status === "FINISHED";

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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-4 min-h-[70vh]">
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
            {finished ? <div>Rating Δ: {myRatingDelta >= 0 ? `+${myRatingDelta}` : myRatingDelta}</div> : null}
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
        <div className="flex-1 min-h-[420px]">
          <Editor
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
          />
        </div>
        <div className="border-t border-neutral-700 p-3">
          <h3 className="text-sm font-semibold text-neutral-100 mb-2">My submissions</h3>
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

