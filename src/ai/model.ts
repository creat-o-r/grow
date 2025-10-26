
'use server';

import { ApiKeys } from './genkit';

/**
 * Gets a prioritized list of AI models based on the available API keys.
 */
export async function getModels(apiKeys?: ApiKeys): Promise<string[]> {
  const models: string[] = [];

  const groqApiKey = apiKeys?.groq || process.env.GROQ_API_KEY;
  if (groqApiKey) {
    models.push('groq/gemma-7b-it');
  }

  const openaiApiKey = apiKeys?.openai || process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    models.push('openai/gpt-4o', 'openai/gpt-3.5-turbo');
  }

  const geminiApiKey = apiKeys?.gemini || process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    models.push('googleai/gemini-1.5-flash');
  }

  const openRouterApiKey =
    apiKeys?.openrouter || process.env.OPENROUTER_API_KEY;
  if (openRouterApiKey) {
    models.push(
      'openrouter-google/gemma-2-9b-it:free',
      'openrouter-mistralai/mistral-7b-instruct:free'
    );
  }

  if (models.length === 0) {
    throw new Error('No API key is set.');
  }

  return models;
}
