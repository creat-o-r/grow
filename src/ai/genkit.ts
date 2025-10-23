import {genkit, GenkitPlugin} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {openAI} from 'genkitx-openai';

const plugins: GenkitPlugin[] = [googleAI()];

if (process.env.OPENAI_API_KEY) {
  plugins.push(openAI({apiKey: process.env.OPENAI_API_KEY}));
}

export const ai = genkit({
  plugins,
});
