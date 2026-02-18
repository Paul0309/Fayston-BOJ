import { db } from "@/lib/db";

const LOG_KEY = "admin.action.logs";
const MAX_LOG_ITEMS = 200;

export type AdminActionLogItem = {
  id: string;
  action: string;
  adminId?: string | null;
  createdAt: string;
  target?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
};

function safeParseLogs(raw: string): AdminActionLogItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is AdminActionLogItem => Boolean(v && typeof v === "object"));
  } catch {
    return [];
  }
}

export async function getAdminActionLogs(limit = 100) {
  const row = await db.platformSetting.findUnique({ where: { key: LOG_KEY } });
  const logs = row ? safeParseLogs(row.value) : [];
  const safeLimit = Math.max(1, Math.min(limit, MAX_LOG_ITEMS));
  return logs.slice(0, safeLimit);
}

export async function appendAdminActionLog(params: {
  action: string;
  adminId?: string | null;
  target?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
}) {
  const row = await db.platformSetting.findUnique({ where: { key: LOG_KEY } });
  const logs = row ? safeParseLogs(row.value) : [];

  const item: AdminActionLogItem = {
    id: crypto.randomUUID(),
    action: params.action,
    adminId: params.adminId || null,
    createdAt: new Date().toISOString(),
    target: params.target,
    result: params.result,
    error: params.error
  };

  const next = [item, ...logs].slice(0, MAX_LOG_ITEMS);
  const value = JSON.stringify(next);

  await db.platformSetting.upsert({
    where: { key: LOG_KEY },
    update: { value },
    create: { key: LOG_KEY, value }
  });
}

