
import { z } from 'zod';
import { getModel } from '../model';
import { importData } from '../tools/import-data';
import { initializeGenkit } from '../genkit';
import { GenerateOptions } from 'genkit';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const DataImportFlowInputSchema = z.object({
  history: z.array(MessageSchema),
});

export const dataImportFlow = async (input: z.infer<typeof DataImportFlowInputSchema>) => {
  const ai = initializeGenkit();
  const dataImportFlow = ai.defineFlow(
    {
      name: 'dataImportFlow',
      inputSchema: DataImportFlowInputSchema,
      outputSchema: z.string(),
    },
    async (flowInput) => {
      const model = await getModel();
      const result = await ai.run('data-importer', async () => {
        const llmResponse = await ai.generate({
          prompt: `The user wants to import data. Your job is to analyze the user's message, extract the data, and call the importData tool.`,
          history: flowInput.history,
          tools: [importData()],
          model,
        } as GenerateOptions);
        return llmResponse.output();
      });
      // @ts-ignore
      return result.content;
    },
  );
  return dataImportFlow(input);
};
