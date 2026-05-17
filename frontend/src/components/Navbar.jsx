import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./Navbar.css";

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/problems", label: "Problems" },
    { to: "/ide", label: "IDE" },
    { to: "/contests", label: "Contests" },
    { to: "/visualizer", label: "Visualizer" },
  ];

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate("/");
  };

  return (
    <nav className="navbar" id="main-navbar">
      <div className="navbar-inner container">
        {/* Logo */}
        <Link to="/" className="navbar-logo" id="navbar-logo">
          <span className="logo-icon">⟐</span>
          <span className="logo-text">
            Orbit<span className="gradient-text">IDE</span>
          </span>
          <span className="logo-badge">AI</span>
        </Link>

        {/* Desktop Navigation */}
        <ul className="navbar-links">
          {navLinks.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "nav-link--active" : ""}`
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Auth Actions */}
        <div className="navbar-actions">
          {isAuthenticated ? (
            <div className="navbar-user" id="navbar-user-menu">
              <button
                className="navbar-avatar-btn"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-label="User menu"
                id="navbar-avatar-btn"
              >
                <div className="navbar-avatar">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="navbar-username">{user.name.split(" ")[0]}</span>
                <span className={`navbar-chevron ${dropdownOpen ? "navbar-chevron--open" : ""}`}>▾</span>
              </button>

              {dropdownOpen && (
                <div className="navbar-dropdown" id="navbar-dropdown">
                  <div className="navbar-dropdown-header">
                    <p className="navbar-dropdown-name">{user.name}</p>
                    <p className="navbar-dropdown-email">{user.email}</p>
                  </div>
                  <div className="navbar-dropdown-divider"></div>
                  <Link
                    to="/dashboard"
                    className="navbar-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    📊 Dashboard
                  </Link>
                  <Link
                    to="/profile"
                    className="navbar-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    👤 Profile
                  </Link>
                  <div className="navbar-dropdown-divider"></div>
                  <button
                    className="navbar-dropdown-item navbar-dropdown-item--danger"
                    onClick={handleLogout}
                    id="navbar-logout-btn"
                  >
                    🚪 Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn-secondary" id="navbar-login-btn">
                Log In
              </Link>
              <Link to="/register" className="btn-primary" id="navbar-signup-btn">
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className={`navbar-burger ${mobileOpen ? "navbar-burger--open" : ""}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
          id="navbar-burger"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="navbar-mobile" id="navbar-mobile-menu">
          <ul>
            {navLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? "nav-link--active" : ""}`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="navbar-mobile-actions">
            {isAuthenticated ? (
              <button className="btn-secondary" onClick={() => { handleLogout(); setMobileOpen(false); }}>
                Log Out
              </button>
            ) : (
              <>
                <Link to="/login" className="btn-secondary" onClick={() => setMobileOpen(false)}>
                  Log In
                </Link>
                <Link to="/register" className="btn-primary" onClick={() => setMobileOpen(false)}>
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
