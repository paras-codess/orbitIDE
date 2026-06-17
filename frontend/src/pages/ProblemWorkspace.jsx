import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext.jsx";
import { problemsAPI, submissionsAPI } from "../services/api.js";
import { analyzeComplexity } from "../utils/complexityAnalyzer.js";
import "./ProblemWorkspace.css";

const LANGUAGE_BOILERPLATES = {
  javascript: `// JavaScript (Node.js)\nfunction solve() {\n  // Write your code here\n  const input = "Hello OrbitIDE";\n  console.log(input);\n}\nsolve();`,
  python: `# Python 3\ndef solve():\n    # Write your code here\n    input_str = "Hello OrbitIDE"\n    print(input_str)\n\nsolve()`,
  cpp: `// C++ (GCC)\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    cout << "Hello OrbitIDE" << endl;\n    return 0;\n}`,
  java: `// Java (OpenJDK)\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your code here\n        System.out.println("Hello OrbitIDE");\n    }\n}`,
  c: `// C (GCC)\n#include <stdio.h>\n\nint main() {\n    // Write your code here\n    printf("Hello OrbitIDE\\n");\n    return 0;\n}`
};

function ProblemWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [editorTheme, setEditorTheme] = useState("vs-dark");
  
  // Execution/Submission State
  const [evaluating, setEvaluating] = useState(false); // "Submit" in progress
  const [running, setRunning] = useState(false);        // "Run Code" in progress
  const [verdict, setVerdict] = useState(null);
  const [metrics, setMetrics] = useState(null);

  // LeetCode-style bottom panel state
  const [bottomTab, setBottomTab] = useState("testcase"); // "testcase" | "result" | "profiler"
  const [testCaseInputs, setTestCaseInputs] = useState([]); // editable sample inputs
  const [testResults, setTestResults] = useState([]);        // per-case results array
  const [activeCase, setActiveCase] = useState(0);           // which Case tab is selected (0-indexed)
  
  // Profiler State
  const [profileData, setProfileData] = useState([]);
  const [profiling, setProfiling] = useState(false);

  const socketRef = useRef(null);

  // Submissions Sidebar & Modal State
  const [sidebarTab, setSidebarTab] = useState("description"); // "description" | "submissions"
  const [mySubmissions, setMySubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const fetchSubmissions = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingSubmissions(true);
    try {
      const res = await submissionsAPI.getMySubmissions(id);
      if (res.status === "success") {
        setMySubmissions(res.data.submissions);
      }
    } catch (err) {
      console.error("Failed to load submissions:", err);
    } finally {
      setLoadingSubmissions(false);
    }
  }, [id, isAuthenticated]);

  useEffect(() => {
    fetchSubmissions();
  }, [id, fetchSubmissions]);

  // ---- Resizable Panel State ----
  const [leftPanelWidth, setLeftPanelWidth] = useState(40); // percent of workspace-grid width
  const [editorHeightPercent, setEditorHeightPercent] = useState(65); // percent of editor-console height
  const [isDraggingH, setIsDraggingH] = useState(false); // horizontal splitter active
  const [isDraggingV, setIsDraggingV] = useState(false); // vertical splitter active
  const workspaceGridRef = useRef(null);
  const editorConsolePanelRef = useRef(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);

  // ---- Global mouse handlers for resizable panels ----
  const handleMouseMove = useCallback((e) => {
    if (isDraggingH && workspaceGridRef.current) {
      const rect = workspaceGridRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const pct = (offsetX / rect.width) * 100;
      setLeftPanelWidth(Math.min(80, Math.max(20, pct)));
    }
    if (isDraggingV && editorConsolePanelRef.current) {
      const rect = editorConsolePanelRef.current.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const pct = (offsetY / rect.height) * 100;
      setEditorHeightPercent(Math.min(85, Math.max(15, pct)));
    }
  }, [isDraggingH, isDraggingV]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingH(false);
    setIsDraggingV(false);
  }, []);

  useEffect(() => {
    if (isDraggingH || isDraggingV) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingH, isDraggingV, handleMouseMove, handleMouseUp]);

  // Load Problem Details
  useEffect(() => {
    let active = true;

    // Defer loading state to avoid synchronous state updates in the effect body
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });

    problemsAPI.getProblemById(id)
      .then((res) => {
        if (active && res.status === "success") {
          setProblem(res.data);
          setCode(LANGUAGE_BOILERPLATES[language]);
          setError(null);
          setLoading(false);
          
          // Initialize editable test case inputs from sample test cases
          if (res.data.testCases && res.data.testCases.length > 0) {
            setTestCaseInputs(
              res.data.testCases.map((tc) => ({
                input: tc.input || "",
                expectedOutput: tc.output || "",
                isCustom: false,
              }))
            );
          }
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Failed to load problem details.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Handle Socket.io connections for real-time verdict sync
  useEffect(() => {
    if (!user?.id) return;

    // Connect to WebSocket Server
    const backendUrl = "http://localhost:5000";
    const socket = io(backendUrl);
    socketRef.current = socket;

    socket.on("connect", () => {
      // Join user specific private room to catch targeted submission updates
      socket.emit("join-user-room", user.id);
    });

    // Listen for live verdict update broadcasts
    socket.on("submission-verdict", (data) => {
      setEvaluating(false);
      setVerdict(data.verdict);
      setMetrics({
        time: data.executionTime,
        memory: data.memoryUsage
      });
      
      // Populate test results for the result tab
      if (data.testResults && data.testResults.length > 0) {
        setTestResults(data.testResults);
        // Auto-select first failed test case, or first one
        const firstFailed = data.testResults.findIndex((tr) => !tr.passed);
        setActiveCase(firstFailed >= 0 ? firstFailed : 0);
      }
      
      setBottomTab("result");
      // Refresh submissions if the list is mounted
      fetchSubmissions();
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user, fetchSubmissions]);

  const handleLanguageChange = (e) => {
    const selectedLang = e.target.value;
    setLanguage(selectedLang);
    setCode(LANGUAGE_BOILERPLATES[selectedLang] || "");
  };

  // ---- "Run Code" handler (synchronous, sample tests only) ----
  const handleRunCode = async () => {
    if (!isAuthenticated) {
      setError("You must be logged in to run code.");
      return;
    }
    
    setRunning(true);
    setVerdict(null);
    setMetrics(null);
    setTestResults([]);

    try {
      // Pass current test case inputs (including custom/edited ones) to backend
      const casesToRun = testCaseInputs.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isCustom: tc.isCustom || false,
      }));
      const res = await submissionsAPI.runCode(id, language, code, casesToRun);
      if (res.status === "success" && res.data) {
        setVerdict(res.data.verdict);
        setMetrics({
          time: res.data.executionTime,
          memory: 0
        });
        setTestResults(res.data.testResults || []);
        
        // Auto-select first failed test, or first one
        const firstFailed = (res.data.testResults || []).findIndex((tr) => !tr.passed);
        setActiveCase(firstFailed >= 0 ? firstFailed : 0);
        setBottomTab("result");
      }
    } catch (err) {
      setVerdict("ERROR");
      setTestResults([{
        testNumber: 1,
        passed: false,
        verdict: "ERROR",
        executionTime: 0,
        input: "",
        expectedOutput: "",
        actualOutput: "",
        stderr: err.message,
      }]);
      setBottomTab("result");
    } finally {
      setRunning(false);
    }
  };

  // ---- "Submit" handler (async, all tests via BullMQ queue) ----
  const handleSubmit = async () => {
    if (!isAuthenticated) {
      setError("You must be logged in to submit code.");
      return;
    }
    
    setEvaluating(true);
    setVerdict("PENDING");
    setMetrics(null);
    setTestResults([]);
    setBottomTab("result");

    try {
      await submissionsAPI.submitCode(id, language, code);
      // Results will arrive via WebSocket "submission-verdict" event
    } catch (err) {
      setEvaluating(false);
      setVerdict("ERROR");
      setTestResults([{
        testNumber: 1,
        passed: false,
        verdict: "ERROR",
        executionTime: 0,
        input: "",
        expectedOutput: "",
        actualOutput: "",
        stderr: err.message,
      }]);
    }
  };

  // ---- Add custom test case ----
  const handleAddCustomCase = () => {
    setTestCaseInputs((prev) => [
      ...prev,
      { input: "", expectedOutput: "", isCustom: true }
    ]);
    setActiveCase(testCaseInputs.length); // select the new one
  };

  // ---- Remove custom test case ----
  const handleRemoveCustomCase = (index) => {
    setTestCaseInputs((prev) => prev.filter((_, i) => i !== index));
    if (activeCase >= testCaseInputs.length - 1) {
      setActiveCase(Math.max(0, testCaseInputs.length - 2));
    }
  };

  // ---- Update test case input ----
  const handleTestCaseInputChange = (index, value) => {
    setTestCaseInputs((prev) =>
      prev.map((tc, i) => (i === index ? { ...tc, input: value } : tc))
    );
  };

  // Complexity Profiler simulator loop
  const handleProfile = () => {
    setProfiling(true);
    setBottomTab("profiler");
    setProfileData([]);
    
    const complexity = analyzeComplexity(code, language).time;
    const inputSizes = [10, 100, 500, 1000, 3000, 5000];
    let step = 0;
    const results = [];
    
    // Base coefficient based on language
    const baseMs = language === "python" || language === "javascript" ? 1.5 : 0.3;

    const interval = setInterval(() => {
      if (step >= inputSizes.length) {
        clearInterval(interval);
        setProfiling(false);
        return;
      }

      const N = inputSizes[step];
      let factor = 1;
      
      if (complexity === "O(N²)") {
        factor = N * N * 0.000002;
      } else if (complexity === "O(N³)") {
        factor = N * N * N * 0.000000001;
      } else if (complexity === "O(N log N)") {
        factor = N * Math.log2(N + 1) * 0.0015;
      } else if (complexity === "O(N)") {
        factor = N * 0.004;
      } else if (complexity === "O(log N)") {
        factor = Math.log2(N + 1) * 0.06;
      } else { // O(1)
        factor = 1;
      }
      
      const noise = Math.random() * 0.08 * (factor + 1);
      const calculatedTime = parseFloat((factor * baseMs + noise + 0.05).toFixed(2));
      
      results.push({ size: N, duration: calculatedTime });
      setProfileData([...results]);
      step++;
    }, 400);
  };

  // ---- Estimate Time Complexity from profiler data using curve fitting ----
  const estimateTimeComplexity = (data) => {
    if (data.length < 3) return null;

    // Candidate complexity functions: f(N) → expected scaling
    const candidates = [
      { label: "O(1)",        fn: () => 1 },
      { label: "O(log N)",    fn: (n) => Math.log2(n + 1) },
      { label: "O(N)",        fn: (n) => n },
      { label: "O(N log N)",  fn: (n) => n * Math.log2(n + 1) },
      { label: "O(N²)",       fn: (n) => n * n },
      { label: "O(N³)",       fn: (n) => n * n * n },
    ];

    // For each candidate, compute R² score (coefficient of determination)
    let bestFit = { label: "O(N)", score: -Infinity };

    for (const cand of candidates) {
      const fVals = data.map((d) => cand.fn(d.size));
      const tVals = data.map((d) => d.duration);

      // Linear regression: t ≈ a * f(N) + b
      const n = fVals.length;
      const sumF = fVals.reduce((a, b) => a + b, 0);
      const sumT = tVals.reduce((a, b) => a + b, 0);
      const sumFT = fVals.reduce((acc, f, i) => acc + f * tVals[i], 0);
      const sumF2 = fVals.reduce((acc, f) => acc + f * f, 0);

      const denom = n * sumF2 - sumF * sumF;
      if (Math.abs(denom) < 1e-12) continue;

      const a = (n * sumFT - sumF * sumT) / denom;
      const b = (sumT - a * sumF) / n;

      // Predictions and R²
      const predicted = fVals.map((f) => a * f + b);
      const meanT = sumT / n;
      const ssRes = tVals.reduce((acc, t, i) => acc + (t - predicted[i]) ** 2, 0);
      const ssTot = tVals.reduce((acc, t) => acc + (t - meanT) ** 2, 0);

      const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

      if (r2 > bestFit.score) {
        bestFit = { label: cand.label, score: r2 };
      }
    }

    return bestFit;
  };

  // ---- Estimate Space Complexity via static code patterns ----
  const estimateSpaceComplexity = (sourceCode) => {
    return analyzeComplexity(sourceCode, language).space;
  };

  if (loading) {
    return (
      <div className="loading-workspace container">
        <div className="spinner"></div>
        <p>Loading OrbitIDE interactive workspace...</p>
      </div>
    );
  }

  if (error && !problem) {
    return (
      <div className="error-workspace container">
        <p className="error-message">{error}</p>
        <Link to="/problems" className="btn-primary">Back to Problems</Link>
      </div>
    );
  }

  // Calculate coordinates for the custom SVG line graph
  const renderProfilerGraph = () => {
    if (profileData.length === 0) {
      return (
        <div className="empty-chart">
          <p>No profiling data generated yet. Click "Analyze Complexity" to run the profiler.</p>
        </div>
      );
    }

    const padding = 40;
    const w = 450;
    const h = 220;
    const graphWidth = w - padding * 2;
    const graphHeight = h - padding * 2;

    const maxN = Math.max(...profileData.map(d => d.size));
    const maxTime = Math.max(...profileData.map(d => d.duration)) || 1;

    // Convert data to pixels coordinates
    const points = profileData.map(d => {
      const x = padding + (d.size / maxN) * graphWidth;
      const y = padding + graphHeight - (d.duration / maxTime) * graphHeight;
      return { x, y, size: d.size, time: d.duration };
    });

    const pathData = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, "");

    return (
      <div className="graph-container">
        <svg width="100%" height="220" viewBox={`0 0 ${w} ${h}`} className="profiler-svg">
          {/* Grids and Axes */}
          <line x1={padding} y1={h - padding} x2={w - padding} y2={h - padding} stroke="#475569" strokeWidth="1.5" />
          <line x1={padding} y1={padding} x2={padding} y2={h - padding} stroke="#475569" strokeWidth="1.5" />
          
          {/* Y-Axis Label */}
          <text x={padding - 10} y={padding + 5} fill="#94a3b8" fontSize="10" textAnchor="end">{maxTime} ms</text>
          <text x={padding - 10} y={h - padding} fill="#94a3b8" fontSize="10" textAnchor="end">0 ms</text>

          {/* X-Axis Label */}
          <text x={padding} y={h - padding + 18} fill="#94a3b8" fontSize="10" textAnchor="middle">N=0</text>
          <text x={w - padding} y={h - padding + 18} fill="#94a3b8" fontSize="10" textAnchor="middle">N={maxN}</text>

          {/* Path Curve Line */}
          {pathData && (
            <path
              d={pathData}
              fill="none"
              stroke="url(#chart-grad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              className="chart-path"
            />
          )}

          {/* Glowing Filter Definitions */}
          <defs>
            <linearGradient id="chart-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Coordinate Circles */}
          {points.map((p, idx) => (
            <g key={idx} className="chart-node">
              <circle
                cx={p.x}
                cy={p.y}
                r="5"
                fill="#3b82f6"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <title>{`N = ${p.size}, Time = ${p.time} ms`}</title>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  // Get the currently active test case data for display
  const currentTestInput = testCaseInputs[activeCase] || null;
  const currentTestResult = testResults[activeCase] || null;

  return (
    <div className="workspace-page container">
      {/* 1. Header Toolbar */}
      <div className="workspace-header glass-card">
        <div className="workspace-nav">
          <Link to="/problems" className="back-link">
            <span>←</span> Back to Problems
          </Link>
          <span className="divider">/</span>
          <span className="current-title">{problem.title}</span>
        </div>
        <div className="workspace-actions">
          <div className="editor-theme-select">
            <label htmlFor="theme-select">Theme:</label>
            <select
              id="theme-select"
              value={editorTheme}
              onChange={(e) => setEditorTheme(e.target.value)}
            >
              <option value="vs-dark">VS Dark</option>
              <option value="light">VS Light</option>
            </select>
          </div>
          <button 
            className="btn-secondary compile-btn"
            onClick={handleProfile}
            disabled={profiling || evaluating || running}
          >
            {profiling ? "Analyzing..." : "Analyze Complexity"}
          </button>
        </div>
      </div>

      {/* Drag overlay to prevent text selection/iframe capture during resize */}
      {(isDraggingH || isDraggingV) && (
        <div
          className="resize-overlay"
          style={{ cursor: isDraggingH ? 'col-resize' : 'row-resize' }}
        />
      )}

      {/* 2. Main Workspace split panels */}
      <div className="workspace-grid" ref={workspaceGridRef}>
        {/* Left Side: Problem Sidebar with Description / Submissions Tabs */}
        <aside
          className="problem-sidebar-panel glass-card"
          style={{ width: `${leftPanelWidth}%` }}
        >
          <div className="sidebar-tabs-bar">
            <button
              className={`sidebar-tab-btn ${sidebarTab === "description" ? "active" : ""}`}
              onClick={() => setSidebarTab("description")}
            >
              📋 Description
            </button>
            <button
              className={`sidebar-tab-btn ${sidebarTab === "submissions" ? "active" : ""}`}
              onClick={() => setSidebarTab("submissions")}
            >
              🕒 Submissions
            </button>
          </div>

          <div className="sidebar-tab-body">
            {sidebarTab === "description" ? (
              <div className="description-tab-content">
                <div className="problem-meta-row">
                  <span className={`difficulty-badge ${problem.difficulty.toLowerCase()}`}>
                    {problem.difficulty}
                  </span>
                  <span className="topic-badge">{problem.topic}</span>
                  {problem.subtopic && <span className="subtopic-badge">{problem.subtopic}</span>}
                </div>

                <h1 className="problem-title">
                  {mySubmissions.some((sub) => sub.verdict === "ACCEPTED") && (
                    <span className="title-solved-tick-circle" title="Solved">
                      <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </span>
                  )}
                  {problem.title}
                </h1>
                <div className="divider-line"></div>

                <div className="problem-description-content">
                  <h3>Problem Statement</h3>
                  <p className="statement-text">{problem.description}</p>

                  {problem.constraints && (
                    <div className="problem-section">
                      <h4>Constraints</h4>
                      <pre className="monospace-block">{problem.constraints}</pre>
                    </div>
                  )}

                  {problem.inputFormat && (
                    <div className="problem-section">
                      <h4>Input Format</h4>
                      <p>{problem.inputFormat}</p>
                    </div>
                  )}

                  {problem.outputFormat && (
                    <div className="problem-section">
                      <h4>Output Format</h4>
                      <p>{problem.outputFormat}</p>
                    </div>
                  )}

                  {/* Test Case Samples */}
                  {problem.sampleInput && (
                    <div className="problem-section">
                      <div className="section-header">
                        <h4>Sample Input</h4>
                      </div>
                      <pre className="monospace-block code-box">{problem.sampleInput}</pre>
                    </div>
                  )}

                  {problem.sampleOutput && (
                    <div className="problem-section">
                      <h4>Sample Output</h4>
                      <pre className="monospace-block code-box">{problem.sampleOutput}</pre>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="submissions-tab-content">
                <h2 className="tab-section-title">Submission History</h2>
                {loadingSubmissions ? (
                  <div className="submissions-loading">
                    <div className="spinner small-spinner"></div>
                    <p>Loading your submission history...</p>
                  </div>
                ) : mySubmissions.length === 0 ? (
                  <div className="submissions-empty">
                    <span className="empty-icon">🕒</span>
                    <p>You haven't submitted any code for this problem yet.</p>
                  </div>
                ) : (
                  <div className="submissions-list">
                    {mySubmissions.map((sub) => {
                      const verdictClass = sub.verdict.toLowerCase();
                      const formattedDate = new Date(sub.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      });
                      
                      return (
                        <div
                          key={sub.id}
                          className="submission-list-item glass-card"
                          onClick={() => setSelectedSubmission(sub)}
                        >
                          <div className="submission-item-header">
                            <span className={`submission-item-verdict ${verdictClass}`}>
                              {sub.verdict.replace(/_/g, " ")}
                            </span>
                            <span className="submission-item-date">{formattedDate}</span>
                          </div>
                          <div className="submission-item-footer">
                            <span className="submission-item-lang">{sub.language}</span>
                            {sub.executionTime !== null && (
                              <span className="submission-item-metric">⏱️ {sub.executionTime}ms</span>
                            )}
                            {sub.memoryUsage !== null && sub.memoryUsage > 0 && (
                              <span className="submission-item-metric">💾 {sub.memoryUsage} KB</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Horizontal Resize Handle */}
        <div
          className={`resize-handle-horizontal ${isDraggingH ? 'dragging' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); setIsDraggingH(true); }}
        />

        {/* Right Side: Monaco Editor and Bottom Panel */}
        <main className="editor-console-panel" ref={editorConsolePanelRef}>
          {/* Top Column: Monaco Editor */}
          <div className="editor-wrapper glass-card" style={{ height: `${editorHeightPercent}%` }}>
            <div className="editor-top-bar">
              <span className="panel-tab-title">🧑‍💻 Source Code Editor</span>
              <div className="language-selector">
                <select value={language} onChange={handleLanguageChange}>
                  <option value="javascript">JavaScript (Node.js)</option>
                  <option value="python">Python 3</option>
                  <option value="cpp">C++ (GCC)</option>
                  <option value="java">Java (OpenJDK)</option>
                  <option value="c">C (GCC)</option>
                </select>
              </div>
            </div>
            
            <div className="monaco-container">
              <Editor
                height="100%"
                language={language}
                theme={editorTheme}
                value={code}
                onChange={(value) => setCode(value || "")}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  lineNumbersMinChars: 3,
                  cursorBlinking: "smooth",
                  fontFamily: "'Courier New', Courier, monospace"
                }}
              />
            </div>
          </div>

          {/* Vertical Resize Handle */}
          <div
            className={`resize-handle-vertical ${isDraggingV ? 'dragging' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); setIsDraggingV(true); }}
          />

          {/* Bottom Column: LeetCode-style Testcase / Result / Profiler tabs */}
          <div className="console-wrapper glass-card">
            <div className="console-tabs">
              <button
                className={`tab-btn ${bottomTab === "testcase" ? "active" : ""}`}
                onClick={() => setBottomTab("testcase")}
              >
                📝 Testcase
              </button>
              <button
                className={`tab-btn ${bottomTab === "result" ? "active" : ""}`}
                onClick={() => setBottomTab("result")}
              >
                {verdict && verdict !== "PENDING" && (
                  <span className={`tab-dot ${verdict === "ACCEPTED" ? "dot-pass" : "dot-fail"}`}></span>
                )}
                📟 Test Result
              </button>
              <button
                className={`tab-btn ${bottomTab === "profiler" ? "active" : ""}`}
                onClick={() => setBottomTab("profiler")}
              >
                📈 Complexity
              </button>
            </div>

            <div className="console-body">
              {/* ========== TESTCASE TAB ========== */}
              {bottomTab === "testcase" && (
                <div className="console-tab-content testcase-tab">
                  {/* Case sub-tabs */}
                  <div className="case-tabs-row">
                    {testCaseInputs.map((tc, idx) => (
                      <button
                        key={idx}
                        className={`case-tab ${activeCase === idx ? "active" : ""}`}
                        onClick={() => setActiveCase(idx)}
                      >
                        {tc.isCustom ? `Custom ${testCaseInputs.slice(0, idx).filter(t => t.isCustom).length + 1}` : `Case ${idx + 1}`}
                        {tc.isCustom && (
                          <span
                            className="remove-case-btn"
                            onClick={(e) => { e.stopPropagation(); handleRemoveCustomCase(idx); }}
                          >
                            ×
                          </span>
                        )}
                      </button>
                    ))}
                    <button className="case-tab add-case-btn" onClick={handleAddCustomCase}>
                      + Add
                    </button>
                  </div>

                  {/* Active case input editor */}
                  {currentTestInput && (
                    <div className="case-detail-grid">
                      <div className="case-field">
                        <label className="case-field-label">Input</label>
                        <textarea
                          className="case-textarea"
                          value={currentTestInput.input}
                          onChange={(e) => handleTestCaseInputChange(activeCase, e.target.value)}
                          placeholder="Enter test input..."
                          spellCheck={false}
                        />
                      </div>
                      {!currentTestInput.isCustom && currentTestInput.expectedOutput && (
                        <div className="case-field">
                          <label className="case-field-label">Expected Output</label>
                          <div className="case-output-display">
                            {currentTestInput.expectedOutput}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {testCaseInputs.length === 0 && (
                    <div className="empty-case-placeholder">
                      <p>No sample test cases available. Click "+ Add" to create a custom test case.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ========== TEST RESULT TAB ========== */}
              {bottomTab === "result" && (
                <div className="console-tab-content result-tab">
                  {/* Verdict banner */}
                  {verdict && (
                    <div className={`verdict-output-banner ${verdict.toLowerCase()}`}>
                      <span className="verdict-label">Verdict:</span>
                      <span className="verdict-name">{verdict}</span>
                      {verdict === "PENDING" && (
                        <span className="btn-spinner verdict-spinner"></span>
                      )}
                      {metrics && (
                        <span className="verdict-metrics">
                          (Time: {metrics.time}ms | Memory: {metrics.memory} KB)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Case result sub-tabs */}
                  {testResults.length > 0 && (
                    <>
                      <div className="case-tabs-row">
                        {testResults.map((tr, idx) => (
                          <button
                            key={idx}
                            className={`case-tab ${activeCase === idx ? "active" : ""}`}
                            onClick={() => setActiveCase(idx)}
                          >
                            <span className={`case-dot ${tr.passed ? "dot-pass" : "dot-fail"}`}></span>
                            {tr.isHidden ? `Hidden ${tr.testNumber}` : (tr.isCustom ? `Custom ${testResults.slice(0, idx).filter(t => t.isCustom).length + 1}` : `Case ${tr.testNumber}`)}
                          </button>
                        ))}
                      </div>

                      {/* Active case result detail */}
                      {currentTestResult && (
                        <div className="case-result-detail">
                          <div className={`case-result-status ${currentTestResult.passed ? "passed" : "failed"}`}>
                            {currentTestResult.passed ? "✅ Passed" : `❌ ${currentTestResult.verdict.replace(/_/g, " ")}`}
                            <span className="case-result-time">({currentTestResult.executionTime}ms)</span>
                          </div>

                          {/* Show input/output for non-hidden test cases */}
                          {!currentTestResult.isHidden ? (
                            <div className="case-detail-grid result-grid">
                              {currentTestResult.input !== undefined && (
                                <div className="case-field">
                                  <label className="case-field-label">Input</label>
                                  <div className="case-output-display">{currentTestResult.input}</div>
                                </div>
                              )}
                              {currentTestResult.expectedOutput !== undefined && currentTestResult.expectedOutput !== "" && (
                                <div className="case-field">
                                  <label className="case-field-label">Expected Output</label>
                                  <div className="case-output-display">{currentTestResult.expectedOutput}</div>
                                </div>
                              )}
                              {currentTestResult.actualOutput !== undefined && (
                                <div className="case-field">
                                  <label className="case-field-label">Your Output</label>
                                  <div className={`case-output-display ${currentTestResult.passed ? "output-pass" : "output-fail"}`}>
                                    {currentTestResult.actualOutput || "(empty)"}
                                  </div>
                                </div>
                              )}
                              {currentTestResult.stderr && (
                                <div className="case-field">
                                  <label className="case-field-label stderr-label">Stderr</label>
                                  <div className="case-output-display stderr-display">
                                    {currentTestResult.stderr}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="hidden-case-notice">
                              <span>🔒</span> This is a hidden test case. Input and expected output are not visible.
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Empty state */}
                  {testResults.length === 0 && !verdict && (
                    <div className="empty-case-placeholder">
                      <p>Click "Run Code" to test against sample cases, or "Submit" to evaluate against all test cases.</p>
                    </div>
                  )}
                  {verdict === "PENDING" && testResults.length === 0 && (
                    <div className="empty-case-placeholder pending-placeholder">
                      <div className="spinner small-spinner"></div>
                      <p>Evaluating your submission against all test cases...</p>
                    </div>
                  )}
                </div>
              )}

              {/* ========== PROFILER TAB ========== */}
              {bottomTab === "profiler" && (
                <div className="console-tab-content profiler-tab">
                  <div className="profiler-header">
                    <h4>Algorithm Scalability (Time Complexity Plot)</h4>
                    <p>Plots execution time against growing test sample size inputs ($N$) to analyze resource scaling.</p>
                  </div>
                  <div className="profiler-grid">
                    <div className="profiler-table-box">
                      <table className="profiler-table">
                        <thead>
                          <tr>
                            <th>Input Size (N)</th>
                            <th>Time (ms)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profileData.map((d, i) => (
                            <tr key={i}>
                              <td>N = {d.size}</td>
                              <td className="time-val">{d.duration} ms</td>
                            </tr>
                          ))}
                          {profileData.length === 0 && (
                            <tr>
                              <td colSpan="2" className="empty-table-msg">Click "Analyze Complexity" above to profile code</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="profiler-chart-box">
                      {renderProfilerGraph()}
                    </div>
                  </div>

                  {/* Complexity Summary — Time & Space */}
                  {profileData.length >= 3 && (
                    <div className="complexity-summary-section">
                      <h4 className="complexity-summary-title">📊 Complexity Analysis</h4>
                      <div className="complexity-cards-row">
                        {/* Time Complexity Card */}
                        {(() => {
                          const fit = estimateTimeComplexity(profileData);
                          return fit ? (
                            <div className="complexity-card time-card">
                              <div className="complexity-card-icon">⏱️</div>
                              <div className="complexity-card-body">
                                <span className="complexity-card-label">Time Complexity</span>
                                <span className="complexity-card-value">{fit.label}</span>
                                <div className="complexity-confidence">
                                  <span className="confidence-label">Confidence</span>
                                  <div className="confidence-bar-track">
                                    <div
                                      className="confidence-bar-fill"
                                      style={{ width: `${Math.max(0, Math.min(100, fit.score * 100)).toFixed(0)}%` }}
                                    />
                                  </div>
                                  <span className="confidence-pct">{(fit.score * 100).toFixed(0)}%</span>
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* Space Complexity Card */}
                        <div className="complexity-card space-card">
                          <div className="complexity-card-icon">💾</div>
                          <div className="complexity-card-body">
                            <span className="complexity-card-label">Space Complexity</span>
                            <span className="complexity-card-value">{estimateSpaceComplexity(code)}</span>
                            <span className="complexity-card-hint">Estimated from code patterns</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Action Bar — Run Code + Submit */}
            <div className="bottom-action-bar">
              <div className="action-bar-left">
                {verdict && verdict !== "PENDING" && (
                  <span className={`action-bar-verdict ${verdict === "ACCEPTED" ? "verdict-pass" : "verdict-fail"}`}>
                    {verdict.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <div className="action-bar-right">
                <button
                  className="btn-run"
                  onClick={handleRunCode}
                  disabled={running || evaluating || profiling}
                >
                  {running ? (
                    <><span className="btn-spinner"></span> Running...</>
                  ) : "▶ Run Code"}
                </button>
                <button
                  className="btn-submit"
                  onClick={handleSubmit}
                  disabled={evaluating || running || profiling}
                >
                  {evaluating ? (
                    <><span className="btn-spinner"></span> Submitting...</>
                  ) : "⬆ Submit"}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Submissions Detail Modal */}
      {selectedSubmission && (
        <div className="modal-overlay" onClick={() => setSelectedSubmission(null)}>
          <div className="submission-modal glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Submission Details</h3>
              <button className="close-modal-btn" onClick={() => setSelectedSubmission(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="submission-meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Verdict</span>
                  <span className={`meta-value verdict-badge ${selectedSubmission.verdict.toLowerCase()}`}>
                    {selectedSubmission.verdict.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Language</span>
                  <span className="meta-value">{selectedSubmission.language}</span>
                </div>
                {selectedSubmission.executionTime !== null && (
                  <div className="meta-item">
                    <span className="meta-label">Runtime</span>
                    <span className="meta-value">{selectedSubmission.executionTime} ms</span>
                  </div>
                )}
                {selectedSubmission.memoryUsage !== null && selectedSubmission.memoryUsage > 0 && (
                  <div className="meta-item">
                    <span className="meta-label">Memory</span>
                    <span className="meta-value">{selectedSubmission.memoryUsage} KB</span>
                  </div>
                )}
              </div>

              {/* Complexity Analysis */}
              {(() => {
                const complexity = analyzeComplexity(selectedSubmission.code, selectedSubmission.language);
                return (
                  <div className="modal-complexity-row">
                    <div className="modal-complexity-card time">
                      <span className="comp-label">Estimated Time Complexity</span>
                      <span className="comp-value">{complexity.time}</span>
                    </div>
                    <div className="modal-complexity-card space">
                      <span className="comp-label">Estimated Space Complexity</span>
                      <span className="comp-value">{complexity.space}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Monaco Read-only Code View */}
              <div className="modal-code-section">
                <h4>Submitted Code</h4>
                <div className="modal-monaco-wrapper">
                  <Editor
                    height="100%"
                    language={selectedSubmission.language}
                    theme={editorTheme}
                    value={selectedSubmission.code}
                    options={{
                      readOnly: true,
                      fontSize: 13,
                      minimap: { enabled: false },
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      lineNumbersMinChars: 3,
                      fontFamily: "'Courier New', Courier, monospace"
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProblemWorkspace;
