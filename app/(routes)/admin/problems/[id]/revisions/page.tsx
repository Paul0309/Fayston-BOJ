import Link from "next/link";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string; compareTo?: string }>;
}

type RevisionView = {
  version: number;
  title: string;
  description: string;
  inputDesc: string | null;
  outputDesc: string | null;
  tags: string;
  timeLimit: number;
  memoryLimit: number;
  createdAt: Date;
};

function toLines(value?: string | null) {
  return (value || "").replace(/\r\n/g, "\n").split("\n");
}

function buildLinePairs(left?: string | null, right?: string | null) {
  const a = toLines(left);
  const b = toLines(right);
  const length = Math.max(a.length, b.length);
  return Array.from({ length }, (_, i) => {
    const leftLine = a[i] ?? "";
    const rightLine = b[i] ?? "";
    return {
      index: i + 1,
      left: leftLine,
      right: rightLine,
      changed: leftLine !== rightLine
    };
  });
}

type TokenChunk = { text: string; changed: boolean };

function tokenizeForDiff(line: string) {
  const tokens = line.match(/\s+|[^\s]+/g);
  return tokens ? tokens : [];
}

function buildTokenDiff(beforeLine: string, afterLine: string): { before: TokenChunk[]; after: TokenChunk[] } {
  const a = tokenizeForDiff(beforeLine);
  const b = tokenizeForDiff(afterLine);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const before: TokenChunk[] = [];
  const after: TokenChunk[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      before.push({ text: a[i], changed: false });
      after.push({ text: b[j], changed: false });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      before.push({ text: a[i], changed: true });
      i++;
    } else {
      after.push({ text: b[j], changed: true });
      j++;
    }
  }
  while (i < n) {
    before.push({ text: a[i], changed: true });
    i++;
  }
  while (j < m) {
    after.push({ text: b[j], changed: true });
    j++;
  }

  return { before, after };
}

function TokenLine({ tokens, color }: { tokens: TokenChunk[]; color: "red" | "green" }) {
  const changedClass = color === "red" ? "bg-red-900/40 text-red-100" : "bg-emerald-900/40 text-emerald-100";
  return (
    <>
      {tokens.map((token, idx) => (
        <span key={idx} className={token.changed ? changedClass : ""}>
          {token.text}
        </span>
      ))}
    </>
  );
}

function FieldDiff({ label, previous, current }: { label: string; previous?: string | null; current?: string | null }) {
  const pairs = buildLinePairs(previous, current);
  const changedCount = pairs.filter((p) => p.changed).length;
  return (
    <section className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-neutral-100">{label}</h3>
        <span className="text-xs text-neutral-400">changed lines: {changedCount}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-xs text-neutral-400">before</div>
          <pre className="max-h-80 overflow-auto rounded border border-neutral-700 bg-black/30 p-2 text-xs text-neutral-200">
            {pairs.map((p) => {
              if (!p.changed) {
                return (
                  <div key={`l-${p.index}`} className="">
                    {p.left || " "}
                  </div>
                );
              }
              const diff = buildTokenDiff(p.left, p.right);
              return (
                <div key={`l-${p.index}`} className="bg-red-900/20">
                  <TokenLine tokens={diff.before} color="red" />
                </div>
              );
            })}
          </pre>
        </div>
        <div>
          <div className="mb-1 text-xs text-neutral-400">after</div>
          <pre className="max-h-80 overflow-auto rounded border border-neutral-700 bg-black/30 p-2 text-xs text-neutral-200">
            {pairs.map((p) => {
              if (!p.changed) {
                return (
                  <div key={`r-${p.index}`} className="">
                    {p.right || " "}
                  </div>
                );
              }
              const diff = buildTokenDiff(p.left, p.right);
              return (
                <div key={`r-${p.index}`} className="bg-emerald-900/20">
                  <TokenLine tokens={diff.after} color="green" />
                </div>
              );
            })}
          </pre>
        </div>
      </div>
    </section>
  );
}

export const dynamic = "force-dynamic";

export default async function AdminProblemRevisionPage(props: PageProps) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") redirect("/");

  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const problem = await db.problem.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      title: true,
      revisions: {
        orderBy: { version: "desc" },
        select: {
          version: true,
          title: true,
          description: true,
          inputDesc: true,
          outputDesc: true,
          tags: true,
          timeLimit: true,
          memoryLimit: true,
          createdAt: true
        }
      }
    }
  });

  if (!problem) redirect("/admin");
  if (problem.revisions.length === 0) redirect(`/problem/${problem.number}`);

  const selectedVersion = Number(searchParams.version || problem.revisions[0].version);
  const selected = problem.revisions.find((r) => r.version === selectedVersion) || problem.revisions[0];

  const compareToVersion = Number(searchParams.compareTo || selected.version - 1);
  const compareTo =
    problem.revisions.find((r) => r.version === compareToVersion) ||
    problem.revisions.find((r) => r.version < selected.version) ||
    selected;

  const currentRevision: RevisionView = selected;
  const previousRevision: RevisionView = compareTo;

  return (
    <div className="flex min-h-screen bg-neutral-900">
      <AdminSidebar />
      <main className="flex-1 lg:ml-64 py-8 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-neutral-100">문제 리비전 Diff</h1>
              <p className="text-sm text-neutral-400 mt-1">
                #{problem.number} {problem.title}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/problem/${problem.number}`} className="rounded bg-neutral-700 px-3 py-2 text-sm text-white hover:bg-neutral-600">
                문제 보기
              </Link>
              <Link href="/admin/ai-management" className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500">
                AI 관리
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-700 bg-neutral-950 p-4">
            <div className="text-sm text-neutral-300 mb-2">비교 버전 선택</div>
            <div className="flex flex-wrap gap-2">
              {problem.revisions.map((rev) => (
                <Link
                  key={rev.version}
                  href={`/admin/problems/${problem.id}/revisions?version=${rev.version}`}
                  className={`rounded px-3 py-1.5 text-xs font-semibold ${
                    rev.version === selected.version
                      ? "bg-blue-600 text-white"
                      : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
                  }`}
                >
                  v{rev.version} ({new Date(rev.createdAt).toLocaleDateString()})
                </Link>
              ))}
            </div>
            <div className="mt-2 text-xs text-neutral-400">
              compare: v{previousRevision.version} → v{currentRevision.version}
            </div>
          </div>

          <FieldDiff label="제목" previous={previousRevision.title} current={currentRevision.title} />
          <FieldDiff label="설명" previous={previousRevision.description} current={currentRevision.description} />
          <FieldDiff label="입력" previous={previousRevision.inputDesc} current={currentRevision.inputDesc} />
          <FieldDiff label="출력" previous={previousRevision.outputDesc} current={currentRevision.outputDesc} />
          <FieldDiff label="태그" previous={previousRevision.tags} current={currentRevision.tags} />
          <FieldDiff
            label="제한"
            previous={`time=${previousRevision.timeLimit}ms, memory=${previousRevision.memoryLimit}MB`}
            current={`time=${currentRevision.timeLimit}ms, memory=${currentRevision.memoryLimit}MB`}
          />
        </div>
      </main>
    </div>
  );
}
