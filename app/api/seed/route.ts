import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";

export async function POST(req: Request) {
  try {
    const success = await seedDatabase();

    if (success) {
      return NextResponse.json(
        { message: "Database seeded successfully!" },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { error: "Seeding failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[SEED_ERROR]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
