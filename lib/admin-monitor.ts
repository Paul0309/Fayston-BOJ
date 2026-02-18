import { db } from "@/lib/db";
import { getJudgeQueueStats } from "@/lib/judge/queue";

export async function getAdminMonitorSnapshot() {
    const [queue, totals, statuses, languageStats] = await Promise.all([
        getJudgeQueueStats(),
        db.submission.count(),
        db.submission.groupBy({ by: ["status"], _count: { _all: true } }),
        db.submission.groupBy({ by: ["language"], _count: { _all: true } })
    ]);

    const failed = statuses.find((s) => s.status === "RUNTIME_ERROR" || s.status === "COMPILATION_ERROR")?._count._all || 0;
    const failureRate = totals > 0 ? Math.round((failed / totals) * 1000) / 10 : 0;

    return {
        queue,
        totals,
        failureRate,
        statuses: statuses.map((s) => ({ status: s.status, count: s._count._all })),
        languages: languageStats.map((s) => ({ language: s.language, count: s._count._all })).sort((a, b) => b.count - a.count)
    };
}
