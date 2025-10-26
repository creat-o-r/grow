'use server';

import { findPlantsFlow } from '@/ai/flows/find-plants-flow';
import { StreamingTextResponse } from 'ai';

export async function POST(req: Request) {
  const { messages }: { messages: any[] } = await req.json();

  const result = await findPlantsFlow({
    history: messages,
  });
  
  if ('run' in result && result.run) {
    const toolCallMessage = result.run.history[result.run.history.length -1];
    if (toolCallMessage.role === 'tool' && toolCallMessage.content.toolName === 'findPlantsTool') {
       return new Response(JSON.stringify(toolCallMessage.content.output), {
        headers: {
            'Content-Type': 'application/json',
            'X-Experimental-Stream-Data': 'true'
        }
       });
    }
  }

  if (result.output) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(result.output);
        controller.close();
      },
    });
    return new StreamingTextResponse(stream);
  }

  return new Response(JSON.stringify({ error: 'No output from flow' }), { status: 500 });
}
