export type ProblemTextLike = {
  title: string;
  description?: string | null;
};

export type SimilarityResult<T> = {
  item: T;
  score: number;
};

function normalizeText(value?: string | null) {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(value?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) return new Set<string>();
  const tokens = normalized.match(/[a-z0-9가-힣_]+/g) || [];
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function calcProblemSimilarity(a: ProblemTextLike, b: ProblemTextLike) {
  const titleSim = jaccard(tokenize(a.title), tokenize(b.title));
  const descSim = jaccard(tokenize(a.description), tokenize(b.description));
  return titleSim * 0.6 + descSim * 0.4;
}

export function findTopSimilarProblems<T extends ProblemTextLike>(
  source: ProblemTextLike,
  candidates: T[],
  limit = 5
): Array<SimilarityResult<T>> {
  return candidates
    .map((item) => ({ item, score: calcProblemSimilarity(source, item) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, Math.max(1, limit));
}

