
'use server';

/**
 * @fileOverview An AI agent that searches for plant data based on a given name or description.
 *
 * - aiSearchPlantData - A function that initiates the plant data search.
 * - AISearchPlantDataInput - The input type for the aiSearchPlant-data function.
 * - AISearchPlantDataOutput - The return type for the aiSearchPlantData function.
 */

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const AISearchPlantDataInputSchema = z.object({
  searchTerm: z
    .string()
    .describe('The name or description of the plant to search for.'),
  apiKeys: z.object({
      gemini: z.string().optional(),
  }).optional(),
});
type AISearchPlantDataInput = z.infer<typeof AISearchPlantDataInputSchema>;

const AISearchPlantDataOutputSchema = z.object({
  commonName: z.string().describe('The common name of the plant (e.g., Sunflower, Tomato).'),
  species: z.string().describe('The scientific/botanical species name of the plant (e.g., Helianthus annuus, Solanum lycopersicum).'),
  germinationNeeds: z.string().describe('The germination needs of the plant, including ideal seasons for planting (e.g., Spring, Summer).'),
  optimalConditions: z.string().describe('The optimal growing conditions for the plant, including ideal seasons for growth and harvest.'),
});
type AISearchPlantDataOutput = z.infer<typeof AISearchPlantDataOutputSchema>;

export async function aiSearchPlantData(
  input: AISearchPlantDataInput,
): Promise<AISearchPlantDataOutput> {

  const ai = genkit({
    plugins: [
      googleAI({ apiKey: input.apiKeys?.gemini || process.env.GOOGLE_GENAI_API_KEY }),
    ],
  });

  const prompt = ai.definePrompt({
    name: 'aiSearchPlantDataPrompt',
    input: {schema: AISearchPlantDataInputSchema},
    output: {schema: AISearchPlantDataOutputSchema},
    prompt: `You are an expert botanist. Extract plant data based on the search term provided.

Search Term: {{{searchTerm}}}

Return the plant's common name, scientific species name, germination needs, and optimal conditions.
- commonName should be the common/everyday name (e.g., "Sunflower", "Tomato")
- species should be the scientific/botanical name (e.g., "Helianthus annuus", "Solanum lycopersicum")
- **CRITICAL**: The germinationNeeds and optimalConditions fields MUST contain explicit information about the ideal season(s) for planting, growing, and harvesting (e.g., "Sow in early Spring", "Thrives in Summer heat", "Harvest in Autumn before first frost"). This is a mandatory requirement.
Ensure the output is structured according to the provided output schema, with the Zod descriptions.
If there is no definitive answer based on the search term, make your best guess.`,
  });

  const aiSearchPlantDataFlow = ai.defineFlow(
    {
      name: 'aiSearchPlantDataFlow',
      inputSchema: AISearchPlantDataInputSchema,
      outputSchema: AISearchPlantDataOutputSchema,
    },
    async (flowInput) => {
      const {output} = await prompt(flowInput, { model: 'googleai/gemini-2.5-flash' });
      return output!;
    }
  );

  return aiSearchPlantDataFlow(input);
}
