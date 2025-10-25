
import { genkit, GenkitPlugin } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { openAI } from 'genkitx-openai';
import { groq } from 'genkitx-groq';

const plugins: GenkitPlugin[] = [];

if (process.env.GEMINI_API_KEY) {
  plugins.push(googleAI({ apiKey: process.env.GEMINI_API_KEY }));
}
if (process.env.OPENAI_API_KEY) {
  plugins.push(openAI({ apiKey: process.env.OPENAI_API_KEY }));
}
if (process.env.GROQ_API_KEY) {
  plugins.push(groq({ apiKey: process.env.GROQ_API_KEY }));
}

export const ai = genkit({
  plugins,
});
