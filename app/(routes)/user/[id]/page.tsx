import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { withDbRetry } from "@/lib/db-retry";

interface PageProps {
  params: Promise<{ id: string }>;
}

type LanguageStat = { language: string; total: number; accepted: number };
type DifficultyStat = { difficulty: string; solved: number };
type DailyActivityRow = { day: string; count: number };
type HeatmapCell = { key: string; count: number; inYear: boolean };

export const dynamic = "force-dynamic";

function toDateKeyUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildYearHeatmap(year: number, dailyCountMap: Map<string, number>) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const gridStart = new Date(yearStart);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(yearEnd);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const weeks: HeatmapCell[][] = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const week: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const key = toDateKeyUtc(cursor);
      const inYear = cursor.getUTCFullYear() === year;
      week.push({
        key,
        count: inYear ? dailyCountMap.get(key) || 0 : 0,
        inYear
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }

  const monthStarts: Array<{ month: string; weekIndex: number }> = [];
  for (let m = 0; m < 12; m++) {
    const firstDay = new Date(Date.UTC(year, m, 1));
    const diffDays = Math.floor((firstDay.getTime() - gridStart.getTime()) / 86400000);
    monthStarts.push({
      month: `${m + 1}월`,
      weekIndex: Math.floor(diffDays / 7)
    });
  }

  const allCounts = Array.from(dailyCountMap.values());
  const maxCount = Math.max(0, ...allCounts);
  const totalAccepted = allCounts.reduce((a, b) => a + b, 0);
  const activeDays = allCounts.filter((c) => c > 0).length;

  return { weeks, monthStarts, maxCount, totalAccepted, activeDays };
}

function levelClass(count: number, maxCount: number, inYear: boolean) {
  if (!inYear) return "bg-neutral-900";
  if (count <= 0) return "bg-neutral-800";
  if (maxCount <= 1) return "bg-emerald-500";
  const ratio = count / maxCount;
  if (ratio < 0.25) return "bg-emerald-900";
  if (ratio < 0.5) return "bg-emerald-700";
  if (ratio < 0.75) return "bg-emerald-600";
  return "bg-emerald-500";
}

export default async function UserProfilePage(props: PageProps) {
  const { id } = await props.params;
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(Date.UTC(currentYear, 0, 1));
  const nextYearStart = new Date(Date.UTC(currentYear + 1, 0, 1));

  const user = await withDbRetry(() =>
    db.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, division: true, solvedCount: true, createdAt: true }
    })
  );
  if (!user) return notFound();

  const [
    totalSubmissions,
    acceptedSubmissions,
    publicSubmissions,
    recentSubmissions,
    acceptedHistory,
    languageStatsRaw,
    difficultyStatsRaw,
    activityRows,
    yearAcceptedRows,
    tagStatsRaw
  ] = await Promise.all([
    withDbRetry(() => db.submission.count({ where: { userId: id, NOT: { detail: { contains: '"hiddenInStatus":true' } } } })),
    withDbRetry(() =>
      db.submission.count({ where: { userId: id, status: "ACCEPTED", NOT: { detail: { contains: '"hiddenInStatus":true' } } } })
    ),
    withDbRetry(() =>
      db.submission.count({
        where: {
          userId: id,
          NOT: { detail: { contains: '"hiddenInStatus":true' } },
          OR: [{ codeVisibility: "PUBLIC" }, { codeVisibility: "ACCEPTED_ONLY", status: "ACCEPTED" }]
        }
      })
    ),
    withDbRetry(() =>
      db.submission.findMany({
        where: { userId: id, NOT: { detail: { contains: '"hiddenInStatus":true' } } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          status: true,
          language: true,
          createdAt: true,
          totalScore: true,
          maxScore: true,
          problem: { select: { id: true, number: true, title: true } }
        }
      })
    ),
    withDbRetry(() =>
      db.submission.findMany({
        where: { userId: id, status: "ACCEPTED", NOT: { detail: { contains: '"hiddenInStatus":true' } } },
        orderBy: { createdAt: "desc" },
        select: { problemId: true, createdAt: true }
      })
    ),
    withDbRetry(() => db.$queryRaw<Array<{ language: string; total: bigint | number; accepted: bigint | number }>>`
      SELECT
        "language",
        COUNT(*) AS "total",
        SUM(CASE WHEN "status" = 'ACCEPTED' THEN 1 ELSE 0 END) AS "accepted"
      FROM "Submission"
      WHERE "userId" = ${id}
        AND ("detail" IS NULL OR "detail" NOT LIKE '%"hiddenInStatus":true%')
      GROUP BY "language"
      ORDER BY "total" DESC
    `),
    withDbRetry(() => db.$queryRaw<Array<{ difficulty: string; solved: bigint | number }>>`
      SELECT
        p."difficulty" as "difficulty",
        COUNT(DISTINCT s."problemId") as "solved"
      FROM "Submission" s
      JOIN "Problem" p ON p."id" = s."problemId"
      WHERE s."userId" = ${id}
        AND s."status" = 'ACCEPTED'
        AND (s."detail" IS NULL OR s."detail" NOT LIKE '%"hiddenInStatus":true%')
      GROUP BY p."difficulty"
      ORDER BY "solved" DESC
    `),
    withDbRetry(() => db.$queryRaw<Array<{ day: string; count: bigint | number }>>`
      SELECT
        TO_CHAR(DATE("createdAt"), 'YYYY-MM-DD') as "day",
        COUNT(*) as "count"
      FROM "Submission"
      WHERE "userId" = ${id}
        AND ("detail" IS NULL OR "detail" NOT LIKE '%"hiddenInStatus":true%')
        AND "createdAt" >= (NOW() - INTERVAL '59 days')
      GROUP BY TO_CHAR(DATE("createdAt"), 'YYYY-MM-DD')
      ORDER BY "day" ASC
    `),
    withDbRetry(() => db.$queryRaw<Array<{ day: string; count: bigint | number }>>`
      SELECT
        TO_CHAR(DATE("createdAt"), 'YYYY-MM-DD') as "day",
        COUNT(*) as "count"
      FROM "Submission"
      WHERE "userId" = ${id}
        AND "status" = 'ACCEPTED'
        AND ("detail" IS NULL OR "detail" NOT LIKE '%"hiddenInStatus":true%')
        AND "createdAt" >= ${yearStart}
        AND "createdAt" < ${nextYearStart}
      GROUP BY TO_CHAR(DATE("createdAt"), 'YYYY-MM-DD')
      ORDER BY "day" ASC
    `),
    withDbRetry(() => db.$queryRaw<Array<{ tags: string; solved: bigint | number }>>`
      SELECT
        p."tags" as "tags",
        COUNT(DISTINCT p."id") as "solved"
      FROM "Submission" s
      JOIN "Problem" p ON p."id" = s."problemId"
      WHERE s."userId" = ${id}
        AND s."status" = 'ACCEPTED'
        AND (s."detail" IS NULL OR s."detail" NOT LIKE '%"hiddenInStatus":true%')
      GROUP BY p."tags"
    `)
  ]);

  const languageStats: LanguageStat[] = languageStatsRaw.map((row) => ({
    language: row.language,
    total: Number(row.total),
    accepted: Number(row.accepted)
  }));

  const difficultyStats: DifficultyStat[] = difficultyStatsRaw.map((row) => ({
    difficulty: row.difficulty,
    solved: Number(row.solved)
  }));

  const tagScoreMap = new Map<string, number>();
  for (const row of tagStatsRaw) {
    const solved = Number(row.solved);
    String(row.tags || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .forEach((tag) => tagScoreMap.set(tag, (tagScoreMap.get(tag) || 0) + solved));
  }
  const topTags = [...tagScoreMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const activityMap = new Map<string, number>();
  for (const row of activityRows) activityMap.set(row.day, Number(row.count));
  const yearAcceptedMap = new Map<string, number>();
  for (const row of yearAcceptedRows) yearAcceptedMap.set(row.day, Number(row.count));

  const today = new Date();
  const activitySeries: DailyActivityRow[] = [];
  for (let i = 59; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    activitySeries.push({ day: key, count: activityMap.get(key) || 0 });
  }
  const maxActivity = Math.max(1, ...activitySeries.map((d) => d.count));

  let streak = 0;
  for (let i = activitySeries.length - 1; i >= 0; i--) {
    if (activitySeries[i].count > 0) streak++;
    else break;
  }

  const solvedMap = new Map<string, Date>();
  for (const row of acceptedHistory) {
    if (!solvedMap.has(row.problemId)) solvedMap.set(row.problemId, row.createdAt);
  }
  const solvedIds = [...solvedMap.keys()];
  const solvedProblems = solvedIds.length
    ? await withDbRetry(() =>
        db.problem.findMany({ where: { id: { in: solvedIds } }, select: { id: true, number: true, title: true, difficulty: true } })
      )
    : [];
  const solvedById = new Map(solvedProblems.map((p) => [p.id, p]));

  const heatmap = buildYearHeatmap(currentYear, yearAcceptedMap);

  return (
    <div className="container mx-auto py-10 px-4 space-y-8">
      <div className="rounded-md border border-neutral-700 bg-neutral-900 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-700">
          <h1 className="text-2xl font-bold">{user.name || "Unknown User"}</h1>
          <div className="text-sm text-neutral-300 mt-1">{user.email}</div>
          <div className="text-sm text-neutral-300 mt-1">Division: {user.division || "Bronze"}</div>
          <div className="text-xs text-neutral-300 mt-1">가입일: {new Date(user.createdAt).toLocaleDateString()}</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-neutral-700">
          <Stat label="해결한 문제" value={String(user.solvedCount)} />
          <Stat label="총 제출" value={String(totalSubmissions)} />
          <Stat label="정답 제출" value={String(acceptedSubmissions)} />
          <Stat label="공개 제출" value={String(publicSubmissions)} />
          <Stat label="연속 제출일" value={`${streak}일`} />
        </div>
      </div>

      <section className="rounded-md border border-neutral-700 bg-neutral-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{currentYear}년 정답 활동</h2>
          <div className="text-xs text-neutral-300">
            정답 제출 {heatmap.totalAccepted}회, 활동일 {heatmap.activeDays}일
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="inline-block min-w-max">
            <div className="relative h-5 ml-8 mb-1 text-[11px] text-neutral-400">
              {heatmap.monthStarts.map((m) => (
                <span key={m.month} className="absolute" style={{ left: `${m.weekIndex * 14}px` }}>
                  {m.month}
                </span>
              ))}
            </div>

            <div className="flex">
              <div className="mr-2 flex flex-col gap-[2px] text-[10px] text-neutral-400">
                {["일", "월", "화", "수", "목", "금", "토"].map((d, idx) => (
                  <div key={d} className="h-3 leading-3">
                    {idx % 2 === 1 ? d : ""}
                  </div>
                ))}
              </div>

              <div className="flex gap-[2px]">
                {heatmap.weeks.map((week, widx) => (
                  <div key={widx} className="flex flex-col gap-[2px]">
                    {week.map((cell) => (
                      <div
                        key={cell.key}
                        className={`h-3 w-3 rounded-[2px] ${levelClass(cell.count, heatmap.maxCount, cell.inYear)}`}
                        title={`${cell.key} · 정답 ${cell.count}회`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-neutral-400">
          <span>적음</span>
          <span className="h-3 w-3 rounded-[2px] bg-neutral-800" />
          <span className="h-3 w-3 rounded-[2px] bg-emerald-900" />
          <span className="h-3 w-3 rounded-[2px] bg-emerald-700" />
          <span className="h-3 w-3 rounded-[2px] bg-emerald-600" />
          <span className="h-3 w-3 rounded-[2px] bg-emerald-500" />
          <span>많음</span>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-md border border-neutral-700 bg-neutral-900 p-4">
          <h2 className="font-semibold mb-3">언어별 정답률</h2>
          <div className="space-y-2">
            {languageStats.map((row) => {
              const ratio = row.total > 0 ? Math.round((row.accepted / row.total) * 100) : 0;
              return (
                <div key={row.language}>
                  <div className="flex justify-between text-xs text-neutral-300 mb-1">
                    <span className="uppercase">{row.language}</span>
                    <span>
                      {row.accepted}/{row.total} ({ratio}%)
                    </span>
                  </div>
                  <div className="h-2 rounded bg-neutral-800 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${ratio}%` }} />
                  </div>
                </div>
              );
            })}
            {languageStats.length === 0 && <div className="text-sm text-neutral-300">제출 데이터가 없습니다.</div>}
          </div>
        </div>

        <div className="rounded-md border border-neutral-700 bg-neutral-900 p-4">
          <h2 className="font-semibold mb-3">난이도별 해결 수</h2>
          <div className="space-y-2">
            {difficultyStats.map((row) => (
              <div key={row.difficulty} className="flex items-center justify-between text-sm">
                <span className="text-neutral-300">{row.difficulty}</span>
                <span className="font-mono text-neutral-100">{row.solved}</span>
              </div>
            ))}
            {difficultyStats.length === 0 && <div className="text-sm text-neutral-300">해결 데이터가 없습니다.</div>}
          </div>
        </div>

        <div className="rounded-md border border-neutral-700 bg-neutral-900 p-4">
          <h2 className="font-semibold mb-3">상위 태그 경험</h2>
          <div className="space-y-2">
            {topTags.map(([tag, score]) => (
              <div key={tag} className="flex items-center justify-between text-sm">
                <span className="text-neutral-300">{tag}</span>
                <span className="font-mono text-neutral-100">{score}</span>
              </div>
            ))}
            {topTags.length === 0 && <div className="text-sm text-neutral-300">태그 데이터가 없습니다.</div>}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-neutral-700 bg-neutral-900 p-4">
        <h2 className="font-semibold mb-3">최근 60일 활동</h2>
        <div className="flex items-end gap-1 h-24">
          {activitySeries.map((row) => (
            <div
              key={row.day}
              className="flex-1 bg-neutral-800 rounded-sm relative group"
              style={{ height: `${Math.max(6, Math.round((row.count / maxActivity) * 100))}%` }}
            >
              <span className="hidden group-hover:block absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] px-1 py-0.5 rounded bg-neutral-950 border border-neutral-700 whitespace-nowrap">
                {row.day.slice(5)}: {row.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-neutral-700 bg-neutral-900 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-700 font-semibold">최근 제출</div>
        <table className="w-full text-sm">
          <thead className="bg-neutral-800 text-neutral-200">
            <tr>
              <th className="px-4 py-3 text-left">문제</th>
              <th className="px-4 py-3 text-left">결과</th>
              <th className="px-4 py-3 text-left">점수</th>
              <th className="px-4 py-3 text-left">언어</th>
              <th className="px-4 py-3 text-left">제출 시각</th>
            </tr>
          </thead>
          <tbody>
            {recentSubmissions.map((sub) => (
              <tr key={sub.id} className="border-t border-neutral-700">
                <td className="px-4 py-3">
                  <Link href={`/problem/${sub.problem.id}`} className="hover:underline hover:text-blue-400">
                    {sub.problem.number} - {sub.problem.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/status/${sub.id}`} className="hover:underline hover:text-blue-400">
                    {sub.status}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {typeof sub.totalScore === "number" && typeof sub.maxScore === "number"
                    ? `${sub.totalScore} / ${sub.maxScore}`
                    : "-"}
                </td>
                <td className="px-4 py-3 uppercase font-mono text-xs">{sub.language}</td>
                <td className="px-4 py-3 text-xs text-neutral-300">{new Date(sub.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {recentSubmissions.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-neutral-300" colSpan={5}>
                  아직 제출 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-md border border-neutral-700 bg-neutral-900 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-700 font-semibold">해결한 문제</div>
        <table className="w-full text-sm">
          <thead className="bg-neutral-800 text-neutral-200">
            <tr>
              <th className="px-4 py-3 text-left">번호</th>
              <th className="px-4 py-3 text-left">제목</th>
              <th className="px-4 py-3 text-left">난이도</th>
              <th className="px-4 py-3 text-left">해결 시각</th>
            </tr>
          </thead>
          <tbody>
            {solvedIds.map((problemId) => {
              const problem = solvedById.get(problemId);
              if (!problem) return null;
              return (
                <tr key={problemId} className="border-t border-neutral-700">
                  <td className="px-4 py-3 font-mono">{problem.number}</td>
                  <td className="px-4 py-3">
                    <Link href={`/problem/${problem.id}`} className="hover:underline hover:text-blue-400">
                      {problem.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{problem.difficulty}</td>
                  <td className="px-4 py-3 text-xs text-neutral-300">{solvedMap.get(problemId)?.toLocaleString()}</td>
                </tr>
              );
            })}
            {solvedIds.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-neutral-300" colSpan={4}>
                  아직 해결한 문제가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-4">
      <div className="text-xs text-neutral-300">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
