
import { NextRequest, NextResponse } from 'next/server';
import { dataImportFlow } from '@/ai/flows/data-import';
import { Message, StreamingTextResponse } from 'ai';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const response = await dataImportFlow({ history: messages });

    // In a real implementation, you would stream the response.
    // For now, we'll return the full response as a stream of one.
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(response);
            controller.close();
        },
    });

    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error('Error in data import API route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
