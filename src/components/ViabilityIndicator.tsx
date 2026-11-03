'use client';

import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { 
  Viability, 
  SeasonalViability, 
  PrepViabilityData, 
  GrowViabilityData, 
  HarvestViabilityData, 
  StageViability,
  SeasonName,
  PropagationMethod,
  PropagationMethodInfo 
} from '@/lib/viability';
import { 
  ALL_PROPAGATION_METHODS, 
  getAllPropagationMethodViabilities 
} from '@/lib/viability';
import type { Plant, Conditions } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Sparkles, 
  Info, 
  TrendingUp, 
  Calendar, 
  ArrowRight, 
  AlertTriangle, 
  Sprout, 
  Leaf, 
  CheckCircle2 
} from 'lucide-react';

export type ViabilityIndicatorProps = {
  stageViability?: StageViability;
  viability?: Viability;
  reasoning?: string;
  plantName?: string;
  gardenName?: string;
  upcomingViability?: 'High' | 'Medium';
  upcomingTiming?: string;
  upcomingReasoning?: string;
  currentSeason?: string;
  seasonalViabilities?: SeasonalViability[];
  prepForecast?: PrepViabilityData;
  growAssessment?: GrowViabilityData;
  harvestAssessment?: HarvestViabilityData;
  propagationMethod?: PropagationMethod;
  otherMethodsCount?: number;
  relatedMethods?: PropagationMethodInfo[];
  plant?: Plant;
  conditions?: Conditions;
  growingSystems?: string;
  growingMethods?: string;
  onSelectPropagationMethod?: (method: PropagationMethod) => void;
};

const viabilityConfig: Record<Viability, { text: string; className: string; borderClass: string; dotClass: string }> = {
  High: { 
    text: 'High Viability', 
    className: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800 hover:bg-green-200 dark:hover:bg-green-900/70',
    borderClass: 'border-green-500/30',
    dotClass: 'bg-green-600',
  },
  Medium: { 
    text: 'Medium Viability', 
    className: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-900/70',
    borderClass: 'border-yellow-500/30',
    dotClass: 'bg-yellow-500',
  },
  Low: { 
    text: 'Low Viability', 
    className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/70',
    borderClass: 'border-red-500/30',
    dotClass: 'bg-red-600',
  },
  'N/A': { 
    text: 'No Use / N/A', 
    className: 'bg-muted text-muted-foreground border-muted-foreground/30 dark:bg-muted/50 dark:text-muted-foreground dark:border-border hover:bg-muted/80',
    borderClass: 'border-border/60',
    dotClass: 'bg-muted-foreground',
  },
};

const seasonIcons: Record<string, string> = {
  Spring: '🌱',
  Summer: '☀️',
  Autumn: '🍂',
  Winter: '❄️',
};

export function ViabilityIndicator({ 
  stageViability,
  viability, 
  reasoning, 
  plantName, 
  gardenName,
  upcomingViability,
  upcomingTiming,
  upcomingReasoning,
  currentSeason,
  seasonalViabilities: propSeasonalViabilities,
  prepForecast: propPrepForecast,
  growAssessment: propGrowAssessment,
  harvestAssessment: propHarvestAssessment,
  propagationMethod: propPropagationMethod,
  otherMethodsCount: propOtherMethodsCount,
  relatedMethods: propRelatedMethods,
  plant,
  conditions,
  growingSystems,
  growingMethods,
  onSelectPropagationMethod,
}: ViabilityIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 1. Resolve active stage data
  const resolvedWish = stageViability?.stage === 'Wishlist' ? stageViability : undefined;
  const wishSeasons = resolvedWish?.seasons || propSeasonalViabilities;

  const resolvedPrep = stageViability?.stage === 'Planting' ? stageViability : propPrepForecast;
  const resolvedGrow = stageViability?.stage === 'Growing' ? stageViability : propGrowAssessment;
  const resolvedHarvest = stageViability?.stage === 'Harvest' ? stageViability : propHarvestAssessment;
  
  const activeMethod: PropagationMethod = (resolvedPrep && 'propagationMethod' in resolvedPrep ? resolvedPrep.propagationMethod : undefined) 
    || propPropagationMethod 
    || 'seed';

  // 2. Resolve all botanical propagation methods
  const allMethods: PropagationMethodInfo[] = useMemo(() => {
    if (propRelatedMethods && propRelatedMethods.length > 0) {
      return propRelatedMethods;
    }
    if (!plant) {
      return [];
    }
    const conds: Conditions = conditions || {
      temperature: '20°C',
      sunlight: 'Full Sun',
      soil: 'Loam',
      currentSeason: (currentSeason as any) || 'Spring',
    };
    return getAllPropagationMethodViabilities(plant, conds, {
      growingSystems,
      growingMethods,
    });
  }, [propRelatedMethods, plant, conditions, currentSeason, growingSystems, growingMethods]);

  const activeMethodInfo = useMemo(() => {
    const found = allMethods.find(m => m.method === activeMethod);
    if (found) return found;
    const fallback = ALL_PROPAGATION_METHODS.find(m => m.method === activeMethod);
    return fallback ? {
      ...fallback,
      prepViability: 'High' as Viability,
      growViability: 'High' as Viability,
      harvestViability: 'High' as Viability,
      overallViability: 'High' as Viability,
      isIncompatible: false,
      prepReasoning: '',
      isRecommended: false,
    } : undefined;
  }, [allMethods, activeMethod]);

  // Viable alternative methods: not active, compatible, and overall viability !== 'Low' and !== 'N/A'
  const otherViableMethods = useMemo(() => {
    return allMethods.filter(m => m.method !== activeMethod && !m.isIncompatible && m.overallViability !== 'Low' && m.overallViability !== 'N/A');
  }, [allMethods, activeMethod]);

  const otherViableCount = propOtherMethodsCount !== undefined
    ? propOtherMethodsCount
    : otherViableMethods.length;

  // Render botanical method pill directly inside/beside the viability badge
  const renderMethodPill = (inSameBadge: boolean = true) => {
    if (!activeMethodInfo && !activeMethod) return null;
    const icon = activeMethodInfo?.icon || (activeMethod === 'transplant' ? '🪴' : '🌱');
    const label = activeMethodInfo?.shortLabel || activeMethod.replace('-', ' ');

    if (inSameBadge) {
      return (
        <span className="inline-flex items-center gap-1 font-medium ml-0.5">
          <span className="opacity-30">•</span>
          <span>{icon}</span>
          <span className="capitalize">{label}</span>
          {otherViableCount > 0 && (
            <span 
              className="px-1 py-0 rounded text-[9px] font-bold bg-background/85 text-foreground border border-border/70 shadow-xs" 
              title={`${otherViableCount} other viable propagation method${otherViableCount > 1 ? 's' : ''} available`}
            >
              +{otherViableCount}
            </span>
          )}
        </span>
      );
    }

    return (
      <Badge
        variant="outline"
        className="text-[11px] font-medium cursor-pointer transition-colors flex items-center gap-1 select-none py-0.5 bg-background/80 border-border hover:bg-muted"
        title={otherViableCount > 0 ? `Active: ${label}. ${otherViableCount} other viable methods available.` : `Active: ${label}`}
      >
        <span>{icon}</span>
        <span className="capitalize">{label}</span>
        {otherViableCount > 0 && (
          <span className="px-1 py-0 rounded text-[9px] font-bold bg-primary/15 text-primary border border-primary/30">
            +{otherViableCount}
          </span>
        )}
      </Badge>
    );
  };

  // Render related botanical methods breakdown inside popover with 1-click switching
  const renderMethodsSection = () => {
    if (allMethods.length === 0 && !activeMethodInfo) return null;
    return (
      <div className="space-y-2 border-t border-border/60 pt-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <span>Botanical Methods</span>
            {otherViableCount > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 font-normal">
                +{otherViableCount} viable alternative{otherViableCount > 1 ? 's' : ''}
              </Badge>
            )}
          </span>
          {onSelectPropagationMethod && (
            <span className="text-[10px] text-muted-foreground font-normal">Tap to switch</span>
          )}
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
          {allMethods.map((m) => {
            const isActive = m.method === activeMethod;
            const vCfg = viabilityConfig[m.overallViability] || viabilityConfig.Low;
            const isClickable = !!onSelectPropagationMethod && !isActive && !m.isIncompatible;
            return (
              <div
                key={m.method}
                onClick={(e) => {
                  if (onSelectPropagationMethod && !m.isIncompatible && !isActive) {
                    e.stopPropagation();
                    onSelectPropagationMethod(m.method);
                  }
                }}
                className={cn(
                  "p-2 rounded-md border text-xs flex items-center justify-between transition-colors",
                  isActive ? "border-primary bg-primary/10 shadow-xs" : 
                  m.isIncompatible ? "border-border/30 bg-muted/20 opacity-60" :
                  isClickable ? "border-border/50 bg-muted/30 hover:bg-muted/60 cursor-pointer" : "border-border/50 bg-muted/20"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm shrink-0">{m.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("font-medium truncate", isActive && "font-semibold text-primary", m.isIncompatible && "line-through text-muted-foreground")}>
                        {m.label}
                      </span>
                      {isActive && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary bg-primary/10">
                          Active
                        </Badge>
                      )}
                      {m.isRecommended && !isActive && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                          Recommended
                        </Badge>
                      )}
                    </div>
                    {m.prepReasoning && (
                      <p className="text-[10px] text-muted-foreground truncate max-w-[220px]">
                        {m.prepReasoning}
                      </p>
                    )}
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn("text-[10px] px-1.5 py-0 shrink-0 font-mono", vCfg.className)}
                >
                  {m.overallViability === 'N/A' ? 'No Use / N/A' : m.overallViability}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 1. WISHLIST VIEW: List of viabilities per season (> Low)
  if (resolvedWish || (wishSeasons && wishSeasons.length > 0)) {
    const seasons = wishSeasons || [];
    const overallViab = resolvedWish?.overallViability || (seasons.some(s => s.viability === 'High') ? 'High' : seasons.some(s => s.viability === 'Medium') ? 'Medium' : 'Low');
    const primaryBorderClass = viabilityConfig[overallViab]?.borderClass || 'border-border';

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(prev => !prev);
            }}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            className="focus:outline-none focus:ring-1 focus:ring-primary rounded flex items-center gap-1.5 flex-wrap"
            title="Click or hover to view seasonal viability breakdown and related propagation methods"
          >
            {seasons.map((sv) => {
              const cfg = viabilityConfig[sv.viability] || viabilityConfig.Medium;
              const isCurrentSeason = currentSeason && sv.season.toLowerCase() === currentSeason.toLowerCase();
              return (
                <Badge
                  key={sv.season}
                  variant="outline"
                  className={cn(
                    "text-[11px] font-medium cursor-pointer transition-colors flex items-center gap-1 select-none py-0.5",
                    cfg.className,
                    isCurrentSeason && "ring-1 ring-primary/80 font-semibold"
                  )}
                >
                  <span>{seasonIcons[sv.season] || '🌿'}</span>
                  <span>{sv.season}: {sv.viability}</span>
                  {isCurrentSeason && <span className="text-[10px] opacity-90 font-mono">• Now</span>}
                </Badge>
              );
            })}
            {renderMethodPill(false)}
            <Info className="h-3 w-3 opacity-60 ml-0.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className={cn("w-80 sm:w-96 p-4 text-sm z-50 shadow-xl space-y-3 bg-popover text-popover-foreground", primaryBorderClass)}
          side="top"
          align="start"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>Wishlist Seasonal Planning</span>
            </div>
            {currentSeason && (
              <Badge variant="outline" className="text-[10px] font-mono">
                Current: {currentSeason}
              </Badge>
            )}
          </div>

          {plantName && (
            <p className="font-medium text-xs text-foreground/90">
              {plantName} {gardenName ? <span className="text-muted-foreground font-normal">({gardenName})</span> : ''}
            </p>
          )}

          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Seasonal Feasibility</span>
              <span className="text-[10px] lowercase text-primary font-normal">All viable windows listed</span>
            </div>
            <div className="space-y-1.5">
              {seasons.map((s) => {
                const sCfg = viabilityConfig[s.viability];
                const isCurrent = currentSeason && s.season.toLowerCase() === currentSeason.toLowerCase();
                return (
                  <div 
                    key={s.season} 
                    className={cn(
                      "p-2 rounded-md border text-xs flex flex-col gap-1",
                      isCurrent ? "border-primary/50 bg-primary/5" : "border-border/50 bg-muted/20"
                    )}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="flex items-center gap-1.5">
                        <span>{seasonIcons[s.season] || '🌿'}</span>
                        <span className="font-semibold">{s.season}</span>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-primary/20 text-primary">
                            Active Season
                          </Badge>
                        )}
                      </span>
                      <Badge variant="outline" className={cn("text-[10px] py-0 h-4 font-mono", sCfg?.className)}>
                        {s.viability}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {s.reasoning}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {resolvedWish?.bestSeason && (
            <div className="p-2 rounded-lg border border-primary/30 bg-primary/5 text-xs flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <p className="text-[11px] text-foreground/90">
                Recommended target: <span className="font-semibold text-primary">{resolvedWish.bestSeason}</span> for optimal yield and vigor.
              </p>
            </div>
          )}

          {renderMethodsSection()}
        </PopoverContent>
      </Popover>
    );
  }

  // 2. PREP VIEW: 3-Stage Lifecycle Pipeline (Prep -> Grow -> Harv)
  if (resolvedPrep) {
    const isPrepNA = resolvedPrep.overallViability === 'N/A' || resolvedPrep.prepViability === 'N/A' || resolvedPrep.isIncompatible;
    const overallCfg = viabilityConfig[resolvedPrep.overallViability] || viabilityConfig.Medium;
    const prepCfg = viabilityConfig[resolvedPrep.prepViability] || viabilityConfig.Medium;
    const harvCfg = viabilityConfig[resolvedPrep.harvestViability] || viabilityConfig.Medium;

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(prev => !prev);
            }}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            className="focus:outline-none focus:ring-1 focus:ring-primary rounded flex items-center gap-1.5 flex-wrap"
            title="Click or hover to view Prep lifecycle forecast and related propagation methods"
          >
            <Badge 
              variant="outline" 
              className={cn("font-normal cursor-pointer transition-colors flex items-center gap-1 select-none", overallCfg.className)}
            >
              <Sprout className="h-3 w-3" />
              {isPrepNA ? (
                <span className="font-medium">No Use / N/A</span>
              ) : (
                <>
                  <span>Prep: {resolvedPrep.prepViability}</span>
                  <ArrowRight className="h-2.5 w-2.5 opacity-60" />
                  <span>Harv: {resolvedPrep.harvestViability}</span>
                </>
              )}
              {renderMethodPill(true)}
              <Info className="h-3 w-3 opacity-60 ml-0.5" />
            </Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className={cn("w-80 sm:w-96 p-4 text-sm z-50 shadow-xl space-y-3 bg-popover text-popover-foreground", overallCfg.borderClass)}
          side="top"
          align="start"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <Sprout className="h-3.5 w-3.5 text-primary" />
              <span>Prep Lifecycle Forecast</span>
            </div>
            <Badge variant="outline" className={cn("text-xs font-semibold", overallCfg.className)}>
              {isPrepNA ? 'No Use / N/A' : `Overall: ${resolvedPrep.overallViability}`}
            </Badge>
          </div>

          {plantName && (
            <p className="font-medium text-xs text-foreground/90">
              {plantName} {gardenName ? <span className="text-muted-foreground font-normal">({gardenName})</span> : ''}
            </p>
          )}

          {isPrepNA && (
            <div className="p-2.5 rounded-lg border border-destructive/40 bg-destructive/10 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-destructive font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Botanical Incompatibility Warning</span>
              </div>
              <p className="text-[11px] text-destructive/90 leading-snug">
                This plant is incompatible with propagation by {activeMethod.replace('-', ' ')}.
                {otherViableCount > 0 
                  ? ` Switch to one of the ${otherViableCount} viable method${otherViableCount > 1 ? 's' : ''} listed below.`
                  : ' Direct seeding or an alternative botanical method is required.'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Lifecycle Trajectory
            </span>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="p-2 rounded border border-border/60 bg-muted/20 flex flex-col items-center">
                <span className="text-[10px] text-muted-foreground font-semibold">1. Prep</span>
                <span className={cn("text-xs font-bold mt-0.5", prepCfg.className.split(' ')[1])}>
                  {resolvedPrep.prepViability}
                </span>
                <span className="text-[9px] text-muted-foreground mt-0.5 leading-tight">Germination</span>
              </div>
              <div className="p-2 rounded border border-border/60 bg-muted/20 flex flex-col items-center">
                <span className="text-[10px] text-muted-foreground font-semibold">2. Grow</span>
                <span className={cn("text-xs font-bold mt-0.5", viabilityConfig[resolvedPrep.growViability]?.className.split(' ')[1])}>
                  {resolvedPrep.growViability}
                </span>
                <span className="text-[9px] text-muted-foreground mt-0.5 leading-tight">Vegetative</span>
              </div>
              <div className="p-2 rounded border border-border/60 bg-muted/20 flex flex-col items-center">
                <span className="text-[10px] text-muted-foreground font-semibold">3. Harv</span>
                <span className={cn("text-xs font-bold mt-0.5", harvCfg.className.split(' ')[1])}>
                  {resolvedPrep.harvestViability}
                </span>
                <span className="text-[9px] text-muted-foreground mt-0.5 leading-tight">Maturity</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-muted-foreground">
            {resolvedPrep.prepReasoning && (
              <div>
                <span className="font-semibold text-foreground/80">Prep Phase: </span>
                <span>{resolvedPrep.prepReasoning}</span>
              </div>
            )}
            {resolvedPrep.growReasoning && (
              <div>
                <span className="font-semibold text-foreground/80">Grow Phase: </span>
                <span>{resolvedPrep.growReasoning}</span>
              </div>
            )}
            {resolvedPrep.harvestReasoning && (
              <div>
                <span className="font-semibold text-foreground/80">Harvest Phase: </span>
                <span>{resolvedPrep.harvestReasoning}</span>
              </div>
            )}
          </div>

          {resolvedPrep.summary && (
            <div className="p-2 rounded border border-primary/20 bg-primary/5 text-xs text-foreground/90 font-medium">
              💡 {resolvedPrep.summary}
            </div>
          )}

          {renderMethodsSection()}
        </PopoverContent>
      </Popover>
    );
  }

  // 3. GROW VIEW: In-Ground Vigor & Acute Stress Monitoring
  if (resolvedGrow) {
    const cfg = viabilityConfig[resolvedGrow.vigorViability] || viabilityConfig.High;
    const hasStress = resolvedGrow.stressFactor && resolvedGrow.stressFactor !== 'None';

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(prev => !prev);
            }}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            className="focus:outline-none focus:ring-1 focus:ring-primary rounded flex items-center gap-1.5 flex-wrap"
            title="Click or hover to view in-ground vigor, stress factors, and related propagation methods"
          >
            <Badge 
              variant="outline" 
              className={cn("font-normal cursor-pointer transition-colors flex items-center gap-1 select-none", cfg.className)}
            >
              <Leaf className="h-3 w-3" />
              <span>Grow: {resolvedGrow.vigorViability}</span>
              {hasStress && (
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 ml-0.5 flex items-center gap-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {resolvedGrow.stressFactor}
                </span>
              )}
              {renderMethodPill(true)}
              <Info className="h-3 w-3 opacity-60 ml-0.5" />
            </Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className={cn("w-80 sm:w-96 p-4 text-sm z-50 shadow-xl space-y-3 bg-popover text-popover-foreground", cfg.borderClass)}
          side="top"
          align="start"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <Leaf className="h-3.5 w-3.5 text-primary" />
              <span>In-Ground Vigor &amp; Stress Watch</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={cn("text-xs font-semibold", cfg.className)}>
                Vigor: {resolvedGrow.vigorViability}
              </Badge>
            </div>
          </div>

          {plantName && (
            <p className="font-medium text-xs text-foreground/90">
              {plantName} {gardenName ? <span className="text-muted-foreground font-normal">({gardenName})</span> : ''}
            </p>
          )}

          {hasStress ? (
            <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Stress Alert: {resolvedGrow.stressFactor}</span>
              </div>
              <p className="text-[11px] text-amber-900/90 dark:text-amber-200/90 leading-snug">
                {resolvedGrow.reasoning}
              </p>
            </div>
          ) : (
            <div className="space-y-1 text-xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Growth Status</span>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {resolvedGrow.reasoning}
              </p>
            </div>
          )}

          <div className="p-2.5 rounded-lg border border-primary/30 bg-primary/5 text-xs space-y-1">
            <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
              <span>🌿</span> Tending Action Plan:
            </span>
            <p className="text-[11px] text-foreground/90 leading-snug font-medium">
              {resolvedGrow.tendingAdvice}
            </p>
          </div>

          {renderMethodsSection()}
        </PopoverContent>
      </Popover>
    );
  }

  // 4. HARVEST VIEW: Peak Window & Bed Succession Advice
  if (resolvedHarvest) {
    const cfg = viabilityConfig[resolvedHarvest.ripenessViability] || viabilityConfig.High;

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(prev => !prev);
            }}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            className="focus:outline-none focus:ring-1 focus:ring-primary rounded flex items-center gap-1.5 flex-wrap"
            title="Click or hover to view harvest window, bed succession, and related propagation methods"
          >
            <Badge 
              variant="outline" 
              className={cn("font-normal cursor-pointer transition-colors flex items-center gap-1 select-none", cfg.className)}
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>Harv: {resolvedHarvest.ripenessViability}</span>
              <span className="text-[10px] font-mono opacity-85 ml-0.5">• {resolvedHarvest.harvestWindow}</span>
              {renderMethodPill(true)}
              <Info className="h-3 w-3 opacity-60 ml-0.5" />
            </Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className={cn("w-80 sm:w-96 p-4 text-sm z-50 shadow-xl space-y-3 bg-popover text-popover-foreground", cfg.borderClass)}
          side="top"
          align="start"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Harvest Window &amp; Succession</span>
            </div>
            <Badge variant="outline" className={cn("text-xs font-semibold", cfg.className)}>
              {resolvedHarvest.harvestWindow}
            </Badge>
          </div>

          {plantName && (
            <p className="font-medium text-xs text-foreground/90">
              {plantName} {gardenName ? <span className="text-muted-foreground font-normal">({gardenName})</span> : ''}
            </p>
          )}

          <div className="space-y-1 text-xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ripeness Status</span>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {resolvedHarvest.reasoning}
            </p>
          </div>

          {resolvedHarvest.successionAdvice && (
            <div className="p-2.5 rounded-lg border border-primary/30 bg-primary/5 text-xs space-y-1">
              <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                <span>🔄</span> Succession Crop for this Bed:
              </span>
              <p className="text-[11px] text-foreground/90 leading-snug">
                {resolvedHarvest.successionAdvice}
              </p>
            </div>
          )}

          {renderMethodsSection()}
        </PopoverContent>
      </Popover>
    );
  }

  // 5. STANDARD / LEGACY FALLBACK VIEW
  const effectiveViability = viability || 'Low';
  const config = viabilityConfig[effectiveViability];

  if (!config) {
    return null;
  }

  // Check if upcoming viability is higher than current
  const viabilityRanks: Record<Viability, number> = { High: 2, Medium: 1, Low: 0, 'N/A': -1 };
  const hasUpcomingHigher = upcomingViability && viabilityRanks[upcomingViability] > viabilityRanks[effectiveViability];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(prev => !prev);
          }}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          className="focus:outline-none focus:ring-1 focus:ring-primary rounded flex items-center gap-1.5 flex-wrap"
          title="Click or hover to view AI reasoning, seasonal viability, and related propagation methods"
        >
          <Badge 
            variant="outline" 
            className={cn("font-normal cursor-pointer transition-colors flex items-center gap-1 select-none", config.className)}
          >
            <span>{config.text}</span>
            {renderMethodPill(true)}
            <Info className="h-3 w-3 opacity-60 ml-0.5" />
          </Badge>

          {hasUpcomingHigher && (
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-medium cursor-pointer transition-colors flex items-center gap-1 select-none border-dashed",
                upcomingViability === 'High' 
                  ? "bg-green-50 text-green-700 border-green-400 dark:bg-green-950/40 dark:text-green-300 dark:border-green-700" 
                  : "bg-yellow-50 text-yellow-700 border-yellow-400 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-700"
              )}
            >
              <TrendingUp className="h-3 w-3 shrink-0" />
              <span>↑ {upcomingViability} {upcomingTiming ? `(${upcomingTiming})` : 'soon'}</span>
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn("w-80 sm:w-96 p-4 text-sm z-50 shadow-xl space-y-3 bg-popover text-popover-foreground", config.borderClass)}
        side="top"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-1.5 font-semibold text-xs">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Viability Analysis</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={cn("text-xs font-normal", config.className)}>
              {effectiveViability} (Current)
            </Badge>
          </div>
        </div>

        {plantName && (
          <p className="font-medium text-xs text-foreground/90">
            {plantName} {gardenName ? <span className="text-muted-foreground font-normal">({gardenName})</span> : ''}
          </p>
        )}

        {hasUpcomingHigher && (
          <div className="p-2.5 rounded-lg border border-primary/30 bg-primary/5 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-primary">
                <TrendingUp className="h-3.5 w-3.5" />
                Upcoming in {currentSeason ? currentSeason : 'Current Season'}
              </span>
              <Badge className={cn("text-[10px] px-1.5 py-0 font-mono", upcomingViability === 'High' ? "bg-green-600 text-white" : "bg-yellow-500 text-white")}>
                {upcomingViability} Viability
              </Badge>
            </div>
            {upcomingTiming && (
              <p className="text-[11px] font-medium text-foreground/90">
                Timing: {upcomingTiming}
              </p>
            )}
            {upcomingReasoning && (
              <p className="text-[11px] text-muted-foreground leading-snug">
                {upcomingReasoning}
              </p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Current Assessment</span>
          <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed pr-1 font-sans">
            {reasoning ? reasoning : "No detailed reasoning saved for this plant yet. Click 'Viability Analysis' in the plant menu to generate a fresh assessment."}
          </div>
        </div>

        {renderMethodsSection()}
      </PopoverContent>
    </Popover>
  );
}
