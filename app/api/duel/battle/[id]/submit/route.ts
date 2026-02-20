import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { db } from "@/lib/db";
import { getAllowedLanguages } from "@/lib/language-settings";
import { isSupportedLanguage } from "@/lib/languages";
import { duelMetaDetail, finalizeDuelIfNeeded } from "@/lib/duel";
import { enqueueSubmissionForJudge } from "@/lib/judge/queue";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await ctx.params;
    const body = await req.json();
    const code = typeof body?.code === "string" ? body.code : "";
    const language = typeof body?.language === "string" ? body.language : "";
    if (!code || !language) return new NextResponse("Missing fields", { status: 400 });
    if (!isSupportedLanguage(language)) return new NextResponse("Unsupported language", { status: 400 });

    const allowed = await getAllowedLanguages();
    if (!allowed.includes(language)) return new NextResponse("This language is disabled", { status: 400 });

    const battle = await db.duelBattle.findUnique({ where: { id } });
    if (!battle) return new NextResponse("Battle not found", { status: 404 });
    if (battle.status !== "RUNNING") return new NextResponse("Battle is not running", { status: 400 });
    if (battle.player1Id !== userId && battle.player2Id !== userId) return new NextResponse("Forbidden", { status: 403 });

    const deadline = new Date(battle.startedAt).getTime() + battle.durationSec * 1000;
    if (Date.now() > deadline) {
      await finalizeDuelIfNeeded(battle.id);
      return new NextResponse("Battle finished", { status: 400 });
    }

    const submission = await db.submission.create({
      data: {
        problemId: battle.problemId,
        userId,
        code,
        language,
        isPublic: false,
        codeVisibility: "PRIVATE",
        status: "PENDING",
        detail: duelMetaDetail("Queued for duel judge", battle.id)
      }
    });

    await enqueueSubmissionForJudge(submission.id);
    return NextResponse.json({ ok: true, submissionId: submission.id });
  } catch (error) {
    console.error("[DUEL_BATTLE_SUBMIT_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

