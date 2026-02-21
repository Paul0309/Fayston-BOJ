import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { withDbRetry } from "@/lib/db-retry";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { checkUserUsacoPromotionEligibility } from "@/lib/usaco/promotion";
import UsacoPromotionButton from "@/components/UsacoPromotionButton";
import LazyRecentSubmissionList from "@/components/profile/LazyRecentSubmissionList";
import LazySolvedProblemList from "@/components/profile/LazySolvedProblemList";

interface PageProps {
  params: Promise<{ id: string }>;
}

type LanguageStat = { language: string; total: number; accepted: number };
type DifficultyStat = { difficulty: string; solved: number };
type DailyActivityRow = { day: string; count: number };
type HeatmapCell = { key: string; count: number; inYear: boolean };
type SolvedProblemRow = { problemId: string; number: number; solvedAt: Date };

const RECENT_SUBMISSION_SIZE = 240;
const SOLVED_FETCH_SIZE = 240;

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
      month: `${m + 1}\uC6D4`,
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
  const session = await getServerSession(authOptions);
  const viewerId = getSessionUser(session).id;
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

  const isMe = !!viewerId && viewerId === user.id;
  const promotionPromise = isMe ? checkUserUsacoPromotionEligibility(user.id) : Promise.resolve(null);

  const [
    promotionInfo,
    totalSubmissions,
    acceptedSubmissions,
    publicSubmissions,
    recentSubmissions,
    solvedRows,
    languageStatsRaw,
    difficultyStatsRaw,
    activityRows,
    yearAcceptedRows,
    tagStatsRaw
  ] = await Promise.all([
    promotionPromise,
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
        take: RECENT_SUBMISSION_SIZE,
        select: { id: true, createdAt: true, problem: { select: { id: true, number: true } } }
      })
    ),
    withDbRetry(() => db.$queryRaw<SolvedProblemRow[]>`
      SELECT
        p."id" AS "problemId",
        p."number" AS "number",
        MAX(s."createdAt") AS "solvedAt"
      FROM "Submission" s
      JOIN "Problem" p ON p."id" = s."problemId"
      WHERE s."userId" = ${id}
        AND s."status" = 'ACCEPTED'
        AND (s."detail" IS NULL OR s."detail" NOT LIKE '%"hiddenInStatus":true%')
      GROUP BY p."id", p."number"
      ORDER BY MAX(s."createdAt") DESC
      LIMIT ${SOLVED_FETCH_SIZE}
    `),
    withDbRetry(() => db.$queryRaw<Array<{ language: string; total: bigint | number; accepted: bigint | number }>>`
      SELECT "language", COUNT(*) AS "total", SUM(CASE WHEN "status" = 'ACCEPTED' THEN 1 ELSE 0 END) AS "accepted"
      FROM "Submission"
      WHERE "userId" = ${id}
        AND ("detail" IS NULL OR "detail" NOT LIKE '%"hiddenInStatus":true%')
      GROUP BY "language"
      ORDER BY "total" DESC
    `),
    withDbRetry(() => db.$queryRaw<Array<{ difficulty: string; solved: bigint | number }>>`
      SELECT p."difficulty" as "difficulty", COUNT(DISTINCT s."problemId") as "solved"
      FROM "Submission" s
      JOIN "Problem" p ON p."id" = s."problemId"
      WHERE s."userId" = ${id}
        AND s."status" = 'ACCEPTED'
        AND (s."detail" IS NULL OR s."detail" NOT LIKE '%"hiddenInStatus":true%')
      GROUP BY p."difficulty"
      ORDER BY "solved" DESC
    `),
    withDbRetry(() => db.$queryRaw<Array<{ day: string; count: bigint | number }>>`
      SELECT TO_CHAR(DATE("createdAt"), 'YYYY-MM-DD') as "day", COUNT(*) as "count"
      FROM "Submission"
      WHERE "userId" = ${id}
        AND ("detail" IS NULL OR "detail" NOT LIKE '%"hiddenInStatus":true%')
        AND "createdAt" >= (NOW() - INTERVAL '59 days')
      GROUP BY TO_CHAR(DATE("createdAt"), 'YYYY-MM-DD')
      ORDER BY "day" ASC
    `),
    withDbRetry(() => db.$queryRaw<Array<{ day: string; count: bigint | number }>>`
      SELECT TO_CHAR(DATE("createdAt"), 'YYYY-MM-DD') as "day", COUNT(*) as "count"
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
      SELECT p."tags" as "tags", COUNT(DISTINCT p."id") as "solved"
      FROM "Submission" s
      JOIN "Problem" p ON p."id" = s."problemId"
      WHERE s."userId" = ${id}
        AND s."status" = 'ACCEPTED'
        AND (s."detail" IS NULL OR s."detail" NOT LIKE '%"hiddenInStatus":true%')
      GROUP BY p."tags"
    `)
  ]);

  const languageStats: LanguageStat[] = languageStatsRaw.map((row) => ({ language: row.language, total: Number(row.total), accepted: Number(row.accepted) }));
  const difficultyStats: DifficultyStat[] = difficultyStatsRaw.map((row) => ({ difficulty: row.difficulty, solved: Number(row.solved) }));

  const tagScoreMap = new Map<string, number>();
  for (const row of tagStatsRaw) {
    const solved = Number(row.solved);
    String(row.tags || "").split(",").map((v) => v.trim()).filter(Boolean).forEach((tag) => tagScoreMap.set(tag, (tagScoreMap.get(tag) || 0) + solved));
  }
  const topTags = [...tagScoreMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const activityMap = new Map<string, number>();
  for (const row of activityRows) activityMap.set(row.day, Number(row.count));
  const yearAcceptedMap = new Map<string, number>();
  for (const row of yearAcceptedRows) yearAcceptedMap.set(row.day, Number(row.count));

  const activitySeries: DailyActivityRow[] = [];
  const today = new Date();
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

  const recentSubmissionItems = recentSubmissions.map((sub) => ({ submissionId: sub.id, problemId: sub.problem.id, problemNumber: sub.problem.number, submittedAt: sub.createdAt.toISOString() }));
  const solvedProblemItems = solvedRows.map((row) => ({ problemId: row.problemId, problemNumber: row.number, solvedAt: new Date(row.solvedAt).toISOString() }));

  const heatmap = buildYearHeatmap(currentYear, yearAcceptedMap);

  return (
    <div className="container mx-auto space-y-8 px-4 py-10">
      <div className="overflow-hidden rounded-md border border-neutral-700 bg-neutral-900 shadow-sm">
        <div className="border-b border-neutral-700 px-6 py-5">
          <h1 className="text-2xl font-bold">{user.name || "Unknown User"}</h1>
          <div className="mt-1 text-sm text-neutral-300">{user.email}</div>
          <div className="mt-1 text-sm text-neutral-300">Division: {user.division || "Bronze"}</div>
          {isMe && promotionInfo ? <UsacoPromotionButton eligible={promotionInfo.eligible} canPromote={promotionInfo.canPromote} message={promotionInfo.message} /> : null}
          <div className="mt-1 text-xs text-neutral-300">{"\uAC00\uC785\uC77C"}: {new Date(user.createdAt).toLocaleDateString()}</div>
        </div>
        <div className="grid grid-cols-1 divide-y divide-neutral-700 md:grid-cols-5 md:divide-x md:divide-y-0">
          <Stat label={"\uD574\uACB0\uD55C \uBB38\uC81C"} value={String(user.solvedCount)} />
          <Stat label={"\uCD1D \uC81C\uCD9C"} value={String(totalSubmissions)} />
          <Stat label={"\uC815\uB2F5 \uC81C\uCD9C"} value={String(acceptedSubmissions)} />
          <Stat label={"\uACF5\uAC1C \uC81C\uCD9C"} value={String(publicSubmissions)} />
          <Stat label={"\uC5F0\uC18D \uC81C\uCD9C\uC77C"} value={`${streak}\uC77C`} />
        </div>
      </div>

      <section className="profile-activity-card rounded-md border border-neutral-700 bg-neutral-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{currentYear}{"\uB144 \uC815\uB2F5 \uD65C\uB3D9"}</h2>
          <div className="text-xs text-neutral-300">{"\uC815\uB2F5 \uC81C\uCD9C"} {heatmap.totalAccepted}{"\uD68C, \uD65C\uB3D9\uC77C "}{heatmap.activeDays}{"\uC77C"}</div>
        </div>

        <div className="overflow-x-auto">
          <div className="inline-block min-w-max">
            <div className="relative mb-1 ml-8 h-5 text-[11px] text-neutral-400">
              {heatmap.monthStarts.map((m) => (
                <span key={m.month} className="absolute" style={{ left: `${m.weekIndex * 14}px` }}>{m.month}</span>
              ))}
            </div>
            <div className="flex">
              <div className="mr-2 flex flex-col gap-[2px] text-[10px] text-neutral-400">
                {["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"].map((d, idx) => (
                  <div key={d} className="h-3 leading-3">{idx % 2 === 1 ? d : ""}</div>
                ))}
              </div>
              <div className="flex gap-[2px]">
                {heatmap.weeks.map((week, widx) => (
                  <div key={widx} className="profile-activity-week flex flex-col gap-[2px]">
                    {week.map((cell) => (
                      <div key={cell.key} className={`profile-activity-cell h-3 w-3 rounded-[2px] ${levelClass(cell.count, heatmap.maxCount, cell.inYear)}`} title={`${cell.key} - ${cell.count}`} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-neutral-400">
          <span>{"\uC801\uC74C"}</span>
          <span className="h-3 w-3 rounded-[2px] bg-neutral-800" />
          <span className="h-3 w-3 rounded-[2px] bg-emerald-900" />
          <span className="h-3 w-3 rounded-[2px] bg-emerald-700" />
          <span className="h-3 w-3 rounded-[2px] bg-emerald-600" />
          <span className="h-3 w-3 rounded-[2px] bg-emerald-500" />
          <span>{"\uB9CE\uC74C"}</span>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-neutral-700 bg-neutral-900 p-4">
          <h2 className="mb-3 font-semibold">{"\uC5B8\uC5B4\uBCC4 \uC815\uB2F5\uB960"}</h2>
          <div className="space-y-2">
            {languageStats.map((row) => {
              const ratio = row.total > 0 ? Math.round((row.accepted / row.total) * 100) : 0;
              return (
                <div key={row.language}>
                  <div className="mb-1 flex justify-between text-xs text-neutral-300">
                    <span className="uppercase">{row.language}</span>
                    <span>{row.accepted}/{row.total} ({ratio}%)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-neutral-800"><div className="h-full bg-emerald-500" style={{ width: `${ratio}%` }} /></div>
                </div>
              );
            })}
            {languageStats.length === 0 ? <div className="text-sm text-neutral-300">{"\uC81C\uCD9C \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}</div> : null}
          </div>
        </div>

        <div className="rounded-md border border-neutral-700 bg-neutral-900 p-4">
          <h2 className="mb-3 font-semibold">{"\uB09C\uC774\uB3C4\uBCC4 \uD574\uACB0 \uC218"}</h2>
          <div className="space-y-2">
            {difficultyStats.map((row) => (
              <div key={row.difficulty} className="flex items-center justify-between text-sm"><span className="text-neutral-300">{row.difficulty}</span><span className="font-mono text-neutral-100">{row.solved}</span></div>
            ))}
            {difficultyStats.length === 0 ? <div className="text-sm text-neutral-300">{"\uD574\uACB0 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}</div> : null}
          </div>
        </div>

        <div className="rounded-md border border-neutral-700 bg-neutral-900 p-4">
          <h2 className="mb-3 font-semibold">{"\uC0C1\uC704 \uD0DC\uADF8 \uACBD\uD5D8"}</h2>
          <div className="space-y-2">
            {topTags.map(([tag, score]) => (
              <div key={tag} className="flex items-center justify-between text-sm"><span className="text-neutral-300">{tag}</span><span className="font-mono text-neutral-100">{score}</span></div>
            ))}
            {topTags.length === 0 ? <div className="text-sm text-neutral-300">{"\uD0DC\uADF8 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}</div> : null}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-neutral-700 bg-neutral-900 p-4">
        <h2 className="mb-3 font-semibold">{"\uCD5C\uADFC 60\uC77C \uD65C\uB3D9"}</h2>
        <div className="flex h-24 items-end gap-1">
          {activitySeries.map((row) => (
            <div key={row.day} className="group relative flex-1 rounded-sm bg-neutral-800" style={{ height: `${Math.max(6, Math.round((row.count / maxActivity) * 100))}%` }}>
              <span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5 text-[10px] group-hover:block">{row.day.slice(5)}: {row.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-neutral-700 bg-neutral-900 shadow-sm">
        <LazyRecentSubmissionList title={"\uCD5C\uADFC \uC81C\uCD9C"} items={recentSubmissionItems} />
      </section>
      <section className="overflow-hidden rounded-md border border-neutral-700 bg-neutral-900 shadow-sm">
        <LazySolvedProblemList title={"\uD574\uACB0\uD55C \uBB38\uC81C"} items={solvedProblemItems} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-4">
      <div className="text-xs text-neutral-300">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
