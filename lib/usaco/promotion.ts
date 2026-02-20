import { db } from "@/lib/db";

export const USACO_DIVISIONS = ["Bronze", "Silver", "Gold", "Platinum"] as const;
export type UsacoDivision = (typeof USACO_DIVISIONS)[number];

export type PromotionCheckResult = {
  currentDivision: UsacoDivision;
  nextDivision: UsacoDivision | null;
  eligible: boolean;
  canPromote: boolean;
  deadlinePassed: boolean;
  message: string;
};

function asDivision(value?: string | null): UsacoDivision {
  return USACO_DIVISIONS.includes(value as UsacoDivision) ? (value as UsacoDivision) : "Bronze";
}

function getNextDivision(current: UsacoDivision): UsacoDivision | null {
  const idx = USACO_DIVISIONS.indexOf(current);
  if (idx < 0 || idx >= USACO_DIVISIONS.length - 1) return null;
  return USACO_DIVISIONS[idx + 1];
}

export function isPromotionDeadlinePassed(now = new Date()) {
  const deadlineRaw = process.env.USACO_PROMOTION_DEADLINE;
  if (!deadlineRaw) return false;
  const deadline = new Date(deadlineRaw);
  if (Number.isNaN(deadline.getTime())) return false;
  return now.getTime() > deadline.getTime();
}

export async function checkUserUsacoPromotionEligibility(userId: string): Promise<PromotionCheckResult> {
  const me = await db.user.findUnique({
    where: { id: userId },
    select: { division: true }
  });
  const currentDivision = asDivision(me?.division);
  const nextDivision = getNextDivision(currentDivision);

  if (!nextDivision) {
    return {
      currentDivision,
      nextDivision,
      eligible: true,
      canPromote: false,
      deadlinePassed: false,
      message: "이미 최고 디비전입니다."
    };
  }

  const divisionTag = `division:${currentDivision.toLowerCase()}`;
  const problems = await db.problem.findMany({
    where: {
      AND: [{ tags: { contains: "usaco" } }, { tags: { contains: divisionTag } }]
    },
    orderBy: { number: "asc" },
    take: 3,
    select: { id: true }
  });

  if (problems.length === 0) {
    return {
      currentDivision,
      nextDivision,
      eligible: false,
      canPromote: false,
      deadlinePassed: false,
      message: "현재 디비전에 등록된 대회 문제가 없습니다."
    };
  }

  const submissions = await db.submission.findMany({
    where: {
      userId,
      problemId: { in: problems.map((p) => p.id) },
      detail: { contains: '"hiddenInStatus":true' }
    },
    orderBy: { createdAt: "desc" },
    select: {
      problemId: true,
      status: true,
      totalScore: true,
      maxScore: true
    }
  });

  const latestByProblem = new Map<string, (typeof submissions)[number]>();
  for (const row of submissions) {
    if (!latestByProblem.has(row.problemId)) latestByProblem.set(row.problemId, row);
  }

  const eligible = problems.every((p) => {
    const row = latestByProblem.get(p.id);
    if (!row || row.status !== "ACCEPTED") return false;
    if (typeof row.totalScore !== "number" || typeof row.maxScore !== "number") return false;
    if (row.maxScore <= 0) return false;
    return row.totalScore >= row.maxScore;
  });

  if (!eligible) {
    return {
      currentDivision,
      nextDivision,
      eligible: false,
      canPromote: false,
      deadlinePassed: false,
      message: "아직 모든 문제를 만점으로 통과하지 않았습니다."
    };
  }

  const deadlinePassed = isPromotionDeadlinePassed();
  if (deadlinePassed) {
    return {
      currentDivision,
      nextDivision,
      eligible: true,
      canPromote: false,
      deadlinePassed: true,
      message: "프로모션 가능한 대회 기간이 종료되었습니다."
    };
  }

  return {
    currentDivision,
    nextDivision,
    eligible: true,
    canPromote: true,
    deadlinePassed: false,
    message: `축하합니다! ${currentDivision} 만점 완료. ${nextDivision}로 승급할 수 있습니다.`
  };
}
