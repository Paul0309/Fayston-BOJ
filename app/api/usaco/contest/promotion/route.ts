import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { db } from "@/lib/db";
import { checkUserUsacoPromotionEligibility } from "@/lib/usaco/promotion";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const result = await checkUserUsacoPromotionEligibility(userId);
    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error("[USACO_CONTEST_PROMOTION_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });
    const check = await checkUserUsacoPromotionEligibility(userId);
    if (!check.eligible || !check.canPromote || !check.nextDivision) {
      return NextResponse.json({
        ok: true,
        promoted: false,
        division: check.currentDivision,
        message: check.message
      });
    }

    await db.user.update({
      where: { id: userId },
      data: { division: check.nextDivision }
    });

    return NextResponse.json({
      ok: true,
      promoted: true,
      division: check.nextDivision,
      previousDivision: check.currentDivision,
      message: `축하합니다! ${check.currentDivision}에서 ${check.nextDivision}로 승급되었습니다.`
    });
  } catch (error) {
    console.error("[USACO_CONTEST_PROMOTION_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
