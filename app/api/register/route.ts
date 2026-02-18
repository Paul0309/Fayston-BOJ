
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, name, password, division } = body;
        const allowedDivisions = new Set(["Bronze", "Silver", "Gold", "Platinum"]);
        const normalizedDivision = allowedDivisions.has(division) ? division : "Bronze";

        if (!email || !name || !password) {
            return new NextResponse("Missing Info", { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await db.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                role: "STUDENT", // Default role
                division: normalizedDivision
            }
        });

        return NextResponse.json(user);

    } catch (error: unknown) {
        console.log("REGISTER_ERROR", error);
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: string }).code === "P2002"
        ) {
            return new NextResponse("Email already exists", { status: 409 });
        }
        return new NextResponse("Internal Error", { status: 500 });
    }
}
