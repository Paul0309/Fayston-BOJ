import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { findTopSimilarProblems } from "@/lib/problem-similarity";

type SimilarityRequest = {
  title?: string;
  description?: string;
  excludeId?: string;
  limit?: number;
};

export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

    const body = (await req.json()) as SimilarityRequest;
    const title = (body.title || "").trim();
    const description = (body.description || "").trim();
    const limit = Math.max(1, Math.min(Number(body.limit || 5), 20));

    if (!title && !description) {
      return new NextResponse("title or description is required", { status: 400 });
    }

    const rows = await db.problem.findMany({
      where: body.excludeId ? { id: { not: body.excludeId } } : undefined,
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        difficulty: true,
        tags: true
      },
      orderBy: { number: "desc" },
      take: 800
    });

    const top = findTopSimilarProblems(
      { title, description },
      rows.map((row) => ({
        ...row,
        description: row.description || ""
      })),
      limit
    ).map(({ item, score }) => ({
      ...item,
      score: Number(score.toFixed(4))
    }));

    return NextResponse.json({ items: top });
  } catch (error) {
    console.error("[ADMIN_PROBLEM_SIMILARITY_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

