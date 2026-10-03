// ============================================
// Analysis Routes
// ============================================
import { Router } from 'express';
import { getSession, getSessionAnswers } from '../services/sessionService.js';
import { getProfile } from '../services/profileService.js';
import { generateSessionAnalysis } from '../services/aiService.js';
import { storeMetrics, getPerformanceHistory } from '../services/performanceService.js';

export const analysisRouter = Router();

// Get analysis for a completed session
analysisRouter.get('/session/:sessionId', async (req, res, next) => {
  try {
    const session = await getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const profile = await getProfile(session.profile_id);
    const answers = await getSessionAnswers(req.params.sessionId);

    if (answers.length === 0) {
      return res.json({
        overallScore: 0,
        categories: [],
        keyWeaknesses: [],
        recommendations: ['Complete a practice session first'],
        summary: 'No answers to analyze.',
      });
    }

    const analysis = await generateSessionAnalysis(profile, answers);

    // Store metrics
    if (analysis.categories.length > 0) {
      await storeMetrics(req.params.sessionId, session.profile_id, analysis.categories);
    }

    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

// Get performance history for a profile
analysisRouter.get('/history/:profileId', async (req, res, next) => {
  try {
    const history = await getPerformanceHistory(req.params.profileId);
    res.json(history);
  } catch (err) {
    next(err);
  }
});
