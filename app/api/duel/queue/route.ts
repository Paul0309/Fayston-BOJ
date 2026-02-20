import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { db } from "@/lib/db";
import { getActiveBattleForUser, joinDuelQueue, leaveDuelQueue, tryMatchmake } from "@/lib/duel";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const [queue, battle] = await Promise.all([
      db.duelQueue.findUnique({ where: { userId } }),
      getActiveBattleForUser(userId)
    ]);
    const queueRows = await db.duelQueue.findMany({
      orderBy: { joinedAt: "asc" },
      select: { userId: true }
    });
    const queueSize = queueRows.length;
    const position = queue ? Math.max(1, queueRows.findIndex((r) => r.userId === userId) + 1) : null;
    const estimatedSec = queue
      ? Math.max(8, ((position || 1) - 1) * 18 + (queueSize % 2 === 0 ? 8 : 16))
      : 0;

    return NextResponse.json({
      inQueue: !!queue,
      queueJoinedAt: queue?.joinedAt || null,
      battleId: battle?.id || null,
      queueSize,
      position,
      estimatedSec
    });
  } catch (error) {
    console.error("[DUEL_QUEUE_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const joined = await joinDuelQueue(userId);
    await tryMatchmake();

    const battle = await getActiveBattleForUser(userId);
    return NextResponse.json({
      ok: true,
      inQueue: !battle,
      battleId: battle?.id || joined.battleId || null
    });
  } catch (error) {
    console.error("[DUEL_QUEUE_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    await leaveDuelQueue(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DUEL_QUEUE_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
