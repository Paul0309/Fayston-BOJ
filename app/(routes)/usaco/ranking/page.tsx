import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const DIV_RANK: Record<string, number> = {
  Bronze: 0,
  Silver: 1,
  Gold: 2,
  Platinum: 3
};

type Row = {
  userId: string;
  username: string;
  division: string;
  total: number;
  accepted: number;
  solvedUnique: number;
  rate: number;
};

export default async function UsacoRankingPage() {
  const session = await getServerSession(authOptions);
  const me = getSessionUser(session);

  const users = await db.user.findMany({
    select: { id: true, name: true, division: true },
    orderBy: { createdAt: "asc" }
  });

  const submissions = await db.submission.findMany({
    where: { problem: { tags: { contains: "usaco" } } },
    select: { userId: true, problemId: true, status: true }
  });

  const agg = new Map<string, { total: number; accepted: number; solved: Set<string> }>();
  for (const s of submissions) {
    const prev = agg.get(s.userId) || { total: 0, accepted: 0, solved: new Set<string>() };
    prev.total += 1;
    if (s.status === "ACCEPTED") {
      prev.accepted += 1;
      prev.solved.add(s.problemId);
    }
    agg.set(s.userId, prev);
  }

  const rows: Row[] = users
    .map((u) => {
      const stat = agg.get(u.id);
      const total = stat?.total || 0;
      const accepted = stat?.accepted || 0;
      const solvedUnique = stat?.solved.size || 0;
      const rate = total > 0 ? accepted / total : 0;
      return {
        userId: u.id,
        username: u.name || "User",
        division: u.division || "Bronze",
        total,
        accepted,
        solvedUnique,
        rate
      };
    })
    .sort((a, b) => {
      const divDiff = (DIV_RANK[b.division] ?? -1) - (DIV_RANK[a.division] ?? -1);
      if (divDiff !== 0) return divDiff;
      return b.rate - a.rate;
    });

  return (
    <div className="usaco-page-wrap">
      <div className="usaco-page-head">
        <h1>Global Ranking</h1>
        <p>Sorted by division first, then acceptance rate.</p>
      </div>

      <div className="usaco-card usaco-table-wrap">
        <table className="usaco-table">
          <thead>
            <tr>
              <th>#</th>
              <th>User</th>
              <th>Division</th>
              <th>Accepted</th>
              <th>Total</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isMe = me.id === row.userId;
              return (
                <tr key={row.userId} className={isMe ? "me" : ""}>
                  <td>{idx + 1}</td>
                  <td>
                    <Link href={`/user/${row.userId}`}>{row.username}</Link>
                  </td>
                  <td>{row.division}</td>
                  <td>{row.accepted}</td>
                  <td>{row.total}</td>
                  <td>{Math.round(row.rate * 100)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
