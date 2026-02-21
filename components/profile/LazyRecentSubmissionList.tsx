"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type RecentSubmissionItem = {
  submissionId: string;
  problemId: string;
  problemNumber: number;
  submittedAt: string;
};

type RecentSubmissionDetail = {
  status: string;
  language: string;
  totalScore: number | null;
  maxScore: number | null;
  submittedAt: string;
  problemTitle: string;
};

type ViewMode = "grid" | "list";

const GRID_COLUMNS = 16;
const GRID_INITIAL_LINES = 10;
const GRID_EXPAND_LINES = 10;
const LIST_PAGE_SIZE = 10;

function chunkItems<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export default function LazyRecentSubmissionList({ title, items }: { title: string; items: RecentSubmissionItem[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [visibleLines, setVisibleLines] = useState(GRID_INITIAL_LINES);
  const [currentPage, setCurrentPage] = useState(1);

  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<Record<string, RecentSubmissionDetail>>({});

  const gridRows = useMemo(() => chunkItems(items, GRID_COLUMNS), [items]);
  const canLoadMoreGrid = visibleLines < gridRows.length;
  const visibleGridRows = gridRows.slice(0, visibleLines);

  const totalPages = Math.max(1, Math.ceil(items.length / LIST_PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const pagedItems = items.slice((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE);

  const toggle = async (item: RecentSubmissionItem) => {
    const isOpen = !!opened[item.submissionId];
    if (isOpen) {
      setOpened((prev) => ({ ...prev, [item.submissionId]: false }));
      return;
    }

    setOpened((prev) => ({ ...prev, [item.submissionId]: true }));
    if (details[item.submissionId] || loading[item.submissionId]) return;

    setLoading((prev) => ({ ...prev, [item.submissionId]: true }));
    setErrors((prev) => ({ ...prev, [item.submissionId]: "" }));

    try {
      const res = await fetch(`/api/profile/recent-submissions/${item.submissionId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("\uC0C1\uC138 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      const data = (await res.json()) as { detail: RecentSubmissionDetail };
      setDetails((prev) => ({ ...prev, [item.submissionId]: data.detail }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "\uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.";
      setErrors((prev) => ({ ...prev, [item.submissionId]: message }));
    } finally {
      setLoading((prev) => ({ ...prev, [item.submissionId]: false }));
    }
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-neutral-700 px-6 py-4">
        <div className="font-semibold">{title}</div>
        <div className="inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900 p-1 text-xs">
          <button type="button" onClick={() => setViewMode("grid")} className={`rounded px-2 py-1 transition ${viewMode === "grid" ? "bg-blue-500/20 text-blue-200" : "text-neutral-300 hover:bg-neutral-800"}`}>
            {"\uADF8\uB9AC\uB4DC"}
          </button>
          <button type="button" onClick={() => { setViewMode("list"); setCurrentPage(1); }} className={`rounded px-2 py-1 transition ${viewMode === "list" ? "bg-blue-500/20 text-blue-200" : "text-neutral-300 hover:bg-neutral-800"}`}>
            {"\uB9AC\uC2A4\uD2B8"}
          </button>
        </div>
      </div>

      {items.length === 0 ? <div className="px-6 py-6 text-sm text-neutral-300">{"\uC544\uC9C1 \uC81C\uCD9C \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."}</div> : null}

      {items.length > 0 && viewMode === "grid" ? (
        <div className="px-6 py-5">
          <div className="space-y-1 font-mono text-base leading-7 text-blue-300">
            {visibleGridRows.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="flex flex-wrap gap-x-2">
                {row.map((item) => (
                  <Link key={item.submissionId} href={`/problem/${item.problemId}`} className="rounded px-1.5 py-0.5 transition hover:bg-blue-500/15 hover:text-blue-200" title={new Date(item.submittedAt).toLocaleString()}>
                    {item.problemNumber}
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-neutral-400">
            <span>{"\uD45C\uC2DC \uC911"} {Math.min(visibleLines * GRID_COLUMNS, items.length)} / {items.length}</span>
            {canLoadMoreGrid ? (
              <button type="button" onClick={() => setVisibleLines((prev) => prev + GRID_EXPAND_LINES)} className="rounded border border-neutral-600 px-3 py-1.5 text-neutral-200 transition hover:border-blue-400/60 hover:bg-blue-500/10">
                {"\uB354\uBCF4\uAE30"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {items.length > 0 && viewMode === "list" ? (
        <>
          <ul className="divide-y divide-neutral-700">
            {pagedItems.map((item) => {
              const isOpen = !!opened[item.submissionId];
              const detail = details[item.submissionId];
              const isLoading = !!loading[item.submissionId];
              const error = errors[item.submissionId];

              return (
                <li key={item.submissionId} className="px-6 py-4 transition hover:bg-neutral-800/40">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/problem/${item.problemId}`} className="font-mono text-blue-400 hover:underline">#{item.problemNumber}</Link>
                    <button type="button" onClick={() => void toggle(item)} className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-200 transition hover:border-blue-400/60 hover:bg-blue-500/10">
                      {isOpen ? "\uB2EB\uAE30" : "\uC790\uC138\uD788 \uBCF4\uAE30"}
                    </button>
                    <span className="text-xs text-neutral-400">{new Date(item.submittedAt).toLocaleString()}</span>
                  </div>

                  {isOpen ? (
                    <div className="mt-3 rounded border border-neutral-700 bg-neutral-800/50 p-3 text-sm">
                      {isLoading ? <div className="text-neutral-300">{"\uBD88\uB7EC\uC624\uB294 \uC911..."}</div> : null}
                      {error ? <div className="text-red-300">{error}</div> : null}
                      {!isLoading && !error && detail ? (
                        <div className="space-y-1 text-neutral-200">
                          <div>{"\uBB38\uC81C"}: {detail.problemTitle}</div>
                          <div>{"\uACB0\uACFC"}: {detail.status}</div>
                          <div>{"\uC5B8\uC5B4"}: {detail.language}</div>
                          <div>{"\uC810\uC218"}: {typeof detail.totalScore === "number" && typeof detail.maxScore === "number" ? `${detail.totalScore} / ${detail.maxScore}` : "-"}</div>
                          <div className="text-xs text-neutral-400">{new Date(detail.submittedAt).toLocaleString()}</div>
                          <Link href={`/status/${item.submissionId}`} className="inline-block text-xs text-blue-400 hover:underline">{"\uC81C\uCD9C \uC0C1\uC138\uB85C \uC774\uB3D9"}</Link>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between border-t border-neutral-700 px-6 py-3 text-xs text-neutral-300">
            <button type="button" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1} className="rounded border border-neutral-600 px-3 py-1.5 transition enabled:hover:border-blue-400/60 enabled:hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50">{"\uC774\uC804"}</button>
            <span>{page} / {totalPages}</span>
            <button type="button" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages} className="rounded border border-neutral-600 px-3 py-1.5 transition enabled:hover:border-blue-400/60 enabled:hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50">{"\uB2E4\uC74C"}</button>
          </div>
        </>
      ) : null}
    </>
  );
}
