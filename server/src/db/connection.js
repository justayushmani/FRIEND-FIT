// ============================================
// Database Connection — Neon PostgreSQL
// ============================================
import pg from 'pg';
import { isDatabaseEnabled } from './mode.js';
const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool) {
    if (!isDatabaseEnabled()) {
      console.warn('[DB] PostgreSQL is opt-in; using in-memory fallback');
      return null;
    }
    const connectionString = process.env.DATABASE_URL;
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error', err.message);
    });
  }
  return pool;
}

export async function query(text, params) {
  const p = getPool();
  if (!p) throw new Error('Database not configured');
  const start = Date.now();
  const result = await p.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DB] ${duration}ms — ${text.substring(0, 80)}...`);
  }
  return result;
}

export async function testConnection() {
  try {
    const p = getPool();
    if (!p) return false;
    await p.query('SELECT 1');
    console.log('[DB] Connected to Neon PostgreSQL');
    return true;
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    return false;
  }
}
