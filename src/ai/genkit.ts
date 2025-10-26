
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { openAI } from 'genkitx-openai';
import { groq } from 'genkitx-groq';
import openAICompatible from '@genkit-ai/compat-oai';

export type ApiKeys = Record<string, string>;

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
        name: 'openrouter',
        apiKey: openRouterApiKey,
        baseURL: 'https://openrouter.ai/api/v1',
      }),
    );
  }

  return genkit({
    plugins,
  });
}

export const ai = initializeGenkit();
