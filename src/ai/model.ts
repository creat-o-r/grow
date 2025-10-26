
'use server';
/**
 * @fileOverview A model selector for the Genkit AI flows.
 *
 * This file provides a function to dynamically select the AI model.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';


/**
 * Gets the appropriate AI model.
 */
export async function getModel(apiKey?: string): Promise<any> {
    const ai = genkit({
        plugins: [
          googleAI({ apiKey: apiKey || process.env.GOOGLE_GENAI_API_KEY }),
        ],
    });

    return ai.model('gemini-2.5-flash');
}

    