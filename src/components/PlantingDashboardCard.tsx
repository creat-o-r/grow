
'use client';
import { useState, useEffect } from 'react';
import type { PlantingWithPlant } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { ExternalLink, CheckCircle } from 'lucide-react';
import { ToastAction } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function PlantingDashboardCard({ planting }: { planting: PlantingWithPlant }) {
    const [seedsOnHand, setSeedsOnHand] = useState<number | string>('');
    const [plannedQty, setPlannedQty] = useState<number | string>(planting.plannedQty || '');
    const [isSavingPlannedQty, setIsSavingPlannedQty] = useState(false);

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


    const updatePlantingStatus = async (status: 'Planting' | 'Growing', seeds?: number) => {
        // Capture current state before changing it
        setPreviousPlantingState({
            history: planting.history,
            seedsOnHand: planting.seedsOnHand,
            plannedQty: planting.plannedQty,
        });

        const newHistoryEntry = {
            id: `hist-${Date.now()}`,
            status,
            date: new Date().toISOString(),
            notes: `Status changed from Planting Dashboard.`,
        };
        try {
            const updatePayload: Partial<PlantingWithPlant> = {
                history: [...(planting.history || []), newHistoryEntry],
            };
            if (seeds !== undefined) {
                updatePayload.seedsOnHand = seeds;
            }

            await db.plantings.update(planting.id, updatePayload);
            
            toast({
                title: 'Planting Updated',
                description: `${planting.name} has been marked as ${status}.`,
                action: <ToastAction altText="Undo" onClick={handleUndo}>Undo</ToastAction>,
            });
            
            setSeedsOnHand('');

        } catch (error) {
            toast({
                title: 'Error',
                description: `Could not update ${planting.name}.`,
                variant: 'destructive',
            });
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

    const seedsRequired = Math.max(0, (planting.plannedQty || 0) - (planting.seedsOnHand || 0));

    return (
        <Card className="flex flex-col bg-muted/50">
            <CardHeader>
                <CardTitle className="font-headline text-lg leading-tight mb-1 pr-2">{planting.name}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                    <span>{planting.plant.species}</span>
                    <a href={`https://www.google.com/search?q=${encodeURIComponent(planting.plant.species)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink className="h-3 w-3" />
                        <span className="sr-only">Search for {planting.plant.species}</span>
                    </a>
                </CardDescription>
                {latestStatus && (
                    <div className="pt-2">
                        <Badge variant="outline" className={cn("font-normal w-fit", statusConfig[latestStatus.status])}>
                            {latestStatus.status}
                        </Badge>
                    </div>
                )}
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor={`seeds-on-hand-${planting.id}`}>Seeds on Hand</Label>
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
                    <Button variant="secondary" className="w-full" onClick={() => updatePlantingStatus('Planting')}>Mark as Planting</Button>
                    <Button variant="secondary" className="w-full" onClick={() => updatePlantingStatus('Growing')}>Mark as Growing</Button>
                </div>
            </CardContent>
        </Card>
    );
}
