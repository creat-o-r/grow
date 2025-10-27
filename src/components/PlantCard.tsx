
'use client';

import type { PlantingWithPlant, Conditions, StatusHistory } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, ExternalLink, Copy, Package, Sparkles, ArrowRight } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { ViabilityIndicator } from './ViabilityIndicator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { getSuitableSeasons } from '@/lib/viability';
import { Viability } from '@/lib/viability';

type PlantCardProps = {
  planting: PlantingWithPlant;
  viability?: Viability;
  onEdit: () => void;
  onDelete: () => void;
  onMarkAsDuplicate: () => void;
  onQuickStatusChange: (newStatus: StatusHistory['status']) => void;
  isDuplicateSource: boolean;
  isSelectionMode: boolean;
  onSelectDuplicate: () => void;
  onGetViability: () => void;
};

export function PlantCard({
    planting, 
    viability, 
    onEdit, 
    onDelete, 
    onMarkAsDuplicate,
    onQuickStatusChange,
    isDuplicateSource,
    isSelectionMode,
    onSelectDuplicate,
    onGetViability,
}: PlantCardProps) {
    const { plant } = planting;
    const latestStatus = planting.history && planting.history.length > 0 ? planting.history[planting.history.length - 1] : null;
    const suitableSeasons = getSuitableSeasons(plant);


    const statusConfig: { [key: string]: string } = {
        Wishlist: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
        Planting: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
        Growing: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
        Harvest: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800',
    };
    
    const cardContent = (
        <>
            <CardHeader>
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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                {latestStatus?.status === 'Wishlist' && <DropdownMenuItem onClick={() => onQuickStatusChange('Planting')}><ArrowRight className="mr-2 h-4 w-4" />Mark as Planting</DropdownMenuItem>}
                                {latestStatus?.status === 'Planting' && <DropdownMenuItem onClick={() => onQuickStatusChange('Growing')}><ArrowRight className="mr-2 h-4 w-4" />Mark as Growing</DropdownMenuItem>}
                                {latestStatus?.status === 'Growing' && <DropdownMenuItem onClick={() => onQuickStatusChange('Harvest')}><ArrowRight className="mr-2 h-4 w-4" />Mark for Harvest</DropdownMenuItem>}
                                {(latestStatus?.status && latestStatus.status !== 'Harvest') && <DropdownMenuSeparator />}
                                <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={onGetViability}>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Viability Analysis
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
                        </DropdownMenu>
                    </div>
                </div>
                 <div className="flex flex-wrap gap-2 items-center pt-2">
                    {viability && <ViabilityIndicator viability={viability} />}
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
            <CardFooter>
            </CardFooter>
        </>
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
             </div>
        );
    }
    
    return (
        <Card className="flex flex-col transition-all hover:shadow-lg hover:-translate-y-1">
            {cardContent}
        </Card>
    );
}
