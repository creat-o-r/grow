'use server';
/**
 * @fileOverview A model selector for the Genkit AI flows.
 *
 * This file provides a function to dynamically select the AI model based on
 * the available API keys in the environment.
 */

import { ApiKeys } from './genkit';

/**
 * Gets a prioritized list of AI models based on the available API keys.
 * Prioritizes Groq, then OpenAI (with a fallback), and finally Google AI.
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
      'openrouter/google-gemini-flash-1.5',
      'openrouter/microsoft-phi-3-medium-128k-instruct'
    );
  }

  if (models.length === 0) {
    throw new Error('No API key is set.');
  }

  return models;
}
