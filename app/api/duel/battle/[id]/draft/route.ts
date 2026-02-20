import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { db } from "@/lib/db";
import { isSupportedLanguage } from "@/lib/languages";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await ctx.params;
    const battle = await db.duelBattle.findUnique({
      where: { id },
      select: { id: true, player1Id: true, player2Id: true, status: true }
    });
    if (!battle) return new NextResponse("Not found", { status: 404 });
    if (battle.player1Id !== userId && battle.player2Id !== userId) return new NextResponse("Forbidden", { status: 403 });

    const opponentId = battle.player1Id === userId ? battle.player2Id : battle.player1Id;
    const [myDraft, opponentDraft] = await Promise.all([
      db.duelDraft.findUnique({
        where: {
          battleId_userId: {
            battleId: id,
            userId
          }
        },
        select: { language: true, code: true, updatedAt: true }
      }),
      db.duelDraft.findUnique({
        where: {
          battleId_userId: {
            battleId: id,
            userId: opponentId
          }
        },
        select: { language: true, code: true, updatedAt: true }
      })
    ]);

    return NextResponse.json({
      myDraft,
      opponentDraft
    });
  } catch (error) {
    console.error("[DUEL_BATTLE_DRAFT_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await ctx.params;
    const body = await req.json();
    const language = typeof body?.language === "string" ? body.language : "";
    const code = typeof body?.code === "string" ? body.code : "";
    if (!isSupportedLanguage(language)) return new NextResponse("Unsupported language", { status: 400 });
    if (!code) return new NextResponse("Code is required", { status: 400 });
    if (code.length > 256 * 1024) return new NextResponse("Code too large", { status: 400 });

    const battle = await db.duelBattle.findUnique({
      where: { id },
      select: { id: true, player1Id: true, player2Id: true, status: true }
    });
    if (!battle) return new NextResponse("Not found", { status: 404 });
    if (battle.player1Id !== userId && battle.player2Id !== userId) return new NextResponse("Forbidden", { status: 403 });

    await db.duelDraft.upsert({
      where: {
        battleId_userId: {
          battleId: id,
          userId
        }
      },
      update: { language, code },
      create: { battleId: id, userId, language, code }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DUEL_BATTLE_DRAFT_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

