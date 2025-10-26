
'use client';
import { useState } from 'react';
import type { Plant } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { ExternalLink } from 'lucide-react';
import { ToastAction } from '@/components/ui/toast';

export function PlantingDashboardCard({ plant }: { plant: Plant }) {
    const [seedsOnHand, setSeedsOnHand] = useState<number | string>('');
    const [plannedQty, setPlannedQty] = useState('');
    const { toast } = useToast();
    
    const previousPlantState = {
        history: plant.history,
        seedsOnHand: plant.seedsOnHand,
    };

    const handleUndo = async () => {
        try {
            await db.plants.update(plant.id, {
                history: previousPlantState.history,
                seedsOnHand: previousPlantState.seedsOnHand,
            });
            toast({
                title: 'Undo Successful',
                description: `${plant.species} status has been reverted.`,
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
        const newHistoryEntry = {
            id: `hist-${Date.now()}`,
            status,
            date: new Date().toISOString(),
            notes: `Status changed from Planting Dashboard.`,
        };
        try {
            const updatePayload: Partial<Plant> = {
                history: [...plant.history, newHistoryEntry],
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
            setPlannedQty('');

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
                <CardDescription className="text-xs text-muted-foreground line-clamp-2">
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
                    <Label htmlFor={`planned-qty-${plant.id}`}>Planned Planting Qty (Seeds Required)</Label>
                    <Input
                        id={`planned-qty-${plant.id}`}
                        type="number"
                        placeholder="e.g., 20"
                        value={plannedQty}
                        onChange={(e) => setPlannedQty(e.target.value)}
                    />
                </div>
                 <div className="flex gap-2">
                    <Button variant="secondary" className="w-full" onClick={() => updatePlantStatus('Planting')}>Mark as Planting</Button>
                    <Button variant="secondary" className="w-full" onClick={() => updatePlantStatus('Growing')}>Mark as Growing</Button>
                </div>
            </CardContent>
        </Card>
    );
}
