
'use server';
/**
 * @fileOverview An AI agent that creates a garden dataset based on a theme.
 *
 * - createDataset - A function that initiates the dataset creation.
 * - CreateDatasetInput - The input type for the function.
 * - CreateDatasetOutput - The return type for the function.
 */

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import type { AiDataset } from '@/lib/types';

const CreateDatasetInputSchema = z.object({
  theme: z.string().describe('The theme for the dataset, e.g., "A beginner-friendly herb garden for a sunny balcony."'),
  apiKeys: z.object({
      gemini: z.string().optional(),
  }).optional(),
});
export type CreateDatasetInput = z.infer<typeof CreateDatasetInputSchema>;

const PlantSchema = z.object({
  id: z.string(),
  species: z.string(),
  germinationNeeds: z.string(),
  optimalConditions: z.string(),
  history: z.array(z.object({
    id: z.string(),
    status: z.enum(['Planning', 'Planting', 'Growing', 'Harvested', 'Dormant']),
    date: z.string(),
    notes: z.string().optional(),
  })),
});

const GardenLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  temperatureUnit: z.enum(['C', 'F']),
  conditions: z.object({
    temperature: z.string(),
    sunlight: z.string(),
    soil: z.string(),
  }),
});

const CreateDatasetOutputSchema = z.object({
  locations: z.array(GardenLocationSchema),
  plants: z.array(PlantSchema),
});
export type CreateDatasetOutput = z.infer<typeof CreateDatasetOutputSchema>;


export async function createDataset(
  input: CreateDatasetInput,
): Promise<CreateDatasetOutput> {

  const ai = genkit({
    plugins: [
      googleAI({ apiKey: input.apiKeys?.gemini || process.env.GOOGLE_GENAI_API_KEY }),
    ],
  });

  const prompt = ai.definePrompt({
    name: 'createDatasetPrompt',
    input: {schema: CreateDatasetInputSchema},
    output: {schema: CreateDatasetOutputSchema},
    prompt: `You are a world-class horticulturist and garden designer. Based on the theme provided, create a dataset for a garden.

Theme: {{{theme}}}

Your task is to generate a dataset containing:
1.  A single garden location object that fits the theme. It must have a creative name, a plausible real-world city/country, and realistic environmental conditions. Use Fahrenheit for US locations and Celsius otherwise.
2.  A list of 5-8 plant objects that are well-suited to the theme and the location you created.
3.  Each plant must have a unique ID (e.g., "ai-plant-1"), a species name, germination needs, optimal conditions, and a history array with a single entry (status: 'Planning').

Ensure the output is structured exactly according to the provided Zod output schema. The generated JSON should be valid and parseable.
`,
  });

  const createDatasetFlow = ai.defineFlow(
    {
      name: 'createDatasetFlow',
      inputSchema: CreateDatasetInputSchema,
      outputSchema: CreateDatasetOutputSchema,
    },
    async (flowInput) => {
      const {output} = await prompt(flowInput, { model: 'googleai/gemini-2.5-flash' });
      return output!;
    }
  );

  return createDatasetFlow(input);
}
