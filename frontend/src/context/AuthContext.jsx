import { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/api.js";

const AuthContext = createContext(null);

/**
 * AuthProvider wraps the app and provides authentication state
 * (user, token, loading) and actions (login, register, logout)
 * to all child components via React Context.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check if a token exists and fetch the user profile
  useEffect(() => {
    const token = localStorage.getItem("orbitide_token");
    if (token) {
      authAPI
        .getMe()
        .then((res) => setUser(res.data.user))
        .catch(() => {
          // Token is invalid or expired — clear it
          localStorage.removeItem("orbitide_token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login(email, password);
    localStorage.setItem("orbitide_token", res.data.token);
    setUser(res.data.user);
    return res;
  };

  const register = async (name, email, password) => {
    const res = await authAPI.register(name, email, password);
    // Registration requires email verification, so we do not log in automatically.
    return res;
  };

  const logout = () => {
    localStorage.removeItem("orbitide_token");
    setUser(null);
  };

  const googleLogin = async (credential) => {
    const res = await authAPI.googleLogin(credential);
    // Always store the token (even temporary for new users)
    localStorage.setItem("orbitide_token", res.data.token);
    if (!res.data.needsUsername) {
      setUser(res.data.user);
    }
    return res;
  };

  const setGoogleUsername = async (name) => {
    const res = await authAPI.setGoogleUsername(name);
    localStorage.setItem("orbitide_token", res.data.token);
    setUser(res.data.user);
    return res;
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    googleLogin,
    setGoogleUsername,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to access auth context from any component.
 * Usage: const { user, login, logout } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
