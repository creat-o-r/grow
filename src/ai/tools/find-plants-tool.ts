'use server';

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getModel } from '@/ai/model';

const PlantSchema = z.object({
  species: z.string().describe('The full species name of the plant, including the common name and scientific name if available.'),
  germinationNeeds: z.string().describe('Detailed instructions for germinating the plant seed.'),
  optimalConditions: z.string().describe('Detailed description of the optimal growing conditions for the plant (sunlight, soil, water, etc.).'),
});

const FindPlantsOutputSchema = z.object({
  plants: z.array(PlantSchema),
});

export const findPlantsTool = ai.defineTool(
  {
    name: 'findPlantsTool',
    description: 'Searches for information on one or more plants based on a list of search terms.',
    inputSchema: z.object({
      plantNames: z.array(z.string()).describe("An array of plant names or descriptions to search for. E.g., ['heirloom tomatoes', 'cucumbers for pickling']"),
    }),
    outputSchema: FindPlantsOutputSchema,
  },
  async (input) => {
    const model = await getModel();
    console.log('Finding plants for:', input.plantNames);

    const searchPrompt = ai.definePrompt({
        name: 'plantSearcherPrompt',
        input: { schema: PlantSchema },
        output: { schema: PlantSchema },
        prompt: `You are a master botanist. Provided with a plant name, you must return detailed, accurate information about it.
        
        Plant Name: {{{species}}}
        
        Your task is to fill out the germination needs and optimal conditions for this plant.
        - germinationNeeds: Be specific. Include temperature, light requirements, timing (e.g., "start indoors 6-8 weeks before last frost"), and any special treatments like stratification.
        - optimalConditions: Be thorough. Include ideal sunlight (e.g., "full sun, 6-8 hours"), soil type (e.g., "well-drained, sandy loam"), pH levels, watering needs, and temperature range.
        
        Provide the information in the requested Zod schema format.`,
    });

    const plants = await Promise.all(
      input.plantNames.map(async (plantName) => {
        try {
          const { output } = await searchPrompt({ species: plantName }, { model });
          return output || null;
        } catch (error) {
          console.error(`Error searching for ${plantName}:`, error);
          return null;
        }
      })
    );

    const foundPlants = plants.filter((p): p is z.infer<typeof PlantSchema> => p !== null);
    
    return { plants: foundPlants };
  }
);
