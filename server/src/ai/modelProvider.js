import { GoogleGenerativeAI } from '@google/generative-ai';

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const GEMMA_MODEL = process.env.GEMMA_MODEL || 'gemma2:2b';

// ============================================
// Abstract Base Model Provider
// ============================================
export class BaseModelProvider {
  constructor(name, local = false) {
    if (new.target === BaseModelProvider) {
      throw new TypeError('Cannot construct BaseModelProvider instances directly');
    }
    this.name = name;
    this.local = local;
  }

  async generateText(prompt, options = {}) {
    throw new Error('generateText must be implemented by subclass');
  }

  async generateJSON(prompt, schema, options = {}) {
    throw new Error('generateJSON must be implemented by subclass');
  }

  async generateEmbedding(text) {
    return null;
  }

  async status() {
    return { available: false, local: this.local, provider: this.name, model: 'unknown' };
  }

  getInfo() {
    return { provider: this.name, local: this.local };
  }

  cleanJSONResponse(text) {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
      throw new Error('AI response did not contain a valid JSON object');
    }
  }
}

// ============================================
// Local Gemma Provider (via Ollama) — Default
// ============================================
export class LocalGemmaProvider extends BaseModelProvider {
  constructor({ baseUrl = OLLAMA_BASE_URL, model = GEMMA_MODEL } = {}) {
    super('Ollama (Local Gemma)', true);
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generateText(prompt, options = {}) {
    let response;
    try {
      response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(options.timeoutMs ?? 120_000),
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.4,
            num_predict: options.maxTokens ?? 1200,
          },
        }),
      });
    } catch (error) {
      const unavailable = new Error(
        error.name === 'TimeoutError' || error.name === 'AbortError'
          ? 'Local Gemma timed out. Check Ollama and try again.'
          : `Local Gemma is unavailable. Start Ollama and make sure ${this.model} is installed.`
      );
      unavailable.status = 503;
      throw unavailable;
    }
    if (!response.ok) {
      const unavailable = new Error(`Ollama returned HTTP ${response.status}. Check that ${this.model} is installed.`);
      unavailable.status = 503;
      throw unavailable;
    }
    const data = await response.json();
    if (typeof data.response !== 'string' || !data.response.trim()) {
      const empty = new Error('Local Gemma returned an empty response. Please try again.');
      empty.status = 502;
      throw empty;
    }
    return data.response.trim();
  }

  async generateJSON(prompt, schema, options = {}) {
    if (!schema || typeof schema.safeParse !== 'function') {
      throw new Error('Structured AI output requires a Zod schema.');
    }
    const text = await this.generateText(
      `${prompt}\n\nReturn only one valid JSON object matching the required fields. Do not include markdown or commentary.`,
      options,
    );
    let value;
    try {
      value = this.cleanJSONResponse(text);
    } catch {
      const invalid = new Error('Local Gemma returned invalid structured output. Please try again.');
      invalid.status = 502;
      throw invalid;
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      const incomplete = new Error('Local Gemma returned incomplete structured data. Please try again.');
      incomplete.status = 502;
      throw incomplete;
    }
    return parsed.data;
  }

  async generateEmbedding(text) {
    try {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({ model: this.model, prompt: text }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.embedding || null;
    } catch {
      return null;
    }
  }

  async status() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) return { available: false, local: true, provider: this.name, model: this.model };
      const data = await response.json();
      const installed = (data.models || []).some((m) => m.name === this.model || m.name.startsWith(`${this.model}:`));
      return { available: installed, local: true, provider: this.name, model: this.model };
    } catch {
      return { available: false, local: true, provider: this.name, model: this.model };
    }
  }

  getInfo() {
    return { provider: this.name, model: this.model, local: true };
  }
}

// ============================================
// Google AI Studio Provider (Explicit Optional)
// ============================================
export class GoogleAIProvider extends BaseModelProvider {
  constructor(apiKey = process.env.GOOGLE_AI_API_KEY, modelName = process.env.GOOGLE_AI_MODEL || 'gemini-3.8-flash') {
    super('Google AI Studio', false);
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is required for GoogleAIProvider');
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    this.embeddingModel = 'gemini-embedding-001';
  }

  async generateText(prompt, options = {}) {
    try {
      const model = this.client.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          temperature: options.temperature ?? 0.4,
          maxOutputTokens: options.maxTokens ?? 1200,
        },
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (!text || !text.trim()) {
        const empty = new Error('Google AI returned an empty response. Please try again.');
        empty.status = 502;
        throw empty;
      }
      return text.trim();
    } catch (err) {
      if (err.status) throw err;
      const error = new Error(`Google AI inference failed: ${err.message}`);
      error.status = 502;
      throw error;
    }
  }

  async generateJSON(prompt, schema, options = {}) {
    if (!schema || typeof schema.safeParse !== 'function') {
      throw new Error('Structured AI output requires a Zod schema.');
    }
    const text = await this.generateText(
      `${prompt}\n\nIMPORTANT: Return ONLY a valid JSON object matching the requested schema. No code fences, no markdown formatting, no commentary.`,
      options
    );
    let value;
    try {
      value = this.cleanJSONResponse(text);
    } catch {
      const invalid = new Error('Google AI returned invalid structured output. Please try again.');
      invalid.status = 502;
      throw invalid;
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      const incomplete = new Error(`Structured AI validation failed: ${parsed.error.issues.map(i => i.message).join(', ')}`);
      incomplete.status = 502;
      throw incomplete;
    }
    return parsed.data;
  }

  async generateEmbedding(text) {
    try {
      const model = this.client.getGenerativeModel({ model: this.embeddingModel });
      const result = await model.embedContent({
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      });
      return result.embedding?.values || null;
    } catch (err) {
      console.warn('[Embedding] Failed to generate embedding:', err.message);
      return null;
    }
  }

  async status() {
    try {
      const model = this.client.getGenerativeModel({ model: this.modelName });
      await model.generateContent('ping');
      return { available: true, local: false, provider: this.name, model: this.modelName };
    } catch {
      return { available: false, local: false, provider: this.name, model: this.modelName };
    }
  }

  getInfo() {
    return { provider: this.name, model: this.modelName, local: false };
  }
}

// ============================================
// Provider Factory
// ============================================
let providerInstance = null;

export function getModelProvider() {
  if (providerInstance) return providerInstance;

  const mode = (process.env.AI_PROVIDER || process.env.AI_MODE || 'local').toLowerCase().trim();

  if (mode === 'google' || mode === 'hosted') {
    if (!process.env.GOOGLE_AI_API_KEY) {
      console.warn('[AI] Hosted mode requested but GOOGLE_AI_API_KEY is not set. Defaulting to Local Gemma.');
      providerInstance = new LocalGemmaProvider();
    } else {
      providerInstance = new GoogleAIProvider();
    }
  } else {
    // Default: Local open-weight Gemma
    providerInstance = new LocalGemmaProvider();
  }

  return providerInstance;
}

export function setModelProvider(customProvider) {
  providerInstance = customProvider;
}

export async function getModelStatus() {
  return getModelProvider().status();
}
