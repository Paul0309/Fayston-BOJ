"use client";

import Link from "next/link";
import { useState } from "react";

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

export default function LazyRecentSubmissionList({ items }: { items: RecentSubmissionItem[] }) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<Record<string, RecentSubmissionDetail>>({});

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
      if (!res.ok) throw new Error("상세 정보를 불러오지 못했습니다.");
      const data = (await res.json()) as { detail: RecentSubmissionDetail };
      setDetails((prev) => ({ ...prev, [item.submissionId]: data.detail }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "오류가 발생했습니다.";
      setErrors((prev) => ({ ...prev, [item.submissionId]: message }));
    } finally {
      setLoading((prev) => ({ ...prev, [item.submissionId]: false }));
    }
  };

  if (items.length === 0) {
    return <div className="px-6 py-6 text-sm text-neutral-300">아직 제출 내역이 없습니다.</div>;
  }

  return (
    <ul className="divide-y divide-neutral-700">
      {items.map((item) => {
        const isOpen = !!opened[item.submissionId];
        const detail = details[item.submissionId];
        const isLoading = !!loading[item.submissionId];
        const error = errors[item.submissionId];

        return (
          <li key={item.submissionId} className="px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/problem/${item.problemId}`} className="font-mono text-blue-400 hover:underline">
                #{item.problemNumber}
              </Link>
              <button
                type="button"
                onClick={() => void toggle(item)}
                className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
              >
                {isOpen ? "접기" : "자세히 보기"}
              </button>
              <span className="text-xs text-neutral-400">{new Date(item.submittedAt).toLocaleString()}</span>
            </div>

            {isOpen ? (
              <div className="mt-3 rounded border border-neutral-700 bg-neutral-800/50 p-3 text-sm">
                {isLoading ? <div className="text-neutral-300">불러오는 중...</div> : null}
                {error ? <div className="text-red-300">{error}</div> : null}
                {!isLoading && !error && detail ? (
                  <div className="space-y-1 text-neutral-200">
                    <div>문제: {detail.problemTitle}</div>
                    <div>결과: {detail.status}</div>
                    <div>언어: {detail.language}</div>
                    <div>
                      점수: {typeof detail.totalScore === "number" && typeof detail.maxScore === "number" ? `${detail.totalScore} / ${detail.maxScore}` : "-"}
                    </div>
                    <div className="text-xs text-neutral-400">{new Date(detail.submittedAt).toLocaleString()}</div>
                    <Link href={`/status/${item.submissionId}`} className="inline-block text-xs text-blue-400 hover:underline">
                      제출 상세로 이동
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
