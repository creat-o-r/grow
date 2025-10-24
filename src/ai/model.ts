'use server';

import { googleAI } from '@genkit-ai/google-genai';
import { openAI } from 'genkitx-openai';

/**
 * Dynamically selects the best available AI model based on API key availability.
 * Prefers OpenAI if the API key is available, otherwise falls back to Google AI.
 */
export async function getModel() {
  // Check if the OpenAI API key is present in the server's environment.
  if (process.env.OPENAI_API_KEY) {
    return openAI('gpt-4o');
  }
  
  // Fallback to Google AI model.
  return googleAI('gemini-1.5-flash');
}
