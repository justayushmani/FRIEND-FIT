// ============================================
// Demo Routes — Seed realistic demo data
// ============================================
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getStore } from '../db/memoryStore.js';
import { query } from '../db/connection.js';
import { isDatabaseEnabled } from '../db/mode.js';

export const demoRouter = Router();

const USE_DB = isDatabaseEnabled;

const DEMO_PROFILE = {
  id: 'demo-user-001',
  name: 'Demo Friend',
  target_role: 'Full-Stack Software Engineer',
  skills: ['JavaScript', 'React', 'Node.js', 'Python', 'SQL', 'System Design'],
  weak_areas: ['Database optimization', 'System design trade-offs', 'Concurrency'],
  projects: [
    { name: 'E-commerce Platform', tech: ['React', 'Node.js', 'PostgreSQL'], description: 'Full-stack marketplace app with payments' },
    { name: 'Real-time Chat App', tech: ['WebSocket', 'Redis', 'React'], description: 'Scalable messaging system' }
  ],
  resume_text: 'Full-stack developer with 2 years of experience building web applications using React, Node.js, and PostgreSQL. Passionate about clean code and scalable systems.',
  job_description: 'Looking for a full-stack software engineer role at a growth-stage startup.',
  created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_SESSIONS = [
  {
    id: 'demo-session-001',
    profile_id: 'demo-user-001',
    status: 'completed',
    session_type: 'interview',
    started_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    ended_at: new Date(Date.now() - 5 * 86400000 + 1800000).toISOString(),
    total_questions: 4,
    overall_score: 58,
  },
  {
    id: 'demo-session-002',
    profile_id: 'demo-user-001',
    status: 'completed',
    session_type: 'interview',
    started_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    ended_at: new Date(Date.now() - 2 * 86400000 + 2400000).toISOString(),
    total_questions: 5,
    overall_score: 65,
  },
];

const DEMO_QUESTIONS = [
  // Session 1
  { id: 'demo-q-001', session_id: 'demo-session-001', question_text: 'You mentioned using PostgreSQL in your e-commerce project. Why did you choose PostgreSQL over MongoDB for this application?', topic_name: 'databases', difficulty: 'medium', reason: 'Tests database selection knowledge based on profile', question_order: 1 },
  { id: 'demo-q-002', session_id: 'demo-session-001', question_text: 'Can you explain how SQL JOINs work? Give an example of when you would use a LEFT JOIN vs an INNER JOIN in your e-commerce application.', topic_name: 'sql-joins', difficulty: 'medium', reason: 'Follow-up on database knowledge', question_order: 2 },
  { id: 'demo-q-003', session_id: 'demo-session-001', question_text: 'How would you design the database schema for handling product variants (sizes, colors) in your e-commerce platform?', topic_name: 'database-design', difficulty: 'hard', reason: 'Tests practical schema design', question_order: 3 },
  { id: 'demo-q-004', session_id: 'demo-session-001', question_text: 'Your chat application uses WebSocket. How does WebSocket differ from HTTP long-polling, and what trade-offs did you consider?', topic_name: 'system-design', difficulty: 'medium', reason: 'Tests system design understanding', question_order: 4 },
  // Session 2
  { id: 'demo-q-005', session_id: 'demo-session-002', question_text: 'In your previous session, you struggled with SQL JOINs. Can you walk me through writing a query that gets all customers and their orders, including customers who have never placed an order?', topic_name: 'sql-joins', difficulty: 'medium', reason: 'Re-testing previous weakness: SQL JOINs', question_order: 1 },
  { id: 'demo-q-006', session_id: 'demo-session-002', question_text: 'How would you optimize a slow SQL query that joins 3 tables with millions of rows?', topic_name: 'database-optimization', difficulty: 'hard', reason: 'Tests database optimization — a declared weak area', question_order: 2 },
  { id: 'demo-q-007', session_id: 'demo-session-002', question_text: 'Explain the concept of database indexing. When would you NOT want to add an index?', topic_name: 'database-optimization', difficulty: 'medium', reason: 'Follow-up on database optimization', question_order: 3 },
  { id: 'demo-q-008', session_id: 'demo-session-002', question_text: 'If your e-commerce app needs to handle 10,000 concurrent users, what would your high-level architecture look like?', topic_name: 'system-design', difficulty: 'hard', reason: 'Tests scalability thinking', question_order: 4 },
  { id: 'demo-q-009', session_id: 'demo-session-002', question_text: 'How does React\'s virtual DOM work, and why is it beneficial for performance?', topic_name: 'react', difficulty: 'medium', reason: 'Tests core React knowledge', question_order: 5 },
];

const DEMO_ANSWERS = [
  // Session 1
  { id: 'demo-a-001', question_id: 'demo-q-001', session_id: 'demo-session-001', answer_text: 'I used PostgreSQL because it is a relational database and it supports SQL well.', score: 42, is_correct: false, strengths: ['Knows PostgreSQL is relational'], weaknesses: ['Cannot articulate trade-offs vs MongoDB', 'Lacks depth in database selection criteria'], concept_gaps: ['database-trade-offs'], follow_up_needed: true, feedback: 'You identified PostgreSQL as relational, but didn\'t explain WHY relational was the right choice for e-commerce. Consider: ACID transactions for payments, complex queries for product catalogs, relational integrity for orders.', time_taken_seconds: 45 },
  { id: 'demo-a-002', question_id: 'demo-q-002', session_id: 'demo-session-001', answer_text: 'JOINs combine tables. LEFT JOIN gets everything from left table, INNER JOIN only gets matching rows. I\'d use INNER JOIN for orders with products.', score: 55, is_correct: true, strengths: ['Basic understanding of JOIN types'], weaknesses: ['Explanation lacks specificity', 'No concrete example with table names'], concept_gaps: ['sql-join-practical-usage'], follow_up_needed: true, feedback: 'You have the basic idea right but your explanation is surface-level. Practice writing actual JOIN queries with specific table and column references.', time_taken_seconds: 60 },
  { id: 'demo-a-003', question_id: 'demo-q-003', session_id: 'demo-session-001', answer_text: 'I would create a products table and maybe a variants table linked to it with a foreign key. Each variant would have size and color columns.', score: 58, is_correct: true, strengths: ['Understands foreign key relationships', 'Basic normalization'], weaknesses: ['Schema is oversimplified', 'Doesn\'t consider SKU patterns or inventory per variant'], concept_gaps: ['schema-design-patterns'], follow_up_needed: false, feedback: 'Good start but a production schema would need: SKU per variant, inventory tracking per variant, price overrides, and possibly an EAV pattern for flexible attributes.', time_taken_seconds: 90 },
  { id: 'demo-a-004', question_id: 'demo-q-004', session_id: 'demo-session-001', answer_text: 'WebSocket keeps a persistent connection while HTTP sends individual requests. I chose WebSocket because chat needs real-time messages. Long-polling would work too but uses more server resources.', score: 68, is_correct: true, strengths: ['Understands persistent connection concept', 'Correct about real-time need'], weaknesses: ['Trade-off analysis is superficial', 'Doesn\'t mention connection overhead, fallback strategies'], concept_gaps: [], follow_up_needed: false, feedback: 'Decent answer. To strengthen it, discuss connection overhead at scale, proxy/load balancer considerations, and fallback mechanisms (Socket.io does this automatically).', time_taken_seconds: 75 },
  // Session 2
  { id: 'demo-a-005', question_id: 'demo-q-005', session_id: 'demo-session-002', answer_text: 'SELECT customers.name, orders.id FROM customers LEFT JOIN orders ON customers.id = orders.customer_id. LEFT JOIN because we want all customers even without orders.', score: 72, is_correct: true, strengths: ['Correctly used LEFT JOIN', 'Proper ON clause', 'Explained reasoning'], weaknesses: ['Could select more useful columns', 'Didn\'t handle NULL order display'], concept_gaps: [], follow_up_needed: false, feedback: 'Much improved from last session! You correctly identified LEFT JOIN as the right choice. Consider using COALESCE for NULL handling and selecting more meaningful columns.', time_taken_seconds: 50 },
  { id: 'demo-a-006', question_id: 'demo-q-006', session_id: 'demo-session-002', answer_text: 'I would add indexes on the join columns, maybe use EXPLAIN to see the query plan, and consider if we really need all columns.', score: 52, is_correct: true, strengths: ['Knows about indexes', 'Mentions EXPLAIN'], weaknesses: ['Very surface-level optimization strategies', 'Doesn\'t mention specific index types, partitioning, or query restructuring'], concept_gaps: ['query-optimization', 'database-indexing-strategies'], follow_up_needed: true, feedback: 'You mentioned the right tools but lack depth. Study: composite indexes, covering indexes, query restructuring (subquery vs JOIN), EXPLAIN ANALYZE output interpretation, and table partitioning.', time_taken_seconds: 55 },
  { id: 'demo-a-007', question_id: 'demo-q-007', session_id: 'demo-session-002', answer_text: 'Indexes speed up reads by creating a data structure like a B-tree. You wouldn\'t add an index on a column that changes very frequently because it slows down writes.', score: 65, is_correct: true, strengths: ['Knows B-tree structure', 'Understands write penalty'], weaknesses: ['Missing other reasons to avoid indexes: low cardinality, small tables, storage cost'], concept_gaps: ['indexing-tradeoffs'], follow_up_needed: false, feedback: 'Good foundation. Also consider: indexes on low-cardinality columns (boolean fields) are often useless, very small tables don\'t benefit, and each index consumes storage and memory.', time_taken_seconds: 40 },
  { id: 'demo-a-008', question_id: 'demo-q-008', session_id: 'demo-session-002', answer_text: 'I would use a load balancer in front of multiple Node.js servers, use Redis for caching, and have a PostgreSQL database with read replicas.', score: 62, is_correct: true, strengths: ['Mentions load balancing', 'Caching with Redis', 'Read replicas'], weaknesses: ['No CDN mention', 'Missing connection pooling', 'No discussion of database bottlenecks'], concept_gaps: ['scalability-architecture'], follow_up_needed: true, feedback: 'Solid starting points. A more complete answer would include: CDN for static assets, connection pooling (pgBouncer), rate limiting, message queues for async tasks, and monitoring.', time_taken_seconds: 80 },
  { id: 'demo-a-009', question_id: 'demo-q-009', session_id: 'demo-session-002', answer_text: 'React creates a virtual DOM in memory. When state changes, it diffs the virtual DOM with the real DOM and only updates what changed. This is faster than manipulating the real DOM directly because DOM operations are expensive.', score: 82, is_correct: true, strengths: ['Accurate explanation of virtual DOM', 'Understands diffing', 'Performance reasoning is correct'], weaknesses: ['Could mention reconciliation algorithm', 'Fiber architecture'], concept_gaps: [], follow_up_needed: false, feedback: 'Strong answer! This is clearly one of your comfort areas. For extra depth, look into React Fiber and the reconciliation algorithm.', time_taken_seconds: 35 },
];

const DEMO_MISTAKES = [
  { id: 'demo-m-001', profile_id: 'demo-user-001', session_id: 'demo-session-001', topic: 'databases', mistake: 'Cannot articulate trade-offs between PostgreSQL and MongoDB — only stated "it is relational"', severity: 'high', recommendation: 'Study ACID vs BASE, document vs relational data models, use-case based database selection', times_tested: 2, times_improved: 1, is_resolved: false },
  { id: 'demo-m-002', profile_id: 'demo-user-001', session_id: 'demo-session-001', topic: 'sql-joins', mistake: 'SQL JOIN explanation lacks specificity — cannot write concrete examples with table references', severity: 'medium', recommendation: 'Practice writing JOIN queries with actual table schemas', times_tested: 2, times_improved: 1, is_resolved: false },
  { id: 'demo-m-003', profile_id: 'demo-user-001', session_id: 'demo-session-001', topic: 'database-design', mistake: 'Schema design is oversimplified — misses real-world patterns like SKU, inventory per variant', severity: 'medium', recommendation: 'Study real-world database schemas for e-commerce platforms', times_tested: 1, times_improved: 0, is_resolved: false },
  { id: 'demo-m-004', profile_id: 'demo-user-001', session_id: 'demo-session-002', topic: 'database-optimization', mistake: 'Query optimization strategies are surface-level — mentions indexes but lacks depth on types, partitioning, restructuring', severity: 'high', recommendation: 'Study composite indexes, EXPLAIN ANALYZE, query restructuring, table partitioning', times_tested: 1, times_improved: 0, is_resolved: false },
  { id: 'demo-m-005', profile_id: 'demo-user-001', session_id: 'demo-session-002', topic: 'system-design', mistake: 'Scalability answer missing CDN, connection pooling, and async processing', severity: 'medium', recommendation: 'Study complete system design patterns: CDN, pooling, message queues, monitoring', times_tested: 1, times_improved: 0, is_resolved: false },
];

const DEMO_METRICS = [
  // Session 1
  { id: 'demo-met-001', session_id: 'demo-session-001', profile_id: 'demo-user-001', category: 'Technical Knowledge', score: 52, max_score: 100 },
  { id: 'demo-met-002', session_id: 'demo-session-001', profile_id: 'demo-user-001', category: 'Answer Clarity', score: 48, max_score: 100 },
  { id: 'demo-met-003', session_id: 'demo-session-001', profile_id: 'demo-user-001', category: 'Problem Solving', score: 55, max_score: 100 },
  { id: 'demo-met-004', session_id: 'demo-session-001', profile_id: 'demo-user-001', category: 'Communication', score: 60, max_score: 100 },
  // Session 2
  { id: 'demo-met-005', session_id: 'demo-session-002', profile_id: 'demo-user-001', category: 'Technical Knowledge', score: 63, max_score: 100 },
  { id: 'demo-met-006', session_id: 'demo-session-002', profile_id: 'demo-user-001', category: 'Answer Clarity', score: 60, max_score: 100 },
  { id: 'demo-met-007', session_id: 'demo-session-002', profile_id: 'demo-user-001', category: 'Problem Solving', score: 58, max_score: 100 },
  { id: 'demo-met-008', session_id: 'demo-session-002', profile_id: 'demo-user-001', category: 'Communication', score: 72, max_score: 100 },
];

// Seed demo data
demoRouter.post('/seed', async (req, res, next) => {
  try {
    if (USE_DB()) {
      // Clear existing demo data
      await query("DELETE FROM recommendations WHERE profile_id = 'demo-user-001'");
      await query("DELETE FROM predictions WHERE profile_id = 'demo-user-001'");
      await query("DELETE FROM performance_metrics WHERE profile_id = 'demo-user-001'");
      await query("DELETE FROM mistake_memories WHERE profile_id = 'demo-user-001'");
      await query("DELETE FROM answers WHERE session_id LIKE 'demo-%'");
      await query("DELETE FROM questions WHERE session_id LIKE 'demo-%'");
      await query("DELETE FROM practice_sessions WHERE profile_id = 'demo-user-001'");
      await query("DELETE FROM profiles WHERE id = 'demo-user-001'");

      // Insert demo data
      await query(
        `INSERT INTO profiles (id, name, target_role, skills, weak_areas, projects, resume_text, job_description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [DEMO_PROFILE.id, DEMO_PROFILE.name, DEMO_PROFILE.target_role,
         JSON.stringify(DEMO_PROFILE.skills), JSON.stringify(DEMO_PROFILE.weak_areas),
         JSON.stringify(DEMO_PROFILE.projects), DEMO_PROFILE.resume_text,
         DEMO_PROFILE.job_description, DEMO_PROFILE.created_at]
      );

      for (const s of DEMO_SESSIONS) {
        await query(
          `INSERT INTO practice_sessions (id, profile_id, status, session_type, started_at, ended_at, total_questions, overall_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [s.id, s.profile_id, s.status, s.session_type, s.started_at, s.ended_at, s.total_questions, s.overall_score]
        );
      }

      for (const q of DEMO_QUESTIONS) {
        await query(
          `INSERT INTO questions (id, session_id, question_text, topic_name, difficulty, reason, question_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [q.id, q.session_id, q.question_text, q.topic_name, q.difficulty, q.reason, q.question_order]
        );
      }

      for (const a of DEMO_ANSWERS) {
        await query(
          `INSERT INTO answers (id, question_id, session_id, answer_text, score, is_correct, strengths, weaknesses, concept_gaps, follow_up_needed, feedback, time_taken_seconds)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [a.id, a.question_id, a.session_id, a.answer_text, a.score, a.is_correct,
           JSON.stringify(a.strengths), JSON.stringify(a.weaknesses), JSON.stringify(a.concept_gaps),
           a.follow_up_needed, a.feedback, a.time_taken_seconds]
        );
      }

      for (const m of DEMO_MISTAKES) {
        await query(
          `INSERT INTO mistake_memories (id, profile_id, session_id, topic, mistake, severity, recommendation, times_tested, times_improved, is_resolved)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [m.id, m.profile_id, m.session_id, m.topic, m.mistake, m.severity, m.recommendation, m.times_tested, m.times_improved, m.is_resolved]
        );
      }

      for (const met of DEMO_METRICS) {
        await query(
          `INSERT INTO performance_metrics (id, session_id, profile_id, category, score, max_score)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [met.id, met.session_id, met.profile_id, met.category, met.score, met.max_score]
        );
      }
    } else {
      // In-memory store
      const store = getStore();
      store.profiles.set(DEMO_PROFILE.id, DEMO_PROFILE);
      for (const s of DEMO_SESSIONS) store.sessions.set(s.id, s);
      for (const q of DEMO_QUESTIONS) store.questions.set(q.id, q);
      for (const a of DEMO_ANSWERS) store.answers.set(a.id, a);
      for (const m of DEMO_MISTAKES) store.mistakes.set(m.id, m);
      for (const met of DEMO_METRICS) store.metrics.set(met.id, met);
    }

    res.json({
      success: true,
      message: 'Demo data seeded successfully',
      profileId: DEMO_PROFILE.id,
      profile: DEMO_PROFILE,
      label: '⚠️ DEMO DATA',
    });
  } catch (err) {
    next(err);
  }
});

// Get demo profile ID
demoRouter.get('/profile', (req, res) => {
  res.json({ profileId: DEMO_PROFILE.id, name: DEMO_PROFILE.name });
});
