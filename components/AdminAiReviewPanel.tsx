"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRunScheduler } from "@/lib/auto-run-scheduler";

type ReviewStatus = "PENDING" | "APPLIED" | "REJECTED" | "ERROR";

type ReviewItem = {
    id: string;
    status: ReviewStatus;
    issues: string[];
    model?: string | null;
    createdAt: string;
    problem: {
        id: string;
        number: number;
        title: string;
        description: string;
        inputDesc?: string | null;
        outputDesc?: string | null;
    };
    proposedDescription?: string | null;
    proposedInputDesc?: string | null;
    proposedOutputDesc?: string | null;
};

type ReviewStats = {
    pendingCount: number;
    appliedCount: number;
    rejectedCount: number;
    errorCount: number;
};

const STATUS_OPTIONS: ReviewStatus[] = ["PENDING", "ERROR", "APPLIED", "REJECTED"];

export default function AdminAiReviewPanel() {
    const [items, setItems] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [running, setRunning] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [limit, setLimit] = useState("30");
    const [retryErrors, setRetryErrors] = useState(true);
    const [force, setForce] = useState(false);
    const [status, setStatus] = useState<ReviewStatus>("PENDING");
    const [stats, setStats] = useState<ReviewStats>({
        pendingCount: 0,
        appliedCount: 0,
        rejectedCount: 0,
        errorCount: 0
    });

    // Enable automatic scheduling
    useAutoRunScheduler();

    const loadStats = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/ai-reviews/stats", { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            setStats({
                pendingCount: Number(data.pendingCount || 0),
                appliedCount: Number(data.appliedCount || 0),
                rejectedCount: Number(data.rejectedCount || 0),
                errorCount: Number(data.errorCount || 0)
            });
        } catch (e) {
            console.error(e);
        }
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/admin/ai-reviews?status=${status}&limit=50`);
            if (!res.ok) {
                setError(await res.text());
                return;
            }
            const data = await res.json();
            setItems(data.items || []);
        } catch (e) {
            console.error(e);
            setError("목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => {
        void load();
        void loadStats();
    }, [load, loadStats]);

    const run = async () => {
        setRunning(true);
        setError("");
        setMessage("");
        try {
            const res = await fetch("/api/admin/ai-reviews/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    limit: Number(limit) || 30,
                    retryErrors,
                    force
                })
            });
            if (!res.ok) {
                setError(await res.text());
                return;
            }
            const data = await res.json();
            setMessage(
                `점검 완료: 스캔 ${data.scanned}, 신규 ${data.created}, 무변경 ${data.noChange}, 건너뜀 ${data.skipped}, 오류 ${data.errors}`
            );
            await Promise.all([load(), loadStats()]);
        } catch (e) {
            console.error(e);
            setError("AI 점검 실행에 실패했습니다.");
        } finally {
            setRunning(false);
        }
    };

    const decide = async (id: string, action: "approve" | "reject") => {
        setError("");
        try {
            const res = await fetch(`/api/admin/ai-reviews/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action })
            });
            if (!res.ok) {
                setError(await res.text());
                return;
            }
            await Promise.all([load(), loadStats()]);
        } catch (e) {
            console.error(e);
            setError("승인/반려 처리에 실패했습니다.");
        }
    };

    return (
        <section className="rounded-xl border border-neutral-700 bg-neutral-950 p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-xl font-bold text-neutral-100">AI 문제 설명 점검</h2>
                    <p className="text-sm text-neutral-300 mt-1">LaTeX/수식 오류를 자동 탐지하고 수정안을 승인 후 반영합니다.</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        value={limit}
                        onChange={(e) => setLimit(e.target.value)}
                        className="w-24 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
                        placeholder="30"
                    />
                    <button
                        onClick={run}
                        disabled={running}
                        className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                    >
                        {running ? "점검 중..." : "AI 점검 실행"}
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-neutral-300 flex-wrap">
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={retryErrors} onChange={(e) => setRetryErrors(e.target.checked)} />
                    ERROR 재시도 포함
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
                    강제 재점검(전체)
                </label>
            </div>

            {message && <div className="rounded border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">{message}</div>}
            {error && <div className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</div>}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <StatBox label="PENDING" value={stats.pendingCount} />
                <StatBox label="ERROR" value={stats.errorCount} />
                <StatBox label="APPLIED" value={stats.appliedCount} />
                <StatBox label="REJECTED" value={stats.rejectedCount} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                {STATUS_OPTIONS.map((option) => (
                    <button
                        key={option}
                        onClick={() => setStatus(option)}
                        className={`rounded px-3 py-1.5 text-xs font-semibold ${
                            status === option
                                ? "bg-blue-600 text-white"
                                : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
                        }`}
                    >
                        {option}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-sm text-neutral-400">불러오는 중...</div>
            ) : items.length === 0 ? (
                <div className="rounded border border-neutral-700 bg-neutral-900 px-3 py-4 text-sm text-neutral-300">해당 상태의 항목이 없습니다.</div>
            ) : (
                <div className="space-y-4">
                    {items.map((item) => (
                        <div key={item.id} className="rounded border border-neutral-700 bg-neutral-900 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                    <div className="text-sm text-neutral-400">
                                        #{item.problem.number} · {item.problem.title}
                                    </div>
                                    <div className="text-xs text-neutral-500 mt-1">
                                        상태: {item.status} · 모델: {item.model || "-"} · 생성: {new Date(item.createdAt).toLocaleString()}
                                    </div>
                                </div>
                                {item.status === "PENDING" && (
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => void decide(item.id, "approve")} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">승인</button>
                                        <button onClick={() => void decide(item.id, "reject")} className="rounded bg-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-100 hover:bg-neutral-600">반려</button>
                                    </div>
                                )}
                            </div>

                            {item.issues.length > 0 && (
                                <div className="rounded border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
                                    {item.issues.join(" / ")}
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                                <DiffBlock label="설명 원문" text={item.problem.description} />
                                <DiffBlock label="설명 수정안" text={item.proposedDescription || ""} />
                                <DiffBlock label="입력 원문" text={item.problem.inputDesc || ""} />
                                <DiffBlock label="입력 수정안" text={item.proposedInputDesc || ""} />
                                <DiffBlock label="출력 원문" text={item.problem.outputDesc || ""} />
                                <DiffBlock label="출력 수정안" text={item.proposedOutputDesc || ""} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function DiffBlock({ label, text }: { label: string; text: string }) {
    return (
        <div className="rounded border border-neutral-700 bg-black/30 p-2">
            <div className="mb-1 text-[11px] font-semibold text-neutral-400">{label}</div>
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap text-neutral-200">{text || "-"}</pre>
        </div>
    );
}

function StatBox({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded border border-neutral-700 bg-neutral-900 p-2">
            <div className="text-[11px] text-neutral-400">{label}</div>
            <div className="text-lg font-bold text-neutral-100">{value}</div>
        </div>
    );
}
