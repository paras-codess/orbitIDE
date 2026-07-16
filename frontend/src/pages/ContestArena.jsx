import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext.jsx";
import { contestAPI, submissionsAPI } from "../services/api.js";
import "./ContestArena.css";

const LANGUAGE_BOILERPLATES = {
  javascript: `// JavaScript (Node.js)\nfunction solve() {\n  // Write your code here\n  console.log("Hello OrbitIDE");\n}\nsolve();`,
  python: `# Python 3\ndef solve():\n    # Write your code here\n    print("Hello OrbitIDE")\n\nsolve()`,
  cpp: `// C++ (GCC)\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    cout << "Hello OrbitIDE" << endl;\n    return 0;\n}`,
  java: `// Java (OpenJDK)\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your code here\n        System.out.println("Hello OrbitIDE");\n    }\n}`,
  c: `// C (GCC)\n#include <stdio.h>\n\nint main() {\n    // Write your code here\n    printf("Hello OrbitIDE\\n");\n    return 0;\n}`
};

function ContestArena() {
  const { id: contestId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [contest, setContest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Contest States
  const [activeProblemIdx, setActiveProblemIdx] = useState(null);
  const [language, setLanguage] = useState("javascript");
  const [editorCodes, setEditorCodes] = useState({}); // problemId -> code
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isEnded, setIsEnded] = useState(false);

  // Submission / Running States
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verdictData, setVerdictData] = useState(null);
  const [recentVerdicts, setRecentVerdicts] = useState({}); // problemId -> last verdict
  const [leaderboard, setLeaderboard] = useState([]);

  // Testcase & Test Result states
  const [bottomTab, setBottomTab] = useState("testcase"); // "testcase" | "result"
  const [testCaseInputs, setTestCaseInputs] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [activeCase, setActiveCase] = useState(0);

  const socketRef = useRef(null);
  const timerRef = useRef(null);

  // 1. Fetch initial details
  const fetchDetails = async () => {
    try {
      const res = await contestAPI.getContestDetails(contestId);
      setContest(res.data);
      
      // Initialize editor codes with boilerplates if empty
      const codes = {};
      res.data.problems.forEach((p) => {
        codes[p.id] = LANGUAGE_BOILERPLATES[language];
      });
      setEditorCodes(codes);
      
      // Set leaderboard if present
      const boardRes = await contestAPI.getContestLeaderboard(contestId);
      const board = boardRes.data.leaderboard || [];
      setLeaderboard(board);

      // Populate recentVerdicts for current user based on the leaderboard
      const selfRecord = board.find((player) => player.userId === user.id);
      if (selfRecord && selfRecord.problemStats) {
        const verdicts = {};
        Object.keys(selfRecord.problemStats).forEach((pId) => {
          if (selfRecord.problemStats[pId].solved) {
            verdicts[pId] = "ACCEPTED";
          } else if (selfRecord.problemStats[pId].attempts > 0) {
            verdicts[pId] = "WRONG_ANSWER";
          }
        });
        setRecentVerdicts((prev) => ({ ...prev, ...verdicts }));
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load contest arena.");
    } finally {
      setLoading(false);
    }
  };

  // Sync testCaseInputs from active problem's testCases
  useEffect(() => {
    if (contest && contest.problems && activeProblemIdx !== null && contest.problems[activeProblemIdx]) {
      const activeProb = contest.problems[activeProblemIdx];
      if (activeProb.testCases && activeProb.testCases.length > 0) {
        setTestCaseInputs(
          activeProb.testCases.map((tc) => ({
            input: tc.input || "",
            expectedOutput: tc.output || "",
            isCustom: false,
          }))
        );
      } else {
        setTestCaseInputs([]);
      }
      setTestResults([]);
      setVerdictData(null);
      setActiveCase(0);
      setBottomTab("testcase");
    }
  }, [activeProblemIdx, contest]);

  useEffect(() => {
    fetchDetails();
  }, [contestId]);

  // 2. Setup Socket.io connections & timers
  useEffect(() => {
    if (!contest) return;

    // Connect to Websocket
    const socket = io("http://localhost:5000");
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("🔌 Connected to socket server inside Arena");
      socket.emit("join-user-room", user.id);
      socket.emit("join-contest-room", contestId);
    });

    // Listen to start event (for ROOM waiting page)
    socket.on("contest-start", () => {
      console.log("📢 Contest started by host!");
      fetchDetails();
    });

    // Listen to leaderboard updates
    socket.on("leaderboard-update", (updatedBoard) => {
      console.log("📊 Leaderboard updated:", updatedBoard);
      setLeaderboard(updatedBoard);
    });

    // Listen to user-specific grading updates
    socket.on("submission-verdict", (data) => {
      console.log("🎯 Verdict returned for user submission:", data);
      setSubmitting(false);
      setVerdictData(data);
      if (data.testResults && data.testResults.length > 0) {
        setTestResults(data.testResults);
        const firstFailed = data.testResults.findIndex((tr) => !tr.passed);
        setActiveCase(firstFailed >= 0 ? firstFailed : 0);
      }
      setBottomTab("result");
      if (data.problemId) {
        setRecentVerdicts((prev) => ({
          ...prev,
          [data.problemId]: data.verdict,
        }));
      }
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, [contest?.id]);

  // 3. Countdown timer
  useEffect(() => {
    if (!contest) return;

    const contestStartTime = contest.type === "ROOM" ? contest.startTime : contest.userParticipantState?.startedAt;

    if (!contestStartTime) {
      setTimeRemaining("Waiting to Start");
      return;
    }

    const startMs = new Date(contestStartTime).getTime();
    const durationMs = contest.duration * 60 * 1000;
    const endMs = startMs + durationMs;

    const updateTimer = () => {
      const now = Date.now();
      const diff = endMs - now;

      if (diff <= 0) {
        setTimeRemaining("00:00:00 - Ended");
        setIsEnded(true);
        clearInterval(timerRef.current);
        // Force locks or notifications here
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      const fH = String(hours).padStart(2, "0");
      const fM = String(minutes).padStart(2, "0");
      const fS = String(seconds).padStart(2, "0");

      setTimeRemaining(`${fH}:${fM}:${fS}`);
    };

    updateTimer(); // run once immediately
    timerRef.current = setInterval(updateTimer, 1000);

    return () => clearInterval(timerRef.current);
  }, [contest?.startTime, contest?.userParticipantState?.startedAt]);

  // Update boilerplate when language changes
  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    if (contest) {
      const activeProb = contest.problems[activeProblemIdx];
      setEditorCodes((prev) => ({
        ...prev,
        [activeProb.id]: LANGUAGE_BOILERPLATES[newLang],
      }));
    }
  };

  const handleEditorChange = (value) => {
    if (contest) {
      const activeProb = contest.problems[activeProblemIdx];
      setEditorCodes((prev) => ({
        ...prev,
        [activeProb.id]: value,
      }));
    }
  };

  // Trigger ROOM Contest Start (Host only)
  const triggerStart = async () => {
    try {
      await contestAPI.startContest(contestId);
      fetchDetails();
    } catch (err) {
      alert(err.message || "Failed to start contest.");
    }
  };

  // Run Code against samples
  const handleRunCode = async () => {
    if (isEnded) return;
    const activeProb = contest.problems[activeProblemIdx];
    const code = editorCodes[activeProb.id];

    setRunning(true);
    setVerdictData(null);
    setTestResults([]);
    try {
      const casesToRun = testCaseInputs.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isCustom: tc.isCustom || false,
      }));
      const res = await submissionsAPI.runCode(activeProb.id, language, code, casesToRun);
      setVerdictData(res.data);
      if (res.data.testResults && res.data.testResults.length > 0) {
        setTestResults(res.data.testResults);
        const firstFailed = res.data.testResults.findIndex((tr) => !tr.passed);
        setActiveCase(firstFailed >= 0 ? firstFailed : 0);
      }
      setBottomTab("result");
    } catch (err) {
      setVerdictData({
        verdict: "ERROR",
        errorMessage: err.message || "Failed to run sample test cases.",
      });
      setTestResults([
        {
          testNumber: 1,
          passed: false,
          verdict: "ERROR",
          executionTime: 0,
          input: "",
          expectedOutput: "",
          actualOutput: "",
          stderr: err.message || "Failed to run sample test cases.",
        },
      ]);
      setBottomTab("result");
      setActiveCase(0);
    } finally {
      setRunning(false);
    }
  };

  // Submit Code to Contest
  const handleSubmitCode = async () => {
    if (isEnded) return;
    const activeProb = contest.problems[activeProblemIdx];
    const code = editorCodes[activeProb.id];

    setSubmitting(true);
    setVerdictData(null);
    setTestResults([]);
    setBottomTab("result");
    try {
      await submissionsAPI.submitCode(activeProb.id, language, code, contestId);
      // Results will arrive asynchronously over WebSockets and trigger setSubmitting(false)
    } catch (err) {
      setVerdictData({
        verdict: "ERROR",
        errorMessage: err.message || "Failed to submit code.",
      });
      setTestResults([
        {
          testNumber: 1,
          passed: false,
          verdict: "ERROR",
          executionTime: 0,
          input: "",
          expectedOutput: "",
          actualOutput: "",
          stderr: err.message || "Failed to submit code.",
        },
      ]);
      setBottomTab("result");
      setActiveCase(0);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="contest-loading-screen">
        <div className="spinner"></div>
        <p>Connecting to Arena...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="contest-error-screen container">
        <div className="error-card glass-card">
          <h2>⚠️ Arena Blocked</h2>
          <p>{error}</p>
          <Link to="/contests" className="btn-primary">
            Return to Contests List
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------------
  // WAITING ROOM LOBBY STATE
  // ------------------------------------
  const hasStarted = contest.type === "ROOM" ? !!contest.startTime : !!contest.userParticipantState?.startedAt;

  if (!hasStarted) {
    const isCreator = contest.createdBy === user.id;
    return (
      <div className="waiting-room-container container">
        <div className="waiting-room-card glass-card slide-up">
          <span className="lobby-badge">👥 PRIVATE ROOM LOBBY</span>
          <h1>{contest.title}</h1>
          <p className="room-desc">{contest.description || "No description provided."}</p>

          <div className="share-code-box">
            <span>Share this code with your friends to join:</span>
            <div className="share-code-digits">
              {contest.code?.split("").map((char, i) => (
                <span key={i} className="digit">
                  {char}
                </span>
              ))}
            </div>
          </div>

          <div className="participants-lobby-section">
            <h3>Joined Members ({contest.participants.length})</h3>
            <div className="lobby-members-list">
              {contest.participants.map((p) => (
                <div key={p.userId} className="lobby-member-row">
                  <div className="member-avatar">
                    {p.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="member-meta">
                    <span className="member-name">{p.user.name}</span>
                    {p.userId === contest.createdBy && <span className="host-label">Lobby Host</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lobby-actions">
            {isCreator ? (
              <button onClick={triggerStart} className="btn-primary start-room-btn">
                🚀 Start Contest for Everyone
              </button>
            ) : (
              <div className="waiting-status-box">
                <div className="spin-dot"></div>
                <span>Waiting for the Host to start the coding challenge...</span>
              </div>
            )}
            <Link to="/contests" className="btn-secondary leave-lobby-btn">
              Leave Lobby
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------
  // ACTIVE CONTEST ARENA STATE
  // ------------------------------------
  const activeProblem = activeProblemIdx !== null ? contest.problems[activeProblemIdx] : null;

  if (activeProblemIdx === null) {
    return (
      <div className="arena-page-wrapper">
        {/* Top HUD bar */}
        <header className="arena-hud-bar">
          <div className="hud-left">
            <Link to="/contests" className="hud-back-btn">
              ⇦ Exit
            </Link>
            <span className="hud-title">{contest.title}</span>
          </div>

          <div className="hud-center">
            <div className={`hud-timer ${isEnded ? "ended" : ""}`}>
              <span className="timer-icon">⏱</span>
              <span className="timer-val">{timeRemaining}</span>
            </div>
          </div>

          <div className="hud-right">
            <span className="hud-username">Participant: {user.name}</span>
          </div>
        </header>

        <div className="contest-dashboard-container container">
          {/* Contest Stats / Info Grid */}
          <div className="dashboard-stats-grid">
            <div className="stat-card glass-card">
              <div className="stat-label">Problems</div>
              <div className="stat-value">{contest.problems.length}</div>
            </div>
            <div className="stat-card glass-card">
              <div className="stat-label">Duration</div>
              <div className="stat-value">{contest.duration} mins</div>
            </div>
            <div className="stat-card glass-card">
              <div className="stat-label">Lobby Type</div>
              <div className="stat-value">{contest.type}</div>
            </div>
            <div className="stat-card glass-card">
              <div className="stat-label">Total Participants</div>
              <div className="stat-value">{contest.participants.length}</div>
            </div>
          </div>

          <div className="dashboard-main-content">
            <div className="problems-section glass-card">
              <h2>Challenge Problems</h2>
              <div className="problems-table-wrapper">
                <table className="problems-table">
                  <thead>
                    <tr>
                      <th className="col-status">Status</th>
                      <th className="col-title">Title</th>
                      <th className="col-diff">Difficulty</th>
                      <th className="col-points">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contest.problems.map((p, idx) => {
                      const isSolved = recentVerdicts[p.id] === "ACCEPTED";
                      const isAttempted = recentVerdicts[p.id] && recentVerdicts[p.id] !== "ACCEPTED";

                      return (
                        <tr
                          key={p.id}
                          onClick={() => {
                            setActiveProblemIdx(idx);
                            setVerdictData(null);
                          }}
                          className="problem-row-item"
                        >
                          <td className="col-status">
                            {isSolved ? (
                              <span className="circle-check-icon">✓</span>
                            ) : isAttempted ? (
                              <span className="circle-attempted-icon">-</span>
                            ) : null}
                          </td>
                          <td className="col-title">
                            Problem {String.fromCharCode(65 + idx)}: {p.title}
                          </td>
                          <td className="col-diff">
                            <span className={`prob-diff badge-diff-${p.difficulty.toLowerCase()}`}>
                              {p.difficulty}
                            </span>
                          </td>
                          <td className="col-points">100</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="dashboard-leaderboard-section glass-card">
              <h2>Live Standings</h2>
              <div className="leaderboard-table-wrapper">
                <table className="leaderboard-table-full">
                  <thead>
                    <tr>
                      <th className="col-rank">Rank</th>
                      <th className="col-name">User</th>
                      <th className="col-score">Score</th>
                      <th className="col-penalty">Penalty</th>
                      {contest.problems.map((p, idx) => (
                        <th key={p.id} className="col-prob-header">
                          {String.fromCharCode(65 + idx)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((player) => {
                      const isSelf = player.userId === user.id;
                      return (
                        <tr key={player.userId} className={isSelf ? "self-row" : ""}>
                          <td className="col-rank">
                            {player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : player.rank === 3 ? "🥉" : `#${player.rank}`}
                          </td>
                          <td className="col-name truncate-text">{player.name}</td>
                          <td className="col-score">{player.score}</td>
                          <td className="col-penalty">{player.penalty}m</td>
                          {contest.problems.map((p) => {
                            const stat = player.problemStats ? player.problemStats[p.id] : null;
                            if (stat && stat.solved) {
                              return (
                                <td key={p.id} className="col-prob-cell">
                                  <div className="cell-solved-badge">
                                    <span className="solved-time">+{stat.solvedAtMinutes}m</span>
                                    {stat.wrongAttempts > 0 && (
                                      <span className="wrong-attempts-count">({stat.wrongAttempts})</span>
                                    )}
                                  </div>
                                </td>
                              );
                            } else if (stat && stat.attempts > 0) {
                              return (
                                <td key={p.id} className="col-prob-cell">
                                  <div className="cell-attempted-badge">
                                    <span className="attempt-label">-{stat.attempts}</span>
                                  </div>
                                </td>
                              );
                            } else {
                              return <td key={p.id} className="col-prob-cell">-</td>;
                            }
                          })}
                        </tr>
                      );
                    })}
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={4 + contest.problems.length} className="empty-leaderboard-msg">
                          No score submissions yet. Start solving to climb the ranks!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="arena-page-wrapper">
      {/* Top HUD bar */}
      <header className="arena-hud-bar">
        <div className="hud-left">
          <button onClick={() => setActiveProblemIdx(null)} className="hud-back-btn">
            ⇦ Back to Contest
          </button>
          <span className="hud-title">{contest.title}</span>
        </div>

        <div className="hud-center">
          <div className="hud-problem-nav">
            <button
              onClick={() => {
                setActiveProblemIdx((prev) => Math.max(0, prev - 1));
                setVerdictData(null);
              }}
              disabled={activeProblemIdx === 0}
              className="nav-arrow-btn"
            >
              ◀ Prev
            </button>
            <select
              value={activeProblemIdx}
              onChange={(e) => {
                setActiveProblemIdx(parseInt(e.target.value, 10));
                setVerdictData(null);
              }}
              className="hud-problem-select"
            >
              {contest.problems.map((p, idx) => {
                const isSolved = recentVerdicts[p.id] === "ACCEPTED";
                return (
                  <option key={p.id} value={idx}>
                    {isSolved ? "✓ " : ""}{String.fromCharCode(65 + idx)}. {p.title}
                  </option>
                );
              })}
            </select>
            <button
              onClick={() => {
                setActiveProblemIdx((prev) => Math.min(contest.problems.length - 1, prev + 1));
                setVerdictData(null);
              }}
              disabled={activeProblemIdx === contest.problems.length - 1}
              className="nav-arrow-btn"
            >
              Next ▶
            </button>
          </div>
        </div>

        <div className="hud-right">
          <div className={`hud-timer ${isEnded ? "ended" : ""}`}>
            <span className="timer-icon">⏱</span>
            <span className="timer-val">{timeRemaining}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Split Grid */}
      <div className="arena-split-layout workspace-layout">
        {/* Left pane: Problem Statement */}
        <section className="arena-left-pane">
          <div className="problem-statement-scrollbox">
            <div className="problem-header">
              <h2>{activeProblem.title}</h2>
              <div className="problem-labels">
                <span className={`prob-diff badge-diff-${activeProblem.difficulty.toLowerCase()}`}>
                  {activeProblem.difficulty}
                </span>
                <span className="prob-topic-tag">Topic: {activeProblem.topic}</span>
              </div>
            </div>

            <div className="problem-description-content">
              <h3>Description</h3>
              <p className="statement-p">{activeProblem.description}</p>

              {activeProblem.constraints && (
                <>
                  <h3>Constraints</h3>
                  <pre className="code-pre">{activeProblem.constraints}</pre>
                </>
              )}

              {activeProblem.sampleInput && (
                <>
                  <h3>Sample Input</h3>
                  <pre className="code-pre">{activeProblem.sampleInput}</pre>
                </>
              )}

              {activeProblem.sampleOutput && (
                <>
                  <h3>Sample Output</h3>
                  <pre className="code-pre">{activeProblem.sampleOutput}</pre>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Middle pane: Monaco Editor & Output Console */}
        <section className="arena-middle-pane">
          <div className="editor-controls-bar">
            <select
              value={language}
              onChange={handleLanguageChange}
              className="arena-lang-select"
            >
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="python">Python 3</option>
              <option value="cpp">C++ (GCC)</option>
              <option value="java">Java (OpenJDK)</option>
              <option value="c">C (GCC)</option>
            </select>
          </div>

          <div className="monaco-wrapper">
            <Editor
              theme="vs-dark"
              language={language === "cpp" || language === "c" ? "cpp" : language}
              value={editorCodes[activeProblem.id] || ""}
              onChange={handleEditorChange}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                readOnly: isEnded,
              }}
            />
          </div>

          {/* Action buttons */}
          <div className="editor-actions-bar">
            <button
              onClick={handleRunCode}
              disabled={running || submitting || isEnded}
              className="btn-secondary run-btn"
            >
              {running ? "Running..." : "▶ Run Sample Cases"}
            </button>
            <button
              onClick={handleSubmitCode}
              disabled={running || submitting || isEnded}
              className="btn-primary submit-btn"
            >
              {submitting ? "Submitting..." : "🚀 Submit Solution"}
            </button>
          </div>

          {/* LeetCode-style console wrapper */}
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
                {verdictData && (
                  <span className={`tab-dot ${verdictData.verdict === "ACCEPTED" ? "dot-pass" : "dot-fail"}`}></span>
                )}
                📟 Test Result
              </button>
            </div>

            <div className="console-body">
              {/* Testcases input view */}
              {bottomTab === "testcase" && (
                <div className="console-tab-content testcase-tab">
                  <div className="case-tabs-row">
                    {testCaseInputs.map((tc, idx) => (
                      <button
                        key={idx}
                        className={`case-tab ${activeCase === idx ? "active" : ""}`}
                        onClick={() => setActiveCase(idx)}
                      >
                        Case {idx + 1}
                      </button>
                    ))}
                  </div>

                  {testCaseInputs[activeCase] && (
                    <div className="case-detail-grid">
                      <div className="case-field">
                        <label className="case-field-label">Input</label>
                        <pre className="case-pre-display">{testCaseInputs[activeCase].input}</pre>
                      </div>
                      {testCaseInputs[activeCase].expectedOutput && (
                        <div className="case-field">
                          <label className="case-field-label">Expected Output</label>
                          <pre className="case-pre-display">{testCaseInputs[activeCase].expectedOutput}</pre>
                        </div>
                      )}
                    </div>
                  )}
                  {testCaseInputs.length === 0 && (
                    <div className="empty-console-placeholder">
                      No sample test cases available for this problem.
                    </div>
                  )}
                </div>
              )}

              {/* Execution Results view */}
              {bottomTab === "result" && (
                <div className="console-tab-content result-tab">
                  {verdictData ? (
                    <div className="result-tab-inner">
                      <div className={`verdict-output-banner ${verdictData.verdict.toLowerCase()}`}>
                        <span className="verdict-label">Verdict:</span>
                        <strong className="verdict-name">{verdictData.verdict}</strong>
                        {verdictData.executionTime !== undefined && (
                          <span className="verdict-metrics">(Time: {verdictData.executionTime}ms)</span>
                        )}
                      </div>

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
                                Case {tr.testNumber}
                              </button>
                            ))}
                          </div>

                          {testResults[activeCase] && (
                            <div className="case-result-detail">
                              <div className={`case-result-status ${testResults[activeCase].passed ? "passed" : "failed"}`}>
                                {testResults[activeCase].passed ? "✅ Passed" : `❌ ${testResults[activeCase].verdict.replace(/_/g, " ")}`}
                              </div>

                              <div className="case-detail-grid result-grid">
                                {testResults[activeCase].input !== undefined && (
                                  <div className="case-field">
                                    <label className="case-field-label">Input</label>
                                    <pre className="case-pre-display">{testResults[activeCase].input}</pre>
                                  </div>
                                )}
                                {testResults[activeCase].expectedOutput !== undefined && (
                                  <div className="case-field">
                                    <label className="case-field-label">Expected Output</label>
                                    <pre className="case-pre-display">{testResults[activeCase].expectedOutput}</pre>
                                  </div>
                                )}
                                {testResults[activeCase].actualOutput !== undefined && (
                                  <div className="case-field">
                                    <label className="case-field-label">Your Output</label>
                                    <pre className={`case-pre-display ${testResults[activeCase].passed ? "output-pass" : "output-fail"}`}>
                                      {testResults[activeCase].actualOutput || "(empty)"}
                                    </pre>
                                  </div>
                                )}
                                {(testResults[activeCase].stderr || testResults[activeCase].errorMessage) && (
                                  <div className="case-field full-width-field">
                                    <label className="case-field-label stderr-label">Stderr</label>
                                    <pre className="case-pre-display stderr-display">
                                      {testResults[activeCase].stderr || testResults[activeCase].errorMessage}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      
                      {!testResults.length && verdictData.errorMessage && (
                        <div className="error-only-container">
                          <pre className="error-trace-pre">{verdictData.errorMessage}</pre>
                        </div>
                      )}
                    </div>
                  ) : submitting ? (
                    <div className="console-info-message">
                      <div className="spin-dot"></div>
                      <span>Submitting solution to remote execution queues... Waiting for grading.</span>
                    </div>
                  ) : (
                    <div className="console-placeholder-message">
                      Run or Submit code to see execution outputs here.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ContestArena;
