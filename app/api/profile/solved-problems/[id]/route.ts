import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, ctx: RouteContext) {
  const { id } = await ctx.params;

  const problem = await withDbRetry(() =>
    db.problem.findUnique({
      where: { id },
      select: {
        title: true,
        difficulty: true
      }
    })
  );

  if (!problem) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.json({
    detail: {
      title: problem.title,
      difficulty: problem.difficulty
    }
  });
}
