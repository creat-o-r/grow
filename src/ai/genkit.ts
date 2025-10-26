
import { genkit, type GenkitOptions } from 'genkit';
import { googleAI, type GoogleAIGenkitPluginOptions } from '@genkit-ai/google-genai';

export type ApiKeyName = 'gemini';

// Store for API keys provided by the client
let apiKeys: Record<ApiKeyName, string> = {
  gemini: '',
};

/**
 * Initializes the Genkit AI instance with the provided API keys.
 * This function should be called before any AI flows are executed.
 */
export const initializeGenkit = (keys: Record<ApiKeyName, string>) => {
  apiKeys = { ...apiKeys, ...keys };
  console.log('Genkit initialized with new keys.');
};


/**
 * Dynamically creates Genkit options based on available API keys.
 * This allows the AI flows to use the correct credentials.
 */
const getGenkitOptions = (): GenkitOptions => {
  const plugins: any[] = [];
  const geminiApiKey = apiKeys.gemini || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

  if (geminiApiKey) {
    plugins.push(googleAI({ apiKey: geminiApiKey }));
  }

  return { plugins };
};

// We create a proxy for the 'ai' object. This allows us to dynamically
// re-initialize Genkit with new configurations (e.g., when API keys are updated)
// without needing to restart the server. The proxy intercepts calls to Genkit
// functions and ensures that the underlying Genkit instance has the latest configuration.
export const ai = new Proxy(
  genkit(getGenkitOptions()),
  {
    get: (target, prop, receiver) => {
      // Re-initialize Genkit with the latest options before any call.
      const newTarget = genkit(getGenkitOptions());
      return Reflect.get(newTarget, prop, receiver);
    },
  }
);
