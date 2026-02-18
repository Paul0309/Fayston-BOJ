import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { toggleDiscussionLike } from "@/lib/problem-community";

interface RouteContext {
  params: Promise<{ discussionId: string }>;
}

export async function POST(_: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  const userId = getSessionUser(session).id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { discussionId } = await ctx.params;
  const result = await toggleDiscussionLike(discussionId, userId);
  return NextResponse.json(result);
}
