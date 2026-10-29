
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
import { executeWithModelFallback } from '@/ai/model';

const GetEnvironmentalDataInputSchema = z.object({
  location: z.string().describe('The city and country, e.g., "San Francisco, USA"'),
  currentMonth: z.string().describe('The current month as a full month name, e.g., "July".'),
  apiKeys: z.object({
      gemini: z.string().optional(),
  }).optional(),
});
type GetEnvironmentalDataInput = z.infer<typeof GetEnvironmentalDataInputSchema>;

const GetEnvironmentalDataOutputSchema = z.object({
  soilTemperature: z.string().describe('The current soil temperature, e.g. "16°C" or "62°F".'),
  sunlightHours: z.string().describe('The current daily hours of sunlight, e.g. "13 hours".'),
  soilDescription: z.string().describe('A brief description of typical soil in the area. Omit the word "soil" from the description.'),
  currentSeason: z.enum(['Spring', 'Summer', 'Autumn', 'Winter']).describe('The current season in the Northern or Southern Hemisphere for the given location.'),
  reasoning: z.string().describe('A concise 1-2 sentence explanation of how the data was determined based on the location and season.'),
  references: z.string().describe('A concise string citing 1-2 climate or agricultural sources/databases used.'),
});
type GetEnvironmentalDataOutput = z.infer<typeof GetEnvironmentalDataOutputSchema>;

export async function getEnvironmentalData(
  input: GetEnvironmentalDataInput,
): Promise<GetEnvironmentalDataOutput> {

  const apiKey = input.apiKeys?.gemini || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is required. Please save your API key in Settings.');
  }

  const ai = genkit({
    plugins: [
      googleAI({ apiKey }),
    ],
  });

  const prompt = ai.definePrompt({
    name: 'getEnvironmentalDataPrompt',
    input: {schema: GetEnvironmentalDataInputSchema},
    output: {schema: GetEnvironmentalDataOutputSchema},
    prompt: `You are a world-class agricultural and environmental data specialist.
Based on general knowledge for the provided location and current month, provide the current environmental conditions.

Location: {{{location}}}
Current Month: {{{currentMonth}}}

Provide the current soil temperature, average daily sunlight hours, and a description of the typical soil composition.
You MUST determine the current season based on the location's hemisphere and the provided current month. The 'currentSeason' field MUST be one of the following exact strings: 'Spring', 'Summer', 'Autumn', or 'Winter'.
For the soilDescription, return only the key characteristics of the soil type (e.g., "Well-drained, sandy loam, pH 6.5"). Do not include any descriptive words, location information, or the word "soil".
For reasoning, provide a concise 1-2 sentence summary of why these values apply to this location in this month.
For references, cite 1-2 general sources or knowledge bases used (e.g. "World Climate Data / FAO Soil Portal").
Keep all output concise and adhere strictly to the schema.
`,
  });

  const getEnvironmentalDataFlow = ai.defineFlow(
    {
      name: 'getEnvironmentalDataFlow',
      inputSchema: GetEnvironmentalDataInputSchema,
      outputSchema: GetEnvironmentalDataOutputSchema,
    },
    async (flowInput) => {
      return executeWithModelFallback<GetEnvironmentalDataOutput>(
        `getEnvironmentalData(${flowInput.location})`,
        (model) => prompt(flowInput, { model })
      );
    }
  );

  return getEnvironmentalDataFlow(input);
}
