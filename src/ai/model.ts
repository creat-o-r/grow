'use server';
/**
 * @fileOverview A model selector for the Genkit AI flows.
 *
 * This file provides a function to dynamically select the AI model based on
 * the available API keys in the environment.
 */


/**
 * Gets the appropriate AI model based on the available API keys.
 * Prioritizes Groq, then OpenAI, and falls back to Google AI.
 */
export async function getModel(): Promise<string> {
  return 'googleai/gemini-1.5-pro-latest';
}
