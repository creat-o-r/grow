
'use client';

import type { AiLog } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Settings, AlertTriangle, ThumbsDown, ThumbsUp, BrainCircuit, Cpu, Target } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { db } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';


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
    createDataset: 'AI Dataset Creation',
    getAiViability: 'AI Viability Analysis',
    localViabilityAnalysis: 'Local Viability Analysis',
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
    const { toast } = useToast();
    
    const handleFeedback = async (logId: string, feedback: 'way-off' | 'bad' | 'ok' | 'spot-on') => {
        try {
            await db.aiLogs.update(logId, { feedback });
            toast({
                title: 'Feedback Submitted',
                description: `You rated this analysis as "${feedback}".`,
            });
        } catch (error) {
            console.error("Failed to submit feedback", error);
            toast({
                title: 'Error',
                description: 'Could not save your feedback.',
                variant: 'destructive',
            });
        }
    };
    
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
              { !areApiKeysSet &&
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>API Key Not Set</AlertTitle>
                  <AlertDescription>
                    The AI features are disabled. Please set your Gemini API key in the settings.
                  </AlertDescription>
                </Alert>
              }
              {logs.length > 0 ? logs.map(log => {
                  const reasoning = (log.results as any)?.reasoning;
                  const references = (log.results as any)?.references;

                  const resultsToShow = { ...log.results };
                  if (resultsToShow) {
                    delete (resultsToShow as any).reasoning;
                    delete (resultsToShow as any).references;
                  }

                  const displayName = FLOW_DISPLAY_NAMES[log.flow] || log.flow;
                  const showFeedback = log.flow === 'getAiViability' || log.flow === 'localViabilityAnalysis' || log.flow === 'getEnvironmentalData';

                  return (
                    <Card key={log.id} className="text-sm">
                      <CardHeader className='pb-3'>
                        <CardTitle className="text-base font-medium flex justify-between items-start">
                            <div className="flex flex-col gap-1.5">
                                <span className='font-mono text-primary'>{displayName}</span>
                                {log.viabilityType && (
                                    <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                                        {log.viabilityType === 'ai' ? <BrainCircuit className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
                                        {log.viabilityType === 'ai' ? 'AI-Powered Analysis' : 'Local Analysis'}
                                    </span>
                                )}
                            </div>
                            <span className="font-sans font-normal text-xs text-muted-foreground flex-shrink-0 ml-4">{format(parseISO(log.timestamp), 'MMM d, yyyy, h:mm:ss a')}</span>
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
                                        <span>{renderResultValue(value)}</span>
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
                                    <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <span className='font-semibold text-muted-foreground col-span-1'>{toTitleCase(key)}</span>
                                        <div className='md:col-span-2'>{renderResultValue(value)}</div>
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
                      {showFeedback && (
                        <CardFooter className="flex flex-col items-start gap-3">
                            <h4 className="text-xs font-semibold text-muted-foreground">Rate this analysis</h4>
                            <div className="flex gap-2">
                                <Button 
                                    size="sm" 
                                    variant={log.feedback === 'way-off' ? 'destructive' : 'outline'}
                                    onClick={() => handleFeedback(log.id, 'way-off')}
                                >
                                    Way Off
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant={log.feedback === 'bad' ? 'destructive' : 'outline'}
                                    className={cn(log.feedback === 'bad' && 'bg-red-700/80 hover:bg-red-700')}
                                    onClick={() => handleFeedback(log.id, 'bad')}
                                >
                                   <ThumbsDown className="mr-2 h-4 w-4" /> Bad
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant={log.feedback === 'ok' ? 'secondary' : 'outline'}
                                    className={cn(log.feedback === 'ok' && 'bg-yellow-500/80 text-secondary-foreground hover:bg-yellow-500')}
                                    onClick={() => handleFeedback(log.id, 'ok')}
                                >
                                    <ThumbsUp className="mr-2 h-4 w-4" /> OK
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant={log.feedback === 'spot-on' ? 'secondary' : 'outline'}
                                    className={cn(log.feedback === 'spot-on' && 'bg-green-600/80 text-secondary-foreground hover:bg-green-600')}
                                    onClick={() => handleFeedback(log.id, 'spot-on')}
                                >
                                    <Target className="mr-2 h-4 w-4" /> Spot On
                                </Button>
                            </div>
                        </CardFooter>
                      )}
                    </Card>
                  )
                }) : (
                  <p className="text-sm text-muted-foreground italic text-center py-8">No AI analyses have been performed yet.</p>
                )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
