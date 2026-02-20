"use client";

import { useState } from "react";

type Props = {
  eligible: boolean;
  canPromote: boolean;
  message: string;
};

type PromoteResponse = {
  ok: boolean;
  promoted: boolean;
  message: string;
};

export default function UsacoPromotionButton({ eligible, canPromote, message }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  if (!eligible) return null;

  const onPromote = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/usaco/contest/promotion", { method: "POST" });
      if (!res.ok) {
        setResult(await res.text());
        return;
      }
      const data = (await res.json()) as PromoteResponse;
      setResult(data.message || (data.promoted ? "승급되었습니다." : "조건을 확인하세요."));
      if (data.promoted) {
        setTimeout(() => window.location.reload(), 600);
      }
    } catch (error) {
      setResult(error instanceof Error ? error.message : "프로모션 처리 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <div className="text-xs text-emerald-300">{result || message}</div>
      <button
        type="button"
        className="mt-2 rounded border border-emerald-700 bg-emerald-900/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/60 disabled:opacity-60"
        disabled={!canPromote || busy}
        onClick={onPromote}
      >
        {busy ? "처리 중..." : "프로모션 받기"}
      </button>
    </div>
  );
}
