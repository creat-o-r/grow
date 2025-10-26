import { defineFlow, run } from 'genkit';
import { z } from 'zod';
import { getModel } from '../model';
import { importData, DataImportSchema } from '../tools/import-data';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

export const dataImportFlow = defineFlow(
  {
    name: 'dataImportFlow',
    inputSchema: z.object({
      history: z.array(MessageSchema),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const model = await getModel();
    const result = await run('data-importer', async () => {
      const llmResponse = await model.generate({
        prompt: `The user wants to import data. Your job is to analyze the user's message, extract the data, and call the importData tool.`,
        history: input.history,
        tools: [importData],
      });
      return llmResponse.output();
    });
    // @ts-ignore
    return result.content;
  },
);
