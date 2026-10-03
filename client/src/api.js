// ============================================
// API Client
// ============================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  try {
    const res = await fetch(url, config);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Make sure the backend is running on port 3001.');
    }
    throw err;
  }
}

// ---- Profile ----
export const api = {
  // Health
  health: () => request('/health'),

  // Profile
  createProfile: (data) => request('/profile', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: (id) => request(`/profile/${id}`),
  getProfiles: () => request('/profile'),
  updateProfile: (id, data) => request(`/profile/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Session
  startSession: (profileId, sessionType = 'interview') =>
    request('/session/start', { method: 'POST', body: JSON.stringify({ profileId, sessionType }) }),
  getQuestion: (sessionId) =>
    request(`/session/${sessionId}/question`, { method: 'POST' }),
  submitAnswer: (sessionId, questionId, answerText, timeTaken) =>
    request(`/session/${sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ questionId, answerText, timeTaken }),
    }),
  endSession: (sessionId) =>
    request(`/session/${sessionId}/end`, { method: 'POST' }),
  getSession: (sessionId) => request(`/session/${sessionId}`),
  getSessionsByProfile: (profileId) => request(`/session/profile/${profileId}`),

  // Analysis
  getAnalysis: (sessionId) => request(`/analysis/session/${sessionId}`),
  getHistory: (profileId) => request(`/analysis/history/${profileId}`),

  // Memory
  getMistakes: (profileId) => request(`/memory/${profileId}`),
  getMistakeStats: (profileId) => request(`/memory/${profileId}/stats`),

  // Recommendations
  getRecommendation: (profileId) => request(`/recommend/${profileId}`),
  getPredictions: (profileId) => request(`/recommend/${profileId}/predictions`),

  // Demo
  seedDemo: () => request('/demo/seed', { method: 'POST' }),
  getDemoProfile: () => request('/demo/profile'),
};
