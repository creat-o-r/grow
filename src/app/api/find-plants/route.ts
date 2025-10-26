// src/app/api/find-plants/route.ts
'use server';

import { findPlantsFlow } from '@/ai/flows/find-plants-flow';
import { streamToResponse, type Message } from 'ai';
import {
  toDataStream,
  type ToolsStreamingData,
} from 'ai/rsc';

export async function POST(req: Request) {
  const { messages }: { messages: Message[] } = await req.json();

  const result = await findPlantsFlow({
    history: messages,
  });
  
  const data = new ToolsStreamingData();

  // @ts-ignore
  if (result.stream) {
    // @ts-ignore
    result.stream.pipeThrough(toDataStream(data));
  } else {
    data.close();
  }
  
  return streamToResponse(result.output, data.stream);
}
