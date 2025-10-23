'use server';
/**
 * @fileOverview An AI agent that fetches environmental data for a given location.
 *
 * - getEnvironmentalData - A function that initiates the data fetch.
 * - GetEnvironmentalDataInput - The input type for the function.
 * - GetEnvironmentalDataOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GetEnvironmentalDataInputSchema = z.object({
  location: z.string().describe('The city and country, e.g., "San Francisco, USA"'),
});
export type GetEnvironmentalDataInput = z.infer<typeof GetEnvironmentalDataInputSchema>;

const GetEnvironmentalDataOutputSchema = z.object({
  soilTemperature: z.string().describe('The estimated soil temperature.'),
  sunlightHours: z.string().describe('The estimated daily hours of sunlight.'),
  soilDescription: z.string().describe('A brief description of typical soil in the area.'),
});
export type GetEnvironmentalDataOutput = z.infer<typeof GetEnvironmentalDataOutputSchema>;

// This is a placeholder tool. In a real application, you would replace this
// with a call to a real weather/environmental API.
const getEnvironmentalDataTool = ai.defineTool(
  {
    name: 'getEnvironmentalData',
    description: 'Get environmental data for a specific location.',
    inputSchema: GetEnvironmentalDataInputSchema,
    outputSchema: GetEnvironmentalDataOutputSchema,
  },
  async (input) => {
    console.log(`[getEnvironmentalDataTool] Called with: ${input.location}`);
    // MOCK DATA: Replace this with a real API call.
    return {
      soilTemperature: '68°F',
      sunlightHours: '6-8 hours of direct sunlight',
      soilDescription: 'Well-drained loam',
    };
  }
);


export async function getEnvironmentalData(
  input: GetEnvironmentalDataInput
): Promise<GetEnvironmentalDataOutput> {
  const {output} = await ai.generate({
      prompt: `Based on the location "${input.location}", provide the soil temperature, sunlight hours, and a general soil description.`,
      tools: [getEnvironmentalDataTool],
  });

  return output!;
}
