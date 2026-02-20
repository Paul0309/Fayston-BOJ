import { db } from "@/lib/db";

export const USACO_DIVISIONS = ["Bronze", "Silver", "Gold", "Platinum"] as const;
export type UsacoDivision = (typeof USACO_DIVISIONS)[number];

export function asUsacoDivision(value?: string | null): UsacoDivision {
  return USACO_DIVISIONS.includes(value as UsacoDivision) ? (value as UsacoDivision) : "Bronze";
}

export async function findActiveUsacoContestByDivision(division: UsacoDivision, now = new Date()) {
  return db.contest.findFirst({
    where: {
      isPublished: true,
      division,
      startTime: { lte: now },
      endTime: { gte: now }
    },
    orderBy: { startTime: "desc" },
    include: {
      problems: {
        orderBy: { number: "asc" },
        take: 3,
        select: { id: true, number: true, title: true, tags: true, difficulty: true }
      }
    }
  });
}

export async function ensureContestParticipant(contestId: string, userId: string) {
  return db.contestParticipant.upsert({
    where: {
      contestId_userId: {
        contestId,
        userId
      }
    },
    update: {},
    create: {
      contestId,
      userId
    }
  });
}

export async function isContestParticipant(contestId: string, userId: string) {
  const found = await db.contestParticipant.findUnique({
    where: {
      contestId_userId: {
        contestId,
        userId
      }
    },
    select: { id: true }
  });
  return !!found;
}

