import { useState, useCallback } from "react";
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
  const [googleLoading, setGoogleLoading] = useState(false);

  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    setUsernameError(validateUsername(val));
  };

  const handleGoogleLogin = useCallback(() => {
    setError("");
    setGoogleLoading(true);

    try {
      if (!window.google) {
        setError("Google Sign-In is loading. Please try again in a moment.");
        setGoogleLoading(false);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            const res = await googleLogin(response.credential);
            if (res.data.needsUsername) {
              navigate("/choose-username");
            } else {
              navigate("/");
            }
          } catch (err) {
            setError(err.message);
          } finally {
            setGoogleLoading(false);
          }
        },
      });

      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          const btnDiv = document.createElement("div");
          btnDiv.style.display = "none";
          document.body.appendChild(btnDiv);

          window.google.accounts.id.renderButton(btnDiv, {
            type: "standard",
            size: "large",
          });

          const btn = btnDiv.querySelector('[role="button"]');
          if (btn) btn.click();

          setTimeout(() => btnDiv.remove(), 100);
        }
      });
    } catch (err) {
      setError("Failed to initialize Google Sign-In.");
      setGoogleLoading(false);
    }
  }, [googleLogin, navigate]);


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
              {/* Google Sign-Up Button */}
              <button
                type="button"
                className="google-btn"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                id="google-register-btn"
              >
                {googleLoading ? (
                  <span className="btn-spinner btn-spinner--dark"></span>
                ) : (
                  <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Sign up with Google
              </button>

              {/* Divider */}
              <div className="auth-divider">
                <span>OR</span>
              </div>

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
