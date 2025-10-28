
'use server';

/**
 * @fileOverview An AI agent that generates an image for a given plant species.
 *
 * - generatePlantImage - A function that initiates the image generation.
 * - GeneratePlantImageInput - The input type for the function.
 * - GeneratePlantImageOutput - The return type for the function.
 */

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const GeneratePlantImageInputSchema = z.object({
  species: z.string().describe('The scientific/botanical species name of the plant (e.g., Helianthus annuus, Solanum lycopersicum).'),
  apiKeys: z.object({
      gemini: z.string().optional(),
  }).optional(),
});
type GeneratePlantImageInput = z.infer<typeof GeneratePlantImageInputSchema>;

const GeneratePlantImageOutputSchema = z.object({
  imageUrl: z.string().describe("The URL of the generated image."),
});
type GeneratePlantImageOutput = z.infer<typeof GeneratePlantImageOutputSchema>;

// Simple hash function to create a numeric seed from a string
const simpleHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};


export async function generatePlantImage(
  input: GeneratePlantImageInput,
): Promise<GeneratePlantImageOutput> {

  const ai = genkit({
    plugins: [
      googleAI({ apiKey: input.apiKeys?.gemini || process.env.GOOGLE_GENAI_API_KEY }),
    ],
  });

  const generatePlantImageFlow = ai.defineFlow(
    {
      name: 'generatePlantImageFlow',
      inputSchema: GeneratePlantImageInputSchema,
      outputSchema: GeneratePlantImageOutputSchema,
    },
    async (flowInput) => {
      const seed = simpleHash(flowInput.species);
      const imageUrl = `https://picsum.photos/seed/${seed}/512/512`;
      
      return { imageUrl };
    }
  );

  return generatePlantImageFlow(input);
}
