// ============================================
// Mistake Memory Service
// ============================================
import { v4 as uuid } from 'uuid';
import { query } from '../db/connection.js';
import { getStore } from '../db/memoryStore.js';
import { isDatabaseEnabled } from '../db/mode.js';
import { generateEmbedding } from './aiService.js';

const USE_DB = isDatabaseEnabled;

export async function storeMistake(profileId, sessionId, mistakeData) {
  const normalized = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (USE_DB()) {
    const existing = await query(
      `SELECT * FROM mistake_memories WHERE profile_id = $1 AND is_resolved = false
       AND LOWER(REPLACE(topic, '-', ' ')) = LOWER(REPLACE($2, '-', ' ')) AND LOWER(mistake) = LOWER($3)
       ORDER BY created_at DESC LIMIT 1`,
      [profileId, mistakeData.topic, mistakeData.mistake],
    );
    if (existing.rows[0]) {
      const updated = await query(
        `UPDATE mistake_memories SET recommendation = COALESCE($2, recommendation), updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [existing.rows[0].id, mistakeData.recommendation],
      );
      return updated.rows[0];
    }
  } else {
    const existing = Array.from(getStore().mistakes.values()).find((item) =>
      item.profile_id === profileId && !item.is_resolved
      && normalized(item.topic) === normalized(mistakeData.topic)
      && normalized(item.mistake) === normalized(mistakeData.mistake));
    if (existing) {
      existing.times_tested += 1;
      existing.recommendation = mistakeData.recommendation || existing.recommendation;
      existing.updated_at = new Date().toISOString();
      return existing;
    }
  }

  // Generate vector embedding if embedding model is available
  let embeddingVector = null;
  try {
    const textToEmbed = `${mistakeData.topic}: ${mistakeData.mistake}`;
    embeddingVector = await generateEmbedding(textToEmbed);
  } catch {
    embeddingVector = null;
  }

  const id = uuid();
  const mistake = {
    id,
    profile_id: profileId,
    session_id: sessionId,
    topic: mistakeData.topic,
    mistake: mistakeData.mistake,
    severity: mistakeData.severity || 'medium',
    recommendation: mistakeData.recommendation || null,
    times_tested: 1,
    times_improved: 0,
    is_resolved: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (USE_DB()) {
    const vectorStr = Array.isArray(embeddingVector) && embeddingVector.length === 768
      ? `[${embeddingVector.join(',')}]`
      : null;

    await query(
      `INSERT INTO mistake_memories (id, profile_id, session_id, topic, mistake, severity, recommendation, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)`,
      [id, profileId, sessionId, mistake.topic, mistake.mistake, mistake.severity, mistake.recommendation, vectorStr]
    );
  } else {
    getStore().mistakes.set(id, mistake);
  }

  return mistake;
}

export async function getMistakesByProfile(profileId) {
  if (USE_DB()) {
    const result = await query(
      `SELECT * FROM mistake_memories WHERE profile_id = $1 AND is_resolved = false 
       ORDER BY CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, created_at DESC`,
      [profileId]
    );
    return result.rows;
  }
  return Array.from(getStore().mistakes.values())
    .filter(m => m.profile_id === profileId && !m.is_resolved)
    .sort((a, b) => {
      const order = { high: 1, medium: 2, low: 3 };
      return (order[a.severity] || 2) - (order[b.severity] || 2);
    });
}

export async function getRelevantMistakes(profileId, topic) {
  if (USE_DB()) {
    // 1. Try vector semantic retrieval if embedding is available
    let topicEmbedding = null;
    try {
      topicEmbedding = await generateEmbedding(topic);
    } catch {
      topicEmbedding = null;
    }

    if (Array.isArray(topicEmbedding) && topicEmbedding.length === 768) {
      try {
        const vectorStr = `[${topicEmbedding.join(',')}]`;
        const semanticResults = await query(
          `SELECT *, (embedding <=> $3::vector) as semantic_distance
           FROM mistake_memories
           WHERE profile_id = $1 AND is_resolved = false AND embedding IS NOT NULL
           ORDER BY (CASE WHEN LOWER(topic) = LOWER($2) THEN -0.4 ELSE 0.0 END) + (embedding <=> $3::vector) ASC
           LIMIT 5`,
          [profileId, topic, vectorStr]
        );
        if (semanticResults.rows.length > 0) {
          return semanticResults.rows;
        }
      } catch (err) {
        console.warn('[Memory] Semantic vector query failed, falling back to lexical:', err.message);
      }
    }

    // 2. Exact topic match
    const exact = await query(
      `SELECT * FROM mistake_memories WHERE profile_id = $1 AND is_resolved = false AND LOWER(topic) = LOWER($2)
       ORDER BY severity DESC, created_at DESC LIMIT 5`,
      [profileId, topic]
    );
    if (exact.rows.length > 0) return exact.rows;

    // 3. Hybrid lexical retrieval over topic and mistake text
    const fallback = await query(
      `SELECT *, CASE WHEN LOWER(REPLACE(topic, '-', ' ')) = LOWER(REPLACE($2, '-', ' ')) THEN 3
                       WHEN LOWER(REPLACE(topic, '-', ' ')) LIKE '%' || LOWER($2) || '%' OR LOWER($2) LIKE '%' || LOWER(REPLACE(topic, '-', ' ')) || '%' THEN 2
                       WHEN LOWER(mistake || ' ' || COALESCE(recommendation, '')) LIKE '%' || LOWER($2) || '%' THEN 1 ELSE 0 END AS relevance
       FROM mistake_memories WHERE profile_id = $1 AND is_resolved = false
       ORDER BY relevance DESC, CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC LIMIT 5`,
      [profileId, topic]
    );
    return fallback.rows;
  }

  // In-memory lexical retrieval ranked by topic match, then mistake text overlap.
  const terms = topic.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  return Array.from(getStore().mistakes.values())
    .filter(m => m.profile_id === profileId && !m.is_resolved)
    .map((m) => {
      const text = `${m.topic} ${m.mistake} ${m.recommendation || ''}`.toLowerCase();
      const exactTopic = m.topic.toLowerCase() === topic.toLowerCase() ? 3 : 0;
      const topicMatch = m.topic.toLowerCase().includes(topic.toLowerCase()) || topic.toLowerCase().includes(m.topic.toLowerCase()) ? 2 : 0;
      const overlap = terms.filter((term) => text.includes(term)).length;
      return { mistake: m, relevance: Math.max(exactTopic, topicMatch) + overlap };
    })
    .filter((entry) => entry.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .map((entry) => entry.mistake)
    .slice(0, 5);
}

export async function updateMistake(id, updates) {
  if (USE_DB()) {
    const result = await query(
      `UPDATE mistake_memories SET 
        times_tested = COALESCE($2, times_tested),
        times_improved = COALESCE($3, times_improved),
        is_resolved = COALESCE($4, is_resolved),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, updates.timesTested, updates.timesImproved, updates.isResolved]
    );
    return result.rows[0];
  } else {
    const mistake = getStore().mistakes.get(id);
    if (!mistake) return null;
    if (updates.timesTested !== undefined) mistake.times_tested = updates.timesTested;
    if (updates.timesImproved !== undefined) mistake.times_improved = updates.timesImproved;
    if (updates.isResolved !== undefined) mistake.is_resolved = updates.isResolved;
    Object.assign(mistake, { updated_at: new Date().toISOString() });
    return mistake;
  }
}

export async function recordTopicOutcome(profileId, topic, score, previousScore) {
  if (previousScore == null) return [];
  const improved = score > Number(previousScore);
  const resolved = score >= 80;
  if (USE_DB()) {
    const result = await query(
      `UPDATE mistake_memories SET times_tested = times_tested + 1,
        times_improved = times_improved + $3,
        is_resolved = CASE WHEN $4 THEN true ELSE is_resolved END,
        updated_at = NOW()
       WHERE profile_id = $1 AND LOWER(REPLACE(topic, '-', ' ')) = LOWER(REPLACE($2, '-', ' ')) AND is_resolved = false RETURNING *`,
      [profileId, topic, improved ? 1 : 0, resolved],
    );
    return result.rows;
  }
  const changed = [];
  for (const mistake of getStore().mistakes.values()) {
    if (mistake.profile_id !== profileId || mistake.is_resolved || normalizedTopic(mistake.topic) !== normalizedTopic(topic)) continue;
    mistake.times_tested += 1;
    if (improved) mistake.times_improved += 1;
    if (resolved) mistake.is_resolved = true;
    mistake.updated_at = new Date().toISOString();
    changed.push(mistake);
  }
  return changed;
}

function normalizedTopic(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export async function getMistakeStats(profileId) {
  if (USE_DB()) {
    const result = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_resolved = true) as resolved,
        COUNT(*) FILTER (WHERE is_resolved = false) as unresolved,
        COUNT(*) FILTER (WHERE severity = 'high' AND is_resolved = false) as high_severity
       FROM mistake_memories WHERE profile_id = $1`,
      [profileId]
    );
    return result.rows[0];
  }
  const all = Array.from(getStore().mistakes.values()).filter(m => m.profile_id === profileId);
  return {
    total: all.length,
    resolved: all.filter(m => m.is_resolved).length,
    unresolved: all.filter(m => !m.is_resolved).length,
    high_severity: all.filter(m => !m.is_resolved && m.severity === 'high').length,
  };
}
