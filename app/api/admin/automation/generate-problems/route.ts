import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { autoGenerateProblemsWithAI } from "@/lib/problem-ai-autogen";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Get schedule config
    const schedule = await db.automationSchedule.findUnique({
      where: { type: "AUTO_PROBLEM_GEN" },
    });

    if (!schedule || !schedule.enabled) {
      return NextResponse.json({
        skipped: true,
        reason: "AUTO_PROBLEM_GEN schedule is not enabled",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return new NextResponse("OPENAI_API_KEY is missing", { status: 400 });
    }

    // Parse config
    const config = schedule.config ? JSON.parse(schedule.config) : {};
    const count = Math.min(config.limit || 1, 5); // Max 5 problems per run

    // Generate problems
    const created = await autoGenerateProblemsWithAI(count, admin.id);

    // Update schedule
    await db.automationSchedule.update({
      where: { type: "AUTO_PROBLEM_GEN" },
      data: {
        lastRunAt: new Date(),
        nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      },
    });

    console.log("[AUTO_GENERATE_PROBLEMS]", { count, created });

    return NextResponse.json({
      success: true,
      created,
      count: created.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[AUTO_GENERATE_PROBLEMS_ERROR]", error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal Error",
      }),
      { status: 500 }
    );
  }
}
