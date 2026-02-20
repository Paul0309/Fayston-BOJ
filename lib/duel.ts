import { db } from "@/lib/db";
import { encodeSubmissionDetail } from "@/lib/submission-meta";

export const DUEL_DURATION_SEC = 30 * 60;
export const DUEL_SOURCE = "ARENA_1V1";
const K_FACTOR = 32;

function expectedScore(ratingA: number, ratingB: number) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function calculateNewRating(rating: number, expected: number, actual: number) {
  return Math.max(0, Math.round(rating + K_FACTOR * (actual - expected)));
}

export async function getActiveBattleForUser(userId: string) {
  return db.duelBattle.findFirst({
    where: {
      status: "RUNNING",
      OR: [{ player1Id: userId }, { player2Id: userId }]
    },
    include: {
      player1: { select: { id: true, name: true, rating: true } },
      player2: { select: { id: true, name: true, rating: true } },
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
      }
    }
  });
}

export async function joinDuelQueue(userId: string) {
  const active = await getActiveBattleForUser(userId);
  if (active) return { alreadyInBattle: true as const, battleId: active.id };

  const me = await db.user.findUnique({ where: { id: userId }, select: { rating: true } });
  if (!me) throw new Error("User not found");

  await db.duelQueue.upsert({
    where: { userId },
    update: { ratingSnapshot: me.rating },
    create: {
      userId,
      ratingSnapshot: me.rating
    }
  });

  const matched = await tryMatchmake();
  return { alreadyInBattle: false as const, battleId: matched?.id || null };
}

export async function leaveDuelQueue(userId: string) {
  await db.duelQueue.deleteMany({ where: { userId } });
}

export async function tryMatchmake() {
  return db.$transaction(async (tx) => {
    const queue = await tx.duelQueue.findMany({
      orderBy: [{ joinedAt: "asc" }, { ratingSnapshot: "asc" }],
      take: 40
    });
    if (queue.length < 2) return null;

    let bestPair: [typeof queue[number], typeof queue[number]] | null = null;
    let bestDiff = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < queue.length; i++) {
      for (let j = i + 1; j < queue.length; j++) {
        const diff = Math.abs(queue[i].ratingSnapshot - queue[j].ratingSnapshot);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestPair = [queue[i], queue[j]];
        }
      }
    }
    if (!bestPair) return null;

    const [p1, p2] = bestPair;
    const removed = await tx.duelQueue.deleteMany({
      where: { userId: { in: [p1.userId, p2.userId] } }
    });
    if (removed.count < 2) return null;

    const problem = await tx.problem.findFirst({
      where: { tags: { not: { contains: "usaco" } } },
      orderBy: { number: "asc" },
      select: { id: true }
    });
    if (!problem) throw new Error("No problem available for duel");

    return tx.duelBattle.create({
      data: {
        player1Id: p1.userId,
        player2Id: p2.userId,
        problemId: problem.id,
        durationSec: DUEL_DURATION_SEC,
        status: "RUNNING"
      }
    });
  });
}

export function duelMetaDetail(message: string, battleId: string) {
  return encodeSubmissionDetail(message, {
    hiddenInStatus: true,
    source: DUEL_SOURCE,
    contestId: battleId
  });
}

export async function finalizeDuelIfNeeded(battleId: string) {
  const battle = await db.duelBattle.findUnique({
    where: { id: battleId },
    include: {
      player1: { select: { id: true, rating: true } },
      player2: { select: { id: true, rating: true } }
    }
  });
  if (!battle || battle.status !== "RUNNING") return null;

  const startedMs = new Date(battle.startedAt).getTime();
  const deadlineMs = startedMs + battle.durationSec * 1000;
  const now = Date.now();
  const windowEnd = battle.endedAt || new Date(deadlineMs);

  const relevantSubs = await db.submission.findMany({
    where: {
      problemId: battle.problemId,
      userId: { in: [battle.player1Id, battle.player2Id] },
      OR: [{ detail: { contains: `"contestId":"${battle.id}"` } }, { createdAt: { gte: battle.startedAt, lte: windowEnd } }]
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      status: true,
      createdAt: true
    }
  });

  const firstAccepted = (uid: string) =>
    relevantSubs.find((s) => s.userId === uid && s.status === "ACCEPTED")?.createdAt || null;
  const p1Ac = firstAccepted(battle.player1Id);
  const p2Ac = firstAccepted(battle.player2Id);

  let shouldFinish = false;
  let winnerId: string | null = null;

  if (p1Ac && p2Ac) {
    shouldFinish = true;
    winnerId = p1Ac.getTime() <= p2Ac.getTime() ? battle.player1Id : battle.player2Id;
  } else if (p1Ac && !p2Ac) {
    shouldFinish = true;
    winnerId = battle.player1Id;
  } else if (!p1Ac && p2Ac) {
    shouldFinish = true;
    winnerId = battle.player2Id;
  } else if (now >= deadlineMs) {
    shouldFinish = true;
    winnerId = null;
  }

  if (!shouldFinish) return null;

  return db.$transaction(async (tx) => {
    const locked = await tx.duelBattle.findUnique({ where: { id: battleId } });
    if (!locked || locked.status !== "RUNNING") return locked;

    const updated = await tx.duelBattle.update({
      where: { id: battleId },
      data: {
        status: "FINISHED",
        endedAt: new Date(),
        winnerId,
        player1AcceptedAt: p1Ac || undefined,
        player2AcceptedAt: p2Ac || undefined
      }
    });

    const r1 = battle.player1.rating;
    const r2 = battle.player2.rating;
    const e1 = expectedScore(r1, r2);
    const e2 = expectedScore(r2, r1);
    const s1 = winnerId === null ? 0.5 : winnerId === battle.player1Id ? 1 : 0;
    const s2 = winnerId === null ? 0.5 : winnerId === battle.player2Id ? 1 : 0;
    const n1 = calculateNewRating(r1, e1, s1);
    const n2 = calculateNewRating(r2, e2, s2);

    await tx.user.update({
      where: { id: battle.player1Id },
      data: {
        rating: n1,
        wins: winnerId === battle.player1Id ? { increment: 1 } : undefined,
        losses: winnerId === battle.player2Id ? { increment: 1 } : undefined,
        draws: winnerId === null ? { increment: 1 } : undefined
      }
    });
    await tx.user.update({
      where: { id: battle.player2Id },
      data: {
        rating: n2,
        wins: winnerId === battle.player2Id ? { increment: 1 } : undefined,
        losses: winnerId === battle.player1Id ? { increment: 1 } : undefined,
        draws: winnerId === null ? { increment: 1 } : undefined
      }
    });

    await tx.duelRatingHistory.create({
      data: {
        battleId: battle.id,
        userId: battle.player1Id,
        ratingBefore: r1,
        ratingAfter: n1,
        ratingChange: n1 - r1
      }
    });
    await tx.duelRatingHistory.create({
      data: {
        battleId: battle.id,
        userId: battle.player2Id,
        ratingBefore: r2,
        ratingAfter: n2,
        ratingChange: n2 - r2
      }
    });

    return updated;
  });
}
