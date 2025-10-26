
'use server';

import { initializeGenkit, ApiKeys } from '@/ai/genkit';
import { getModels } from '@/ai/model';
import { z } from 'zod';

const GetAvailableModelsInputSchema = z.object({
  apiKeys: z.custom<ApiKeys>().optional(),
});

const GetAvailableModelsOutputSchema = z.object({
  models: z.array(z.string()),
  envKeys: z.object({
    gemini: z.boolean(),
    openai: z.boolean(),
    perplexity: z.boolean(),
    openrouter: z.boolean(),
    groq: z.boolean(),
  }),
});

export async function getAvailableModels(
  input: z.infer<typeof GetAvailableModelsInputSchema>
): Promise<z.infer<typeof GetAvailableModelsOutputSchema>> {
  console.log('Fetching available models...');
  try {
    initializeGenkit(input.apiKeys);
    const models = await getModels(input.apiKeys);
    console.log('Found models:', models);
    return {
      models,
      envKeys: {
        gemini: !!process.env.GEMINI_API_KEY,
        openai: !!process.env.OPENAI_API_KEY,
        perplexity: !!process.env.PERPLEXITY_API_KEY,
        openrouter: !!process.env.OPENROUTER_API_KEY,
        groq: !!process.env.GROQ_API_KEY,
      },
    };
  } catch (error) {
    console.error('Error fetching available models:', error);
    return {
      models: [],
      envKeys: {
        gemini: false,
        openai: false,
        perplexity: false,
        openrouter: false,
        groq: false,
      },
    };
  }
}
