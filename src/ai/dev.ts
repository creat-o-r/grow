
import { config } from 'dotenv';
config();

import '@/ai/flows/ai-search-plant-data.ts';
import '@/ai/flows/get-environmental-data.ts';
import '@/ai/flows/create-dataset-flow.ts';
import '@/ai/flows/get-ai-viability.ts';
import '@/ai/flows/generate-plant-image.ts';
import '@/ai/genkit.ts';
