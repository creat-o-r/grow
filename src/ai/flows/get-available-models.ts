
'use server';

import { initializeGenkit, ApiKeys } from '@/ai/genkit';
import { getModels } from '@/ai/model';
import { z } from 'zod';

const GetAvailableModelsInputSchema = z.object({
  apiKeys: z.custom<ApiKeys>().optional(),
});

const GetAvailableModelsOutputSchema = z.object({
  models: z.array(z.string()),
});

export async function getAvailableModels(
  input: z.infer<typeof GetAvailableModelsInputSchema>
): Promise<z.infer<typeof GetAvailableModelsOutputSchema>> {
  initializeGenkit(input.apiKeys);
  const models = await getModels(input.apiKeys);
  return { models };
}
