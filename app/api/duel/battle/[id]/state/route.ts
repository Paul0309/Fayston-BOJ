import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { db } from "@/lib/db";
import { finalizeDuelIfNeeded } from "@/lib/duel";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await ctx.params;
    await finalizeDuelIfNeeded(id);

    const battle = await db.duelBattle.findUnique({
      where: { id },
      include: {
        problem: {
          select: {
            id: true,
            number: true,
            title: true,
            difficulty: true,
            description: true,
            inputDesc: true,
            outputDesc: true,
            timeLimit: true,
            memoryLimit: true,
            testCases: {
              where: { isHidden: false },
              orderBy: { id: "asc" },
              select: { input: true, output: true }
            }
          }
        },
        player1: { select: { id: true, name: true, rating: true } },
        player2: { select: { id: true, name: true, rating: true } },
        ratings: { select: { userId: true, ratingBefore: true, ratingAfter: true, ratingChange: true } }
      }
    });
    if (!battle) return new NextResponse("Not found", { status: 404 });
    if (battle.player1Id !== userId && battle.player2Id !== userId) return new NextResponse("Forbidden", { status: 403 });

    const submissions = await db.submission.findMany({
      where: {
        problemId: battle.problemId,
        userId: { in: [battle.player1Id, battle.player2Id] },
        detail: { contains: `"contestId":"${battle.id}"` }
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        userId: true,
        status: true,
        totalScore: true,
        maxScore: true,
        failedCase: true,
        createdAt: true
      }
    });

    const meId = userId;
    const opponentId = battle.player1Id === meId ? battle.player2Id : battle.player1Id;
    const mySubs = submissions.filter((s) => s.userId === meId);
    const oppSubs = submissions.filter((s) => s.userId === opponentId);

    return NextResponse.json({
      battle: {
        id: battle.id,
        status: battle.status,
        startedAt: battle.startedAt,
        endedAt: battle.endedAt,
        durationSec: battle.durationSec,
        winnerId: battle.winnerId,
        player1: battle.player1,
        player2: battle.player2,
        ratings: battle.ratings
      },
      problem: battle.problem,
      mySubmissions: mySubs,
      opponentSubmissionCount: oppSubs.length,
      opponentAccepted: oppSubs.some((s) => s.status === "ACCEPTED")
    });
  } catch (error) {
    console.error("[DUEL_BATTLE_STATE_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

