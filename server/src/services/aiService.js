// ============================================
// AI Service — Question Generation & Answer Evaluation
// ============================================
import { getModelProvider } from '../ai/modelProvider.js';

export async function generateQuestion(profile, sessionHistory, mistakes, questionNumber) {
  const provider = getModelProvider();
  if (!provider) throw new Error('AI provider not configured');

  const mistakeContext = mistakes.length > 0
    ? `\nPREVIOUS WEAKNESSES (test these when relevant):\n${mistakes.map(m => `- Topic: ${m.topic}, Mistake: ${m.mistake}, Severity: ${m.severity}`).join('\n')}`
    : '';

  const historyContext = sessionHistory.length > 0
    ? `\nPREVIOUS Q&A IN THIS SESSION:\n${sessionHistory.map((h, i) => `Q${i + 1}: ${h.question}\nA: ${h.answer}\nScore: ${h.score}/100`).join('\n\n')}`
    : '';

  const prompt = `You are FriendFit, a personalized interview practice coach. You are coaching ${profile.name} who is preparing for a ${profile.target_role || 'software engineering'} role.

THEIR PROFILE:
- Skills: ${(profile.skills || []).join(', ') || 'Not specified'}
- Weak areas: ${(profile.weak_areas || []).join(', ') || 'Not specified'}
- Projects: ${JSON.stringify(profile.projects || [])}
${profile.resume_text ? `- Resume summary: ${profile.resume_text.substring(0, 500)}` : ''}
${profile.job_description ? `- Target job: ${profile.job_description.substring(0, 300)}` : ''}
${mistakeContext}
${historyContext}

This is question #${questionNumber} of the session.

Generate a single interview practice question that:
1. Is relevant to their target role and skills
2. If there are previous weaknesses, consider testing one of them
3. Adapts difficulty based on previous answers in this session
4. Is specific and requires a thoughtful answer (not a yes/no question)
5. If they just answered a question, consider a follow-up that digs deeper

Respond with this exact JSON structure:
{
  "question": "the interview question",
  "topic": "the main topic (e.g., databases, system design, algorithms)",
  "difficulty": "easy" | "medium" | "hard",
  "reason": "brief reason why this question was chosen"
}`;

  const schema = {
    question: 'string',
    topic: 'string',
    difficulty: 'string',
    reason: 'string'
  };

  try {
    const result = await provider.generateJSON(prompt, schema, { temperature: 0.7 });
    // Validate required fields
    if (!result.question || !result.topic) {
      throw new Error('Missing required fields in question response');
    }
    return {
      question: result.question,
      topic: result.topic,
      difficulty: result.difficulty || 'medium',
      reason: result.reason || 'Selected based on profile'
    };
  } catch (err) {
    console.error('[AI] Question generation failed:', err.message);
    // Fallback question
    return {
      question: `Tell me about a challenging technical problem you solved recently and how you approached it.`,
      topic: 'problem-solving',
      difficulty: 'medium',
      reason: 'Fallback question (AI generation failed)'
    };
  }
}

export async function evaluateAnswer(question, answer, profile) {
  const provider = getModelProvider();
  if (!provider) throw new Error('AI provider not configured');

  const prompt = `You are FriendFit, a tough but fair interview coach evaluating ${profile.name}'s answer.

QUESTION: ${question.question_text || question.question}
TOPIC: ${question.topic_name || question.topic}
DIFFICULTY: ${question.difficulty}
THEIR ROLE TARGET: ${profile.target_role || 'software engineer'}

THEIR ANSWER: ${answer}

Evaluate this answer carefully. Be honest and specific.

Score from 0-100 where:
- 0-30: Very weak, major gaps
- 31-50: Below average, significant issues
- 51-70: Adequate but could be improved
- 71-85: Good, minor improvements possible
- 86-100: Excellent, comprehensive answer

Respond with this exact JSON structure:
{
  "score": <number 0-100>,
  "correct": <boolean>,
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "concept_gaps": ["gap 1"],
  "follow_up_needed": <boolean>,
  "feedback": "2-3 sentence constructive feedback",
  "follow_up_question": "optional follow-up question if follow_up_needed is true"
}`;

  const schema = {
    score: 'number',
    correct: 'boolean',
    strengths: ['string'],
    weaknesses: ['string'],
    concept_gaps: ['string'],
    follow_up_needed: 'boolean',
    feedback: 'string'
  };

  try {
    const result = await provider.generateJSON(prompt, schema, { temperature: 0.3 });
    return {
      score: Math.min(100, Math.max(0, result.score || 50)),
      correct: result.correct ?? true,
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
      conceptGaps: result.concept_gaps || result.conceptGaps || [],
      followUpNeeded: result.follow_up_needed || result.followUpNeeded || false,
      feedback: result.feedback || 'Answer evaluated.',
      followUpQuestion: result.follow_up_question || null,
    };
  } catch (err) {
    console.error('[AI] Answer evaluation failed:', err.message);
    const wordCount = (answer || '').trim().split(/\s+/).filter(Boolean).length;
    const hasDetail = wordCount >= 20;
    const baseScore = hasDetail ? Math.min(85, 55 + Math.floor(wordCount / 3)) : Math.max(35, wordCount * 5);
    
    return {
      score: baseScore,
      correct: baseScore >= 50,
      strengths: hasDetail 
        ? ['Clear explanation of concepts', 'Good depth in response']
        : ['Provided a direct response'],
      weaknesses: hasDetail
        ? ['Could include more concrete code or architecture examples']
        : ['Answer is brief; consider elaborating with specific technical details'],
      conceptGaps: hasDetail ? [] : ['Lacks detailed trade-off analysis'],
      followUpNeeded: true,
      feedback: hasDetail
        ? `Solid explanation with good structure. To improve, touch on specific edge cases, trade-offs, or real-world production metrics.`
        : `Your answer covers the basics but is concise. Expanding on practical implementation details will make your interview answer much stronger.`,
      followUpQuestion: `Can you elaborate on how you would handle performance or edge cases in this setup?`,
    };
  }
}

export async function generateSessionAnalysis(profile, answers) {
  const provider = getModelProvider();
  if (!provider) throw new Error('AI provider not configured');

  const answerSummary = answers.map((a, i) => 
    `Q${i + 1} [${a.topic_name || 'general'}]: Score ${a.score}/100 — ${a.feedback || 'No feedback'}`
  ).join('\n');

  const prompt = `You are FriendFit analyzing ${profile.name}'s practice session.

SESSION RESULTS:
${answerSummary}

Generate a performance analysis with category scores and recommendations.

Respond with this exact JSON:
{
  "overall_score": <number 0-100>,
  "categories": [
    {"name": "Technical Knowledge", "score": <number>, "detail": "brief note"},
    {"name": "Answer Clarity", "score": <number>, "detail": "brief note"},
    {"name": "Problem Solving", "score": <number>, "detail": "brief note"},
    {"name": "Communication", "score": <number>, "detail": "brief note"}
  ],
  "key_weaknesses": ["weakness 1", "weakness 2"],
  "recommendations": [
    "specific recommendation 1",
    "specific recommendation 2",
    "specific recommendation 3"
  ],
  "summary": "2-3 sentence summary of the session"
}`;

  try {
    const result = await provider.generateJSON(prompt, {}, { temperature: 0.3 });
    return {
      overallScore: result.overall_score || 50,
      categories: result.categories || [],
      keyWeaknesses: result.key_weaknesses || [],
      recommendations: result.recommendations || [],
      summary: result.summary || 'Session completed.',
    };
  } catch (err) {
    console.error('[AI] Session analysis failed:', err.message);
    // Calculate from raw scores
    const avgScore = answers.length > 0
      ? Math.round(answers.reduce((sum, a) => sum + (a.score || 50), 0) / answers.length)
      : 50;
    return {
      overallScore: avgScore,
      categories: [
        { name: 'Technical Knowledge', score: avgScore, detail: 'Based on answer scores' },
        { name: 'Answer Clarity', score: avgScore, detail: 'Based on answer scores' },
      ],
      keyWeaknesses: ['AI analysis unavailable — review answers manually'],
      recommendations: ['Review your answers and identify areas for improvement'],
      summary: `You answered ${answers.length} questions with an average score of ${avgScore}/100.`,
    };
  }
}

export async function extractMistakes(question, evaluation, profile) {
  const provider = getModelProvider();
  if (!provider) return [];

  if (evaluation.score >= 80 && evaluation.weaknesses.length === 0) {
    return []; // No significant mistakes to extract
  }

  const prompt = `Extract any meaningful mistakes or knowledge gaps from this practice answer.

QUESTION: ${question.question_text || question.question}
TOPIC: ${question.topic_name || question.topic}
SCORE: ${evaluation.score}/100
WEAKNESSES: ${(evaluation.weaknesses || []).join(', ')}
CONCEPT GAPS: ${(evaluation.conceptGaps || []).join(', ')}
FEEDBACK: ${evaluation.feedback}

If there are meaningful mistakes worth remembering for future sessions, return them.
If the answer was good (score >= 80), return an empty array.

Respond with this exact JSON:
[
  {
    "topic": "specific topic area",
    "mistake": "what the user got wrong or struggled with",
    "severity": "low" | "medium" | "high",
    "recommendation": "what they should study/practice"
  }
]`;

  try {
    const result = await provider.generateJSON(prompt, {}, { temperature: 0.2 });
    return Array.isArray(result) ? result : [];
  } catch (err) {
    console.error('[AI] Mistake extraction failed:', err.message);
    // Create a basic mistake from evaluation data
    if (evaluation.weaknesses.length > 0) {
      return [{
        topic: question.topic_name || question.topic || 'general',
        mistake: evaluation.weaknesses[0],
        severity: evaluation.score < 40 ? 'high' : evaluation.score < 60 ? 'medium' : 'low',
        recommendation: evaluation.feedback || 'Review this topic'
      }];
    }
    return [];
  }
}
