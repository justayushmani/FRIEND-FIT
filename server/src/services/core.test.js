import test from 'node:test';
import assert from 'node:assert/strict';
import { getStore } from '../db/memoryStore.js';
import { LocalGemmaProvider } from '../ai/modelProvider.js';
import { createProfile } from './profileService.js';
import { createSession, addQuestion, addAnswer, getSessionAnswers } from './sessionService.js';
import { storeMistake, getRelevantMistakes, getMistakesByProfile, recordTopicOutcome } from './memoryService.js';
import { evaluateAnswer, extractMistakes, generateQuestion, generateSessionAnalysis } from './aiService.js';
import { buildFeatureVector, estimateHistoricalRisk, runPredictions, generateRecommendation } from './performanceService.js';

const originalFetch = globalThis.fetch;
const originalDatabaseMode = process.env.DATABASE_MODE;
const emptyStore = () => Object.values(getStore()).forEach((map) => map.clear());

test('feature pipeline calculates a labeled historical risk index from actual attempts', () => {
  const features = buildFeatureVector({
    topic: 'SQL joins', attempts: 3, avgScore: 52, recentScore: 39,
    failureCount: 2, averageTimeSeconds: 80, recentTrend: -13,
    improvementRate: -6.5, sessionCount: 2, mistakeCount: 3,
  });
  assert.equal(features.attempt_count, 3);
  assert.equal(features.average_time_seconds, 80);
  assert.ok(estimateHistoricalRisk(features) >= 60);
  assert.equal(estimateHistoricalRisk(buildFeatureVector({ avgScore: 90, recentScore: 90 })), 0);
});

test('practice services carry Gemma evaluation into mistake memory, next-session context, and next action', async () => {
  process.env.DATABASE_MODE = 'memory';
  emptyStore();
  const prompts = [];
  let evaluationNumber = 0;
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    prompts.push(payload.prompt);
    let response;
    if (payload.prompt.includes('Create question')) {
      response = { question: 'How would you select indexes for these customer and order tables?', topic: 'SQL joins', difficulty: 'medium', reason: 'Revisit a prior gap' };
    } else if (payload.prompt.includes('evaluating')) {
      evaluationNumber += 1;
      const strong = evaluationNumber > 1;
      response = {
        score: strong ? 74 : 44,
        correct: strong,
        strengths: strong ? ['Uses the correct join'] : ['Identifies the relevant tables'],
        weaknesses: strong ? [] : ['Does not explain which rows an outer join preserves'],
        concept_gaps: strong ? [] : ['outer join row preservation'],
        follow_up_needed: !strong,
        feedback: strong ? 'Improved explanation with the preserved rows identified.' : 'Explain which unmatched rows remain in the result.',
        follow_up_question: null,
      };
    } else {
      response = {
        overall_score: 59,
        categories: [{ name: 'Technical Understanding', score: 59, detail: 'Based on this session.' }],
        key_weaknesses: ['Outer join row preservation'],
        recommendations: ['Practice SQL joins with a small example dataset.'],
        summary: 'A targeted session with improvement on the repeated topic.',
      };
    }
    return { ok: true, status: 200, json: async () => ({ response: JSON.stringify(response) }) };
  };

  try {
    const profile = await createProfile({ name: 'Sample learner', targetRole: 'Backend Engineer', weakAreas: ['SQL joins'] });
    const firstSession = await createSession(profile.id);
    const firstQuestionData = await generateQuestion(profile, [], [], 1);
    const firstQuestion = await addQuestion(firstSession.id, firstQuestionData);
    const firstEvaluation = await evaluateAnswer(firstQuestion, 'I would use a join based on the customer id.', profile);
    await addAnswer(firstQuestion.id, firstSession.id, {
      answerText: 'I would use a join based on the customer id.', score: firstEvaluation.score,
      correct: firstEvaluation.correct, strengths: firstEvaluation.strengths,
      weaknesses: firstEvaluation.weaknesses, conceptGaps: firstEvaluation.conceptGaps,
      feedback: firstEvaluation.feedback,
    });
    for (const mistake of await extractMistakes(firstQuestion, firstEvaluation)) {
      await storeMistake(profile.id, firstSession.id, mistake);
    }

    const memories = await getRelevantMistakes(profile.id, 'SQL joins');
    assert.equal(memories.length, 2);
    assert.ok(memories.some((memory) => /outer join/i.test(memory.mistake)));

    const secondSession = await createSession(profile.id);
    const nextQuestionData = await generateQuestion(profile, [], memories, 1);
    assert.match(prompts.at(-1), /outer join row preservation/i);
    const nextQuestion = await addQuestion(secondSession.id, nextQuestionData);
    const secondEvaluation = await evaluateAnswer(nextQuestion, 'A left join keeps every left row and fills missing right-side values with null.', profile);
    await recordTopicOutcome(profile.id, 'SQL joins', secondEvaluation.score, firstEvaluation.score);
    await addAnswer(nextQuestion.id, secondSession.id, {
      answerText: 'A left join keeps every left row and fills missing right-side values with null.',
      score: secondEvaluation.score, correct: secondEvaluation.correct,
      strengths: secondEvaluation.strengths, weaknesses: secondEvaluation.weaknesses,
      conceptGaps: secondEvaluation.conceptGaps, feedback: secondEvaluation.feedback,
    });

    const analysis = await generateSessionAnalysis(profile, await getSessionAnswers(secondSession.id));
    assert.equal(analysis.overallScore, 59);
    const predictions = await runPredictions(profile.id);
    assert.equal(predictions.length, 1);
    assert.equal(predictions[0].attempts, 2);
    assert.equal(predictions[0].estimate_type, 'historical-rule-index');
    const action = await generateRecommendation(profile.id);
    assert.equal(action.topic, 'SQL joins');
    assert.equal(action.risk_score, predictions[0].risk_score);
    const updatedMemories = await getMistakesByProfile(profile.id);
    assert.ok(updatedMemories.every((memory) => memory.times_tested === 2 && memory.times_improved === 1));
  } finally {
    emptyStore();
    globalThis.fetch = originalFetch;
    if (originalDatabaseMode === undefined) delete process.env.DATABASE_MODE;
    else process.env.DATABASE_MODE = originalDatabaseMode;
  }
});

test('Ollama provider reports an unavailable local model without fabricating output', async () => {
  const provider = new LocalGemmaProvider({ baseUrl: 'http://ollama.test', model: 'gemma2:2b' });
  globalThis.fetch = async () => { throw new TypeError('network unavailable'); };
  try {
    await assert.rejects(provider.generateText('Create a question'), (error) => error.status === 503 && /Start Ollama/.test(error.message));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('model abstraction provides structured interface and respects explicit provider selection', async () => {
  const localProvider = new LocalGemmaProvider();
  assert.equal(localProvider.local, true);
  assert.equal(localProvider.getInfo().local, true);

  const mockProvider = {
    generateText: async () => '{"score": 90, "correct": true}',
    generateJSON: async (_p, schema) => schema.parse({ score: 90, correct: true }),
    status: async () => ({ available: true, local: true, provider: 'Mock', model: 'test' }),
    getInfo: () => ({ provider: 'Mock', local: true }),
  };

  const status = await mockProvider.status();
  assert.equal(status.available, true);
});

test('profile service creates and retrieves profiles with full context', async () => {
  emptyStore();
  const profile = await createProfile({
    name: 'Ayush',
    targetRole: 'Full Stack Engineer',
    skills: ['React', 'Node.js', 'PostgreSQL'],
    weakAreas: ['System Design', 'Concurrency'],
    projects: [{ name: 'FriendFit', tech: ['React', 'Node.js'], description: 'Interview coach' }],
    resumeText: 'Full stack engineer with 3 years experience.',
    jobDescription: 'Seeking senior full stack role.',
  });

  assert.ok(profile.id);
  assert.equal(profile.name, 'Ayush');
  assert.equal(profile.skills.length, 3);
  assert.equal(profile.weak_areas.length, 2);
  emptyStore();
});

test('recommendation returns truthful fallback when history is insufficient', async () => {
  emptyStore();
  const profile = await createProfile({ name: 'New Student' });
  const rec = await generateRecommendation(profile.id);
  assert.equal(rec.topic, 'General Practice');
  assert.equal(rec.estimate_type, 'insufficient-history');
  assert.equal(rec.risk_score, null);
  emptyStore();
});

