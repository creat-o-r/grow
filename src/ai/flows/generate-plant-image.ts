
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
  imageUrl: z.string().describe("The data URI of the generated image. Must include a MIME type and use Base64 encoding. Format: 'data:<mimetype>;base64,<encoded_data>'."),
});
type GeneratePlantImageOutput = z.infer<typeof GeneratePlantImageOutputSchema>;

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
      const { media } = await ai.generate({
        model: 'googleai/imagen-2.0-fast-generate-001',
        prompt: `A clear, vibrant, high-quality photograph of a healthy ${flowInput.species} plant. The plant should be the main focus, set against a simple, clean, light-colored background. The image should be in a square aspect ratio.`,
      });
      
      const imageUrl = media.url;
      if (!imageUrl) {
        throw new Error('Image generation failed to produce an output.');
      }

      return { imageUrl };
    }
  );

  return generatePlantImageFlow(input);
}
