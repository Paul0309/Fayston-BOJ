import { processJudgeQueue } from "../lib/judge/queue";
import { processRunQueue } from "../lib/judge/run-queue";

const POLL_MS = Number(process.env.JUDGE_WORKER_POLL_MS || "1500");
const MAX_JOBS = Number(process.env.JUDGE_WORKER_MAX_JOBS || "2");
const RUN_ONCE = process.env.JUDGE_WORKER_ONCE === "1";

console.log(`[judge-worker] started. poll=${POLL_MS}ms maxJobs=${MAX_JOBS} once=${RUN_ONCE}`);

let stopped = false;

async function runOnce() {
  try {
    const [judgeRes, runRes] = await Promise.all([processJudgeQueue(MAX_JOBS), processRunQueue(MAX_JOBS)]);
    const total = judgeRes.processed + runRes.processed;
    if (total > 0) {
      console.log(`[judge-worker] judge=${judgeRes.processed} run=${runRes.processed}`);
    }
    return { judge: judgeRes.processed, run: runRes.processed };
  } catch (e) {
    console.error("[judge-worker] error", e);
    throw e;
  }
}

async function loop() {
  if (RUN_ONCE) {
    await runOnce();
    process.exit(0);
  }

  while (!stopped) {
    await runOnce();
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

void loop();

process.on("SIGINT", () => {
  stopped = true;
  console.log("[judge-worker] stopping...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopped = true;
  console.log("[judge-worker] stopping...");
  process.exit(0);
});
