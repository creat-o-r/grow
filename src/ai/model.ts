import { callOpenAiCompatibleFreeEndpoint } from './free-llm-router';

/**
 * List of Gemini models to try in order of capability and availability.
 * Primary model is Gemini 3.8 Flash ('googleai/gemini-3.8-flash').
 * If the primary model experiences high demand (503) or rate limiting (429),
 * it retries with backoff before cascading to fallback models and additional
 * free LLM tiers (Groq Free Tier, OpenRouter :free pool, and Local Ollama).
 */
export const CANDIDATE_MODELS = [
  'googleai/gemini-3.8-flash',
  'googleai/gemini-3.5-flash-lite',
  'googleai/gemini-2.5-flash',
  'googleai/gemini-1.5-flash',
];

export const FREE_EXTERNAL_MODELS = [
  {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'GROQ_API_KEY',
  },
  {
    provider: 'openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    envKey: 'OPENROUTER_API_KEY',
  },
  {
    provider: 'ollama-local',
    model: 'llama3.2',
    endpoint: process.env.OLLAMA_URL || 'http://localhost:11434/v1/chat/completions',
    envKey: '',
  },
];

// Timeout per individual model attempt to avoid hanging for 300s on Node fetch headersTimeout
const MODEL_ATTEMPT_TIMEOUT_MS = 25000;

export interface FallbackRouterOptions {
  hasGeminiKey?: boolean;
  systemPrompt?: string;
  userPrompt?: string;
  groqApiKey?: string;
  openrouterApiKey?: string;
  ollamaUrl?: string;
}

export async function executeWithModelFallback<T>(
  actionName: string,
  promptCaller: (modelName: string) => Promise<{ output?: T | null }>,
  routerOptions?: FallbackRouterOptions
): Promise<T> {
  let lastError: any = null;
  const shouldTryGemini = routerOptions?.hasGeminiKey !== false;

  if (shouldTryGemini) {
    for (const model of CANDIDATE_MODELS) {
    // For the primary model (gemini-3.8-flash), attempt up to 3 times on temporary 503/429 demand spikes
    const maxAttempts = model === 'googleai/gemini-3.8-flash' ? 3 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[${actionName}] Attempting with model: ${model}${maxAttempts > 1 ? ` (attempt ${attempt}/${maxAttempts})` : ''}...`);

        let timeoutHandle: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`Model ${model} timed out after ${MODEL_ATTEMPT_TIMEOUT_MS / 1000}s without response`));
          }, MODEL_ATTEMPT_TIMEOUT_MS);
        });

        try {
          const res = await Promise.race([
            promptCaller(model),
            timeoutPromise,
          ]);
          if (timeoutHandle) clearTimeout(timeoutHandle);

          if (res?.output) {
            console.log(`[${actionName}] Succeeded with model: ${model}`);
            if (typeof res.output === 'object' && res.output !== null) {
              (res.output as any)._modelUsed = model;
            }
            return res.output;
          }
        } finally {
          if (timeoutHandle) clearTimeout(timeoutHandle);
        }
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        const isTimeout = errorMsg.includes('timed out') || errorMsg.includes('TIMEOUT') || errorMsg.includes('HeadersTimeoutError');
        const isTemporarySpike = 
          !isTimeout && (
            errorMsg.includes('503') || 
            errorMsg.includes('429') || 
            errorMsg.includes('high demand') || 
            errorMsg.includes('RESOURCE_EXHAUSTED') || 
            errorMsg.includes('quota') ||
            errorMsg.includes('rate limit')
          );
        console.warn(`[${actionName}] Model ${model} (attempt ${attempt}) failed: ${errorMsg}`);
        lastError = err;

        if (isTemporarySpike && attempt < maxAttempts) {
          console.log(`[${actionName}] Temporary demand spike or rate limit on ${model}. Retrying in 2s (attempt ${attempt + 1}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }
        // On timeout or non-retryable error, immediately fall back to the next candidate model
        break;
      }
    }
  }
  }

  // Secondary Free-Tier Pool (Groq Free Tier, OpenRouter :free, Local Ollama)
  if (routerOptions?.userPrompt) {
    const sys = routerOptions.systemPrompt || 'You are an expert horticulturalist and plant data assistant.';
    for (const ext of FREE_EXTERNAL_MODELS) {
      const apiKey =
        ext.provider === 'groq'
          ? routerOptions.groqApiKey || process.env.GROQ_API_KEY
          : ext.provider === 'openrouter'
          ? routerOptions.openrouterApiKey || process.env.OPENROUTER_API_KEY
          : undefined;

      if (ext.provider !== 'ollama-local' && !apiKey) continue;

      try {
        const endpointUrl =
          ext.provider === 'ollama-local' && routerOptions.ollamaUrl
            ? `${routerOptions.ollamaUrl.replace(/\/$/, '')}/v1/chat/completions`
            : ext.endpoint;
        console.log(`[${actionName}] Attempting free fallback provider: ${ext.provider}/${ext.model}...`);
        const res = await callOpenAiCompatibleFreeEndpoint<T>({
          endpointUrl,
          apiKey,
          model: ext.model,
          systemPrompt: sys,
          userPrompt: routerOptions.userPrompt,
        });
        return res.output;
      } catch (extErr: any) {
        console.warn(`[${actionName}] Free fallback ${ext.provider}/${ext.model} failed: ${extErr?.message}`);
        lastError = extErr;
      }
    }
  }

  const cleanMessage = lastError?.message || String(lastError);
  throw new Error(`AI generation failed: ${cleanMessage}`);
}
