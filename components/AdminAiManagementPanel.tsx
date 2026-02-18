"use client";

import { useEffect, useMemo, useState } from "react";
import AdminAiReviewPanel from "@/components/AdminAiReviewPanel";
import AdminAutomationSettings from "@/components/AdminAutomationSettings";

const DIFFICULTIES = [
  "BRONZE_5", "BRONZE_4", "BRONZE_3", "BRONZE_2", "BRONZE_1",
  "SILVER_5", "SILVER_4", "SILVER_3", "SILVER_2", "SILVER_1",
  "GOLD_5", "GOLD_4", "GOLD_3", "GOLD_2", "GOLD_1"
] as const;

type RewriteMode = "all" | "selected" | "search";

type ProblemListItem = {
  id: string;
  number: number;
  title: string;
  difficulty: string;
  tags: string;
};

type ActionLogItem = {
  id: string;
  action: string;
  adminId?: string | null;
  createdAt: string;
  target?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
};

export default function AdminAiManagementPanel() {
  const [error, setError] = useState("");

  const [autoLoading, setAutoLoading] = useState(false);
  const [autoMessage, setAutoMessage] = useState("");
  const [autoConfig, setAutoConfig] = useState({
    count: "5",
    topic: "mixed",
    difficulty: "BRONZE_3"
  });

  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewritePrompt, setRewritePrompt] = useState("");
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>("all");
  const [rewriteLimit, setRewriteLimit] = useState("30");
  const [rewriteSearchQuery, setRewriteSearchQuery] = useState("");
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [problemListLoading, setProblemListLoading] = useState(false);
  const [problemList, setProblemList] = useState<ProblemListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rewriteMessage, setRewriteMessage] = useState("");
  const [hiddenLoading, setHiddenLoading] = useState(false);
  const [hiddenMessage, setHiddenMessage] = useState("");
  const [hiddenMode, setHiddenMode] = useState<RewriteMode>("all");
  const [hiddenLimit, setHiddenLimit] = useState("30");
  const [hiddenSearchQuery, setHiddenSearchQuery] = useState("");
  const [hiddenPerProblem, setHiddenPerProblem] = useState("8");
  const [onlyIfHiddenLessThan, setOnlyIfHiddenLessThan] = useState("5");
  const [logsLoading, setLogsLoading] = useState(false);
  const [logs, setLogs] = useState<ActionLogItem[]>([]);
  const [usacoLoading, setUsacoLoading] = useState(false);
  const [usacoMessage, setUsacoMessage] = useState("");

  const selectedCount = selectedIds.length;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/admin/ai-manage/logs?limit=40", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setLogs(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  const runAutoGenerate = async () => {
    setAutoLoading(true);
    setError("");
    setAutoMessage("");
    try {
      const res = await fetch("/api/admin/problems/autogen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: Number(autoConfig.count) || 5,
          topic: autoConfig.topic,
          difficulty: autoConfig.difficulty
        })
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = await res.json();
      const report = data.report || {};
      setAutoMessage(
        `${data.createdCount ?? 0}개 생성 (중복 거절 ${report.duplicateRejected ?? 0}, 유사도 거절 ${report.similarityRejected ?? 0}, 사전검증 거절 ${report.prevalidationRejected ?? 0})`
      );
      await loadLogs();
    } catch (e) {
      console.error(e);
      setError("AI 자동 문제 생성 중 오류가 발생했습니다.");
    } finally {
      setAutoLoading(false);
    }
  };

  const loadProblemList = async () => {
    setProblemListLoading(true);
    setError("");
    try {
      const query = encodeURIComponent(listSearchQuery.trim());
      const res = await fetch(`/api/admin/problems?limit=100${query ? `&q=${query}` : ""}`);
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = await res.json();
      setProblemList(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      console.error(e);
      setError("문제 목록을 불러오지 못했습니다.");
    } finally {
      setProblemListLoading(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const runRewrite = async () => {
    setRewriteLoading(true);
    setError("");
    setRewriteMessage("");
    try {
      const payload = {
        prompt: rewritePrompt,
        mode: rewriteMode,
        selectedProblemIds: rewriteMode === "selected" ? selectedIds : undefined,
        searchQuery: rewriteMode === "search" ? rewriteSearchQuery : undefined,
        limit: Number(rewriteLimit) || 30
      };

      const res = await fetch("/api/admin/ai-manage/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        setError(await res.text());
        return;
      }

      const data = await res.json();
      setRewriteMessage(
        `완료: 조회 ${data.scanned ?? 0}, 수정 ${data.updated ?? 0}, 변경없음 ${data.skipped ?? 0}, 오류 ${data.errors ?? 0}`
      );
      await loadLogs();
    } catch (e) {
      console.error(e);
      setError("AI 문제 수정 실행 중 오류가 발생했습니다.");
    } finally {
      setRewriteLoading(false);
    }
  };

  const runHiddenCaseEnhancement = async () => {
    setHiddenLoading(true);
    setError("");
    setHiddenMessage("");
    try {
      const payload = {
        mode: hiddenMode,
        selectedProblemIds: hiddenMode === "selected" ? selectedIds : undefined,
        searchQuery: hiddenMode === "search" ? hiddenSearchQuery : undefined,
        limit: Number(hiddenLimit) || 30,
        hiddenPerProblem: Number(hiddenPerProblem) || 8,
        onlyIfHiddenLessThan: Number(onlyIfHiddenLessThan) || 5
      };
      const res = await fetch("/api/admin/ai-manage/hidden-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = await res.json();
      setHiddenMessage(
        `완료: 조회 ${data.scanned ?? 0}, 보강 ${data.updatedProblems ?? 0}, 추가 케이스 ${data.createdHiddenCases ?? 0}, 건너뜀 ${data.skippedProblems ?? 0}, 오류 ${data.errorProblems ?? 0}`
      );
      await loadLogs();
    } catch (e) {
      console.error(e);
      setError("숨겨진 테스트케이스 보강 실행 중 오류가 발생했습니다.");
    } finally {
      setHiddenLoading(false);
    }
  };

  const runUsacoImport = async (division: "ALL" | "Bronze" | "Silver" | "Gold" | "Platinum") => {
    setUsacoLoading(true);
    setError("");
    setUsacoMessage("");
    try {
      const res = await fetch("/api/admin/usaco/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ division })
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = await res.json();
      setUsacoMessage(`완료: scanned ${data.scanned ?? 0}, created ${data.created ?? 0}, skipped ${data.skipped ?? 0}`);
      await loadLogs();
    } catch (e) {
      console.error(e);
      setError("USACO Import 실행 중 오류가 발생했습니다.");
    } finally {
      setUsacoLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      {error && (
        <div className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-neutral-950 via-slate-950 to-cyan-950/60 p-5 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-cyan-200">AI 자동 문제 생성</h2>
          <p className="mt-1 text-sm text-cyan-100/80">
            주제/난이도를 지정하면 AI가 새로운 문제를 자동으로 생성합니다.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder:text-neutral-500"
            placeholder="개수 (1~20)"
            value={autoConfig.count}
            onChange={(e) => setAutoConfig({ ...autoConfig, count: e.target.value })}
          />
          <select
            className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100"
            value={autoConfig.topic}
            onChange={(e) => setAutoConfig({ ...autoConfig, topic: e.target.value })}
          >
            <option value="mixed">혼합</option>
            <option value="math">수학</option>
            <option value="string">문자열</option>
          </select>
          <select
            className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100"
            value={autoConfig.difficulty}
            onChange={(e) => setAutoConfig({ ...autoConfig, difficulty: e.target.value })}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void runAutoGenerate()}
            disabled={autoLoading}
            className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {autoLoading ? "생성 중..." : "자동 생성 실행"}
          </button>
          {autoMessage && <span className="text-sm text-emerald-300">{autoMessage}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-neutral-950 via-slate-950 to-violet-950/60 p-5 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-violet-200">AI 문제 수정</h2>
          <p className="mt-1 text-sm text-violet-100/80">
            관리자 프롬프트대로 문제 설명/입출력 설명/태그를 일괄 수정합니다.
          </p>
        </div>

        <textarea
          className="w-full min-h-28 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100"
          placeholder="예: 모든 문제 설명에 배경 스토리를 추가하고, 수식/기호는 LaTeX 문법으로 통일해줘."
          value={rewritePrompt}
          onChange={(e) => setRewritePrompt(e.target.value)}
        />

        <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-200">
          <label className="flex items-center gap-2">
            <input type="radio" checked={rewriteMode === "all"} onChange={() => setRewriteMode("all")} />
            모든 문제
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={rewriteMode === "selected"} onChange={() => setRewriteMode("selected")} />
            특정 문제 선택
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={rewriteMode === "search"} onChange={() => setRewriteMode("search")} />
            문제 검색
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">처리 상한</span>
          <input
            className="w-24 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
            value={rewriteLimit}
            onChange={(e) => setRewriteLimit(e.target.value)}
            placeholder="30"
          />
        </div>

        {rewriteMode === "selected" && (
          <div className="rounded border border-neutral-700 bg-neutral-950 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                placeholder="문제 검색 (번호/제목/태그)"
                value={listSearchQuery}
                onChange={(e) => setListSearchQuery(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void loadProblemList()}
                disabled={problemListLoading}
                className="rounded bg-neutral-700 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-600 disabled:opacity-50"
              >
                {problemListLoading ? "조회 중..." : "조회"}
              </button>
            </div>
            <div className="text-xs text-neutral-400">선택됨: {selectedCount}개</div>
            <div className="max-h-64 overflow-auto space-y-2">
              {problemList.map((item) => (
                <label key={item.id} className="flex items-start gap-2 rounded border border-neutral-800 bg-neutral-900 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(item.id)}
                    onChange={() => toggleSelected(item.id)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-neutral-200">
                    #{item.number} {item.title}
                  </span>
                </label>
              ))}
              {!problemListLoading && problemList.length === 0 && (
                <div className="text-sm text-neutral-500">조회된 문제가 없습니다.</div>
              )}
            </div>
          </div>
        )}

        {rewriteMode === "search" && (
          <input
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            placeholder="검색어 입력 (번호/제목/설명/태그)"
            value={rewriteSearchQuery}
            onChange={(e) => setRewriteSearchQuery(e.target.value)}
          />
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void runRewrite()}
            disabled={rewriteLoading}
            className="rounded bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {rewriteLoading ? "수정 중..." : "AI 문제 수정 실행"}
          </button>
          {rewriteMessage && <span className="text-sm text-emerald-300">{rewriteMessage}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-neutral-950 via-slate-950 to-amber-950/60 p-5 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-amber-200">숨겨진 테스트케이스 보강</h2>
          <p className="mt-1 text-sm text-amber-100/80">
            문제별 hidden 케이스를 다량 추가해 예제 출력 하드코딩 통과를 방지합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2">
            <div className="text-xs text-neutral-400">문제당 추가 hidden 수</div>
            <input
              className="mt-1 w-full bg-transparent text-sm text-neutral-100 outline-none"
              value={hiddenPerProblem}
              onChange={(e) => setHiddenPerProblem(e.target.value)}
              placeholder="8"
            />
          </div>
          <div className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2">
            <div className="text-xs text-neutral-400">처리 상한</div>
            <input
              className="mt-1 w-full bg-transparent text-sm text-neutral-100 outline-none"
              value={hiddenLimit}
              onChange={(e) => setHiddenLimit(e.target.value)}
              placeholder="30"
            />
          </div>
          <div className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2">
            <div className="text-xs text-neutral-400">현재 hidden이 이 값 미만일 때만</div>
            <input
              className="mt-1 w-full bg-transparent text-sm text-neutral-100 outline-none"
              value={onlyIfHiddenLessThan}
              onChange={(e) => setOnlyIfHiddenLessThan(e.target.value)}
              placeholder="5"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-200">
          <label className="flex items-center gap-2">
            <input type="radio" checked={hiddenMode === "all"} onChange={() => setHiddenMode("all")} />
            모든 문제
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={hiddenMode === "selected"} onChange={() => setHiddenMode("selected")} />
            특정 문제 선택
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={hiddenMode === "search"} onChange={() => setHiddenMode("search")} />
            문제 검색
          </label>
        </div>

        {hiddenMode === "selected" && (
          <div className="rounded border border-neutral-700 bg-neutral-950 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                placeholder="문제 검색 (번호/제목/태그)"
                value={listSearchQuery}
                onChange={(e) => setListSearchQuery(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void loadProblemList()}
                disabled={problemListLoading}
                className="rounded bg-neutral-700 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-600 disabled:opacity-50"
              >
                {problemListLoading ? "조회 중..." : "조회"}
              </button>
            </div>
            <div className="text-xs text-neutral-400">선택됨: {selectedCount}개</div>
            <div className="max-h-64 overflow-auto space-y-2">
              {problemList.map((item) => (
                <label key={item.id} className="flex items-start gap-2 rounded border border-neutral-800 bg-neutral-900 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(item.id)}
                    onChange={() => toggleSelected(item.id)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-neutral-200">
                    #{item.number} {item.title}
                  </span>
                </label>
              ))}
              {!problemListLoading && problemList.length === 0 && (
                <div className="text-sm text-neutral-500">조회된 문제가 없습니다.</div>
              )}
            </div>
          </div>
        )}

        {hiddenMode === "search" && (
          <input
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            placeholder="검색어 입력 (번호/제목/설명/태그)"
            value={hiddenSearchQuery}
            onChange={(e) => setHiddenSearchQuery(e.target.value)}
          />
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void runHiddenCaseEnhancement()}
            disabled={hiddenLoading}
            className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {hiddenLoading ? "보강 중..." : "숨김 테스트 보강 실행"}
          </button>
          {hiddenMessage && <span className="text-sm text-emerald-300">{hiddenMessage}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-sky-500/30 bg-gradient-to-br from-neutral-950 via-slate-950 to-sky-950/60 p-5 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-sky-200">USACO-school 연동 Import</h2>
          <p className="mt-1 text-sm text-sky-100/80">
            USACO-school 문제셋을 현재 플랫폼 Problem DB로 이관합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["ALL", "Bronze", "Silver", "Gold", "Platinum"] as const).map((division) => (
            <button
              key={division}
              type="button"
              onClick={() => void runUsacoImport(division)}
              disabled={usacoLoading}
              className="rounded bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {usacoLoading ? "실행 중..." : `${division} Import`}
            </button>
          ))}
        </div>
        {usacoMessage && <div className="text-sm text-emerald-300">{usacoMessage}</div>}
      </div>

      <AdminAiReviewPanel />
      <AdminAutomationSettings />

      <div className="rounded-xl border border-neutral-700 bg-neutral-950 p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-neutral-100">AI 작업 이력</h2>
          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={logsLoading}
            className="rounded bg-neutral-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-600 disabled:opacity-50"
          >
            {logsLoading ? "불러오는 중..." : "새로고침"}
          </button>
        </div>
        {logs.length === 0 ? (
          <div className="text-sm text-neutral-400">기록이 없습니다.</div>
        ) : (
          <div className="max-h-80 overflow-auto space-y-2">
            {logs.map((item) => (
              <div key={item.id} className="rounded border border-neutral-800 bg-neutral-900 p-3 text-xs text-neutral-200">
                <div className="font-semibold text-neutral-100">{item.action}</div>
                <div className="mt-1 text-neutral-400">{new Date(item.createdAt).toLocaleString()}</div>
                {item.target && (
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap text-neutral-300">
                    target: {JSON.stringify(item.target)}
                  </pre>
                )}
                {item.result && (
                  <pre className="mt-1 overflow-auto whitespace-pre-wrap text-emerald-300">
                    result: {JSON.stringify(item.result)}
                  </pre>
                )}
                {item.error && <div className="mt-1 text-red-300">error: {item.error}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
