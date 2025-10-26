
'use server';

import { initializeGenkit, ApiKeys } from '@/ai/genkit';
import { getModels } from '@/ai/model';
import { z } from 'zod';

const GetAvailableModelsInputSchema = z.object({
  apiKeys: z.custom<ApiKeys>().optional(),
});
export type GetAvailableModelsInput = z.infer<typeof GetAvailableModelsInputSchema>;

const GetAvailableModelsOutputSchema = z.object({
  models: z.array(z.string()),
});
export type GetAvailableModelsOutput = z.infer<typeof GetAvailableModelsOutputSchema>;

export async function getAvailableModels(
  input: GetAvailableModelsInput
): Promise<GetAvailableModelsOutput> {
  initializeGenkit(input.apiKeys);
  const models = await getModels(input.apiKeys);
  return { models };
}
