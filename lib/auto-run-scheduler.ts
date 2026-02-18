"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { getSessionUser } from "@/lib/session-user";

interface ScheduleStatus {
  type: string;
  lastRunAt?: string;
  nextRunAt?: string;
  enabled: boolean;
}

export function useAutoRunScheduler() {
  const { data: session } = useSession();
  const role = getSessionUser(session).role;
  const isAdmin = role === "ADMIN";
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const checkAndRunSchedules = async () => {
      try {
        // Get current schedules
        const res = await fetch("/api/admin/automation/schedule", {
          cache: "no-store",
        });

        if (!res.ok) return;

        const data = (await res.json()) as { schedules: ScheduleStatus[] };
        const schedules = data.schedules || [];

        const now = new Date();

        // Check each schedule
        for (const schedule of schedules) {
          if (!schedule.enabled) continue;

          const nextRun = schedule.nextRunAt ? new Date(schedule.nextRunAt) : null;

          // If it's time to run
          if (nextRun && now >= nextRun) {
            if (schedule.type === "AI_REVIEW") {
              await fetch("/api/admin/automation/run-reviews", { method: "POST" });
              console.log("[AUTO_SCHEDULER] Triggered AI reviews");
            } else if (schedule.type === "AUTO_PROBLEM_GEN") {
              await fetch("/api/admin/automation/generate-problems", { method: "POST" });
              console.log("[AUTO_SCHEDULER] Triggered problem generation");
            }
          }
        }
      } catch (error) {
        console.error("[AUTO_SCHEDULER_ERROR]", error);
      }
    };

    // Check every 60 seconds
    void checkAndRunSchedules();
    intervalRef.current = setInterval(checkAndRunSchedules, 60000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAdmin]);
}
