// ============================================
// Performance & Prediction Service
// ============================================
import { v4 as uuid } from 'uuid';
import { query } from '../db/connection.js';
import { getStore } from '../db/memoryStore.js';

const USE_DB = () => !!process.env.DATABASE_URL;

// ============================================
// Performance Metrics
// ============================================
export async function storeMetrics(sessionId, profileId, categories) {
  const metrics = [];
  for (const cat of categories) {
    const id = uuid();
    const metric = {
      id,
      session_id: sessionId,
      profile_id: profileId,
      category: cat.name,
      score: cat.score,
      max_score: 100,
      details: cat.detail ? { detail: cat.detail } : {},
      created_at: new Date().toISOString(),
    };

    if (USE_DB()) {
      await query(
        `INSERT INTO performance_metrics (id, session_id, profile_id, category, score, max_score, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, sessionId, profileId, cat.name, cat.score, 100, JSON.stringify(metric.details)]
      );
    } else {
      getStore().metrics.set(id, metric);
    }
    metrics.push(metric);
  }
  return metrics;
}

export async function getPerformanceHistory(profileId) {
  if (USE_DB()) {
    const result = await query(
      `SELECT pm.*, ps.started_at as session_date
       FROM performance_metrics pm 
       JOIN practice_sessions ps ON pm.session_id = ps.id
       WHERE pm.profile_id = $1 
       ORDER BY ps.started_at DESC`,
      [profileId]
    );
    return result.rows;
  }
  return Array.from(getStore().metrics.values())
    .filter(m => m.profile_id === profileId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// ============================================
// TabPFN-style Prediction (deterministic ML)
// ============================================

/**
 * Build feature vectors for topic performance prediction.
 * This creates the structured data that TabPFN would consume.
 */
export function buildFeatureVector(topicData) {
  return {
    attempts: topicData.attempts || 0,
    avg_score: topicData.avgScore || 50,
    recent_score: topicData.recentScore || 50,
    score_trend: topicData.scoreTrend || 0, // positive = improving
    days_since_last: topicData.daysSinceLast || 0,
    mistake_count: topicData.mistakeCount || 0,
    high_severity_count: topicData.highSeverityCount || 0,
    difficulty_level: { easy: 1, medium: 2, hard: 3 }[topicData.difficulty] || 2,
    session_count: topicData.sessionCount || 0,
    improvement_rate: topicData.improvementRate || 0,
  };
}

/**
 * Predict persistence probability — likelihood a weakness remains weak.
 * 
 * This is the deterministic prediction model. In the full version,
 * this would call TabPFN for proper tabular ML classification.
 * The current implementation uses a weighted feature model that
 * mimics the behavior TabPFN would provide.
 * 
 * Features used:
 * - attempts: more attempts with low scores = higher persistence
 * - score_trend: negative trend = higher persistence
 * - mistake_count: more recorded mistakes = higher persistence
 * - days_since_last: longer gap = higher persistence (forgetting)
 * - improvement_rate: low rate = higher persistence
 */
export function predictPersistence(features) {
  // Weighted factors
  let risk = 0.5; // Base risk

  // Low average score increases risk
  if (features.avg_score < 40) risk += 0.2;
  else if (features.avg_score < 60) risk += 0.1;
  else if (features.avg_score > 80) risk -= 0.15;

  // Negative score trend increases risk
  if (features.score_trend < -10) risk += 0.15;
  else if (features.score_trend < 0) risk += 0.05;
  else if (features.score_trend > 10) risk -= 0.1;

  // Multiple mistakes = persistent problem
  if (features.mistake_count >= 3) risk += 0.15;
  else if (features.mistake_count >= 1) risk += 0.05;

  // High severity mistakes
  if (features.high_severity_count >= 2) risk += 0.1;

  // Many attempts with still-low scores = very persistent
  if (features.attempts >= 3 && features.avg_score < 60) risk += 0.15;

  // Time decay — haven't practiced recently
  if (features.days_since_last > 14) risk += 0.1;
  else if (features.days_since_last > 7) risk += 0.05;

  // Low improvement rate
  if (features.improvement_rate < 0) risk += 0.1;

  // Clamp to [0.05, 0.99]
  return Math.min(0.99, Math.max(0.05, risk));
}

/**
 * Get topic-level performance data for prediction.
 */
export async function getTopicPerformance(profileId) {
  if (USE_DB()) {
    const result = await query(
      `SELECT 
        q.topic_name as topic,
        COUNT(DISTINCT a.id) as attempts,
        AVG(a.score) as avg_score,
        MAX(a.score) as best_score,
        (SELECT a2.score FROM answers a2 
         JOIN questions q2 ON a2.question_id = q2.id 
         WHERE q2.topic_name = q.topic_name AND a2.session_id IN 
           (SELECT id FROM practice_sessions WHERE profile_id = $1)
         ORDER BY a2.created_at DESC LIMIT 1) as recent_score,
        COUNT(DISTINCT mm.id) as mistake_count,
        COUNT(DISTINCT mm.id) FILTER (WHERE mm.severity = 'high') as high_severity_count,
        COUNT(DISTINCT ps.id) as session_count
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       JOIN practice_sessions ps ON a.session_id = ps.id
       LEFT JOIN mistake_memories mm ON mm.profile_id = $1 AND LOWER(mm.topic) = LOWER(q.topic_name)
       WHERE ps.profile_id = $1 AND q.topic_name IS NOT NULL
       GROUP BY q.topic_name`,
      [profileId]
    );
    return result.rows;
  }

  // In-memory aggregation
  const sessions = Array.from(getStore().sessions.values())
    .filter(s => s.profile_id === profileId);
  const sessionIds = new Set(sessions.map(s => s.id));
  const answers = Array.from(getStore().answers.values())
    .filter(a => sessionIds.has(a.session_id));
  const questions = Array.from(getStore().questions.values());
  const mistakes = Array.from(getStore().mistakes.values())
    .filter(m => m.profile_id === profileId);

  const topicMap = new Map();
  for (const a of answers) {
    const q = questions.find(q => q.id === a.question_id);
    const topic = q?.topic_name || 'general';
    if (!topicMap.has(topic)) {
      topicMap.set(topic, { topic, scores: [], mistakes: [], sessions: new Set() });
    }
    const t = topicMap.get(topic);
    t.scores.push(a.score || 50);
    t.sessions.add(a.session_id);
  }

  for (const m of mistakes) {
    const key = m.topic.toLowerCase();
    for (const [topic, data] of topicMap) {
      if (topic.toLowerCase().includes(key) || key.includes(topic.toLowerCase())) {
        data.mistakes.push(m);
      }
    }
  }

  return Array.from(topicMap.values()).map(t => ({
    topic: t.topic,
    attempts: t.scores.length,
    avg_score: t.scores.reduce((a, b) => a + b, 0) / t.scores.length,
    recent_score: t.scores[t.scores.length - 1],
    mistake_count: t.mistakes.length,
    high_severity_count: t.mistakes.filter(m => m.severity === 'high').length,
    session_count: t.sessions.size,
  }));
}

/**
 * Run predictions for all topics and store results.
 */
export async function runPredictions(profileId) {
  const topicData = await getTopicPerformance(profileId);
  const predictions = [];

  for (const td of topicData) {
    const features = buildFeatureVector({
      attempts: Number(td.attempts),
      avgScore: Number(td.avg_score),
      recentScore: Number(td.recent_score),
      scoreTrend: Number(td.recent_score) - Number(td.avg_score),
      daysSinceLast: 0, // Would calculate from dates in production
      mistakeCount: Number(td.mistake_count),
      highSeverityCount: Number(td.high_severity_count),
      sessionCount: Number(td.session_count),
      improvementRate: (Number(td.recent_score) - Number(td.avg_score)) / Math.max(1, Number(td.attempts)),
    });

    const persistence = predictPersistence(features);
    const riskLevel = persistence > 0.7 ? 'high' : persistence > 0.4 ? 'medium' : 'low';

    const id = uuid();
    const prediction = {
      id,
      profile_id: profileId,
      topic: td.topic,
      risk_level: riskLevel,
      persistence_probability: Math.round(persistence * 100) / 100,
      model_used: 'tabpfn-lite',
      features,
      created_at: new Date().toISOString(),
    };

    if (USE_DB()) {
      await query(
        `INSERT INTO predictions (id, profile_id, topic, risk_level, persistence_probability, model_used, features)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, profileId, td.topic, riskLevel, persistence, 'tabpfn-lite', JSON.stringify(features)]
      );
    } else {
      getStore().predictions.set(id, prediction);
    }

    predictions.push(prediction);
  }

  return predictions.sort((a, b) => b.persistence_probability - a.persistence_probability);
}

/**
 * Generate the Next Best Action recommendation.
 */
export async function generateRecommendation(profileId) {
  const predictions = await runPredictions(profileId);
  const mistakes = USE_DB()
    ? (await query('SELECT * FROM mistake_memories WHERE profile_id = $1 AND is_resolved = false ORDER BY severity DESC', [profileId])).rows
    : Array.from(getStore().mistakes.values()).filter(m => m.profile_id === profileId && !m.is_resolved);

  if (predictions.length === 0 && mistakes.length === 0) {
    return {
      topic: 'General Practice',
      action: 'Start a practice session to begin building your performance profile',
      duration_minutes: 15,
      reason: 'No performance data yet. Start practicing to get personalized recommendations.',
      prediction_score: null,
    };
  }

  // Pick the highest-risk topic
  const topPrediction = predictions[0];
  const relatedMistake = mistakes.find(m => 
    m.topic.toLowerCase().includes((topPrediction?.topic || '').toLowerCase()) ||
    (topPrediction?.topic || '').toLowerCase().includes(m.topic.toLowerCase())
  );

  const topic = topPrediction?.topic || mistakes[0]?.topic || 'General';
  const persistence = topPrediction?.persistence_probability || 0.5;

  const id = uuid();
  const recommendation = {
    id,
    profile_id: profileId,
    topic,
    action: `Practice ${topic}`,
    duration_minutes: persistence > 0.7 ? 30 : persistence > 0.4 ? 20 : 15,
    reason: relatedMistake
      ? `You struggled with ${relatedMistake.mistake} in recent sessions. ${topPrediction ? `Predicted persistence: ${Math.round(persistence * 100)}%` : ''}`
      : `Based on your performance, ${topic} needs the most attention.`,
    prediction_score: persistence,
    is_completed: false,
    created_at: new Date().toISOString(),
  };

  if (USE_DB()) {
    await query(
      `INSERT INTO recommendations (id, profile_id, topic, action, duration_minutes, reason, prediction_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, profileId, topic, recommendation.action, recommendation.duration_minutes,
       recommendation.reason, persistence]
    );
  } else {
    getStore().recommendations.set(id, recommendation);
  }

  return recommendation;
}
