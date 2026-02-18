import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getAllowedLanguages, setAllowedLanguages } from "@/lib/language-settings";
import { isSupportedLanguage } from "@/lib/languages";

export async function GET() {
    const admin = await isAdmin();
    if (!admin) return new NextResponse("Forbidden", { status: 403 });

    const allowedLanguages = await getAllowedLanguages();
    return NextResponse.json({ allowedLanguages });
}

export async function PUT(req: Request) {
    const admin = await isAdmin();
    if (!admin) return new NextResponse("Forbidden", { status: 403 });

    const body = await req.json();
    const languages = Array.isArray(body?.languages) ? body.languages : [];

    if (!languages.every((value: unknown) => typeof value === "string" && isSupportedLanguage(value))) {
        return new NextResponse("Invalid language list", { status: 400 });
    }

    const allowedLanguages = await setAllowedLanguages(languages);
    return NextResponse.json({ allowedLanguages });
}
