
import {genkit, GenkitPlugin} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {openAI} from 'genkitx-openai';

const plugins: GenkitPlugin[] = [
  googleAI({apiKey: process.env.GEMINI_API_KEY}),
];

// Only add the OpenAI plugin if the key is available during the server's runtime.
if (process.env.OPENAI_API_KEY) {
  plugins.push(openAI({apiKey: process.env.OPENAI_API_KEY}));
}

export const ai = genkit({
  plugins,
});
