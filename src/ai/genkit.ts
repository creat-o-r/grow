
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { openAI } from 'genkitx-openai';
import { groq } from 'genkitx-groq';
import openAICompatible, {
  defineCompatOpenAIModel,
  compatOaiModelRef,
} from '@genkit-ai/compat-oai';
import { ApiKeyName } from '@/lib/types';

export type ApiKeys = Record<ApiKeyName, string>;

export function initializeGenkit(apiKeys?: ApiKeys) {
  const plugins = [];

  const geminiApiKey = apiKeys?.gemini || process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    plugins.push(googleAI({ apiKey: geminiApiKey }));
  }

  const openaiApiKey = apiKeys?.openai || process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    plugins.push(openAI({ apiKey: openaiApiKey }));
  }

  const groqApiKey = apiKeys?.groq || process.env.GROQ_API_KEY;
  if (groqApiKey) {
    plugins.push(groq({ apiKey: groqApiKey }));
  }

  const openRouterApiKey = apiKeys?.openrouter || process.env.OPENROUTER_API_KEY;
  if (openRouterApiKey) {
    const openRouterVendors = {
      google: ['gemini-flash-1.5'],
      microsoft: ['phi-3-medium-128k-instruct'],
    };

    for (const [vendor, modelNames] of Object.entries(openRouterVendors)) {
      plugins.push(
        openAICompatible({
          name: `openrouter-${vendor}`,
          apiKey: openRouterApiKey,
          baseURL: 'https://openrouter.ai/api/v1',
          initializer: async (client) => {
            return modelNames.map((modelName) =>
              defineCompatOpenAIModel({
                client,
                name: `openrouter-${vendor}/${modelName}`,
                modelRef: compatOaiModelRef({
                  name: `${vendor}/${modelName}`,
                  info: {
                    label: `OpenRouter - ${vendor}/${modelName}`,
                    supports: {
                      media: false,
                      tools: false,
                      systemRole: true,
                    },
                  },
                }),
              })
            );
          },
        })
      );
    }
  }

  return genkit({
    plugins,
  });
}

export const ai = initializeGenkit();
