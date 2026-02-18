import { db } from "@/lib/db";
import { randomUUID } from "crypto";

const CREATE_EDITORIAL_SQL = `
    CREATE TABLE IF NOT EXISTS "ProblemEditorial" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "problemId" TEXT NOT NULL,
        "authorId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "isOfficial" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`;

const CREATE_DISCUSSION_SQL = `
    CREATE TABLE IF NOT EXISTS "ProblemDiscussion" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "problemId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "parentId" TEXT,
        "likeCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`;

const CREATE_DISCUSSION_LIKE_SQL = `
    CREATE TABLE IF NOT EXISTS "DiscussionLike" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "discussionId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`;

const CREATE_DISCUSSION_LIKE_UNIQUE_SQL = `
    CREATE UNIQUE INDEX IF NOT EXISTS "DiscussionLike_discussionId_userId_key" ON "DiscussionLike"("discussionId", "userId")
`;

export type EditorialRow = {
    id: string;
    problemId: string;
    authorId: string;
    title: string;
    content: string;
    isOfficial: number;
    createdAt: string;
    updatedAt: string;
    authorName: string | null;
};

export type DiscussionRow = {
    id: string;
    problemId: string;
    userId: string;
    content: string;
    parentId: string | null;
    likeCount: number;
    createdAt: string;
    updatedAt: string;
    authorName: string | null;
    likedByMe?: boolean;
};

export async function ensureCommunityTables() {
    await db.$executeRawUnsafe(CREATE_EDITORIAL_SQL);
    await db.$executeRawUnsafe(CREATE_DISCUSSION_SQL);
    await db.$executeRawUnsafe(CREATE_DISCUSSION_LIKE_SQL);
    await db.$executeRawUnsafe(CREATE_DISCUSSION_LIKE_UNIQUE_SQL);
}

export async function getProblemEditorials(problemId: string): Promise<EditorialRow[]> {
    try {
        return await db.$queryRaw<EditorialRow[]>`
            SELECT
                e."id",
                e."problemId",
                e."authorId",
                e."title",
                e."content",
                e."isOfficial",
                e."createdAt",
                e."updatedAt",
                u."name" as "authorName"
            FROM "ProblemEditorial" e
            LEFT JOIN "User" u ON u."id" = e."authorId"
            WHERE e."problemId" = ${problemId}
            ORDER BY e."isOfficial" DESC, e."createdAt" DESC
        `;
    } catch {
        return [];
    }
}

export async function getProblemDiscussions(problemId: string, limit = 200, viewerId?: string): Promise<DiscussionRow[]> {
    try {
        const rows = await db.$queryRaw<DiscussionRow[]>`
            SELECT
                d."id",
                d."problemId",
                d."userId",
                d."content",
                d."parentId",
                d."likeCount",
                d."createdAt",
                d."updatedAt",
                u."name" as "authorName"
            FROM "ProblemDiscussion" d
            LEFT JOIN "User" u ON u."id" = d."userId"
            WHERE d."problemId" = ${problemId}
            ORDER BY d."createdAt" DESC
            LIMIT ${limit}
        `;

        if (!viewerId || rows.length === 0) return rows;
        const ids = rows.map((r) => r.id);
        const liked = await db.discussionLike.findMany({
            where: { userId: viewerId, discussionId: { in: ids } },
            select: { discussionId: true }
        });
        const likedSet = new Set(liked.map((v) => v.discussionId));
        return rows.map((r) => ({ ...r, likedByMe: likedSet.has(r.id) }));
    } catch {
        return [];
    }
}

export async function createEditorial(params: {
    problemId: string;
    authorId: string;
    title: string;
    content: string;
    isOfficial?: boolean;
}) {
    await ensureCommunityTables();

    await db.$executeRaw`
        INSERT INTO "ProblemEditorial" ("id", "problemId", "authorId", "title", "content", "isOfficial", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${params.problemId}, ${params.authorId}, ${params.title}, ${params.content}, ${Boolean(params.isOfficial)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
}

export async function createDiscussion(params: { problemId: string; userId: string; content: string; parentId?: string | null }) {
    await ensureCommunityTables();

    await db.$executeRaw`
        INSERT INTO "ProblemDiscussion" ("id", "problemId", "userId", "content", "parentId", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${params.problemId}, ${params.userId}, ${params.content}, ${params.parentId || null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
}

export async function toggleDiscussionLike(discussionId: string, userId: string) {
    await ensureCommunityTables();
    const existing = await db.discussionLike.findUnique({
        where: { discussionId_userId: { discussionId, userId } }
    });
    if (existing) {
        await db.discussionLike.delete({ where: { id: existing.id } });
        await db.problemDiscussion.update({ where: { id: discussionId }, data: { likeCount: { decrement: 1 } } });
        return { liked: false };
    }

    await db.discussionLike.create({ data: { discussionId, userId } });
    await db.problemDiscussion.update({ where: { id: discussionId }, data: { likeCount: { increment: 1 } } });
    return { liked: true };
}
