'use client';

import { useState, useEffect, useMemo } from 'react';
import type { PlantingWithPlant, Conditions, StatusHistory, PropagationMethod, ViabilityAnalysisMode } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, ExternalLink, Copy, Package, Sparkles, ArrowRight, Fence, Share2, ChevronDown, ChevronUp, Sprout, RotateCcw, BrainCircuit } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ViabilityIndicator } from './ViabilityIndicator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { getSuitableSeasons, evaluatePlantingViability, Viability, getAllPropagationMethodViabilities, ALL_PROPAGATION_METHODS, type PropagationMethodInfo } from '@/lib/viability';
import { db } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { useExtensions } from '@/extensions/use-extensions';
import { getCuratedPlantImage, resolveRealPlantImage } from '@/lib/plant-images';
import { SharePlantDialog } from './SharePlantDialog';

type PlantCardProps = {
  planting: PlantingWithPlant;
  viability?: Viability;
  viabilityReasoning?: string;
  upcomingViability?: 'High' | 'Medium';
  upcomingTiming?: string;
  upcomingReasoning?: string;
  currentSeason?: string;
  onEdit: () => void;
  onDelete: () => void;
  onMarkAsDuplicate: () => void;
  onQuickStatusChange: (newStatus: StatusHistory['status']) => void;
  isDuplicateSource: boolean;
  isSelectionMode: boolean;
  onSelectDuplicate: () => void;
  onGetViability: () => void;
  showGardenLabel?: boolean;
  isPriority?: boolean;
  otherPlantings?: PlantingWithPlant[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  viabilityMechanism?: ViabilityAnalysisMode;
};

export function PlantCard({
    planting, 
    viability, 
    viabilityReasoning,
    upcomingViability,
    upcomingTiming,
    upcomingReasoning,
    currentSeason,
    onEdit, 
    onDelete, 
    onMarkAsDuplicate,
    onQuickStatusChange,
    isDuplicateSource,
    isSelectionMode,
    onSelectDuplicate,
    onGetViability,
    showGardenLabel,
    isPriority = false,
    otherPlantings,
    isCollapsed = false,
    onToggleCollapse,
    viabilityMechanism,
}: PlantCardProps) {
    const { plant } = planting;
    const syncImageUrl = getCuratedPlantImage(plant, planting.name);
    const [resolvedImageUrl, setResolvedImageUrl] = useState<string | undefined>(syncImageUrl);
    const [imgFailed, setImgFailed] = useState(false);

    useEffect(() => {
        setImgFailed(false);
        const currentSync = getCuratedPlantImage(plant, planting.name);
        if (currentSync) {
            setResolvedImageUrl(currentSync);
            return;
        }
        let cancelled = false;
        resolveRealPlantImage(plant.species, planting.name, plant.id).then((url) => {
            if (!cancelled && url) {
                setResolvedImageUrl(url);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [plant, planting.name]);

    const activeImageUrl = !imgFailed ? (syncImageUrl || resolvedImageUrl) : undefined;
    const latestStatus = planting.history && planting.history.length > 0 ? planting.history[planting.history.length - 1] : null;
    const suitableSeasons = getSuitableSeasons(plant);
    const { getBySlot } = useExtensions();
    const cardBadgeExtensions = getBySlot('plant-card-badge');
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

    const statusConfig: { [key: string]: string } = {
        Wishlist: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
        Planting: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
        Growing: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
        Harvest: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800',
    };

    const gardenConditions = planting.garden?.conditions;
    const activeSeason = currentSeason || gardenConditions?.currentSeason;

    const { toast } = useToast();
    const activePropagationMethod: PropagationMethod = (planting.propagationMethod as PropagationMethod) || 'seed';

    const methodViabilities = useMemo(() => {
        if (planting.methodViabilities && planting.methodViabilities.length > 0) {
            return planting.methodViabilities;
        }
        const conds: Conditions = planting.garden?.conditions || {
            temperature: '20°C',
            sunlight: 'Full Sun',
            soil: 'Loam',
            currentSeason: (activeSeason as any) || 'Spring',
        };
        return getAllPropagationMethodViabilities(plant, conds, {
            growingSystems: planting.garden?.growingSystems,
            growingMethods: planting.garden?.growingMethods,
        });
    }, [plant, planting.garden, activeSeason, planting.methodViabilities]);

    const activeMethodInfo = methodViabilities.find(m => m.method === activePropagationMethod) || methodViabilities[0];

    const handleSwitchPropagationMethod = async (newMethod: PropagationMethod) => {
        try {
            await db.plantings.update(planting.id, { propagationMethod: newMethod });
            toast({
                title: 'Prep Method Updated',
                description: `${planting.name} switched to ${newMethod.replace('-', ' ')}. Viabilities updated.`,
            });
        } catch (error) {
            toast({
                title: 'Update Failed',
                description: 'Could not update propagation method.',
                variant: 'destructive',
            });
        }
    };

    const hasAiAssessment = Boolean(planting.viability || viability);
    const isPendingAi = viabilityMechanism === 'ai' && !hasAiAssessment;

    // Unified 4-stage viability analysis
    const stageViability = isPendingAi 
        ? undefined 
        : (viabilityMechanism === 'local'
            ? evaluatePlantingViability(planting, gardenConditions, {
                growingSystems: planting.garden?.growingSystems,
                growingMethods: planting.garden?.growingMethods,
                propagationMethod: activePropagationMethod,
              })
            : (planting.stageViability || evaluatePlantingViability(planting, gardenConditions, {
                growingSystems: planting.garden?.growingSystems,
                growingMethods: planting.garden?.growingMethods,
                propagationMethod: activePropagationMethod,
              })));

    const viabilityIndicatorElement = isPendingAi ? (
        <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
                e.stopPropagation();
                onGetViability();
            }}
            className="h-6 text-[10px] px-2 py-0 border-dashed border-primary/50 text-primary hover:bg-primary/10 flex items-center gap-1 font-mono"
            title="Local viability is OFF. Click to run AI viability analysis."
        >
            <BrainCircuit className="h-3 w-3 text-blue-500" />
            <span>Run AI Viability</span>
        </Button>
    ) : (
        <ViabilityIndicator 
            stageViability={stageViability}
            viability={viability || planting.viability} 
            reasoning={viabilityReasoning || planting.viabilityReasoning} 
            plantName={planting.name}
            gardenName={planting.garden?.name}
            upcomingViability={upcomingViability || planting.upcomingViability}
            upcomingTiming={upcomingTiming || planting.upcomingTiming}
            upcomingReasoning={upcomingReasoning || planting.upcomingReasoning}
            currentSeason={activeSeason}
            seasonalViabilities={planting.seasonalViabilities}
            prepForecast={planting.prepForecast}
            growAssessment={planting.growAssessment}
            harvestAssessment={planting.harvestAssessment}
            propagationMethod={activePropagationMethod}
            plant={plant}
            conditions={gardenConditions}
            relatedMethods={methodViabilities}
            onSelectPropagationMethod={handleSwitchPropagationMethod}
        />
    );



    const dropdownMenuContent = (
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {latestStatus?.status === 'Wishlist' && <DropdownMenuItem onClick={() => onQuickStatusChange('Planting')}><ArrowRight className="mr-2 h-4 w-4" />Mark as Planting</DropdownMenuItem>}
            {latestStatus?.status === 'Planting' && <DropdownMenuItem onClick={() => onQuickStatusChange('Growing')}><ArrowRight className="mr-2 h-4 w-4" />Mark as Growing</DropdownMenuItem>}
            {latestStatus?.status === 'Growing' && <DropdownMenuItem onClick={() => onQuickStatusChange('Harvest')}><ArrowRight className="mr-2 h-4 w-4" />Mark for Harvest</DropdownMenuItem>}
            {latestStatus?.status === 'Harvest' && (
                <>
                    <DropdownMenuItem onClick={() => onQuickStatusChange('Wishlist')}>
                        <RotateCcw className="mr-2 h-4 w-4" />Cycle to Wishlist (Next Season)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onQuickStatusChange('Planting')}>
                        <Sprout className="mr-2 h-4 w-4" />Restart Succession (Planting)
                    </DropdownMenuItem>
                </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onGetViability}>
                <Sparkles className="mr-2 h-4 w-4" />
                Viability Analysis
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                setIsShareDialogOpen(true);
            }}>
                <Share2 className="mr-2 h-4 w-4" />
                Share My Plant
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMarkAsDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Mark as Duplicate...
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                {latestStatus ? `Last update: ${format(parseISO(latestStatus.date), 'MMM d, yyyy')}` : 'No history'}
            </DropdownMenuItem>
        </DropdownMenuContent>
    );

    // Collapsed list view rendering
    if (isCollapsed) {
        return (
            <Card className="flex items-center justify-between p-3 transition-all hover:bg-muted/30 gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {activeImageUrl ? (
                        <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-muted/40">
                            <img
                                src={activeImageUrl}
                                alt={plant.species}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                                onError={() => setImgFailed(true)}
                                loading="lazy"
                            />
                        </div>
                    ) : (
                        <div className="w-12 h-12 flex-shrink-0 rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground">
                            <Sprout className="h-6 w-6 opacity-60" />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-headline font-semibold text-sm truncate">{planting.name}</h4>
                            <span className="text-xs text-muted-foreground truncate hidden sm:inline">({plant.species})</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {viabilityIndicatorElement}
                            {latestStatus && (
                                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-normal", statusConfig[latestStatus.status])}>
                                    {latestStatus.status}
                                </Badge>
                            )}
                            {showGardenLabel && planting.garden && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Fence className="h-2.5 w-2.5" />
                                    {planting.garden.name}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {onToggleCollapse && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleCollapse} title="Expand card">
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        {dropdownMenuContent}
                    </DropdownMenu>
                </div>
            </Card>
        );
    }

    const cardContent = (
        <>
            {activeImageUrl && (
                 <div className="relative w-full h-44 overflow-hidden rounded-t-lg bg-muted/40">
                    <img
                        src={activeImageUrl}
                        alt={`Photograph of ${plant.species}`}
                        width={400}
                        height={176}
                        {...(isPriority
                            ? ({ fetchPriority: 'high' } as any)
                            : { loading: 'lazy' })}
                        onError={() => setImgFailed(true)}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                 </div>
            )}
            <CardHeader className={cn(!activeImageUrl && "pb-2")}>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="font-headline text-xl leading-tight mb-1 pr-2">{planting.name}</CardTitle>
                         <CardDescription className="flex items-center gap-2">
                            <span>{plant.species}</span>
                            <a href={`https://www.google.com/search?q=${encodeURIComponent(plant.species)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                                <ExternalLink className="h-3 w-3" />
                                <span className="sr-only">Search for {plant.species}</span>
                            </a>
                        </CardDescription>
                    </div>
                    <div className="flex items-center -mt-1 -mr-2">
                        {onToggleCollapse && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => {
                                e.stopPropagation();
                                onToggleCollapse();
                            }} title="Collapse card">
                                <ChevronUp className="h-4 w-4" />
                            </Button>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            {dropdownMenuContent}
                        </DropdownMenu>
                    </div>
                </div>
                 <div className="flex flex-wrap gap-2 items-center pt-2">
                    {viabilityIndicatorElement}
                    {latestStatus && (
                        <Badge variant="outline" className={cn("font-normal", statusConfig[latestStatus.status])}>
                            {latestStatus.status}
                        </Badge>
                    )}
                    {latestStatus?.status === 'Planting' && planting.seedsOnHand && planting.seedsOnHand > 0 && (
                        <Badge variant="secondary" className="flex items-center gap-1.5">
                            <Package className="h-3 w-3" />
                            {planting.seedsOnHand} seeds on hand
                        </Badge>
                     )}
                     {plant.verifiedGrowerCount && plant.verifiedGrowerCount > 0 && (
                        <Badge variant="secondary" className="text-[11px] font-normal">
                            ✓ {plant.verifiedGrowerCount} growers
                        </Badge>
                     )}
                     {cardBadgeExtensions.map((ext) => {
                        const BadgeComp = ext.PlantCardBadge;
                        return BadgeComp ? (
                            <BadgeComp key={ext.id} planting={planting} activeLocation={planting.garden} />
                        ) : null;
                     })}
                     {suitableSeasons.length === 4 ? (
                        <Badge variant="outline" className="font-normal">Year-Round</Badge>
                     ) : suitableSeasons.length > 0 ? (
                        suitableSeasons.map(season => (
                            <Badge key={season} variant="outline" className="font-normal">{season}</Badge>
                        ))
                     ) : (
                        <button onClick={onEdit} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                            No seasons found. Edit plant to add its seasons.
                        </button>
                     )}
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                <div>
                    <h4 className="font-bold text-sm mb-1 tracking-wide uppercase text-muted-foreground">Germination Needs</h4>
                    <p className="text-sm text-foreground/80 line-clamp-3">{plant.germinationNeeds}</p>
                </div>
                <div>
                    <h4 className="font-bold text-sm mb-1 tracking-wide uppercase text-muted-foreground">Optimal Conditions</h4>
                    <p className="text-sm text-foreground/80 line-clamp-3">{plant.optimalConditions}</p>
                </div>
            </CardContent>
            {showGardenLabel && planting.garden && (
                <CardFooter>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
                        <Fence className="h-3 w-3" />
                        <span>{planting.garden.name}</span>
                    </div>
                </CardFooter>
            )}
        </>
    );

    const shareDialogElement = (
        <SharePlantDialog
            isOpen={isShareDialogOpen}
            onOpenChange={setIsShareDialogOpen}
            planting={planting}
            viability={viability}
            viabilityReasoning={viabilityReasoning}
            upcomingViability={upcomingViability}
            upcomingTiming={upcomingTiming}
            upcomingReasoning={upcomingReasoning}
            currentSeason={currentSeason}
            onGetViability={onGetViability}
            otherPlantings={otherPlantings}
        />
    );

    if (isSelectionMode) {
        return (
             <div
                role="button"
                aria-disabled={isDuplicateSource}
                onClick={isDuplicateSource ? undefined : onSelectDuplicate}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        if (!isDuplicateSource) {
                            onSelectDuplicate();
                        }
                    }
                }}
                tabIndex={isDuplicateSource ? -1 : 0}
                className={cn(
                    "w-full h-full text-left rounded-lg transition-all focus:outline-none",
                    isDuplicateSource 
                        ? "opacity-50 cursor-not-allowed" 
                        : "cursor-pointer hover:ring-2 hover:ring-primary focus:ring-2 focus:ring-primary"
                )}
            >
                <Card className={cn(
                    "flex flex-col h-full pointer-events-none", 
                    isDuplicateSource && "border-primary ring-2 ring-primary bg-primary/10",
                    !isDuplicateSource && "group-hover:shadow-lg group-hover:-translate-y-1"
                )}>
                    {cardContent}
                </Card>
                {shareDialogElement}
             </div>
        );
    }
    
    return (
        <>
            <Card className="flex flex-col transition-all hover:shadow-lg hover:-translate-y-1">
                {cardContent}
            </Card>
            {shareDialogElement}
        </>
    );
}
