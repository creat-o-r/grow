import { googleAI } from '@genkit-ai/google-genai';
import { openAI } from 'genkitx-openai';

export function getModel() {
  if (process.env.OPENAI_API_KEY) {
    return openAI('gpt-4o');
  }
  return googleAI('gemini-1.5-flash');
}
