import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createProblemRevision, nextProblemRevisionVersion } from "@/lib/problem-revision";
import { appendAdminActionLog } from "@/lib/admin-action-log";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

type ScopeMode = "all" | "selected" | "search";

type RewriteRequest = {
  prompt: string;
  mode: ScopeMode;
  selectedProblemIds?: string[];
  searchQuery?: string;
  limit?: number;
};

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

function cleanString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

async function rewriteOneProblem(params: {
  problem: {
    id: string;
    title: string;
    description: string;
    inputDesc: string | null;
    outputDesc: string | null;
    tags: string;
  };
  prompt: string;
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
        content:
          "You are an expert Korean competitive-programming statement editor. Apply the admin instruction to this problem while preserving solvability and I/O semantics unless explicitly asked. Return JSON only with keys: title, description, inputDesc, outputDesc, tags."
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            adminPrompt: params.prompt,
            problem: {
              title: params.problem.title,
              description: params.problem.description,
              inputDesc: params.problem.inputDesc || "",
              outputDesc: params.problem.outputDesc || "",
              tags: params.problem.tags
            },
            safetyRules: [
              "Do not make the problem unsolvable.",
              "Do not remove required input/output fields.",
              "Use Korean text for natural-language descriptions.",
              "Keep output strictly as JSON."
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
  const json = parseModelJson(content);
  if (!json || typeof json !== "object") {
    throw new Error("Invalid JSON response from AI");
  }

  const obj = json as Record<string, unknown>;
  return {
    title: cleanString(obj.title, params.problem.title),
    description: cleanString(obj.description, params.problem.description),
    inputDesc: cleanString(obj.inputDesc, params.problem.inputDesc || ""),
    outputDesc: cleanString(obj.outputDesc, params.problem.outputDesc || ""),
    tags: cleanString(obj.tags, params.problem.tags)
  };
}

export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

    const body = (await req.json()) as RewriteRequest;
    const prompt = (body.prompt || "").trim();
    const mode = body.mode;
    const limit = Math.max(1, Math.min(Number(body.limit || 30), 200));

    if (!prompt) return new NextResponse("Prompt is required", { status: 400 });
    if (!mode || !["all", "selected", "search"].includes(mode)) {
      return new NextResponse("Invalid mode", { status: 400 });
    }

    let targets: Array<{
      id: string;
      title: string;
      description: string;
      inputDesc: string | null;
      outputDesc: string | null;
      tags: string;
      timeLimit: number;
      memoryLimit: number;
    }> = [];

    if (mode === "all") {
      targets = await db.problem.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          inputDesc: true,
          outputDesc: true,
          tags: true,
          timeLimit: true,
          memoryLimit: true
        },
        orderBy: { number: "asc" },
        take: limit
      });
    } else if (mode === "selected") {
      const ids = (body.selectedProblemIds || []).filter((v) => typeof v === "string" && v.length > 0).slice(0, 300);
      if (ids.length === 0) return new NextResponse("selectedProblemIds is empty", { status: 400 });
      targets = await db.problem.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          title: true,
          description: true,
          inputDesc: true,
          outputDesc: true,
          tags: true,
          timeLimit: true,
          memoryLimit: true
        },
        orderBy: { number: "asc" }
      });
    } else {
      const q = (body.searchQuery || "").trim();
      if (!q) return new NextResponse("searchQuery is required in search mode", { status: 400 });
      const numberQuery = Number(q);
      targets = await db.problem.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
            { tags: { contains: q } },
            ...(Number.isFinite(numberQuery) ? [{ number: numberQuery }] : [])
          ]
        },
        select: {
          id: true,
          title: true,
          description: true,
          inputDesc: true,
          outputDesc: true,
          tags: true,
          timeLimit: true,
          memoryLimit: true
        },
        orderBy: { number: "asc" },
        take: limit
      });
    }

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const updatedIds: string[] = [];

    for (const problem of targets) {
      try {
        const edited = await rewriteOneProblem({ problem, prompt });
        const changed =
          edited.title !== problem.title ||
          edited.description !== problem.description ||
          edited.inputDesc !== (problem.inputDesc || "") ||
          edited.outputDesc !== (problem.outputDesc || "") ||
          edited.tags !== problem.tags;

        if (!changed) {
          skipped += 1;
          continue;
        }

        const updatedProblem = await db.problem.update({
          where: { id: problem.id },
          data: {
            title: edited.title,
            description: edited.description,
            inputDesc: edited.inputDesc || null,
            outputDesc: edited.outputDesc || null,
            tags: edited.tags
          }
        });

        const nextVersion = await nextProblemRevisionVersion(problem.id);
        await createProblemRevision({
          problemId: problem.id,
          version: nextVersion,
          title: updatedProblem.title,
          description: updatedProblem.description,
          inputDesc: updatedProblem.inputDesc,
          outputDesc: updatedProblem.outputDesc,
          timeLimit: updatedProblem.timeLimit,
          memoryLimit: updatedProblem.memoryLimit,
          tags: updatedProblem.tags,
          createdBy: admin.id
        });

        updated += 1;
        updatedIds.push(problem.id);
      } catch (error) {
        errors += 1;
        console.error("[AI_MANAGE_REWRITE_ITEM]", problem.id, error);
      }
    }

    const summary = {
      scanned: targets.length,
      updated,
      skipped,
      errors,
      updatedIds
    };

    await appendAdminActionLog({
      action: "AI_PROBLEM_REWRITE",
      adminId: admin.id,
      target: { mode, limit, searchQuery: body.searchQuery || null, selectedCount: body.selectedProblemIds?.length || 0 },
      result: summary
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[AI_MANAGE_REWRITE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
