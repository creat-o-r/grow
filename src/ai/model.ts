
'use server';
/**
 * @fileOverview A model selector for the Genkit AI flows.
 *
 * This file provides a function to dynamically select the AI model.
 */

/**
 * Gets the appropriate AI model.
 */
export async function getModel(): Promise<string> {
  // Use the correct, fully-qualified model name to avoid 404 errors.
  return 'gemini-1.5-pro-latest';
}
