// ============================================
// Session Routes
// ============================================
import { Router } from 'express';
import {
  createSession, getSession, endSession,
  getSessionsByProfile, addQuestion, addAnswer,
  getSessionQuestions, getSessionAnswers
} from '../services/sessionService.js';
import { getProfile } from '../services/profileService.js';
import { generateQuestion, evaluateAnswer, extractMistakes } from '../services/aiService.js';
import { getMistakesByProfile, getRelevantMistakes, recordTopicOutcome, storeMistake } from '../services/memoryService.js';
import { getTopicPerformance } from '../services/performanceService.js';
import { z } from 'zod';

export const sessionRouter = Router();
const startSessionSchema = z.object({
  profileId: z.string().min(1),
  sessionType: z.string().max(40).optional(),
  targetTopic: z.string().max(80).optional(),
});
const questionRequestSchema = z.object({
  topic: z.string().max(80).optional(),
});
const answerSchema = z.object({
  questionId: z.string().min(1),
  answerText: z.string().trim().min(1).max(15000),
  timeTaken: z.number().int().nonnegative().max(7200).optional(),
});

// Start a new practice session
sessionRouter.post('/start', async (req, res, next) => {
  try {
    const parsed = startSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid session request', details: parsed.error.issues });
    const { profileId, sessionType, targetTopic } = parsed.data;

    const profile = await getProfile(profileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const session = await createSession(profileId, sessionType);
    if (targetTopic) {
      session.target_topic = targetTopic;
    }
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

// Get next question for a session
sessionRouter.post('/:sessionId/question', async (req, res, next) => {
  try {
    const session = await getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const reqBody = questionRequestSchema.safeParse(req.body || {}).data || {};

    const profile = await getProfile(session.profile_id);
    const existingQuestions = await getSessionQuestions(req.params.sessionId);
    const existingAnswers = await getSessionAnswers(req.params.sessionId);

    // Build session history for AI context
    const sessionHistory = existingQuestions.map((q, i) => {
      const answer = existingAnswers.find(a => a.question_id === q.id);
      return {
        question: q.question_text,
        answer: answer?.answer_text || '',
        score: answer?.score || 0,
      };
    }).filter(h => h.answer);

    const questionNumber = existingQuestions.length + 1;
    const weakAreas = profile.weak_areas || [];
    const focusTopic = reqBody.topic
      || (questionNumber === 1 && session.target_topic ? session.target_topic : null)
      || (weakAreas.length ? weakAreas[(questionNumber - 1) % weakAreas.length] : (existingQuestions.at(-1)?.topic_name || 'general'));
    const relatedMistakes = await getRelevantMistakes(session.profile_id, focusTopic);
    const mistakes = relatedMistakes.length ? relatedMistakes : await getMistakesByProfile(session.profile_id);
    const questionData = await generateQuestion(profile, sessionHistory, mistakes, questionNumber);

    const saved = await addQuestion(req.params.sessionId, {
      ...questionData,
      order: questionNumber,
    });

    res.json({
      ...saved,
      questionNumber,
      totalInSession: questionNumber,
    });
  } catch (err) {
    next(err);
  }
});

// Submit answer for a question
sessionRouter.post('/:sessionId/answer', async (req, res, next) => {
  try {
    const parsed = answerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid answer', details: parsed.error.issues });
    const { questionId, answerText, timeTaken } = parsed.data;

    const session = await getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const profile = await getProfile(session.profile_id);
    const questions = await getSessionQuestions(req.params.sessionId);
    const question = questions.find(q => q.id === questionId);
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const previousPerformance = await getTopicPerformance(session.profile_id);
    const previousTopicScore = previousPerformance.find((row) =>
      row.topic.toLowerCase() === (question.topic_name || '').toLowerCase());

    // AI evaluates the answer
    const evaluation = await evaluateAnswer(question, answerText, profile);

    // Store the answer with evaluation
    const answer = await addAnswer(questionId, req.params.sessionId, {
      answerText,
      score: evaluation.score,
      correct: evaluation.correct,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      conceptGaps: evaluation.conceptGaps,
      followUpNeeded: evaluation.followUpNeeded,
      feedback: evaluation.feedback,
      timeTaken,
    });

    await recordTopicOutcome(session.profile_id, question.topic_name || 'general', evaluation.score, previousTopicScore?.recent_score);

    // Extract and store mistakes if score is below threshold
    if (evaluation.score < 80) {
      const mistakes = await extractMistakes(question, evaluation, profile);
      for (const m of mistakes) {
        await storeMistake(session.profile_id, req.params.sessionId, m);
      }
    }

    res.json({
      answer,
      evaluation,
      followUpQuestion: evaluation.followUpQuestion,
    });
  } catch (err) {
    next(err);
  }
});

// End a session
sessionRouter.post('/:sessionId/end', async (req, res, next) => {
  try {
    const answers = await getSessionAnswers(req.params.sessionId);
    const avgScore = answers.length > 0
      ? Math.round(answers.reduce((sum, a) => sum + (a.score || 0), 0) / answers.length)
      : 0;

    const session = await endSession(req.params.sessionId, avgScore);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json({ session, questionsAnswered: answers.length, averageScore: avgScore });
  } catch (err) {
    next(err);
  }
});

// Get session details
sessionRouter.get('/:sessionId', async (req, res, next) => {
  try {
    const session = await getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const questions = await getSessionQuestions(req.params.sessionId);
    const answers = await getSessionAnswers(req.params.sessionId);

    res.json({ session, questions, answers });
  } catch (err) {
    next(err);
  }
});

// Get sessions for a profile
sessionRouter.get('/profile/:profileId', async (req, res, next) => {
  try {
    const sessions = await getSessionsByProfile(req.params.profileId);
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});
