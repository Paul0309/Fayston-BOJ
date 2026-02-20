import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import { isHiddenStatusSubmission } from "@/lib/submission-meta";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, ctx: RouteContext) {
  const { id } = await ctx.params;

  const submission = await withDbRetry(() =>
    db.submission.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        language: true,
        totalScore: true,
        maxScore: true,
        createdAt: true,
        detail: true,
        problem: { select: { title: true } }
      }
    })
  );

  if (!submission) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (isHiddenStatusSubmission(submission.detail)) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.json({
    detail: {
      status: submission.status,
      language: submission.language,
      totalScore: submission.totalScore,
      maxScore: submission.maxScore,
      submittedAt: submission.createdAt.toISOString(),
      problemTitle: submission.problem.title
    }
  });
}
