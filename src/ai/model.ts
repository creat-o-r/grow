
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
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set.');
  }
  // Use a standard, stable model name to avoid 404 errors.
  return 'gemini-pro';
}
