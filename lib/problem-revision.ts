import { db } from "@/lib/db";

export async function createProblemRevision(params: {
    problemId: string;
    version: number;
    title: string;
    description: string;
    inputDesc?: string | null;
    outputDesc?: string | null;
    timeLimit: number;
    memoryLimit: number;
    tags: string;
    createdBy?: string | null;
}) {
    await db.problemRevision.create({
        data: {
            problemId: params.problemId,
            version: params.version,
            title: params.title,
            description: params.description,
            inputDesc: params.inputDesc || null,
            outputDesc: params.outputDesc || null,
            timeLimit: params.timeLimit,
            memoryLimit: params.memoryLimit,
            tags: params.tags,
            createdBy: params.createdBy || null
        }
    });
}

export async function nextProblemRevisionVersion(problemId: string) {
    const latest = await db.problemRevision.findFirst({
        where: { problemId },
        orderBy: { version: "desc" },
        select: { version: true }
    });
    return (latest?.version || 0) + 1;
}
