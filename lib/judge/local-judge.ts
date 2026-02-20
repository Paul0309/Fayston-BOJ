import { db } from "../db";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { decodeSubmissionDetail, encodeSubmissionDetail, type SubmissionGroupScoreMeta } from "@/lib/submission-meta";

type JudgeResult = {
    status: "ACCEPTED" | "PARTIAL" | "WRONG_ANSWER" | "TLE" | "RUNTIME_ERROR" | "COMPILATION_ERROR";
    timeUsed: number;
    memoryUsed: number;
    detail?: string;
    failedCase?: number;
    expectedOutput?: string;
    actualOutput?: string;
    totalScore?: number;
    maxScore?: number;
};

type ExecError = {
    type?: "TLE" | "ERROR";
    stderr?: string;
};

function toExecError(error: unknown): ExecError {
    if (typeof error === "object" && error !== null) {
        return error as ExecError;
    }
    return {};
}

const TIMEOUT_BUFFER = 1000;

const LANG_CONFIG: Record<string, {
    compile?: (filePath: string) => Promise<void>;
    run: (filePath: string) => { cmd: string, args: string[] };
    extension: string;
}> = {
    cpp: {
        compile: async (filePath) => {
            const exePath = path.join(path.dirname(filePath), `Main${process.platform === "win32" ? ".exe" : ""}`);
            await execPromise("g++", ["-std=c++17", "-O2", filePath, "-o", exePath]);
        },
        run: (filePath) => {
            const exePath = path.join(path.dirname(filePath), `Main${process.platform === "win32" ? ".exe" : ""}`);
            return { cmd: exePath, args: [] };
        },
        extension: "cpp"
    },
    python: {
        run: (filePath) => ({ cmd: "python3", args: ["-u", filePath] }),
        extension: "py"
    },
    javascript: {
        run: (filePath) => ({ cmd: "node", args: [filePath] }),
        extension: "js"
    },
    java: {
        compile: async (filePath) => {
            await execPromise("javac", ["-encoding", "UTF-8", filePath]);
        },
        run: (filePath) => {
            const dir = path.dirname(filePath);
            const filename = path.basename(filePath, ".java");
            return { cmd: "java", args: ["-Dfile.encoding=UTF-8", "-cp", dir, filename] };
        },
        extension: "java"
    }
};

async function logDebug(msg: string) {
    const logPath = path.join(process.cwd(), "judge_debug.log");
    const time = new Date().toISOString();
    await fs.appendFile(logPath, `[${time}] ${msg}\n`);
}

async function updatePendingProgress(submissionId: string, processed: number, total: number) {
    const safeTotal = Math.max(1, total);
    const percent = Math.min(100, Math.floor((processed / safeTotal) * 100));
    const existing = await db.submission.findUnique({
        where: { id: submissionId },
        select: { detail: true }
    });
    const previous = decodeSubmissionDetail(existing?.detail);

    await db.submission.update({
        where: { id: submissionId },
        data: {
            status: "PENDING",
            detail: encodeSubmissionDetail(`채점 진행 중 ${percent}% (${processed}/${safeTotal})`, previous.meta || undefined)
        }
    });
}

function execPromise(cmd: string, args: string[], input?: string, timeout?: number): Promise<{ stdout: string, stderr: string, time: number }> {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const child = spawn(cmd, args, {
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, PYTHONIOENCODING: "utf-8" }
        });

        let stdout = "";
        let stderr = "";
        let killed = false;

        if (timeout) {
            setTimeout(() => {
                killed = true;
                child.kill();
                reject({ type: "TLE" });
            }, timeout);
        }

        if (typeof input === "string") {
            try {
                child.stdin.write(input);
                child.stdin.end();
            } catch (e) {
                void logDebug(`Stdin Error: ${e}`);
            }
        }

        child.stdout.on("data", (data) => { stdout += data.toString(); });
        child.stderr.on("data", (data) => { stderr += data.toString(); });

        child.on("close", (code) => {
            if (killed) return;
            const end = Date.now();
            if (code !== 0) {
                void logDebug(`Process exited with code ${code}. Stderr: ${stderr}`);
                reject({ type: "ERROR", stderr });
            } else {
                resolve({ stdout, stderr, time: end - start });
            }
        });

        child.on("error", (err) => {
            void logDebug(`Spawn Error: ${err.message}`);
            if (!killed) reject({ type: "ERROR", stderr: err.message });
        });
    });
}

export async function runLocalJudge(submissionId: string, problemId: string, code: string, language: string, userId: string) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "boj-"));
    const config = LANG_CONFIG[language];

    await logDebug(`Starting judge for submission ${submissionId} (Language: ${language})`);

    if (!config) {
        return updateStatus(submissionId, "RUNTIME_ERROR", 0, 0, {
            detail: "지원하지 않는 언어입니다.",
            totalScore: 0,
            maxScore: 0
        });
    }

    const filePath = path.join(tmpDir, `Main.${config.extension}`);
    await fs.writeFile(filePath, code);

    try {
        if (config.compile) {
            try {
                await config.compile(filePath);
            } catch (e: unknown) {
                const execError = toExecError(e);
                await logDebug(`Compilation Error: ${execError.stderr}`);
                return updateStatus(submissionId, "COMPILATION_ERROR", 0, 0, {
                    detail: "컴파일 에러",
                    actualOutput: execError.stderr || "컴파일 실패",
                    totalScore: 0,
                    maxScore: 0
                });
            }
        }

        const problem = await db.problem.findUnique({
            where: { id: problemId },
            include: { testCases: { orderBy: { id: "asc" } } }
        });

        if (!problem) throw new Error("Problem not found");

        let maxTime = 0;
        let totalScore = 0;
        const maxScore = problem.testCases.reduce((acc, tc) => acc + tc.score, 0);
        const totalCases = problem.testCases.length;
        await updatePendingProgress(submissionId, 0, totalCases);
        let sawRuntimeError = false;
        let sawTle = false;
        let firstFailure: {
            failedCase: number;
            expectedOutput?: string;
            actualOutput?: string;
            detail: string;
        } | null = null;
        const groups: SubmissionGroupScoreMeta[] = [];

        // Build contiguous case ranges by group for subgroup scoring reports.
        for (let i = 0; i < problem.testCases.length; i++) {
            const tc = problem.testCases[i];
            const last = groups[groups.length - 1];
            if (last && last.groupName === tc.groupName && last.isHidden === tc.isHidden) {
                last.end = i + 1;
                last.totalCases += 1;
                last.maxScore += tc.score;
            } else {
                groups.push({
                    start: i + 1,
                    end: i + 1,
                    groupName: tc.groupName || (tc.isHidden ? "hidden" : "sample"),
                    isHidden: tc.isHidden,
                    maxScore: tc.score,
                    earnedScore: 0,
                    totalCases: 1,
                    passedCases: 0
                });
            }
        }

        function markPass(caseIndex1Based: number, caseScore: number) {
            const group = groups.find((g) => caseIndex1Based >= g.start && caseIndex1Based <= g.end);
            if (!group) return;
            group.earnedScore += caseScore;
            group.passedCases += 1;
        }

        for (let i = 0; i < problem.testCases.length; i++) {
            await updatePendingProgress(submissionId, i + 1, totalCases);
            const verifyCase = problem.testCases[i];
            const { cmd, args } = config.run(filePath);
            try {
                const { stdout, time } = await execPromise(cmd, args, verifyCase.input, problem.timeLimit + TIMEOUT_BUFFER);
                const expected = verifyCase.output.trim().replace(/\r\n/g, "\n");
                const actual = stdout.trim().replace(/\r\n/g, "\n");

                if (expected !== actual) {
                    await logDebug(`WA: Expected '${expected}', Got '${actual}'`);
                    if (!firstFailure) {
                        firstFailure = {
                            failedCase: i + 1,
                            expectedOutput: expected,
                            actualOutput: actual,
                            detail: "출력 형식 또는 값이 정답과 다릅니다."
                        };
                    }
                    continue;
                }

                totalScore += verifyCase.score;
                maxTime = Math.max(maxTime, time);
                markPass(i + 1, verifyCase.score);
            } catch (e: unknown) {
                const execError = toExecError(e);
                if (execError.type === "TLE") {
                    await logDebug("TLE: Time Limit Exceeded");
                    sawTle = true;
                    if (!firstFailure) {
                        firstFailure = {
                            failedCase: i + 1,
                            detail: "시간 제한 초과"
                        };
                    }
                    continue;
                }

                await logDebug(`Runtime Error [${language}]: ${execError.stderr || "Unknown Error"}`);
                sawRuntimeError = true;
                if (!firstFailure) {
                    firstFailure = {
                        failedCase: i + 1,
                        detail: "런타임 에러",
                        actualOutput: execError.stderr || "Unknown Error"
                    };
                }
            }
        }

        const isAccepted = maxScore > 0 ? totalScore === maxScore : !firstFailure;
        const status = isAccepted
            ? "ACCEPTED"
            : totalScore > 0
                ? "PARTIAL"
                : sawTle
                    ? "TLE"
                    : sawRuntimeError
                        ? "RUNTIME_ERROR"
                        : "WRONG_ANSWER";

        const detail =
            status === "ACCEPTED"
                ? "정답입니다!"
                : status === "PARTIAL"
                    ? `부분 점수 (${totalScore} / ${maxScore})`
                    : firstFailure?.detail || "채점 실패";
        const detailWithMeta = encodeSubmissionDetail(detail, { groupScores: groups });

        if (status === "ACCEPTED") {
            try {
                const alreadySolved = await db.submission.findFirst({
                    where: {
                        userId,
                        problemId,
                        status: "ACCEPTED",
                        id: { not: submissionId }
                    }
                });

                if (!alreadySolved) {
                    await db.user.update({
                        where: { id: userId },
                        data: { solvedCount: { increment: 1 } }
                    });
                }
            } catch (e) {
                console.error("Failed to update solved count:", e);
            }
        }

        return updateStatus(submissionId, status, maxTime, 0, {
            detail: detailWithMeta,
            failedCase: firstFailure?.failedCase,
            expectedOutput: firstFailure?.expectedOutput,
            actualOutput: firstFailure?.actualOutput,
            totalScore,
            maxScore
        });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        await logDebug(`System Error: ${errorMessage}`);
        return updateStatus(submissionId, "RUNTIME_ERROR", 0, 0, {
            detail: "채점 시스템 오류",
            actualOutput: errorMessage,
            totalScore: 0,
            maxScore: 0
        });
    } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
}

async function updateStatus(
    id: string,
    status: string,
    time: number,
    memory: number,
    extras?: Partial<JudgeResult>
) {
    const submission = await db.submission.findUnique({
        where: { id },
        select: { codeVisibility: true, detail: true }
    });
    const visibility = submission?.codeVisibility || "PRIVATE";
    const previous = decodeSubmissionDetail(submission?.detail);
    const incoming = decodeSubmissionDetail(extras?.detail);
    const mergedMeta =
        previous.meta || incoming.meta
            ? {
                  ...(previous.meta || {}),
                  ...(incoming.meta || {})
              }
            : undefined;
    const mergedDetail = encodeSubmissionDetail(incoming.message || extras?.detail || "", mergedMeta);

    return db.submission.update({
        where: { id },
        data: {
            status,
            isPublic: visibility === "PUBLIC" || (visibility === "ACCEPTED_ONLY" && status === "ACCEPTED"),
            timeUsed: time,
            memoryUsed: memory,
            detail: mergedDetail,
            failedCase: extras?.failedCase,
            expectedOutput: extras?.expectedOutput,
            actualOutput: extras?.actualOutput,
            totalScore: extras?.totalScore,
            maxScore: extras?.maxScore
        }
    });
}
