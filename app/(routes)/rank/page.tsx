import { db } from "@/lib/db";
import { Trophy, Medal, User } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RankPage() {
    const users = await db.user.findMany({
        orderBy: { solvedCount: "desc" },
        take: 100,
        select: { id: true, name: true, email: true, solvedCount: true }
    });

    return (
        <div className="container mx-auto py-10 px-4">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2"><Trophy className="w-8 h-8 text-yellow-500" />학교 랭킹</h1>

            <div className="rounded-md border border-neutral-700 bg-neutral-900 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-neutral-800 text-neutral-200 font-medium border-b border-neutral-700">
                        <tr><th className="px-6 py-4 w-[100px] text-center">순위</th><th className="px-6 py-4">사용자</th><th className="px-6 py-4 text-right">해결한 문제</th></tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {users.map((user, index) => {
                            let RankIcon = null;
                            if (index === 0) RankIcon = <Trophy className="w-5 h-5 text-yellow-500" />;
                            else if (index === 1) RankIcon = <Medal className="w-5 h-5 text-gray-400" />;
                            else if (index === 2) RankIcon = <Medal className="w-5 h-5 text-amber-600" />;

                            return (
                                <tr key={user.id} className="hover:bg-neutral-800/70 transition-colors">
                                    <td className="px-6 py-4 text-center font-mono text-neutral-200 font-bold"><div className="flex justify-center items-center gap-2">{RankIcon}{index + 1}</div></td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-neutral-800 p-2 rounded-full"><User className="w-4 h-4 text-neutral-200" /></div>
                                            <Link href={`/user/${user.id}`} className="font-medium text-neutral-100 hover:text-blue-400 hover:underline">{user.name || "Unknown User"}</Link>
                                            <div className="text-xs text-neutral-300 hidden sm:block">{user.email}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-blue-400">{user.solvedCount}</td>
                                </tr>
                            );
                        })}
                        {users.length === 0 && <tr><td colSpan={3} className="px-6 py-12 text-center text-neutral-300">아직 랭킹 정보가 없습니다.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
