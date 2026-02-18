"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function StatusRefresher() {
    const router = useRouter();

    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
        }, 2000);

        return () => clearInterval(interval);
    }, [router]);

    return (
        <button
            onClick={() => router.refresh()}
            className="flex items-center gap-2 text-sm text-neutral-200 hover:text-blue-400 transition-colors"
        >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">자동 갱신 중</span>
        </button>
    );
}
