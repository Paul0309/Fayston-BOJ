import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createProblemRevision, nextProblemRevisionVersion } from "@/lib/problem-revision";

function parseTags(tags: string) {
    return tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .join(",");
}

export async function POST(req: Request) {
    try {
        const admin = await getCurrentUser();
        if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

        const body = await req.json();
        const {
            number,
            title,
            difficulty,
            tags,
            description,
            inputDesc,
            outputDesc,
            timeLimit,
            memoryLimit,
            examples
        } = body;

        if (!number || !title || !description) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        const normalizedExamples = Array.isArray(examples)
            ? examples
                .filter((e) => e && typeof e.input === "string" && typeof e.output === "string")
                .map((e) => ({
                    input: e.input,
                    output: e.output,
                    isHidden: Boolean(e.isHidden),
                    score: Number(e.score) > 0 ? Number(e.score) : 100,
                    groupName: typeof e.groupName === "string" && e.groupName.trim() ? e.groupName.trim() : "default"
                }))
            : [];

        const problem = await db.problem.create({
            data: {
                number: Number(number),
                title,
                difficulty: difficulty || "BRONZE_5",
                tags: parseTags(tags || ""),
                description,
                inputDesc: inputDesc || null,
                outputDesc: outputDesc || null,
                timeLimit: Number(timeLimit) || 1000,
                memoryLimit: Number(memoryLimit) || 128,
                testCases: {
                    create: normalizedExamples
                }
            }
        });

        await createProblemRevision({
            problemId: problem.id,
            version: 1,
            title: problem.title,
            description: problem.description,
            inputDesc: problem.inputDesc,
            outputDesc: problem.outputDesc,
            timeLimit: problem.timeLimit,
            memoryLimit: problem.memoryLimit,
            tags: problem.tags,
            createdBy: admin.id
        });

        return NextResponse.json({ id: problem.id });
    } catch (error: unknown) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: string }).code === "P2002"
        ) {
            return new NextResponse("Problem number already exists", { status: 409 });
        }
        console.error("[ADMIN_PROBLEM_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const admin = await getCurrentUser();
        if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

        const { searchParams } = new URL(req.url);
        const q = (searchParams.get("q") || "").trim();
        const limit = Math.max(1, Math.min(Number(searchParams.get("limit") || 50), 200));
        const numberQuery = Number(q);

        const items = await db.problem.findMany({
            where: q
                ? {
                      OR: [
                          ...(Number.isFinite(numberQuery) ? [{ number: numberQuery }] : []),
                          { title: { contains: q } },
                          { description: { contains: q } },
                          { tags: { contains: q } }
                      ]
                  }
                : undefined,
            select: {
                id: true,
                number: true,
                title: true,
                difficulty: true,
                tags: true
            },
            orderBy: { number: "desc" },
            take: limit
        });

        return NextResponse.json({ items });
    } catch (error) {
        console.error("[ADMIN_PROBLEM_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const admin = await getCurrentUser();
        if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

        const body = await req.json();
        const {
            id,
            title,
            difficulty,
            tags,
            description,
            inputDesc,
            outputDesc,
            timeLimit,
            memoryLimit
        } = body;

        if (!id) return new NextResponse("Problem id is required", { status: 400 });

        const existing = await db.problem.findUnique({ where: { id } });
        if (!existing) return new NextResponse("Problem not found", { status: 404 });

        const updated = await db.problem.update({
            where: { id },
            data: {
                title: title ?? existing.title,
                difficulty: difficulty ?? existing.difficulty,
                tags: parseTags(tags ?? existing.tags),
                description: description ?? existing.description,
                inputDesc: inputDesc ?? existing.inputDesc,
                outputDesc: outputDesc ?? existing.outputDesc,
                timeLimit: Number(timeLimit) || existing.timeLimit,
                memoryLimit: Number(memoryLimit) || existing.memoryLimit
            }
        });

        const nextVersion = await nextProblemRevisionVersion(updated.id);
        await createProblemRevision({
            problemId: updated.id,
            version: nextVersion,
            title: updated.title,
            description: updated.description,
            inputDesc: updated.inputDesc,
            outputDesc: updated.outputDesc,
            timeLimit: updated.timeLimit,
            memoryLimit: updated.memoryLimit,
            tags: updated.tags,
            createdBy: admin.id
        });

        return NextResponse.json({ id: updated.id, version: nextVersion });
    } catch (error) {
        console.error("[ADMIN_PROBLEM_PUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
