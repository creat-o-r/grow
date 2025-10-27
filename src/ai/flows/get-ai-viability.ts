
'use server';

/**
 * @fileOverview An AI agent that analyzes a plant's viability in a given location and provides a score and detailed reasoning.
 *
 * - getAiViability - A function that initiates the analysis.
 * - GetAiViabilityInput - The input type for the function.
 * - GetAiViabilityOutput - The return type for the function.
 */

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const GetAiViabilityInputSchema = z.object({
    plant: z.object({
        species: z.string(),
        germinationNeeds: z.string(),
        optimalConditions: z.string(),
    }),
    garden: z.object({
        conditions: z.object({
            temperature: z.string(),
            sunlight: z.string(),
            soil: z.string(),
            currentSeason: z.string().optional(),
        }),
        growingSystems: z.string().optional(),
        growingMethods: z.string().optional(),
    }),
    apiKeys: z.object({
        gemini: z.string().optional(),
    }).optional(),
});
type GetAiViabilityInput = z.infer<typeof GetAiViabilityInputSchema>;

const GetAiViabilityOutputSchema = z.object({
  viability: z.enum(['High', 'Medium', 'Low']).describe("The calculated viability score: 'High', 'Medium', or 'Low'."),
  reasoning: z.string().describe('A detailed, narrative explanation for the calculated viability score. It should compare the plant\'s needs to the garden\'s conditions point-by-point, including systems and methods.'),
});
type GetAiViabilityOutput = z.infer<typeof GetAiViabilityOutputSchema>;


export async function getAiViability(
  input: GetAiViabilityInput,
): Promise<GetAiViabilityOutput> {

  const ai = genkit({
    plugins: [
      googleAI({ apiKey: input.apiKeys?.gemini || process.env.GOOGLE_GENAI_API_KEY }),
    ],
  });

  const prompt = ai.definePrompt({
    name: 'getAiViabilityPrompt',
    input: {schema: GetAiViabilityInputSchema},
    output: {schema: GetAiViabilityOutputSchema},
    prompt: `You are an expert horticulturalist and data analyst. Your task is to analyze a plant's viability in a specific garden and determine a viability score ('High', 'Medium', or 'Low'). Then, you must provide a detailed reasoning for your determination.

Analyze the following information:

**Plant: {{{plant.species}}}**
- Germination Needs: {{{plant.germinationNeeds}}}
- Optimal Conditions: {{{plant.optimalConditions}}}

**Garden Conditions:**
- Current Season: {{{garden.conditions.currentSeason}}}
- Soil Temperature: {{{garden.conditions.temperature}}}
- Sunlight: {{{garden.conditions.sunlight}}}
- Soil Type: {{{garden.conditions.soil}}}
- Growing Systems: {{{garden.growingSystems}}}
- Growing Methods: {{{garden.growingMethods}}}

**Analysis Steps:**
1.  **Determine Viability Score**: First, based on all the provided data, decide if the viability is 'High', 'Medium', or 'Low'. A 'High' score means a near-perfect match. 'Medium' means some conditions are met, but some are not ideal. 'Low' means there are significant mismatches. Consider how the growing systems (e.g., 'greenhouse') or methods (e.g., 'transplant') might increase viability for a plant that isn't a perfect match for the outdoor conditions.
2.  **Generate Reasoning**: After determining the score, generate a comprehensive, narrative 'reasoning' that explains *why* you chose that score. Compare the plant's requirements for sun, temperature, soil, season, and planting method with the garden's provided conditions and systems. Be specific. For example, if the plant needs "full sun" and the garden has "6-8 hours", explain that this is a good match. If a tender plant needs warm soil but the garden has a 'heat mat' system, explain how that improves its viability.

Return your final analysis in the specified output format.
`,
  });

  const getAiViabilityFlow = ai.defineFlow(
    {
      name: 'getAiViabilityFlow',
      inputSchema: GetAiViabilityInputSchema,
      outputSchema: GetAiViabilityOutputSchema,
    },
    async (flowInput) => {
      const {output} = await prompt(flowInput, { model: 'googleai/gemini-1.5-pro-latest' });
      return output!;
    }
  );

  return getAiViabilityFlow(input);
}
