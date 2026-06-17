/**
 * JavaScript Code Tracer for orbitIDE Visualizer (Node.js backend)
 * Instruments JavaScript code with try-catch scope captures and runs
 * it inside a Node.js VM sandbox with stdin support.
 * 
 * Usage: node js_tracer.js <code_file> [stdin_file]
 * Outputs JSON trace to stdout.
 */

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const MAX_STEPS = 2000;

function main() {
  const codeFile = process.argv[2];
  const stdinFile = process.argv[3] || null;

  if (!codeFile) {
    console.log(JSON.stringify({ error: "No code file provided" }));
    process.exit(1);
  }

  let code;
  try {
    code = fs.readFileSync(codeFile, "utf-8");
  } catch (e) {
    console.log(JSON.stringify({ error: `Failed to read code file: ${e.message}` }));
    process.exit(1);
  }

  let stdinData = "";
  if (stdinFile) {
    try {
      stdinData = fs.readFileSync(stdinFile, "utf-8");
    } catch (e) {
      // Ignore missing stdin
    }
  }

  const capturedTraces = [];
  const capturedStdout = [];

  const record = (lineNum, variableScope) => {
    if (capturedTraces.length >= MAX_STEPS) return;
    const scopeClone = {};
    for (const key in variableScope) {
      if (typeof variableScope[key] === "function") continue;
      if (typeof variableScope[key] === "object" && variableScope[key] !== null) {
        try {
          scopeClone[key] = JSON.parse(JSON.stringify(variableScope[key]));
        } catch (e) {
          scopeClone[key] = "[Circular]";
        }
      } else {
        scopeClone[key] = variableScope[key];
      }
    }
    capturedTraces.push({
      line: lineNum,
      event: "step_line",
      func: "main",
      variables: scopeClone,
      stdout: capturedStdout.join("")
    });
  };

  // Parse and instrument the code
  const lines = code.split("\n");
  const declaredVars = new Set();

  // First pass: discover variables
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;

    const varMatches = trimmed.matchAll(/\b(let|const|var)\s+(\w+)\b/g);
    for (const match of varMatches) {
      declaredVars.add(match[2]);
    }

    const funcMatches = trimmed.matchAll(/\bfunction\s+(\w+)\s*\(([^)]*)\)/g);
    for (const match of funcMatches) {
      declaredVars.add(match[1]);
      const params = match[2].split(",").map(p => p.trim().split("=")[0].trim())
        .filter(p => p && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p));
      for (const p of params) declaredVars.add(p);
    }
  }

  // Build scope expression
  const getScopeExpr = () => {
    if (declaredVars.size === 0) return "{}";
    const assignments = Array.from(declaredVars)
      .map((v) => `try { _s.${v} = ${v}; } catch(e) {}`)
      .join(" ");
    return `(() => { let _s = {}; ${assignments} return _s; })()`;
  };

  // Second pass: instrument each line
  const instrumentedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
      instrumentedLines.push(rawLine);
      continue;
    }
    instrumentedLines.push(`__recordStep(${i + 1}, ${getScopeExpr()});`);
    instrumentedLines.push(rawLine);
  }
  instrumentedLines.push(`__recordStep(${lines.length}, ${getScopeExpr()});`);

  const instrumentedCode = instrumentedLines.join("\n");

  // Create sandbox context
  const mockFs = {
    readFileSync: (fd, encoding) => stdinData
  };

  const mockRequire = (modName) => {
    if (modName === "fs") return mockFs;
    throw new Error(`Module "${modName}" is not available in the visualizer sandbox.`);
  };

  const mockConsole = {
    log: (...args) => {
      capturedStdout.push(args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ") + "\n");
    },
    error: (...args) => {
      capturedStdout.push("[stderr] " + args.map(a => String(a)).join(" ") + "\n");
    },
    warn: (...args) => {
      capturedStdout.push("[warn] " + args.map(a => String(a)).join(" ") + "\n");
    }
  };

  const mockProcess = {
    stdin: { fd: 0, read: () => stdinData },
    stdout: { write: (s) => capturedStdout.push(s) },
    exit: (code) => { throw new Error(`process.exit(${code})`); }
  };

  const sandbox = {
    __recordStep: record,
    console: mockConsole,
    require: mockRequire,
    process: mockProcess,
    Math,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Number,
    String,
    Boolean,
    Array,
    Object,
    JSON,
    Map,
    Set,
    Date,
    RegExp,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    Infinity,
    NaN,
    undefined,
    setTimeout: () => {},
    setInterval: () => {},
    clearTimeout: () => {},
    clearInterval: () => {},
  };

  let errorMsg = null;
  try {
    vm.createContext(sandbox);
    vm.runInContext(instrumentedCode, sandbox, { timeout: 10000 });
  } catch (e) {
    errorMsg = e.message || "Execution failed";
  }

  const result = { traces: capturedTraces };
  if (errorMsg) result.error = errorMsg;
  if (capturedStdout.length > 0) result.stdout = capturedStdout.join("");

  // Output result to stdout (the real stdout, not the captured one)
  process.stdout.write(JSON.stringify(result));
}

main();
