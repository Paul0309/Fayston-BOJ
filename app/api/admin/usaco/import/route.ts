import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { USACO_DIVISIONS, USACO_QUESTION_BANK, type UsacoDivision } from "@/lib/usaco/problem-bank";
import { createProblemRevision } from "@/lib/problem-revision";
import { appendAdminActionLog } from "@/lib/admin-action-log";

type ImportRequest = {
  division?: UsacoDivision | "ALL";
};

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

function asDivision(input?: string): UsacoDivision[] {
  if (!input || input === "ALL") return USACO_DIVISIONS;
  return USACO_DIVISIONS.includes(input as UsacoDivision) ? [input as UsacoDivision] : [];
}

export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

    const body = (await req.json().catch(() => ({}))) as ImportRequest;
    const targetDivisions = asDivision(body.division);
    if (targetDivisions.length === 0) return new NextResponse("Invalid division", { status: 400 });

    const last = await db.problem.findFirst({
      orderBy: { number: "desc" },
      select: { number: true }
    });
    let nextNumber = Math.max(100000, (last?.number || 99999) + 1);

    let scanned = 0;
    let created = 0;
    let skipped = 0;
    const createdItems: Array<{ id: string; number: number; title: string }> = [];

    for (const division of targetDivisions) {
      for (const item of USACO_QUESTION_BANK[division]) {
        scanned += 1;
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

        const problem = await db.problem.create({
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
            testCases: {
              create: testCases
            }
          }
        });

        await createProblemRevision({
          problemId: problem.id,
          version: 1,
          title: problem.title,
          description: problem.description,
          inputDesc: problem.inputDesc,
          outputDesc: problem.outputDesc,
          timeLimit: problem.timeLimit,
          memoryLimit: problem.memoryLimit,
          tags: problem.tags,
          createdBy: admin.id
        });

        created += 1;
        createdItems.push({ id: problem.id, number: problem.number, title: problem.title });
      }
    }

    const result = {
      divisions: targetDivisions,
      scanned,
      created,
      skipped,
      createdItems
    };

    await appendAdminActionLog({
      action: "USACO_IMPORT",
      adminId: admin.id,
      target: { divisions: targetDivisions },
      result
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ADMIN_USACO_IMPORT_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

