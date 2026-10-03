// ============================================
// Database Migration — Schema Setup
// ============================================
import 'dotenv/config';
import { getPool } from './connection.js';

const SCHEMA = `
-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Users / Profiles
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  target_role   TEXT,
  skills        JSONB DEFAULT '[]',
  weak_areas    JSONB DEFAULT '[]',
  projects      JSONB DEFAULT '[]',
  resume_text   TEXT,
  job_description TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Topics
-- ============================================
CREATE TABLE IF NOT EXISTS topics (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  category      TEXT,
  difficulty    TEXT DEFAULT 'medium',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Practice Sessions
-- ============================================
CREATE TABLE IF NOT EXISTS practice_sessions (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profiles(id),
  status        TEXT DEFAULT 'active',
  session_type  TEXT DEFAULT 'interview',
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  total_questions INTEGER DEFAULT 0,
  overall_score REAL
);

-- ============================================
-- Questions
-- ============================================
CREATE TABLE IF NOT EXISTS questions (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES practice_sessions(id),
  topic_id      TEXT REFERENCES topics(id),
  question_text TEXT NOT NULL,
  topic_name    TEXT,
  difficulty    TEXT DEFAULT 'medium',
  reason        TEXT,
  question_order INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Answers
-- ============================================
CREATE TABLE IF NOT EXISTS answers (
  id            TEXT PRIMARY KEY,
  question_id   TEXT NOT NULL REFERENCES questions(id),
  session_id    TEXT NOT NULL REFERENCES practice_sessions(id),
  answer_text   TEXT NOT NULL,
  score         REAL,
  is_correct    BOOLEAN,
  strengths     JSONB DEFAULT '[]',
  weaknesses    JSONB DEFAULT '[]',
  concept_gaps  JSONB DEFAULT '[]',
  follow_up_needed BOOLEAN DEFAULT false,
  feedback      TEXT,
  time_taken_seconds INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Performance Metrics
-- ============================================
CREATE TABLE IF NOT EXISTS performance_metrics (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES practice_sessions(id),
  profile_id    TEXT NOT NULL REFERENCES profiles(id),
  category      TEXT NOT NULL,
  score         REAL NOT NULL,
  max_score     REAL DEFAULT 100,
  details       JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Mistake Memory (core differentiator)
-- ============================================
CREATE TABLE IF NOT EXISTS mistake_memories (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profiles(id),
  session_id    TEXT REFERENCES practice_sessions(id),
  topic         TEXT NOT NULL,
  mistake       TEXT NOT NULL,
  severity      TEXT DEFAULT 'medium',
  recommendation TEXT,
  times_tested  INTEGER DEFAULT 1,
  times_improved INTEGER DEFAULT 0,
  is_resolved   BOOLEAN DEFAULT false,
  embedding     vector(768),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Predictions
-- ============================================
CREATE TABLE IF NOT EXISTS predictions (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profiles(id),
  topic         TEXT NOT NULL,
  risk_level    TEXT DEFAULT 'medium',
  persistence_probability REAL,
  model_used    TEXT DEFAULT 'tabpfn',
  features      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Recommendations
-- ============================================
CREATE TABLE IF NOT EXISTS recommendations (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profiles(id),
  topic         TEXT NOT NULL,
  action        TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 20,
  reason        TEXT,
  prediction_score REAL,
  is_completed  BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sessions_profile ON practice_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_questions_session ON questions(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_profile ON mistake_memories(profile_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_topic ON mistake_memories(topic);
CREATE INDEX IF NOT EXISTS idx_metrics_profile ON performance_metrics(profile_id);
CREATE INDEX IF NOT EXISTS idx_predictions_profile ON predictions(profile_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_profile ON recommendations(profile_id);
`;

async function migrate() {
  const pool = getPool();
  if (!pool) {
    console.error('[Migration] No DATABASE_URL configured. Set it in .env');
    process.exit(1);
  }

  try {
    console.log('[Migration] Running schema migration...');
    await pool.query(SCHEMA);
    console.log('[Migration] ✅ Schema created successfully');
  } catch (err) {
    console.error('[Migration] ❌ Failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
