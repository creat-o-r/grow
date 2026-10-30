/**
 * Universal Free-LLM Router (Cloud Free Tiers + Browser Built-in AI + Local Ollama)
 *
 * Maximizes all zero-cost LLM providers while keeping Vercel Hobby serverless usage near zero:
 * 1. Browser Built-in AI (`LanguageModel` Prompt API / Gemini Nano) — $0 server cost, runs on-device.
 * 2. Local Ollama / LM Studio (`http://localhost:11434/v1`) — $0 server cost, runs on local GPU.
 * 3. Google Gemini Free Tier (`gemini-3.8-flash` -> `gemini-3.5-flash-lite` -> `gemini-2.5-flash`).
 * 4. Groq Free Tier (`llama-3.3-70b-versatile`).
 * 5. OpenRouter `:free` Model Pool (`meta-llama/llama-3.3-70b-instruct:free`, `google/gemma-3-27b-it:free`).
 */

const CACHE_PREFIX = 'grow_ai_cache_v1:';
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes conservative TTL

function normalizeCacheKey(taskKey: string, prompt: string): string {
  const normalized = prompt.trim().toLowerCase().replace(/\s+/g, ' ');
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `${CACHE_PREFIX}${taskKey}:${hash}`;
}

export function getCachedAiResult<T>(taskKey: string, prompt: string): T | null {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(normalizeCacheKey(taskKey, prompt));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(normalizeCacheKey(taskKey, prompt));
      return null;
    }
    return parsed.data as T;
  } catch {
    return null;
  }
}

export function setCachedAiResult<T>(taskKey: string, prompt: string, data: T): void {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      normalizeCacheKey(taskKey, prompt),
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Attempts on-device inference via the browser's Built-in AI Prompt API (`LanguageModel`),
 * following web platform best practices:
 * - Checks `'LanguageModel' in self` and `LanguageModel.availability() !== 'unavailable'`
 * - Sets system instructions via `initialPrompts` during `LanguageModel.create()`
 * - Passes plain JSON Schema object via `responseConstraint`
 * - Always calls `session.destroy()` to release device memory
 */
export async function tryBrowserBuiltInAi<T>(options: {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema?: Record<string, any>;
  signal?: AbortSignal;
}): Promise<{ output: T; modelUsed: string } | null> {
  if (typeof self === 'undefined' || !('LanguageModel' in self)) {
    return null;
  }

  const LM = (self as any).LanguageModel;
  try {
    const availability = await LM.availability();
    if (availability === 'unavailable') {
      return null;
    }

    const session = await LM.create({
      initialPrompts: [{ role: 'system', content: options.systemPrompt }],
    });

    try {
      const promptOpts: Record<string, any> = {};
      if (options.jsonSchema) {
        // Pass schema as a plain object — do not JSON.stringify() it first
        promptOpts.responseConstraint = options.jsonSchema;
      }
      if (options.signal) {
        promptOpts.signal = options.signal;
      }

      const rawText: string = await session.prompt(options.userPrompt, promptOpts);
      const parsed = JSON.parse(rawText) as T;
      return { output: parsed, modelUsed: 'browser/gemini-nano-built-in' };
    } finally {
      session.destroy();
    }
  } catch {
    return null;
  }
}

/**
 * Calls an OpenAI-compatible JSON endpoint (used for Groq Free Tier, OpenRouter `:free` models, and Local Ollama).
 */
export async function callOpenAiCompatibleFreeEndpoint<T>(options: {
  endpointUrl: string;
  apiKey?: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}): Promise<{ output: T; modelUsed: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.apiKey) {
      headers['Authorization'] = `Bearer ${options.apiKey}`;
    }

    const res = await fetch(options.endpointUrl, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `${options.systemPrompt}\nAlways respond with valid JSON matching the requested fields.`,
          },
          { role: 'user', content: options.userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI-compatible free endpoint');
    }

    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned) as T;
    if (typeof parsed === 'object' && parsed !== null) {
      (parsed as any)._modelUsed = options.model;
    }
    return { output: parsed, modelUsed: options.model };
  } finally {
    clearTimeout(timeout);
  }
}
