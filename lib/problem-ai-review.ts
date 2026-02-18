import { db } from "@/lib/db";

type ProblemText = {
    id: string;
    number: number;
    title: string;
    description: string;
    inputDesc: string | null;
    outputDesc: string | null;
};

type ReviewResult = {
    needsFix: boolean;
    issues: string[];
    fixedDescription: string;
    fixedInputDesc: string;
    fixedOutputDesc: string;
};

type RunOptions = {
    adminId: string;
    limit?: number;
    retryErrors?: boolean;
    force?: boolean;
};

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function cleanString(value: unknown, fallback: string) {
    return typeof value === "string" && value.trim().length > 0 ? value : fallback;
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

async function requestLatexFix(problem: ProblemText): Promise<ReviewResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY is missing");
    }

    const payload = {
        model: DEFAULT_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content:
                    [
                        "You are a strict Korean competitive-programming statement editor.",
                        "Preserve algorithmic intent and I/O semantics.",
                        "Improve statement quality in two dimensions:",
                        "1) convert math symbols and variable tokens to proper LaTeX inline style (e.g. A,B,N,M,K,X,Y, A+B, i<=N -> $i \\le N$),",
                        "2) enrich weak statements with a concise background story and clearer step-by-step explanation.",
                        "Do not change answer logic, constraints meaning, or sample behavior.",
                        "Return JSON only with keys: needsFix (boolean), issues (string[]), fixedDescription (string), fixedInputDesc (string), fixedOutputDesc (string)."
                    ].join(" ")
            },
            {
                role: "user",
                content: JSON.stringify(
                    {
                        instruction: [
                            "Write all natural-language text in Korean.",
                            "When variables or formulas appear in plain text, rewrite them with LaTeX inline math.",
                            "If description is too short, expand it with: (배경) + (문제 설명) + (핵심 요구사항).",
                            "Do not invent hidden constraints that contradict existing text.",
                            "If text is already high quality, set needsFix=false and return originals."
                        ],
                        problem
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

    const fixedDescription = cleanString(
        (json as { fixedDescription?: unknown }).fixedDescription,
        problem.description
    );
    const fixedInputDesc = cleanString(
        (json as { fixedInputDesc?: unknown }).fixedInputDesc,
        problem.inputDesc || ""
    );
    const fixedOutputDesc = cleanString(
        (json as { fixedOutputDesc?: unknown }).fixedOutputDesc,
        problem.outputDesc || ""
    );

    const changes =
        fixedDescription !== problem.description ||
        fixedInputDesc !== (problem.inputDesc || "") ||
        fixedOutputDesc !== (problem.outputDesc || "");

    return {
        needsFix: Boolean((json as { needsFix?: unknown }).needsFix) || changes,
        issues: Array.isArray((json as { issues?: unknown }).issues)
            ? ((json as { issues: unknown[] }).issues.filter((v) => typeof v === "string") as string[])
            : [],
        fixedDescription,
        fixedInputDesc,
        fixedOutputDesc
    };
}

export async function runProblemAiReviews({ adminId, limit = 30, retryErrors = false, force = false }: RunOptions) {
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const problems = await db.problem.findMany({
        select: { id: true, number: true, title: true, description: true, inputDesc: true, outputDesc: true },
        orderBy: { number: "asc" },
        take: safeLimit
    });

    const reviewRows = await db.problemAiReview.findMany({
        where: { problemId: { in: problems.map((p) => p.id) } },
        select: { problemId: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" }
    });

    const latestReviewByProblem = new Map<string, { status: string; createdAt: Date }>();
    for (const row of reviewRows) {
        if (!latestReviewByProblem.has(row.problemId)) {
            latestReviewByProblem.set(row.problemId, { status: row.status, createdAt: row.createdAt });
        }
    }

    const targetProblems = problems.filter((p) => {
        if (force) return true;
        const latest = latestReviewByProblem.get(p.id);
        if (!latest) return true;
        if (latest.status === "PENDING") return false;
        if (latest.status === "ERROR") return retryErrors;
        return false;
    });

    let created = 0;
    const skipped = problems.length - targetProblems.length;
    let noChange = 0;
    let errors = 0;

    for (const problem of targetProblems) {
        try {
            const result = await requestLatexFix(problem);
            if (!result.needsFix) {
                noChange += 1;
                continue;
            }

            await db.problemAiReview.create({
                data: {
                    problemId: problem.id,
                    status: "PENDING",
                    issues: JSON.stringify(result.issues),
                    proposedDescription: result.fixedDescription,
                    proposedInputDesc: result.fixedInputDesc || null,
                    proposedOutputDesc: result.fixedOutputDesc || null,
                    model: DEFAULT_MODEL,
                    createdBy: adminId
                }
            });
            created += 1;
        } catch (error) {
            errors += 1;
            await db.problemAiReview.create({
                data: {
                    problemId: problem.id,
                    status: "ERROR",
                    issues: JSON.stringify(["AI audit request failed"]),
                    errorMessage: error instanceof Error ? error.message : "Unknown AI audit error",
                    model: DEFAULT_MODEL,
                    createdBy: adminId
                }
            });
        }
    }

    return {
        scanned: problems.length,
        created,
        skipped,
        noChange,
        errors
    };
}
