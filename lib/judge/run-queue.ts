import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { isSupportedLanguage } from "@/lib/languages";
import { runSnippet } from "./run-snippet";

type RunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export async function enqueueRunJob(params: {
  userId?: string | null;
  problemId: string;
  language: string;
  code: string;
  input: string;
  timeLimitMs: number;
}) {
  const row = await db.runQueue.create({
    data: {
      id: randomUUID(),
      userId: params.userId ?? null,
      problemId: params.problemId,
      language: params.language,
      code: params.code,
      input: params.input,
      timeLimitMs: params.timeLimitMs,
      status: "PENDING"
    }
  });
  return row.id;
}

export async function getRunJobById(id: string) {
  return db.runQueue.findUnique({ where: { id } });
}

async function claimNextRunJob() {
  return db.$transaction(async (tx) => {
    const next = await tx.runQueue.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" }
    });
    if (!next) return null;

    const updated = await tx.runQueue.updateMany({
      where: { id: next.id, status: "PENDING" },
      data: {
        status: "RUNNING",
        attempts: { increment: 1 },
        startedAt: new Date(),
        lastError: null
      }
    });

    return updated.count > 0 ? next : null;
  });
}

export async function processRunQueue(maxJobs = 2) {
  let processed = 0;

  for (let i = 0; i < maxJobs; i++) {
    const job = await claimNextRunJob();
    if (!job) break;

    try {
      if (!isSupportedLanguage(job.language)) {
        await db.runQueue.update({
          where: { id: job.id },
          data: {
            status: "FAILED" satisfies RunStatus,
            lastError: `Unsupported language: ${job.language}`,
            finishedAt: new Date()
          }
        });
        processed++;
        continue;
      }

      const result = await runSnippet({
        code: job.code,
        language: job.language,
        input: job.input,
        timeLimitMs: job.timeLimitMs
      });

      await db.runQueue.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED" satisfies RunStatus,
          resultJson: JSON.stringify(result),
          finishedAt: new Date()
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown run error";
      await db.runQueue.update({
        where: { id: job.id },
        data: {
          status: "FAILED" satisfies RunStatus,
          lastError: message,
          finishedAt: new Date()
        }
      });
    }

    processed++;
  }

  return { processed };
}
