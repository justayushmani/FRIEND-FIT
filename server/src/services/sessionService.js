// ============================================
// Session Service
// ============================================
import { v4 as uuid } from 'uuid';
import { query } from '../db/connection.js';
import { getStore } from '../db/memoryStore.js';

const USE_DB = () => !!process.env.DATABASE_URL;

export async function createSession(profileId, sessionType = 'interview') {
  const id = uuid();
  const session = {
    id,
    profile_id: profileId,
    status: 'active',
    session_type: sessionType,
    started_at: new Date().toISOString(),
    ended_at: null,
    total_questions: 0,
    overall_score: null,
  };

  if (USE_DB()) {
    await query(
      `INSERT INTO practice_sessions (id, profile_id, status, session_type)
       VALUES ($1, $2, $3, $4)`,
      [id, profileId, 'active', sessionType]
    );
  } else {
    getStore().sessions.set(id, session);
  }

  return session;
}

export async function getSession(id) {
  if (USE_DB()) {
    const result = await query('SELECT * FROM practice_sessions WHERE id = $1', [id]);
    return result.rows[0] || null;
  }
  return getStore().sessions.get(id) || null;
}

export async function endSession(id, overallScore) {
  if (USE_DB()) {
    const result = await query(
      `UPDATE practice_sessions SET status = 'completed', ended_at = NOW(), overall_score = $2 WHERE id = $1 RETURNING *`,
      [id, overallScore]
    );
    return result.rows[0];
  } else {
    const session = getStore().sessions.get(id);
    if (!session) return null;
    session.status = 'completed';
    session.ended_at = new Date().toISOString();
    session.overall_score = overallScore;
    return session;
  }
}

export async function getSessionsByProfile(profileId) {
  if (USE_DB()) {
    const result = await query(
      'SELECT * FROM practice_sessions WHERE profile_id = $1 ORDER BY started_at DESC',
      [profileId]
    );
    return result.rows;
  }
  return Array.from(getStore().sessions.values())
    .filter(s => s.profile_id === profileId)
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
}

export async function addQuestion(sessionId, questionData) {
  const id = uuid();
  const q = {
    id,
    session_id: sessionId,
    question_text: questionData.question,
    topic_name: questionData.topic,
    difficulty: questionData.difficulty || 'medium',
    reason: questionData.reason || null,
    question_order: questionData.order || 0,
    created_at: new Date().toISOString(),
  };

  if (USE_DB()) {
    await query(
      `INSERT INTO questions (id, session_id, question_text, topic_name, difficulty, reason, question_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, sessionId, q.question_text, q.topic_name, q.difficulty, q.reason, q.question_order]
    );
  } else {
    getStore().questions.set(id, q);
  }

  // Update question count
  if (USE_DB()) {
    await query(
      'UPDATE practice_sessions SET total_questions = total_questions + 1 WHERE id = $1',
      [sessionId]
    );
  } else {
    const session = getStore().sessions.get(sessionId);
    if (session) session.total_questions++;
  }

  return q;
}

export async function addAnswer(questionId, sessionId, answerData) {
  const id = uuid();
  const a = {
    id,
    question_id: questionId,
    session_id: sessionId,
    answer_text: answerData.answerText,
    score: answerData.score ?? null,
    is_correct: answerData.correct ?? null,
    strengths: answerData.strengths || [],
    weaknesses: answerData.weaknesses || [],
    concept_gaps: answerData.conceptGaps || [],
    follow_up_needed: answerData.followUpNeeded || false,
    feedback: answerData.feedback || null,
    time_taken_seconds: answerData.timeTaken || null,
    created_at: new Date().toISOString(),
  };

  if (USE_DB()) {
    await query(
      `INSERT INTO answers (id, question_id, session_id, answer_text, score, is_correct, strengths, weaknesses, concept_gaps, follow_up_needed, feedback, time_taken_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, questionId, sessionId, a.answer_text, a.score, a.is_correct,
       JSON.stringify(a.strengths), JSON.stringify(a.weaknesses), JSON.stringify(a.concept_gaps),
       a.follow_up_needed, a.feedback, a.time_taken_seconds]
    );
  } else {
    getStore().answers.set(id, a);
  }

  return a;
}

export async function getSessionQuestions(sessionId) {
  if (USE_DB()) {
    const result = await query(
      'SELECT * FROM questions WHERE session_id = $1 ORDER BY question_order',
      [sessionId]
    );
    return result.rows;
  }
  return Array.from(getStore().questions.values())
    .filter(q => q.session_id === sessionId)
    .sort((a, b) => a.question_order - b.question_order);
}

export async function getSessionAnswers(sessionId) {
  if (USE_DB()) {
    const result = await query(
      `SELECT a.*, q.question_text, q.topic_name, q.difficulty 
       FROM answers a JOIN questions q ON a.question_id = q.id
       WHERE a.session_id = $1 ORDER BY a.created_at`,
      [sessionId]
    );
    return result.rows;
  }
  const questions = Array.from(getStore().questions.values())
    .filter(q => q.session_id === sessionId);
  return Array.from(getStore().answers.values())
    .filter(a => a.session_id === sessionId)
    .map(a => {
      const q = questions.find(q => q.id === a.question_id);
      return { ...a, question_text: q?.question_text, topic_name: q?.topic_name, difficulty: q?.difficulty };
    });
}
