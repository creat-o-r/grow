'use server';
/**
 * @fileOverview An AI agent that fetches environmental data for a given location.
 *
 * - getEnvironmentalData - A function that initiates the data fetch.
 * - GetEnvironmentalDataInput - The input type for the function.
 * - GetEnvironmentalDataOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GetEnvironmentalDataInputSchema = z.object({
  location: z.string().describe('The city and country, e.g., "San Francisco, USA"'),
});
export type GetEnvironmentalDataInput = z.infer<typeof GetEnvironmentalDataInputSchema>;

const GetEnvironmentalDataOutputSchema = z.object({
  soilTemperature: z.string().describe('The current soil temperature.'),
  sunlightHours: z.string().describe('The current daily hours of sunlight.'),
  soilDescription: z.string().describe('A brief description of typical soil in the area. Omit the word "soil" from the description.'),
});
export type GetEnvironmentalDataOutput = z.infer<typeof GetEnvironmentalDataOutputSchema>;

export async function getEnvironmentalData(
  input: GetEnvironmentalDataInput
): Promise<GetEnvironmentalDataOutput> {
  return getEnvironmentalDataFlow(input);
}


const prompt = ai.definePrompt({
  name: 'getEnvironmentalDataPrompt',
  input: {schema: GetEnvironmentalDataInputSchema},
  output: {schema: GetEnvironmentalDataOutputSchema},
  prompt: `You are a world-class agricultural and environmental data specialist.
  Based on general knowledge for the provided location, provide the current environmental conditions.

  Location: {{{location}}}

  Provide the current soil temperature, average daily sunlight hours, and a description of the typical soil composition.
  For the soilDescription, return only the key characteristics of the soil type (e.g., "Well-drained, sandy loam, pH 6.5"). Do not include any descriptive words, location information, or the word "soil".
  Return your response in the structured format defined by the output schema.
  `,
});

const getEnvironmentalDataFlow = ai.defineFlow(
  {
    name: 'getEnvironmentalDataFlow',
    inputSchema: GetEnvironmentalDataInputSchema,
    outputSchema: GetEnvironmentalDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
