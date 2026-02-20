import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAllowedLanguages } from "@/lib/language-settings";
import { isSupportedLanguage } from "@/lib/languages";
import { runSnippet } from "@/lib/judge/run-snippet";
import { enqueueRunJob, getRunJobById } from "@/lib/judge/run-queue";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const problemId = typeof body?.problemId === "string" ? body.problemId : "";
    const code = typeof body?.code === "string" ? body.code : "";
    const input = typeof body?.input === "string" ? body.input : "";
    const language = typeof body?.language === "string" ? body.language : "";

    if (!problemId || !code || !language) {
      return new NextResponse("Missing fields", { status: 400 });
    }
    if (!isSupportedLanguage(language)) {
      return new NextResponse("Unsupported language", { status: 400 });
    }

    const allowedLanguages = await getAllowedLanguages();
    if (!allowedLanguages.includes(language)) {
      return new NextResponse("This language is currently disabled by admin", { status: 400 });
    }

    const problem = await db.problem.findUnique({
      where: { id: problemId },
      select: { timeLimit: true }
    });
    if (!problem) {
      return new NextResponse("Problem not found", { status: 404 });
    }

    // Local dev can execute directly.
    if (!process.env.VERCEL) {
      const result = await runSnippet({
        code,
        language,
        input,
        timeLimitMs: problem.timeLimit + 1000
      });
      return NextResponse.json(result);
    }

    // On Vercel, enqueue run job and let EC2 worker execute it.
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id || null;
    const jobId = await enqueueRunJob({
      userId,
      problemId,
      language,
      code,
      input,
      timeLimitMs: problem.timeLimit + 1000
    });

    const started = Date.now();
    const timeoutMs = 15000;
    while (Date.now() - started < timeoutMs) {
      const job = await getRunJobById(jobId);
      if (!job) break;

      if (job.status === "COMPLETED") {
        if (job.resultJson) {
          try {
            return NextResponse.json(JSON.parse(job.resultJson));
          } catch {
            return new NextResponse("Invalid run result payload", { status: 500 });
          }
        }
        return new NextResponse("Run completed without result", { status: 500 });
      }

      if (job.status === "FAILED") {
        return NextResponse.json({
          ok: false,
          status: "ERROR",
          stdout: "",
          stderr: job.lastError || "Run queue failed",
          timeMs: 0
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return NextResponse.json({
      ok: false,
      status: "ERROR",
      stdout: "",
      stderr: "Run queued but timed out waiting for worker. Please try again.",
      timeMs: 0
    });

  } catch (error) {
    console.error("[RUN_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
