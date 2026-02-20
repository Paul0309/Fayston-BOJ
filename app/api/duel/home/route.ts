import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { db } from "@/lib/db";
import { getActiveBattleForUser } from "@/lib/duel";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const [me, leaderboard, recent, activeBattle] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, rating: true, wins: true, losses: true, draws: true }
      }),
      db.user.findMany({
        orderBy: [{ rating: "desc" }, { wins: "desc" }],
        take: 20,
        select: { id: true, name: true, rating: true, wins: true, losses: true, draws: true }
      }),
      db.duelBattle.findMany({
        where: {
          OR: [{ player1Id: userId }, { player2Id: userId }]
        },
        orderBy: { createdAt: "desc" },
        take: 15,
        include: {
          problem: { select: { id: true, number: true, title: true } },
          player1: { select: { id: true, name: true } },
          player2: { select: { id: true, name: true } }
        }
      }),
      getActiveBattleForUser(userId)
    ]);
    if (!me) return new NextResponse("User not found", { status: 404 });

    return NextResponse.json({
      me,
      leaderboard,
      activeBattleId: activeBattle?.id || null,
      recent: recent.map((b) => ({
        id: b.id,
        status: b.status,
        startedAt: b.startedAt,
        endedAt: b.endedAt,
        winnerId: b.winnerId,
        problem: b.problem,
        player1: b.player1,
        player2: b.player2
      }))
    });
  } catch (error) {
    console.error("[DUEL_HOME_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

