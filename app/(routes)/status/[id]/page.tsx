import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Link from "next/link";
import RejudgeButton from "@/components/RejudgeButton";
import { getSessionUser } from "@/lib/session-user";
import { canViewCode, getVisibilityLabel } from "@/lib/code-visibility";
import { decodeSubmissionDetail, isHiddenStatusSubmission } from "@/lib/submission-meta";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

type CaseRange = {
  start: number;
  end: number;
  groupName: string;
  isHidden: boolean;
  score: number;
  count: number;
};

function formatRange(start: number, end: number) {
  return start === end ? `${start}` : `${start}-${end}`;
}

function parseGroupMeta(rawGroupName: string) {
  const raw = (rawGroupName || "").trim();
  if (!raw) return { label: "default", constraint: "" };

  if (raw.includes("|")) {
    const [label, ...rest] = raw.split("|");
    return { label: (label || "default").trim(), constraint: rest.join("|").trim() };
  }
  if (raw.includes("::")) {
    const [label, ...rest] = raw.split("::");
    return { label: (label || "default").trim(), constraint: rest.join("::").trim() };
  }
  const bracket = raw.match(/^(.*)\[(.+)\]$/);
  if (bracket) {
    return { label: bracket[1].trim() || "default", constraint: bracket[2].trim() };
  }

  return { label: raw, constraint: "" };
}

function defaultCriteria(groupName: string, isHidden: boolean) {
  const name = groupName.toLowerCase();
  if (!isHidden || name.includes("sample")) return "Basic sample I/O validation";
  if (name.includes("edge") || name.includes("bound")) return "Boundary and edge-case validation";
  if (name.includes("main")) return "Core correctness validation";
  if (name.includes("manual")) return "Manually curated validation";
  if (name.includes("auto")) return "Auto-generated hidden validation";
  return isHidden ? "Additional hidden validation" : "Public validation";
}

function buildCaseRanges(
  cases: Array<{ groupName: string; isHidden: boolean; score: number }>
): CaseRange[] {
  if (cases.length === 0) return [];
  const ranges: CaseRange[] = [];
  let cursor = 1;

  for (const tc of cases) {
    const last = ranges[ranges.length - 1];
    if (last && last.groupName === tc.groupName && last.isHidden === tc.isHidden) {
      last.end += 1;
      last.count += 1;
      last.score += tc.score;
    } else {
      ranges.push({
        start: cursor,
        end: cursor,
        groupName: tc.groupName,
        isHidden: tc.isHidden,
        score: tc.score,
        count: 1
      });
    }
    cursor += 1;
  }

  return ranges;
}

function parsePendingProgress(detail?: string | null) {
  const { message } = decodeSubmissionDetail(detail);
  if (!message) return null;
  const match = message.match(/(\d{1,3})%/);
  if (!match) return null;
  const value = Number(match[1]);
  if (Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, value));
}

export default async function SubmissionDetailPage(props: PageProps) {
  const { id } = await props.params;
  const session = await getServerSession(authOptions);
  const { id: userId, role } = getSessionUser(session);

  const submission = await db.submission.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      problem: {
        select: {
          id: true,
          title: true,
          number: true,
          testCases: {
            select: { id: true, groupName: true, score: true, isHidden: true },
            orderBy: { id: "asc" }
          }
        }
      }
    }
  });

  if (!submission) return notFound();
  const decodedForAccess = decodeSubmissionDetail(submission.detail);
  const isArenaSource = decodedForAccess.meta?.source === "ARENA_1V1";
  const isOwner = !!userId && submission.userId === userId;
  if (isHiddenStatusSubmission(submission.detail) && role !== "ADMIN" && !(isArenaSource && isOwner)) redirect("/status");

  const canView = canViewCode({
    codeVisibility: submission.codeVisibility,
    status: submission.status,
    isOwner,
    isAdmin: role === "ADMIN"
  });
  if (!canView) redirect("/status");

  const canRejudge = role === "ADMIN" || (!!userId && submission.userId === userId);
  const pendingProgress = submission.status === "PENDING" ? parsePendingProgress(submission.detail) : null;
  const { message: plainDetail, meta } = decodeSubmissionDetail(submission.detail);
  const caseRanges = buildCaseRanges(
    submission.problem.testCases.map((tc) => ({
      groupName: tc.groupName || (tc.isHidden ? "hidden" : "sample"),
      isHidden: tc.isHidden,
      score: tc.score
    }))
  );
  const failedCaseInfo =
    typeof submission.failedCase === "number" && submission.failedCase > 0
      ? submission.problem.testCases[submission.failedCase - 1]
      : null;

  return (
    <div className="container mx-auto max-w-5xl py-10 px-4 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">제출 상세</h1>
          <p className="text-sm text-neutral-300 mt-1">#{submission.id}</p>
        </div>
        {canRejudge && <RejudgeButton submissionId={submission.id} />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Info label="사용자" value={submission.user.name || submission.user.id} href={`/user/${submission.user.id}`} />
        <Info label="문제" value={`${submission.problem.number} - ${submission.problem.title}`} href={`/problem/${submission.problem.number}`} />
        <Info label="결과" value={submission.status + (pendingProgress !== null ? ` ${pendingProgress}%` : "")} />
        <Info label="공개 여부" value={getVisibilityLabel(submission.codeVisibility)} />
        <Info
          label="점수"
          value={typeof submission.totalScore === "number" && typeof submission.maxScore === "number" ? `${submission.totalScore} / ${submission.maxScore}` : "-"}
        />
        <Info label="언어" value={submission.language} />
        <Info label="시간" value={submission.timeUsed ? `${submission.timeUsed} ms` : "-"} />
        <Info label="메모리" value={submission.memoryUsed ? `${submission.memoryUsed} KB` : "-"} />
      </div>

      {meta?.source === "ARENA_1V1" && meta.contestId ? (
        <section className="rounded border border-neutral-700 bg-neutral-900 p-4">
          <h2 className="font-semibold mb-2">Arena Battle</h2>
          <Link href={`/arena/battle/${meta.contestId}`} className="text-blue-400 hover:underline">
            배틀 방으로 이동
          </Link>
        </section>
      ) : null}

      <section className="rounded border border-neutral-700 bg-neutral-900 p-4">
        <h2 className="font-semibold mb-2">채점 메시지</h2>
        <p className="text-sm whitespace-pre-wrap">{plainDetail || "상세 메시지가 없습니다."}</p>
      </section>

      {submission.failedCase && (
        <section className="rounded border border-neutral-700 bg-neutral-900 p-4">
          <h2 className="font-semibold mb-2">실패 케이스</h2>
          <p className="text-sm">테스트케이스 #{submission.failedCase}</p>
          {failedCaseInfo && (
            <p className="text-sm text-neutral-300 mt-1">
              그룹: {parseGroupMeta(failedCaseInfo.groupName || "").label} · {failedCaseInfo.isHidden ? "hidden" : "public"} · {failedCaseInfo.score}점
            </p>
          )}
        </section>
      )}

      <section className="rounded border border-neutral-700 bg-neutral-900 p-4">
        <h2 className="font-semibold mb-2">SCORING / 그룹별 채점 기준</h2>
        <ul className="space-y-1 text-sm text-neutral-200">
          {caseRanges.map((range) => {
            const meta = parseGroupMeta(range.groupName);
            const criteria = meta.constraint || defaultCriteria(meta.label, range.isHidden);
            return (
              <li key={`${range.start}-${range.end}-${range.groupName}-${range.isHidden ? "hidden" : "public"}`}>
                Inputs {formatRange(range.start, range.end)}: {criteria}
                <span className="ml-2 text-neutral-400">
                  ({meta.label}, {range.isHidden ? "hidden" : "public"}, {range.count} cases, {range.score} pts)
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {meta?.groupScores && meta.groupScores.length > 0 && (
        <section className="rounded border border-neutral-700 bg-neutral-900 p-4">
          <h2 className="font-semibold mb-2">그룹별 획득 점수</h2>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-400 border-b border-neutral-700">
                  <th className="text-left py-2 pr-2">범위</th>
                  <th className="text-left py-2 pr-2">그룹</th>
                  <th className="text-left py-2 pr-2">유형</th>
                  <th className="text-left py-2 pr-2">통과</th>
                  <th className="text-left py-2 pr-2">점수</th>
                </tr>
              </thead>
              <tbody>
                {meta.groupScores.map((g) => {
                  const percent = g.maxScore > 0 ? Math.round((g.earnedScore / g.maxScore) * 100) : 0;
                  return (
                    <tr key={`${g.start}-${g.end}-${g.groupName}`} className="border-b border-neutral-800">
                      <td className="py-2 pr-2">{formatRange(g.start, g.end)}</td>
                      <td className="py-2 pr-2">{parseGroupMeta(g.groupName).label}</td>
                      <td className="py-2 pr-2">{g.isHidden ? "hidden" : "public"}</td>
                      <td className="py-2 pr-2">{g.passedCases}/{g.totalCases}</td>
                      <td className="py-2 pr-2">{g.earnedScore}/{g.maxScore} ({percent}%)</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(submission.expectedOutput || submission.actualOutput) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded border border-neutral-700 bg-neutral-900 p-4">
            <h2 className="font-semibold mb-2">기대 출력</h2>
            <pre className="text-xs whitespace-pre-wrap overflow-auto">{submission.expectedOutput || "-"}</pre>
          </div>
          <div className="rounded border border-neutral-700 bg-neutral-900 p-4">
            <h2 className="font-semibold mb-2">실제 출력</h2>
            <pre className="text-xs whitespace-pre-wrap overflow-auto">{submission.actualOutput || "-"}</pre>
          </div>
        </section>
      )}

      <section className="rounded border border-neutral-700 bg-neutral-900 p-4">
        <h2 className="font-semibold mb-2">제출 코드</h2>
        <pre className="text-xs whitespace-pre-wrap overflow-auto">{submission.code}</pre>
      </section>
    </div>
  );
}

function Info({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="rounded border border-neutral-700 bg-neutral-900 p-3">
      <div className="text-xs text-neutral-300 mb-1">{label}</div>
      {href ? <Link href={href} className="font-medium hover:text-blue-400">{value}</Link> : <div className="font-medium">{value}</div>}
    </div>
  );
}
