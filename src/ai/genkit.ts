
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {openai} from 'genkitx-openai';

export const ai = genkit({
  plugins: [
    googleAI(),
    openai()
  ],
});
