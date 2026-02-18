"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RejudgeButton({ submissionId }: { submissionId: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const onClick = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/submission/${submissionId}/rejudge`, { method: "POST" });
            if (!res.ok) {
                setError(await res.text());
                return;
            }
            router.refresh();
        } catch (e) {
            console.error(e);
            setError("재채점 요청 실패");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={onClick}
                disabled={loading}
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
            >
                {loading ? "재채점 중..." : "재채점"}
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
    );
}

