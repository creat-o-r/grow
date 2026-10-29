
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
import { executeWithModelFallback } from '@/ai/model';

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
  viability: z.enum(['High', 'Medium', 'Low']).describe("The calculated viability score right now under the current conditions: 'High', 'Medium', or 'Low'."),
  reasoning: z.string().describe('A detailed, narrative explanation for the calculated current viability score. It should compare the plant\'s needs to the garden\'s conditions point-by-point, including systems and methods.'),
  upcomingViability: z.enum(['High', 'Medium']).optional().describe("If the plant currently has 'Low' or 'Medium' viability, but is likely to achieve a higher viability score ('Medium' or 'High') later within the CURRENT season as weather/soil warms or moderates, specify that higher score."),
  upcomingTiming: z.string().optional().describe("When during the current season the higher viability is expected, e.g. 'Mid-to-late Spring (once soil warms >15°C)' or 'Late Summer as heat moderates'."),
  upcomingReasoning: z.string().optional().describe("Brief explanation of what condition change during the current season will elevate viability."),
});
type GetAiViabilityOutput = z.infer<typeof GetAiViabilityOutputSchema>;


export async function getAiViability(
  input: GetAiViabilityInput,
): Promise<GetAiViabilityOutput> {

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
    name: 'getAiViabilityPrompt',
    input: {schema: GetAiViabilityInputSchema},
    output: {schema: GetAiViabilityOutputSchema},
    prompt: `You are an expert horticulturalist and data analyst. Your task is to analyze a plant's viability in a specific garden and determine a viability score ('High', 'Medium', or 'Low'). Then, check if a higher viability is upcoming within the current season, and provide detailed reasoning.

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
1.  **Determine Current Viability Score**: First, based on all the provided data right now, decide if current viability is 'High', 'Medium', or 'Low'. A 'High' score means a near-perfect match today. 'Medium' means some conditions are met, but some are not ideal. 'Low' means there are significant mismatches. Consider how growing systems (e.g., 'greenhouse') or methods (e.g., 'transplant') might increase viability.
2.  **Generate Current Reasoning**: Explain *why* you chose that current score, comparing plant requirements to current garden conditions and systems.
3.  **Evaluate Upcoming Higher Viability in Current Season**:
    - If current viability is 'Low' or 'Medium', check if the plant's natural growing calendar aligns with the CURRENT season ({{{garden.conditions.currentSeason}}}) such that its viability is likely to rise to 'Medium' or 'High' later within this same season (for example: sweetcorn or tomatoes in early Spring with cool soil are Low right now, but will become High in mid-to-late Spring once soil warms to 15-18°C; or lettuce in early Summer that improves to High in late Summer).
    - If a higher viability is likely within the current season, provide:
      - "upcomingViability": The higher score ('High' or 'Medium').
      - "upcomingTiming": The timeframe within this current season (e.g. 'Mid-to-late Spring', 'Late Spring once soil exceeds 15°C', 'Late Summer').
      - "upcomingReasoning": A concise explanation of the expected seasonal change that will elevate its viability.
    - If no higher viability is likely during this current season, omit the upcoming fields.

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
      return executeWithModelFallback<GetAiViabilityOutput>(
        `getAiViability(${flowInput.plant.species})`,
        (model) => prompt(flowInput, { model })
      );
    }
  );

  return getAiViabilityFlow(input);
}
