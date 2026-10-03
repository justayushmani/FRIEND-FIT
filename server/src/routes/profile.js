// ============================================
// Profile Routes
// ============================================
import { Router } from 'express';
import { createProfile, getProfile, updateProfile, getAllProfiles } from '../services/profileService.js';
import { z } from 'zod';

export const profileRouter = Router();
const projectSchema = z.object({
  name: z.string().trim().max(160).optional(),
  tech: z.union([z.string().max(500), z.array(z.string().max(80)).max(30)]).optional(),
  description: z.string().max(2000).optional(),
});
const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  targetRole: z.string().trim().max(160).optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  weakAreas: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  projects: z.array(projectSchema).max(20).optional(),
  resumeText: z.string().max(12000).optional(),
  jobDescription: z.string().max(12000).optional(),
});

// Create profile
profileRouter.post('/', async (req, res, next) => {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid profile', details: parsed.error.issues });
    const { name, targetRole, skills, weakAreas, projects, resumeText, jobDescription } = parsed.data;
    const profile = await createProfile({
      name: name.trim(),
      targetRole, skills, weakAreas, projects, resumeText, jobDescription
    });
    res.status(201).json(profile);
  } catch (err) {
    next(err);
  }
});

// Get all profiles
profileRouter.get('/', async (req, res, next) => {
  try {
    const profiles = await getAllProfiles();
    res.json(profiles);
  } catch (err) {
    next(err);
  }
});

// Get profile by ID
profileRouter.get('/:id', async (req, res, next) => {
  try {
    const profile = await getProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// Update profile
profileRouter.put('/:id', async (req, res, next) => {
  try {
    const parsed = profileSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid profile', details: parsed.error.issues });
    const updated = await updateProfile(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Profile not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
