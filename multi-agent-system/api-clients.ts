/**
 * ═══════════════════════════════════════════════════════════════════════════
 * API CLIENTS — Production-grade with retry, timeout, rate limiting
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { loadAndValidateConfig, safeJsonParse } from './config';

const { config } = loadAndValidateConfig();

// ═══ RETRY + TIMEOUT WRAPPER ═══

interface FetchOptions {
  maxRetries?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
}

async function robustFetch(url: string, init: RequestInit, options: FetchOptions = {}): Promise<Response> {
  const { maxRetries = 2, timeoutMs = 30000, retryDelayMs = 1000 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) return response;

      // Rate limited — wait and retry
      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '5') * 1000;
        await sleep(Math.max(retryAfter, retryDelayMs * (attempt + 1)));
        continue;
      }

      // Server error — retry
      if (response.status >= 500 && attempt < maxRetries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      // Client error — don't retry
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);

    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        if (attempt < maxRetries) { await sleep(retryDelayMs); continue; }
        throw new Error(`Request timed out after ${timeoutMs}ms (${maxRetries + 1} attempts)`);
      }
      if (attempt < maxRetries) { await sleep(retryDelayMs); continue; }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══ GEMINI API ═══

export async function callGemini(
  prompt: string,
  options: {
    model?: 'pro' | 'flash' | 'lite';
    image?: string;
    imageMimeType?: string;
    jsonMode?: boolean;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  if (!config.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const modelName = config.gemini.models[options.model || 'flash'];
  const url = `${config.gemini.baseUrl}/models/${modelName}:generateContent?key=${config.gemini.apiKey}`;

  const parts: any[] = [];
  if (options.image) {
    parts.push({ inlineData: { mimeType: options.imageMimeType || 'image/jpeg', data: options.image } });
  }
  parts.push({ text: prompt });

  const body: any = {
    contents: [{ parts }],
    generationConfig: {
      temperature: options.temperature ?? 0.1,
      maxOutputTokens: options.maxTokens || 4096,
    },
  };
  if (options.jsonMode) {
    body.generationConfig.responseMimeType = 'application/json';
  }

  // Safety settings — allow forensic content
  body.safetySettings = [
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  ];

  const response = await robustFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, { timeoutMs: options.model === 'pro' ? 60000 : 30000 });

  const data = await response.json();

  // Handle blocked responses
  if (data.candidates?.[0]?.finishReason === 'SAFETY') {
    throw new Error('Gemini blocked response due to safety filters — forensic content flagged');
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini returned empty response. Raw: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return text;
}

// ═══ FEATHERLESS API (OpenAI-compatible) ═══

export async function callFeatherless(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options: { maxTokens?: number; temperature?: number; jsonMode?: boolean } = {}
): Promise<string> {
  if (!config.featherless.apiKey) {
    throw new Error('FEATHERLESS_API_KEY not configured');
  }

  const response = await robustFetch(`${config.featherless.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.featherless.apiKey}`,
    },
    body: JSON.stringify({
      model: config.featherless.model,
      messages,
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.3,
      // response_format not supported by Qwen/Featherless — JSON enforced via system prompt instead
    }),
  }, { timeoutMs: 45000 });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Featherless returned empty response. Model: ${config.featherless.model}`);
  }
  return content;
}

// ═══ HUGGINGFACE INFERENCE API ═══

async function callHF(model: string, payload: any): Promise<any> {
  if (!config.huggingface.token) {
    throw new Error('HF_TOKEN not configured');
  }

  const response = await robustFetch(`${config.huggingface.baseUrl}/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.huggingface.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, { timeoutMs: 30000, maxRetries: 1 });

  return await response.json();
}

export async function callHuggingFaceNER(text: string): Promise<{ entity_group: string; score: number; word: string; start: number; end: number }[]> {
  const result = await callHF(config.huggingface.models.ner, { inputs: text.slice(0, 2000) });
  return Array.isArray(result) ? result : [];
}

export async function callHuggingFaceZeroShot(text: string, labels: string[]): Promise<{ labels: string[]; scores: number[] }> {
  const result = await callHF(config.huggingface.models.zeroShot, {
    inputs: text.slice(0, 1000),
    parameters: { candidate_labels: labels, multi_label: true },
  });
  return result || { labels: [], scores: [] };
}

export async function callHuggingFaceEmbeddings(texts: string[]): Promise<number[][]> {
  const result = await callHF(config.huggingface.models.embeddings, {
    inputs: texts.slice(0, 20).map(t => t.slice(0, 500)),
  });
  return Array.isArray(result) ? result : [];
}

// ═══ AVAILABILITY CHECK ═══

export function getAvailableProviders(): { gemini: boolean; featherless: boolean; huggingface: boolean } {
  return {
    gemini: !!config.gemini.apiKey,
    featherless: !!config.featherless.apiKey,
    huggingface: !!config.huggingface.token,
  };
}
