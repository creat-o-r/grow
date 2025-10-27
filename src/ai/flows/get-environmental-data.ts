
'use server';
/**
 * @fileOverview An AI agent that fetches environmental data for a given location.
 *
 * - getEnvironmentalData - A function that initiates the data fetch.
 * - GetEnvironmentalDataInput - The input type for the function.
 * - GetEnvironmentalDataOutput - The return type for the function.
 */

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const GetEnvironmentalDataInputSchema = z.object({
  location: z.string().describe('The city and country, e.g., "San Francisco, USA"'),
  apiKeys: z.object({
      gemini: z.string().optional(),
  }).optional(),
});
type GetEnvironmentalDataInput = z.infer<typeof GetEnvironmentalDataInputSchema>;

const GetEnvironmentalDataOutputSchema = z.object({
  soilTemperature: z.string().describe('The current soil temperature.'),
  sunlightHours: z.string().describe('The current daily hours of sunlight.'),
  soilDescription: z.string().describe('A brief description of typical soil in the area. Omit the word "soil" from the description.'),
  currentSeason: z.enum(['Spring', 'Summer', 'Autumn', 'Winter']).describe('The current season in the Northern or Southern Hemisphere for the given location.'),
  reasoning: z.string().describe('A detailed explanation of how the data was determined based on the location.'),
  references: z.any().describe('A full list of references or sources used to determine the data.'),
});
type GetEnvironmentalDataOutput = z.infer<typeof GetEnvironmentalDataOutputSchema>;

export async function getEnvironmentalData(
  input: GetEnvironmentalDataInput,
): Promise<GetEnvironmentalDataOutput> {

  const ai = genkit({
    plugins: [
      googleAI({ apiKey: input.apiKeys?.gemini || process.env.GOOGLE_GENAI_API_KEY }),
    ],
  });

  const prompt = ai.definePrompt({
    name: 'getEnvironmentalDataPrompt',
    input: {schema: GetEnvironmentalDataInputSchema},
    output: {schema: GetEnvironmentalDataOutputSchema},
    prompt: `You are a world-class agricultural and environmental data specialist.
Based on general knowledge for the provided location, provide the current environmental conditions.

Location: {{{location}}}

Provide the current soil temperature, average daily sunlight hours, and a description of the typical soil composition.
Determine the current season based on the location's hemisphere and the current month. The 'currentSeason' field must be one of the following exact strings: 'Spring', 'Summer', 'Autumn', or 'Winter'.
For the soilDescription, return only the key characteristics of the soil type (e.g., "Well-drained, sandy loam, pH 6.5"). Do not include any descriptive words, location information, or the word "soil".
In the reasoning field, provide a detailed explanation for why you chose the values based on the location's geography and current season.
In the references field, cite the full list of any general sources or knowledge bases you are using.
Return your response in the structured format defined by the output schema.
`,
  });

  const getEnvironmentalDataFlow = ai.defineFlow(
    {
      name: 'getEnvironmentalDataFlow',
      inputSchema: GetEnvironmentalDataInputSchema,
      outputSchema: GetEnvironmentalDataOutputSchema,
    },
    async (flowInput) => {
      const {output} = await prompt(flowInput, { model: 'googleai/gemini-2.5-flash' });
      return output!;
    }
  );

  return getEnvironmentalDataFlow(input);
}
