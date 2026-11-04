'use client';

import React, { useState, useMemo, useCallback } from 'react';
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
  PropagationMethodInfo,
  HarvestType,
  SeasonalHarvestInfo,
  SeasonalGrowInfo
} from '@/lib/viability';
import { 
  ALL_PROPAGATION_METHODS, 
  getAllPropagationMethodViabilities,
  getSeasonalViabilityForSeason,
  getSeasonalGrowInfo,
  getSeasonalHarvestInfo,
  getWishSeasonalViabilities
} from '@/lib/viability';
import type { Plant, Conditions, PlantStatus } from '@/lib/types';
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

const harvestTypeConfig: Record<HarvestType, { icon: string; label: string; badgeClass: string }> = {
  'Fruit / Crop': {
    icon: '🍎',
    label: 'Fruit / Crop',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  'Seeds / Seed Saving': {
    icon: '🌾',
    label: 'Seeds / Seed Saving',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  'Roots / Bulbs': {
    icon: '🥕',
    label: 'Roots / Bulbs',
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  },
  'Greens / Herbs': {
    icon: '🥬',
    label: 'Greens / Herbs',
    badgeClass: 'bg-lime-500/15 text-lime-700 dark:text-lime-300 border-lime-500/30',
  },
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
  const [selectedSeason, setSelectedSeason] = useState<SeasonName | null>(null);

  // 1. Resolve active stage data
  const resolvedWish = stageViability?.stage === 'Wishlist' ? stageViability : undefined;
  const wishSeasons = resolvedWish?.seasons || propSeasonalViabilities;

  const resolvedPrep = stageViability?.stage === 'Planting' ? stageViability : propPrepForecast;
  const resolvedGrow = stageViability?.stage === 'Growing' ? stageViability : propGrowAssessment;
  const resolvedHarvest = stageViability?.stage === 'Harvest' ? stageViability : propHarvestAssessment;

  const targetStage: PlantStatus = stageViability?.stage 
    || (propHarvestAssessment ? 'Harvest' : undefined)
    || (propGrowAssessment ? 'Growing' : undefined)
    || (propPrepForecast ? 'Planting' : undefined)
    || (resolvedWish || (wishSeasons && wishSeasons.length > 0) ? 'Wishlist' : undefined)
    || 'Wishlist';
  
  const activeMethod: PropagationMethod = (resolvedPrep && 'propagationMethod' in resolvedPrep ? resolvedPrep.propagationMethod : undefined) 
    || propPropagationMethod 
    || 'seed';

  // 2. Resolve all botanical propagation methods for the default/current season
  const allMethods: PropagationMethodInfo[] = useMemo(() => {
    if (propRelatedMethods && propRelatedMethods.length > 0) {
      return propRelatedMethods;
    }
    if (resolvedPrep && 'applicableMethods' in resolvedPrep && resolvedPrep.applicableMethods && resolvedPrep.applicableMethods.length > 0) {
      return resolvedPrep.applicableMethods;
    }
    if (resolvedWish && 'applicableMethods' in resolvedWish && resolvedWish.applicableMethods && resolvedWish.applicableMethods.length > 0) {
      return resolvedWish.applicableMethods;
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
  }, [propRelatedMethods, resolvedPrep, resolvedWish, plant, conditions, currentSeason, growingSystems, growingMethods]);

  // Query propagation methods specifically evaluated for any target season
  const getMethodsForSeason = useCallback((season?: SeasonName): PropagationMethodInfo[] => {
    if (!plant) return allMethods;
    const targetSeason = season || (currentSeason as SeasonName) || 'Spring';
    // If targetSeason matches currentSeason and propRelatedMethods exists, use it
    if ((!season || season === currentSeason) && propRelatedMethods && propRelatedMethods.length > 0) {
      return propRelatedMethods;
    }
    const conds: Conditions = {
      temperature: '20°C',
      sunlight: 'Full Sun',
      soil: 'Loam',
      ...(conditions || {}),
      currentSeason: targetSeason,
    };
    return getAllPropagationMethodViabilities(plant, conds, {
      growingSystems,
      growingMethods,
    });
  }, [plant, currentSeason, propRelatedMethods, conditions, growingSystems, growingMethods, allMethods]);

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

  // Applicable methods: botanically compatible with this plant species (!isIncompatible && overallViability !== 'N/A')
  const applicableMethods = useMemo(() => {
    return allMethods.filter(m => !m.isIncompatible && m.overallViability !== 'N/A');
  }, [allMethods]);

  // Other applicable methods besides the currently active method
  const otherApplicableMethods = useMemo(() => {
    return applicableMethods.filter(m => m.method !== activeMethod);
  }, [applicableMethods, activeMethod]);

  const otherApplicableCount = propOtherMethodsCount !== undefined
    ? propOtherMethodsCount
    : otherApplicableMethods.length;

  const isPrepNA = activeMethodInfo?.overallViability === 'N/A' || activeMethodInfo?.isIncompatible;

  // Render applicable botanical methods directly INSIDE the viability badge, optionally evaluated for a specific season
  const renderMethodInsideBadge = (badgeSeason?: SeasonName) => {
    const methodsForBadge = badgeSeason ? getMethodsForSeason(badgeSeason) : allMethods;
    const applicableForBadge = methodsForBadge.filter(m => !m.isIncompatible && m.overallViability !== 'N/A');
    const activeInfoForBadge = methodsForBadge.find(m => m.method === activeMethod) || applicableForBadge[0];
    const otherApplicableForBadge = applicableForBadge.filter(m => m.method !== activeMethod);
    const isNA = activeInfoForBadge?.overallViability === 'N/A' || activeInfoForBadge?.isIncompatible;

    if (isNA) {
      return (
        <span className="inline-flex items-center gap-1 pl-1 ml-0.5 border-l border-current/30 font-normal text-[10px]">
          <span className="line-through opacity-70">{activeInfoForBadge?.icon || '🌱'}</span>
          {applicableForBadge.length > 0 && (
            <span className="font-semibold text-primary ml-0.5 flex items-center gap-0.5" title={`${badgeSeason ? `${badgeSeason}: ` : ''}Incompatible! Applicable methods: ${applicableForBadge.map(m => m.label).join(', ')}`}>
              <span>(Use:</span>
              <span className="tracking-tight">{applicableForBadge.map(m => m.icon).join(' ')}</span>
              <span>)</span>
            </span>
          )}
        </span>
      );
    }

    if (!activeInfoForBadge && applicableForBadge.length === 0) return null;
    const currentInfo = activeInfoForBadge || applicableForBadge[0];
    const icon = currentInfo.icon;
    const label = currentInfo.shortLabel;

    // Rule: If only 1 method is applicable (e.g. Carrot has only Seed), show icon + shortLabel
    if (applicableForBadge.length <= 1) {
      return (
        <span 
          className="inline-flex items-center gap-1 pl-1 ml-0.5 border-l border-current/30 font-normal text-[10px]"
          title={`${badgeSeason ? `${badgeSeason}: ` : ''}Only 1 applicable propagation method: ${label} (${currentInfo.overallViability})`}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </span>
      );
    }

    // Rule: "if its more than one method, just show the icons"
    // Active method icon is underlined, followed by alternative applicable method icons
    return (
      <span 
        className="inline-flex items-center gap-1 pl-1 ml-0.5 border-l border-current/30 font-normal text-[11px]"
        title={`${badgeSeason ? `${badgeSeason} ` : ''}Applicable methods: ${applicableForBadge.map(m => `${m.label} (${m.overallViability}${m.method === activeMethod ? ' - Active' : ''})`).join(', ')} - Click to view ${badgeSeason || ''} details`}
      >
        <span className="font-bold underline decoration-current/40 decoration-1 underline-offset-2" title={`Active: ${label} (${currentInfo.overallViability})`}>
          {icon}
        </span>
        <span className="opacity-80 flex items-center gap-0.5 tracking-tight">
          {otherApplicableForBadge.map(m => (
            <span key={m.method} title={`${m.label} (${m.overallViability})`}>
              {m.icon}
            </span>
          ))}
        </span>
      </span>
    );
  };

  // Render related botanical methods breakdown inside popover with 1-click switching
  const renderMethodsSection = (methodsOverride?: PropagationMethodInfo[], seasonContext?: SeasonName) => {
    const list = methodsOverride || allMethods;
    if (list.length === 0 && !activeMethodInfo) return null;
    const compatibleList = list.filter(m => !m.isIncompatible && m.overallViability !== 'N/A');
    const incompatibleList = list.filter(m => m.isIncompatible || m.overallViability === 'N/A');
    const activeIncompatible = incompatibleList.find(m => m.method === activeMethod);
    const passiveIncompatible = incompatibleList.filter(m => m.method !== activeMethod);

    return (
      <div className="space-y-2.5 pt-1">
        {/* If active method is incompatible, show a dedicated alert card so user can switch */}
        {activeIncompatible && (
          <div className="p-2 rounded-md border border-destructive/40 bg-destructive/10 text-xs flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-base shrink-0">{activeIncompatible.icon}</span>
                <span className="font-semibold text-destructive text-[11px] truncate">
                  {activeIncompatible.label} (Active Method)
                </span>
              </div>
              <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 shrink-0 font-mono">
                No Use / N/A
              </Badge>
            </div>
            {activeIncompatible.prepReasoning && (
              <p className="text-[10px] text-destructive/90 leading-tight">
                {activeIncompatible.prepReasoning}
              </p>
            )}
            {compatibleList.length > 0 && (
              <span className="text-[10px] text-primary font-medium mt-0.5">
                ↳ Select an applicable method below:
              </span>
            )}
          </div>
        )}

        {/* Viable / Applicable Methods */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <span>🌱</span>
              <span>{seasonContext ? `1. ${seasonContext} Prep Methods` : 'Botanical Prep Methods'} ({compatibleList.length})</span>
            </span>
            {onSelectPropagationMethod && (
              <span className="text-[10px] text-primary font-medium">1-click switch</span>
            )}
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
            {compatibleList.map((m) => {
              const isActive = m.method === activeMethod;
              const vCfg = viabilityConfig[m.overallViability] || viabilityConfig.Low;
              const isClickable = !!onSelectPropagationMethod && !isActive;
              return (
                <div
                  key={m.method}
                  onClick={(e) => {
                    if (onSelectPropagationMethod && !isActive) {
                      e.stopPropagation();
                      onSelectPropagationMethod(m.method);
                    }
                  }}
                  className={cn(
                    "p-2.5 rounded-lg border text-xs flex flex-col gap-1 transition-all",
                    isActive ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30" : 
                    isClickable ? "border-border/60 bg-muted/30 hover:bg-muted/60 hover:border-primary/40 cursor-pointer" : "border-border/50 bg-muted/20"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{m.icon}</span>
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className={cn("font-medium truncate", isActive && "font-semibold text-primary")}>
                          {m.label}
                        </span>
                        {isActive && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/50 text-primary bg-primary/15 font-semibold">
                            ✓ Active
                          </Badge>
                        )}
                        {m.isRecommended && !isActive && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-500/50 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 font-semibold">
                            ★ Recommended
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn("text-[10px] px-1.5 py-0 shrink-0 font-mono font-semibold", vCfg.className)}
                    >
                      {m.overallViability}
                    </Badge>
                  </div>
                  {m.prepReasoning && (
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                      {m.prepReasoning}
                    </p>
                  )}
                  <div className="text-[9px] text-muted-foreground/80 font-mono flex items-center gap-1 mt-0.5">
                    <span>Prep {m.prepViability}</span>
                    <span>➔</span>
                    <span>Grow {m.growViability}</span>
                    <span>➔</span>
                    <span>Harv {m.harvestViability}</span>
                    {isClickable && (
                      <span className="ml-auto text-primary font-sans font-medium text-[10px]">
                        Tap to select
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Compact, Collapsible Incompatible Methods One-Liner (Takes ~18px when collapsed, zero clutter!) */}
        {passiveIncompatible.length > 0 && (
          <details className="group pt-1 border-t border-border/30 text-xs">
            <summary className="cursor-pointer hover:text-foreground flex items-center justify-between select-none py-1 text-muted-foreground text-[10px]">
              <span className="flex items-center gap-1 min-w-0">
                <span className="opacity-70">🚫</span>
                <span className="font-semibold uppercase tracking-wider">Incompatible ({passiveIncompatible.length})</span>
                <span className="opacity-60 truncate max-w-[150px] sm:max-w-[200px]">
                  • {passiveIncompatible.map(m => m.shortLabel).join(', ')}
                </span>
              </span>
              <span className="text-[9px] text-primary/80 group-open:hidden shrink-0 ml-1">view</span>
              <span className="text-[9px] text-muted-foreground hidden group-open:inline shrink-0 ml-1">hide</span>
            </summary>
            <div className="space-y-1 pt-1 pb-0.5 opacity-75">
              {passiveIncompatible.map((m) => (
                <div
                  key={m.method}
                  className="px-2 py-1 rounded border border-border/30 bg-muted/20 text-xs flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs shrink-0">{m.icon}</span>
                    <span className="line-through text-muted-foreground text-[11px] truncate">
                      {m.label}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground/80 shrink-0 border border-border/40 px-1 py-0 rounded">
                    No Use / N/A
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  };

  // 1. WISHLIST VIEW: List of viabilities per season (> Low)
  const fallbackWishSeasons = useMemo(() => {
    if (!plant) return [];
    return getWishSeasonalViabilities(plant, conditions, {
      growingSystems,
      growingMethods,
      propagationMethod: activeMethod,
    }).filter(s => s.viability !== 'N/A');
  }, [plant, conditions, growingSystems, growingMethods, activeMethod]);

  const rawWishSeasons = (wishSeasons && wishSeasons.length > 0)
    ? wishSeasons
    : (resolvedWish?.seasons && resolvedWish.seasons.length > 0)
    ? resolvedWish.seasons
    : fallbackWishSeasons;

  const seasons = (rawWishSeasons || []).filter(s => s.viability !== 'N/A');

  const explicitViability = viability || resolvedWish?.overallViability;

  // Guarantee the active current season strictly reflects the explicit/AI assessed viability score
  // and cannot show a contradictory fallback (e.g. Spring: High when AI scored Medium).
  const effectiveSeasons = useMemo(() => {
    if (!currentSeason || !explicitViability) return seasons;
    return seasons.map(s => {
      if (s.season.toLowerCase() === currentSeason.toLowerCase()) {
        return {
          ...s,
          viability: explicitViability,
          score: explicitViability === 'High' ? 5 : explicitViability === 'Medium' ? 3 : 1,
        };
      }
      return s;
    });
  }, [seasons, currentSeason, explicitViability]);

  if ((targetStage === 'Wishlist' || (!resolvedGrow && !resolvedHarvest && !resolvedPrep)) && effectiveSeasons.length > 0) {
    const overallViab = resolvedWish?.overallViability || viability || (effectiveSeasons.some(s => s.viability === 'High') ? 'High' : effectiveSeasons.some(s => s.viability === 'Medium') ? 'Medium' : 'Low');
    const primaryBorderClass = viabilityConfig[overallViab]?.borderClass || 'border-border';

    const viabilityRanks: Record<Viability, number> = { High: 2, Medium: 1, Low: 0, 'N/A': -1 };
    const hasUpcomingHigher = upcomingViability && viabilityRanks[upcomingViability] > viabilityRanks[overallViab];

    // The season currently focused in the popup (clicking a season badge focuses on that season only)
    const activeViewingSeason: SeasonName = selectedSeason 
      || (currentSeason && effectiveSeasons.some(s => s.season.toLowerCase() === currentSeason.toLowerCase()) ? (currentSeason as SeasonName) : null)
      || (resolvedWish?.bestSeason && effectiveSeasons.some(s => s.season.toLowerCase() === resolvedWish.bestSeason!.toLowerCase()) ? resolvedWish.bestSeason : null)
      || effectiveSeasons[0]?.season 
      || 'Spring';

    const viewingMethods = getMethodsForSeason(activeViewingSeason);
    const seasonData = effectiveSeasons.find(s => s.season.toLowerCase() === activeViewingSeason.toLowerCase()) 
      || (plant ? getSeasonalViabilityForSeason(plant, activeViewingSeason, conditions, { growingSystems, growingMethods, propagationMethod: activeMethod }) : undefined);
    const growInfo = seasonData?.growInfo 
      || (plant ? getSeasonalGrowInfo(plant, activeViewingSeason, conditions, { growingSystems, growingMethods, propagationMethod: activeMethod }) : undefined);
    const harvestInfo = seasonData?.harvestInfo 
      || (plant ? getSeasonalHarvestInfo(plant, activeViewingSeason, conditions, { growingSystems, growingMethods, propagationMethod: activeMethod }) : undefined);

    return (
      <Popover 
        open={isOpen} 
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) setSelectedSeason(null);
        }}
      >
        <PopoverTrigger asChild>
          <div
            className="focus:outline-none rounded flex items-center gap-1.5 flex-wrap cursor-pointer"
            title="Click a season badge to view that season's viability methods and feasibility"
          >
            {effectiveSeasons.map((sv) => {
              const cfg = viabilityConfig[sv.viability] || viabilityConfig.Medium;
              const isCurrentSeason = currentSeason && sv.season.toLowerCase() === currentSeason.toLowerCase();
              const isSelected = selectedSeason === sv.season;
              return (
                <Badge
                  key={sv.season}
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSeason(sv.season);
                    setIsOpen(true);
                  }}
                  className={cn(
                    "text-[11px] font-medium cursor-pointer transition-all flex items-center gap-1 select-none py-0.5 hover:shadow-xs",
                    cfg.className,
                    isCurrentSeason && "ring-1 ring-primary/80 font-semibold",
                    isSelected && isOpen && "ring-2 ring-primary shadow-xs"
                  )}
                >
                  <span>{seasonIcons[sv.season] || '🌿'}</span>
                  <span>{sv.season}: {sv.viability}</span>
                  {isCurrentSeason && <span className="text-[10px] opacity-90 font-mono">• Now</span>}
                  {renderMethodInsideBadge(sv.season)}
                </Badge>
              );
            })}

            {hasUpcomingHigher && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[11px] font-medium cursor-pointer transition-all flex items-center gap-1 select-none py-0.5 border-dashed",
                  upcomingViability === 'High' 
                    ? "bg-green-50 text-green-700 border-green-400 dark:bg-green-950/40 dark:text-green-300 dark:border-green-700" 
                    : "bg-yellow-50 text-yellow-700 border-yellow-400 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-700"
                )}
                title={upcomingReasoning || `Viability expected to rise to ${upcomingViability}${upcomingTiming ? ` during ${upcomingTiming}` : ''}`}
              >
                <TrendingUp className="h-3 w-3" />
                <span>
                  {upcomingViability} upcoming
                  {upcomingTiming && ` (${upcomingTiming})`}
                </span>
              </Badge>
            )}

            <Info className="h-3 w-3 opacity-60 ml-0.5" onClick={() => setIsOpen(prev => !prev)} />
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className={cn("w-80 sm:w-96 p-4 text-sm z-50 shadow-xl space-y-3 bg-popover text-popover-foreground max-h-[85vh] overflow-y-auto", primaryBorderClass)}
          side="top"
          align="start"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>Wishlist • {activeViewingSeason}</span>
            </div>
            {effectiveSeasons.length > 1 && (
              <div className="flex items-center gap-1">
                {effectiveSeasons.map((s) => {
                  const isSelected = s.season.toLowerCase() === activeViewingSeason.toLowerCase();
                  return (
                    <button
                      key={s.season}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSeason(s.season);
                      }}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-medium transition-all flex items-center gap-0.5",
                        isSelected 
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs" 
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      title={`View ${s.season} (${s.viability})`}
                    >
                      <span>{seasonIcons[s.season]}</span>
                      <span>{s.season}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {plantName && (
            <p className="font-medium text-xs text-foreground/90">
              {plantName} {gardenName ? <span className="text-muted-foreground font-normal">({gardenName})</span> : ''}
            </p>
          )}

          {/* 1. Prep Methods evaluated for THIS season only */}
          {renderMethodsSection(viewingMethods, activeViewingSeason)}

          {/* 2. Vegetative Grow & Vigor for THIS season */}
          {growInfo && (
            <div className="space-y-1.5 border-t border-border/60 pt-2.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-foreground font-semibold">
                  <span>🌿</span>
                  <span>2. {activeViewingSeason} Grow &amp; Vigor</span>
                </span>
                <div className="flex items-center gap-1">
                  {growInfo.stressFactor && growInfo.stressFactor !== 'None' && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-semibold flex items-center gap-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      <span>{growInfo.stressFactor}</span>
                    </Badge>
                  )}
                  <Badge variant="outline" className={cn("text-[10px] font-mono", viabilityConfig[growInfo.vigorViability]?.className)}>
                    {growInfo.vigorViability}
                  </Badge>
                </div>
              </div>
              <div className="p-2.5 rounded-lg border border-primary/20 bg-muted/20 text-xs space-y-1.5">
                <p className="text-[11px] text-foreground/90 leading-snug">
                  {growInfo.reasoning}
                </p>
                {growInfo.tendingAdvice && (
                  <div className="pt-1 border-t border-border/40 text-[11px] text-foreground/80 leading-snug">
                    <span className="font-semibold text-primary">Tending: </span>
                    <span>{growInfo.tendingAdvice}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Harvest for THIS season (Fruit vs Seeds vs Roots vs Greens) */}
          {harvestInfo && (
            <div className="space-y-1.5 border-t border-border/60 pt-2.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-foreground font-semibold">
                  <span>{harvestTypeConfig[harvestInfo.harvestType]?.icon || '🍎'}</span>
                  <span>3. {activeViewingSeason} Harvest</span>
                </span>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-medium", harvestTypeConfig[harvestInfo.harvestType]?.badgeClass)}>
                    {harvestInfo.harvestType}
                  </Badge>
                  <Badge variant="outline" className={cn("text-[10px] font-mono", viabilityConfig[harvestInfo.ripenessViability]?.className)}>
                    {harvestInfo.ripenessViability}
                  </Badge>
                </div>
              </div>
              <div className="p-2.5 rounded-lg border border-primary/20 bg-muted/20 text-xs space-y-1.5">
                <div className="text-[11px] font-medium text-foreground">
                  <span>{harvestInfo.harvestWindow}</span>
                </div>
                <p className="text-[11px] text-foreground/90 leading-snug">
                  {harvestInfo.description}
                </p>
                {harvestInfo.seedSavingNotes && (
                  <div className="p-2 rounded border border-amber-500/30 bg-amber-500/10 text-xs space-y-0.5">
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <span>🌾</span> Seed Saving Guide:
                    </span>
                    <p className="text-[10px] text-amber-900/90 dark:text-amber-200/90 leading-snug">
                      {harvestInfo.seedSavingNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Full Cycle Feasibility Trajectory for THIS season */}
          {seasonData && (
            <div className="space-y-1.5 border-t border-border/60 pt-2.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>{activeViewingSeason} Full Lifecycle Feasibility</span>
                <Badge variant="outline" className={cn("text-[10px] font-mono", viabilityConfig[seasonData.viability]?.className)}>
                  {seasonData.viability} Viability
                </Badge>
              </div>
              <div className="p-2.5 rounded-lg border border-primary/30 bg-primary/5 text-xs space-y-1">
                <p className="text-[11px] text-foreground/90 leading-snug">
                  {seasonData.reasoning}
                </p>
                {seasonData.prepViability && seasonData.growViability && seasonData.harvestViability && (
                  <div className="text-[9px] text-muted-foreground font-mono flex items-center gap-1 pt-1 border-t border-border/40">
                    <span>Prep {seasonData.prepViability}</span>
                    <span>➔</span>
                    <span>Grow {seasonData.growViability}</span>
                    <span>➔</span>
                    <span>Harv {seasonData.harvestViability}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {hasUpcomingHigher && (
            <div className="p-2.5 rounded-lg border border-primary/30 bg-primary/5 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                <span>Upcoming Viability: {upcomingViability}</span>
                {upcomingTiming && <span className="font-mono text-[10px] text-muted-foreground">• {upcomingTiming}</span>}
              </div>
              {upcomingReasoning && (
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {upcomingReasoning}
                </p>
              )}
            </div>
          )}

          {(reasoning || resolvedWish?.reasoning) && (
            <div className="space-y-1 border-t border-border/60 pt-2.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                <span>Horticultural Assessment</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {reasoning || resolvedWish?.reasoning}
              </p>
            </div>
          )}

          {resolvedWish?.bestSeason && resolvedWish.bestSeason.toLowerCase() !== activeViewingSeason.toLowerCase() && (
            <div className="p-2 rounded-lg border border-primary/20 bg-muted/20 text-xs flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                Optimal target across all seasons: <span className="font-semibold text-foreground">{resolvedWish.bestSeason}</span>
              </p>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  // 2. PREP VIEW: 3-Stage Lifecycle Pipeline (Prep -> Grow -> Harv)
  if (resolvedPrep && (targetStage === 'Planting' || (targetStage !== 'Growing' && targetStage !== 'Harvest' && targetStage !== 'Wishlist'))) {
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
              {renderMethodInsideBadge()}
              <Info className="h-3 w-3 opacity-60 ml-0.5" />
            </Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className={cn("w-80 sm:w-96 p-4 text-sm z-50 shadow-xl space-y-3 bg-popover text-popover-foreground max-h-[85vh] overflow-y-auto", overallCfg.borderClass)}
          side="top"
          align="start"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <Sprout className="h-3.5 w-3.5 text-primary" />
              <span>Prep Lifecycle &amp; Botanical Methods</span>
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

          {/* Methods screen expanded directly on click */}
          {renderMethodsSection()}

          {/* 3-Stage Lifecycle Trajectory (Shown when active method is botanically compatible) */}
          {!isPrepNA && (
            <>
              <div className="space-y-2 border-t border-border/60 pt-2.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Selected Method Lifecycle ({activeMethodInfo?.label || activeMethod})
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
            </>
          )}

          {resolvedPrep.summary && (
            <div className="p-2 rounded border border-primary/20 bg-primary/5 text-xs text-foreground/90 font-medium">
              💡 {resolvedPrep.summary}
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  // 3. GROW VIEW: In-Ground Vigor & Acute Stress Monitoring
  if (resolvedGrow && (targetStage === 'Growing' || (targetStage !== 'Harvest' && targetStage !== 'Planting' && targetStage !== 'Wishlist'))) {
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
              {renderMethodInsideBadge()}
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
  if (resolvedHarvest && (targetStage === 'Harvest' || (targetStage !== 'Growing' && targetStage !== 'Planting' && targetStage !== 'Wishlist'))) {
    const cfg = viabilityConfig[resolvedHarvest.ripenessViability] || viabilityConfig.High;
    const effectiveHarvestType = resolvedHarvest.harvestType 
      || (plant ? getSeasonalHarvestInfo(plant, (currentSeason || 'Spring') as SeasonName, conditions).harvestType : undefined);
    const effectiveSeedSavingNotes = resolvedHarvest.seedSavingNotes 
      || (plant ? getSeasonalHarvestInfo(plant, (currentSeason || 'Spring') as SeasonName, conditions).seedSavingNotes : undefined);

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
              {effectiveHarvestType && (
                <span className="text-[10px] opacity-90 ml-0.5">
                  • {harvestTypeConfig[effectiveHarvestType]?.icon || ''} {effectiveHarvestType.split('/')[0].trim()}
                </span>
              )}
              {renderMethodInsideBadge()}
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
            <div className="flex items-center gap-1">
              {effectiveHarvestType && (
                <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-medium", harvestTypeConfig[effectiveHarvestType]?.badgeClass)}>
                  {effectiveHarvestType}
                </Badge>
              )}
              <Badge variant="outline" className={cn("text-xs font-semibold", cfg.className)}>
                {resolvedHarvest.harvestWindow}
              </Badge>
            </div>
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

          {effectiveSeedSavingNotes && (
            <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs space-y-1">
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <span>🌾</span> Seed Saving Guide:
              </span>
              <p className="text-[11px] text-amber-900/90 dark:text-amber-200/90 leading-snug">
                {effectiveSeedSavingNotes}
              </p>
            </div>
          )}

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
  const effectiveViability: Viability = (viability || resolvedWish?.overallViability || (stageViability && 'overallViability' in stageViability ? (stageViability as any).overallViability : undefined) || 'Low') as Viability;
  const config = viabilityConfig[effectiveViability] || viabilityConfig.Low;

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
            {renderMethodInsideBadge()}
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
            {reasoning ? reasoning : (resolvedWish?.reasoning ? resolvedWish.reasoning : "No detailed reasoning saved for this plant yet. Click 'Viability Analysis' in the plant menu to generate a fresh assessment.")}
          </div>
        </div>

        {renderMethodsSection()}
      </PopoverContent>
    </Popover>
  );
}
