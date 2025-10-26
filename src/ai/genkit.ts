import {genkit, type Genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

let ai: Genkit;

/**
 * Initializes the Genkit instance with the provided API key.
 * If an API key is provided, it configures the googleAI plugin with it.
 * Otherwise, it initializes Genkit with the googleAI plugin without an API key,
 * relying on the GOOGLE_GENAI_API_KEY environment variable.
 */
export function initializeGenkit(apiKey?: string): Genkit {
  if (apiKey) {
    ai = genkit({
      plugins: [
        googleAI({
          apiKey,
        }),
      ],
    });
  } else {
    ai = genkit({
      plugins: [
        googleAI(),
      ],
    });
  }
  return ai;
}

// Initialize a default instance.
initializeGenkit();

export {ai};
