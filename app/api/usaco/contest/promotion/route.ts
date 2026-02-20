import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { db } from "@/lib/db";

const DIVISIONS = ["Bronze", "Silver", "Gold", "Platinum"] as const;
type Division = (typeof DIVISIONS)[number];

function asDivision(value?: string | null): Division {
  return DIVISIONS.includes(value as Division) ? (value as Division) : "Bronze";
}

function nextDivision(current: Division): Division | null {
  const idx = DIVISIONS.indexOf(current);
  if (idx < 0 || idx >= DIVISIONS.length - 1) return null;
  return DIVISIONS[idx + 1];
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const me = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, division: true }
    });
    if (!me) return new NextResponse("User not found", { status: 404 });

    const current = asDivision(me.division);
    const next = nextDivision(current);
    if (!next) {
      return NextResponse.json({
        ok: true,
        promoted: false,
        division: current,
        message: "이미 최고 디비전입니다."
      });
    }

    const divisionTag = `division:${current.toLowerCase()}`;
    const problems = await db.problem.findMany({
      where: {
        AND: [{ tags: { contains: "usaco" } }, { tags: { contains: divisionTag } }]
      },
      orderBy: { number: "asc" },
      take: 3,
      select: { id: true }
    });

    if (problems.length === 0) {
      return new NextResponse("No contest problems for current division", { status: 400 });
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
      if (!latestByProblem.has(row.problemId)) {
        latestByProblem.set(row.problemId, row);
      }
    }

    const perfectAll = problems.every((p) => {
      const row = latestByProblem.get(p.id);
      if (!row) return false;
      if (row.status !== "ACCEPTED") return false;
      if (typeof row.totalScore === "number" && typeof row.maxScore === "number") {
        return row.totalScore >= row.maxScore;
      }
      return true;
    });

    if (!perfectAll) {
      return NextResponse.json({
        ok: true,
        promoted: false,
        division: current,
        message: "아직 모든 문제를 만점으로 통과하지 않았습니다."
      });
    }

    await db.user.update({
      where: { id: userId },
      data: { division: next }
    });

    return NextResponse.json({
      ok: true,
      promoted: true,
      division: next,
      previousDivision: current,
      message: `축하합니다! ${current}에서 ${next}로 승급되었습니다.`
    });
  } catch (error) {
    console.error("[USACO_CONTEST_PROMOTION_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
