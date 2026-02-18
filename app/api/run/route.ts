import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAllowedLanguages } from "@/lib/language-settings";
import { isSupportedLanguage } from "@/lib/languages";
import { runSnippet } from "@/lib/judge/run-snippet";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const problemId = typeof body?.problemId === "string" ? body.problemId : "";
    const code = typeof body?.code === "string" ? body.code : "";
    const input = typeof body?.input === "string" ? body.input : "";
    const language = typeof body?.language === "string" ? body.language : "";

    if (!problemId || !code || !language) {
      return new NextResponse("Missing fields", { status: 400 });
    }
    if (!isSupportedLanguage(language)) {
      return new NextResponse("Unsupported language", { status: 400 });
    }

    const allowedLanguages = await getAllowedLanguages();
    if (!allowedLanguages.includes(language)) {
      return new NextResponse("This language is currently disabled by admin", { status: 400 });
    }

    const problem = await db.problem.findUnique({
      where: { id: problemId },
      select: { timeLimit: true }
    });
    if (!problem) {
      return new NextResponse("Problem not found", { status: 404 });
    }

    const result = await runSnippet({
      code,
      language,
      input,
      timeLimitMs: problem.timeLimit + 1000
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[RUN_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

