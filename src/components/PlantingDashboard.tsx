
'use client';

import { useMemo } from 'react';
import type { PlantingWithPlant, Conditions } from '@/lib/types';
import { analyzeViability, Viability } from '@/lib/viability';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Upload } from 'lucide-react';
import { PlantingDashboardCard } from './PlantingDashboardCard';


type PlantingDashboardProps = {
    plantings: PlantingWithPlant[];
    gardenConditions: Conditions;
    onOpenAddSheet: () => void;
    onOpenSettings: () => void;
};

export function PlantingDashboard({ plantings, gardenConditions, onOpenAddSheet, onOpenSettings }: PlantingDashboardProps) {

    const viabilityGroups = useMemo(() => {
        const groups: Record<Viability, PlantingWithPlant[]> = {
            High: [],
            Medium: [],
            Low: [],
        };
        
        if (!plantings || !gardenConditions) return groups;

        plantings.forEach(p => {
            const viability = analyzeViability(p.plant, gardenConditions);
            groups[viability].push(p);
        });

        return groups;
    }, [plantings, gardenConditions]);
    
    const hasAnyPlants = plantings.length > 0;

    return (
        <div className="space-y-8">
            <div>
                <CardHeader className="px-0 pb-4">
                    <CardTitle className="font-headline">Planting Possibilities</CardTitle>
                    <CardDescription>
                        Here are plantings from your Wishlist and Harvests, prioritised by their viability now.
                    </CardDescription>
                </CardHeader>
                
                {hasAnyPlants ? (
                    <div className="space-y-6">
                        {viabilityGroups.High.length > 0 && (
                            <section>
                                <h3 className="text-lg font-semibold mb-4 text-green-400">High Viability</h3>
                                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    {viabilityGroups.High.map(p => <PlantingDashboardCard key={p.id} planting={p} />)}
                                </div>
                            </section>
                        )}
                        {viabilityGroups.Medium.length > 0 && (
                             <section>
                                <h3 className="text-lg font-semibold mb-4 text-yellow-400">Medium Viability</h3>
                                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    {viabilityGroups.Medium.map(p => <PlantingDashboardCard key={p.id} planting={p} />)}
                                </div>
                            </section>
                        )}
                         {viabilityGroups.Low.length > 0 && (
                             <section>
                                <h3 className="text-lg font-semibold mb-4 text-red-400">Low Viability</h3>
                                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    {viabilityGroups.Low.map(p => <PlantingDashboardCard key={p.id} planting={p} />)}
                                </div>
                            </section>
                        )}
                    </div>
                ) : (
                    <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed mt-6">
                         <CardHeader>
                            <CardTitle className="font-headline">Add more plants to plan</CardTitle>
                        </CardHeader>
                        <CardContent className="flex gap-4">
                            <Button onClick={onOpenAddSheet}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Plant
                            </Button>
                            <Button onClick={onOpenSettings} variant="secondary">
                                <Upload className="mr-2 h-4 w-4" />
                                Import Datasets
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
