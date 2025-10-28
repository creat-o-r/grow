
'use server';
/**
 * @fileOverview An AI agent that creates a garden dataset based on a theme and optionally an existing location.
 *
 * - createDataset - A function that initiates the dataset creation.
 * - CreateDatasetInput - The input type for the function.
 * - CreateDatasetOutput - The return type for the function.
 */

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const PlantSchema = z.object({
  id: z.string(),
  species: z.string(),
  germinationNeeds: z.string(),
  optimalConditions: z.string(),
});

const PlantingSchema = z.object({
  id: z.string(),
  plantId: z.string(),
  gardenId: z.string(),
  name: z.string().describe("A simple, friendly name for this specific planting, e.g., 'Balcony Basil' or 'Spring Radishes'"),
  createdAt: z.string().describe("The ISO 8601 date this planting was notionally created."),
  history: z.array(z.object({
    id: z.string(),
    status: z.enum(['Wishlist', 'Planting', 'Growing', 'Harvest']),
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
    currentSeason: z.enum(['Spring', 'Summer', 'Autumn', 'Winter']).optional().describe("The current season in the Northern or Southern Hemisphere for the given location."),
  }),
  growingSystems: z.string().optional().describe("A comma-separated list of available growing systems (e.g., 'greenhouse, seed trays, 5-gallon pots')."),
  growingMethods: z.string().optional().describe("A comma-separated list of preferred growing methods (e.g., 'direct sow, transplant')."),
});

const CreateDatasetInputSchema = z.object({
  theme: z.string().describe('The theme for the dataset, e.g., "A beginner-friendly herb garden for a sunny balcony."'),
  activeLocation: GardenLocationSchema.optional().describe('The user\'s currently active garden location. If provided, generate plants for this location.'),
  apiKeys: z.object({
      gemini: z.string().optional(),
  }).optional(),
});
type CreateDatasetInput = z.infer<typeof CreateDatasetInputSchema>;

const CreateDatasetOutputSchema = z.object({
  locations: z.array(GardenLocationSchema),
  plants: z.array(PlantSchema),
  plantings: z.array(PlantingSchema),
});
type CreateDatasetOutput = z.infer<typeof CreateDatasetOutputSchema>;


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
    prompt: `You are a world-class horticulturist and garden designer. Your task is to generate a dataset based on the provided theme.

**FIRST, check the quantity**: Look for a specific number of plants requested in the theme (e.g., "create 10 plants"). If no number is specified, generate a list of 5 to 8 plant species.

Theme: {{{theme}}}

{{#if activeLocation}}
Your primary goal is to generate a list of plant species and a corresponding 'planting' for each, based on the quantity instruction above.
The plantings must be perfectly suited to the provided active garden location and the theme.
The provided location already exists, so you MUST return it as the single item in the 'locations' array in your output. Do not create a new location.
For the 'name' field of the location, generate a NEW, creative name for the garden that fits the theme and location (e.g., "Balcony Bounty," "Shady Oasis," "Urban Jungle"). Do not just use the existing name.
If the provided location is missing a 'currentSeason', you MUST determine and set it based on the location and a plausible current date.
Active Location:
- Name: {{{activeLocation.name}}}
- Location: {{{activeLocation.location}}}
- Conditions: Temp: {{{activeLocation.conditions.temperature}}}, Sunlight: {{{activeLocation.conditions.sunlight}}}, Soil: {{{activeLocation.conditions.soil}}}, Season: {{{activeLocation.conditions.currentSeason}}}
- Growing Systems: {{{activeLocation.growingSystems}}}
- Growing Methods: {{{activeLocation.growingMethods}}}
{{else}}
Your task is to generate a dataset containing:
1.  A single garden location object that fits the theme. It must have a creative name (e.g., "Balcony Bounty," "Shady Oasis," "Urban Jungle"), a plausible real-world city/country, and realistic environmental conditions. You MUST determine and set the 'currentSeason' based on the location's hemisphere and a plausible time of year (e.g., if it's a UK location, summer is a plausible season). The 'currentSeason' field MUST be one of the following exact strings: 'Spring', 'Summer', 'Autumn', or 'Winter'. Use Fahrenheit for US locations and Celsius otherwise. Also consider plausible growing systems and methods based on the theme.
2.  A list of plant species objects that are well-suited to the theme and the location you created, following the quantity instruction above.
3.  A corresponding list of 'planting' objects, one for each plant species.
{{/if}}

For each plant, you must provide:
- A unique ID (e.g., "ai-plant-1").
- The species name.
- A description of its germination needs.
- A description of its optimal growing conditions.

For each planting, you must provide:
- A unique ID (e.g., "ai-planting-1").
- The corresponding plantId.
- The corresponding gardenId.
- A simple, creative name (e.g., "Pesto Basil", "Windowbox Thyme").
- A createdAt date.
- A history array with a single entry where the status is 'Wishlist'.

IMPORTANT: The list of plants MUST contain distinct and unique plant species. Do not generate duplicate plants, even with minor name variations (e.g., 'Tomato' and 'Tomato (Solanum lycopersicum)').

Ensure the output is structured exactly according to the provided Zod output schema. The generated JSON must be valid and parseable.
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
