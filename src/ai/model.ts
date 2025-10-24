
'use server';
/**
 * @fileOverview A model selector for the Genkit AI flows.
 *
 * This file provides a function to dynamically select the AI model based on
 * the available API keys in the environment.
 */

/**
 * Gets the appropriate AI model.
 * Prefers OpenAI if the API key is available, otherwise falls back to Google AI.
 */
export async function getModel(): Promise<string> {
  // Check if the OpenAI API key is present in the server's environment.
  if (process.env.OPENAI_API_KEY) {
    return 'openai/gpt-4o';
  }
  
  // Fallback to Google AI model.
  return 'googleai/gemini-1.0-pro';
}
