/**
 * List of Gemini models to try in order of capability and availability.
 * Primary model is Gemini 3.8 Flash ('googleai/gemini-3.8-flash').
 * If the primary model experiences high demand (503) or rate limiting (429),
 * it retries with backoff before cascading to fallback models.
 */
export const CANDIDATE_MODELS = [
  'googleai/gemini-3.8-flash',
  'googleai/gemini-3.5-flash-lite',
  'googleai/gemini-2.5-flash',
  'googleai/gemini-1.5-flash',
];

// Timeout per individual model attempt to avoid hanging for 300s on Node fetch headersTimeout
const MODEL_ATTEMPT_TIMEOUT_MS = 25000;

export async function executeWithModelFallback<T>(
  actionName: string,
  promptCaller: (modelName: string) => Promise<{ output?: T | null }>
): Promise<T> {
  let lastError: any = null;

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

  const cleanMessage = lastError?.message || String(lastError);
  throw new Error(`AI generation failed: ${cleanMessage}`);
}
