"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LeaderboardUser = {
  id: string;
  name: string | null;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
};

type RecentBattle = {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  winnerId: string | null;
  problem: { id: string; number: number; title: string };
  player1: { id: string; name: string | null };
  player2: { id: string; name: string | null };
};

type HomeData = {
  me: {
    id: string;
    name: string | null;
    email: string | null;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
  };
  leaderboard: LeaderboardUser[];
  recent: RecentBattle[];
  activeBattleId: string | null;
  activeBattle?: {
    id: string;
    status: string;
    opponent: { id: string; name: string | null; rating: number };
  } | null;
};

export default function DuelDashboardClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<HomeData | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [queueJoinedAt, setQueueJoinedAt] = useState<string | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [matchFound, setMatchFound] = useState<HomeData["activeBattle"]>(null);
  const [queueStats, setQueueStats] = useState<{ queueSize: number; position: number | null; estimatedSec: number }>({
    queueSize: 0,
    position: null,
    estimatedSec: 0
  });

  const load = async () => {
    try {
      const [homeRes, queueRes] = await Promise.all([fetch("/api/duel/home", { cache: "no-store" }), fetch("/api/duel/queue", { cache: "no-store" })]);
      if (!homeRes.ok) throw new Error(await homeRes.text());
      if (!queueRes.ok) throw new Error(await queueRes.text());
      const home = (await homeRes.json()) as HomeData;
      const queue = (await queueRes.json()) as {
        inQueue: boolean;
        queueJoinedAt: string | null;
        battleId: string | null;
        queueSize: number;
        position: number | null;
        estimatedSec: number;
      };
      setData(home);
      setInQueue(queue.inQueue);
      setQueueJoinedAt(queue.queueJoinedAt);
      setQueueStats({
        queueSize: queue.queueSize || 0,
        position: queue.position || null,
        estimatedSec: queue.estimatedSec || 0
      });
      const bid = queue.battleId || home.activeBattleId;
      if (bid) {
        setInQueue(false);
        setQueueJoinedAt(null);
        setMatchFound(home.activeBattle || { id: bid, status: "RUNNING", opponent: { id: "", name: "Opponent", rating: 0 } });
        setTimeout(() => {
          window.location.href = `/arena/battle/${bid}`;
        }, 1300);
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void load(), 2500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!inQueue) return;
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [inQueue]);

  const queueSeconds = useMemo(() => {
    if (!queueJoinedAt) return 0;
    return Math.max(0, Math.floor((nowTick - new Date(queueJoinedAt).getTime()) / 1000));
  }, [nowTick, queueJoinedAt]);

  const joinQueue = async () => {
    setQueueBusy(true);
    try {
      const res = await fetch("/api/duel/queue", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { battleId: string | null; inQueue: boolean };
      if (json.battleId) {
        window.location.href = `/arena/battle/${json.battleId}`;
        return;
      }
      setInQueue(json.inQueue);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Queue join failed");
    } finally {
      setQueueBusy(false);
    }
  };

  const leaveQueue = async () => {
    setQueueBusy(true);
    try {
      const res = await fetch("/api/duel/queue", { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setInQueue(false);
      setQueueJoinedAt(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Queue leave failed");
    } finally {
      setQueueBusy(false);
    }
  };

  if (loading && !data) return <div className="text-neutral-300">Loading 1v1 arena...</div>;

  return (
    <div className="space-y-6">
      {matchFound ? (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="rounded-xl border border-blue-500/40 bg-neutral-900 p-8 text-center animate-pulse">
            <div className="text-blue-300 text-xs mb-2">MATCH FOUND</div>
            <div className="text-3xl font-black text-neutral-100 mb-1">VS {matchFound.opponent.name || "Opponent"}</div>
            <div className="text-sm text-neutral-400">Rating {matchFound.opponent.rating}</div>
            <div className="mt-4 text-emerald-300 text-sm">Entering battle room...</div>
          </div>
        </div>
      ) : null}
      {error ? <div className="rounded border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-200">{error}</div> : null}

      <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-6">
        <h1 className="text-2xl font-bold text-neutral-100">1v1 Arena</h1>
        <p className="text-sm text-neutral-400 mt-1">실시간 매칭으로 같은 문제를 풀어 먼저 AC를 받으면 승리합니다.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Stat label="Rating" value={String(data?.me.rating || 1200)} />
          <Stat label="Wins" value={String(data?.me.wins || 0)} />
          <Stat label="Losses" value={String(data?.me.losses || 0)} />
          <Stat label="Draws" value={String(data?.me.draws || 0)} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          {inQueue ? (
            <button
              type="button"
              onClick={() => void leaveQueue()}
              disabled={queueBusy}
              className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
            >
              {queueBusy ? "처리 중..." : "큐 취소"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void joinQueue()}
              disabled={queueBusy}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {queueBusy ? "처리 중..." : "매칭 시작"}
            </button>
          )}
          {inQueue ? <span className="text-sm text-amber-300">매칭 중... {Math.floor(queueSeconds / 60)}:{String(queueSeconds % 60).padStart(2, "0")}</span> : null}
          {inQueue ? (
            <span className="text-xs text-neutral-400">
              대기열 {queueStats.position || "-"} / {queueStats.queueSize} · 예상 {Math.floor(queueStats.estimatedSec / 60)}:
              {String(queueStats.estimatedSec % 60).padStart(2, "0")}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4">
          <h2 className="text-lg font-semibold text-neutral-100 mb-2">최근 배틀</h2>
          <div className="space-y-2">
            {data?.recent.length ? (
              data.recent.map((b) => {
                const isP1 = b.player1.id === data.me.id;
                const opponent = isP1 ? b.player2 : b.player1;
                const result = b.winnerId ? (b.winnerId === data.me.id ? "WIN" : "LOSE") : "DRAW";
                return (
                  <Link key={b.id} href={`/arena/battle/${b.id}`} className="block rounded border border-neutral-800 px-3 py-2 hover:bg-neutral-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className={result === "WIN" ? "text-emerald-300" : result === "LOSE" ? "text-red-300" : "text-amber-300"}>{result}</span>
                      <span className="text-neutral-500">{new Date(b.startedAt).toLocaleString()}</span>
                    </div>
                    <div className="text-sm text-neutral-200 mt-1">
                      vs {opponent.name || "Unknown"} | #{b.problem.number} {b.problem.title}
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="text-sm text-neutral-500">아직 배틀 기록이 없습니다.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4">
          <h2 className="text-lg font-semibold text-neutral-100 mb-2">Top Rating</h2>
          <div className="space-y-1">
            {(data?.leaderboard || []).map((u, idx) => (
              <div key={u.id} className="flex items-center justify-between rounded border border-neutral-800 px-3 py-2 text-sm">
                <span className="text-neutral-200">
                  {idx + 1}. {u.name || "Unknown"}
                </span>
                <span className="font-mono text-blue-300">{u.rating}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-700 bg-neutral-950 p-3">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="text-xl font-bold text-neutral-100">{value}</div>
    </div>
  );
}
