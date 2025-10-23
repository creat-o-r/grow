
'use client';

import type { AiLog } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type AiLogPanelProps = {
  logs: AiLog[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function AiLogPanel({ logs, isOpen, onOpenChange }: AiLogPanelProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-[90vw] flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-headline">AI Reasoning Log</SheetTitle>
          <SheetDescription>
            A history of analyses performed by the AI.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="space-y-6 pr-6 py-4">
              {logs.length > 0 ? logs.map(log => (
                <Card key={log.id} className="text-sm">
                  <CardHeader className='pb-3'>
                    <CardTitle className="text-base font-medium flex justify-between items-center">
                        <span className='font-mono text-primary'>{log.flow}</span>
                        <span className="font-sans font-normal text-xs text-muted-foreground">{format(parseISO(log.timestamp), 'MMM d, yyyy, h:mm:ss a')}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Prompt</h4>
                      <pre className="p-3 bg-muted text-muted-foreground rounded-md text-xs overflow-x-auto">
                        {JSON.stringify(log.prompt, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Results</h4>
                       <pre className="p-3 bg-muted text-muted-foreground rounded-md text-xs overflow-x-auto">
                        {JSON.stringify(log.results, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                  <p className="text-sm text-muted-foreground italic">No AI analyses have been performed yet.</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
