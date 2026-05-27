import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./Auth.css";

const USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|[ _-](?=[a-zA-Z0-9])){2,19}$/;
const RESERVED_WORDS = [
  "admin", "administrator", "root", "support", "moderator", "help", "system",
  "orbitide", "orbit", "orbit-ide", "staff",
  "api", "auth", "login", "logout", "settings", "profile", "null", "undefined", "status",
];

function validateUsername(value) {
  if (!value) return "";
  if (value.length < 3) return "Must be at least 3 characters.";
  if (value.length > 20) return "Must be 20 characters or fewer.";
  if (/^[ _-]/.test(value)) return "Cannot start with a separator.";
  if (/[ _-]$/.test(value)) return "Cannot end with a separator.";
  if (/[ _-]{2}/.test(value)) return "No consecutive separators allowed.";
  if (/[^a-zA-Z0-9 _-]/.test(value)) return "Only letters, numbers, spaces, hyphens, and underscores allowed.";
  if (RESERVED_WORDS.includes(value.toLowerCase())) return "This username is reserved.";
  if (!USERNAME_REGEX.test(value)) return "Invalid username format.";
  return "";
}

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    setUsernameError(validateUsername(val));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Username validation
    const nameErr = validateUsername(name);
    if (nameErr) {
      setError(nameErr);
      return;
    }

    // Client-side validation
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password);
      setIsRegistered(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-glow auth-glow--1"></div>
        <div className="auth-glow auth-glow--2"></div>
      </div>

      <div className="auth-container">
        <div className="auth-card glass-card">
          {/* Header */}
          <div className="auth-header">
            <Link to="/" className="auth-logo">
              <span className="logo-icon">⟐</span>
              <span className="logo-text">
                Orbit<span className="gradient-text">IDE</span>
              </span>
              <span className="logo-badge">AI</span>
            </Link>
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-subtitle">Start your coding journey today</p>
          </div>

          {/* Error Message */}
          {error && !isRegistered && (
            <div className="auth-error" id="register-error">
              <span className="auth-error-icon">⚠</span>
              {error}
            </div>
          )}

          {isRegistered ? (
            <div className="auth-success-view" style={{ textAlign: "center", padding: "10px 0" }}>
              <div className="success-icon-wrapper" style={{ fontSize: "50px", marginBottom: "15px", display: "inline-block", background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", borderRadius: "50%", width: "90px", height: "90px", lineHeight: "90px" }}>📨</div>
              <h2 className="auth-success-title" style={{ fontSize: "22px", fontWeight: "600", color: "#f8fafc", marginBottom: "12px" }}>Check your email</h2>
              <p className="auth-subtitle" style={{ marginBottom: "24px", fontSize: "14px", color: "#94a3b8", lineHeight: "1.6" }}>
                We've sent a verification link to <strong style={{ color: "#3b82f6" }}>{email}</strong>.<br />
                Please check your inbox and click the link to activate your account.
              </p>
              <Link to="/login" className="btn-primary auth-submit" style={{ display: "block", textDecoration: "none", textAlign: "center", width: "100%", boxSizing: "border-box", padding: "12px" }}>
                Go to Login
              </Link>
            </div>
          ) : (
            <>
              {/* Form */}
              <form onSubmit={handleSubmit} className="auth-form" id="register-form">
                <div className="form-group">
                  <label htmlFor="register-name" className="form-label">Username</label>
                  <input
                    id="register-name"
                    type="text"
                    className={`form-input ${usernameError ? "form-input--error" : name.length >= 3 && !usernameError ? "form-input--valid" : ""}`}
                    placeholder="john-doe"
                    value={name}
                    onChange={handleNameChange}
                    required
                    autoComplete="username"
                    maxLength={20}
                  />
                  {usernameError && (
                    <span className="form-hint form-hint--error">{usernameError}</span>
                  )}
                  {!usernameError && name.length >= 3 && (
                    <span className="form-hint form-hint--valid">✓ Looks good!</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="register-email" className="form-label">Email</label>
                  <input
                    id="register-email"
                    type="email"
                    className="form-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="register-password" className="form-label">Password</label>
                  <div className="form-input-wrapper">
                    <input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      className="form-input"
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="form-toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="register-confirm-password" className="form-label">Confirm Password</label>
                  <input
                    id="register-confirm-password"
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary auth-submit"
                  disabled={loading}
                  id="register-submit-btn"
                >
                  {loading ? (
                    <>
                      <span className="btn-spinner"></span>
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>

              {/* Footer */}
              <div className="auth-footer">
                <p>
                  Already have an account?{" "}
                  <Link to="/login" className="auth-link">
                    Log in
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Register;
