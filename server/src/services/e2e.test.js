import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../index.js';
import { getStore } from '../db/memoryStore.js';
import { setModelProvider } from '../ai/modelProvider.js';

test('Full end-to-end user journey: Profile -> Practice -> Memory -> Recommendation -> Second Session', async () => {
  // Use mock provider to simulate deterministic AI responses for E2E
  const mockAI = {
    generateText: async () => 'mock response',
    generateJSON: async (prompt, schema) => {
      if (prompt.includes('Create question')) {
        const isSecondSession = prompt.includes('PREVIOUS WEAKNESSES');
        return schema.parse({
          question: isSecondSession
            ? 'In your prior session you struggled with SQL joins. Can you explain LEFT JOIN row preservation with an example?'
            : 'How do relational databases optimize queries involving multiple tables?',
          topic: 'SQL joins',
          difficulty: 'medium',
          reason: isSecondSession ? 'Targeting previous weakness from mistake ledger' : 'Initial diagnostic question',
        });
      }
      if (prompt.includes('evaluating')) {
        const isImproved = prompt.includes('preserves all rows');
        return schema.parse({
          score: isImproved ? 85 : 45,
          correct: isImproved,
          strengths: isImproved ? ['Correctly explains row preservation'] : ['Mentions tables'],
          weaknesses: isImproved ? [] : ['Fails to explain which rows are kept'],
          concept_gaps: isImproved ? [] : ['outer-join-row-preservation'],
          follow_up_needed: !isImproved,
          feedback: isImproved ? 'Great explanation of LEFT JOIN semantics.' : 'Review which unmatched rows remain.',
          follow_up_question: null,
        });
      }
      if (prompt.includes('Summarize')) {
        return schema.parse({
          overall_score: 55,
          categories: [
            { name: 'Technical Depth', score: 50, detail: 'Needs improvement in SQL' },
            { name: 'Clarity', score: 60, detail: 'Clear communication' },
          ],
          key_weaknesses: ['SQL outer join mechanics'],
          recommendations: ['Practice writing SQL joins with example schemas'],
          summary: 'Session highlighted gaps in SQL join semantics.',
        });
      }
      throw new Error(`Unexpected prompt: ${prompt}`);
    },
    generateEmbedding: async () => new Array(768).fill(0.01),
    status: async () => ({ available: true, local: true, provider: 'MockGemma', model: 'gemma2:2b' }),
    getInfo: () => ({ provider: 'MockGemma', model: 'gemma2:2b', local: true }),
  };

  setModelProvider(mockAI);
  process.env.DATABASE_MODE = 'memory';
  Object.values(getStore()).forEach((map) => map.clear());

  // 1. Health check
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    const healthRes = await fetch(`${baseUrl}/health`).then((r) => r.json());
    assert.equal(healthRes.status, 'ok');
    assert.ok(healthRes.ai);

    // 2. Profile creation
    const profileRes = await fetch(`${baseUrl}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex Friend',
        targetRole: 'Full Stack Engineer',
        skills: ['React', 'Node.js', 'SQL'],
        weakAreas: ['SQL joins'],
      }),
    }).then((r) => r.json());
    assert.ok(profileRes.id);
    assert.equal(profileRes.name, 'Alex Friend');

    // 3. Start Session 1
    const session1Res = await fetch(`${baseUrl}/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: profileRes.id, sessionType: 'interview' }),
    }).then((r) => r.json());
    assert.ok(session1Res.id);

    // 4. Request Question 1
    const q1Res = await fetch(`${baseUrl}/session/${session1Res.id}/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then((r) => r.json());
    assert.ok(q1Res.question_text);
    assert.equal(q1Res.topic_name, 'SQL joins');

    // 5. Submit Answer with weakness
    const a1Res = await fetch(`${baseUrl}/session/${session1Res.id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: q1Res.id,
        answerText: 'I would just join them together on id.',
        timeTaken: 30,
      }),
    }).then((r) => r.json());
    assert.equal(a1Res.evaluation.score, 45);
    assert.equal(a1Res.evaluation.correct, false);

    // 6. End Session 1
    const end1Res = await fetch(`${baseUrl}/session/${session1Res.id}/end`, {
      method: 'POST',
    }).then((r) => r.json());
    assert.equal(end1Res.questionsAnswered, 1);

    // 7. Get Analysis
    const analysisRes = await fetch(`${baseUrl}/analysis/session/${session1Res.id}`).then((r) => r.json());
    assert.equal(analysisRes.overallScore, 55);
    assert.equal(analysisRes.categories.length, 2);

    // 8. Verify Mistake Memory
    const mistakesRes = await fetch(`${baseUrl}/memory/${profileRes.id}`).then((r) => r.json());
    assert.ok(mistakesRes.length >= 1);
    assert.equal(mistakesRes[0].topic, 'SQL joins');
    assert.ok(mistakesRes.some((m) => m.mistake.includes('outer-join')));

    // 9. Verify Next Best Action (NBA)
    const nbaRes = await fetch(`${baseUrl}/recommend/${profileRes.id}`).then((r) => r.json());
    assert.equal(nbaRes.topic, 'SQL joins');
    assert.ok(nbaRes.action.includes('SQL joins'));

    // 10. Start Session 2 targeting that recommendation
    const session2Res = await fetch(`${baseUrl}/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: profileRes.id,
        sessionType: 'targeted-drill',
        targetTopic: 'SQL joins',
      }),
    }).then((r) => r.json());
    assert.ok(session2Res.id);

    // 11. Request Question 2: Memory carries over and targets weakness!
    const q2Res = await fetch(`${baseUrl}/session/${session2Res.id}/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'SQL joins' }),
    }).then((r) => r.json());
    assert.ok(q2Res.question_text.includes('prior session you struggled with SQL joins'));

    // 12. Submit improved answer
    const a2Res = await fetch(`${baseUrl}/session/${session2Res.id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: q2Res.id,
        answerText: 'A LEFT JOIN preserves all rows from the left table and fills missing right table columns with NULL.',
        timeTaken: 40,
      }),
    }).then((r) => r.json());
    assert.equal(a2Res.evaluation.score, 85);
    assert.equal(a2Res.evaluation.correct, true);

    // 13. Verify demo seeding endpoint
    const demoRes = await fetch(`${baseUrl}/demo/seed`, { method: 'POST' }).then((r) => r.json());
    assert.equal(demoRes.success, true);
    assert.equal(demoRes.profileId, 'demo-user-001');
  } finally {
    server.close();
    Object.values(getStore()).forEach((map) => map.clear());
  }
});
