
'use client';

import type { AiLog } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Settings } from 'lucide-react';

type AiLogPanelProps = {
  logs: AiLog[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onOpenSettings: () => void;
  areApiKeysSet: boolean;
};

const FLOW_DISPLAY_NAMES: { [key: string]: string } = {
    getEnvironmentalData: 'Environmental Analysis',
    aiSearchPlantData: 'Plant Data Search',
};

// Helper function to render result values
const renderResultValue = (value: any) => {
    if (typeof value === 'object' && value !== null) {
        return <pre className="text-xs p-2 bg-muted rounded-md overflow-x-auto whitespace-pre-wrap text-foreground">{JSON.stringify(value, null, 2)}</pre>;
    }
    return <span>{String(value)}</span>;
}

// Helper to convert camelCase to Title Case
const toTitleCase = (str: string) => {
    return str
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase());
}

export function AiLogPanel({ logs, isOpen, onOpenChange, onOpenSettings, areApiKeysSet }: AiLogPanelProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-[90vw] flex flex-col">
        <SheetHeader>
          <div className="flex justify-between items-center">
            <div>
              <SheetTitle className="font-headline">AI Reasoning Log</SheetTitle>
              <SheetDescription>
                A history of analyses performed by the AI.
              </SheetDescription>
            </div>
            <Button variant="outline" size="icon" onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
              <span className="sr-only">Open Settings</span>
            </Button>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="space-y-6 pr-6 py-4">
              {!areApiKeysSet && (
                  <Card className="p-4 text-center">
                      <CardHeader>
                          <CardTitle>API Key Required</CardTitle>
                          <CardDescription>Please set an API key in the settings to enable AI features.</CardDescription>
                      </CardHeader>
                      <CardContent>
                          <Button onClick={() => {
                              onOpenChange(false);
                              onOpenSettings();
                          }}>
                              Go to Settings
                          </Button>
                      </CardContent>
                  </Card>
              )}
              {logs.length > 0 ? logs.map(log => {
                  const reasoning = (log.results as any)?.reasoning;
                  const references = (log.results as any)?.references;

                  const resultsToShow = { ...log.results };
                  if (resultsToShow) {
                    delete (resultsToShow as any).reasoning;
                    delete (resultsToShow as any).references;
                  }

                  const displayName = FLOW_DISPLAY_NAMES[log.flow] || log.flow;

                  return (
                    <Card key={log.id} className="text-sm">
                      <CardHeader className='pb-3'>
                        <CardTitle className="text-base font-medium flex justify-between items-center">
                            <span className='font-mono text-primary'>{displayName}</span>
                            <span className="font-sans font-normal text-xs text-muted-foreground">{format(parseISO(log.timestamp), 'MMM d, yyyy, h:mm:ss a')}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {log.prompt && (
                          <div>
                            <h4 className="font-semibold mb-2">Prompt</h4>
                             <div className="text-xs p-3 bg-muted rounded-md text-foreground space-y-1">
                                {Object.entries(log.prompt).map(([key, value]) => (
                                    <div key={key}>
                                        <span className='font-semibold text-muted-foreground'>{toTitleCase(key)}: </span>
                                        <span>{String(value)}</span>
                                    </div>
                                ))}
                            </div>
                          </div>
                        )}
                        {log.results && Object.keys(resultsToShow).length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Results</h4>
                            <div className="text-sm p-3 bg-muted rounded-md text-foreground space-y-2">
                               {Object.entries(resultsToShow).map(([key, value]) => (
                                    <div key={key} className="grid grid-cols-3 gap-2">
                                        <span className='font-semibold text-muted-foreground col-span-1'>{toTitleCase(key)}</span>
                                        <div className='col-span-2'>{renderResultValue(value)}</div>
                                    </div>
                               ))}
                            </div>
                          </div>
                        )}
                         {reasoning && (
                          <div>
                            <h4 className="font-semibold mb-2">Reasoning</h4>
                            <p className="text-sm whitespace-pre-wrap text-foreground/80">{reasoning}</p>
                          </div>
                        )}
                        {references && (
                          <div>
                            <h4 className="font-semibold mb-2">References</h4>
                            <p className="text-sm whitespace-pre-wrap text-foreground/80">{references}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                }) : areApiKeysSet ? (
                  <p className="text-sm text-muted-foreground italic text-center py-8">No AI analyses have been performed yet.</p>
                ) : null}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}

    
