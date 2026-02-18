import { PrismaClient } from "@prisma/client";
import { createProblemRevision } from "@/lib/problem-revision";
import { calcProblemSimilarity } from "@/lib/problem-similarity";

type Topic = "math" | "string" | "mixed";

type GeneratedCase = {
  input: string;
  output: string;
  isHidden: boolean;
  score: number;
  groupName: string;
};

type GeneratedProblem = {
  title: string;
  difficulty: string;
  tags: string;
  description: string;
  inputDesc: string;
  outputDesc: string;
  timeLimit: number;
  memoryLimit: number;
  testCases: GeneratedCase[];
};

type AiCase = Partial<GeneratedCase> & {
  input?: unknown;
  output?: unknown;
};

type AiProblemRaw = Partial<GeneratedProblem> & {
  testCases?: unknown;
};

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const MAX_GENERATION_ATTEMPTS = 8;
const MAX_CASES = 20;
const MIN_HIDDEN_CASES = 8;
const SIMILARITY_REJECT_THRESHOLD = 0.82;

function normalize(text: string | null | undefined) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function fingerprint(problem: Pick<GeneratedProblem, "description" | "inputDesc" | "outputDesc">) {
  return [normalize(problem.description), normalize(problem.inputDesc), normalize(problem.outputDesc)].join("||");
}

function parseModelJson(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function sanitizeLine(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\r\n/g, "\n").trim();
  return normalized.length > 0 ? normalized : fallback;
}

function chooseDifficulty(topic: Topic, requested?: string) {
  if (requested && requested.trim()) return requested.trim();
  if (topic === "math") return "SILVER_5";
  if (topic === "string") return "SILVER_4";
  return "SILVER_5";
}

function chooseTags(topic: Topic, rawTags: unknown) {
  const fallbackByTopic: Record<Topic, string> = {
    math: "math,implementation",
    string: "string,implementation",
    mixed: "implementation,simulation"
  };
  const fallback = fallbackByTopic[topic];
  if (typeof rawTags !== "string") return fallback;
  const cleaned = rawTags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5)
    .join(",");
  return cleaned || fallback;
}

function scoreCases(cases: GeneratedCase[]) {
  if (cases.length === 0) return;
  const base = Math.floor(100 / cases.length);
  let remain = 100;
  for (let i = 0; i < cases.length; i++) {
    const score = i === cases.length - 1 ? remain : base;
    cases[i].score = Math.max(1, score);
    remain -= score;
  }
}

function sanitizeCases(raw: unknown): GeneratedCase[] {
  const input = Array.isArray(raw) ? (raw as AiCase[]) : [];
  const parsed: GeneratedCase[] = input
    .slice(0, MAX_CASES)
    .map((tc) => ({
      input: sanitizeLine(tc.input, ""),
      output: sanitizeLine(tc.output, ""),
      isHidden: Boolean(tc.isHidden),
      score: typeof tc.score === "number" && tc.score > 0 ? Math.floor(tc.score) : 0,
      groupName:
        typeof tc.groupName === "string" && tc.groupName.trim()
          ? tc.groupName.trim().slice(0, 30)
          : tc.isHidden
          ? "main"
          : "sample"
    }))
    .filter((tc) => tc.input.length > 0 || tc.output.length > 0);

  if (parsed.length === 0) {
    parsed.push(
      { input: "1\n", output: "1\n", isHidden: false, score: 50, groupName: "sample" },
      { input: "2\n", output: "2\n", isHidden: true, score: 50, groupName: "main" }
    );
    return parsed;
  }

  if (!parsed.some((tc) => !tc.isHidden)) {
    parsed[0].isHidden = false;
    parsed[0].groupName = "sample";
  }
  if (!parsed.some((tc) => tc.isHidden)) {
    const src = parsed[parsed.length - 1];
    parsed.push({
      input: src.input,
      output: src.output,
      isHidden: true,
      score: 0,
      groupName: "main"
    });
  }

  // Keep at least one sample, then aggressively expand hidden tests.
  parsed[0].isHidden = false;
  parsed[0].groupName = "sample";

  let hiddenCount = parsed.filter((tc) => tc.isHidden).length;
  for (let i = 1; i < parsed.length && hiddenCount < MIN_HIDDEN_CASES; i++) {
    if (!parsed[i].isHidden) {
      parsed[i].isHidden = true;
      parsed[i].groupName = "main";
      hiddenCount += 1;
    }
  }
  while (hiddenCount < MIN_HIDDEN_CASES && parsed.length < MAX_CASES) {
    const src = parsed[(hiddenCount % Math.max(parsed.length, 1))] || parsed[0];
    parsed.push({
      input: src.input,
      output: src.output,
      isHidden: true,
      score: 0,
      groupName: "main"
    });
    hiddenCount += 1;
  }

  for (const tc of parsed) {
    if (!tc.groupName.trim()) tc.groupName = tc.isHidden ? "main" : "sample";
  }
  scoreCases(parsed);
  return parsed;
}

function ensureRichDescription(title: string, description: string) {
  const text = description.trim();
  const hasBackground = /(배경|상황|시나리오|story|문제 상황)/i.test(text);
  if (hasBackground) return text;
  return [
    "배경:",
    `${title} 문제는 특정 상황을 정량적으로 계산해 올바른 결과를 출력하는 과정을 다룹니다.`,
    "문제 설명:",
    text
  ].join("\n");
}

function sanitizeProblem(raw: AiProblemRaw, topic: Topic, requestedDifficulty?: string): GeneratedProblem {
  const difficulty = chooseDifficulty(topic, sanitizeLine(raw.difficulty, requestedDifficulty || ""));
  const title = sanitizeLine(raw.title, "새로운 알고리즘 문제").slice(0, 120);
  const description = ensureRichDescription(title, sanitizeLine(raw.description, "문제 설명을 읽고 정답을 출력하세요."));
  const inputDesc = sanitizeLine(raw.inputDesc, "입력 형식은 문제 설명을 따른다.");
  const outputDesc = sanitizeLine(raw.outputDesc, "출력 형식은 문제 설명을 따른다.");
  const timeLimit = typeof raw.timeLimit === "number" && raw.timeLimit > 0 ? Math.floor(raw.timeLimit) : 1000;
  const memoryLimit = typeof raw.memoryLimit === "number" && raw.memoryLimit > 0 ? Math.floor(raw.memoryLimit) : 128;
  const testCases = sanitizeCases(raw.testCases);

  return {
    title,
    difficulty,
    tags: chooseTags(topic, raw.tags),
    description,
    inputDesc,
    outputDesc,
    timeLimit,
    memoryLimit,
    testCases
  };
}

async function analyzeReferenceProblems(db: PrismaClient, topic: Topic, take = 12) {
  const where =
    topic === "mixed"
      ? {}
      : {
          tags: {
            contains: topic
          }
        };

  const rows = await db.problem.findMany({
    where,
    select: {
      number: true,
      title: true,
      difficulty: true,
      tags: true,
      description: true,
      inputDesc: true,
      outputDesc: true
    },
    orderBy: { number: "desc" },
    take
  });

  if (rows.length === 0) return "참조할 기존 문제가 없음";

  return rows
    .map((p) => {
      return [
        `#${p.number} ${p.title}`,
        `difficulty=${p.difficulty} tags=${p.tags}`,
        `description=${normalize(p.description).slice(0, 220)}`,
        `input=${normalize(p.inputDesc).slice(0, 140)}`,
        `output=${normalize(p.outputDesc).slice(0, 140)}`
      ].join("\n");
    })
    .join("\n\n");
}

async function generateOneProblemWithAI(params: {
  db: PrismaClient;
  topic: Topic;
  difficulty?: string;
  referenceSummary: string;
  forbiddenTitles: string[];
  forbiddenFingerprints: string[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const targetDifficulty = chooseDifficulty(params.topic, params.difficulty);
  const payload = {
    model: DEFAULT_MODEL,
    temperature: 0.9,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system",
        content: [
          "You are a Korean competitive-programming problem setter.",
          "Create a genuinely new problem; do not paraphrase existing references.",
          "Return JSON only with keys: title, difficulty, tags, description, inputDesc, outputDesc, timeLimit, memoryLimit, testCases.",
          "testCases must be an array of objects with input, output, isHidden.",
          "Generate many hidden tests: at least 8 hidden cases.",
          "The statement must include:",
          "1) a clear background story paragraph,",
          "2) precise goal and rule explanation,",
          "3) math variables and expressions in LaTeX inline style like $A$, $B$, $N$, $A+B$.",
          "Use Korean for all natural-language text."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            topic: params.topic,
            difficulty: targetDifficulty,
            referenceProblems: params.referenceSummary,
            mustAvoidTitles: params.forbiddenTitles.slice(0, 20),
            mustAvoidFingerprints: params.forbiddenFingerprints.slice(0, 10),
            rules: [
              "기존 문제와 제목/스토리/풀이 아이디어가 겹치지 않게 작성",
              "입출력 형식은 명확하게 구분",
              "샘플 1~3개, hidden 8개 이상 포함",
              "문제 설명은 단문이 아닌 상세 문단 형태"
            ]
          },
          null,
          2
        )
      }
    ]
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content || "";
  const parsed = parseModelJson(content) as AiProblemRaw | null;
  if (!parsed) {
    throw new Error("Invalid AI JSON response");
  }

  return sanitizeProblem(parsed, params.topic, targetDifficulty);
}

function validateGeneratedProblem(problem: GeneratedProblem) {
  const reasons: string[] = [];
  if (!problem.title.trim() || problem.title.trim().length < 3) reasons.push("title_too_short");
  if (!problem.description.trim() || problem.description.trim().length < 50) reasons.push("description_too_short");
  if (!problem.inputDesc.trim()) reasons.push("missing_input_description");
  if (!problem.outputDesc.trim()) reasons.push("missing_output_description");
  if (problem.testCases.length < 2) reasons.push("too_few_testcases");
  if (!problem.testCases.some((tc) => tc.isHidden)) reasons.push("no_hidden_case");
  if (!problem.testCases.some((tc) => !tc.isHidden)) reasons.push("no_sample_case");
  const scoreSum = problem.testCases.reduce((acc, tc) => acc + tc.score, 0);
  if (scoreSum !== 100) reasons.push("score_sum_not_100");

  const uniq = new Set(problem.testCases.map((tc) => `${normalize(tc.input)}\n---\n${normalize(tc.output)}`));
  if (uniq.size !== problem.testCases.length) reasons.push("duplicate_testcases");

  return reasons;
}

export async function autoGenerateProblems(
  db: PrismaClient,
  count: number,
  topic: Topic,
  difficulty?: string,
  createdBy?: string
) {
  const safeCount = Math.min(Math.max(count, 1), 20);
  const existing = await db.problem.findMany({
    select: { title: true, description: true, inputDesc: true, outputDesc: true }
  });

  const existingTitles = new Set(existing.map((p) => normalize(p.title)));
  const existingFingerprints = new Set(
    existing.map((p) =>
      fingerprint({
        description: p.description,
        inputDesc: p.inputDesc || "",
        outputDesc: p.outputDesc || ""
      })
    )
  );

  const last = await db.problem.findFirst({
    orderBy: { number: "desc" },
    select: { number: true }
  });
  let nextNumber = (last?.number || 999) + 1;
  const referenceSummary = await analyzeReferenceProblems(db, topic, 12);
  const created: Array<{ id: string; number: number; title: string }> = [];
  let duplicateRejected = 0;
  let similarityRejected = 0;
  let prevalidationRejected = 0;

  for (let i = 0; i < safeCount; i++) {
    let candidate: GeneratedProblem | null = null;

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      try {
        const generated = await generateOneProblemWithAI({
          db,
          topic,
          difficulty,
          referenceSummary,
          forbiddenTitles: Array.from(existingTitles),
          forbiddenFingerprints: Array.from(existingFingerprints)
        });

        const titleKey = normalize(generated.title);
        const fp = fingerprint(generated);
        if (existingTitles.has(titleKey) || existingFingerprints.has(fp)) {
          duplicateRejected += 1;
          continue;
        }

        const maxSimilarity = existing.reduce((acc, row) => {
          const sim = calcProblemSimilarity(
            { title: generated.title, description: generated.description },
            { title: row.title, description: row.description }
          );
          return Math.max(acc, sim);
        }, 0);
        if (maxSimilarity >= SIMILARITY_REJECT_THRESHOLD) {
          similarityRejected += 1;
          continue;
        }

        const validationErrors = validateGeneratedProblem(generated);
        if (validationErrors.length > 0) {
          prevalidationRejected += 1;
          continue;
        }

        candidate = generated;
        break;
      } catch (err) {
        if (attempt === MAX_GENERATION_ATTEMPTS - 1) throw err;
      }
    }

    if (!candidate) break;

    const problem = await db.problem.create({
      data: {
        number: nextNumber++,
        title: candidate.title,
        difficulty: candidate.difficulty,
        tags: candidate.tags,
        description: candidate.description,
        inputDesc: candidate.inputDesc,
        outputDesc: candidate.outputDesc,
        timeLimit: candidate.timeLimit,
        memoryLimit: candidate.memoryLimit,
        testCases: {
          create: candidate.testCases
        }
      },
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        inputDesc: true,
        outputDesc: true,
        timeLimit: true,
        memoryLimit: true,
        tags: true
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
      createdBy: createdBy || null
    });

    existingTitles.add(normalize(problem.title));
    existingFingerprints.add(
      fingerprint({
        description: problem.description,
        inputDesc: problem.inputDesc || "",
        outputDesc: problem.outputDesc || ""
      })
    );
    created.push({ id: problem.id, number: problem.number, title: problem.title });
  }

  return {
    created,
    report: {
      requestedCount: safeCount,
      createdCount: created.length,
      duplicateRejected,
      similarityRejected,
      prevalidationRejected
    }
  };
}
