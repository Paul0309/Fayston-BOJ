"use client";

import Link from "next/link";
import { useState } from "react";

type SolvedProblemItem = {
  problemId: string;
  problemNumber: number;
  solvedAt: string;
};

type SolvedProblemDetail = {
  title: string;
  difficulty: string;
};

export default function LazySolvedProblemList({ items }: { items: SolvedProblemItem[] }) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<Record<string, SolvedProblemDetail>>({});

  const toggle = async (item: SolvedProblemItem) => {
    const isOpen = !!opened[item.problemId];
    if (isOpen) {
      setOpened((prev) => ({ ...prev, [item.problemId]: false }));
      return;
    }

    setOpened((prev) => ({ ...prev, [item.problemId]: true }));
    if (details[item.problemId] || loading[item.problemId]) return;

    setLoading((prev) => ({ ...prev, [item.problemId]: true }));
    setErrors((prev) => ({ ...prev, [item.problemId]: "" }));
    try {
      const res = await fetch(`/api/profile/solved-problems/${item.problemId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("상세 정보를 불러오지 못했습니다.");
      const data = (await res.json()) as { detail: SolvedProblemDetail };
      setDetails((prev) => ({ ...prev, [item.problemId]: data.detail }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "오류가 발생했습니다.";
      setErrors((prev) => ({ ...prev, [item.problemId]: message }));
    } finally {
      setLoading((prev) => ({ ...prev, [item.problemId]: false }));
    }
  };

  if (items.length === 0) {
    return <div className="px-6 py-6 text-sm text-neutral-300">아직 해결한 문제가 없습니다.</div>;
  }

  return (
    <ul className="divide-y divide-neutral-700">
      {items.map((item) => {
        const isOpen = !!opened[item.problemId];
        const detail = details[item.problemId];
        const isLoading = !!loading[item.problemId];
        const error = errors[item.problemId];

        return (
          <li key={item.problemId} className="px-6 py-4">
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
              <span className="text-xs text-neutral-400">{new Date(item.solvedAt).toLocaleString()}</span>
            </div>

            {isOpen ? (
              <div className="mt-3 rounded border border-neutral-700 bg-neutral-800/50 p-3 text-sm">
                {isLoading ? <div className="text-neutral-300">불러오는 중...</div> : null}
                {error ? <div className="text-red-300">{error}</div> : null}
                {!isLoading && !error && detail ? (
                  <div className="space-y-1 text-neutral-200">
                    <div>제목: {detail.title}</div>
                    <div>난이도: {detail.difficulty}</div>
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
