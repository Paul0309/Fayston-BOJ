import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAdminActionLogs } from "@/lib/admin-action-log";

export async function GET(req: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(Number(searchParams.get("limit") || 50), 200));
    const items = await getAdminActionLogs(limit);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[AI_MANAGE_LOGS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

