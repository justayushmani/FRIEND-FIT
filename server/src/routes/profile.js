// ============================================
// Profile Routes
// ============================================
import { Router } from 'express';
import { createProfile, getProfile, updateProfile, getAllProfiles } from '../services/profileService.js';

export const profileRouter = Router();

// Create profile
profileRouter.post('/', async (req, res, next) => {
  try {
    const { name, targetRole, skills, weakAreas, projects, resumeText, jobDescription } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }
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
    const updated = await updateProfile(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Profile not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
