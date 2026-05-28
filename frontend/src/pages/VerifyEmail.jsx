import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authAPI } from "../services/api.js";
import "./Auth.css";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");
  const hasCalledRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing. Please check your verification link.");
      return;
    }

    // Prevent double-call from React StrictMode in development
    if (hasCalledRef.current) return;
    hasCalledRef.current = true;

    const verifyToken = async () => {
      try {
        const response = await authAPI.verifyEmail(token);
        setStatus("success");
        setMessage(response.message || "Your email has been verified successfully!");
      } catch (error) {
        setStatus("error");
        setMessage(error.message || "Invalid or expired verification token.");
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-glow auth-glow--1"></div>
        <div className="auth-glow auth-glow--2"></div>
      </div>

      <div className="auth-container">
        <div className="auth-card glass-card" style={{ textAlign: "center" }}>
          {/* Header */}
          <div className="auth-header">
            <Link to="/" className="auth-logo">
              <span className="logo-icon">⟐</span>
              <span className="logo-text">
                Orbit<span className="gradient-text">IDE</span>
              </span>
              <span className="logo-badge">AI</span>
            </Link>
          </div>

          {/* Status Rendering */}
          {status === "verifying" && (
            <div style={{ padding: "20px 0" }}>
              <div
                className="loading-spinner"
                style={{
                  margin: "0 auto 20px auto",
                  width: "50px",
                  height: "50px",
                  borderWidth: "4px",
                }}
              ></div>
              <h2 className="auth-title" style={{ fontSize: "22px", fontWeight: "600", color: "#f8fafc" }}>
                Verifying Email
              </h2>
              <p className="auth-subtitle" style={{ marginTop: "10px" }}>
                Please wait while we verify your activation token...
              </p>
            </div>
          )}

          {status === "success" && (
            <div style={{ padding: "10px 0" }}>
              <div
                className="success-icon-wrapper"
                style={{
                  fontSize: "50px",
                  marginBottom: "20px",
                  display: "inline-block",
                  background: "rgba(34, 197, 94, 0.1)",
                  color: "#22c55e",
                  borderRadius: "50%",
                  width: "90px",
                  height: "90px",
                  lineHeight: "90px",
                  animation: "scaleIn 0.3s ease-out",
                }}
              >
                ✓
              </div>
              <h2 className="auth-title" style={{ fontSize: "24px", fontWeight: "700", color: "#f8fafc" }}>
                Email Verified!
              </h2>
              <p
                className="auth-subtitle"
                style={{
                  marginTop: "10px",
                  marginBottom: "25px",
                  color: "#94a3b8",
                  lineHeight: "1.6",
                }}
              >
                {message}
              </p>
              <Link
                to="/login"
                className="btn-primary auth-submit"
                style={{
                  display: "block",
                  textDecoration: "none",
                  textAlign: "center",
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px",
                }}
              >
                Go to Login
              </Link>
            </div>
          )}

          {status === "error" && (
            <div style={{ padding: "10px 0" }}>
              <div
                className="error-icon-wrapper"
                style={{
                  fontSize: "50px",
                  marginBottom: "20px",
                  display: "inline-block",
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#ef4444",
                  borderRadius: "50%",
                  width: "90px",
                  height: "90px",
                  lineHeight: "90px",
                  animation: "scaleIn 0.3s ease-out",
                }}
              >
                ⚠
              </div>
              <h2 className="auth-title" style={{ fontSize: "24px", fontWeight: "700", color: "#f8fafc" }}>
                Verification Failed
              </h2>
              <p
                className="auth-subtitle"
                style={{
                  marginTop: "10px",
                  marginBottom: "25px",
                  color: "#94a3b8",
                  lineHeight: "1.6",
                }}
              >
                {message}
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <Link
                  to="/register"
                  className="btn-primary auth-submit"
                  style={{
                    display: "block",
                    textDecoration: "none",
                    textAlign: "center",
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px",
                  }}
                >
                  Register Again
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;
