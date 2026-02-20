import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const DIVISIONS = ["Bronze", "Silver", "Gold", "Platinum"] as const;
type Division = (typeof DIVISIONS)[number];

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

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

    const { id } = await ctx.params;
    const contest = await db.contest.findUnique({
      where: { id },
      include: {
        problems: {
          select: { id: true, number: true, title: true, difficulty: true, tags: true }
        },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, division: true } }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!contest) return new NextResponse("Not found", { status: 404 });
    return NextResponse.json({ item: contest });
  } catch (error) {
    console.error("[ADMIN_CONTEST_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

    const { id } = await ctx.params;
    const body = await req.json();
    const division = asDivision(typeof body?.division === "string" ? body.division : undefined);
    const startTime = body?.startTime ? new Date(body.startTime) : undefined;
    const endTime = body?.endTime ? new Date(body.endTime) : undefined;

    if (startTime && Number.isNaN(startTime.getTime())) return new NextResponse("Invalid startTime", { status: 400 });
    if (endTime && Number.isNaN(endTime.getTime())) return new NextResponse("Invalid endTime", { status: 400 });
    if (startTime && endTime && endTime <= startTime) return new NextResponse("End time must be after start time", { status: 400 });

    const updated = await db.contest.update({
      where: { id },
      data: {
        title: typeof body?.title === "string" ? body.title.trim() : undefined,
        description: typeof body?.description === "string" ? body.description.trim() : undefined,
        division: typeof body?.division === "string" ? division : undefined,
        startTime,
        endTime,
        isPublished: typeof body?.isPublished === "boolean" ? body.isPublished : undefined
      }
    });

    if (Array.isArray(body?.problemIds)) {
      const problemIds = body.problemIds.filter((v: unknown) => typeof v === "string");
      if (problemIds.length !== 3) return new NextResponse("Exactly 3 problemIds are required", { status: 400 });

      await db.problem.updateMany({
        where: { contestId: id },
        data: { contestId: null }
      });

      const selected = await db.problem.findMany({
        where: { id: { in: problemIds } },
        select: { id: true, tags: true }
      });
      if (selected.length !== problemIds.length) return new NextResponse("Some problems not found", { status: 400 });

      await Promise.all(
        selected.map((p) =>
          db.problem.update({
            where: { id: p.id },
            data: { contestId: id, tags: ensureDivisionTag(p.tags || "", division) }
          })
        )
      );
    }

    return NextResponse.json({ ok: true, item: updated });
  } catch (error) {
    console.error("[ADMIN_CONTEST_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
    const { id } = await ctx.params;

    await db.$transaction(async (tx) => {
      await tx.problem.updateMany({
        where: { contestId: id },
        data: { contestId: null }
      });
      await tx.contestParticipant.deleteMany({ where: { contestId: id } });
      await tx.contest.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ADMIN_CONTEST_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
