import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

interface ScheduleUpdate {
  type: "AI_REVIEW" | "AUTO_PROBLEM_GEN";
  enabled: boolean;
  cronExpression: string;
  presetLabel?: string;
}

export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = await req.json();
    const schedules = body.schedules as ScheduleUpdate[] || [];

    if (!Array.isArray(schedules)) {
      return new NextResponse("Invalid schedules array", { status: 400 });
    }

    const results = [];

    for (const schedule of schedules) {
      const { type, enabled, cronExpression, presetLabel } = schedule;

      if (!type || typeof enabled !== "boolean" || !cronExpression) {
        return new NextResponse("Invalid schedule data", { status: 400 });
      }

      // Calculate next run time from cron (simplified)
      const nextRunAt = new Date();
      nextRunAt.setHours(nextRunAt.getHours() + 6); // Placeholder: 6 hours from now

      const config = JSON.stringify({
        retryErrors: type === "AI_REVIEW",
        force: false,
        limit: type === "AI_REVIEW" ? 30 : 3,
      });

      // Upsert schedule
      const updated = await db.automationSchedule.upsert({
        where: { type },
        update: {
          enabled,
          cronExpression,
          presetLabel: presetLabel || null,
          nextRunAt,
          config,
          updatedAt: new Date(),
        },
        create: {
          type,
          enabled,
          cronExpression,
          presetLabel: presetLabel || null,
          nextRunAt,
          config,
        },
      });

      results.push(updated);
    }

    return NextResponse.json({ success: true, schedules: results });
  } catch (error) {
    console.error("[ADMIN_AUTOMATION_SCHEDULE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const schedules = await db.automationSchedule.findMany();

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error("[ADMIN_AUTOMATION_SCHEDULE_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
