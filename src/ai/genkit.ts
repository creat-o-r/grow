
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  'placeholder-key-for-dev';

export const ai = genkit({
  plugins: [
    googleAI({ apiKey }),
  ],
});



    