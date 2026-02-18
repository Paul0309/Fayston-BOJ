import { processJudgeQueue } from "../lib/judge/queue";

const POLL_MS = Number(process.env.JUDGE_WORKER_POLL_MS || "1500");
const MAX_JOBS = Number(process.env.JUDGE_WORKER_MAX_JOBS || "2");

console.log(`[judge-worker] started. poll=${POLL_MS}ms maxJobs=${MAX_JOBS}`);

let stopped = false;

async function tick() {
  if (stopped) return;
  try {
    const res = await processJudgeQueue(MAX_JOBS);
    if (res.processed > 0) {
      console.log(`[judge-worker] processed=${res.processed}`);
    }
  } catch (e) {
    console.error("[judge-worker] error", e);
  } finally {
    setTimeout(tick, POLL_MS);
  }
}

tick();

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
