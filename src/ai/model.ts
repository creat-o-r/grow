
'use server';
/**
 * @fileOverview A model selector for the Genkit AI flows.
 *
 * This file provides a function to dynamically select the AI model based on
 * the available API keys in the environment.
 */

/**
 * Gets the appropriate AI model.
 * At present, this defaults to the OpenAI gpt-4o model.
 */
export async function getModel(): Promise<string> {
  // Default to the OpenAI model.
  return 'openai/gpt-4o';
}
