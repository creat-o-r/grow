
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
 * Falls back to Google AI model.
 */
export async function getModel(): Promise<string> {
  if (!process.env.GOOGLE_GENAI_API_KEY) {
    throw new Error('GOOGLE_GENAI_API_KEY is not set.');
  }
  // Use the correct, fully-qualified model name to avoid 404 errors.
  return 'googleAI/gemini-1.5-pro-latest';
}

    