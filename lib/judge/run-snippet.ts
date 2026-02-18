import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";

type ExecError = {
  type: "TLE" | "RUNTIME" | "SPAWN";
  stderr?: string;
};

type ExecResult = {
  stdout: string;
  stderr: string;
  timeMs: number;
};

const OUTPUT_LIMIT = 20000;

const LANG_CONFIG: Record<
  string,
  {
    extension: string;
    compile?: (filePath: string) => Promise<void>;
    run: (filePath: string) => { cmd: string; args: string[] };
  }
> = {
  cpp: {
    extension: "cpp",
    compile: async (filePath) => {
      const exePath = path.join(path.dirname(filePath), `Main${process.platform === "win32" ? ".exe" : ""}`);
      await execPromise("g++", ["-std=c++17", "-O2", filePath, "-o", exePath], "", 10000);
    },
    run: (filePath) => {
      const exePath = path.join(path.dirname(filePath), `Main${process.platform === "win32" ? ".exe" : ""}`);
      return { cmd: exePath, args: [] };
    }
  },
  python: {
    extension: "py",
    run: (filePath) => ({ cmd: "python", args: ["-u", filePath] })
  },
  javascript: {
    extension: "js",
    run: (filePath) => ({ cmd: "node", args: [filePath] })
  },
  java: {
    extension: "java",
    compile: async (filePath) => {
      await execPromise("javac", ["-encoding", "UTF-8", filePath], "", 10000);
    },
    run: (filePath) => {
      const dir = path.dirname(filePath);
      return { cmd: "java", args: ["-Dfile.encoding=UTF-8", "-cp", dir, "Main"] };
    }
  }
};

function trimOutput(text: string) {
  if (text.length <= OUTPUT_LIMIT) return text;
  return `${text.slice(0, OUTPUT_LIMIT)}\n\n... (output truncated)`;
}

function execPromise(cmd: string, args: string[], input: string, timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const child = spawn(cmd, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" }
    });

    let stdout = "";
    let stderr = "";
    let finished = false;

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill();
      reject({ type: "TLE", stderr: "Time Limit Exceeded" } satisfies ExecError);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject({ type: "SPAWN", stderr: err.message } satisfies ExecError);
    });

    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject({ type: "RUNTIME", stderr } satisfies ExecError);
        return;
      }
      resolve({
        stdout: trimOutput(stdout),
        stderr: trimOutput(stderr),
        timeMs: Date.now() - start
      });
    });

    if (input.length > 0) child.stdin.write(input);
    child.stdin.end();
  });
}

export async function runSnippet(params: {
  code: string;
  language: "cpp" | "python" | "javascript" | "java";
  input: string;
  timeLimitMs?: number;
}) {
  const config = LANG_CONFIG[params.language];
  if (!config) {
    throw new Error("Unsupported language");
  }

  const timeoutMs = Math.max(500, Math.min(params.timeLimitMs ?? 2000, 10000));
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "boj-run-"));
  const filePath = path.join(tmpDir, `Main.${config.extension}`);

  try {
    await fs.writeFile(filePath, params.code, "utf8");

    if (config.compile) {
      try {
        await config.compile(filePath);
      } catch (error) {
        const e = error as ExecError;
        return {
          ok: false as const,
          status: "COMPILATION_ERROR" as const,
          stdout: "",
          stderr: e.stderr || "Compilation failed",
          timeMs: 0
        };
      }
    }

    try {
      const { cmd, args } = config.run(filePath);
      const res = await execPromise(cmd, args, params.input, timeoutMs);
      return {
        ok: true as const,
        status: "OK" as const,
        stdout: res.stdout,
        stderr: res.stderr,
        timeMs: res.timeMs
      };
    } catch (error) {
      const e = error as ExecError;
      if (e.type === "TLE") {
        return {
          ok: false as const,
          status: "TLE" as const,
          stdout: "",
          stderr: e.stderr || "Time Limit Exceeded",
          timeMs: timeoutMs
        };
      }
      return {
        ok: false as const,
        status: "RUNTIME_ERROR" as const,
        stdout: "",
        stderr: e.stderr || "Runtime Error",
        timeMs: 0
      };
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

