
'use client';

import type { Plant, Conditions } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ViabilityIndicator } from './ViabilityIndicator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

type PlantCardProps = {
  plant: Plant;
  gardenConditions?: Conditions;
  onEdit: () => void;
  onDelete: () => void;
};

export function PlantCard({ plant, gardenConditions, onEdit, onDelete }: PlantCardProps) {
    const latestStatus = plant.history.length > 0 ? plant.history[plant.history.length - 1] : null;

    const statusConfig: { [key: string]: string } = {
        Planning: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
        Planting: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
        Growing: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
        Harvested: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800',
        Dormant: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-800',
    };
    
    return (
        <Card className="flex flex-col transition-all hover:shadow-lg hover:-translate-y-1">
        <CardHeader>
            <div className="flex justify-between items-start">
                <CardTitle className="font-headline text-xl leading-tight mb-1 pr-2">{plant.species}</CardTitle>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 -mt-1 -mr-2">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
                {gardenConditions && <ViabilityIndicator plant={plant} gardenConditions={gardenConditions} />}
                {latestStatus && (
                    <Badge variant="outline" className={cn("font-normal", statusConfig[latestStatus.status])}>
                        {latestStatus.status}
                    </Badge>
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
        {latestStatus && (
            <CardFooter>
                <p className="text-xs text-muted-foreground">
                    Last update: {format(parseISO(latestStatus.date), 'MMM d, yyyy')}
                </p>
            </CardFooter>
        )}
        </Card>
    );
}
