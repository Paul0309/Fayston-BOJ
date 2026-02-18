import { db } from "@/lib/db";
import { USACO_DIVISIONS, USACO_QUESTION_BANK, type UsacoDivision } from "@/lib/usaco/problem-bank";

function distributeScores(length: number) {
  if (length <= 0) return [];
  const base = Math.floor(100 / length);
  let remain = 100;
  return Array.from({ length }, (_, i) => {
    const score = i === length - 1 ? remain : base;
    remain -= score;
    return Math.max(1, score);
  });
}

export async function syncUsacoBankToDb(targetDivisions: UsacoDivision[] = USACO_DIVISIONS) {
  const last = await db.problem.findFirst({
    orderBy: { number: "desc" },
    select: { number: true }
  });

  let nextNumber = Math.max(100000, (last?.number || 99999) + 1);
  let created = 0;
  let skipped = 0;

  for (const division of targetDivisions) {
    for (const item of USACO_QUESTION_BANK[division]) {
      const usacoTag = `usaco_id:${item.id}`;
      const existing = await db.problem.findFirst({
        where: {
          OR: [{ tags: { contains: usacoTag } }, { title: item.title, tags: { contains: "usaco" } }]
        },
        select: { id: true }
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      const scores = distributeScores(item.tests.length);
      const testCases = item.tests.map((tc, idx) => ({
        input: tc.input,
        output: tc.output,
        isHidden: idx > 0,
        score: scores[idx] || 1,
        groupName: idx === 0 ? "sample|Basic sample validation" : `usaco-hidden|Official ${division} hidden validation`
      }));

      await db.problem.create({
        data: {
          number: nextNumber++,
          title: `[USACO ${division}] ${item.title}`,
          difficulty: item.difficulty,
          tags: ["usaco", `division:${division.toLowerCase()}`, usacoTag, ...item.tags].join(","),
          description: item.statement,
          inputDesc: item.inputDesc,
          outputDesc: item.outputDesc,
          timeLimit: 2000,
          memoryLimit: 256,
          testCases: { create: testCases }
        }
      });
      created += 1;
    }
  }

  return { created, skipped };
}
