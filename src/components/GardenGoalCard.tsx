
'use client';

import type { GardenGoal } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Sparkles } from 'lucide-react';

type GardenGoalCardProps = {
  goal: GardenGoal;
  onEdit: () => void;
  onDelete: () => void;
  onSuggestPlants: () => void;
};

export function GardenGoalCard({ goal, onEdit, onDelete, onSuggestPlants }: GardenGoalCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{goal.name}</CardTitle>
            <CardDescription>{goal.description}</CardDescription>
          </div>
          <Badge>{goal.status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" size="icon" onClick={onSuggestPlants}>
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
