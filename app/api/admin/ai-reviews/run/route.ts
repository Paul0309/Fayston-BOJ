import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runProblemAiReviews } from "@/lib/problem-ai-review";
import { appendAdminActionLog } from "@/lib/admin-action-log";

export async function POST(req: Request) {
    try {
        const admin = await getCurrentUser();
        if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

        if (!process.env.OPENAI_API_KEY) {
            return new NextResponse("OPENAI_API_KEY is missing", { status: 400 });
        }

        const body = await req.json().catch(() => ({}));
        const limit = Number(body?.limit ?? 30);
        const retryErrors = Boolean(body?.retryErrors);
        const force = Boolean(body?.force);
        const result = await runProblemAiReviews({ adminId: admin.id, limit, retryErrors, force });
        await appendAdminActionLog({
            action: "AI_REVIEW_RUN",
            adminId: admin.id,
            target: { limit, retryErrors, force },
            result: {
                scanned: (result as { scanned?: number }).scanned ?? null,
                created: (result as { created?: number }).created ?? null,
                noChange: (result as { noChange?: number }).noChange ?? null,
                skipped: (result as { skipped?: number }).skipped ?? null,
                errors: (result as { errors?: number }).errors ?? null
            }
        });
        return NextResponse.json(result);
    } catch (error) {
        console.error("[ADMIN_AI_REVIEW_RUN]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
