import { db } from "@/lib/db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import ProblemCommunityPanel from "@/components/ProblemCommunityPanel";
import MarkdownMath from "@/components/MarkdownMath";
import ExampleCaseCard from "@/components/ExampleCaseCard";
import { getSessionUser } from "@/lib/session-user";
import { withDbRetry } from "@/lib/db-retry";
import { getProblemDiscussions, getProblemEditorials } from "@/lib/problem-community";

interface PageProps {
  params: Promise<{ id: string }>;
}
type ScoreRange = {
  start: number;
  end: number;
  groupName: string;
  isHidden: boolean;
  score: number;
  count: number;
};

function formatTestRange(start: number, end: number) {
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

function describeScoreCriteria(groupName: string, isHidden: boolean) {
  const name = (groupName || "").toLowerCase();
  if (!isHidden || name.includes("sample")) {
    return "Basic sample I/O validation";
  }
  if (name.includes("edge") || name.includes("bound")) {
    return "Boundary and edge-case validation";
  }
  if (name.includes("manual")) {
    return "Manually curated validation";
  }
  if (name.includes("auto")) {
    return "Auto-generated hidden validation";
  }
  if (name.includes("main")) {
    return "Core correctness validation";
  }
  return isHidden ? "Additional hidden validation" : "Public validation";
}

function normalizeStatementText(text?: string | null) {
  if (!text) return "";

  // Convert escaped newlines in plain text while preserving math blocks.
  const segments = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  const normalized = segments.map((segment) => {
    if (segment.startsWith("$")) return segment;
    const plain = segment
      .replace(/\\\\r\\\\n/g, "\n")
      .replace(/\\\\n/g, "\n")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n");
    return reflowPlainText(plain);
  });

  return normalized.join("").trim();
}

function reflowPlainText(text: string) {
  const lines = text.split("\n").map((line) => line.trimEnd());
  const out: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    out.push(paragraph.join(" ").replace(/\s+/g, " ").trim());
    paragraph = [];
  };

  const isMarkdownBlockLine = (line: string) =>
    /^#{1,6}\s/.test(line) ||
    /^[-*+]\s/.test(line) ||
    /^\d+\.\s/.test(line) ||
    /^>\s/.test(line) ||
    /^```/.test(line) ||
    /^\|/.test(line) ||
    /^\$\$/.test(line);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      if (out[out.length - 1] !== "") out.push("");
      continue;
    }

    if (isMarkdownBlockLine(line)) {
      flushParagraph();
      out.push(line);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

function buildScoreRanges(
  cases: Array<{ groupName: string; isHidden: boolean; score: number }>
): ScoreRange[] {
  if (cases.length === 0) return [];

  const ranges: ScoreRange[] = [];
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

export default async function ProblemDetailPage(props: PageProps) {
  const params = await props.params;
  const rawId = params.id.trim();
  const numericId = Number(rawId);
  const isNumberRoute = Number.isInteger(numericId) && numericId > 0 && String(numericId) === rawId;

  const [problem, session] = await Promise.all([
    withDbRetry(() =>
      db.problem.findUnique({
        where: isNumberRoute ? { number: numericId } : { id: rawId },
        include: {
          testCases: { orderBy: { id: "asc" } },
          _count: { select: { submissions: { where: { status: "ACCEPTED" } } } }
        }
      })
    ),
    getServerSession(authOptions)
  ]);

  if (!problem) return notFound();
  if (!isNumberRoute) redirect(`/problem/${problem.number}`);

  const { id: userId, role } = getSessionUser(session);
  const [editorials, discussions] = await Promise.all([
    getProblemEditorials(problem.id),
    getProblemDiscussions(problem.id, 200, userId)
  ]);
  const visibleCases = problem.testCases.filter((tc) => !tc.isHidden);
  const maxScore = problem.testCases.reduce((acc, tc) => acc + tc.score, 0);
  const sampleScore = visibleCases.reduce((acc, tc) => acc + tc.score, 0);
  const hiddenScore = Math.max(0, maxScore - sampleScore);
  const scoreRanges = buildScoreRanges(
    problem.testCases.map((tc) => ({
      groupName: tc.groupName || (tc.isHidden ? "hidden" : "sample"),
      isHidden: tc.isHidden,
      score: tc.score
    }))
  );
  const normalizedDescription = normalizeStatementText(problem.description);
  const normalizedInputDesc = normalizeStatementText(problem.inputDesc);
  const normalizedOutputDesc = normalizeStatementText(problem.outputDesc);

  return (
    <div className="container mx-auto py-10 px-4 grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-3 space-y-8">
        <div className="border-b border-neutral-700 pb-4 mb-4">
          <h1 className="text-4xl font-bold text-neutral-100 mb-2">{problem.title}</h1>
          <div className="flex gap-4 text-sm text-neutral-300 flex-wrap">
            <span>난이도: {problem.difficulty}</span>
            <span>태그: {problem.tags || "-"}</span>
            <span>시간 제한: {problem.timeLimit}ms</span>
            <span>메모리 제한: {problem.memoryLimit}MB</span>
            <span>맞은 사람: {problem._count.submissions}</span>
            <span>만점(전체 테스트): {maxScore}</span>
            <span>공개 예제 점수: {sampleScore}</span>
            <span>비공개 테스트 점수: {hiddenScore}</span>
          </div>
        </div>

        <section>
          <h2 className="text-xl font-bold mb-4 border-b border-neutral-700 pb-2">문제</h2>
          <MarkdownMath
            className="prose prose-invert max-w-none text-neutral-100 prose-pre:my-6 prose-pre:bg-neutral-950 prose-pre:border prose-pre:border-neutral-700 prose-code:text-sky-300"
            statementMode
            content={normalizedDescription}
          />
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4 border-b border-neutral-700 pb-2">입력</h2>
          <MarkdownMath
            className="prose prose-invert max-w-none text-neutral-100"
            statementMode
            content={normalizedInputDesc}
          />
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4 border-b border-neutral-700 pb-2">출력</h2>
          <MarkdownMath
            className="prose prose-invert max-w-none text-neutral-100"
            statementMode
            content={normalizedOutputDesc}
          />
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4 border-b border-neutral-700 pb-2">예제</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {visibleCases.map((tc, idx) => (
              <ExampleCaseCard
                key={tc.id}
                index={idx}
                groupName={tc.groupName}
                score={tc.score}
                input={tc.input}
                output={tc.output}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4 border-b border-neutral-700 pb-2">채점 기준</h2>
          <div className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-4">
            <ul className="space-y-1 text-sm text-neutral-200">
              {scoreRanges.map((range) => (
                <li key={`${range.start}-${range.end}-${range.groupName}-${range.isHidden ? "hidden" : "visible"}`}>
                  {(() => {
                    const meta = parseGroupMeta(range.groupName);
                    const scoringText =
                      meta.constraint || describeScoreCriteria(meta.label, range.isHidden) || "No additional constraints.";
                    return (
                      <>
                        <span className="font-semibold">Inputs {formatTestRange(range.start, range.end)}:</span>{" "}
                        {scoringText}
                        <span className="ml-2 text-neutral-400">
                          ({meta.label}, {range.isHidden ? "hidden" : "public"}, {range.count} cases, {range.score} pts)
                        </span>
                      </>
                    );
                  })()}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <ProblemCommunityPanel
          problemId={problem.id}
          canPostDiscussion={Boolean(userId)}
          isAdmin={role === "ADMIN"}
          editorials={editorials}
          discussions={discussions}
        />
      </div>

      <div className="space-y-6">
        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-700 sticky top-24">
          <Link
            href={`/submit?id=${problem.id}`}
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors shadow-sm mb-4"
          >
            제출하기
          </Link>
          <Link
            href={`/status?problemId=${problem.id}`}
            className="block w-full text-center bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 font-bold py-3 rounded-lg transition-colors shadow-sm"
          >
            이 문제 채점 현황
          </Link>
          {role === "ADMIN" && (
            <Link
              href={`/admin/problems/${problem.id}/revisions`}
              className="mt-3 block w-full text-center bg-violet-700 hover:bg-violet-600 text-white font-bold py-3 rounded-lg transition-colors shadow-sm"
            >
              리비전 Diff 보기
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

