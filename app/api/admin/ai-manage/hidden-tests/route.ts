import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { appendAdminActionLog } from "@/lib/admin-action-log";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

type ScopeMode = "all" | "selected" | "search";

type HiddenTestRequest = {
  mode: ScopeMode;
  selectedProblemIds?: string[];
  searchQuery?: string;
  limit?: number;
  hiddenPerProblem?: number;
  onlyIfHiddenLessThan?: number;
};

function normalize(s: string) {
  return s.replace(/\r\n/g, "\n").trim();
}

function safeJsonParse(content: string): unknown {
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

function distributeScores(length: number): number[] {
  if (length <= 0) return [];
  const base = Math.floor(100 / length);
  let remain = 100;
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const score = i === length - 1 ? remain : base;
    out.push(Math.max(1, score));
    remain -= score;
  }
  return out;
}

async function generateHiddenCases(problem: {
  title: string;
  description: string;
  inputDesc: string | null;
  outputDesc: string | null;
  visibleCases: Array<{ input: string; output: string }>;
  existingHiddenCases: Array<{ input: string; output: string }>;
  count: number;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const payload = {
    model: DEFAULT_MODEL,
    temperature: 0.3,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system",
        content: [
          "You are a strict competitive-programming testcase generator.",
          "Generate hidden tests with exact correct outputs.",
          "Do not explain. Return JSON only.",
          "JSON shape: {\"testCases\":[{\"input\":\"...\",\"output\":\"...\"}]}."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            problem: {
              title: problem.title,
              description: problem.description,
              inputDesc: problem.inputDesc || "",
              outputDesc: problem.outputDesc || ""
            },
            visibleCases: problem.visibleCases,
            existingHiddenCases: problem.existingHiddenCases,
            request: {
              hiddenCaseCount: problem.count,
              goals: [
                "Use varied, non-trivial values",
                "Include edge/boundary cases",
                "Avoid duplicates with existing cases"
              ]
            }
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
  const parsed = safeJsonParse(content);
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as { testCases?: unknown };
  const cases = Array.isArray(obj.testCases) ? obj.testCases : [];

  return cases
    .map((tc) => {
      if (!tc || typeof tc !== "object") return null;
      const row = tc as Record<string, unknown>;
      const input = typeof row.input === "string" ? normalize(row.input) : "";
      const output = typeof row.output === "string" ? normalize(row.output) : "";
      if (!input && !output) return null;
      return { input, output };
    })
    .filter((v): v is { input: string; output: string } => Boolean(v));
}

export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

    const body = (await req.json()) as HiddenTestRequest;
    const mode = body.mode;
    const limit = Math.max(1, Math.min(Number(body.limit || 30), 200));
    const hiddenPerProblem = Math.max(1, Math.min(Number(body.hiddenPerProblem || 8), 20));
    const onlyIfHiddenLessThan = Math.max(0, Math.min(Number(body.onlyIfHiddenLessThan || 5), 100));

    if (!mode || !["all", "selected", "search"].includes(mode)) {
      return new NextResponse("Invalid mode", { status: 400 });
    }

    let targets: Array<{ id: string }> = [];
    if (mode === "all") {
      targets = await db.problem.findMany({
        select: { id: true },
        orderBy: { number: "asc" },
        take: limit
      });
    } else if (mode === "selected") {
      const ids = (body.selectedProblemIds || [])
        .filter((v) => typeof v === "string" && v.length > 0)
        .slice(0, 300);
      if (ids.length === 0) return new NextResponse("selectedProblemIds is empty", { status: 400 });
      targets = await db.problem.findMany({
        where: { id: { in: ids } },
        select: { id: true },
        orderBy: { number: "asc" }
      });
    } else {
      const q = (body.searchQuery || "").trim();
      if (!q) return new NextResponse("searchQuery is required in search mode", { status: 400 });
      const numberQuery = Number(q);
      targets = await db.problem.findMany({
        where: {
          OR: [
            ...(Number.isFinite(numberQuery) ? [{ number: numberQuery }] : []),
            { title: { contains: q } },
            { description: { contains: q } },
            { tags: { contains: q } }
          ]
        },
        select: { id: true },
        orderBy: { number: "asc" },
        take: limit
      });
    }

    let updatedProblems = 0;
    let skippedProblems = 0;
    let errorProblems = 0;
    let createdHiddenCases = 0;

    for (const t of targets) {
      try {
        const problem = await db.problem.findUnique({
          where: { id: t.id },
          include: { testCases: true }
        });
        if (!problem) {
          skippedProblems += 1;
          continue;
        }

        const hiddenCount = problem.testCases.filter((tc) => tc.isHidden).length;
        if (hiddenCount >= onlyIfHiddenLessThan) {
          skippedProblems += 1;
          continue;
        }

        const existingKeys = new Set(
          problem.testCases.map((tc) => `${normalize(tc.input)}\n---\n${normalize(tc.output)}`)
        );
        const generated = await generateHiddenCases({
          title: problem.title,
          description: problem.description,
          inputDesc: problem.inputDesc,
          outputDesc: problem.outputDesc,
          visibleCases: problem.testCases.filter((tc) => !tc.isHidden).map((tc) => ({ input: tc.input, output: tc.output })),
          existingHiddenCases: problem.testCases.filter((tc) => tc.isHidden).map((tc) => ({ input: tc.input, output: tc.output })),
          count: hiddenPerProblem
        });

        const uniqueNew = generated
          .filter((tc) => {
            const key = `${normalize(tc.input)}\n---\n${normalize(tc.output)}`;
            if (existingKeys.has(key)) return false;
            existingKeys.add(key);
            return true;
          })
          .slice(0, hiddenPerProblem);

        if (uniqueNew.length === 0) {
          skippedProblems += 1;
          continue;
        }

        await db.$transaction(async (tx) => {
          await tx.testCase.createMany({
            data: uniqueNew.map((tc) => ({
              problemId: problem.id,
              input: tc.input,
              output: tc.output,
              isHidden: true,
              groupName: "hidden-auto",
              score: 1
            }))
          });

          const allCases = await tx.testCase.findMany({
            where: { problemId: problem.id },
            orderBy: { id: "asc" }
          });
          const scores = distributeScores(allCases.length);
          for (let i = 0; i < allCases.length; i++) {
            await tx.testCase.update({
              where: { id: allCases[i].id },
              data: { score: scores[i] }
            });
          }
        });

        updatedProblems += 1;
        createdHiddenCases += uniqueNew.length;
      } catch (error) {
        errorProblems += 1;
        console.error("[AI_MANAGE_HIDDEN_TESTS_ITEM]", t.id, error);
      }
    }

    const summary = {
      scanned: targets.length,
      updatedProblems,
      skippedProblems,
      errorProblems,
      createdHiddenCases
    };

    await appendAdminActionLog({
      action: "AI_HIDDEN_TEST_ENHANCE",
      adminId: admin.id,
      target: {
        mode,
        limit,
        hiddenPerProblem,
        onlyIfHiddenLessThan,
        searchQuery: body.searchQuery || null,
        selectedCount: body.selectedProblemIds?.length || 0
      },
      result: summary
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[AI_MANAGE_HIDDEN_TESTS]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
