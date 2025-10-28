
'use server';
/**
 * @fileOverview A plant problem diagnosis AI agent.
 *
 * - diagnosePlant - A function that handles the plant diagnosis process.
 * - DiagnosePlantInput - The input type for the diagnosePlant function.
 * - DiagnosePlantOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z, genkit} from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const DiagnosePlantInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a plant, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  description: z.string().describe('The description of the plant.'),
  apiKeys: z.object({
      gemini: z.string().optional(),
  }).optional(),
});
export type DiagnosePlantInput = z.infer<typeof DiagnosePlantInputSchema>;

const DiagnosePlantOutputSchema = z.object({
  identification: z.object({
    isPlant: z.boolean().describe('Whether or not the input is a plant.'),
    commonName: z.string().describe('The common name of the identified plant (e.g., Sunflower, Tomato).'),
    species: z.string().describe('The scientific/botanical species name of the plant (e.g., Helianthus annuus, Solanum lycopersicum).'),
  }),
  diagnosis: z.object({
    isHealthy: z.boolean().describe('Whether or not the plant is healthy.'),
    diagnosis: z.string().describe("The diagnosis of the plant's health."),
  }),
});
export type DiagnosePlantOutput = z.infer<typeof DiagnosePlantOutputSchema>;

export async function diagnosePlant(input: DiagnosePlantInput): Promise<DiagnosePlantOutput> {
  const ai = genkit({
    plugins: [
      googleAI({ apiKey: input.apiKeys?.gemini || process.env.GOOGLE_GENAI_API_KEY }),
    ],
  });
  
  const prompt = ai.definePrompt({
    name: 'diagnosePlantPrompt',
    input: {schema: DiagnosePlantInputSchema},
    output: {schema: DiagnosePlantOutputSchema},
    prompt: `You are an expert botanist specializing diagnosing plant illnesses.

You will use this information to diagnose the plant, and any issues it has. You will make a determination as to whether the plant is healthy or not, and what is wrong with it, and set the isHealthy output field appropriately.

If the image is not a plant, your best guess is fine for the name, but you MUST set isPlant to false.

Return the plant's common name and its scientific/botanical species name.
- commonName should be the common/everyday name (e.g., "Sunflower", "Tomato")
- species should be the scientific/botanical name (e.g., "Helianthus annuus", "Solanum lycopersicum")

Description: {{{description}}}
Photo: {{media url=photoDataUri}}`,
  });

  const diagnosePlantFlow = ai.defineFlow(
    {
      name: 'diagnosePlantFlow',
      inputSchema: DiagnosePlantInputSchema,
      outputSchema: DiagnosePlantOutputSchema,
    },
    async (flowInput) => {
      const {output} = await prompt(flowInput, { model: 'gemini-1.5-flash' });
      return output!;
    }
  );

  return diagnosePlantFlow(input);
}
