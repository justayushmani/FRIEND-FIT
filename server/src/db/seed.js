// ============================================
// FriendFit — Database Seeder CLI
// ============================================
import 'dotenv/config';
import { query } from './connection.js';
import { isDatabaseEnabled } from './mode.js';

const DEMO_PROFILE = {
  id: 'demo-user-001',
  name: 'Demo Friend',
  target_role: 'Full-Stack Software Engineer',
  skills: JSON.stringify(['JavaScript', 'React', 'Node.js', 'Python', 'SQL', 'System Design']),
  weak_areas: JSON.stringify(['Database optimization', 'System design trade-offs', 'Concurrency']),
  projects: JSON.stringify([
    { name: 'E-commerce Platform', tech: ['React', 'Node.js', 'PostgreSQL'], description: 'Full-stack marketplace app with payments' },
    { name: 'Real-time Chat App', tech: ['WebSocket', 'Redis', 'React'], description: 'Scalable messaging system' }
  ]),
  resume_text: 'Full-stack developer with 2 years of experience building web applications using React, Node.js, and PostgreSQL.',
  job_description: 'Looking for a full-stack software engineer role at a growth-stage startup.'
};

async function seed() {
  console.log('[Seed] Seeding database...');
  try {
    if (!isDatabaseEnabled()) {
      console.log('[Seed] PostgreSQL is not enabled. Skipping DB seeding.');
      return;
    }

    await query(
      `INSERT INTO profiles (id, name, target_role, skills, weak_areas, projects, resume_text, job_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         target_role = EXCLUDED.target_role,
         updated_at = CURRENT_TIMESTAMP`,
      [
        DEMO_PROFILE.id,
        DEMO_PROFILE.name,
        DEMO_PROFILE.target_role,
        DEMO_PROFILE.skills,
        DEMO_PROFILE.weak_areas,
        DEMO_PROFILE.projects,
        DEMO_PROFILE.resume_text,
        DEMO_PROFILE.job_description
      ]
    );

    console.log('✅ [Seed] Database seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ [Seed] Error seeding database:', err.message);
    process.exit(1);
  }
}

seed();
