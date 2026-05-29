import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

function ChooseUsername() {
  const [name, setName] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { setGoogleUsername } = useAuth();
  const navigate = useNavigate();

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    setUsernameError(validateUsername(val));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const nameErr = validateUsername(name);
    if (nameErr) {
      setError(nameErr);
      return;
    }

    setLoading(true);

    try {
      await setGoogleUsername(name);
      navigate("/");
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
            <div className="choose-username-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h1 className="auth-title">Choose your username</h1>
            <p className="auth-subtitle">
              One last step — pick a unique username for your OrbitIDE profile
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="auth-error" id="username-error">
              <span className="auth-error-icon">⚠</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="auth-form" id="choose-username-form">
            <div className="form-group">
              <label htmlFor="choose-username" className="form-label">Username</label>
              <input
                id="choose-username"
                type="text"
                className={`form-input ${usernameError ? "form-input--error" : name.length >= 3 && !usernameError ? "form-input--valid" : ""}`}
                placeholder="john-doe"
                value={name}
                onChange={handleNameChange}
                required
                autoComplete="username"
                maxLength={20}
                autoFocus
              />
              {usernameError && (
                <span className="form-hint form-hint--error">{usernameError}</span>
              )}
              {!usernameError && name.length >= 3 && (
                <span className="form-hint form-hint--valid">✓ Looks good!</span>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary auth-submit"
              disabled={loading || !!usernameError || name.length < 3}
              id="choose-username-submit-btn"
            >
              {loading ? (
                <>
                  <span className="btn-spinner"></span>
                  Setting username...
                </>
              ) : (
                "Continue to OrbitIDE"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ChooseUsername;
