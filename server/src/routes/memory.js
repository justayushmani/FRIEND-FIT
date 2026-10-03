// ============================================
// Memory Routes
// ============================================
import { Router } from 'express';
import { getMistakesByProfile, getMistakeStats } from '../services/memoryService.js';

export const memoryRouter = Router();

// Get all unresolved mistakes for a profile
memoryRouter.get('/:profileId', async (req, res, next) => {
  try {
    const mistakes = await getMistakesByProfile(req.params.profileId);
    res.json(mistakes);
  } catch (err) {
    next(err);
  }
});

// Get mistake stats
memoryRouter.get('/:profileId/stats', async (req, res, next) => {
  try {
    const stats = await getMistakeStats(req.params.profileId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});
