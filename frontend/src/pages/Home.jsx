import { Link } from "react-router-dom";
import "./Home.css";

function Home() {
  const features = [
    {
      icon: "⚡",
      title: "Online IDE",
      description: "Code in C++, Java, Python, and Go with our Monaco-powered editor featuring syntax highlighting and auto-save.",
    },
    {
      icon: "🤖",
      title: "AI Assistant",
      description: "Get AI-powered code explanations, complexity analysis, bug detection, and optimization suggestions.",
    },
    {
      icon: "📊",
      title: "DSA Analytics",
      description: "Track your strengths and weaknesses across topics with personalized learning paths and recommendations.",
    },
    {
      icon: "👥",
      title: "Collaborative Coding",
      description: "Real-time collaborative coding rooms with live synchronization, cursor tracking, and shared execution.",
    },
    {
      icon: "🏆",
      title: "Contests",
      description: "Compete in timed coding contests with live leaderboards, rankings, and upsolving capabilities.",
    },
    {
      icon: "🔮",
      title: "DSA Visualizer",
      description: "Visualize sorting, graph, tree, and DP algorithms step-by-step with interactive speed controls.",
    },
  ];

  const stats = [
    { value: "500+", label: "Problems" },
    { value: "14+", label: "DSA Topics" },
    { value: "4", label: "Languages" },
    { value: "∞", label: "Possibilities" },
  ];

  return (
    <div className="home">
      {/* ====== Hero Section ====== */}
      <section className="hero" id="hero-section">
        <div className="hero-bg">
          <div className="hero-glow hero-glow--1"></div>
          <div className="hero-glow hero-glow--2"></div>
          <div className="hero-grid"></div>
        </div>

        <div className="hero-content container">
          <div className="hero-badge">
            <span className="hero-badge-dot"></span>
            AI-Powered Coding Platform
          </div>

          <h1 className="hero-title">
            Code Smarter.
            <br />
            <span className="gradient-text">Learn Faster.</span>
          </h1>

          <p className="hero-description">
            OrbitIDE AI combines an online IDE, intelligent judge, AI mentoring,
            algorithm visualization, and real-time collaboration — all in one
            powerful platform.
          </p>

          <div className="hero-actions">
            <Link to="/register" className="btn-primary btn-lg" id="hero-get-started-btn">
              Get Started — It&apos;s Free
              <span className="btn-arrow">→</span>
            </Link>
            <Link to="/problems" className="btn-secondary btn-lg" id="hero-explore-btn">
              Explore Problems
            </Link>
          </div>

          {/* Stats */}
          <div className="hero-stats">
            {stats.map((stat) => (
              <div key={stat.label} className="hero-stat">
                <span className="hero-stat-value">{stat.value}</span>
                <span className="hero-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== Features Section ====== */}
      <section className="features" id="features-section">
        <div className="container">
          <div className="features-header">
            <span className="section-tag">Features</span>
            <h2 className="section-title">
              Everything you need to
              <span className="gradient-text"> master DSA</span>
            </h2>
            <p className="section-description">
              From code execution to AI analysis — OrbitIDE AI provides a
              complete ecosystem for coding practice and interview preparation.
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature) => (
              <div key={feature.title} className="feature-card glass-card" id={`feature-${feature.title.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== CTA Section ====== */}
      <section className="cta" id="cta-section">
        <div className="container">
          <div className="cta-card glass-card glow">
            <h2 className="cta-title">
              Ready to level up your coding skills?
            </h2>
            <p className="cta-description">
              Join OrbitIDE AI today and start your journey towards becoming a
              better programmer with AI-guided learning.
            </p>
            <Link to="/register" className="btn-primary btn-lg" id="cta-start-btn">
              Start Coding Now
              <span className="btn-arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ====== Footer ====== */}
      <footer className="footer" id="main-footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand">
              <span className="navbar-logo">
                <span className="logo-icon">⟐</span>
                <span className="logo-text">
                  Orbit<span className="gradient-text">IDE</span>
                </span>
                <span className="logo-badge">AI</span>
              </span>
              <p className="footer-tagline">
                AI-Powered Collaborative Coding Platform
              </p>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <h4>Platform</h4>
                <ul>
                  <li><Link to="/problems">Problems</Link></li>
                  <li><Link to="/ide">IDE</Link></li>
                  <li><Link to="/contests">Contests</Link></li>
                  <li><Link to="/visualizer">Visualizer</Link></li>
                </ul>
              </div>
              <div className="footer-col">
                <h4>Resources</h4>
                <ul>
                  <li><a href="#">Documentation</a></li>
                  <li><a href="#">Blog</a></li>
                  <li><a href="#">Roadmaps</a></li>
                </ul>
              </div>
              <div className="footer-col">
                <h4>Connect</h4>
                <ul>
                  <li><a href="https://github.com/paras-codess/orbitIDE" target="_blank" rel="noreferrer">GitHub</a></li>
                  <li><a href="#">Discord</a></li>
                  <li><a href="#">Twitter</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} OrbitIDE AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
