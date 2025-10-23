'use client';

import type { AiLog } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';

type AiLogPanelProps = {
  logs: AiLog[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function AiLogPanel({ logs, isOpen, onOpenChange }: AiLogPanelProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg w-[90vw] flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-headline">AI Reasoning Log</SheetTitle>
          <SheetDescription>
            A history of analyses performed by the AI.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full w-full">
              <div className="space-y-4 pr-6 py-4">
                {logs.length > 0 ? logs.map(log => (
                  <div key={log.id} className="text-sm">
                    <p className="font-semibold text-foreground">
                      {log.location} - <span className="font-normal text-muted-foreground">{format(parseISO(log.timestamp), 'MMM d, yyyy, h:mm:ss a')}</span>
                    </p>
                    <p className="mt-1 text-foreground/80">{log.reasoning}</p>
                    {log.references && (
                      <p className="mt-1 text-xs text-muted-foreground italic">
                        References: {log.references}
                      </p>
                    )}
                  </div>
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
