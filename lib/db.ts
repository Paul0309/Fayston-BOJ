import { PrismaClient } from "@prisma/client";

function withQueryParam(url: string, key: string, value: string) {
    const hasQuery = url.includes("?");
    const hasKey = new RegExp(`(?:\\?|&)${key}=`).test(url);
    if (hasKey) return url;
    return `${url}${hasQuery ? "&" : "?"}${key}=${value}`;
}

function buildDatabaseUrl() {
    const raw = process.env.DATABASE_URL;
    if (!raw) return undefined;

    if (raw.startsWith("file:")) {
        let url = raw;
        url = withQueryParam(url, "connection_limit", "1");
        url = withQueryParam(url, "socket_timeout", "60");
        return url;
    }

    return raw;
}

function isFileDatabaseUrl(url: string | undefined) {
    return Boolean(url && url.startsWith("file:"));
}

declare global {
    var prisma: PrismaClient | undefined;
    var prismaInitPromise: Promise<void> | undefined;
}

export const db = globalThis.prisma || new PrismaClient({
    datasources: {
        db: { url: buildDatabaseUrl() }
    }
});

if (process.env.NODE_ENV !== "production") globalThis.prisma = db;

if (!globalThis.prismaInitPromise) {
    globalThis.prismaInitPromise = (async () => {
        try {
            await db.$connect();
            const raw = process.env.DATABASE_URL;
            if (isFileDatabaseUrl(raw)) {
                await db.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
                await db.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
                await db.$queryRawUnsafe("PRAGMA busy_timeout = 10000;");
                await db.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
            }
        } catch (error) {
            console.error("[DB_INIT]", error);
        }
    })();
}
