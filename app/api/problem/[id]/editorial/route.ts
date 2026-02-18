import { NextResponse } from "next/server";
import { createEditorial, getProblemEditorials } from "@/lib/problem-community";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_: Request, ctx: RouteContext) {
    const { id } = await ctx.params;
    const editorials = await getProblemEditorials(id);
    return NextResponse.json({ editorials });
}

export async function POST(req: Request, ctx: RouteContext) {
    const session = await getServerSession(authOptions);
    const user = getSessionUser(session);
    if (!user.id) return new NextResponse("Unauthorized", { status: 401 });
    if (user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

    const { id } = await ctx.params;
    const body = await req.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const isOfficial = Boolean(body?.isOfficial);

    if (!title || !content) return new NextResponse("Title and content are required", { status: 400 });

    await createEditorial({ problemId: id, authorId: user.id, title, content, isOfficial });
    return NextResponse.json({ ok: true });
}
