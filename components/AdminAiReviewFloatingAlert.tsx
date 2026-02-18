"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { getSessionUser } from "@/lib/session-user";

export default function AdminAiReviewFloatingAlert() {
    const { data: session } = useSession();
    const role = getSessionUser(session).role;
    const isAdmin = role === "ADMIN";
    const [pendingCount, setPendingCount] = useState(0);
    const [hidden, setHidden] = useState(false);

    const visible = useMemo(() => isAdmin && pendingCount > 0 && !hidden, [isAdmin, pendingCount, hidden]);

    useEffect(() => {
        if (!isAdmin) return;
        let alive = true;

        const load = async () => {
            try {
                const res = await fetch("/api/admin/ai-reviews/stats", { cache: "no-store" });
                if (!res.ok) return;
                const data = await res.json();
                if (alive) setPendingCount(Number(data.pendingCount || 0));
            } catch (error) {
                console.error(error);
            }
        };

        void load();
        const timer = setInterval(load, 60000);
        return () => {
            alive = false;
            clearInterval(timer);
        };
    }, [isAdmin]);

    if (!visible) return null;

    return (
        <div className="fixed top-20 right-4 z-[60] w-[320px] rounded-xl border border-amber-500/40 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <div className="text-sm font-bold text-amber-300">AI 점검 승인 대기</div>
                    <div className="mt-1 text-sm text-neutral-200">{pendingCount}건의 문제 수정안이 대기 중입니다.</div>
                </div>
                <button className="text-xs text-neutral-400 hover:text-neutral-200" onClick={() => setHidden(true)}>닫기</button>
            </div>
            <Link href="/admin/ai-management" className="mt-3 inline-block rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500">
                AI 관리에서 확인
            </Link>
        </div>
    );
}
