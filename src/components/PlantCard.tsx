'use client';

import type { Plant, GardenConditions } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ViabilityIndicator } from './ViabilityIndicator';

type PlantCardProps = {
  plant: Plant;
  gardenConditions: GardenConditions;
  onEdit: () => void;
  onDelete: () => void;
};

export function PlantCard({ plant, gardenConditions, onEdit, onDelete }: PlantCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
            <CardTitle className="font-headline text-xl leading-tight mb-1">{plant.species}</CardTitle>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        <ViabilityIndicator plant={plant} gardenConditions={gardenConditions} />
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div>
          <h4 className="font-bold text-sm mb-1">Germination Needs</h4>
          <p className="text-sm text-muted-foreground">{plant.germinationNeeds}</p>
        </div>
        <div>
          <h4 className="font-bold text-sm mb-1">Optimal Conditions</h4>
          <p className="text-sm text-muted-foreground">{plant.optimalConditions}</p>
        </div>
      </CardContent>
    </Card>
  );
}
