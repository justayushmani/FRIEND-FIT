// ============================================
// Profile Service
// ============================================
import { v4 as uuid } from 'uuid';
import { query } from '../db/connection.js';
import { getStore } from '../db/memoryStore.js';

const USE_DB = () => !!process.env.DATABASE_URL;

export async function createProfile(data) {
  const id = uuid();
  const profile = {
    id,
    name: data.name,
    target_role: data.targetRole || null,
    skills: data.skills || [],
    weak_areas: data.weakAreas || [],
    projects: data.projects || [],
    resume_text: data.resumeText || null,
    job_description: data.jobDescription || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (USE_DB()) {
    await query(
      `INSERT INTO profiles (id, name, target_role, skills, weak_areas, projects, resume_text, job_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, profile.name, profile.target_role, JSON.stringify(profile.skills),
       JSON.stringify(profile.weak_areas), JSON.stringify(profile.projects),
       profile.resume_text, profile.job_description]
    );
  } else {
    getStore().profiles.set(id, profile);
  }

  return profile;
}

export async function getProfile(id) {
  if (USE_DB()) {
    const result = await query('SELECT * FROM profiles WHERE id = $1', [id]);
    return result.rows[0] || null;
  }
  return getStore().profiles.get(id) || null;
}

export async function updateProfile(id, data) {
  if (USE_DB()) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.targetRole !== undefined) { fields.push(`target_role = $${idx++}`); values.push(data.targetRole); }
    if (data.skills !== undefined) { fields.push(`skills = $${idx++}`); values.push(JSON.stringify(data.skills)); }
    if (data.weakAreas !== undefined) { fields.push(`weak_areas = $${idx++}`); values.push(JSON.stringify(data.weakAreas)); }
    if (data.projects !== undefined) { fields.push(`projects = $${idx++}`); values.push(JSON.stringify(data.projects)); }
    if (data.resumeText !== undefined) { fields.push(`resume_text = $${idx++}`); values.push(data.resumeText); }
    if (data.jobDescription !== undefined) { fields.push(`job_description = $${idx++}`); values.push(data.jobDescription); }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE profiles SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0];
  } else {
    const existing = getStore().profiles.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
    getStore().profiles.set(id, updated);
    return updated;
  }
}

export async function getAllProfiles() {
  if (USE_DB()) {
    const result = await query('SELECT * FROM profiles ORDER BY created_at DESC');
    return result.rows;
  }
  return Array.from(getStore().profiles.values());
}
