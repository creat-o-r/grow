
'use client';
import { useState, useEffect } from 'react';
import type { Plant } from '@/lib/types';
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

export function PlantingDashboardCard({ plant }: { plant: Plant }) {
    const [seedsOnHand, setSeedsOnHand] = useState<number | string>('');
    const [plannedQty, setPlannedQty] = useState<number | string>(plant.plannedQty || '');
    const [isSavingPlannedQty, setIsSavingPlannedQty] = useState(false);

    const { toast } = useToast();
    
    // Store initial state for undo
    const [previousPlantState, setPreviousPlantState] = useState<Partial<Plant> | null>(null);
    useEffect(() => {
        setPreviousPlantState({
            history: plant.history,
            seedsOnHand: plant.seedsOnHand,
            plannedQty: plant.plannedQty,
        });
    }, [plant.history, plant.seedsOnHand, plant.plannedQty]);

    
    const latestStatus = plant.history && plant.history.length > 0 ? plant.history[plant.history.length - 1] : null;
    const statusConfig: { [key: string]: string } = {
        Wishlist: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
        Planting: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
        Growing: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
        Harvest: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800',
    };

    const handleUndo = async () => {
        if (!previousPlantState) return;
        try {
            await db.plants.update(plant.id, {
                history: previousPlantState.history,
                seedsOnHand: previousPlantState.seedsOnHand,
                plannedQty: previousPlantState.plannedQty,
            });
            toast({
                title: 'Undo Successful',
                description: `${plant.species} has been reverted.`,
            });
        } catch (error) {
            toast({
                title: 'Undo Failed',
                description: 'Could not revert the plant status.',
                variant: 'destructive',
            });
        }
    };


    const updatePlantStatus = async (status: 'Planting' | 'Growing', seeds?: number) => {
        // Capture current state before changing it
        setPreviousPlantState({
            history: plant.history,
            seedsOnHand: plant.seedsOnHand,
            plannedQty: plant.plannedQty,
        });

        const newHistoryEntry = {
            id: `hist-${Date.now()}`,
            status,
            date: new Date().toISOString(),
            notes: `Status changed from Planting Dashboard.`,
        };
        try {
            const updatePayload: Partial<Plant> = {
                history: [...(plant.history || []), newHistoryEntry],
            };
            if (seeds !== undefined) {
                updatePayload.seedsOnHand = seeds;
            }

            await db.plants.update(plant.id, updatePayload);
            
            toast({
                title: 'Plant Updated',
                description: `${plant.species} has been marked as ${status}.`,
                action: <ToastAction altText="Undo" onClick={handleUndo}>Undo</ToastAction>,
            });
            
            setSeedsOnHand('');

        } catch (error) {
            toast({
                title: 'Error',
                description: `Could not update ${plant.species}.`,
                variant: 'destructive',
            });
        }
    };

    const handleSetSeeds = () => {
        const qty = Number(seedsOnHand);
        if (qty > 0) {
            updatePlantStatus('Planting', qty);
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
        if (plannedQty !== '' && !isNaN(qty) && qty >= 0 && qty !== plant.plannedQty) {
            setIsSavingPlannedQty(true);
            await db.plants.update(plant.id, { plannedQty: qty });
            setTimeout(() => setIsSavingPlannedQty(false), 1000); // Show checkmark briefly
        } else if (plannedQty === '' && plant.plannedQty !== undefined) {
            await db.plants.update(plant.id, { plannedQty: undefined });
        } else {
             toast({
                title: 'Invalid Quantity',
                description: 'Please enter a valid number for planned quantity.',
                variant: 'destructive',
            });
        }
    };

    const seedsRequired = Math.max(0, (plant.plannedQty || 0) - (plant.seedsOnHand || 0));

    return (
        <Card className="flex flex-col bg-muted/50">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="font-headline text-lg leading-tight mb-1 pr-2">{plant.species}</CardTitle>
                    <a href={`https://www.google.com/search?q=${encodeURIComponent(plant.species)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center -mt-1 -mr-2" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only">Search for {plant.species}</span>
                        </Button>
                    </a>
                </div>
                {latestStatus && (
                    <Badge variant="outline" className={cn("font-normal w-fit", statusConfig[latestStatus.status])}>
                        {latestStatus.status}
                    </Badge>
                )}
                <CardDescription className="text-xs text-muted-foreground line-clamp-2 pt-1">
                    {plant.optimalConditions}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor={`seeds-on-hand-${plant.id}`}>Seeds on Hand</Label>
                    <div className="flex gap-2">
                        <Input
                            id={`seeds-on-hand-${plant.id}`}
                            type="number"
                            placeholder="e.g., 50"
                            value={seedsOnHand}
                            onChange={(e) => setSeedsOnHand(e.target.value)}
                        />
                        <Button onClick={handleSetSeeds} disabled={!seedsOnHand}>Set</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Entering a quantity will mark this plant as "Planting".</p>
                </div>
                 <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label htmlFor={`planned-qty-${plant.id}`}>Planned Planting Qty</Label>
                        {isSavingPlannedQty && <CheckCircle className="h-4 w-4 text-green-500 animate-in fade-in" />}
                    </div>
                    <div className="flex gap-2">
                        <Input
                            id={`planned-qty-${plant.id}`}
                            type="number"
                            placeholder="e.g., 20"
                            value={plannedQty}
                            onChange={(e) => setPlannedQty(e.target.value)}
                        />
                        <Button onClick={handleSetPlannedQty} disabled={plannedQty === ''}>Set</Button>
                    </div>
                     {plant.plannedQty !== undefined && plant.plannedQty > 0 ? (
                        <p className="text-xs text-muted-foreground">
                            Currently planned: {plant.plannedQty}. Seeds on hand: {plant.seedsOnHand || 0}. 
                            <span className="font-bold"> Seeds required: {seedsRequired}</span>
                        </p>
                     ) : (
                        <p className="text-xs text-muted-foreground">
                             Seeds on hand: {plant.seedsOnHand || 0}.
                        </p>
                     )
                    }
                </div>
                 <div className="flex gap-2">
                    <Button variant="secondary" className="w-full" onClick={() => updatePlantStatus('Planting')}>Mark as Planting</Button>
                    <Button variant="secondary" className="w-full" onClick={() => updatePlantStatus('Growing')}>Mark as Growing</Button>
                </div>
            </CardContent>
        </Card>
    );
}
