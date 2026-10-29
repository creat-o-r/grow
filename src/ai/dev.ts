
import { config } from 'dotenv';
config();

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getEnvironmentalData } from '@/ai/flows/get-environmental-data';
import { createDataset } from '@/ai/flows/create-dataset-flow';
import { getAiViability } from '@/ai/flows/get-ai-viability';
import { aiSearchPlantData } from '@/ai/flows/ai-search-plant-data';
import { diagnosePlant } from '@/ai/flows/diagnose-plant-flow';
import { generatePlantImage } from '@/ai/flows/generate-plant-image';

export const environmentalDataFlow = ai.defineFlow(
  {
    name: 'getEnvironmentalData',
    inputSchema: z.object({
      location: z.string().describe('City and country, e.g. "San Francisco, USA"'),
      currentMonth: z.string().optional().default('October').describe('Current month'),
    }),
    outputSchema: z.any(),
  },
  async (input) => getEnvironmentalData(input)
);

export const datasetFlow = ai.defineFlow(
  {
    name: 'createDataset',
    inputSchema: z.object({
      theme: z.string().describe('Garden theme, e.g. "planting now" or "herb garden"'),
      currentMonth: z.string().optional().default('October').describe('Current month'),
    }),
    outputSchema: z.any(),
  },
  async (input) => createDataset(input)
);

export const viabilityFlow = ai.defineFlow(
  {
    name: 'getAiViability',
    inputSchema: z.object({
      plant: z.object({
        species: z.string(),
        germinationNeeds: z.string(),
        optimalConditions: z.string(),
      }),
      garden: z.object({
        conditions: z.object({
          temperature: z.string(),
          sunlight: z.string(),
          soil: z.string(),
          currentSeason: z.string().optional(),
        }),
      }),
    }),
    outputSchema: z.any(),
  },
  async (input) => getAiViability(input)
);

export const searchPlantDataFlow = ai.defineFlow(
  {
    name: 'aiSearchPlantData',
    inputSchema: z.object({
      searchTerm: z.string().describe('Plant name or description'),
    }),
    outputSchema: z.any(),
  },
  async (input) => aiSearchPlantData(input)
);

export const diagnosePlantFlow = ai.defineFlow(
  {
    name: 'diagnosePlant',
    inputSchema: z.object({
      description: z.string().describe('Description of the issue'),
      photoDataUri: z.string().describe('Data URI of plant photo'),
    }),
    outputSchema: z.any(),
  },
  async (input) => diagnosePlant(input)
);

export const generatePlantImageFlow = ai.defineFlow(
  {
    name: 'generatePlantImage',
    inputSchema: z.object({
      species: z.string().describe('Botanical species name'),
    }),
    outputSchema: z.any(),
  },
  async (input) => generatePlantImage(input)
);

