import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

    const { id } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    const [participants, users] = await Promise.all([
      db.contestParticipant.findMany({
        where: { contestId: id },
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true, division: true, createdAt: true } }
        }
      }),
      db.user.findMany({
        where: q
          ? {
              OR: [{ name: { contains: q } }, { email: { contains: q } }]
            }
          : undefined,
        select: { id: true, name: true, email: true, division: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: q ? 100 : 30
      })
    ]);

    const joined = new Set(participants.map((p) => p.userId));
    const candidates = users
      .filter((u) => !joined.has(u.id))
      .map((u) => ({
        ...u,
        joined: false
      }));

    return NextResponse.json({
      items: participants.map((p) => ({
        id: p.id,
        contestId: p.contestId,
        userId: p.userId,
        createdAt: p.createdAt,
        user: p.user
      })),
      candidates
    });
  } catch (error) {
    console.error("[ADMIN_CONTEST_PARTICIPANTS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
    const { id } = await ctx.params;
    const body = await req.json();

    const emails = Array.isArray(body?.emails)
      ? body.emails.filter((v: unknown) => typeof v === "string").map((e: string) => normalizeEmail(e)).filter(Boolean)
      : [];
    const userIds = Array.isArray(body?.userIds) ? body.userIds.filter((v: unknown) => typeof v === "string") : [];

    const users = await db.user.findMany({
      where: {
        OR: [...(emails.length ? [{ email: { in: emails } }] : []), ...(userIds.length ? [{ id: { in: userIds } }] : [])]
      },
      select: { id: true }
    });

    if (users.length === 0) return new NextResponse("No users found to add", { status: 400 });

    await db.contestParticipant.createMany({
      data: users.map((u) => ({ contestId: id, userId: u.id })),
      skipDuplicates: true
    });

    return NextResponse.json({ ok: true, added: users.length });
  } catch (error) {
    console.error("[ADMIN_CONTEST_PARTICIPANTS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
    const { id } = await ctx.params;
    const body = await req.json();
    const userIds = Array.isArray(body?.userIds) ? body.userIds.filter((v: unknown) => typeof v === "string") : [];

    if (userIds.length === 0) return new NextResponse("userIds are required", { status: 400 });

    const result = await db.contestParticipant.deleteMany({
      where: {
        contestId: id,
        userId: { in: userIds }
      }
    });

    return NextResponse.json({ ok: true, removed: result.count });
  } catch (error) {
    console.error("[ADMIN_CONTEST_PARTICIPANTS_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

