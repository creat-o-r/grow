
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { db } from '@/lib/db';
import type { PlantingWithPlant } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Trash2, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type DuplicateGroup = {
  species: string;
  plantings: PlantingWithPlant[];
};

export function DuplicateReviewSheet({ isOpen, onOpenChange, plantings }: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void; plantings: PlantingWithPlant[] }) {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [plantingsToDelete, setPlantingsToDelete] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!plantings || !isOpen) {
      setDuplicateGroups([]);
      setPlantingsToDelete(new Set());
      return;
    }

    const plantingsByPlantId = new Map<string, PlantingWithPlant[]>();

    plantings.forEach(p => {
      const existing = plantingsByPlantId.get(p.plantId) || [];
      plantingsByPlantId.set(p.plantId, [...existing, p]);
    });

    const foundDuplicates: DuplicateGroup[] = [];
    const initialDeletions = new Set<string>();

    plantingsByPlantId.forEach((group) => {
      if (group.length > 1) {
        // Sort by the most recent history entry date, newest first
        group.sort((a, b) => {
          const dateA = a.history?.length ? new Date(a.history[a.history.length - 1].date).getTime() : 0;
          const dateB = b.history?.length ? new Date(b.history[b.history.length - 1].date).getTime() : 0;
          return dateB - dateA;
        });
        
        const displaySpecies = group[0].plant.species;
        foundDuplicates.push({ species: displaySpecies, plantings: group });
        
        const toDelete = group.slice(1);
        toDelete.forEach(p => initialDeletions.add(p.id));
      }
    });

    setDuplicateGroups(foundDuplicates);
    setPlantingsToDelete(initialDeletions);
  }, [plantings, isOpen]);

  const plantingsToKeepCount = useMemo(() => {
    return duplicateGroups.reduce((count, group) => {
      const keptInGroup = group.plantings.filter(p => !plantingsToDelete.has(p.id)).length;
      return count + keptInGroup;
    }, 0);
  }, [duplicateGroups, plantingsToDelete]);


  const handleToggleDelete = (plantingId: string) => {
    setPlantingsToDelete(prev => {
      const newSet = new Set(prev);
      if (newSet.has(plantingId)) {
        newSet.delete(plantingId);
      } else {
        newSet.add(plantingId);
      }
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (plantingsToDelete.size === 0) {
        toast({ title: "Nothing to delete", description: "No plants were selected for deletion." });
        return;
    }
    
    setIsDeleting(true);
    try {
        const idsToDelete = Array.from(plantingsToDelete);
        await db.plantings.bulkDelete(idsToDelete);
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
      <SheetContent className="w-full sm:max-w-2xl h-full flex flex-col p-0">
        <div className="flex items-center justify-between p-6 border-b">
          <SheetHeader className="text-left">
            <SheetTitle className="font-headline">Review & Merge Duplicates</SheetTitle>
            <SheetDescription>
              Multiple entries were found for the same plant species. Select which ones to remove. The most recently updated is suggested to be kept.
            </SheetDescription>
          </SheetHeader>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <span className="sr-only">Close</span>
              <X className="h-4 w-4" />
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
                                <CardTitle>{group.species}</CardTitle>
                                <CardDescription>Found {group.plantings.length} potential duplicates.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {group.plantings.map((p, index) => {
                                    const isChecked = plantingsToDelete.has(p.id);
                                    const latestUpdate = p.history?.length ? format(parseISO(p.history[p.history.length-1].date), "PP") : 'N/A';
                                    return (
                                        <div key={p.id} className="flex items-start gap-4 rounded-md border p-4 data-[state=checked]:border-destructive" data-state={isChecked ? 'checked' : 'unchecked'}>
                                             <Checkbox
                                                id={`del-${p.id}`}
                                                checked={isChecked}
                                                onCheckedChange={() => handleToggleDelete(p.id)}
                                                className="mt-1"
                                            />
                                            <label htmlFor={`del-${p.id}`} className="flex-1 space-y-2 cursor-pointer">
                                                <div className="flex justify-between items-center">
                                                    <span className={`font-semibold ${index === 0 ? 'text-primary' : ''}`}>
                                                        {p.name} {index === 0 && <span className="text-xs font-normal text-muted-foreground">(Keep)</span>}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">Last Updated: {latestUpdate}</span>
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
                        <CardDescription>Your collection is clean and tidy!</CardDescription>
                    </div>
                )}
            </div>
          </ScrollArea>
        </div>

        <SheetFooter className="p-6 border-t bg-background">
          <div className="flex justify-between w-full items-center">
            <p className="text-sm text-muted-foreground">
                <span className="font-bold">{plantingsToDelete.size}</span> to be deleted
                <span className="mx-2">|</span> 
                <span className="font-bold">{plantingsToKeepCount}</span> to be kept
            </p>
            <div className="flex gap-2">
                <SheetClose asChild>
                    <Button variant="outline">Cancel</Button>
                </SheetClose>
                <Button 
                    variant="destructive"
                    onClick={handleDeleteSelected}
                    disabled={isDeleting || plantingsToDelete.size === 0}
                >
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                    Delete {plantingsToDelete.size} Plant(s)
                </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
