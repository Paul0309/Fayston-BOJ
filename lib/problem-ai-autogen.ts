import { db } from "@/lib/db";
import { createProblemRevision } from "@/lib/problem-revision";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4-mini";

interface GeneratedProblem {
  title: string;
  difficulty: string;
  tags: string;
  description: string;
  inputDesc: string;
  outputDesc: string;
  timeLimit: number;
  memoryLimit: number;
  testCases: Array<{
    input: string;
    output: string;
    isHidden: boolean;
    score: number;
    groupName: string;
  }>;
}

async function analyzeExistingProblems(limit = 5): Promise<string> {
  const problems = await db.problem.findMany({
    select: {
      title: true,
      difficulty: true,
      tags: true,
      description: true,
      inputDesc: true,
      outputDesc: true,
    },
    orderBy: { number: "desc" },
    take: limit,
  });

  return problems
    .map(
      (p) =>
        `Title: ${p.title}\nDifficulty: ${p.difficulty}\nTags: ${p.tags}\nDescription: ${p.description.substring(0, 200)}...`
    )
    .join("\n\n");
}

async function generateProblemWithAI(referenceProblems: string): Promise<GeneratedProblem | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const difficulties = ["BRONZE_5", "BRONZE_4", "BRONZE_3", "SILVER_5", "SILVER_4"];
  const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];

  const payload = {
    model: DEFAULT_MODEL,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an expert competitive programming problem creator. Based on the reference problems, create a similar but unique problem in Korean. The problem should be original and different from the references. Return JSON with keys: title, description, inputDesc, outputDesc, testCases (array of {input, output}). Make testCases with 2-3 test cases. All text must be in Korean.`,
      },
      {
        role: "user",
        content: `Reference problems:\n${referenceProblems}\n\nCreate a new unique problem with difficulty "${randomDifficulty}". Make it original and creative.`,
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content || "";

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      json = JSON.parse(match[0]);
    }
  }

  if (!json || typeof json !== "object") {
    return null;
  }

  const obj = json as Record<string, unknown>;
  const testCases = (Array.isArray(obj.testCases) ? obj.testCases : []).map((tc: unknown) => {
    if (typeof tc === "object" && tc !== null) {
      const t = tc as Record<string, unknown>;
      return {
        input: String(t.input || ""),
        output: String(t.output || ""),
        isHidden: false,
        score: 50,
        groupName: "sample",
      };
    }
    return { input: "", output: "", isHidden: false, score: 50, groupName: "sample" };
  });

  // Add hidden test case
  if (testCases.length > 0) {
    testCases.push({
      input: testCases[0].input,
      output: testCases[0].output,
      isHidden: true,
      score: 50,
      groupName: "main",
    });
  }

  return {
    title: String(obj.title || "New Problem"),
    difficulty: "SILVER_5",
    tags: "algorithm,implementation",
    description: String(obj.description || "문제 설명"),
    inputDesc: String(obj.inputDesc || "입력 설명"),
    outputDesc: String(obj.outputDesc || "출력 설명"),
    timeLimit: 1000,
    memoryLimit: 128,
    testCases,
  };
}

export async function autoGenerateProblemsWithAI(
  count = 1,
  adminId: string
): Promise<
  Array<{
    id: string;
    number: number;
    title: string;
  }>
> {
  try {
    const created = [];

    // Get existing problems for reference
    const referenceProblemsSummary = await analyzeExistingProblems(5);

    for (let i = 0; i < count; i++) {
      try {
        // Generate problem with AI
        const generated = await generateProblemWithAI(referenceProblemsSummary);

        if (!generated) {
          console.warn(`Failed to generate problem ${i + 1}`);
          continue;
        }

        // Get next problem number
        const lastProblem = await db.problem.findFirst({
          orderBy: { number: "desc" },
          select: { number: true },
        });

        const nextNumber = (lastProblem?.number || 0) + 1;

        // Create problem
        const problem = await db.problem.create({
          data: {
            number: nextNumber,
            title: generated.title,
            difficulty: generated.difficulty,
            tags: generated.tags,
            description: generated.description,
            inputDesc: generated.inputDesc,
            outputDesc: generated.outputDesc,
            timeLimit: generated.timeLimit,
            memoryLimit: generated.memoryLimit,
            testCases: {
              create: generated.testCases,
            },
          },
          include: { testCases: true },
        });

        // Create revision
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
        });

        created.push({
          id: problem.id,
          number: problem.number,
          title: problem.title,
        });

        console.log(`[AUTO_PROBLEM_GEN] Created problem #${problem.number}: ${problem.title}`);
      } catch (err) {
        console.error(`[AUTO_PROBLEM_GEN_ERROR] Problem ${i + 1}:`, err);
      }
    }

    return created;
  } catch (error) {
    console.error("[AUTO_PROBLEM_GEN_MAIN]", error);
    throw error;
  }
}
