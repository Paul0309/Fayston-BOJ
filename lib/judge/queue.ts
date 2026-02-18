import { db } from "../db";
import { runLocalJudge } from "./local-judge";
import { randomUUID } from "crypto";

const CREATE_QUEUE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS "JudgeQueue" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "submissionId" TEXT NOT NULL UNIQUE,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "lastError" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "startedAt" DATETIME,
        "finishedAt" DATETIME,
        CONSTRAINT "JudgeQueue_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
`;

type QueueJob = {
    id: string;
    submissionId: string;
};

declare global {
    var __judgeQueueRunning: boolean | undefined;
}

async function ensureQueueTable() {
    await db.$executeRawUnsafe(CREATE_QUEUE_TABLE_SQL);
}

async function claimNextJob(): Promise<QueueJob | null> {
    return db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(CREATE_QUEUE_TABLE_SQL);

        const rows = await tx.$queryRaw<Array<QueueJob>>`
            SELECT "id", "submissionId"
            FROM "JudgeQueue"
            WHERE "status" = 'PENDING'
            ORDER BY "createdAt" ASC
            LIMIT 1
        `;

        const next = rows[0];
        if (!next) return null;

        const updated = await tx.$executeRaw`
            UPDATE "JudgeQueue"
            SET
                "status" = 'RUNNING',
                "attempts" = "attempts" + 1,
                "startedAt" = CURRENT_TIMESTAMP,
                "updatedAt" = CURRENT_TIMESTAMP,
                "lastError" = NULL
            WHERE "id" = ${next.id} AND "status" = 'PENDING'
        `;

        return updated > 0 ? next : null;
    });
}

export async function enqueueSubmissionForJudge(submissionId: string) {
    await ensureQueueTable();

    await db.$executeRaw`
        INSERT INTO "JudgeQueue" ("id", "submissionId", "status", "attempts", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${submissionId}, 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT("submissionId")
        DO UPDATE SET
            "status" = 'PENDING',
            "updatedAt" = CURRENT_TIMESTAMP,
            "lastError" = NULL,
            "finishedAt" = NULL,
            "startedAt" = NULL
    `;
}

export async function processJudgeQueue(maxJobs = 2) {
    if (globalThis.__judgeQueueRunning) {
        return { processed: 0, skipped: true };
    }

    globalThis.__judgeQueueRunning = true;
    let processed = 0;

    try {
        for (let i = 0; i < maxJobs; i++) {
            const job = await claimNextJob();
            if (!job) break;

            const submission = await db.submission.findUnique({ where: { id: job.submissionId } });
            if (!submission) {
                await db.$executeRaw`
                    UPDATE "JudgeQueue"
                    SET "status" = 'FAILED', "lastError" = 'Submission not found', "updatedAt" = CURRENT_TIMESTAMP, "finishedAt" = CURRENT_TIMESTAMP
                    WHERE "id" = ${job.id}
                `;
                continue;
            }

            try {
                await runLocalJudge(submission.id, submission.problemId, submission.code, submission.language, submission.userId);
                await db.$executeRaw`
                    UPDATE "JudgeQueue"
                    SET "status" = 'COMPLETED', "updatedAt" = CURRENT_TIMESTAMP, "finishedAt" = CURRENT_TIMESTAMP
                    WHERE "id" = ${job.id}
                `;
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown judge error";
                await db.$executeRaw`
                    UPDATE "JudgeQueue"
                    SET "status" = 'FAILED', "lastError" = ${message}, "updatedAt" = CURRENT_TIMESTAMP, "finishedAt" = CURRENT_TIMESTAMP
                    WHERE "id" = ${job.id}
                `;
            }

            processed++;
        }

        return { processed, skipped: false };
    } finally {
        globalThis.__judgeQueueRunning = false;
    }
}

export async function getJudgeQueueStats() {
    let rows: Array<{ status: string; count: number }> = [];
    try {
        rows = await db.$queryRaw<Array<{ status: string; count: number }>>`
            SELECT "status", COUNT(*) as "count"
            FROM "JudgeQueue"
            GROUP BY "status"
        `;
    } catch {
        return { pending: 0, running: 0, completed: 0, failed: 0 };
    }

    const stats = { pending: 0, running: 0, completed: 0, failed: 0 };
    for (const row of rows) {
        const key = row.status.toLowerCase() as keyof typeof stats;
        if (key in stats) stats[key] = Number(row.count);
    }

    return stats;
}
