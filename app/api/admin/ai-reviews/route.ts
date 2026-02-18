import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

function parseIssues(raw: string) {
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
    } catch {
        return [];
    }
}

export async function GET(req: Request) {
    try {
        const admin = await getCurrentUser();
        if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "PENDING";
        const limit = Math.max(1, Math.min(Number(searchParams.get("limit") || 30), 200));

        const rows = await db.problemAiReview.findMany({
            where: { status },
            include: {
                problem: {
                    select: {
                        id: true,
                        number: true,
                        title: true,
                        description: true,
                        inputDesc: true,
                        outputDesc: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            take: limit
        });

        return NextResponse.json({
            items: rows.map((row) => ({
                id: row.id,
                status: row.status,
                issues: parseIssues(row.issues),
                model: row.model,
                createdAt: row.createdAt,
                problem: row.problem,
                proposedDescription: row.proposedDescription,
                proposedInputDesc: row.proposedInputDesc,
                proposedOutputDesc: row.proposedOutputDesc
            }))
        });
    } catch (error) {
        console.error("[ADMIN_AI_REVIEW_LIST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
