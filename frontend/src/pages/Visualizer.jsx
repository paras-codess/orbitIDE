import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { visualizerAPI } from "../services/api.js";
import "./Visualizer.css";

const LANG_OPTIONS = [
  { value: "javascript", label: "JavaScript", monacoLang: "javascript" },
  { value: "python",     label: "Python",     monacoLang: "python" },
  { value: "cpp",        label: "C++",        monacoLang: "cpp" },
  { value: "c",          label: "C",          monacoLang: "c" },
  { value: "java",       label: "Java",       monacoLang: "java" },
];

const BOILERPLATES = {
  javascript: `// Two Sum — JavaScript
let nums = [2, 7, 11, 15];
let target = 9;
let seen = {};
let result = null;

for (let i = 0; i < nums.length; i++) {
  let complement = target - nums[i];
  if (complement in seen) {
    result = [seen[complement], i];
    break;
  }
  seen[nums[i]] = i;
}
`,
  python: `# Two Sum — Python
nums = [2, 7, 11, 15]
target = 9
seen = {}
result = None

for i in range(len(nums)):
    complement = target - nums[i]
    if complement in seen:
        result = [seen[complement], i]
        break
    seen[nums[i]] = i

print("Result:", result)
`,
  cpp: `// Two Sum — C++
#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

int main() {
    vector<int> nums = {2, 7, 11, 15};
    int target = 9;
    unordered_map<int, int> seen;

    for (int i = 0; i < nums.size(); i++) {
        int complement = target - nums[i];
        if (seen.count(complement)) {
            cout << seen[complement] << ", " << i << endl;
            return 0;
        }
        seen[nums[i]] = i;
    }
    return 0;
}
`,
  c: `// Two Sum — C
#include <stdio.h>

int main() {
    int nums[] = {2, 7, 11, 15};
    int target = 9;
    int n = 4;

    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            if (nums[i] + nums[j] == target) {
                printf("%d, %d\\n", i, j);
                return 0;
            }
        }
    }
    return 0;
}
`,
  java: `// Two Sum — Java
import java.util.HashMap;

public class Main {
    public static void main(String[] args) {
        int[] nums = {2, 7, 11, 15};
        int target = 9;
        HashMap<Integer, Integer> seen = new HashMap<>();

        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (seen.containsKey(complement)) {
                System.out.println(seen.get(complement) + ", " + i);
                return;
            }
            seen.put(nums[i], i);
        }
    }
}
`,
};

function Visualizer() {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(BOILERPLATES.javascript);
  const [stdin, setStdin] = useState("");
  const [traces, setTraces] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const [consoleOutput, setConsoleOutput] = useState("");

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  // Handle language change
  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    setCode(BOILERPLATES[newLang] || "");
    setTraces([]);
    setCurrentStep(0);
    setError(null);
    setConsoleOutput("");
  };

  // Clear decorations on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current && decorationsRef.current.length > 0) {
        editorRef.current.deltaDecorations(decorationsRef.current, []);
      }
    };
  }, []);

  // Update line highlight when the active step changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current && traces.length > 0 && currentStep < traces.length) {
      const line = traces[currentStep].line;
      const monaco = monacoRef.current;
      const editor = editorRef.current;

      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
        {
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "visualizer-line-highlight",
            glyphMarginClassName: "visualizer-glyph-arrow",
          },
        },
      ]);
      editor.revealLineInCenterIfOutsideViewport(line);
    } else if (editorRef.current && traces.length === 0) {
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
    }
  }, [currentStep, traces]);

  // ─── Client-side JS instrumentation ───
  const runClientSideJS = () => {
    const capturedTraces = [];

    const record = (lineNum, variableScope) => {
      const scopeClone = {};
      for (const key in variableScope) {
        if (typeof variableScope[key] === "function") continue;
        if (typeof variableScope[key] === "object" && variableScope[key] !== null) {
          try { scopeClone[key] = JSON.parse(JSON.stringify(variableScope[key])); }
          catch (e) { scopeClone[key] = "[Circular]"; }
        } else {
          scopeClone[key] = variableScope[key];
        }
      }
      capturedTraces.push({ line: lineNum, variables: scopeClone });
    };

    window.__recordStep = record;

    const lines = code.split("\n");
    const declaredVars = new Set();

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
      const varMatches = trimmed.matchAll(/\b(let|const|var)\s+(\w+)\b/g);
      for (const match of varMatches) declaredVars.add(match[2]);
      const funcMatches = trimmed.matchAll(/\bfunction\s+(\w+)\s*\(([^)]*)\)/g);
      for (const match of funcMatches) {
        declaredVars.add(match[1]);
        match[2].split(",").map(p => p.trim().split("=")[0].trim())
          .filter(p => p && /^[a-zA-Z_$]\w*$/.test(p)).forEach(p => declaredVars.add(p));
      }
    }

    const getScopeExpr = () => {
      if (declaredVars.size === 0) return "{}";
      const assignments = Array.from(declaredVars)
        .map((v) => `try { _s.${v} = ${v}; } catch(e) {}`)
        .join(" ");
      return `(() => { let _s = {}; ${assignments} return _s; })()`;
    };

    const instrumentedLines = [];
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
        instrumentedLines.push(rawLine);
        continue;
      }
      instrumentedLines.push(`window.__recordStep(${i + 1}, ${getScopeExpr()});`);
      instrumentedLines.push(rawLine);
    }
    instrumentedLines.push(`window.__recordStep(${lines.length}, ${getScopeExpr()});`);

    const runCodeStr = instrumentedLines.join("\n");

    const mockFs = { readFileSync: () => stdin };
    const mockRequire = (mod) => { if (mod === "fs") return mockFs; throw new Error(`Module "${mod}" not available`); };
    const mockProcess = {
      stdin: { fd: 0, read: () => stdin },
      stdout: { write: (s) => console.log(s) },
      exit: (c) => { throw new Error(`process.exit(${c})`); }
    };

    try {
      const executor = new Function("require", "process", runCodeStr);
      executor(mockRequire, mockProcess);
      if (capturedTraces.length === 0) throw new Error("No executable lines found.");

      // Normalize traces to match backend format
      const normalizedTraces = capturedTraces.map(t => ({
        line: t.line,
        event: "step_line",
        func: "main",
        variables: Object.fromEntries(
          Object.entries(t.variables).map(([k, v]) => [k, {
            value: v === null ? null : v === undefined ? "undefined" : typeof v === "object" ? JSON.stringify(v) : v,
            type: v === null ? "null" : typeof v
          }])
        ),
        stdout: ""
      }));

      return { traces: normalizedTraces };
    } catch (err) {
      return { traces: [], error: err.message };
    } finally {
      delete window.__recordStep;
    }
  };

  // ─── Main visualize handler ───
  const handleVisualize = async () => {
    setIsRunning(true);
    setError(null);
    setTraces([]);
    setCurrentStep(0);
    setConsoleOutput("");

    try {
      let result;

      if (language === "javascript") {
        result = runClientSideJS();
      } else {
        // Send to backend API
        result = await visualizerAPI.visualize(language, code, stdin);
      }

      if (result.error) {
        setError(result.error);
      }

      if (result.traces && result.traces.length > 0) {
        setTraces(result.traces);
        setCurrentStep(0);
      }

      if (result.stdout) {
        setConsoleOutput(result.stdout);
      }

    } catch (err) {
      setError(err.message || "Failed to visualize code.");
    } finally {
      setIsRunning(false);
    }
  };

  const currentSnapshot = traces[currentStep] || null;
  const currentLangOption = LANG_OPTIONS.find(l => l.value === language);

  return (
    <div className="visualizer-page container">
      <header className="visualizer-header">
        <h1>Code Execution Visualizer</h1>
        <p>Step through your code line-by-line to watch variable frames and execution flow in real-time.</p>
      </header>

      <div className="visualizer-workspace glass-card">
        {/* Left Panel: Editor + Stdin */}
        <div className="visualizer-editor-section">
          <div className="section-bar">
            <div className="section-bar-left">
              <div className="language-selector">
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`lang-btn ${language === opt.value ? "active" : ""}`}
                    onClick={() => handleLanguageChange(opt.value)}
                    disabled={isRunning}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="btn-primary run-visualizer-btn"
              onClick={handleVisualize}
              disabled={isRunning}
            >
              {isRunning ? "⏳ Running..." : "🎬 Visualize Code"}
            </button>
          </div>
          <div className="visualizer-editor-container">
            <Editor
              height="100%"
              language={currentLangOption?.monacoLang || "javascript"}
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || "")}
              onMount={handleEditorDidMount}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                automaticLayout: true,
                scrollBeyondLastLine: false,
                lineNumbersMinChars: 3,
                cursorBlinking: "smooth",
                fontFamily: "'Courier New', Courier, monospace",
                glyphMargin: true
              }}
            />
          </div>
          <div className="visualizer-stdin-container">
            <div className="section-bar sub-bar">
              <span>📥 Standard Input (stdin)</span>
            </div>
            <textarea
              className="visualizer-stdin-textarea"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Provide standard input here (one value per line)..."
            />
          </div>
        </div>

        {/* Right Panel: Stepper Controls & Variables */}
        <div className="visualizer-inspector-section">
          {error && (
            <div className="visualizer-error-banner">
              <span>⚠️ Error:</span> {error}
            </div>
          )}

          {traces.length > 0 ? (
            <div className="inspector-content">
              {/* Step Controls */}
              <div className="controls-card glass-card">
                <h4>Execution Controls</h4>
                <div className="controls-row">
                  <button disabled={currentStep === 0} onClick={() => setCurrentStep(0)} className="control-btn">
                    ⏮️ First
                  </button>
                  <button disabled={currentStep === 0} onClick={() => setCurrentStep(prev => prev - 1)} className="control-btn">
                    ◀ Prev
                  </button>
                  <span className="step-info-label">
                    Step {currentStep + 1} of {traces.length}
                  </span>
                  <button disabled={currentStep === traces.length - 1} onClick={() => setCurrentStep(prev => prev + 1)} className="control-btn">
                    Next ▶
                  </button>
                  <button disabled={currentStep === traces.length - 1} onClick={() => setCurrentStep(traces.length - 1)} className="control-btn">
                    Last ⏭️
                  </button>
                </div>
                <input
                  type="range" min="0" max={traces.length - 1} value={currentStep}
                  onChange={(e) => setCurrentStep(parseInt(e.target.value))}
                  className="timeline-slider"
                />
              </div>

              {/* Variables Scope Watcher */}
              <div className="scope-card glass-card">
                <h4>Variables Scope Inspector</h4>
                {currentSnapshot && currentSnapshot.variables && Object.keys(currentSnapshot.variables).length > 0 ? (
                  <table className="variables-table">
                    <thead>
                      <tr><th>Variable</th><th>Type</th><th>Value</th></tr>
                    </thead>
                    <tbody>
                      {Object.entries(currentSnapshot.variables).map(([name, info]) => {
                        let displayType, displayVal;
                        if (typeof info === "object" && info !== null && "type" in info) {
                          displayType = info.type;
                          displayVal = info.value === null ? "null" :
                            info.value === undefined ? "undefined" :
                            typeof info.value === "object" ? JSON.stringify(info.value) :
                            String(info.value);
                        } else {
                          displayType = typeof info;
                          displayVal = info === null ? "null" :
                            info === undefined ? "undefined" :
                            typeof info === "object" ? JSON.stringify(info) :
                            String(info);
                        }
                        return (
                          <tr key={name}>
                            <td className="var-name">{name}</td>
                            <td className="var-type">{displayType}</td>
                            <td className="var-val">{displayVal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-variables-notice">
                    <p>No variables captured on this line.</p>
                  </div>
                )}
              </div>

              {/* Function & Line Info */}
              <div className="active-line-badge">
                <span className="func-badge">{currentSnapshot?.func || "main"}()</span>
                &nbsp;→ Line <span>{currentSnapshot?.line}</span>
              </div>

              {/* Console Output */}
              {consoleOutput && (
                <div className="console-output-card glass-card">
                  <h4>📟 Program Output</h4>
                  <pre className="console-output-pre">{consoleOutput}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-inspector-notice">
              <span className="empty-visualizer-icon">🎬</span>
              <h3>No Trace Generated</h3>
              <p>Select a language, write or paste your code, and click "Visualize Code" to step through execution.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Visualizer;
