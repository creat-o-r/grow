
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
  // Fallback to Google AI model if no API key is available for Google AI.
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not set.');
  }
  return 'googleai/gemini-1.0-pro';
}
