// ============================================
// Mistake Memory Service
// ============================================
import { v4 as uuid } from 'uuid';
import { query } from '../db/connection.js';
import { getStore } from '../db/memoryStore.js';
import { getModelProvider } from '../ai/modelProvider.js';

const USE_DB = () => !!process.env.DATABASE_URL;

export async function storeMistake(profileId, sessionId, mistakeData) {
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
    // Try to generate embedding for semantic search
    let embedding = null;
    try {
      const provider = getModelProvider();
      if (provider && typeof provider.generateEmbedding === 'function') {
        embedding = await provider.generateEmbedding(
          `Topic: ${mistake.topic}. Mistake: ${mistake.mistake}. ${mistake.recommendation || ''}`
        );
      }
    } catch (err) {
      console.warn('[Memory] Embedding generation failed:', err.message);
    }

    if (embedding) {
      await query(
        `INSERT INTO mistake_memories (id, profile_id, session_id, topic, mistake, severity, recommendation, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, profileId, sessionId, mistake.topic, mistake.mistake, mistake.severity, mistake.recommendation,
         `[${embedding.join(',')}]`]
      );
    } else {
      await query(
        `INSERT INTO mistake_memories (id, profile_id, session_id, topic, mistake, severity, recommendation)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, profileId, sessionId, mistake.topic, mistake.mistake, mistake.severity, mistake.recommendation]
      );
    }
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
    // First try exact topic match
    const exact = await query(
      `SELECT * FROM mistake_memories WHERE profile_id = $1 AND is_resolved = false AND LOWER(topic) = LOWER($2)
       ORDER BY severity DESC, created_at DESC LIMIT 5`,
      [profileId, topic]
    );
    if (exact.rows.length > 0) return exact.rows;

    // Then try semantic search if embeddings exist
    try {
      const provider = getModelProvider();
      if (provider && typeof provider.generateEmbedding === 'function') {
        const queryEmbedding = await provider.generateEmbedding(topic);
        const semantic = await query(
          `SELECT *, 1 - (embedding <=> $2) as similarity 
           FROM mistake_memories 
           WHERE profile_id = $1 AND is_resolved = false AND embedding IS NOT NULL
           ORDER BY embedding <=> $2 LIMIT 5`,
          [profileId, `[${queryEmbedding.join(',')}]`]
        );
        return semantic.rows;
      }
    } catch (err) {
      console.warn('[Memory] Semantic search failed:', err.message);
    }

    // Fallback: get recent unresolved mistakes
    const fallback = await query(
      `SELECT * FROM mistake_memories WHERE profile_id = $1 AND is_resolved = false 
       ORDER BY created_at DESC LIMIT 5`,
      [profileId]
    );
    return fallback.rows;
  }

  // In-memory: simple topic matching
  return Array.from(getStore().mistakes.values())
    .filter(m => m.profile_id === profileId && !m.is_resolved)
    .filter(m => m.topic.toLowerCase().includes(topic.toLowerCase()) || topic.toLowerCase().includes(m.topic.toLowerCase()))
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
    Object.assign(mistake, updates, { updated_at: new Date().toISOString() });
    return mistake;
  }
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
