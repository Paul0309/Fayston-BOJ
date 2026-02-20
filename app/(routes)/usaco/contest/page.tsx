import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { db } from "@/lib/db";
import UsacoContestClient from "@/components/UsacoContestClient";
import { getAllowedLanguages } from "@/lib/language-settings";
import { decodeSubmissionDetail } from "@/lib/submission-meta";
import { asUsacoDivision, ensureContestParticipant, findActiveUsacoContestByDivision } from "@/lib/usaco/contest";

export const dynamic = "force-dynamic";

export default async function UsacoContestPage() {
  const session = await getServerSession(authOptions);
  const user = getSessionUser(session);
  if (!user.id) redirect("/login");

  const userProfile = await db.user.findUnique({
    where: { id: user.id },
    select: { division: true }
  });
  const division = asUsacoDivision(userProfile?.division || user.division);
  const allowedLanguages = await getAllowedLanguages();

  const contest = await findActiveUsacoContestByDivision(division);
  if (!contest) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-5 text-amber-100">
        No active USACO contest for your division.
      </div>
    );
  }

  await ensureContestParticipant(contest.id, user.id);

  const problems = await db.problem.findMany({
    where: { contestId: contest.id },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      title: true,
      difficulty: true,
      tags: true,
      description: true,
      inputDesc: true,
      outputDesc: true,
      timeLimit: true,
      memoryLimit: true,
      testCases: {
        where: { OR: [{ isHidden: false }, { isHidden: true }] },
        orderBy: { id: "asc" },
        select: { input: true, output: true, groupName: true, isHidden: true, score: true }
      }
    },
    take: 3
  });

  const statuses = await db.submission.findMany({
    where: {
      userId: user.id,
      problemId: { in: problems.map((p) => p.id) },
      detail: { contains: `"contestId":"${contest.id}"` }
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      problemId: true,
      status: true,
      totalScore: true,
      maxScore: true,
      language: true,
      detail: true,
      failedCase: true,
      expectedOutput: true,
      actualOutput: true,
      createdAt: true
    }
  });

  const latestByProblem: Record<
    string,
    {
      id: string;
      status: string;
      totalScore: number | null;
      maxScore: number | null;
      language: string;
      detail: string;
      failedCase: number | null;
      expectedOutput: string | null;
      actualOutput: string | null;
      updatedAt: string;
      passedTests: number;
      totalTests: number;
    } | undefined
  > = {};
  const initialLogsByProblem: Record<
    string,
    Array<{
      id: string;
      status: string;
      totalScore: number | null;
      maxScore: number | null;
      language: string;
      detail: string;
      failedCase: number | null;
      expectedOutput: string | null;
      actualOutput: string | null;
      updatedAt: string;
      passedTests: number;
      totalTests: number;
    }>
  > = {};
  for (const row of statuses) {
    const decoded = decodeSubmissionDetail(row.detail);
    const groupScores = decoded.meta?.groupScores || [];
    const passedTests = groupScores.reduce((acc, g) => acc + g.passedCases, 0);
    const totalTests = groupScores.reduce((acc, g) => acc + g.totalCases, 0);
    const item = {
      id: row.id,
      status: row.status,
      totalScore: row.totalScore,
      maxScore: row.maxScore,
      language: row.language,
      detail: decoded.message || "",
      failedCase: row.failedCase,
      expectedOutput: row.expectedOutput,
      actualOutput: row.actualOutput,
      updatedAt: row.createdAt.toISOString(),
      passedTests,
      totalTests
    };
    if (!initialLogsByProblem[row.problemId]) initialLogsByProblem[row.problemId] = [];
    if (initialLogsByProblem[row.problemId].length < 8) {
      initialLogsByProblem[row.problemId].push(item);
    }
    if (!latestByProblem[row.problemId]) {
      latestByProblem[row.problemId] = item;
    }
  }

  return (
    <UsacoContestClient
      division={division}
      contestId={contest.id}
      userId={user.id}
      allowedLanguages={allowedLanguages}
      problems={problems.map((p) => ({
        id: p.id,
        number: p.number,
        title: p.title,
        difficulty: p.difficulty,
        tags: p.tags,
        description: p.description,
        inputDesc: p.inputDesc,
        outputDesc: p.outputDesc,
        timeLimit: p.timeLimit,
        memoryLimit: p.memoryLimit,
        firstSampleInput: p.testCases[0]?.input,
        firstSampleOutput: p.testCases[0]?.output,
        scoringGuide: p.testCases.map((tc, idx) => {
          const label = tc.groupName?.includes("|") ? tc.groupName.split("|")[1]?.trim() : "";
          const fallback = tc.isHidden ? "hidden validation" : "sample validation";
          return `Test ${idx + 1}: ${label || fallback}`;
        })
      }))}
      initialStatuses={latestByProblem}
      initialLogsByProblem={initialLogsByProblem}
    />
  );
}
