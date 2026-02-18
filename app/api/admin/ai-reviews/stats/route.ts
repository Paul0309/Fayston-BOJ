import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
    try {
        const admin = await getCurrentUser();
        if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

        const [pendingCount, appliedCount, rejectedCount, errorCount, latestPending] = await Promise.all([
            db.problemAiReview.count({ where: { status: "PENDING" } }),
            db.problemAiReview.count({ where: { status: "APPLIED" } }),
            db.problemAiReview.count({ where: { status: "REJECTED" } }),
            db.problemAiReview.count({ where: { status: "ERROR" } }),
            db.problemAiReview.findFirst({
                where: { status: "PENDING" },
                select: { createdAt: true },
                orderBy: { createdAt: "desc" }
            })
        ]);

        return NextResponse.json({
            pendingCount,
            appliedCount,
            rejectedCount,
            errorCount,
            latestPendingAt: latestPending?.createdAt || null
        });
    } catch (error) {
        console.error("[ADMIN_AI_REVIEW_STATS]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
