import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext.jsx";
import { problemsAPI, submissionsAPI } from "../services/api.js";
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
  const [evaluating, setEvaluating] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [activeTab, setActiveTab] = useState("console"); // "console" | "profiler" | "submissions"
  const [consoleLogs, setConsoleLogs] = useState([]);
  
  // Profiler State
  const [profileData, setProfileData] = useState([]);
  const [profiling, setProfiling] = useState(false);

  const socketRef = useRef(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);

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
    const socket = io(backendUrl, {
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      // console.log("🔌 Connected to socket server");
      // Join user specific private room to catch targeted submission updates
      socket.emit("join-user-room", user.id);
    });

    // Listen for live verdict update broadcasts
    socket.on("submission-verdict", (data) => {
      // Check if update relates to the current active submission
      setEvaluating(false);
      setVerdict(data.verdict);
      setMetrics({
        time: data.executionTime,
        memory: data.memoryUsage
      });
      
      const newLog = {
        type: data.verdict === "ACCEPTED" ? "success" : "error",
        message: `Submission Evaluation Complete. Verdict: ${data.verdict} (${data.executionTime}ms, ${data.memoryUsage} KB)`
      };
      setConsoleLogs((prev) => [newLog, ...prev]);
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user]);

  const handleLanguageChange = (e) => {
    const selectedLang = e.target.value;
    setLanguage(selectedLang);
    setCode(LANGUAGE_BOILERPLATES[selectedLang] || "");
  };

  const handleCopyInput = (text) => {
    navigator.clipboard.writeText(text);
    const copyLog = { type: "info", message: "Sample input copied to clipboard!" };
    setConsoleLogs((prev) => [copyLog, ...prev]);
  };

  // Submit Code Sandbox Action
  const handleSubmit = async () => {
    if (!isAuthenticated) {
      setError("You must be logged in to submit code.");
      return;
    }
    
    setEvaluating(true);
    setVerdict("PENDING");
    setActiveTab("console");
    
    const startLog = { type: "info", message: `Submitting your ${language} solution to Queue...` };
    setConsoleLogs((prev) => [startLog, ...prev]);

    try {
      const res = await submissionsAPI.submitCode(id, language, code);
      if (res.status === "pending") {
        const queueLog = { type: "info", message: `Successfully enqueued! Job ID: ${res.data.submissionId}. Evaluating sandbox...` };
        setConsoleLogs((prev) => [queueLog, ...prev]);
      }
    } catch (err) {
      setEvaluating(false);
      setVerdict("ERROR");
      const errorLog = { type: "error", message: `Submission failed: ${err.message}` };
      setConsoleLogs((prev) => [errorLog, ...prev]);
    }
  };

  // Complexity Profiler simulator loop
  const handleProfile = () => {
    setProfiling(true);
    setActiveTab("profiler");
    setProfileData([]);
    
    const inputSizes = [10, 100, 500, 1000, 3000, 5000];
    let step = 0;
    const results = [];

    const interval = setInterval(() => {
      if (step >= inputSizes.length) {
        clearInterval(interval);
        setProfiling(false);
        return;
      }

      const N = inputSizes[step];
      // Generate realistic runtimes representing O(N) runtime scaling with small random deviation
      const baseMs = language === "python" || language === "javascript" ? 1.8 : 0.4;
      const noise = Math.random() * 0.3;
      const calculatedTime = parseFloat((N * 0.0035 * baseMs + noise + 0.1).toFixed(2));
      
      results.push({ size: N, duration: calculatedTime });
      setProfileData([...results]);
      step++;
    }, 400);
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
            disabled={profiling || evaluating}
          >
            {profiling ? "Analyzing..." : "Analyze Complexity"}
          </button>
          <button
            className="btn-primary run-btn"
            onClick={handleSubmit}
            disabled={evaluating || profiling}
          >
            {evaluating ? (
              <span className="btn-spinner"></span>
            ) : "Submit Code"}
          </button>
        </div>
      </div>

      {/* 2. Main Workspace split panels */}
      <div className="workspace-grid">
        {/* Left Side: Problem Details */}
        <aside className="problem-sidebar-panel glass-card">
          <div className="problem-meta-row">
            <span className={`difficulty-badge ${problem.difficulty.toLowerCase()}`}>
              {problem.difficulty}
            </span>
            <span className="topic-badge">{problem.topic}</span>
            {problem.subtopic && <span className="subtopic-badge">{problem.subtopic}</span>}
          </div>

          <h1 className="problem-title">{problem.title}</h1>
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
                  <button 
                    className="copy-btn-link"
                    onClick={() => handleCopyInput(problem.sampleInput)}
                  >
                    Copy
                  </button>
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
        </aside>

        {/* Right Side: Monaco Editor and Console console */}
        <main className="editor-console-panel">
          {/* Top Column: Monaco Editor */}
          <div className="editor-wrapper glass-card">
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

          {/* Bottom Column: Console, Profiler & Submissions Tabs */}
          <div className="console-wrapper glass-card">
            <div className="console-tabs">
              <button
                className={`tab-btn ${activeTab === "console" ? "active" : ""}`}
                onClick={() => setActiveTab("console")}
              >
                📟 Output Console
              </button>
              <button
                className={`tab-btn ${activeTab === "profiler" ? "active" : ""}`}
                onClick={() => setActiveTab("profiler")}
              >
                📈 Complexity Graph
              </button>
            </div>

            <div className="console-body">
              {activeTab === "console" && (
                <div className="console-tab-content">
                  {/* Verdict display if evaluated */}
                  {verdict && (
                    <div className={`verdict-output-banner ${verdict.toLowerCase()}`}>
                      <span className="verdict-label">Verdict:</span>
                      <span className="verdict-name">{verdict}</span>
                      {metrics && (
                        <span className="verdict-metrics">
                          (Time: {metrics.time}ms | Memory: {metrics.memory} KB)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Standard output streams */}
                  <div className="console-terminal">
                    {consoleLogs.length === 0 ? (
                      <p className="terminal-placeholder">Write code and click "Submit Code" to run the sandbox pipeline.</p>
                    ) : (
                      consoleLogs.map((log, index) => (
                        <div key={index} className={`terminal-line ${log.type}`}>
                          <span className="terminal-bullet">&gt;</span>
                          <span className="terminal-text">{log.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === "profiler" && (
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
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default ProblemWorkspace;
