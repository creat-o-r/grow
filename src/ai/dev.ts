import { config } from 'dotenv';
config();

import '@/ai/flows/ai-search-plant-data.ts';
import '@/ai/flows/get-environmental-data.ts';
import '@/ai/flows/create-dataset-flow.ts';
import '@/ai/flows/get-viability-reasoning.ts';
import '@/ai/genkit.ts';
