
'use server';
/**
 * @fileOverview A model selector for the Genkit AI flows.
 *
 * This file provides a function to dynamically select the AI model based on
 * the available API keys in the environment.
 */

import {config} from 'dotenv';

config();

/**
 * Gets the appropriate AI model.
 * Prefers OpenAI if the API key is available, otherwise falls back to Google AI.
 */
export async function getModel(): Promise<string> {
  if (process.env.OPENAI_API_KEY) {
    return 'openai/gpt-4o';
  }
  // Fallback to Google AI model if no API key is available for OpenAI.
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set.');
  }
  return 'googleai/gemini-1.5-flash-latest';
}
