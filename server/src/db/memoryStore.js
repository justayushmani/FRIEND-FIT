// ============================================
// In-Memory Store — Fallback when no database
// ============================================
// Used during development when DATABASE_URL is not set.
// All data lives in memory and resets on restart.

const store = {
  profiles: new Map(),
  sessions: new Map(),
  questions: new Map(),
  answers: new Map(),
  metrics: new Map(),
  mistakes: new Map(),
  predictions: new Map(),
  recommendations: new Map(),
  topics: new Map(),
};

export function getStore() {
  return store;
}

export default store;
