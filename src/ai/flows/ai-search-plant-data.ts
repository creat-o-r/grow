'use server';

/**
 * @fileOverview An AI agent that searches for plant data based on a given name or description.
 *
 * - aiSearchPlantData - A function that initiates the plant data search.
 * - AISearchPlantDataInput - The input type for the aiSearchPlant-data function.
 * - AISearchPlantDataOutput - The return type for the aiSearchPlantData function.
 */

import {ai} from '@/ai/genkit';
import { getModel } from '@/ai/model';
import {z} from 'genkit';

const AISearchPlantDataInputSchema = z.object({
  searchTerm: z
    .string()
    .describe('The name or description of the plant to search for.'),
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
  return aiSearchPlantDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiSearchPlantDataPrompt',
  input: {schema: AISearchPlantDataInputSchema},
  output: {schema: AISearchPlantDataOutputSchema},
  model: getModel(),
  prompt: `You are an expert botanist. Extract plant data based on the search term provided.

  Search Term: {{{searchTerm}}}

  Return the plant's species, germination needs, and optimal conditions.
  Ensure the output is structured according to the provided output schema, with the Zod descriptions.
  If there is no definitive answer based on the search term, make your best guess.`,
});

const aiSearchPlantDataFlow = ai.defineFlow(
  {
    name: 'aiSearchPlantDataFlow',
    inputSchema: AISearchPlantDataInputSchema,
    outputSchema: AISearchPlantDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
