'use server';
/**
 * @fileOverview A model selector for the Genkit AI flows.
 *
 * This file provides a function to dynamically select the AI model based on
 * the available API keys in the environment.
 */

import { ApiKeys } from './genkit';

/**
 * Gets the appropriate AI model based on the available API keys.
 * Prioritizes Groq, then OpenAI, and falls back to Google AI.
 */
export async function getModel(apiKeys?: ApiKeys): Promise<string> {
  const groqApiKey = apiKeys?.groq || process.env.GROQ_API_KEY;
  if (groqApiKey) {
    return 'groq/gemma-7b-it';
  }

  const openaiApiKey = apiKeys?.openai || process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    return 'openai/gpt-4-turbo';
  }

  const geminiApiKey = apiKeys?.gemini || process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    return 'googleai/gemini-1.5-pro';
  }

  throw new Error('No API key is set.');
}
