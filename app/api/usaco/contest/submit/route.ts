import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { getAllowedLanguages } from "@/lib/language-settings";
import { isSupportedLanguage } from "@/lib/languages";
import { enqueueSubmissionForJudge } from "@/lib/judge/queue";
import { encodeSubmissionDetail } from "@/lib/submission-meta";
import { asUsacoDivision, ensureContestParticipant, findActiveUsacoContestByDivision } from "@/lib/usaco/contest";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const { problemId, code, language, contestId } = body || {};

    if (!problemId || !code || !language) {
      return new NextResponse("Missing fields", { status: 400 });
    }
    if (typeof language !== "string" || !isSupportedLanguage(language)) {
      return new NextResponse("Unsupported language", { status: 400 });
    }

    const me = await db.user.findUnique({
      where: { id: userId },
      select: { division: true }
    });
    const contest = await findActiveUsacoContestByDivision(asUsacoDivision(me?.division));
    if (!contest || contest.id !== String(contestId)) {
      return new NextResponse("No active contest for your division", { status: 400 });
    }

    const problem = await db.problem.findFirst({
      where: { id: String(problemId), contestId: contest.id },
      select: { id: true }
    });
    if (!problem) {
      return new NextResponse("Invalid contest problem", { status: 400 });
    }

    await ensureContestParticipant(contest.id, userId);

    const allowedLanguages = await getAllowedLanguages();
    if (!allowedLanguages.includes(language)) {
      return new NextResponse("This language is currently disabled by admin", { status: 400 });
    }

    const detail = encodeSubmissionDetail("Queued for judge", {
      hiddenInStatus: true,
      source: "USACO_CONTEST",
      contestId: contest.id
    });

    const submission = await db.submission.create({
      data: {
        problemId: problem.id,
        userId,
        code: String(code),
        language,
        isPublic: false,
        codeVisibility: "PRIVATE",
        status: "PENDING",
        detail
      }
    });

    await enqueueSubmissionForJudge(submission.id);

    return NextResponse.json({
      ok: true,
      submissionId: submission.id,
      status: "QUEUED"
    });
  } catch (error) {
    console.error("[USACO_CONTEST_SUBMIT_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
