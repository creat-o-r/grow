

'use client';

import { useMemo } from 'react';
import type { PlantingWithPlant, Conditions, StatusHistory } from '@/lib/types';
import type { Viability } from '@/lib/viability';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Upload } from 'lucide-react';
import { PlantingDashboardCard } from './PlantingDashboardCard';
import { Badge } from '@/components/ui/badge';


type PlantingDashboardProps = {
    plantings: PlantingWithPlant[];
    viabilityData?: Record<string, Viability | undefined>;
    reasoningData?: Record<string, string | undefined>;
    gardenConditions?: Conditions;
    onOpenAddSheet: () => void;
    onOpenSettings: () => void;
    onQuickStatusChange: (planting: PlantingWithPlant, newStatus: StatusHistory['status']) => void;
};

export function PlantingDashboard({ plantings, viabilityData, reasoningData, onOpenAddSheet, onOpenSettings, onQuickStatusChange }: PlantingDashboardProps) {

    const viabilityGroups = useMemo(() => {
        const groups: Record<Viability | 'Unanalyzed', PlantingWithPlant[]> = {
            High: [],
            Medium: [],
            Low: [],
            Unanalyzed: [],
        };
        
        if (!plantings) return groups;

        plantings.forEach(p => {
            const viability = viabilityData?.[p.id];
            if (viability && groups[viability]) {
                groups[viability].push(p);
            } else {
                groups.Unanalyzed.push(p);
            }
        });

        return groups;
    }, [plantings, viabilityData]);
    
    const hasAnyPlants = plantings.length > 0;

    return (
        <div className="space-y-8">
            <div>
                <CardHeader className="px-0 pb-4">
                    <div className="flex justify-between items-center">
                        <CardTitle className="font-headline flex items-center gap-2">
                            <span>Planting Possibilities</span>
                            {hasAnyPlants && <span className="text-lg font-normal text-muted-foreground">({plantings.length})</span>}
                        </CardTitle>
                        {hasAnyPlants && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {viabilityGroups.High.length > 0 && (
                                    <Badge className="bg-green-600 dark:bg-green-500 text-white px-1.5 py-0.5 text-xs font-mono">{viabilityGroups.High.length} High</Badge>
                                )}
                                {viabilityGroups.Medium.length > 0 && (
                                    <Badge className="bg-yellow-500 dark:bg-yellow-400 text-white dark:text-black px-1.5 py-0.5 text-xs font-mono">{viabilityGroups.Medium.length} Med</Badge>
                                )}
                                {viabilityGroups.Low.length > 0 && (
                                    <Badge className="bg-red-600 dark:bg-red-500 text-white px-1.5 py-0.5 text-xs font-mono">{viabilityGroups.Low.length} Low</Badge>
                                )}
                                {viabilityGroups.Unanalyzed.length > 0 && (
                                    <Badge variant="outline" className="text-muted-foreground px-1.5 py-0.5 text-xs font-mono">{viabilityGroups.Unanalyzed.length} Pending</Badge>
                                )}
                            </div>
                        )}
                    </div>
                    <CardDescription>
                        Wishlist and harvested plants grouped by AI viability analysis.
                    </CardDescription>
                </CardHeader>
                
                {hasAnyPlants ? (
                    <div className="space-y-6">
                        {viabilityGroups.High.length > 0 && (
                            <section>
                                <h3 className="text-lg font-semibold mb-4 text-green-500">High Viability ({viabilityGroups.High.length})</h3>
                                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    {viabilityGroups.High.map(p => (
                                        <PlantingDashboardCard 
                                            key={p.id} 
                                            planting={p} 
                                            viability={viabilityData?.[p.id] || p.viability}
                                            viabilityReasoning={reasoningData?.[p.id] || p.viabilityReasoning}
                                            onQuickStatusChange={onQuickStatusChange} 
                                        />
                                    ))}
                                </div>
                            </section>
                        )}
                        {viabilityGroups.Medium.length > 0 && (
                             <section>
                                <h3 className="text-lg font-semibold mb-4 text-yellow-500">Medium Viability ({viabilityGroups.Medium.length})</h3>
                                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    {viabilityGroups.Medium.map(p => (
                                        <PlantingDashboardCard 
                                            key={p.id} 
                                            planting={p} 
                                            viability={viabilityData?.[p.id] || p.viability}
                                            viabilityReasoning={reasoningData?.[p.id] || p.viabilityReasoning}
                                            onQuickStatusChange={onQuickStatusChange} 
                                        />
                                    ))}
                                </div>
                            </section>
                        )}
                         {viabilityGroups.Low.length > 0 && (
                             <section>
                                <h3 className="text-lg font-semibold mb-4 text-red-500">Low Viability ({viabilityGroups.Low.length})</h3>
                                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    {viabilityGroups.Low.map(p => (
                                        <PlantingDashboardCard 
                                            key={p.id} 
                                            planting={p} 
                                            viability={viabilityData?.[p.id] || p.viability}
                                            viabilityReasoning={reasoningData?.[p.id] || p.viabilityReasoning}
                                            onQuickStatusChange={onQuickStatusChange} 
                                        />
                                    ))}
                                </div>
                            </section>
                        )}
                        {viabilityGroups.Unanalyzed.length > 0 && (
                            <section>
                                <h3 className="text-lg font-semibold mb-2 text-muted-foreground">Pending AI Analysis ({viabilityGroups.Unanalyzed.length})</h3>
                                <p className="text-xs text-muted-foreground mb-4">Run AI viability analysis to see recommendations for these plants.</p>
                                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    {viabilityGroups.Unanalyzed.map(p => (
                                        <PlantingDashboardCard 
                                            key={p.id} 
                                            planting={p} 
                                            viability={viabilityData?.[p.id] || p.viability}
                                            viabilityReasoning={reasoningData?.[p.id] || p.viabilityReasoning}
                                            onQuickStatusChange={onQuickStatusChange} 
                                        />
                                    ))}
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

    

    
