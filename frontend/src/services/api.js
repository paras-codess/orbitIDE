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

  googleLogin: (credential) =>
    request("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),

  setGoogleUsername: (name) =>
    request("/auth/google/set-username", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
};

/**
 * Problems API functions
 */
export const problemsAPI = {
  getProblems: (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append("page", params.page);
    if (params.limit) query.append("limit", params.limit);
    if (params.difficulty) query.append("difficulty", params.difficulty);
    if (params.topic) query.append("topic", params.topic);
    if (params.search) query.append("search", params.search);
    
    const queryString = query.toString();
    return request(`/problems${queryString ? `?${queryString}` : ""}`);
  },

  getTopics: () => request("/problems/topics"),

  getProblemById: (id) => request(`/problems/${id}`),
};

/**
 * Submissions API functions
 */
export const submissionsAPI = {
  runCode: (problemId, language, code, customTestCases = null) =>
    request("/submissions/run", {
      method: "POST",
      body: JSON.stringify({ problemId, language, code, ...(customTestCases ? { customTestCases } : {}) }),
    }),

  submitCode: (problemId, language, code) =>
    request("/submissions/submit", {
      method: "POST",
      body: JSON.stringify({ problemId, language, code }),
    }),

  getSubmissionStatus: (id) => request(`/submissions/${id}/status`),

  getMySubmissions: (problemId, page = 1, limit = 20) => {
    const query = new URLSearchParams({ page, limit });
    if (problemId) query.append("problemId", problemId);
    return request(`/submissions/my?${query.toString()}`);
  },
};

/**
 * User API functions
 */
export const userAPI = {
  getUserStats: () => request("/users/stats"),
};

