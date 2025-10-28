
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { openAI } from 'genkitx-openai';
import OpenAI from 'openai';
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
    plugins.push(
      openAICompatible({
        name: 'openrouter-google',
        apiKey: openRouterApiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        initializer: async (client) => [
          defineCompatOpenAIModel({
            client,
            name: 'openrouter-google-gemma-2-9b', // Safe Genkit name
            modelRef: compatOaiModelRef({
              name: 'google/gemma-2-9b-it:free', // Full API model ID
              info: {
                label: 'OpenRouter: Google Gemma 2 9B',
                supports: { media: false, tools: false, systemRole: true },
              },
            }),
          }),
        ],
      }),
      openAICompatible({
        name: 'openrouter-mistralai',
        apiKey: openRouterApiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        initializer: async (client) => [
          defineCompatOpenAIModel({
            client,
            name: 'openrouter-mistral-7b-instruct', // Safe Genkit name
            modelRef: compatOaiModelRef({
              name: 'mistralai/mistral-7b-instruct:free', // Full API model ID
              info: {
                label: 'OpenRouter: Mistral 7B Instruct',
                supports: { media: false, tools: false, systemRole: true },
              },
            }),
          }),
        ],
      })
    );
  }

  return genkit({
    plugins,
  });
}

export const ai = initializeGenkit();
