'use client';

import React, { useState } from 'react';
import type { AiLog } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import {
  Settings,
  AlertTriangle,
  ThumbsDown,
  ThumbsUp,
  BrainCircuit,
  Cpu,
  Target,
  Trash2,
  Calendar,
  Sprout,
  Leaf,
  TrendingUp,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { db } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { publishCommunityViabilitySignal } from '@/lib/p2p-signals';

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

const VIABILITY_BADGE_CLASSES: Record<string, string> = {
  High: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800',
  Low: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800',
  'N/A': 'bg-muted text-muted-foreground border-muted-foreground/30 dark:bg-muted/50 dark:text-muted-foreground',
};

const SEASON_EMOJIS: Record<string, string> = {
  Spring: '🌱',
  Summer: '☀️',
  Autumn: '🍂',
  Winter: '❄️',
};

// Helper function to render result values
const renderResultValue = (value: any) => {
  if (typeof value === 'object' && value !== null) {
    return <pre className="text-xs p-2 bg-muted rounded-md overflow-x-auto whitespace-pre-wrap text-foreground font-mono">{JSON.stringify(value, null, 2)}</pre>;
  }
  return <span>{String(value)}</span>;
};

// Helper to convert camelCase to Title Case
const toTitleCase = (str: string) => {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase());
};

export function AiLogPanel({ logs, isOpen, onOpenChange, onOpenSettings, areApiKeysSet }: AiLogPanelProps) {
  const { toast } = useToast();
  const [isClearing, setIsClearing] = useState(false);

  const handleClearLogs = async () => {
    if (logs.length === 0) return;
    if (window.confirm('Clear all AI reasoning logs from local database?')) {
      try {
        setIsClearing(true);
        await db.aiLogs.clear();
        toast({
          title: 'Logs Cleared',
          description: 'All AI reasoning logs have been removed.',
        });
      } catch (err) {
        console.error('Failed to clear logs:', err);
        toast({
          title: 'Error',
          description: 'Could not clear AI logs.',
          variant: 'destructive',
        });
      } finally {
        setIsClearing(false);
      }
    }
  };

  const handleFeedback = async (logId: string, feedback: 'way-off' | 'bad' | 'ok' | 'spot-on') => {
    try {
      await db.aiLogs.update(logId, { feedback });
      const targetLog = logs.find((l) => l.id === logId);
      if (targetLog && (feedback === 'spot-on' || feedback === 'way-off')) {
        const speciesName =
          targetLog.prompt?.plant?.species ||
          (typeof targetLog.prompt?.plant === 'string' ? targetLog.prompt.plant : null) ||
          targetLog.flow;
        const signal = await publishCommunityViabilitySignal({
          species: speciesName,
          region: targetLog.prompt?.location || 'Local Microclimate',
          season: targetLog.prompt?.garden?.conditions?.currentSeason,
          soil: targetLog.prompt?.garden?.conditions?.soil,
          verdict: feedback,
          viability: targetLog.results?.viability,
        });
        await db.aiLogs.update(logId, { sharedSignalId: signal.id });
      }
      toast({
        title: 'Feedback & Crowd Signal Saved',
        description:
          feedback === 'spot-on' || feedback === 'way-off'
            ? `Rated "${feedback}" and broadcasted to your P2P viability log.`
            : `You rated this analysis as "${feedback}".`,
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

  // Render prompt section with sensitive keys excluded and structured botanical formatting
  const renderPrompt = (prompt: any) => {
    if (!prompt || typeof prompt !== 'object') {
      return <div>{renderResultValue(prompt)}</div>;
    }

    const filteredKeys = Object.keys(prompt).filter((k) => k !== 'apiKeys');

    return (
      <div className="text-xs p-3 bg-muted rounded-md text-foreground space-y-2.5">
        {prompt.plant && typeof prompt.plant === 'object' && (
          <div className="rounded border bg-background/80 p-2.5 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="font-semibold text-primary text-sm">{prompt.plant.species}</span>
              <div className="flex items-center gap-1.5">
                {prompt.stage && (
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    Stage: {prompt.stage}
                  </Badge>
                )}
                {prompt.propagationMethod && (
                  <Badge variant="outline" className="text-[10px] font-mono capitalize">
                    {prompt.propagationMethod.replace('-', ' ')}
                  </Badge>
                )}
              </div>
            </div>
            {prompt.plant.germinationNeeds && (
              <p className="text-[11px] text-muted-foreground leading-snug">
                <span className="font-medium text-foreground">Germination: </span>
                {prompt.plant.germinationNeeds}
              </p>
            )}
            {prompt.plant.optimalConditions && (
              <p className="text-[11px] text-muted-foreground leading-snug">
                <span className="font-medium text-foreground">Optimal: </span>
                {prompt.plant.optimalConditions}
              </p>
            )}
          </div>
        )}

        {prompt.garden && typeof prompt.garden === 'object' && prompt.garden.conditions && (
          <div className="rounded border bg-background/80 p-2.5 space-y-1.5 shadow-2xs">
            <span className="font-semibold text-foreground text-xs flex items-center gap-1">
              <span>🏡</span> Garden Microclimate &amp; Growing Environment:
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1">
              <div>
                <span className="text-muted-foreground">Season: </span>
                <span className="font-medium text-foreground">{prompt.garden.conditions.currentSeason || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Temp: </span>
                <span className="font-medium text-foreground">{prompt.garden.conditions.temperature || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Sunlight: </span>
                <span className="font-medium text-foreground">{prompt.garden.conditions.sunlight || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Method: </span>
                <span className="font-medium text-foreground">{prompt.garden.growingMethods || 'direct sow'}</span>
              </div>
            </div>
            {prompt.garden.conditions.soil && (
              <div className="text-[11px] pt-1 border-t border-border/40 leading-snug">
                <span className="text-muted-foreground font-medium">Soil: </span>
                <span className="text-foreground/90">{prompt.garden.conditions.soil}</span>
              </div>
            )}
            {prompt.garden.growingSystems && (
              <div className="text-[11px] leading-snug">
                <span className="text-muted-foreground font-medium">Systems: </span>
                <span className="text-foreground/90">{prompt.garden.growingSystems}</span>
              </div>
            )}
          </div>
        )}

        {/* Any extra fields not handled by plant/garden */}
        {filteredKeys
          .filter((k) => k !== 'plant' && k !== 'garden' && k !== 'stage' && k !== 'propagationMethod')
          .map((key) => (
            <div key={key}>
              <span className="font-semibold text-muted-foreground">{toTitleCase(key)}: </span>
              <span>{renderResultValue(prompt[key])}</span>
            </div>
          ))}
      </div>
    );
  };

  // Render structured Viability Results with seasonal lifecycle map and propagation methods
  const renderViabilityResults = (results: any) => {
    if (!results || typeof results !== 'object') {
      return renderResultValue(results);
    }

    const viability = results.viability;
    const upcomingViability = results.upcomingViability;
    const upcomingTiming = results.upcomingTiming;
    const upcomingReasoning = results.upcomingReasoning;
    const seasonalViabilities = results.seasonalViabilities;
    const methodViabilities = results.methodViabilities;
    const prepForecast = results.prepForecast;
    const growAssessment = results.growAssessment;
    const harvestAssessment = results.harvestAssessment;

    return (
      <div className="space-y-3.5">
        {/* Primary Verdict & Upcoming Window */}
        <div className="rounded-lg border bg-background/80 p-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Current Viability:</span>
              <Badge variant="outline" className={cn("text-xs font-semibold font-mono", VIABILITY_BADGE_CLASSES[viability] || VIABILITY_BADGE_CLASSES.Medium)}>
                {viability || 'Calculated'}
              </Badge>
            </div>
            {upcomingViability && (
              <Badge variant="outline" className={cn("text-xs font-medium border-dashed flex items-center gap-1", VIABILITY_BADGE_CLASSES[upcomingViability])}>
                <TrendingUp className="h-3 w-3" />
                <span>↑ {upcomingViability} {upcomingTiming ? `(${upcomingTiming})` : 'upcoming'}</span>
              </Badge>
            )}
          </div>
          {upcomingReasoning && (
            <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded border border-border/40 leading-snug">
              <span className="font-medium text-foreground">Upcoming Outlook: </span>
              {upcomingReasoning}
            </p>
          )}
        </div>

        {/* Full 4-Season Lifecycle Map: 1. Prep, 2. Grow, 3. Harvest */}
        {Array.isArray(seasonalViabilities) && seasonalViabilities.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                Full 4-Season Lifecycle Map
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">1. Prep • 2. Grow • 3. Harvest</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {seasonalViabilities.map((sv: any) => (
                <div key={sv.season} className="rounded-lg border bg-background/70 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <span className="font-semibold text-foreground flex items-center gap-1 text-xs">
                      <span>{SEASON_EMOJIS[sv.season] || '🌿'}</span>
                      <span>{sv.season}</span>
                    </span>
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-mono", VIABILITY_BADGE_CLASSES[sv.viability])}>
                      {sv.viability}
                    </Badge>
                  </div>

                  {sv.reasoning && (
                    <p className="text-[11px] text-muted-foreground leading-snug">{sv.reasoning}</p>
                  )}

                  {/* Stage 1: Prep */}
                  <div className="pt-1 border-t border-border/30 space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-foreground flex items-center gap-1">
                        <span>🌱</span> 1. Prep
                      </span>
                      {sv.prepViability && (
                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 font-mono", VIABILITY_BADGE_CLASSES[sv.prepViability])}>
                          {sv.prepViability}
                        </Badge>
                      )}
                    </div>
                    {sv.prepSummary && (
                      <p className="text-[10px] text-muted-foreground leading-tight">{sv.prepSummary}</p>
                    )}
                  </div>

                  {/* Stage 2: Grow */}
                  <div className="pt-1 border-t border-border/30 space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-foreground flex items-center gap-1">
                        <span>🌿</span> 2. Grow
                      </span>
                      {sv.growViability && (
                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 font-mono", VIABILITY_BADGE_CLASSES[sv.growViability])}>
                          {sv.growViability}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Stage 3: Harvest */}
                  <div className="pt-1 border-t border-border/30 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-foreground flex items-center gap-1">
                        <span>🧺</span> 3. Harvest
                      </span>
                      <div className="flex items-center gap-1">
                        {sv.harvestType && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-normal">
                            {sv.harvestType}
                          </Badge>
                        )}
                        {sv.harvestViability && (
                          <Badge variant="outline" className={cn("text-[9px] px-1 py-0 font-mono", VIABILITY_BADGE_CLASSES[sv.harvestViability])}>
                            {sv.harvestViability}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {sv.harvestWindow && (
                      <p className="text-[10px] text-foreground/80 leading-tight">
                        <span className="text-muted-foreground">Window: </span> {sv.harvestWindow}
                      </p>
                    )}
                    {sv.seedSavingNotes && (
                      <p className="text-[10px] text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20 leading-tight">
                        <span className="font-semibold">🌾 Seed Saving: </span> {sv.seedSavingNotes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botanical Propagation Methods */}
        {Array.isArray(methodViabilities) && methodViabilities.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-border/50">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span>🌱</span> Botanical Propagation Methods ({methodViabilities.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {methodViabilities.map((mv: any) => {
                const isNA = mv.isIncompatible || mv.viability === 'N/A';
                return (
                  <div
                    key={mv.method}
                    className={cn(
                      "p-2 rounded border text-xs flex flex-col gap-1 transition-colors",
                      isNA ? "bg-muted/30 border-muted opacity-75" : "bg-background/80 border-border/60"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold capitalize text-foreground flex items-center gap-1">
                        <span>{mv.method === 'seed' ? '🌰' : mv.method === 'cutting' ? '✂️' : mv.method === 'transplant' ? '🌱' : mv.method === 'division' ? '🪴' : mv.method === 'runner' ? '🌿' : mv.method === 'air-layering' ? '🎋' : '🧄'}</span>
                        <span>{mv.method.replace('-', ' ')}</span>
                      </span>
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-mono", VIABILITY_BADGE_CLASSES[mv.viability])}>
                        {isNA ? 'No Use / N/A' : mv.viability}
                      </Badge>
                    </div>
                    {mv.reasoning && (
                      <p className="text-[10px] text-muted-foreground leading-tight">{mv.reasoning}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Prep Forecast (if active stage was Planting/Prep) */}
        {prepForecast && (
          <div className="rounded border bg-background/80 p-2.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary flex items-center gap-1">
                <Sprout className="h-3.5 w-3.5" /> Prep Lifecycle Forecast
              </span>
              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-mono", VIABILITY_BADGE_CLASSES[prepForecast.overallViability])}>
                Composite: {prepForecast.overallViability}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[11px] pt-1">
              <span>Germ: <strong>{prepForecast.prepViability}</strong></span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span>Grow: <strong>{prepForecast.growViability}</strong></span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span>Harvest: <strong>{prepForecast.harvestViability}</strong></span>
            </div>
            {prepForecast.summary && (
              <p className="text-[11px] text-muted-foreground leading-snug">{prepForecast.summary}</p>
            )}
          </div>
        )}

        {/* Grow Assessment (if active stage was Growing) */}
        {growAssessment && (
          <div className="rounded border bg-background/80 p-2.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary flex items-center gap-1">
                <Leaf className="h-3.5 w-3.5" /> Active In-Ground Vigor &amp; Tending
              </span>
              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-mono", VIABILITY_BADGE_CLASSES[growAssessment.vigorViability])}>
                Vigor: {growAssessment.vigorViability}
              </Badge>
            </div>
            {growAssessment.stressFactor && growAssessment.stressFactor !== 'None' && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                ⚠️ Stress: {growAssessment.stressFactor}
              </Badge>
            )}
            {growAssessment.tendingAdvice && (
              <p className="text-[11px] text-foreground/90 leading-snug">
                <strong className="text-primary">Tending Advice: </strong>{growAssessment.tendingAdvice}
              </p>
            )}
          </div>
        )}

        {/* Harvest Assessment (if active stage was Harvest) */}
        {harvestAssessment && (
          <div className="rounded border bg-background/80 p-2.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary flex items-center gap-1">
                <span>🧺</span> Harvest Assessment &amp; Succession
              </span>
              <div className="flex items-center gap-1">
                {harvestAssessment.harvestType && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    {harvestAssessment.harvestType}
                  </Badge>
                )}
                <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-mono", VIABILITY_BADGE_CLASSES[harvestAssessment.ripenessViability])}>
                  Ripeness: {harvestAssessment.ripenessViability}
                </Badge>
              </div>
            </div>
            {harvestAssessment.harvestWindow && (
              <p className="text-[11px] text-foreground/90"><span className="text-muted-foreground">Timing:</span> {harvestAssessment.harvestWindow}</p>
            )}
            {harvestAssessment.seedSavingNotes && (
              <p className="text-[10px] text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20 leading-tight">
                <span className="font-semibold">🌾 Seed Saving: </span> {harvestAssessment.seedSavingNotes}
              </p>
            )}
            {harvestAssessment.successionAdvice && (
              <p className="text-[11px] text-primary/90 bg-primary/5 p-1.5 rounded border border-primary/20 leading-snug">
                <span className="font-semibold">🔄 Succession Crop: </span> {harvestAssessment.successionAdvice}
              </p>
            )}
          </div>
        )}
      </div>
    );
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
            <div className="flex items-center gap-1.5">
              {logs.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearLogs}
                  disabled={isClearing}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                  title="Clear all AI logs"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Clear Logs</span>
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={onOpenSettings} className="h-8 w-8">
                <Settings className="h-4 w-4" />
                <span className="sr-only">Open Settings</span>
              </Button>
            </div>
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

                  const isError = log.status === 'error' || !!log.error;
                  const isViabilityFlow = log.flow === 'getAiViability' || log.flow === 'localViabilityAnalysis' || !!log.results?.viability;

                  return (
                    <Card key={log.id} className={cn("text-sm", isError && "border-destructive/60 bg-destructive/5")}>
                      <CardHeader className='pb-3'>
                        <CardTitle className="text-base font-medium flex justify-between items-start">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={cn('font-mono font-semibold', isError ? 'text-destructive' : 'text-primary')}>{displayName}</span>
                                    {isError ? (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-destructive/15 text-destructive font-mono font-semibold border border-destructive/30">
                                            FAILED
                                        </span>
                                    ) : (
                                        log.model && (
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-medium border border-primary/20">
                                                {log.model.replace('googleai/', '')}
                                            </span>
                                        )
                                    )}
                                </div>
                                {log.viabilityType && (
                                    <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                                        {log.viabilityType === 'ai' ? <BrainCircuit className="h-3 w-3 text-blue-500" /> : <Cpu className="h-3 w-3 text-emerald-500" />}
                                        {log.viabilityType === 'ai' ? 'AI-Powered Analysis' : 'Local Analysis'}
                                    </span>
                                )}
                            </div>
                            <span className="font-sans font-normal text-xs text-muted-foreground flex-shrink-0 ml-4">{format(parseISO(log.timestamp), 'MMM d, yyyy, h:mm:ss a')}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {log.error && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-destructive flex items-center gap-1.5 text-xs">
                                <AlertTriangle className="h-3.5 w-3.5" /> Error Message
                              </h4>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={() => {
                                  navigator.clipboard.writeText(log.error || '');
                                  toast({ title: 'Error copied to clipboard' });
                                }}
                              >
                                Copy Error
                              </Button>
                            </div>
                            <pre className="text-xs p-3 bg-destructive/10 text-destructive rounded-md whitespace-pre-wrap font-mono max-h-48 overflow-y-auto border border-destructive/20">
                              {log.error}
                            </pre>
                          </div>
                        )}

                        {log.prompt && (
                          <div>
                            <h4 className="font-semibold mb-2">Prompt Sent</h4>
                            {renderPrompt(log.prompt)}
                          </div>
                        )}

                        {log.results && (
                          <div>
                            <h4 className="font-semibold mb-2">Results Received</h4>
                            {isViabilityFlow ? (
                              renderViabilityResults(log.results)
                            ) : (
                              Object.keys(resultsToShow).length > 0 && (
                                <div className="text-sm p-3 bg-muted rounded-md text-foreground space-y-2">
                                  {Object.entries(resultsToShow).map(([key, value]) => (
                                    <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <span className='font-semibold text-muted-foreground col-span-1'>{toTitleCase(key)}</span>
                                      <div className='md:col-span-2'>{renderResultValue(value)}</div>
                                    </div>
                                  ))}
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {reasoning && (
                          <div>
                            <h4 className="font-semibold mb-2">Horticultural Reasoning</h4>
                            <p className="text-sm whitespace-pre-wrap text-foreground/80 leading-relaxed bg-muted/30 p-2.5 rounded border border-border/40">{reasoning}</p>
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
