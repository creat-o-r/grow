
'use server';

/**
 * @fileOverview An AI agent that searches for plant data based on a given name or description.
 *
 * - aiSearchPlantData - A function that initiates the plant data search.
 * - AISearchPlantDataInput - The input type for the aiSearchPlant-data function.
 * - AISearchPlantDataOutput - The return type for the aiSearchPlantData function.
 */

import { initializeGenkit, ApiKeys } from '@/ai/genkit';
import { getModels } from '@/ai/model';
import { z } from 'zod';

const AISearchPlantDataInputSchema = z.object({
  searchTerm: z
    .string()
    .describe('The name or description of the plant to search for.'),
  apiKeys: z.custom<ApiKeys>().optional(),
  model: z.string().optional(),
});
export type AISearchPlantDataInput = z.infer<typeof AISearchPlantDataInputSchema>;

const AISearchPlantDataOutputSchema = z.object({
  species: z.string().describe('The species of the plant.'),
  germinationNeeds: z.string().describe('The germination needs of the plant.'),
  optimalConditions: z.string().describe('The optimal growing conditions for the plant.'),
});
export type AISearchPlantDataOutput = z.infer<typeof AISearchPlantDataOutputSchema>;

export async function aiSearchPlantData(
  input: AISearchPlantDataInput
): Promise<AISearchPlantDataOutput> {
  const ai = initializeGenkit(input.apiKeys);
  ai.definePrompt(aiSearchPlantDataPrompt);
  const aiSearchPlantDataFlow = ai.defineFlow(
    {
      name: 'aiSearchPlantDataFlow',
      inputSchema: AISearchPlantDataInputSchema,
      outputSchema: AISearchPlantDataOutputSchema,
    },
    async (flowInput) => {
      const models = await getModels(flowInput.apiKeys);
      for (const model of models) {
        try {
          const { output } = await ai.prompt('aiSearchPlantDataPrompt')(flowInput, { model });
          if (output) {
            return output;
          }
        } catch (error) {
          console.error(`Model ${model} failed:`, error);
          if (error instanceof Error && error.message.includes('quota')) {
            throw new Error('You have exceeded your API quota. Please check your plan and billing details.');
          }
        }
      }
      throw new Error('All available models failed to generate a response. Please check your API keys and try again.');
    }
  );
  return aiSearchPlantDataFlow(input);
}

const aiSearchPlantDataPrompt = {
  name: 'aiSearchPlantDataPrompt',
  input: {schema: AISearchPlantDataInputSchema},
  output: {schema: AISearchPlantDataOutputSchema},
  prompt: `You are an expert botanist. Extract plant data based on the search term provided.

  Search Term: {{{searchTerm}}}

  Return the plant's species, germination needs, and optimal conditions.
  Ensure the output is structured according to the provided output schema, with the Zod descriptions.
  If there is no definitive answer based on the search term, make your best guess.`,
};
