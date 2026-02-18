import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { enqueueSubmissionForJudge } from "@/lib/judge/queue";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function POST(_: Request, ctx: RouteContext) {
    try {
        const session = await getServerSession(authOptions);
        const { id: userId, role } = getSessionUser(session);
        const { id } = await ctx.params;

        if (!userId) return new NextResponse("Unauthorized", { status: 401 });

        const submission = await db.submission.findUnique({ where: { id } });
        if (!submission) return new NextResponse("Not found", { status: 404 });

        if (role !== "ADMIN" && submission.userId !== userId) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        await db.submission.update({
            where: { id },
            data: {
                status: "PENDING",
                detail: "Rejudge queued",
                failedCase: null,
                expectedOutput: null,
                actualOutput: null,
                timeUsed: null,
                memoryUsed: null,
                totalScore: 0,
                maxScore: 0
            }
        });

        await enqueueSubmissionForJudge(submission.id);

        return NextResponse.json({ ok: true, submissionId: submission.id, status: "QUEUED" });
    } catch (error) {
        console.error("[REJUDGE_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
