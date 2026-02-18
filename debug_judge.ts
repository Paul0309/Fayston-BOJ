
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

async function testJudge() {
    console.log("Starting Test Judge...");

    // Mock Code (A+B)
    const code = `
import sys
try:
    line = sys.stdin.read()
    if not line:
        print("No input")
        sys.exit(0)
    a, b = map(int, line.split())
    print(a + b)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
`;

    const input = "1 2";
    const expected = "3";

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'boj-test-'));
    const filePath = path.join(tmpDir, 'Main.py');

    await fs.writeFile(filePath, code);
    console.log(`Code written to ${filePath}`);

    try {
        const process = spawn("python", ["-u", filePath], { stdio: ['pipe', 'pipe', 'pipe'] });

        let stdout = "";
        let stderr = "";

        process.stdout.on("data", (data) => stdout += data.toString());
        process.stderr.on("data", (data) => stderr += data.toString());

        process.on("close", (code) => {
            console.log(`Process exited with code ${code}`);
            console.log(`STDOUT: '${stdout.trim()}'`);
            console.log(`STDERR: '${stderr.trim()}'`);

            if (stdout.trim() === expected) {
                console.log("SUCCESS: Output matches expected.");
            } else {
                console.log("FAILURE: Output mismatch.");
            }

            fs.rm(tmpDir, { recursive: true, force: true }).catch(() => { });
        });

        // Write input
        process.stdin.write(input);
        process.stdin.end();

    } catch (e) {
        console.error("Spawn Error:", e);
    }
}

testJudge();
