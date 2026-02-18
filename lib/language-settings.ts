import { db } from "@/lib/db";
import { DEFAULT_ALLOWED_LANGUAGES, isSupportedLanguage, type SupportedLanguage } from "@/lib/languages";
import { randomUUID } from "crypto";

const SETTINGS_KEY = "allowed_languages";
const CREATE_SETTINGS_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS "PlatformSetting" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "key" TEXT NOT NULL UNIQUE,
        "value" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`;

function normalizeLanguages(input: string[]): SupportedLanguage[] {
    const deduped = Array.from(new Set(input.map((value) => value.trim()).filter(Boolean)));
    const valid = deduped.filter(isSupportedLanguage) as SupportedLanguage[];

    if (valid.length === 0) {
        return [...DEFAULT_ALLOWED_LANGUAGES];
    }

    return valid;
}

export async function getAllowedLanguages(): Promise<SupportedLanguage[]> {
    try {
        const rows = await db.$queryRaw<Array<{ value: string }>>`
            SELECT "value"
            FROM "PlatformSetting"
            WHERE "key" = ${SETTINGS_KEY}
            LIMIT 1
        `;
        const settingValue = rows[0]?.value;

        if (!settingValue) {
            return [...DEFAULT_ALLOWED_LANGUAGES];
        }

        return normalizeLanguages(settingValue.split(","));
    } catch {
        return [...DEFAULT_ALLOWED_LANGUAGES];
    }
}

export async function setAllowedLanguages(languages: string[]): Promise<SupportedLanguage[]> {
    const normalized = normalizeLanguages(languages);
    const value = normalized.join(",");

    await db.$executeRawUnsafe(CREATE_SETTINGS_TABLE_SQL);

    await db.$executeRaw`
        INSERT INTO "PlatformSetting" ("id", "key", "value", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${SETTINGS_KEY}, ${value}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT("key")
        DO UPDATE SET
            "value" = excluded."value",
            "updatedAt" = CURRENT_TIMESTAMP
    `;

    return normalized;
}

export { SETTINGS_KEY };
