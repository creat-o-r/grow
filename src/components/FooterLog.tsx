
'use client';

import { AiLog } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';

type FooterLogProps = {
  logs: AiLog[];
};

export function FooterLog({ logs }: FooterLogProps) {
  return (
    <footer className="sticky bottom-0 z-10 mt-auto border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 md:px-8">
        <Card className="border-0 shadow-none bg-transparent">
          <CardHeader>
            <CardTitle className="font-headline text-lg">AI Reasoning Log</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 w-full">
              <div className="space-y-4 pr-6">
                {logs.map(log => (
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
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </footer>
  );
}
