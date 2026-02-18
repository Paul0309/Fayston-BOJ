import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runProblemAiReviews } from "@/lib/problem-ai-review";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Get schedule config
    const schedule = await db.automationSchedule.findUnique({
      where: { type: "AI_REVIEW" },
    });

    if (!schedule || !schedule.enabled) {
      return NextResponse.json({
        skipped: true,
        reason: "AI_REVIEW schedule is not enabled",
      });
    }

    // Parse config
    const config = schedule.config ? JSON.parse(schedule.config) : {};

    // Run AI reviews
    const result = await runProblemAiReviews({
      adminId: admin.id,
      limit: config.limit || 30,
      retryErrors: config.retryErrors || true,
      force: config.force || false,
    });

    // Update schedule
    await db.automationSchedule.update({
      where: { type: "AI_REVIEW" },
      data: {
        lastRunAt: new Date(),
        nextRunAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
      },
    });

    console.log("[AUTO_RUN_AI_REVIEW]", result);

    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[AUTO_RUN_AI_REVIEW_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
