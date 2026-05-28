const API_BASE = "/api";

/**
 * Base fetch wrapper with error handling and auth headers.
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem("orbitide_token");

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

/**
 * Auth API functions
 */
export const authAPI = {
  register: (name, email, password) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request("/auth/me"),

  updateProfile: (data) =>
    request("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  verifyEmail: (token) =>
    request(`/auth/verify-email?token=${token}`, {
      method: "GET",
    }),
};
