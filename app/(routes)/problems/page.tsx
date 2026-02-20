import { db } from "@/lib/db";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const DIFFICULTY_OPTIONS = [
    "ALL", "BRONZE_5", "BRONZE_4", "BRONZE_3", "BRONZE_2", "BRONZE_1",
    "SILVER_5", "SILVER_4", "SILVER_3", "SILVER_2", "SILVER_1",
    "GOLD_5", "GOLD_4", "GOLD_3", "GOLD_2", "GOLD_1"
];

type ProblemRow = {
    id: string;
    number: number;
    title: string;
    difficulty: string;
    tags: string;
    description: string;
    createdAt: Date;
    _count: { submissions: number };
    submissions: { id: string }[] | false;
};

function scoreProblem(problem: ProblemRow, q: string) {
    if (!q) return 0;
    const query = q.toLowerCase();
    const title = problem.title.toLowerCase();
    const tags = (problem.tags || "").toLowerCase();
    const desc = (problem.description || "").toLowerCase();

    let score = 0;
    if (title === query) score += 100;
    if (title.startsWith(query)) score += 45;
    if (title.includes(query)) score += 30;
    if (tags.includes(query)) score += 20;
    if (desc.includes(query)) score += 10;

    // small fuzzy bonus for near-miss typos
    if (!title.includes(query) && levenshteinDistance(title.slice(0, Math.max(query.length, 1)), query) <= 1) score += 8;

    return score;
}

function levenshteinDistance(a: string, b: string) {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[a.length][b.length];
}

export default async function TopProblemsPage(props: PageProps) {
    const searchParams = await props.searchParams;
    const query = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
    const difficulty = typeof searchParams.difficulty === "string" ? searchParams.difficulty : "ALL";
    const tag = typeof searchParams.tag === "string" ? searchParams.tag.trim() : "";
    const statusFilter = typeof searchParams.status === "string" ? searchParams.status : "ALL";
    const sort = typeof searchParams.sort === "string" ? searchParams.sort : "number";

    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;

    const base = await db.problem.findMany({
        where: {
            ...(difficulty !== "ALL" ? { difficulty } : {}),
            ...(tag ? { tags: { contains: tag } } : {}),
            ...(statusFilter === "SOLVED" && userId ? { submissions: { some: { userId, status: "ACCEPTED" } } } : {}),
            ...(statusFilter === "UNSOLVED" && userId ? { submissions: { none: { userId, status: "ACCEPTED" } } } : {}),
            ...(query ? {
                OR: [
                    { title: { contains: query } },
                    { description: { contains: query } },
                    { tags: { contains: query } }
                ]
            } : {})
        },
        include: {
            _count: { select: { submissions: { where: { status: "ACCEPTED" } } } },
            submissions: userId ? { where: { userId, status: "ACCEPTED" }, select: { id: true }, take: 1 } : false
        },
        take: 500
    });

    let problems = base as ProblemRow[];
    if (query) {
        problems = problems
            .map((p) => ({ p, score: scoreProblem(p, query) }))
            .sort((a, b) => b.score - a.score || a.p.number - b.p.number)
            .map((v) => v.p);
    } else if (sort === "newest") {
        problems = [...problems].sort((a, b) => +b.createdAt - +a.createdAt);
    } else if (sort === "solved") {
        problems = [...problems].sort((a, b) => b._count.submissions - a._count.submissions || a.number - b.number);
    } else {
        problems = [...problems].sort((a, b) => a.number - b.number);
    }

    return (
        <div className="container mx-auto py-10 px-4">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold tracking-tight">문제 목록</h1>
            </div>

            <form className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-2">
                <input name="q" defaultValue={query} placeholder="문제명/본문/태그 검색" className="rounded border border-neutral-700 bg-neutral-900 text-neutral-100 px-3 py-2" />
                <select name="difficulty" defaultValue={difficulty} className="rounded border border-neutral-700 bg-neutral-900 text-neutral-100 px-3 py-2">
                    {DIFFICULTY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <input name="tag" defaultValue={tag} placeholder="태그 필터" className="rounded border border-neutral-700 bg-neutral-900 text-neutral-100 px-3 py-2" />
                <select name="status" defaultValue={statusFilter} className="rounded border border-neutral-700 bg-neutral-900 text-neutral-100 px-3 py-2">
                    <option value="ALL">전체</option>
                    <option value="SOLVED">해결한 문제</option>
                    <option value="UNSOLVED">미해결 문제</option>
                </select>
                <select name="sort" defaultValue={sort} className="rounded border border-neutral-700 bg-neutral-900 text-neutral-100 px-3 py-2">
                    <option value="number">번호순</option>
                    <option value="newest">최신순</option>
                    <option value="solved">많이 푼 순</option>
                </select>
                <button className="md:col-span-5 rounded bg-blue-600 text-white py-2 font-medium hover:bg-blue-700">필터 적용</button>
            </form>

            <div className="rounded-md border border-neutral-700 bg-neutral-900 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-neutral-800 text-neutral-200 font-medium border-b border-neutral-700">
                        <tr>
                            <th className="px-6 py-4 w-[100px]">번호</th>
                            <th className="px-6 py-4">제목</th>
                            <th className="px-6 py-4 w-[140px] text-center">난이도</th>
                            <th className="px-6 py-4 w-[160px] text-center">태그</th>
                            <th className="px-6 py-4 w-[120px] text-center">맞은 사람</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {problems.map((problem) => {
                            const solved = Array.isArray(problem.submissions) && problem.submissions.length > 0;
                            return (
                                <tr key={problem.id} className="problem-row interactive-row hover:bg-neutral-800/70 transition-colors">
                                    <td className="px-6 py-4 font-mono text-neutral-300">{problem.number}</td>
                                    <td className="px-6 py-4">
                                        <Link href={`/problem/${problem.id}`} className="font-medium hover:text-blue-400 hover:underline">{problem.title}</Link>
                                        {solved && <span className="ml-2 text-xs text-green-400">해결됨</span>}
                                    </td>
                                    <td className="px-6 py-4 text-center text-xs"><span className="bg-neutral-800 px-2 py-1 rounded">{problem.difficulty}</span></td>
                                    <td className="px-6 py-4 text-center text-xs text-neutral-300">{problem.tags || "-"}</td>
                                    <td className="px-6 py-4 text-center font-mono">{problem._count.submissions}</td>
                                </tr>
                            );
                        })}
                        {problems.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-neutral-300">등록된 문제가 없습니다.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
