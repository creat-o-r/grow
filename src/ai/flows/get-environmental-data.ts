
'use server';
/**
 * @fileOverview An AI agent that fetches environmental data for a given location.
 *
 * - getEnvironmentalData - A function that initiates the data fetch.
 * - GetEnvironmentalDataInput - The input type for the function.
 * - GetEnvironmentalDataOutput - The return type for the function.
 */

import { initializeGenkit, ApiKeys } from '@/ai/genkit';
import { getModels } from '@/ai/model';
import { z } from 'zod';

const GetEnvironmentalDataInputSchema = z.object({
  location: z.string().describe('The city and country, e.g., "San Francisco, USA"'),
  apiKeys: z.custom<ApiKeys>().optional(),
  model: z.string().optional(),
});
export type GetEnvironmentalDataInput = z.infer<typeof GetEnvironmentalDataInputSchema>;

const GetEnvironmentalDataOutputSchema = z.object({
  soilTemperature: z.string().describe('The current soil temperature.'),
  sunlightHours: z.string().describe('The current daily hours of sunlight.'),
  soilDescription: z.string().describe('A brief description of typical soil in the area. Omit the word "soil" from the description.'),
  reasoning: z.string().describe('A detailed explanation of how the data was determined based on the location.'),
  references: z.any().describe('A full list of references or sources used to determine the data.'),
});
export type GetEnvironmentalDataOutput = z.infer<typeof GetEnvironmentalDataOutputSchema>;

export async function getEnvironmentalData(
  input: GetEnvironmentalDataInput
): Promise<GetEnvironmentalDataOutput> {
  const ai = initializeGenkit(input.apiKeys);
  ai.definePrompt(getEnvironmentalDataPrompt);
  const getEnvironmentalDataFlow = ai.defineFlow(
    {
      name: 'getEnvironmentalDataFlow',
      inputSchema: GetEnvironmentalDataInputSchema,
      outputSchema: GetEnvironmentalDataOutputSchema,
    },
    async (flowInput) => {
      if (flowInput.model) {
        const { output } = await ai.prompt('getEnvironmentalDataPrompt')(flowInput, { model: flowInput.model });
        if (output) {
          return output;
        }
      } else {
        const models = await getModels(flowInput.apiKeys);
        for (const model of models) {
          try {
            const { output } = await ai.prompt('getEnvironmentalDataPrompt')(flowInput, { model });
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
      }
      throw new Error('All available models failed to generate a response. Please check your API keys and try again.');
    }
  );
  return getEnvironmentalDataFlow(input);
}

const getEnvironmentalDataPrompt = {
  name: 'getEnvironmentalDataPrompt',
  input: {schema: GetEnvironmentalDataInputSchema},
  output: {schema: GetEnvironmentalDataOutputSchema},
  prompt: `You are a world-class agricultural and environmental data specialist.
  Based on general knowledge for the provided location, provide the current environmental conditions.

  Location: {{{location}}}

  Provide the current soil temperature, average daily sunlight hours, and a description of the typical soil composition.
  For the soilDescription, return only the key characteristics of the soil type (e.g., "Well-drained, sandy loam, pH 6.5"). Do not include any descriptive words, location information, or the word "soil".
  In the reasoning field, provide a detailed explanation for why you chose the values based on the location's geography and current season.
  In the references field, cite the full list of any general sources or knowledge bases you are using.
  Return your response in the structured format defined by the output schema.
  `,
};
