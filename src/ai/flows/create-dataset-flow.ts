
'use server';
/**
 * @fileOverview An AI agent that generates a plant and location dataset based on a theme.
 *
 * - createDataset - A function that initiates the dataset generation.
 * - CreateDatasetInput - The input type for the function.
 * - CreateDatasetOutput - The return type for the function.
 */

import { genkit } from 'genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';


const StatusHistorySchema = z.object({
  id: z.string(),
  status: z.enum(['Planning', 'Planting', 'Growing', 'Harvested', 'Dormant']),
  date: z.string().describe("An ISO string for the date."),
  notes: z.string().optional(),
});

const PlantSchema = z.object({
  id: z.string(),
  species: z.string(),
  germinationNeeds: z.string(),
  optimalConditions: z.string(),
  history: z.array(StatusHistorySchema),
});

const ConditionsSchema = z.object({
  temperature: z.string(),
  sunlight: z.string(),
  soil: z.string(),
});

const GardenLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  temperatureUnit: z.enum(['C', 'F']),
  conditions: ConditionsSchema,
});


const CreateDatasetInputSchema = z.object({
  theme: z.string().describe('The theme for the dataset, e.g., "Drought-tolerant plants for Arizona" or "A small herb garden in London"'),
   apiKeys: z.object({
      gemini: z.string().optional(),
  }).optional(),
});
export type CreateDatasetInput = z.infer<typeof CreateDatasetInputSchema>;

const CreateDatasetOutputSchema = z.object({
  locations: z.array(GardenLocationSchema),
  plants: z.array(PlantSchema),
});
export type CreateDatasetOutput = z.infer<typeof CreateDatasetOutputSchema>;

export async function createDataset(
  input: CreateDatasetInput,
): Promise<CreateDatasetOutput> {

  const plugins = [];
  let model: any = undefined;

  if (input.apiKeys?.gemini) {
    plugins.push(googleAI({ apiKey: input.apiKeys.gemini }));
    model = 'gemini-1.5-flash-latest';
  } else {
     plugins.push(googleAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY }));
     model = 'gemini-1.5-flash-latest';
  }

  const ai = genkit({ plugins });

  const prompt = ai.definePrompt({
    name: 'createDatasetPrompt',
    input: {schema: CreateDatasetInputSchema},
    output: {schema: CreateDatasetOutputSchema},
    prompt: `You are an expert botanist and garden planner. Based on the theme provided, create a dataset containing one sample garden location and a list of 5-8 suitable plants.

Theme: {{{theme}}}

Instructions:
1.  **Location**: Create a single garden location object. The 'name' should be based on the theme. The 'location' should be a specific city/region relevant to the theme. Set a reasonable temperature unit ('C' or 'F') and plausible environmental conditions.
2.  **Plants**: Generate a list of 5 to 8 plants that fit the theme and location.
3.  **IDs**: All 'id' fields for locations and plants must be unique strings (e.g., "loc-1", "plant-1", "plant-2"). History item IDs should also be unique (e.g., "h-1").
4.  **History**: Each plant must have exactly one history item. The status should be 'Planning', and the date can be a recent, realistic ISO string.
5.  **Content**: Ensure 'germinationNeeds' and 'optimalConditions' are detailed and helpful.

Return the data in the exact JSON format defined by the output schema.`,
  });

  const createDatasetFlow = ai.defineFlow(
    {
      name: 'createDatasetFlow',
      inputSchema: CreateDatasetInputSchema,
      outputSchema: CreateDatasetOutputSchema,
    },
    async (flowInput) => {
      const {output} = await prompt(flowInput, { model });
      return output!;
    }
  );

  return createDatasetFlow(input);
}
