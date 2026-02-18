import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { Client } from "pg";

type EnvMap = Record<string, string | undefined>;

const TABLE_ORDER = [
  "User",
  "Contest",
  "Problem",
  "TestCase",
  "ProblemAiReview",
  "ProblemRevision",
  "Submission",
  "PlatformSetting",
  "JudgeQueue",
  "ProblemEditorial",
  "ProblemDiscussion",
  "DiscussionLike",
  "AutomationSchedule",
] as const;

function parseEnvFile(filePath: string): EnvMap {
  if (!fs.existsSync(filePath)) return {};
  const out: EnvMap = {};
  const buf = fs.readFileSync(filePath);
  const text =
    buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe
      ? buf.toString("utf16le")
      : buf.toString("utf8");
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnv(): EnvMap {
  return {
    ...parseEnvFile(path.join(process.cwd(), ".env")),
    ...parseEnvFile(path.join(process.cwd(), ".env.local")),
    ...process.env,
  };
}

function getSourcePath(env: EnvMap) {
  const fromEnv = env.SOURCE_SQLITE_PATH;
  if (fromEnv) return path.resolve(process.cwd(), fromEnv);
  return path.resolve(process.cwd(), "prisma", "dev.db");
}

function normalizeTargetUrl(url: string) {
  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) return url;
  throw new Error("TARGET_DATABASE_URL must be a PostgreSQL connection string.");
}

function placeholders(length: number) {
  return Array.from({ length }, (_, i) => `$${i + 1}`).join(", ");
}

function quoteId(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function normalizeValue(column: string, value: unknown) {
  if (typeof value === "number" && (column === "isHidden" || column === "isPublic" || column === "isOfficial" || column === "enabled")) {
    return value === 1;
  }

  const isDateLike = /At$/.test(column);
  if (isDateLike) {
    if (typeof value === "number" && Number.isFinite(value) && value > 100000000000) {
      return new Date(value).toISOString();
    }
    if (typeof value === "string" && /^\d{12,}$/.test(value)) {
      return new Date(Number(value)).toISOString();
    }
  }

  return value;
}

async function main() {
  const env = loadEnv();
  const sourcePath = getSourcePath(env);
  const targetUrlRaw = env.TARGET_DATABASE_URL ?? env.NEON_DATABASE_URL;

  if (!targetUrlRaw) {
    throw new Error("Set TARGET_DATABASE_URL (or NEON_DATABASE_URL) in .env.local first.");
  }
  const targetUrl = normalizeTargetUrl(targetUrlRaw);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`SQLite source file not found: ${sourcePath}`);
  }

  const sqlite = new Database(sourcePath, { readonly: true });
  const pg = new Client({ connectionString: targetUrl });

  try {
    await pg.connect();
    await pg.query("BEGIN");

    await pg.query(`TRUNCATE ${TABLE_ORDER.map((t) => quoteId(t)).join(", ")} RESTART IDENTITY CASCADE`);

    for (const table of TABLE_ORDER) {
      const rows = sqlite.prepare(`SELECT * FROM ${quoteId(table)}`).all() as Record<string, unknown>[];
      if (rows.length === 0) {
        console.log(`[MIGRATE] ${table}: 0 rows`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      const columnSql = columns.map(quoteId).join(", ");
      const valuesSql = placeholders(columns.length);
      const insertSql = `INSERT INTO ${quoteId(table)} (${columnSql}) VALUES (${valuesSql})`;

      for (const row of rows) {
        const values = columns.map((col) => normalizeValue(col, row[col]));
        await pg.query(insertSql, values);
      }
      console.log(`[MIGRATE] ${table}: ${rows.length} rows`);
    }

    await pg.query("COMMIT");
    console.log("[MIGRATE] Done");
  } catch (error) {
    await pg.query("ROLLBACK");
    throw error;
  } finally {
    sqlite.close();
    await pg.end();
  }
}

main().catch((error) => {
  console.error("[MIGRATE] Failed:", error);
  process.exit(1);
});
