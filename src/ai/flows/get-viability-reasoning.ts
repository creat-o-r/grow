
'use server';

/**
 * @fileOverview An AI agent that provides a detailed reasoning for a plant's viability in a given location.
 *
 * - getViabilityReasoning - A function that initiates the reasoning process.
 * - GetViabilityReasoningInput - The input type for the function.
 * - GetViabilityReasoningOutput - The return type for the function.
 */

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import type { Plant, Conditions } from '@/lib/types';

const GetViabilityReasoningInputSchema = z.object({
    plant: z.object({
        species: z.string(),
        germinationNeeds: z.string(),
        optimalConditions: z.string(),
    }),
    gardenConditions: z.object({
        temperature: z.string(),
        sunlight: z.string(),
        soil: z.string(),
        currentSeason: z.string().optional(),
    }),
    viabilityScore: z.enum(['High', 'Medium', 'Low']),
    apiKeys: z.object({
        gemini: z.string().optional(),
    }).optional(),
});
type GetViabilityReasoningInput = z.infer<typeof GetViabilityReasoningInputSchema>;

const GetViabilityReasoningOutputSchema = z.object({
  reasoning: z.string().describe('A detailed, narrative explanation for the calculated viability score. It should compare the plant\'s needs to the garden\'s conditions point-by-point.'),
});
type GetViabilityReasoningOutput = z.infer<typeof GetViabilityReasoningOutputSchema>;


export async function getViabilityReasoning(
  input: GetViabilityReasoningInput,
): Promise<GetViabilityReasoningOutput> {

  const ai = genkit({
    plugins: [
      googleAI({ apiKey: input.apiKeys?.gemini || process.env.GOOGLE_GENAI_API_KEY }),
    ],
  });

  const prompt = ai.definePrompt({
    name: 'getViabilityReasoningPrompt',
    input: {schema: GetViabilityReasoningInputSchema},
    output: {schema: GetViabilityReasoningOutputSchema},
    prompt: `You are an expert horticulturalist. Your task is to provide a clear, detailed reasoning for why a specific plant has been given a certain viability score for a specific garden.

Analyze the following information:

**Plant: {{{plant.species}}}**
- Germination Needs: {{{plant.germinationNeeds}}}
- Optimal Conditions: {{{plant.optimalConditions}}}

**Garden Conditions:**
- Current Season: {{{gardenConditions.currentSeason}}}
- Soil Temperature: {{{gardenConditions.temperature}}}
- Sunlight: {{{gardenConditions.sunlight}}}
- Soil Type: {{{gardenConditions.soil}}}

**Calculated Viability Score: {{{viabilityScore}}}**

Based on the data, generate a comprehensive, narrative 'reasoning' that explains *why* the score is '{{{viabilityScore}}}'. Compare the plant's requirements for sun, temperature, soil, and season with the garden's provided conditions. Be specific. For example, if the plant needs "full sun" and the garden has "6-8 hours", explain that this is a good match. If the plant needs "cool weather" and the garden is in "Summer" with high temperatures, explain that this is a mismatch and why it contributes to a lower score.
`,
  });

  const getViabilityReasoningFlow = ai.defineFlow(
    {
      name: 'getViabilityReasoningFlow',
      inputSchema: GetViabilityReasoningInputSchema,
      outputSchema: GetViabilityReasoningOutputSchema,
    },
    async (flowInput) => {
      const {output} = await prompt(flowInput, { model: 'googleai/gemini-2.5-flash' });
      return output!;
    }
  );

  return getViabilityReasoningFlow(input);
}
