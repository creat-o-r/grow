
'use server';

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const AISuggestPlantsForGoalInputSchema = z.object({
  goal: z.object({
    name: z.string(),
    description: z.string(),
  }),
  apiKeys: z.object({
      gemini: z.string().optional(),
  }).optional(),
});
type AISuggestPlantsForGoalInput = z.infer<typeof AISuggestPlantsForGoalInputSchema>;

const AISuggestPlantsForGoalOutputSchema = z.object({
  suggestedPlants: z.array(z.object({
    commonName: z.string(),
    species: z.string(),
    reasoning: z.string(),
  })),
});
type AISuggestPlantsForGoalOutput = z.infer<typeof AISuggestPlantsForGoalOutputSchema>;

export async function aiSuggestPlantsForGoal(
  input: AISuggestPlantsForGoalInput,
): Promise<AISuggestPlantsForGoalOutput> {

  const ai = genkit({
    plugins: [
      googleAI({ apiKey: input.apiKeys?.gemini || process.env.GOOGLE_GENAI_API_KEY }),
    ],
  });

  const prompt = ai.definePrompt({
    name: 'aiSuggestPlantsForGoalPrompt',
    input: {schema: AISuggestPlantsForGoalInputSchema},
    output: {schema: AISuggestPlantsForGoalOutputSchema},
    prompt: `You are an expert gardener. Suggest plants that would be suitable for the following garden goal:

Goal Name: {{{goal.name}}}
Goal Description: {{{goal.description}}}

Return a list of suggested plants with their common name, scientific species name, and a brief reasoning for why it's a good fit for the goal.
Ensure the output is structured according to the provided output schema.`,
  });

  const aiSuggestPlantsForGoalFlow = ai.defineFlow(
    {
      name: 'aiSuggestPlantsForGoalFlow',
      inputSchema: AISuggestPlantsForGoalInputSchema,
      outputSchema: AISuggestPlantsForGoalOutputSchema,
    },
    async (flowInput) => {
      const {output} = await prompt(flowInput, { model: 'googleai/gemini-pro' });
      return output!;
    }
  );

  return aiSuggestPlantsForGoalFlow(input);
}
