import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { db } from "@/lib/db";
import { decodeSubmissionDetail } from "@/lib/submission-meta";
import { processJudgeQueue } from "@/lib/judge/queue";

export async function GET(req: Request) {
  try {
    await processJudgeQueue(2).catch(() => {});

    const session = await getServerSession(authOptions);
    const user = getSessionUser(session);
    if (!user.id) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const idsRaw = (searchParams.get("problemIds") || "").trim();
    const ids = idsRaw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 20);

    if (ids.length === 0) return NextResponse.json({ statuses: {} });

    const rows = await db.submission.findMany({
      where: {
        userId: user.id,
        problemId: { in: ids },
        detail: { contains: '"hiddenInStatus":true' }
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        problemId: true,
        status: true,
        totalScore: true,
        maxScore: true,
        language: true,
        detail: true,
        failedCase: true,
        expectedOutput: true,
        actualOutput: true,
        createdAt: true
      }
    });

    const statuses: Record<string, unknown> = {};
    const logsByProblem: Record<string, unknown[]> = {};
    for (const row of rows) {
      const decoded = decodeSubmissionDetail(row.detail);
      const groupScores = decoded.meta?.groupScores || [];
      const passedTests = groupScores.reduce((acc, g) => acc + g.passedCases, 0);
      const totalTests = groupScores.reduce((acc, g) => acc + g.totalCases, 0);
      const item = {
        id: row.id,
        status: row.status,
        totalScore: row.totalScore,
        maxScore: row.maxScore,
        language: row.language,
        detail: decoded.message || "",
        failedCase: row.failedCase,
        expectedOutput: row.expectedOutput,
        actualOutput: row.actualOutput,
        passedTests,
        totalTests,
        updatedAt: row.createdAt.toISOString()
      };

      if (!logsByProblem[row.problemId]) logsByProblem[row.problemId] = [];
      if (logsByProblem[row.problemId].length < 8) {
        logsByProblem[row.problemId].push(item);
      }

      if (!statuses[row.problemId]) {
        statuses[row.problemId] = item;
      }
    }

    return NextResponse.json({ statuses, logsByProblem });
  } catch (error) {
    console.error("[USACO_CONTEST_PROGRESS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
