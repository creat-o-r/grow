

'use client';
import { useState, useEffect, useMemo } from 'react';
import type { PlantingWithPlant, StatusHistory, PropagationMethod, ViabilityAnalysisMode, GardenLocation, Planting } from '@/lib/types';
import { evaluatePlantingViability, Viability, getAllPropagationMethodViabilities, ALL_PROPAGATION_METHODS, type PropagationMethodInfo } from '@/lib/viability';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink, CheckCircle, MoreHorizontal, ArrowRightLeft, CopyPlus, Fence } from 'lucide-react';
import { ToastAction } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ViabilityIndicator } from './ViabilityIndicator';
import { getCuratedPlantImage, resolveRealPlantImage } from '@/lib/plant-images';
import { MoveOrDuplicatePlantDialog } from './MoveOrDuplicatePlantDialog';

type PlantingDashboardCardProps = {
    planting: PlantingWithPlant;
    viability?: Viability;
    viabilityReasoning?: string;
    upcomingViability?: 'High' | 'Medium';
    upcomingTiming?: string;
    upcomingReasoning?: string;
    currentSeason?: string;
    onQuickStatusChange: (planting: PlantingWithPlant, newStatus: StatusHistory['status']) => void;
    viabilityMechanism?: ViabilityAnalysisMode;
    onSwitchGarden?: (gardenId: string) => void;
};

export function PlantingDashboardCard({ 
    planting, 
    viability, 
    viabilityReasoning, 
    upcomingViability,
    upcomingTiming,
    upcomingReasoning,
    currentSeason,
    onQuickStatusChange,
    viabilityMechanism = 'local',
    onSwitchGarden,
}: PlantingDashboardCardProps) {
    const [seedsOnHand, setSeedsOnHand] = useState<number | string>('');
    const [plannedQty, setPlannedQty] = useState<number | string>(planting.plannedQty || '');
    const [isSavingPlannedQty, setIsSavingPlannedQty] = useState(false);
    const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
    const [transferDialogMode, setTransferDialogMode] = useState<'move' | 'duplicate'>('move');

    const locations = useLiveQuery(() => db.locations.toArray(), []) || [];
    const otherGardens = useMemo(() => {
        return locations.filter(loc => loc.id !== planting.gardenId);
    }, [locations, planting.gardenId]);

    const handleQuickMove = async (targetGarden: GardenLocation) => {
        try {
            await db.plantings.update(planting.id, {
                gardenId: targetGarden.id,
                viability: undefined,
                viabilityReasoning: undefined,
                stageViability: undefined,
                prepForecast: undefined,
                growAssessment: undefined,
                harvestAssessment: undefined,
                methodViabilities: undefined,
                seasonalViabilities: undefined,
            });
            toast({
                title: 'Plant Moved',
                description: `"${planting.name}" moved to "${targetGarden.name}".`,
                action: onSwitchGarden ? (
                    <ToastAction altText={`Switch to ${targetGarden.name}`} onClick={() => onSwitchGarden(targetGarden.id)}>
                        Switch Garden
                    </ToastAction>
                ) : undefined,
            });
        } catch (error) {
            toast({
                title: 'Move Failed',
                description: 'Could not move plant to target garden.',
                variant: 'destructive',
            });
        }
    };

    const handleQuickDuplicate = async (targetGarden: GardenLocation) => {
        try {
            const isSameGarden = targetGarden.id === planting.gardenId;
            const newName = isSameGarden ? `${planting.name} (Copy)` : planting.name;
            const nowIso = new Date().toISOString();
            const newPlanting: Planting = {
                id: `planting-${Date.now()}`,
                plantId: planting.plantId,
                gardenId: targetGarden.id,
                name: newName,
                createdAt: nowIso,
                history: [
                    {
                        id: `status-${Date.now()}`,
                        status: (planting.history?.[planting.history.length - 1]?.status) || 'Wishlist',
                        date: nowIso,
                        notes: `Duplicated from ${planting.name} (${planting.garden?.name || 'Garden'})`,
                    },
                ],
                seedsOnHand: planting.seedsOnHand,
                plannedQty: planting.plannedQty,
                propagationMethod: planting.propagationMethod || 'seed',
                swapAvailable: planting.swapAvailable,
            };
            await db.plantings.add(newPlanting);
            toast({
                title: 'Plant Duplicated',
                description: `Created "${newPlanting.name}" in "${targetGarden.name}".`,
                action: !isSameGarden && onSwitchGarden ? (
                    <ToastAction altText={`View in ${targetGarden.name}`} onClick={() => onSwitchGarden(targetGarden.id)}>
                        View Garden
                    </ToastAction>
                ) : undefined,
            });
        } catch (error) {
            toast({
                title: 'Duplicate Failed',
                description: 'Could not duplicate plant.',
                variant: 'destructive',
            });
        }
    };

    const { toast } = useToast();
    
    // Store initial state for undo
    const [previousPlantingState, setPreviousPlantingState] = useState<Partial<PlantingWithPlant> | null>(null);
    useEffect(() => {
        setPreviousPlantingState({
            history: planting.history,
            seedsOnHand: planting.seedsOnHand,
            plannedQty: planting.plannedQty,
        });
    }, [planting.history, planting.seedsOnHand, planting.plannedQty]);

    
    const latestStatus = planting.history && planting.history.length > 0 ? planting.history[planting.history.length - 1] : null;
    const statusConfig: { [key: string]: string } = {
        Wishlist: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
        Planting: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
        Growing: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
        Harvest: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800',
    };

    const activePropagationMethod: PropagationMethod = planting.propagationMethod || 'seed';

    const methodViabilities = useMemo(() => {
        if (planting.methodViabilities && planting.methodViabilities.length > 0) {
            return planting.methodViabilities;
        }
        const conds = planting.garden?.conditions || {
            temperature: '20°C',
            sunlight: 'Full Sun',
            soil: 'Loam',
            currentSeason: (currentSeason as any) || 'Spring',
        };
        return getAllPropagationMethodViabilities(planting.plant, conds, {
            growingSystems: planting.garden?.growingSystems,
            growingMethods: planting.garden?.growingMethods,
        });
    }, [planting.plant, planting.garden, currentSeason, planting.methodViabilities]);

    const activeMethodInfo = methodViabilities.find(m => m.method === activePropagationMethod);

    const otherApplicableMethods = useMemo(() => {
        return methodViabilities.filter(m => m.overallViability !== 'N/A' && !m.isIncompatible && m.method !== activePropagationMethod);
    }, [methodViabilities, activePropagationMethod]);
    const otherApplicableCount = otherApplicableMethods.length;

    const handlePropagationMethodChange = async (newMethod: PropagationMethod) => {
        try {
            await db.plantings.update(planting.id, { propagationMethod: newMethod });
            toast({
                title: 'Propagation Method Updated',
                description: `${planting.name} switched to ${newMethod.replace('-', ' ')}. Viability updated.`,
            });
        } catch (error) {
            toast({
                title: 'Update Failed',
                description: 'Could not update propagation method.',
                variant: 'destructive',
            });
        }
    };

    const getInventoryLabel = (method: PropagationMethod) => {
        switch (method) {
            case 'transplant': return 'Starts / Transplants on Hand';
            case 'cutting': return 'Cuttings on Hand';
            case 'air-layering': return 'Air Layers Prepped';
            case 'division': return 'Divisions on Hand';
            case 'runner': return 'Runners on Hand';
            case 'bulb-clove': return 'Bulbs / Cloves on Hand';
            default: return 'Seeds on Hand';
        }
    };

    const handleUndo = async () => {
        if (!previousPlantingState) return;
        try {
            await db.plantings.update(planting.id, {
                history: previousPlantingState.history,
                seedsOnHand: previousPlantingState.seedsOnHand,
                plannedQty: previousPlantingState.plannedQty,
            });
            toast({
                title: 'Undo Successful',
                description: `${planting.name} has been reverted.`,
            });
        } catch (error) {
            toast({
                title: 'Undo Failed',
                description: 'Could not revert the planting status.',
                variant: 'destructive',
            });
        }
    };


    const updatePlantingStatus = async (status: 'Planting' | 'Growing' | 'Wishlist', seeds?: number) => {
        onQuickStatusChange(planting, status);
        if (seeds !== undefined) {
             await db.plantings.update(planting.id, { seedsOnHand: seeds });
        }
        if (status === 'Planting') {
            setSeedsOnHand('');
        }
    };

    const handleSetSeeds = () => {
        const qty = Number(seedsOnHand);
        if (qty > 0) {
            updatePlantingStatus('Planting', qty);
        } else {
            toast({
                title: 'Invalid Quantity',
                description: 'Please enter a number greater than 0 for seeds on hand.',
                variant: 'destructive',
            });
        }
    };

    const handleSetPlannedQty = async () => {
        const qty = Number(plannedQty);
        if (plannedQty !== '' && !isNaN(qty) && qty >= 0 && qty !== planting.plannedQty) {
            setIsSavingPlannedQty(true);
            await db.plantings.update(planting.id, { plannedQty: qty });
            setTimeout(() => setIsSavingPlannedQty(false), 1000); // Show checkmark briefly
        } else if (plannedQty === '' && planting.plannedQty !== undefined) {
            await db.plantings.update(planting.id, { plannedQty: undefined });
        } else if (plannedQty !== '' && isNaN(qty)) {
             toast({
                title: 'Invalid Quantity',
                description: 'Please enter a valid number for planned quantity.',
                variant: 'destructive',
            });
        }
    };

    const seedsRequired = Math.max(0, (Number(plannedQty) || 0) - (planting.seedsOnHand || 0));
    const effectiveViability = viability || planting.viability;
    const syncImageUrl = getCuratedPlantImage(planting.plant, planting.name);
    const [resolvedImageUrl, setResolvedImageUrl] = useState<string | undefined>(syncImageUrl);
    const [imgFailed, setImgFailed] = useState(false);

    useEffect(() => {
        setImgFailed(false);
        const currentSync = getCuratedPlantImage(planting.plant, planting.name);
        if (currentSync) {
            setResolvedImageUrl(currentSync);
            return;
        }
        let cancelled = false;
        resolveRealPlantImage(planting.plant.species, planting.name, planting.plant.id).then((url) => {
            if (!cancelled && url) {
                setResolvedImageUrl(url);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [planting.plant, planting.name]);

    const activeImageUrl = !imgFailed ? (syncImageUrl || resolvedImageUrl) : undefined;

    return (
        <Card className="flex flex-col bg-muted/50 overflow-hidden">
            {activeImageUrl && (
                <div className="relative w-full h-36 overflow-hidden bg-muted/40">
                    <img
                        src={activeImageUrl}
                        alt={`Photograph of ${planting.plant.species}`}
                        width={400}
                        height={144}
                        loading="lazy"
                        onError={() => setImgFailed(true)}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <CardTitle className="font-headline text-lg leading-tight mb-1 pr-2 truncate">{planting.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                            <span>{planting.plant.species}</span>
                            <a href={`https://www.google.com/search?q=${encodeURIComponent(planting.plant.species)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                                <ExternalLink className="h-3 w-3" />
                                <span className="sr-only">Search for {planting.plant.species}</span>
                            </a>
                        </CardDescription>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 -mr-2 -mt-1 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            {/* Move to Garden */}
                            {otherGardens.length > 0 ? (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                                        <span>Move to Garden</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent onClick={(e) => e.stopPropagation()}>
                                        {otherGardens.map(loc => (
                                            <DropdownMenuItem
                                                key={loc.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleQuickMove(loc);
                                                }}
                                            >
                                                <Fence className="mr-2 h-4 w-4" />
                                                <span>{loc.name}</span>
                                            </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setTransferDialogMode('move');
                                                setIsTransferDialogOpen(true);
                                            }}
                                        >
                                            <span>More options / New garden...</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            ) : (
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setTransferDialogMode('move');
                                        setIsTransferDialogOpen(true);
                                    }}
                                >
                                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                                    <span>Move to Garden...</span>
                                </DropdownMenuItem>
                            )}

                            {/* Duplicate to Garden */}
                            {locations.length > 0 ? (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                                        <CopyPlus className="mr-2 h-4 w-4" />
                                        <span>Duplicate to Garden</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent onClick={(e) => e.stopPropagation()}>
                                        {locations.map(loc => (
                                            <DropdownMenuItem
                                                key={loc.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleQuickDuplicate(loc);
                                                }}
                                            >
                                                <Fence className="mr-2 h-4 w-4" />
                                                <span>{loc.name} {loc.id === planting.gardenId ? '(Current)' : ''}</span>
                                            </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setTransferDialogMode('duplicate');
                                                setIsTransferDialogOpen(true);
                                            }}
                                        >
                                            <span>Custom copy / New garden...</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            ) : (
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setTransferDialogMode('duplicate');
                                        setIsTransferDialogOpen(true);
                                    }}
                                >
                                    <CopyPlus className="mr-2 h-4 w-4" />
                                    <span>Duplicate to Garden...</span>
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex flex-wrap gap-2 items-center pt-2">
                    <ViabilityIndicator 
                        stageViability={viabilityMechanism === 'ai' && !planting.viability && !effectiveViability ? undefined : evaluatePlantingViability(planting, planting.garden?.conditions, { propagationMethod: activePropagationMethod, ignoreAi: viabilityMechanism === 'local' })}
                        viability={effectiveViability} 
                        reasoning={viabilityReasoning || planting.viabilityReasoning} 
                        plantName={planting.name}
                        upcomingViability={upcomingViability || planting.upcomingViability}
                        upcomingTiming={upcomingTiming || planting.upcomingTiming}
                        upcomingReasoning={upcomingReasoning || planting.upcomingReasoning}
                        currentSeason={currentSeason}
                        seasonalViabilities={planting.seasonalViabilities}
                        prepForecast={planting.prepForecast}
                        growAssessment={planting.growAssessment}
                        harvestAssessment={planting.harvestAssessment}
                        plant={planting.plant}
                        conditions={planting.garden?.conditions}
                        propagationMethod={activePropagationMethod}
                        otherMethodsCount={otherApplicableCount}
                        relatedMethods={methodViabilities}
                        onSelectPropagationMethod={handlePropagationMethodChange}
                    />
                    {latestStatus && (
                        <Badge variant="outline" className={cn("font-normal w-fit", statusConfig[latestStatus.status])}>
                            {latestStatus.status}
                        </Badge>
                    )}
                </div>

                {/* Botanical Propagation Method Selector with Real-Time Viabilities */}
                <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground/80 flex items-center gap-1">
                            <span>🌿</span>
                            <span>Prep Method</span>
                        </span>
                        {activeMethodInfo && (
                            <div className="flex items-center gap-1.5">
                                <Badge 
                                    variant="outline" 
                                    className={cn(
                                        "text-[10px] font-mono px-1.5 py-0",
                                        activeMethodInfo.overallViability === 'High' ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300" :
                                        activeMethodInfo.overallViability === 'Medium' ? "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300" :
                                        activeMethodInfo.overallViability === 'N/A' ? "bg-muted text-muted-foreground border-border" :
                                        "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300"
                                    )}
                                >
                                    {activeMethodInfo.overallViability === 'N/A' ? 'No Use / N/A' : `${activeMethodInfo.overallViability} Viability`}
                                </Badge>
                                {otherApplicableCount > 0 && (
                                    <span 
                                        className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold"
                                        title={`Applicable methods: ${methodViabilities.filter(m => !m.isIncompatible && m.overallViability !== 'N/A').map(m => `${m.label} (${m.overallViability})`).join(', ')}`}
                                    >
                                        <span>+{otherApplicableCount}</span>
                                        <span className="tracking-tighter opacity-80">{otherApplicableMethods.slice(0, 3).map(m => m.icon).join('')}</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <Select onValueChange={(val) => handlePropagationMethodChange(val as PropagationMethod)} value={activePropagationMethod}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select prep method" />
                        </SelectTrigger>
                        <SelectContent>
                            {methodViabilities.map((info) => {
                                const isNA = info.overallViability === 'N/A';
                                return (
                                    <SelectItem key={info.method} value={info.method} className="text-xs">
                                        <div className="flex items-center justify-between gap-2 w-full">
                                            <span className={cn("flex items-center gap-1.5", isNA && "line-through text-muted-foreground")}>
                                                <span>{info.icon}</span>
                                                <span>{info.label}</span>
                                                {info.isRecommended && (
                                                    <span className="text-[10px] text-primary font-bold">★ Rec</span>
                                                )}
                                            </span>
                                            <span className={cn(
                                                "text-[10px] font-mono px-1 rounded ml-2",
                                                info.overallViability === 'High' ? "text-green-700 bg-green-100 dark:bg-green-950 dark:text-green-300" :
                                                info.overallViability === 'Medium' ? "text-yellow-700 bg-yellow-100 dark:bg-yellow-950 dark:text-yellow-300" :
                                                isNA ? "text-muted-foreground bg-muted border border-border/40" :
                                                "text-red-700 bg-red-100 dark:bg-red-950 dark:text-red-300"
                                            )}>
                                                {isNA ? 'No Use / N/A' : info.overallViability}
                                            </span>
                                        </div>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                    {activeMethodInfo?.prepReasoning && (
                        <p className="text-[10px] text-muted-foreground leading-tight bg-background/60 p-1.5 rounded border border-border/40">
                            {activeMethodInfo.prepReasoning}
                        </p>
                    )}
                </div>
            </CardHeader>
            <CardContent className="flex flex-col flex-grow">
                <div className="space-y-4 flex-grow">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor={`seeds-on-hand-${planting.id}`}>{getInventoryLabel(activePropagationMethod)}</Label>
                            <div className="flex gap-2">
                                <Input
                                    id={`seeds-on-hand-${planting.id}`}
                                    type="number"
                                    placeholder="e.g., 50"
                                    value={seedsOnHand}
                                    onChange={(e) => setSeedsOnHand(e.target.value)}
                                    className="h-9"
                                />
                                <Button onClick={handleSetSeeds} disabled={!seedsOnHand} size="sm" className="h-9">Set</Button>
                            </div>
                            <p className="text-xs text-muted-foreground">Sets status to "Planting".</p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label htmlFor={`planned-qty-${planting.id}`}>Planned Qty</Label>
                                {isSavingPlannedQty && <CheckCircle className="h-4 w-4 text-green-500 animate-in fade-in" />}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    id={`planned-qty-${planting.id}`}
                                    type="number"
                                    placeholder="e.g., 20"
                                    value={plannedQty}
                                    onChange={(e) => setPlannedQty(e.target.value)}
                                    onBlur={handleSetPlannedQty}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSetPlannedQty()}
                                    className="h-9"
                                />
                                <Button onClick={handleSetPlannedQty} size="sm" className="h-9">Set</Button>
                            </div>
                            {planting.plannedQty !== undefined && planting.plannedQty > 0 ? (
                                <p className="text-xs text-muted-foreground">
                                    Seeds on hand: {planting.seedsOnHand || 0}. 
                                    <span className="font-bold"> Needs: {seedsRequired}</span>
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Seeds on hand: {planting.seedsOnHand || 0}.
                                </p>
                            )
                            }
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {latestStatus?.status === 'Harvest' 
                            ? <Button variant="secondary" className="w-full" onClick={() => onQuickStatusChange(planting, 'Wishlist')}>Move to Wishlist</Button>
                            : <Button variant="secondary" className="w-full" onClick={() => onQuickStatusChange(planting, 'Planting')}>Mark as Planting</Button>
                        }
                        <Button variant="secondary" className="w-full" onClick={() => onQuickStatusChange(planting, 'Growing')}>Mark as Growing</Button>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-2 pt-2">
                        <div>
                            <p className="font-semibold text-foreground/80">Germination</p>
                            <p>{planting.plant.germinationNeeds}</p>
                        </div>
                        <div>
                            <p className="font-semibold text-foreground/80">Conditions</p>
                            <p>{planting.plant.optimalConditions}</p>
                        </div>
                    </div>
                </div>
            </CardContent>
            <MoveOrDuplicatePlantDialog
                isOpen={isTransferDialogOpen}
                onOpenChange={setIsTransferDialogOpen}
                planting={planting}
                initialMode={transferDialogMode}
                onSwitchGarden={onSwitchGarden}
            />
        </Card>
    );
}
