import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TRACERS_DIR = path.join(__dirname, "..", "tracers");

const TIMEOUT_MS = 15000;
const MAX_CODE_LENGTH = 50000;

/**
 * POST /api/visualize
 * Body: { language: "python"|"c"|"cpp"|"java"|"javascript", code: string, stdin?: string }
 * Returns: { traces: [...], error?: string, stdout?: string }
 */
export const visualizeCode = async (req, res) => {
  const { language, code, stdin } = req.body;

  if (!language || !code) {
    return res.status(400).json({ error: "Missing required fields: language, code" });
  }

  if (code.length > MAX_CODE_LENGTH) {
    return res.status(400).json({ error: `Code too long. Maximum ${MAX_CODE_LENGTH} characters.` });
  }

  const supportedLangs = ["python", "c", "cpp", "java", "javascript"];
  if (!supportedLangs.includes(language)) {
    return res.status(400).json({ error: `Unsupported language: ${language}. Supported: ${supportedLangs.join(", ")}` });
  }

  // Create temp files for code and stdin
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbitide-viz-"));

  const extMap = { python: ".py", c: ".c", cpp: ".cpp", java: ".java", javascript: ".js" };
  const codeFile = path.join(tmpDir, `code${extMap[language]}`);
  const stdinFile = path.join(tmpDir, "stdin.txt");

  try {
    fs.writeFileSync(codeFile, code, "utf-8");
    if (stdin) {
      fs.writeFileSync(stdinFile, stdin, "utf-8");
    }

    let result;
    switch (language) {
      case "python":
        result = await runTracer("python", [
          path.join(TRACERS_DIR, "python_tracer.py"),
          codeFile,
          ...(stdin ? [stdinFile] : [])
        ]);
        break;

      case "c":
      case "cpp":
        result = await runTracer("python", [
          path.join(TRACERS_DIR, "cpp_tracer.py"),
          codeFile,
          language,
          ...(stdin ? [stdinFile] : [])
        ]);
        break;

      case "java":
        result = await runTracer("python", [
          path.join(TRACERS_DIR, "java_tracer.py"),
          codeFile,
          ...(stdin ? [stdinFile] : [])
        ]);
        break;

      case "javascript":
        result = await runTracer("node", [
          path.join(TRACERS_DIR, "js_tracer.js"),
          codeFile,
          ...(stdin ? [stdinFile] : [])
        ]);
        break;
    }

    return res.json(result);

  } catch (err) {
    console.error("Visualizer error:", err);
    return res.status(500).json({
      error: err.message || "Internal server error during code visualization.",
      traces: []
    });
  } finally {
    // Cleanup temp files
    cleanup(tmpDir);
  }
};

/**
 * Spawn a child process to run a tracer script.
 * Returns parsed JSON output from the tracer's stdout.
 */
function runTracer(command, args) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const child = spawn(command, args, {
      timeout: TIMEOUT_MS,
      windowsHide: true,
    });

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (exitCode) => {
      // Try to parse stdout as JSON
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        // If JSON parsing fails, return stderr or stdout as error
        if (stderr.trim()) {
          resolve({ error: stderr.trim(), traces: [] });
        } else if (stdout.trim()) {
          resolve({ error: `Tracer output is not valid JSON: ${stdout.substring(0, 500)}`, traces: [] });
        } else {
          resolve({ error: `Tracer exited with code ${exitCode} and no output.`, traces: [] });
        }
      }
    });

    child.on("error", (err) => {
      if (err.code === "ENOENT") {
        resolve({ error: `Command "${command}" not found. Please install the required runtime.`, traces: [] });
      } else {
        reject(err);
      }
    });

    // Handle timeout
    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch (e) { /* ignore */ }
      resolve({ error: "Execution timed out (15s). Possible infinite loop.", traces: [] });
    }, TIMEOUT_MS);
  });
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
}
