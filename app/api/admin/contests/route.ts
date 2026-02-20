import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const DIVISIONS = ["Bronze", "Silver", "Gold", "Platinum"] as const;
type Division = (typeof DIVISIONS)[number];

type NewProblemInput = {
  title: string;
  difficulty: string;
  tags?: string;
  description: string;
  inputDesc?: string;
  outputDesc?: string;
  timeLimit?: number;
  memoryLimit?: number;
  sampleInput: string;
  sampleOutput: string;
  hiddenInput?: string;
  hiddenOutput?: string;
};

function asDivision(value?: string): Division {
  return DIVISIONS.includes(value as Division) ? (value as Division) : "Bronze";
}

function ensureDivisionTag(tags: string, division: Division) {
  const parts = tags
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const lower = new Set(parts.map((p) => p.toLowerCase()));
  if (!lower.has("usaco")) parts.push("usaco");
  const divTag = `division:${division.toLowerCase()}`;
  if (!lower.has(divTag)) parts.push(divTag);
  return parts.join(",");
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

    const contests = await db.contest.findMany({
      orderBy: { startTime: "desc" },
      include: {
        problems: {
          select: { id: true, number: true, title: true, difficulty: true, tags: true }
        },
        _count: {
          select: { participants: true }
        }
      }
    });

    return NextResponse.json({ items: contests });
  } catch (error) {
    console.error("[ADMIN_CONTESTS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

    const body = await req.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const division = asDivision(typeof body?.division === "string" ? body.division : undefined);
    const startTime = new Date(body?.startTime);
    const endTime = new Date(body?.endTime);
    const isPublished = !!body?.isPublished;
    const existingProblemIds = Array.isArray(body?.problemIds) ? body.problemIds.filter((v: unknown) => typeof v === "string") : [];
    const newProblems = Array.isArray(body?.newProblems) ? (body.newProblems as NewProblemInput[]) : [];

    if (!title) return new NextResponse("Title is required", { status: 400 });
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) return new NextResponse("Invalid schedule", { status: 400 });
    if (endTime <= startTime) return new NextResponse("End time must be after start time", { status: 400 });

    const totalProblemCount = existingProblemIds.length + newProblems.length;
    if (totalProblemCount !== 3) {
      return new NextResponse("Exactly 3 problems are required (existing + new).", { status: 400 });
    }

    const contest = await db.contest.create({
      data: {
        title,
        description: description || null,
        division,
        startTime,
        endTime,
        isPublished
      }
    });

    if (existingProblemIds.length > 0) {
      const existingProblems = await db.problem.findMany({
        where: { id: { in: existingProblemIds } },
        select: { id: true, tags: true }
      });

      if (existingProblems.length !== existingProblemIds.length) {
        return new NextResponse("Some selected problems were not found", { status: 400 });
      }

      await Promise.all(
        existingProblems.map((p) =>
          db.problem.update({
            where: { id: p.id },
            data: {
              contestId: contest.id,
              tags: ensureDivisionTag(p.tags || "", division)
            }
          })
        )
      );
    }

    if (newProblems.length > 0) {
      let nextNumber = ((await db.problem.aggregate({ _max: { number: true } }))._max.number || 0) + 1;

      for (const np of newProblems) {
        const difficulty = typeof np.difficulty === "string" && np.difficulty ? np.difficulty : "BRONZE_3";
        const sampleInput = String(np.sampleInput || "").trim();
        const sampleOutput = String(np.sampleOutput || "").trim();
        if (!np.title || !np.description || !sampleInput || !sampleOutput) {
          return new NextResponse("New problems require title/description/sample input/sample output", { status: 400 });
        }

        const problem = await db.problem.create({
          data: {
            number: nextNumber++,
            title: np.title.trim(),
            difficulty,
            description: np.description,
            inputDesc: np.inputDesc || "",
            outputDesc: np.outputDesc || "",
            timeLimit: Number(np.timeLimit) > 0 ? Number(np.timeLimit) : 2000,
            memoryLimit: Number(np.memoryLimit) > 0 ? Number(np.memoryLimit) : 256,
            tags: ensureDivisionTag(np.tags || "", division),
            contestId: contest.id
          }
        });

        await db.testCase.create({
          data: {
            problemId: problem.id,
            input: sampleInput,
            output: sampleOutput,
            isHidden: false,
            score: 10,
            groupName: "sample|Basic sample validation"
          }
        });

        await db.testCase.create({
          data: {
            problemId: problem.id,
            input: String(np.hiddenInput || sampleInput),
            output: String(np.hiddenOutput || sampleOutput),
            isHidden: true,
            score: 90,
            groupName: `contest-hidden|Official ${division} hidden validation`
          }
        });
      }
    }

    return NextResponse.json({ ok: true, contestId: contest.id });
  } catch (error) {
    console.error("[ADMIN_CONTESTS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
