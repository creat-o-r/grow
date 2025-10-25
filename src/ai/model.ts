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
 * Gets the appropriate AI model based on the available API keys.
 * Prioritizes Groq, then OpenAI, and falls back to Google AI.
 */
export async function getModel(): Promise<string> {
  if (process.env.GROQ_API_KEY) {
    return 'groq/gemma-7b-it';
  }
  if (process.env.OPENAI_API_KEY) {
    return 'openai/gpt-4-turbo';
  }
  if (process.env.GEMINI_API_KEY) {
    return 'googleai/gemini-1.5-pro';
  }
  throw new Error('No API key is set.');
}
