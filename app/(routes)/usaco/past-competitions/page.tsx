import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Division = "Bronze" | "Silver" | "Gold" | "Platinum";

const COMPETITIONS = [
  { id: "2024-dec-2nd-week", label: "2024 December 2nd Week" }
];

function getDivision(tags: string): Division {
  const lower = tags.toLowerCase();
  if (lower.includes("division:platinum")) return "Platinum";
  if (lower.includes("division:gold")) return "Gold";
  if (lower.includes("division:silver")) return "Silver";
  return "Bronze";
}

export default async function UsacoPastCompetitionsPage({
  searchParams
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  const params = await searchParams;
  const selectedCompetition = params.competition || "";

  const problems = await db.problem.findMany({
    where: { tags: { contains: "usaco" } },
    orderBy: { number: "asc" },
    select: { id: true, number: true, title: true, tags: true }
  });

  const grouped: Record<Division, Array<{ id: string; number: number; title: string }>> = {
    Bronze: [],
    Silver: [],
    Gold: [],
    Platinum: []
  };

  for (const p of problems) {
    grouped[getDivision(p.tags)].push({ id: p.id, number: p.number, title: p.title });
  }

  const selectedMeta = COMPETITIONS.find((item) => item.id === selectedCompetition);

  return (
    <div className="usaco-page-wrap">
      {!selectedMeta ? (
        <section className="usaco-past-chooser-card">
          <h1 className="usaco-past-chooser-title">CHOOSE COMPETITION NAME</h1>
          <div className="usaco-past-chooser-list">
            {COMPETITIONS.map((competition) => (
              <Link key={competition.id} href={`/usaco/past-competitions?competition=${competition.id}`} className="usaco-past-select-btn">
                {competition.label}
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="usaco-past-chooser-card">
            <h1 className="usaco-past-chooser-title">{selectedMeta.label.toUpperCase()}</h1>
            <Link href="/usaco/past-competitions" className="usaco-past-back-btn">
              Choose Another Competition
            </Link>
          </section>

          {(["Gold", "Silver", "Bronze", "Platinum"] as const).map((division) => (
            <section key={division} className="usaco-past-contest-block">
              <h2 className="usaco-past-division-head">USACO {selectedMeta.label.toUpperCase()} CONTEST, {division.toUpperCase()}</h2>
              <div className="usaco-past-problem-list">
                {grouped[division].length === 0 ? (
                  <p className="usaco-empty">No problems imported for this division.</p>
                ) : (
                  grouped[division].slice(0, 3).map((problem, idx) => (
                    <div key={problem.id} className="usaco-past-problem-item">
                      <div className="usaco-past-problem-name">
                        {idx + 1}. {problem.title.replace(/^\[USACO\s+[^\]]+\]\s*/i, "")}
                      </div>
                      <Link href={`/problem/${problem.number}`} className="usaco-past-view-btn">
                        View question
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
