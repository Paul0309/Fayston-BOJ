export type SubmissionGroupScoreMeta = {
  start: number;
  end: number;
  groupName: string;
  isHidden: boolean;
  maxScore: number;
  earnedScore: number;
  totalCases: number;
  passedCases: number;
};

export type SubmissionMeta = {
  groupScores?: SubmissionGroupScoreMeta[];
  hiddenInStatus?: boolean;
  source?: string;
};

const META_PREFIX = "@@META@@";

export function encodeSubmissionDetail(message: string, meta?: SubmissionMeta) {
  if (!meta || Object.keys(meta).length === 0) return message;
  return `${message}\n\n${META_PREFIX}${JSON.stringify(meta)}`;
}

export function decodeSubmissionDetail(detail?: string | null): { message: string; meta: SubmissionMeta | null } {
  const raw = detail || "";
  const index = raw.lastIndexOf(META_PREFIX);
  if (index < 0) return { message: raw, meta: null };

  const message = raw.slice(0, index).trimEnd();
  const metaRaw = raw.slice(index + META_PREFIX.length).trim();
  try {
    const parsed = JSON.parse(metaRaw) as SubmissionMeta;
    return { message, meta: parsed };
  } catch {
    return { message: raw, meta: null };
  }
}

export function isHiddenStatusSubmission(detail?: string | null) {
  const { meta } = decodeSubmissionDetail(detail);
  return meta?.hiddenInStatus === true;
}
