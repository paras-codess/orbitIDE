import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { contestAPI, problemsAPI } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import "./ContestList.css";

function ContestList() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [contests, setContests] = useState([]);
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Join Code Input State
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  // Create Modal State
  const [showModal, setShowModal] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createDuration, setCreateDuration] = useState("60");
  const [createType, setCreateType] = useState("SOLO");
  const [selectedProblems, setSelectedProblems] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Redirect if guest
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Load contests and problems
  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      Promise.all([
        contestAPI.getContests(),
        problemsAPI.getProblems({ limit: 100 })
      ])
        .then(([contestRes, problemRes]) => {
          setContests(contestRes.data || []);
          setProblems(problemRes.data?.problems || problemRes.data || []);
        })
        .catch((err) => {
          console.error(err);
          setError(err.message || "Failed to load contests data.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isAuthenticated]);

  // Handle Joining Contest Room
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setJoinError("");
    setJoining(true);
    try {
      const res = await contestAPI.joinContest(joinCode.trim());
      navigate(`/contests/${res.data.contest.id}`);
    } catch (err) {
      setJoinError(err.message || "Invalid room code.");
    } finally {
      setJoining(false);
    }
  };

  // Toggle Problem Selection
  const toggleProblem = (id) => {
    setSelectedProblems((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  // Handle Create Contest
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      setCreateError("Contest title is required.");
      return;
    }
    if (selectedProblems.length === 0) {
      setCreateError("You must select at least one problem.");
      return;
    }

    setCreateError("");
    setCreating(true);
    try {
      const res = await contestAPI.createContest({
        title: createTitle,
        description: createDesc,
        duration: parseInt(createDuration, 10),
        type: createType,
        problemIds: selectedProblems,
      });
      // Redirect directly to the contest arena
      navigate(`/contests/${res.data.id}`);
    } catch (err) {
      setCreateError(err.message || "Failed to create contest.");
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="contest-loading-screen">
        <div className="spinner"></div>
        <p>Loading contests platform...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="contest-error-screen container">
        <div className="error-card glass-card">
          <h2>⚠️ Platform Unavailable</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="contest-list-container container">
      {/* Top Banner */}
      <header className="contest-banner glass-card">
        <div className="banner-content">
          <span className="banner-badge">⏱ Live Coding Arena</span>
          <h1>Custom Contests & Mock Tests</h1>
          <p>
            Create personalized coding contests, invite friends to solve in real time with live leaderboards,
            or run solo timed assessments to practice for real technical interviews.
          </p>
        </div>
        <div className="banner-actions">
          <button onClick={() => setShowModal(true)} className="btn-primary create-contest-btn">
            Create Contest Room
          </button>
        </div>
      </header>

      {/* Join & Main Section */}
      <div className="contest-main-grid">
        {/* Left column: User Contests list */}
        <section className="contests-section">
          <h2>Your Active & Past Contests</h2>
          <div className="contests-grid">
            {contests.length > 0 ? (
              contests.map((c) => {
                const isCreator = c.createdBy === c.participants[0]?.userId; // approx check
                return (
                  <div key={c.id} className="contest-row-card glass-card">
                    <div className="contest-meta-info">
                      <span className={`contest-type-badge type-${c.type.toLowerCase()}`}>
                        {c.type === "SOLO" ? "👤 SOLO MOCK" : "👥 ROOM CONTEST"}
                      </span>
                      <h3>{c.title}</h3>
                      <p className="contest-desc">{c.description || "No description provided."}</p>
                      <div className="contest-footer-meta">
                        <span>⏱ {c.duration} mins</span>
                        <span>•</span>
                        <span>👥 {c.participants.length} Participant(s)</span>
                      </div>
                    </div>
                    <div className="contest-row-actions">
                      {c.type === "ROOM" && c.code && !c.startTime && (
                        <div className="room-code-tag">
                          Code: <strong>{c.code}</strong>
                        </div>
                      )}
                      <button
                        onClick={() => navigate(`/contests/${c.id}`)}
                        className="btn-secondary enter-arena-btn"
                      >
                        Enter Arena ➔
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="no-contests-card glass-card">
                <p>No contest history found. Click "Create Contest Room" to start your first assessment!</p>
              </div>
            )}
          </div>
        </section>

        {/* Right column: Join Room card */}
        <aside className="join-room-aside">
          <div className="join-room-card glass-card">
            <h2>Join Custom Room</h2>
            <p>Enter a 6-character room code shared by a peer to join their multiplayer contest lobby.</p>
            <form onSubmit={handleJoin} className="join-form">
              <input
                type="text"
                maxLength="6"
                placeholder="E.g. A4D9X2"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                required
                className="join-input-field"
              />
              {joinError && <div className="join-error-msg">⚠️ {joinError}</div>}
              <button type="submit" disabled={joining} className="btn-primary join-submit-btn">
                {joining ? "Joining Room..." : "Join Contest Room"}
              </button>
            </form>
          </div>
        </aside>
      </div>

      {/* CREATE CONTEST MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card slide-up">
            <div className="modal-header">
              <h2>Setup Custom Contest</h2>
              <button onClick={() => setShowModal(false)} className="close-modal-btn">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="create-contest-form">
              {createError && <div className="create-error-msg">⚠️ {createError}</div>}

              {/* Title & Desc */}
              <div className="modal-form-group">
                <label className="form-label">Contest Title</label>
                <input
                  type="text"
                  placeholder="E.g., FAANG Mock Assessment"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  required
                  className="modal-input"
                />
              </div>

              <div className="modal-form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea
                  placeholder="Brief context about this challenge..."
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  className="modal-textarea"
                />
              </div>

              {/* Duration & Type */}
              <div className="modal-form-row">
                <div className="modal-form-group half-width">
                  <label className="form-label">Duration (Minutes)</label>
                  <select
                    value={createDuration}
                    onChange={(e) => setCreateDuration(e.target.value)}
                    className="modal-select"
                  >
                    <option value="15">15 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">60 Minutes</option>
                    <option value="90">90 Minutes</option>
                    <option value="120">120 Minutes</option>
                    <option value="180">180 Minutes</option>
                  </select>
                </div>

                <div className="modal-form-group half-width">
                  <label className="form-label">Lobby Type</label>
                  <div className="type-toggle-wrapper">
                    <button
                      type="button"
                      className={`type-btn ${createType === "SOLO" ? "active" : ""}`}
                      onClick={() => setCreateType("SOLO")}
                    >
                      👤 Solo Practice
                    </button>
                    <button
                      type="button"
                      className={`type-btn ${createType === "ROOM" ? "active" : ""}`}
                      onClick={() => setCreateType("ROOM")}
                    >
                      👥 Shareable Lobby
                    </button>
                  </div>
                </div>
              </div>

              {/* Problem Selection Checkbox Grid */}
              <div className="modal-form-group">
                <label className="form-label">Select Problems ({selectedProblems.length} chosen)</label>
                <div className="problems-selection-list">
                  {problems.map((prob) => (
                    <div
                      key={prob.id}
                      className={`problem-selection-row ${
                        selectedProblems.includes(prob.id) ? "selected" : ""
                      }`}
                      onClick={() => toggleProblem(prob.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProblems.includes(prob.id)}
                        onChange={() => {}} // handled by row click
                        className="problem-checkbox-input"
                      />
                      <div className="problem-selection-meta">
                        <span className="prob-title">{prob.title}</span>
                        <span className={`prob-diff badge-diff-${prob.difficulty.toLowerCase()}`}>
                          {prob.difficulty}
                        </span>
                        <span className="prob-topic">{prob.topic}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="modal-footer-actions">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary modal-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary modal-submit-btn"
                >
                  {creating ? "Launching Lobby..." : "Create Contest"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContestList;
