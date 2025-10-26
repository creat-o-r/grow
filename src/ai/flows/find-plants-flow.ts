'use server';
/**
 * @fileOverview An AI agent that finds plants based on user queries and adds them to a dataset.
 *
 * - findPlantsFlow - A function that handles the conversational plant search.
 */
import { ai } from '@/ai/genkit';
import { getModel } from '@/ai/model';
import { findPlantsTool } from '@/ai/tools/find-plants-tool';
import { z } from 'zod';
import { GenerateOptions } from 'genkit';

const MessageSchema = z.object({
  role: z.enum(['user', 'model', 'system', 'tool']),
  content: z.string(),
});

const FindPlantsFlowInputSchema = z.object({
  history: z.array(MessageSchema),
});

export const findPlantsFlow = async (input: z.infer<typeof FindPlantsFlowInputSchema>) => {
    const model = await getModel();
    return ai.run('plantFinder', async () => {
        const result = await ai.generate({
            prompt: `You are an expert botanist and garden planner. Your task is to help users find plants for their garden based on their descriptions.
- Use the findPlantsTool to search for plants.
- You can ask clarifying questions if the user's request is ambiguous.
- When you find plants, call the tool. Do not list them in your text response. Let the tool output speak for itself.
- If no plants are found, inform the user.
- The user may ask for one or more plants. The tool can handle searching for multiple plants in a single call. For example, if the user asks for "tomatoes and cucumbers", you should call the tool with an array like ["tomato", "cucumber"].`,
            history: input.history,
            tools: [findPlantsTool],
            model,
        } as GenerateOptions);

        return result;
    });
};
