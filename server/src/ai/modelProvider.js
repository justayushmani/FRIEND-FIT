// ============================================
// ModelProvider — Replaceable AI Abstraction
// ============================================
// This abstraction allows switching between:
// - Google AI Studio (Gemma) for hosted mode
// - Ollama (Gemma local) for private/local mode
// - Any future provider
//
// Business logic never directly calls a specific model API.
// ============================================

import { GoogleGenerativeAI } from '@google/generative-ai';

class BaseModelProvider {
  constructor(name) {
    this.name = name;
  }

  async generateText(prompt, options = {}) {
    throw new Error('generateText not implemented');
  }

  async generateJSON(prompt, schema, options = {}) {
    const text = await this.generateText(prompt, options);
    return this.parseJSON(text);
  }

  async generateEmbedding(text) {
    throw new Error('generateEmbedding not implemented');
  }

  parseJSON(text) {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      // Try to find JSON object/array in the text
      const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          // fall through
        }
      }
      throw new Error(`Failed to parse AI response as JSON: ${err.message}`);
    }
  }

  getInfo() {
    return { provider: this.name, local: false };
  }
}

// ============================================
// Google AI Studio Provider (Gemma via API)
// ============================================
class GoogleAIProvider extends BaseModelProvider {
  constructor(apiKey) {
    super('google-ai-studio');
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is required for GoogleAIProvider');
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = 'gemini-3.8-flash';
    this.fallbackModels = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash-lite'];
    this.embeddingModel = 'gemini-embedding-001';
  }

  async generateText(prompt, options = {}) {
    let lastError = null;
    for (const m of this.fallbackModels) {
      try {
        const model = this.client.getGenerativeModel({
          model: m,
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 2048,
            topP: options.topP ?? 0.9,
          }
        });
        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text();
      } catch (err) {
        lastError = err;
        console.warn(`[AI] Model ${m} failed: ${err.message}. Trying next model...`);
      }
    }
    throw lastError || new Error('All Gemini model fallbacks failed');
  }

  async generateJSON(prompt, schema, options = {}) {
    const jsonPrompt = `${prompt}

IMPORTANT: Respond with valid JSON only. No markdown, no explanation, no code fences.
The response must match this schema:
${JSON.stringify(schema, null, 2)}`;

    const text = await this.generateText(jsonPrompt, {
      ...options,
      temperature: options.temperature ?? 0.4,
    });
    return this.parseJSON(text);
  }

  async generateEmbedding(text) {
    const model = this.client.getGenerativeModel({ model: this.embeddingModel });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  getInfo() {
    return {
      provider: 'Google AI Studio',
      model: this.modelName,
      local: false,
      description: 'Gemma 3 27B (open-weight) via Google AI Studio'
    };
  }
}

// ============================================
// Local Ollama Provider (Gemma local, for future use)
// ============================================
class OllamaProvider extends BaseModelProvider {
  constructor(baseUrl = 'http://localhost:11434') {
    super('ollama-local');
    this.baseUrl = baseUrl;
    this.modelName = 'gemma2:2b';
  }

  async generateText(prompt, options = {}) {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelName,
        prompt,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 2048,
        }
      })
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data = await res.json();
    return data.response;
  }

  getInfo() {
    return {
      provider: 'Ollama (Local)',
      model: this.modelName,
      local: true,
      description: 'Gemma 2B running locally via Ollama — fully private'
    };
  }
}

// ============================================
// Provider Factory
// ============================================
let _provider = null;

export function getModelProvider() {
  if (_provider) return _provider;

  const mode = process.env.AI_MODE || 'hosted';

  if (mode === 'local') {
    _provider = new OllamaProvider();
  } else {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      console.warn('[AI] No GOOGLE_AI_API_KEY set. AI features will be unavailable.');
      return null;
    }
    _provider = new GoogleAIProvider(apiKey);
  }

  console.log(`[AI] Using provider: ${_provider.getInfo().provider}`);
  return _provider;
}

export { BaseModelProvider, GoogleAIProvider, OllamaProvider };
