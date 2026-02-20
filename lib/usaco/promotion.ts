import { db } from "@/lib/db";
import { asUsacoDivision, findActiveUsacoContestByDivision, USACO_DIVISIONS, type UsacoDivision } from "@/lib/usaco/contest";

export type PromotionCheckResult = {
  currentDivision: UsacoDivision;
  nextDivision: UsacoDivision | null;
  eligible: boolean;
  canPromote: boolean;
  deadlinePassed: boolean;
  message: string;
};

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
  const currentDivision = asUsacoDivision(me?.division);
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

  const contest = await findActiveUsacoContestByDivision(currentDivision);
  if (!contest) {
    return {
      currentDivision,
      nextDivision,
      eligible: false,
      canPromote: false,
      deadlinePassed: false,
      message: "현재 진행 중인 대회가 없습니다."
    };
  }

  const isParticipant = await db.contestParticipant.findUnique({
    where: {
      contestId_userId: {
        contestId: contest.id,
        userId
      }
    },
    select: { id: true }
  });
  if (!isParticipant) {
    return {
      currentDivision,
      nextDivision,
      eligible: false,
      canPromote: false,
      deadlinePassed: false,
      message: "이 대회의 참가자 등록이 필요합니다."
    };
  }

  const problems = contest.problems.map((p) => ({ id: p.id }));
  if (problems.length === 0) {
    return {
      currentDivision,
      nextDivision,
      eligible: false,
      canPromote: false,
      deadlinePassed: false,
      message: "대회 문제가 아직 등록되지 않았습니다."
    };
  }

  const submissions = await db.submission.findMany({
    where: {
      userId,
      problemId: { in: problems.map((p) => p.id) },
      detail: { contains: `"contestId":"${contest.id}"` }
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

  const deadlinePassed = new Date().getTime() > contest.endTime.getTime() || isPromotionDeadlinePassed();
  if (deadlinePassed) {
    return {
      currentDivision,
      nextDivision,
      eligible: true,
      canPromote: false,
      deadlinePassed: true,
      message: "프로모션 가능 기간이 종료되었습니다."
    };
  }

  return {
    currentDivision,
    nextDivision,
    eligible: true,
    canPromote: true,
    deadlinePassed: false,
    message: `축하합니다. ${currentDivision} 만점 완료, ${nextDivision}로 승급 가능합니다.`
  };
}
