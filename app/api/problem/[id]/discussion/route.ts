import { NextResponse } from "next/server";
import { getProblemDiscussions, createDiscussion } from "@/lib/problem-community";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_: Request, ctx: RouteContext) {
    const { id } = await ctx.params;
    const session = await getServerSession(authOptions);
    const viewerId = getSessionUser(session).id;
    const discussions = await getProblemDiscussions(id, 200, viewerId);
    return NextResponse.json({ discussions });
}

export async function POST(req: Request, ctx: RouteContext) {
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await ctx.params;
    const body = await req.json();
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const parentId = typeof body?.parentId === "string" ? body.parentId : null;

    if (!content) return new NextResponse("Content is required", { status: 400 });
    if (content.length > 2000) return new NextResponse("Content is too long", { status: 400 });

    await createDiscussion({ problemId: id, userId, content, parentId });
    return NextResponse.json({ ok: true });
}
