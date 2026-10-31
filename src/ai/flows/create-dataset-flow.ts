
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
import { executeWithModelFallback } from '@/ai/model';

const PlantSchema = z.object({
  id: z.string(),
  species: z.string(),
  germinationNeeds: z.string(),
  optimalConditions: z.string(),
  isExistingVariation: z.boolean().optional().describe('True if this plant is a variation, cultivar, or related species of an existing plant in the garden.'),
  variationReason: z.string().optional().describe('Strong horticultural justification/match explaining why this variation was recommended despite existing plants in the garden.'),
  relatedExistingPlant: z.string().optional().describe('The name or species of the existing garden plant this is a variation of.'),
});

const PlantingSchema = z.object({
  id: z.string(),
  plantId: z.string(),
  gardenId: z.string(),
  name: z.string().describe("A simple, friendly name for this specific planting, e.g., 'Balcony Basil' or 'Spring Radishes'"),
  createdAt: z.string().describe("The ISO 8601 date this planting was notionally created."),
  seedsOnHand: z.number().optional().default(0),
  plannedQty: z.number().optional().default(0),
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
  currentMonth: z.string().optional().describe('The current calendar month (e.g., "October"), used to determine what is suitable for planting now.'),
  activeLocation: GardenLocationSchema.optional().describe('The user\'s currently active garden location. If provided, generate plants for this location.'),
  existingPlants: z.array(z.string()).optional().describe('List of plant species already present in the user\'s active garden.'),
  apiKeys: z.object({
      gemini: z.string().optional(),
      groq: z.string().optional(),
      openrouter: z.string().optional(),
      ollamaUrl: z.string().optional(),
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

  const apiKey = input.apiKeys?.gemini || process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
  const hasFallbackKey = Boolean(
    input.apiKeys?.groq ||
    input.apiKeys?.openrouter ||
    input.apiKeys?.ollamaUrl ||
    process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY
  );
  if (!apiKey && !hasFallbackKey) {
    throw new Error('At least one free AI provider key (Gemini, Groq, OpenRouter, or Local Ollama) is required in Settings.');
  }

  const ai = genkit({
    plugins: [
      googleAI({ apiKey: apiKey || 'fallback-only-key' }),
    ],
  });

  const prompt = ai.definePrompt({
    name: 'createDatasetPrompt',
    input: {schema: CreateDatasetInputSchema},
    output: {schema: CreateDatasetOutputSchema},
    prompt: `You are a world-class horticulturist and garden designer. Your task is to generate a dataset based on the provided theme.

**FIRST, check the quantity**: Look for a specific number of plants requested in the theme (e.g., "create 10 plants"). If no number is specified, generate a list of 5 to 8 plant species.

Theme: {{{theme}}}
{{#if currentMonth}}
Current Month: {{{currentMonth}}}
*Important*: If the theme mentions "planting now", "this season", "current month", or implies current timing, prioritize plants that are ideally sown, planted, or transplanted during {{{currentMonth}}} for the specified garden location and season.
{{/if}}

{{#if activeLocation}}
Your primary goal is to generate a list of plant species and a corresponding 'planting' for each, based on the quantity instruction above.
The plantings MUST be well-suited to the user's active garden:
- Garden Name: {{{activeLocation.name}}}
- Location: {{{activeLocation.location}}}
- Conditions: Temp: {{{activeLocation.conditions.temperature}}}, Sunlight: {{{activeLocation.conditions.sunlight}}}, Soil: {{{activeLocation.conditions.soil}}}, Season: {{{activeLocation.conditions.currentSeason}}}
- Growing Systems: {{{activeLocation.growingSystems}}}
- Growing Methods: {{{activeLocation.growingMethods}}}
{{#if existingPlants.length}}
- Existing Plants already in this garden: {{#each existingPlants}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

DUPLICATE & VARIATION RULES:
1. Prioritize generating fresh, complementary plant species that are NOT already in the garden.
2. DO NOT include exact duplicates of existing plants.
3. ONLY include a variation, cultivar, or related species of an existing plant if there is a STRONG, compelling horticultural reason/match to do so (e.g., succession planting with staggered harvest, complementary pollination, or different growth habits like bush vs pole).
4. For any plant that is a variation or related cultivar of an existing plant, you MUST provide:
   - "isExistingVariation": true
   - "variationReason": A concise explanation of the strong horticultural reason/match for recommending this variation alongside the existing plant.
   - "relatedExistingPlant": The name or species of the existing garden plant it relates to.
5. For all other new, distinct plants, set "isExistingVariation": false.
{{/if}}

CRITICAL RULES FOR ACTIVE LOCATION:
1. Retain the user's garden name ("{{{activeLocation.name}}}") in the output location object. Do NOT invent a new garden name.
2. If the user's location is already specified ("{{{activeLocation.location}}}"), you MUST PRESERVE it exactly. Do NOT replace it with a different city.
3. If the user's location is empty or unspecified, preserve it as an empty string ("") or a general climate region, do NOT hallucinate an arbitrary city like San Francisco.
4. If temperature, sunlight, or soil conditions are already provided, PRESERVE them. If any are missing, estimate realistic seasonal values based on the location and {{{currentMonth}}}.
5. You MUST return the active location as the single item in the 'locations' array in your output.
{{else}}
Your task is to generate a dataset containing:
1.  A single garden location object that fits the theme. It must have a creative name (e.g., "Balcony Bounty," "Shady Oasis," "Urban Jungle"), a plausible real-world city/country, and realistic environmental conditions. You MUST determine and set the 'currentSeason' based on the location's hemisphere and the current month ({{{currentMonth}}}). The 'currentSeason' field MUST be one of the following exact strings: 'Spring', 'Summer', 'Autumn', or 'Winter'. Use Fahrenheit for US locations and Celsius otherwise. Also consider plausible growing systems and methods based on the theme.
2.  A list of plant species objects that are well-suited to the theme and the location you created, following the quantity instruction above.
3.  A corresponding list of 'planting' objects, one for each plant species.
{{/if}}

For each plant, you must provide:
- A unique ID (e.g., "ai-plant-1").
- The species name.
- A description of its germination needs. This MUST include explicit season information (e.g., "Sow in Spring").
- A description of its optimal growing conditions. This MUST include explicit season information (e.g., "Thrives in Summer", "Harvest in Autumn").

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
      console.log('createDataset input activeLocation:', JSON.stringify(flowInput.activeLocation));
      const activeLocSummary = flowInput.activeLocation
        ? `Active Garden: Name="${flowInput.activeLocation.name}", Location="${flowInput.activeLocation.location}", TempUnit="${flowInput.activeLocation.temperatureUnit}", Conditions=${JSON.stringify(flowInput.activeLocation.conditions)}, Systems="${flowInput.activeLocation.growingSystems || ''}", Methods="${flowInput.activeLocation.growingMethods || ''}". Retain this exact active location as the single item in the "locations" array.`
        : `Generate 1 garden location object in "locations" with id="ai-garden-1", a creative name, plausible city/country, temperatureUnit ("C" or "F"), and conditions {temperature, sunlight, soil, currentSeason ("Spring"|"Summer"|"Autumn"|"Winter")}.`;

      const existingPlantsRules =
        flowInput.existingPlants && flowInput.existingPlants.length > 0
          ? `Existing plants in this garden: ${flowInput.existingPlants.join(', ')}. Prioritize fresh species NOT already in the garden. If you include a cultivar/variation of an existing plant for a strong horticultural reason, set "isExistingVariation": true, "variationReason": "<explanation>", and "relatedExistingPlant": "<existing plant>". Otherwise set "isExistingVariation": false.`
          : `Set "isExistingVariation": false on all plants.`;

      const rawResult = await executeWithModelFallback<CreateDatasetOutput>(
        `createDataset(${flowInput.theme})`,
        (model) => prompt(flowInput, { model }),
        {
          hasGeminiKey: Boolean(apiKey),
          systemPrompt: `You are a world-class horticulturist and garden designer. Return ONLY valid JSON matching this exact structure:
{
  "locations": [
    {
      "id": "string",
      "name": "string",
      "location": "string",
      "temperatureUnit": "C" | "F",
      "conditions": {
        "temperature": "string",
        "sunlight": "string",
        "soil": "string",
        "currentSeason": "Spring" | "Summer" | "Autumn" | "Winter"
      },
      "growingSystems": "string",
      "growingMethods": "string"
    }
  ],
  "plants": [
    {
      "id": "ai-plant-1",
      "species": "Common Name (Scientific Name)",
      "germinationNeeds": "Detailed germination instructions including explicit season (Spring/Summer/Autumn/Winter)",
      "optimalConditions": "Detailed optimal conditions including explicit season",
      "isExistingVariation": false,
      "variationReason": "optional string",
      "relatedExistingPlant": "optional string"
    }
  ],
  "plantings": [
    {
      "id": "ai-planting-1",
      "plantId": "ai-plant-1",
      "gardenId": "string matching locations[0].id",
      "name": "Friendly planting name",
      "createdAt": "${new Date().toISOString()}",
      "history": [
        { "id": "h-1", "status": "Wishlist", "date": "${new Date().toISOString()}" }
      ]
    }
  ]
}`,
          userPrompt: `Generate a dataset of 5 to 8 distinct plants for Theme: "${flowInput.theme}" (Current Month: ${flowInput.currentMonth || 'Current'}).
${activeLocSummary}
${existingPlantsRules}
CRITICAL: Every item in "plants" MUST have a corresponding item in "plantings" whose "plantId" exactly matches "plant.id".`,
          groqApiKey: flowInput.apiKeys?.groq,
          openrouterApiKey: flowInput.apiKeys?.openrouter,
          ollamaUrl: flowInput.apiKeys?.ollamaUrl,
        }
      );

      // Normalize fallback model output so UI always receives linked locations, plants, and plantings
      const fallbackLoc = flowInput.activeLocation || {
        id: 'ai-garden-1',
        name: flowInput.theme.slice(0, 32) || 'AI Generated Garden',
        location: '',
        temperatureUnit: 'C' as const,
        conditions: {
          temperature: '18°C',
          sunlight: 'Full sun',
          soil: 'Well-drained loam',
          currentSeason: 'Spring' as const,
        },
      };
      const normalizedLocations =
        Array.isArray(rawResult?.locations) && rawResult.locations.length > 0
          ? rawResult.locations.map((loc, i) => ({
              ...fallbackLoc,
              ...loc,
              id: loc.id || (i === 0 ? fallbackLoc.id : `ai-garden-${i + 1}`),
              conditions: {
                ...fallbackLoc.conditions,
                ...(loc.conditions || {}),
              },
            }))
          : [fallbackLoc];

      const primaryGardenId = normalizedLocations[0].id;
      const normalizedPlants = Array.isArray(rawResult?.plants)
        ? rawResult.plants.map((p, idx) => ({
            ...p,
            id: p.id || `ai-plant-${idx + 1}`,
            species: p.species || `Plant ${idx + 1}`,
            germinationNeeds: p.germinationNeeds || 'Sow in Spring in moist soil.',
            optimalConditions: p.optimalConditions || 'Full sun to partial shade in Spring and Summer.',
          }))
        : [];

      const rawPlantings = Array.isArray(rawResult?.plantings) ? rawResult.plantings : [];
      const normalizedPlantings = normalizedPlants.map((plant, idx) => {
        const matchedPlanting =
          rawPlantings.find((pl) => pl.plantId === plant.id) || rawPlantings[idx];
        return {
          id: matchedPlanting?.id || `ai-planting-${idx + 1}`,
          plantId: plant.id,
          gardenId: primaryGardenId,
          name: matchedPlanting?.name || plant.species.split('(')[0].trim(),
          createdAt: matchedPlanting?.createdAt || new Date().toISOString(),
          seedsOnHand: 0,
          plannedQty: 0,
          history:
            Array.isArray(matchedPlanting?.history) && matchedPlanting.history.length > 0
              ? matchedPlanting.history
              : [
                  {
                    id: `hist-${idx + 1}`,
                    status: 'Wishlist' as const,
                    date: new Date().toISOString(),
                  },
                ],
        };
      });

      const finalResult: CreateDatasetOutput = {
        locations: normalizedLocations,
        plants: normalizedPlants,
        plantings: normalizedPlantings,
      };
      if ((rawResult as any)?._modelUsed) {
        (finalResult as any)._modelUsed = (rawResult as any)._modelUsed;
      }

      console.log('createDataset output locations:', JSON.stringify(finalResult.locations));
      return finalResult;
    }
  );

  return createDatasetFlow(input);
}
