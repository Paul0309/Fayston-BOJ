import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createProblemRevision, nextProblemRevisionVersion } from "@/lib/problem-revision";

interface RouteProps {
    params: Promise<{ id: string }>;
}

export async function POST(req: Request, props: RouteProps) {
    try {
        const admin = await getCurrentUser();
        if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

        const params = await props.params;
        const body = await req.json().catch(() => ({}));
        const action = body?.action === "approve" || body?.action === "reject" ? body.action : "";
        if (!action) return new NextResponse("Invalid action", { status: 400 });

        const review = await db.problemAiReview.findUnique({
            where: { id: params.id },
            include: { problem: true }
        });
        if (!review) return new NextResponse("Review not found", { status: 404 });
        if (review.status !== "PENDING") return new NextResponse("Review is not pending", { status: 409 });

        if (action === "reject") {
            await db.problemAiReview.update({
                where: { id: review.id },
                data: {
                    status: "REJECTED",
                    reviewedBy: admin.id,
                    reviewedAt: new Date()
                }
            });
            return NextResponse.json({ ok: true, status: "REJECTED" });
        }

        const updatedProblem = await db.problem.update({
            where: { id: review.problemId },
            data: {
                description: review.proposedDescription || review.problem.description,
                inputDesc: review.proposedInputDesc ?? review.problem.inputDesc,
                outputDesc: review.proposedOutputDesc ?? review.problem.outputDesc
            }
        });

        const nextVersion = await nextProblemRevisionVersion(updatedProblem.id);
        await createProblemRevision({
            problemId: updatedProblem.id,
            version: nextVersion,
            title: updatedProblem.title,
            description: updatedProblem.description,
            inputDesc: updatedProblem.inputDesc,
            outputDesc: updatedProblem.outputDesc,
            timeLimit: updatedProblem.timeLimit,
            memoryLimit: updatedProblem.memoryLimit,
            tags: updatedProblem.tags,
            createdBy: admin.id
        });

        await db.problemAiReview.update({
            where: { id: review.id },
            data: {
                status: "APPLIED",
                reviewedBy: admin.id,
                reviewedAt: new Date()
            }
        });

        return NextResponse.json({ ok: true, status: "APPLIED", version: nextVersion });
    } catch (error) {
        console.error("[ADMIN_AI_REVIEW_ACTION]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
