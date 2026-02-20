import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { runSnippet } from "./run-snippet";

const CREATE_RUN_QUEUE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "RunQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "problemId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "input" TEXT NOT NULL DEFAULT '',
    "timeLimitMs" INTEGER NOT NULL DEFAULT 2000,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "resultJson" TEXT,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME
  )
`;

type RunQueueRow = {
  id: string;
  userId: string | null;
  problemId: string;
  language: string;
  code: string;
  input: string;
  timeLimitMs: number;
  status: string;
  attempts: number;
  resultJson: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

async function ensureRunQueueTable() {
  await db.$executeRawUnsafe(CREATE_RUN_QUEUE_TABLE_SQL);
}

export async function enqueueRunJob(params: {
  userId?: string | null;
  problemId: string;
  language: string;
  code: string;
  input: string;
  timeLimitMs: number;
}) {
  await ensureRunQueueTable();
  const id = randomUUID();

  await db.$executeRaw`
    INSERT INTO "RunQueue"
      ("id", "userId", "problemId", "language", "code", "input", "timeLimitMs", "status", "attempts", "createdAt", "updatedAt")
    VALUES
      (${id}, ${params.userId ?? null}, ${params.problemId}, ${params.language}, ${params.code}, ${params.input}, ${params.timeLimitMs}, 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

  return id;
}

export async function getRunJobById(id: string) {
  await ensureRunQueueTable();
  const rows = await db.$queryRaw<RunQueueRow[]>`
    SELECT *
    FROM "RunQueue"
    WHERE "id" = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function claimNextRunJob(): Promise<RunQueueRow | null> {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(CREATE_RUN_QUEUE_TABLE_SQL);

    const rows = await tx.$queryRaw<RunQueueRow[]>`
      SELECT *
      FROM "RunQueue"
      WHERE "status" = 'PENDING'
      ORDER BY "createdAt" ASC
      LIMIT 1
    `;
    const next = rows[0];
    if (!next) return null;

    const updated = await tx.$executeRaw`
      UPDATE "RunQueue"
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

export async function processRunQueue(maxJobs = 2) {
  await ensureRunQueueTable();
  let processed = 0;

  for (let i = 0; i < maxJobs; i++) {
    const job = await claimNextRunJob();
    if (!job) break;

    try {
      const result = await runSnippet({
        code: job.code,
        language: job.language as "cpp" | "python" | "javascript" | "java",
        input: job.input,
        timeLimitMs: job.timeLimitMs
      });

      await db.$executeRaw`
        UPDATE "RunQueue"
        SET
          "status" = 'COMPLETED',
          "resultJson" = ${JSON.stringify(result)},
          "updatedAt" = CURRENT_TIMESTAMP,
          "finishedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${job.id}
      `;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown run error";
      await db.$executeRaw`
        UPDATE "RunQueue"
        SET
          "status" = 'FAILED',
          "lastError" = ${message},
          "updatedAt" = CURRENT_TIMESTAMP,
          "finishedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${job.id}
      `;
    }

    processed++;
  }

  return { processed };
}
