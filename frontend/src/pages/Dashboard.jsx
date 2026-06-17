import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { userAPI } from "../services/api.js";
import "./Dashboard.css";

function Dashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      userAPI
        .getUserStats()
        .then((res) => {
          setStats(res.data);
        })
        .catch((err) => {
          console.error(err);
          setError(err.message || "Failed to load analytics data.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isAuthenticated]);

  if (authLoading || loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Analyzing your performance history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <div className="error-card">
          <h2>⚠️ Analytics Unavailable</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const {
    totalSolved,
    totalProblems,
    difficultyStats,
    topicStats,
    confidenceTiers,
    recommendations,
  } = stats;

  const solveRate = totalProblems > 0 ? ((totalSolved / totalProblems) * 100).toFixed(1) : 0;

  // Concentric Rings Dimensions
  const center = 100;
  const rings = [
    {
      key: "EASY",
      color: "#10b981", // Emerald Green
      radius: 75,
      solved: difficultyStats.EASY.solved,
      total: difficultyStats.EASY.total,
    },
    {
      key: "MEDIUM",
      color: "#f59e0b", // Amber Yellow
      radius: 55,
      solved: difficultyStats.MEDIUM.solved,
      total: difficultyStats.MEDIUM.total,
    },
    {
      key: "HARD",
      color: "#ef4444", // Rose Red
      radius: 35,
      solved: difficultyStats.HARD.solved,
      total: difficultyStats.HARD.total,
    },
  ];



  return (
    <div className="dashboard-container container">
      {/* Header Profile Section */}
      <header className="dashboard-header">
        <div className="user-profile-summary">
          <div className="user-avatar-large">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="user-info-text">
            <h1>Welcome back, {user.name}!</h1>
          </div>
        </div>
        <div className="overall-stats-banner">
          <div className="stat-box">
            <span className="stat-label">Solved Problems</span>
            <span className="stat-value">
              {totalSolved}
              <span className="stat-denominator">/{totalProblems}</span>
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Completion Rate</span>
            <span className="stat-value">{solveRate}%</span>
          </div>
        </div>
      </header>

      {/* Main Grid: Doughnut / Radar */}
      <div className="dashboard-grid">
        {/* Doughnut / Concentric Progress Rings Panel */}
        <section className="dashboard-card progress-rings-card">
          <h2>Difficulty Distribution</h2>
          <div className="concentric-rings-container">
            <svg width="200" height="200" className="concentric-rings-svg">
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {rings.map((ring) => {
                const circumference = 2 * Math.PI * ring.radius;
                const percentage = ring.total > 0 ? ring.solved / ring.total : 0;
                const strokeDashoffset = circumference - percentage * circumference;

                return (
                  <g key={ring.key}>
                    {/* Background Ring */}
                    <circle
                      cx={center}
                      cy={center}
                      r={ring.radius}
                      className="ring-bg"
                      strokeWidth="8"
                    />
                    {/* Active Ring */}
                    <circle
                      cx={center}
                      cy={center}
                      r={ring.radius}
                      className="ring-active"
                      stroke={ring.color}
                      strokeWidth="8"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      transform={`rotate(-90 ${center} ${center})`}
                      filter="url(#glow)"
                    />
                  </g>
                );
              })}
            </svg>
            <div className="concentric-legend">
              {rings.map((ring) => (
                <div key={ring.key} className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: ring.color }}></span>
                  <div className="legend-details">
                    <span className="legend-name">{ring.key.charAt(0) + ring.key.slice(1).toLowerCase()}</span>
                    <span className="legend-fraction">
                      <strong>{ring.solved}</strong> / {ring.total}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>


      </div>

      {/* Confidence Tiers & Skill Metrics */}
      <section className="dashboard-card tiers-card">
        <h2>Topic Confidence Tiers</h2>
        <p className="card-subtitle">Topics are grouped by your calculated confidence score (accuracy weighted by solved counts).</p>
        <div className="tiers-grid">
          {/* Weak Column */}
          <div className="tier-column tier-weak">
            <h3 className="tier-title">🔴 Weak Tiers</h3>
            <div className="tier-topic-list">
              {confidenceTiers.weak.length > 0 ? (
                confidenceTiers.weak.map((topic) => {
                  const stat = topicStats.find((s) => s.topic === topic);
                  return (
                    <div key={topic} className="tier-topic-card">
                      <span className="topic-name">{topic}</span>
                      <span className="topic-confidence">{stat ? stat.confidenceScore.toFixed(0) : 0}% confidence</span>
                    </div>
                  );
                })
              ) : (
                <p className="empty-tier-text">No weak topics! Good job.</p>
              )}
            </div>
          </div>

          {/* Medium Column */}
          <div className="tier-column tier-medium">
            <h3 className="tier-title">🟡 Medium Tiers</h3>
            <div className="tier-topic-list">
              {confidenceTiers.medium.length > 0 ? (
                confidenceTiers.medium.map((topic) => {
                  const stat = topicStats.find((s) => s.topic === topic);
                  return (
                    <div key={topic} className="tier-topic-card">
                      <span className="topic-name">{topic}</span>
                      <span className="topic-confidence">{stat ? stat.confidenceScore.toFixed(0) : 0}% confidence</span>
                    </div>
                  );
                })
              ) : (
                <p className="empty-tier-text">No topics in medium tier.</p>
              )}
            </div>
          </div>

          {/* Strong Column */}
          <div className="tier-column tier-strong">
            <h3 className="tier-title">🟢 Strong Tiers</h3>
            <div className="tier-topic-list">
              {confidenceTiers.strong.length > 0 ? (
                confidenceTiers.strong.map((topic) => {
                  const stat = topicStats.find((s) => s.topic === topic);
                  return (
                    <div key={topic} className="tier-topic-card">
                      <span className="topic-name">{topic}</span>
                      <span className="topic-confidence">{stat ? stat.confidenceScore.toFixed(0) : 0}% confidence</span>
                    </div>
                  );
                })
              ) : (
                <p className="empty-tier-text">Keep solving problems to build strong tiers!</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Personalized Practice Recommendations */}
      <section className="dashboard-card recommendations-card">
        <h2>Recommended Practice Problems</h2>
        <p className="card-subtitle">These unsolved problems are selected from your weakest topics to help you improve.</p>
        <div className="recommendations-list">
          {recommendations.length > 0 ? (
            recommendations.map((problem) => (
              <div key={problem.id} className="recommendation-item-card">
                <div className="recommendation-details">
                  <span className={`difficulty-badge diff-${problem.difficulty.toLowerCase()}`}>
                    {problem.difficulty}
                  </span>
                  <h3 className="recommendation-title">{problem.title}</h3>
                  <span className="recommendation-topic">Topic: {problem.topic}</span>
                </div>
                <Link to={`/problems/${problem.id}`} className="btn-primary solve-btn">
                  Solve Now
                </Link>
              </div>
            ))
          ) : (
            <div className="all-solved-card">
              🎉 <strong>Wow!</strong> You have solved all recommended problems. Try exploring the full problem list!
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
