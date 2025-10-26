
import { dataImportFlow } from '../../../../ai/flows/data-import';
import { Message, StreamingTextResponse } from 'ai';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { messages }: { messages: Message[] } = await req.json();

  const flowResponse = await dataImportFlow({ history: messages });
  const aiMessage = flowResponse.output?.content || "Sorry, I couldn't process that.";

  // In a real implementation, you would stream the response.
  // For now, we'll return the full response as a stream of one.
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(aiMessage);
      controller.close();
    },
  });

  return new StreamingTextResponse(stream);
}
