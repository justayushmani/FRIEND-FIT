// ============================================
// Recommendation Routes
// ============================================
import { Router } from 'express';
import { generateRecommendation, runPredictions } from '../services/performanceService.js';

export const recommendRouter = Router();

// Get next best action
recommendRouter.get('/:profileId', async (req, res, next) => {
  try {
    const recommendation = await generateRecommendation(req.params.profileId);
    res.json(recommendation);
  } catch (err) {
    next(err);
  }
});

// Get all predictions
recommendRouter.get('/:profileId/predictions', async (req, res, next) => {
  try {
    const predictions = await runPredictions(req.params.profileId);
    res.json(predictions);
  } catch (err) {
    next(err);
  }
});
