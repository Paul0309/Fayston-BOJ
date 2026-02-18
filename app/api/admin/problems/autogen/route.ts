import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { autoGenerateProblems } from "@/lib/problem-autogen";
import { appendAdminActionLog } from "@/lib/admin-action-log";

type Topic = "math" | "string" | "mixed";

export async function POST(req: Request) {
    try {
        const admin = await getCurrentUser();
        if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

        const body = await req.json();
        const count = Number(body?.count ?? 3);
        const difficulty = typeof body?.difficulty === "string" ? body.difficulty : undefined;
        const topic: Topic =
            body?.topic === "math" || body?.topic === "string" || body?.topic === "mixed"
                ? body.topic
                : "mixed";

        const generated = await autoGenerateProblems(db, count, topic, difficulty, admin.id);
        const created = generated.created;
        await appendAdminActionLog({
            action: "AI_AUTO_PROBLEM_GENERATE",
            adminId: admin.id,
            target: { topic, difficulty: difficulty || null, requestedCount: count },
            result: generated.report
        });
        return NextResponse.json({ createdCount: created.length, created, report: generated.report });
    } catch (error) {
        console.error("[ADMIN_PROBLEM_AUTOGEN_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
