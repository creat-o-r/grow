
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
    .optional()
    .describe('The name or description of the plant to search for.'),
  image: z.string().optional().describe('A base64-encoded image of the plant.'),
  apiKeys: z.object({
    gemini: z.string().optional(),
  }).optional(),
});
type AISearchPlantDataInput = z.infer<typeof AISearchPlantDataInputSchema>;

const AISearchPlantDataOutputSchema = z.object({
  commonName: z.string().describe('The common name of the plant (e.g., Sunflower, Tomato).'),
  species: z.string().describe('The scientific/botanical species name of the plant (e.g., Helianthus annuus, Solanum lycopersicum).'),
  germinationNeeds: z.string().describe('The germination needs of the plant.'),
  optimalConditions: z.string().describe('The optimal growing conditions for the plant.'),
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
    input: { schema: AISearchPlantDataInputSchema },
    output: { schema: AISearchPlantDataOutputSchema },
    prompt: (input) => {
      const basePrompt = `You are an expert botanist. Extract plant data based on the provided input.

Return the plant's common name, scientific species name, germination needs, and optimal conditions.
- commonName should be the common/everyday name (e.g., "Sunflower", "Tomato")
- species should be the scientific/botanical name (e.g., "Helianthus annuus", "Solanum lycopersicum")
Ensure the output is structured according to the provided output schema, with the Zod descriptions.
If there is no definitive answer, make your best guess.`;

      if (input.image) {
        return {
          role: 'user',
          content: [
            { text: basePrompt },
            {
              media: {
                url: `data:image/jpeg;base64,${input.image}`,
                contentType: 'image/jpeg',
              },
            },
          ],
        };
      } else {
        return `${basePrompt}\n\nSearch Term: ${input.searchTerm}`;
      }
    },
  });

  const aiSearchPlantDataFlow = ai.defineFlow(
    {
      name: 'aiSearchPlantDataFlow',
      inputSchema: AISearchPlantDataInputSchema,
      outputSchema: AISearchPlantDataOutputSchema,
    },
    async (flowInput) => {
      const model = flowInput.image
        ? 'googleai/gemini-1.5-flash-latest'
        : 'googleai/gemini-1.5-flash-latest';
      const { output } = await prompt(flowInput, { model });
      return output!;
    }
  );

  return aiSearchPlantDataFlow(input);
}
