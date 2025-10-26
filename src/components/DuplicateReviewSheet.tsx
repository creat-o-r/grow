
'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Plant } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type DuplicateGroup = {
  species: string;
  plants: Plant[];
};

export function DuplicateReviewSheet({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void; }) {
  const allPlants = useLiveQuery(() => db.plants.toArray(), []);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [plantsToDelete, setPlantsToDelete] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!allPlants || !isOpen) {
      setDuplicateGroups([]);
      setPlantsToDelete(new Set());
      return;
    }

    const plantsBySpecies = new Map<string, Plant[]>();

    allPlants.forEach(plant => {
      const speciesKey = plant.species.toLowerCase().trim();
      if (!plantsBySpecies.has(speciesKey)) {
        plantsBySpecies.set(speciesKey, []);
      }
      plantsBySpecies.get(speciesKey)!.push(plant);
    });

    const foundDuplicates: DuplicateGroup[] = [];
    const initialDeletions = new Set<string>();

    plantsBySpecies.forEach((plants, species) => {
      if (plants.length > 1) {
        // Sort by the most recent history entry date, newest first
        plants.sort((a, b) => {
          const dateA = a.history?.length ? new Date(a.history[a.history.length - 1].date).getTime() : 0;
          const dateB = b.history?.length ? new Date(b.history[b.history.length - 1].date).getTime() : 0;
          return dateB - dateA;
        });

        foundDuplicates.push({ species, plants });
        
        // Pre-select all but the first (most recent) for deletion
        const toDelete = plants.slice(1);
        toDelete.forEach(p => initialDeletions.add(p.id));
      }
    });

    setDuplicateGroups(foundDuplicates);
    setPlantsToDelete(initialDeletions);
  }, [allPlants, isOpen]);

  const handleToggleDelete = (plantId: string) => {
    setPlantsToDelete(prev => {
      const newSet = new Set(prev);
      if (newSet.has(plantId)) {
        newSet.delete(plantId);
      } else {
        newSet.add(plantId);
      }
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (plantsToDelete.size === 0) {
        toast({ title: "Nothing to delete", description: "No plants were selected for deletion." });
        return;
    }
    
    setIsDeleting(true);
    try {
        const idsToDelete = Array.from(plantsToDelete);
        await db.plants.bulkDelete(idsToDelete);
        toast({
            title: "Duplicates Removed",
            description: `${idsToDelete.length} plant(s) have been deleted.`,
        });
        onOpenChange(false);
    } catch (error) {
        console.error("Failed to delete duplicates:", error);
        toast({
            title: "Error",
            description: "Could not remove the selected plants. Please check the console.",
            variant: "destructive",
        });
    } finally {
        setIsDeleting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-full h-full flex flex-col p-0">
        <div className="flex items-center justify-between p-6 border-b">
          <SheetHeader className="text-left">
            <SheetTitle className="font-headline">Review & Merge Duplicates</SheetTitle>
            <SheetDescription>
              Review potential duplicates and select which entries to remove. The most recently updated plant is suggested to be kept.
            </SheetDescription>
          </SheetHeader>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <span className="sr-only">Close</span>
              <Trash2 className="h-4 w-4" />
            </Button>
          </SheetClose>
        </div>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="p-6 space-y-6">
                {duplicateGroups.length > 0 ? (
                    duplicateGroups.map(group => (
                        <Card key={group.species}>
                            <CardHeader>
                                <CardTitle>{group.plants[0].species}</CardTitle>
                                <CardDescription>Found {group.plants.length} potential duplicates.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {group.plants.map((plant, index) => {
                                    const isChecked = plantsToDelete.has(plant.id);
                                    const latestUpdate = plant.history?.length ? format(parseISO(plant.history[plant.history.length-1].date), "PP") : 'N/A';
                                    return (
                                        <div key={plant.id} className="flex items-start gap-4 rounded-md border p-4 data-[state=checked]:border-destructive" data-state={isChecked ? 'checked' : 'unchecked'}>
                                             <Checkbox
                                                id={`del-${plant.id}`}
                                                checked={isChecked}
                                                onCheckedChange={() => handleToggleDelete(plant.id)}
                                                className="mt-1"
                                            />
                                            <label htmlFor={`del-${plant.id}`} className="flex-1 space-y-2 cursor-pointer">
                                                <div className="flex justify-between items-center">
                                                    <span className={`font-semibold ${index === 0 ? 'text-primary' : ''}`}>
                                                        {plant.species} {index === 0 && <span className="text-xs font-normal text-muted-foreground">(Keep)</span>}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">Last Updated: {latestUpdate}</span>
                                                </div>
                                                <div className="text-sm text-muted-foreground space-y-1">
                                                    <p><b>Germination:</b> {plant.germinationNeeds}</p>
                                                    <p><b>Conditions:</b> {plant.optimalConditions}</p>
                                                </div>
                                            </label>
                                        </div>
                                    )
                                })}
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 gap-4 text-center">
                        <CardTitle className="font-headline">No Duplicates Found</CardTitle>
                        <CardDescription>Your plant collection is clean and tidy!</CardDescription>
                    </div>
                )}
            </div>
          </ScrollArea>
        </div>

        <SheetFooter className="p-6 border-t bg-background">
          <div className="flex justify-between w-full items-center">
            <p className="text-sm text-muted-foreground">{plantsToDelete.size} plant(s) selected for deletion.</p>
            <div className="flex gap-2">
                <SheetClose asChild>
                    <Button variant="outline">Cancel</Button>
                </SheetClose>
                <Button 
                    variant="destructive"
                    onClick={handleDeleteSelected}
                    disabled={isDeleting || plantsToDelete.size === 0}
                >
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                    Delete Selected
                </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
