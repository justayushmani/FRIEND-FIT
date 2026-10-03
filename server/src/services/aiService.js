import { z } from 'zod';
import { getModelProvider } from '../ai/modelProvider.js';

const QuestionSchema = z.object({
  question: z.string().min(12),
  topic: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  reason: z.string().min(1),
});

const EvaluationSchema = z.object({
  score: z.number().min(0).max(100),
  correct: z.boolean(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  concept_gaps: z.array(z.string()),
  follow_up_needed: z.boolean(),
  feedback: z.string().min(1),
  follow_up_question: z.string().optional().nullable(),
});

const AnalysisSchema = z.object({
  overall_score: z.number().min(0).max(100),
  categories: z.array(z.object({
    name: z.string().min(1), score: z.number().min(0).max(100), detail: z.string(),
  })).min(1),
  key_weaknesses: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string().min(1),
});

const provider = () => getModelProvider();

export async function generateQuestion(profile, sessionHistory, mistakes, questionNumber) {
  const memory = mistakes.length
    ? `\nPREVIOUS WEAKNESSES TO REVISIT WHEN RELEVANT:\n${mistakes.map((m) => `- ${m.topic}: ${m.mistake} (${m.severity})`).join('\n')}`
    : '';
  const history = sessionHistory.length
    ? `\nCURRENT SESSION:\n${sessionHistory.map((h, i) => `Q${i + 1}: ${h.question}\nAnswer: ${h.answer}\nScore: ${h.score}/100`).join('\n\n')}`
    : '';
  const prompt = `You are FriendFit, an interview coach. Create question ${questionNumber} for ${profile.name}, preparing for ${profile.target_role || 'a software engineering'} role.
Skills: ${(profile.skills || []).join(', ') || 'unspecified'}
Weak areas: ${(profile.weak_areas || []).join(', ') || 'unspecified'}
Projects: ${JSON.stringify(profile.projects || [])}
${profile.resume_text ? `Resume context: ${profile.resume_text.slice(0, 500)}` : ''}
${profile.job_description ? `Job context: ${profile.job_description.slice(0, 300)}` : ''}
${memory}${history}
Ask one specific, open-ended technical interview question. Adapt difficulty to prior answers and target a relevant recurring weakness when appropriate. Return JSON with question, topic, difficulty (easy, medium, or hard), and reason.`;
  return provider().generateJSON(prompt, QuestionSchema, { temperature: 0.5 });
}

export async function evaluateAnswer(question, answer, profile) {
  const prompt = `You are FriendFit, a fair and specific interview coach evaluating ${profile.name} for ${profile.target_role || 'a software engineering'}.
Question: ${question.question_text || question.question}
Topic: ${question.topic_name || question.topic}; difficulty: ${question.difficulty}
Answer: ${answer}
Score this answer from 0 to 100 based on correctness, reasoning, specificity, and completeness. Do not reward length by itself. Return JSON with score, correct, strengths (array), weaknesses (array), concept_gaps (array), follow_up_needed, feedback (2-3 concise sentences), and optional follow_up_question.`;
  const result = await provider().generateJSON(prompt, EvaluationSchema, { temperature: 0.2 });
  return {
    score: result.score,
    correct: result.correct,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    conceptGaps: result.concept_gaps,
    followUpNeeded: result.follow_up_needed,
    feedback: result.feedback,
    followUpQuestion: result.follow_up_question || null,
  };
}

export async function generateSessionAnalysis(profile, answers) {
  const answerSummary = answers.map((a, i) =>
    `Q${i + 1} [${a.topic_name || 'general'}]: ${a.score}/100 — ${a.feedback || 'No feedback'}`
  ).join('\n');
  const prompt = `Summarize ${profile.name}'s practice session using only this evidence:\n${answerSummary}\nReturn JSON with overall_score (0-100), categories (name, score 0-100, detail), key_weaknesses, recommendations, and a concise summary.`;
  const result = await provider().generateJSON(prompt, AnalysisSchema, { temperature: 0.2 });
  return {
    overallScore: result.overall_score,
    categories: result.categories,
    keyWeaknesses: result.key_weaknesses,
    recommendations: result.recommendations,
    summary: result.summary,
  };
}

// Mistake extraction uses the model's already validated evaluation, avoiding a second inference.
export async function extractMistakes(question, evaluation) {
  if (evaluation.score >= 80 && evaluation.weaknesses.length === 0 && evaluation.conceptGaps.length === 0) return [];
  const topic = question.topic_name || question.topic || 'general';
  const gaps = [...new Set([...evaluation.conceptGaps, ...evaluation.weaknesses])].slice(0, 3);
  return gaps.map((gap) => ({
    topic,
    mistake: gap,
    severity: evaluation.score < 45 ? 'high' : evaluation.score < 65 ? 'medium' : 'low',
    recommendation: evaluation.feedback,
  }));
}

export async function generateEmbedding(text) {
  try {
    return await provider().generateEmbedding(text);
  } catch {
    return null;
  }
}

