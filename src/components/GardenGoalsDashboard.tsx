
'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { GardenGoal, Plant } from '@/lib/types';
import { GardenGoalCard } from './GardenGoalCard';
import { GardenGoalForm } from './GardenGoalForm';
import { aiSuggestPlantsForGoal } from '@/ai/flows/ai-suggest-plants-for-goal';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

export function GardenGoalsDashboard() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState<GardenGoal | null>(null);
  const [suggestedPlants, setSuggestedPlants] = useState<{ commonName: string; species: string; reasoning: string; }[]>([]);
  const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);

  const goals = useLiveQuery(() => db.gardenGoals.toArray(), []);

  const handleSuggestPlants = async (goal: GardenGoal) => {
    const suggestions = await aiSuggestPlantsForGoal({ goal: { name: goal.name, description: goal.description } });
    setSuggestedPlants(suggestions.suggestedPlants);
    setIsSuggestionDialogOpen(true);
  };

  const handleAddGoal = async (goalData: Omit<GardenGoal, 'id'>) => {
    const newGoal: GardenGoal = {
      ...goalData,
      id: `goal-${Date.now()}`,
    };
    await db.gardenGoals.add(newGoal);
    setIsSheetOpen(false);
  };

  const handleUpdateGoal = async (updatedGoal: GardenGoal) => {
    await db.gardenGoals.put(updatedGoal);
    setGoalToEdit(null);
    setIsSheetOpen(false);
  };

  const handleDeleteGoal = async (goalId: string) => {
    await db.gardenGoals.delete(goalId);
  };

  const handleEditGoal = (goal: GardenGoal) => {
    setGoalToEdit(goal);
    setIsSheetOpen(true);
  };

  const handleOpenAddSheet = () => {
    setGoalToEdit(null);
    setIsSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      setGoalToEdit(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-headline">Garden Goals</h2>
        <Button onClick={handleOpenAddSheet}>
          <Plus className="mr-2 h-4 w-4" />
          Add Goal
        </Button>
      </div>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {goals?.map((goal) => (
          <GardenGoalCard
            key={goal.id}
            goal={goal}
            onEdit={() => handleEditGoal(goal)}
            onDelete={() => handleDeleteGoal(goal.id)}
            onSuggestPlants={() => handleSuggestPlants(goal)}
          />
        ))}
      </div>
      <Dialog open={isSuggestionDialogOpen} onOpenChange={setIsSuggestionDialogOpen}>
        <DialogContent className="sm:max-w-lg w-[90vw] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-headline">Plant Suggestions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {suggestedPlants.map((plant) => (
              <Card key={plant.species}>
                <CardHeader>
                  <CardTitle>{plant.commonName}</CardTitle>
                  <CardDescription>{plant.species}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>{plant.reasoning}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="sm:max-w-lg w-[90vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-headline">{goalToEdit ? 'Edit Goal' : 'Add a New Goal'}</SheetTitle>
          </SheetHeader>
          <GardenGoalForm
            goalToEdit={goalToEdit}
            onSubmit={goalToEdit ? handleUpdateGoal : handleAddGoal}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
