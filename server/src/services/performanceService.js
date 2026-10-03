// ============================================
// Performance & Prediction Service
// ============================================
import { v4 as uuid } from 'uuid';
import { query } from '../db/connection.js';
import { getStore } from '../db/memoryStore.js';
import { isDatabaseEnabled } from '../db/mode.js';

const USE_DB = isDatabaseEnabled;

// ============================================
// Performance Metrics
// ============================================
export async function storeMetrics(sessionId, profileId, categories) {
  if (USE_DB()) {
    await query('DELETE FROM performance_metrics WHERE session_id = $1', [sessionId]);
  } else {
    for (const [id, m] of getStore().metrics.entries()) {
      if (m.session_id === sessionId) getStore().metrics.delete(id);
    }
  }

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

// Historical feature builder. These are observed aggregates, not TabPFN features or predictions.
export function buildFeatureVector(topicData) {
  return {
    topic: topicData.topic || 'general',
    difficulty: topicData.difficulty || 'medium',
    attempt_count: Number(topicData.attempts ?? 0),
    average_score: Number(topicData.avgScore ?? 0),
    recent_score: Number(topicData.recentScore ?? 0),
    failure_count: Number(topicData.failureCount ?? 0),
    average_time_seconds: Number(topicData.averageTimeSeconds ?? 0),
    improvement_rate: Number(topicData.improvementRate ?? 0),
    recent_trend: Number(topicData.recentTrend ?? 0),
    session_count: Number(topicData.sessionCount ?? 0),
    mistake_count: Number(topicData.mistakeCount ?? 0),
  };
}

// Transparent, deterministic historical risk index (0-100); it is not a trained ML prediction.
export function estimateHistoricalRisk(features) {
  let score = 0;
  if (features.average_score < 40) score += 40;
  else if (features.average_score < 60) score += 28;
  else if (features.average_score < 75) score += 14;
  if (features.recent_score < features.average_score - 10) score += 20;
  if (features.recent_trend < 0) score += 10;
  if (features.failure_count >= 2) score += 15;
  else if (features.failure_count === 1) score += 7;
  if (features.mistake_count >= 3) score += 15;
  else if (features.mistake_count > 0) score += 7;
  return Math.min(100, score);
}

export async function getTopicPerformance(profileId) {
  if (USE_DB()) {
    const result = await query(
      `SELECT q.topic_name AS topic, COUNT(a.id)::int AS attempts,
        AVG(a.score) AS avg_score,
        (ARRAY_AGG(a.score ORDER BY a.created_at DESC))[1] AS recent_score,
        COUNT(a.id) FILTER (WHERE a.score < 60)::int AS failure_count,
        AVG(a.time_taken_seconds) AS average_time_seconds,
        COUNT(DISTINCT a.session_id)::int AS session_count,
        (SELECT COUNT(*)::int FROM mistake_memories mm WHERE mm.profile_id = $1 AND LOWER(mm.topic) = LOWER(q.topic_name) AND mm.is_resolved = false) AS mistake_count,
        (SELECT COUNT(*)::int FROM mistake_memories mm WHERE mm.profile_id = $1 AND LOWER(mm.topic) = LOWER(q.topic_name) AND mm.is_resolved = false AND mm.severity = 'high') AS high_severity_count
       FROM answers a JOIN questions q ON q.id = a.question_id
       JOIN practice_sessions ps ON ps.id = a.session_id
       WHERE ps.profile_id = $1 AND q.topic_name IS NOT NULL AND a.score IS NOT NULL
       GROUP BY q.topic_name`,
      [profileId],
    );
    return result.rows;
  }

  const sessions = Array.from(getStore().sessions.values()).filter((session) => session.profile_id === profileId);
  const sessionIds = new Set(sessions.map((session) => session.id));
  const questions = new Map(Array.from(getStore().questions.values()).map((question) => [question.id, question]));
  const mistakes = Array.from(getStore().mistakes.values()).filter((mistake) => mistake.profile_id === profileId && !mistake.is_resolved);
  const grouped = new Map();
  for (const answer of getStore().answers.values()) {
    if (!sessionIds.has(answer.session_id) || answer.score == null) continue;
    const question = questions.get(answer.question_id);
    const topic = question?.topic_name || 'general';
    const entry = grouped.get(topic) || { topic, answers: [], sessions: new Set(), mistakes: [] };
    entry.answers.push(answer);
    entry.sessions.add(answer.session_id);
    grouped.set(topic, entry);
  }
  for (const entry of grouped.values()) {
    entry.answers.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    entry.mistakes = mistakes.filter((m) => m.topic.toLowerCase() === entry.topic.toLowerCase());
  }
  return Array.from(grouped.values()).map((entry) => {
    const scores = entry.answers.map((answer) => Number(answer.score));
    return {
      topic: entry.topic,
      attempts: scores.length,
      avg_score: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      recent_score: scores.at(-1),
      failure_count: scores.filter((score) => score < 60).length,
      average_time_seconds: entry.answers.reduce((sum, answer) => sum + (Number(answer.time_taken_seconds) || 0), 0) / scores.length,
      session_count: entry.sessions.size,
      mistake_count: entry.mistakes.length,
      high_severity_count: entry.mistakes.filter((mistake) => mistake.severity === 'high').length,
    };
  });
}

export async function runPredictions(profileId) {
  const topicData = await getTopicPerformance(profileId);
  const predictions = [];
  for (const row of topicData) {
    // One result is not enough history to infer persistence; return no estimate for that topic.
    if (Number(row.attempts) < 2) continue;
    const features = buildFeatureVector({
      topic: row.topic,
      attempts: row.attempts,
      avgScore: row.avg_score,
      recentScore: row.recent_score,
      failureCount: row.failure_count,
      averageTimeSeconds: row.average_time_seconds,
      recentTrend: Number(row.recent_score) - Number(row.avg_score),
      improvementRate: (Number(row.recent_score) - Number(row.avg_score)) / Math.max(1, Number(row.attempts) - 1),
      mistakeCount: row.mistake_count,
      sessionCount: row.session_count,
    });
    const riskScore = estimateHistoricalRisk(features);
    const riskLevel = riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low';
    const prediction = {
      profile_id: profileId,
      topic: row.topic,
      risk_level: riskLevel,
      risk_score: riskScore,
      estimate_type: 'historical-rule-index',
      features,
      attempts: Number(row.attempts),
      created_at: new Date().toISOString(),
    };
    if (USE_DB()) {
      const id = uuid();
      await query(
        `INSERT INTO predictions (id, profile_id, topic, risk_level, persistence_probability, model_used, features)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, profileId, row.topic, riskLevel, riskScore / 100, 'historical-rule-index', JSON.stringify(features)],
      );
      prediction.id = id;
    } else {
      const id = uuid();
      prediction.id = id;
      getStore().predictions.set(id, prediction);
    }
    predictions.push(prediction);
  }
  return predictions.sort((a, b) => b.risk_score - a.risk_score);
}

export async function generateRecommendation(profileId) {
  const [predictions, topicData] = await Promise.all([runPredictions(profileId), getTopicPerformance(profileId)]);
  const mistakes = USE_DB()
    ? (await query(`SELECT * FROM mistake_memories WHERE profile_id = $1 AND is_resolved = false ORDER BY CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC`, [profileId])).rows
    : Array.from(getStore().mistakes.values()).filter((mistake) => mistake.profile_id === profileId && !mistake.is_resolved);

  const historyTopic = predictions[0]?.topic
    || [...topicData].sort((a, b) => Number(a.avg_score) - Number(b.avg_score))[0]?.topic;
  const topic = historyTopic || mistakes[0]?.topic;
  if (!topic) return {
    topic: 'General Practice',
    action: 'Start a practice session to build your performance history',
    duration_minutes: 15,
    reason: 'There is not enough personal practice history for a tailored action yet.',
    risk_score: null,
    estimate_type: 'insufficient-history',
  };

  const topPrediction = predictions.find((prediction) => prediction.topic.toLowerCase() === topic.toLowerCase());
  const topicRow = topicData.find((row) => row.topic.toLowerCase() === topic.toLowerCase());
  const relatedMistake = mistakes.find((mistake) => mistake.topic.toLowerCase() === topic.toLowerCase());
  const reason = topPrediction
    ? `Across ${topPrediction.attempts} attempts, the historical risk index is ${topPrediction.risk_score}/100${relatedMistake ? `. Recurring gap: ${relatedMistake.mistake}` : '.'}`
    : `Your current average is ${Math.round(Number(topicRow?.avg_score ?? 0))}/100. Repeat attempts are needed before estimating persistence.`;
  const recommendation = {
    profile_id: profileId,
    topic,
    action: `Practice ${topic}`,
    duration_minutes: topPrediction?.risk_level === 'high' ? 25 : 20,
    reason,
    risk_score: topPrediction?.risk_score ?? null,
    estimate_type: topPrediction?.estimate_type || 'insufficient-history',
    created_at: new Date().toISOString(),
  };
  if (USE_DB()) {
    const id = uuid();
    await query(
      `INSERT INTO recommendations (id, profile_id, topic, action, duration_minutes, reason, prediction_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, profileId, topic, recommendation.action, recommendation.duration_minutes, recommendation.reason,
        recommendation.risk_score == null ? null : recommendation.risk_score / 100],
    );
    recommendation.id = id;
  } else {
    const id = uuid();
    recommendation.id = id;
    getStore().recommendations.set(id, recommendation);
  }
  return recommendation;
}
