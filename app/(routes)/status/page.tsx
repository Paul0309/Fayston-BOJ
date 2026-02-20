import { db } from "@/lib/db";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import StatusRefresher from "@/components/StatusRefresher";
import { getJudgeQueueStats } from "@/lib/judge/queue";
import { notFound } from "next/navigation";
import { withDbRetry } from "@/lib/db-retry";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { canViewCode, getVisibilityLabel } from "@/lib/code-visibility";
import { decodeSubmissionDetail } from "@/lib/submission-meta";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const STATUS_OPTIONS = ["ALL", "PENDING", "ACCEPTED", "PARTIAL", "WRONG_ANSWER", "TLE", "RUNTIME_ERROR", "COMPILATION_ERROR"];
const PAGE_SIZE = 30;

type StatusMode = "school" | "arena";

function parsePendingProgress(detail?: string | null) {
  const { message } = decodeSubmissionDetail(detail);
  if (!message) return null;
  const match = message.match(/(\d{1,3})%/);
  if (!match) return null;
  const value = Number(match[1]);
  if (Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, value));
}

export default async function StatusPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const problemId = typeof searchParams.problemId === "string" ? searchParams.problemId : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "ALL";
  const language = typeof searchParams.language === "string" ? searchParams.language : "ALL";
  const userQuery = typeof searchParams.user === "string" ? searchParams.user.trim() : "";
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const mode: StatusMode = searchParams.mode === "arena" ? "arena" : "school";
  const page = Math.max(1, Number(typeof searchParams.page === "string" ? searchParams.page : "1") || 1);

  const session = await getServerSession(authOptions);
  const { id: currentUserId, role } = getSessionUser(session);

  const baseWhere =
    mode === "arena"
      ? {
          AND: [
            { detail: { contains: '"source":"ARENA_1V1"' } },
            ...(role === "ADMIN" ? [] : currentUserId ? [{ userId: currentUserId }] : [{ userId: "__none__" }]),
            ...(problemId ? [{ problemId }] : []),
            ...(status !== "ALL" ? [{ status }] : []),
            ...(language !== "ALL" ? [{ language }] : []),
            ...(userQuery ? [{ user: { OR: [{ name: { contains: userQuery } }, { email: { contains: userQuery } }] } }] : []),
            ...(q ? [{ OR: [{ detail: { contains: q } }, { problem: { title: { contains: q } } }] }] : [])
          ]
        }
      : {
          AND: [
            { NOT: { detail: { contains: '"hiddenInStatus":true' } } },
            { NOT: { detail: { contains: '"source":"ARENA_1V1"' } } },
            { NOT: { problem: { tags: { contains: "usaco" } } } },
            ...(problemId ? [{ problemId }] : []),
            ...(status !== "ALL" ? [{ status }] : []),
            ...(language !== "ALL" ? [{ language }] : []),
            ...(userQuery ? [{ user: { OR: [{ name: { contains: userQuery } }, { email: { contains: userQuery } }] } }] : []),
            ...(q ? [{ OR: [{ detail: { contains: q } }, { problem: { title: { contains: q } } }] }] : [])
          ]
        };

  const languageWhere =
    mode === "arena"
      ? {
          AND: [
            { detail: { contains: '"source":"ARENA_1V1"' } },
            ...(role === "ADMIN" ? [] : currentUserId ? [{ userId: currentUserId }] : [{ userId: "__none__" }])
          ]
        }
      : {
          AND: [
            { NOT: { detail: { contains: '"hiddenInStatus":true' } } },
            { NOT: { detail: { contains: '"source":"ARENA_1V1"' } } },
            { NOT: { problem: { tags: { contains: "usaco" } } } }
          ]
        };

  const [problem, submissions, totalCount, queueStats, languageRows] = await Promise.all([
    problemId
      ? withDbRetry(() =>
          db.problem.findUnique({
            where: { id: problemId },
            select: { id: true, number: true, title: true }
          })
        )
      : Promise.resolve(null),
    withDbRetry(() =>
      db.submission.findMany({
        where: baseWhere,
        orderBy: { createdAt: "desc" },
        include: { problem: true, user: { select: { id: true, name: true, email: true } } },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE
      })
    ),
    withDbRetry(() => db.submission.count({ where: baseWhere })),
    getJudgeQueueStats(),
    withDbRetry(() =>
      db.submission.findMany({
        where: languageWhere,
        distinct: ["language"],
        select: { language: true },
        orderBy: { language: "asc" }
      })
    )
  ]);

  if (problemId && !problem) return notFound();

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-3xl font-bold">채점 현황</h1>
        <StatusRefresher />
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link href="/status?mode=school" className={cn("rounded border px-3 py-1.5", mode === "school" ? "border-blue-500 text-blue-300" : "border-neutral-700 text-neutral-300")}>SchoolBOJ</Link>
        <Link href="/status?mode=arena" className={cn("rounded border px-3 py-1.5", mode === "arena" ? "border-emerald-500 text-emerald-300" : "border-neutral-700 text-neutral-300")}>1v1 Arena</Link>
      </div>

      {problem ? (
        <div className="mb-3 text-sm text-neutral-300">
          현재 필터: 문제 {problem.number} - {problem.title}
          <Link href={`/status?mode=${mode}`} className="ml-2 text-blue-400 hover:underline">
            전체 보기
          </Link>
        </div>
      ) : null}

      <form className="mb-4 grid grid-cols-1 md:grid-cols-6 gap-2">
        <input name="q" defaultValue={q} placeholder="문제/메시지 검색" className="rounded border border-neutral-700 bg-neutral-900 text-neutral-100 px-3 py-2" />
        <input name="user" defaultValue={userQuery} placeholder="사용자 검색" className="rounded border border-neutral-700 bg-neutral-900 text-neutral-100 px-3 py-2" />
        <select name="status" defaultValue={status} className="rounded border border-neutral-700 bg-neutral-900 text-neutral-100 px-3 py-2">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="language" defaultValue={language} className="rounded border border-neutral-700 bg-neutral-900 text-neutral-100 px-3 py-2">
          <option value="ALL">ALL</option>
          {languageRows.map((row) => (
            <option key={row.language} value={row.language}>
              {row.language}
            </option>
          ))}
        </select>
        <input type="hidden" name="problemId" value={problemId} />
        <input type="hidden" name="mode" value={mode} />
        <button className="md:col-span-2 rounded bg-blue-600 text-white py-2 font-medium hover:bg-blue-700">필터 적용</button>
      </form>

      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        <Badge label="대기" value={queueStats.pending} color="neutral" />
        <Badge label="실행중" value={queueStats.running} color="blue" />
        <Badge label="완료" value={queueStats.completed} color="green" />
        <Badge label="실패" value={queueStats.failed} color="red" />
        <Badge label="전체건수" value={totalCount} color="neutral" />
      </div>

      <div className="rounded-md border border-neutral-700 bg-neutral-900 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-neutral-800 border-b border-neutral-700 font-medium text-neutral-200">
            <tr>
              <th className="px-4 py-3">제출 번호</th>
              <th className="px-4 py-3">아이디</th>
              <th className="px-4 py-3">문제</th>
              <th className="px-4 py-3">결과</th>
              <th className="px-4 py-3">공개</th>
              <th className="px-4 py-3">점수</th>
              <th className="px-4 py-3">메시지</th>
              <th className="px-4 py-3">메모리</th>
              <th className="px-4 py-3">시간</th>
              <th className="px-4 py-3">언어</th>
              <th className="px-4 py-3">코드</th>
              <th className="px-4 py-3">제출 일시</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {submissions.map((sub) => {
              const pendingProgress = sub.status === "PENDING" ? parsePendingProgress(sub.detail) : null;
              const { message: plainDetail } = decodeSubmissionDetail(sub.detail);
              const canView = canViewCode({
                codeVisibility: sub.codeVisibility,
                status: sub.status,
                isOwner: !!currentUserId && currentUserId === sub.userId,
                isAdmin: role === "ADMIN"
              });

              return (
                <tr key={sub.id} className="interactive-row hover:bg-neutral-800/70 transition-colors">
                  <td className="px-4 py-3 font-mono text-neutral-300 text-xs">
                    <Link href={`/status/${sub.id}`} className="hover:underline hover:text-blue-400">
                      {sub.id.substring(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-blue-400">
                    <Link href={`/user/${sub.user.id}`} className="hover:underline">
                      {sub.user?.name || "Unknown"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/problem/${sub.problemId}`} className="font-medium hover:text-blue-400 hover:underline">
                      {sub.problem.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "status-result-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
                        sub.status === "ACCEPTED"
                          ? "status-accepted bg-green-900/40 text-green-300"
                          : sub.status === "PARTIAL"
                            ? "status-partial bg-amber-900/40 text-amber-300"
                            : sub.status === "WRONG_ANSWER"
                              ? "status-wa bg-red-900/40 text-red-300"
                              : sub.status === "PENDING"
                                ? "status-pending bg-neutral-800 text-neutral-200"
                                : "status-error bg-orange-900/40 text-orange-300"
                      )}
                    >
                      {sub.status === "ACCEPTED" && <CheckCircle2 className="w-3 h-3" />}
                      {sub.status === "PARTIAL" && <AlertTriangle className="w-3 h-3" />}
                      {sub.status === "WRONG_ANSWER" && <XCircle className="w-3 h-3" />}
                      {sub.status === "PENDING" && <Clock className="w-3 h-3 animate-spin" />}
                      {(sub.status === "TLE" || sub.status === "MLE" || sub.status === "RUNTIME_ERROR" || sub.status === "COMPILATION_ERROR") && (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      {sub.status}
                      {pendingProgress !== null ? ` ${pendingProgress}%` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium">{getVisibilityLabel(sub.codeVisibility)}</td>
                  <td className="px-4 py-3 text-neutral-300 font-mono text-xs">
                    {typeof sub.totalScore === "number" && typeof sub.maxScore === "number" ? `${sub.totalScore} / ${sub.maxScore}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-neutral-300 text-xs max-w-52 truncate">{plainDetail || "-"}</td>
                  <td className="px-4 py-3 text-neutral-300 font-mono text-xs">{sub.memoryUsed} KB</td>
                  <td className="px-4 py-3 text-neutral-300 font-mono text-xs">{sub.timeUsed} ms</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs uppercase bg-neutral-800 px-2 py-1 rounded inline-block">{sub.language}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {canView ? (
                      <Link href={`/status/${sub.id}`} className="text-blue-400 hover:underline">
                        코드 보기
                      </Link>
                    ) : (
                      <span className="text-neutral-500">비공개</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-300 text-xs">{new Date(sub.createdAt).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-neutral-300">
        <div>
          {currentPage} / {totalPages} 페이지
        </div>
        <div className="flex gap-2">
          <PageLink page={Math.max(1, currentPage - 1)} current={currentPage} params={searchParams}>
            이전
          </PageLink>
          <PageLink page={Math.min(totalPages, currentPage + 1)} current={currentPage} params={searchParams}>
            다음
          </PageLink>
        </div>
      </div>
    </div>
  );
}

function PageLink({
  page,
  current,
  params,
  children
}: {
  page: number;
  current: number;
  params: { [key: string]: string | string[] | undefined };
  children: string;
}) {
  const qp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (typeof v === "string" && v) qp.set(k, v);
  });
  qp.set("page", String(page));
  const disabled = page === current;
  return (
    <Link
      href={`/status?${qp.toString()}`}
      className={cn(
        "rounded border px-3 py-1.5",
        disabled ? "pointer-events-none border-neutral-700 text-neutral-600" : "border-neutral-600 text-neutral-200 hover:bg-neutral-800"
      )}
    >
      {children}
    </Link>
  );
}

function Badge({ label, value, color }: { label: string; value: number; color: "neutral" | "blue" | "green" | "red" }) {
  const colorClass =
    color === "blue"
      ? "bg-blue-900/40 text-blue-300 border-blue-500/40"
      : color === "green"
        ? "bg-green-900/40 text-green-300 border-green-500/40"
        : color === "red"
          ? "bg-red-900/40 text-red-300 border-red-500/40"
          : "bg-neutral-800 text-neutral-200 border-neutral-600";
  return <span className={`rounded-full border px-2.5 py-1 ${colorClass}`}>{label}: {value}</span>;
}
