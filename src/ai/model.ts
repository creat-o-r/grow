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
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (geminiApiKey) {
    return 'googleai/gemini-1.5-pro-latest';
  }

  throw new Error('No API key is set.');
}
