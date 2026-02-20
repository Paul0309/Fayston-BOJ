import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { getAllowedLanguages } from "@/lib/language-settings";
import { isSupportedLanguage } from "@/lib/languages";
import { enqueueSubmissionForJudge, processJudgeQueue } from "@/lib/judge/queue";
import { parseCodeVisibility } from "@/lib/code-visibility";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const userId = getSessionUser(session).id || "temp-user-id";

        const body = await req.json();
        const { problemId, code, language, codeVisibility } = body;

        if (!problemId || !code || !language) {
            return new NextResponse("Missing fields", { status: 400 });
        }

        if (typeof language !== "string" || !isSupportedLanguage(language)) {
            return new NextResponse("Unsupported language", { status: 400 });
        }

        const allowedLanguages = await getAllowedLanguages();
        if (!allowedLanguages.includes(language)) {
            return new NextResponse("This language is currently disabled by admin", { status: 400 });
        }

        const visibility = parseCodeVisibility(codeVisibility);
        const submission = await db.submission.create({
            data: {
                problemId,
                userId,
                code,
                language,
                isPublic: visibility === "PUBLIC",
                codeVisibility: visibility,
                status: "PENDING",
                detail: "Queued for judge"
            }
        });

        await enqueueSubmissionForJudge(submission.id);
        await processJudgeQueue(1).catch(() => {});

        return NextResponse.json({
            ok: true,
            submissionId: submission.id,
            status: "QUEUED"
        });
    } catch (error) {
        console.error("[SUBMIT_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
