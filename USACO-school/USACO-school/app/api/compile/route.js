export const runtime = "nodejs";

import { spawn }                  from "child_process";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir }                 from "os";
import { join }                   from "path";

const TIMEOUT_MS = 5000;
const WIN        = process.platform === "win32";

// ─── Spawn a process, pipe stdin, collect stdout/stderr ───────────────────────
// Resolves: { stdout, stderr, code, signal, timedOut }
// Rejects:  only on ENOENT / spawn errors (compiler not found)
function runProcess(cmd, args, { input = "", cwd = undefined, extraEnv = {} } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd,
      shell:       false,        // never use cmd.exe — it re-encodes to system code page
      stdio:       ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env:         { ...process.env, ...extraEnv },
    });

    // Decode output streams explicitly as UTF-8
    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");

    let stdout = "", stderr = "", timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      // Force-kill after 500 ms grace period for processes that ignore SIGTERM
      setTimeout(() => { try { proc.kill("SIGKILL"); } catch {} }, 500);
    }, TIMEOUT_MS);

    proc.stdout.on("data", (d) => { stdout += d; });
    proc.stderr.on("data", (d) => { stderr += d; });

    try { proc.stdin.write(input, "utf8"); proc.stdin.end(); } catch {}

    proc.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 0, signal, timedOut });
    });

    // ENOENT → compiler binary not found on PATH
    proc.on("error", (err) => {
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        reject(new Error(`Compiler not found: '${cmd}'. Make sure it is installed and on PATH.`));
      } else {
        reject(err);
      }
    });
  });
}

// ─── Write source, compile (if needed), run, return results ──────────────────
// Returns { compileResult, runResult } — compileResult is null for Python.
// Temp directory is always cleaned up in the finally block.
async function compileAndRun(language, code, input) {
  const tmpDir = await mkdtemp(join(tmpdir(), "usaco-"));

  try {
    // ── Python ──────────────────────────────────────────────────────────────
    if (language === "python") {
      const file = join(tmpDir, "main.py");
      await writeFile(file, code, "utf8");
      const runResult = await runProcess(
        WIN ? "python" : "python3",
        [file],
        { input, extraEnv: { PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" } }
      );
      return { compileResult: null, runResult };
    }

    // ── C ────────────────────────────────────────────────────────────────────
    if (language === "c") {
      const src = join(tmpDir, "main.c");
      const out = join(tmpDir, WIN ? "main.exe" : "main");
      await writeFile(src, code, "utf8");
      const compileResult = await runProcess("gcc", [src, "-o", out, "-lm", "-w"]);
      if (compileResult.code !== 0) return { compileResult, runResult: null };
      const runResult = await runProcess(out, [], { input });
      return { compileResult, runResult };
    }

    // ── C++ ──────────────────────────────────────────────────────────────────
    if (language === "cpp") {
      const src = join(tmpDir, "main.cpp");
      const out = join(tmpDir, WIN ? "main.exe" : "main");
      await writeFile(src, code, "utf8");
      const compileResult = await runProcess("g++", [src, "-o", out, "-std=c++17", "-lm", "-w"]);
      if (compileResult.code !== 0) return { compileResult, runResult: null };
      const runResult = await runProcess(out, [], { input });
      return { compileResult, runResult };
    }

    // ── Java ─────────────────────────────────────────────────────────────────
    // Notes:
    //   • javac must run from tmpDir so .class files land there
    //   • -encoding UTF-8 tells javac to parse source as UTF-8
    //   • -Dfile.encoding=UTF-8 works on Java 8+ for I/O streams
    //   • -Dstdout.encoding / -Dstderr.encoding were added in Java 17 — NOT used here
    if (language === "java") {
      const src = join(tmpDir, "Main.java");
      await writeFile(src, code, "utf8");
      const compileResult = await runProcess(
        "javac",
        ["-encoding", "UTF-8", src],
        { cwd: tmpDir }
      );
      if (compileResult.code !== 0) return { compileResult, runResult: null };
      const runResult = await runProcess(
        "java",
        ["-Dfile.encoding=UTF-8", "-cp", tmpDir, "Main"],
        { input }
      );
      return { compileResult, runResult };
    }

    throw new Error("Unsupported language.");

  } finally {
    // Always remove the temp directory, even on error
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── POST /api/compile ────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { code, input, language } = await request.json();

    if (typeof code !== "string" || code.trim() === "") {
      return Response.json({ error: "Code is required." }, { status: 400 });
    }
    if (!["c", "cpp", "java", "python"].includes(language)) {
      return Response.json({ error: "Unsupported language." }, { status: 400 });
    }

    const { compileResult, runResult } = await compileAndRun(language, code, String(input ?? ""));

    // Compile error
    if (compileResult !== null && compileResult.code !== 0) {
      return Response.json({
        errorType: "compile",
        error:     (compileResult.stderr || "Compilation failed.").trim(),
        details:   { code: compileResult.code, stdout: compileResult.stdout.trim(), stderr: compileResult.stderr.trim() },
      }, { status: 400 });
    }

    // Time Limit Exceeded
    if (runResult.timedOut) {
      return Response.json({
        errorType: "runtime",
        error:     `Time Limit Exceeded (${TIMEOUT_MS / 1000}s)`,
        details:   { code: -1, signal: "SIGKILL", stdout: runResult.stdout.trim(), stderr: runResult.stderr.trim() },
      }, { status: 400 });
    }

    // Runtime error (non-zero exit code)
    if (runResult.code !== 0) {
      return Response.json({
        errorType: "runtime",
        error:     (runResult.stderr || "Runtime error.").trim(),
        details:   { code: runResult.code, signal: runResult.signal || "", stdout: runResult.stdout.trim(), stderr: runResult.stderr.trim() },
      }, { status: 400 });
    }

    // Success
    return Response.json({
      output:  runResult.stdout.trim(),
      details: { code: runResult.code, stderr: runResult.stderr.trim() },
    });

  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Compiler error." },
      { status: 500 }
    );
  }
}
