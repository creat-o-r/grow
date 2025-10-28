
'use client';

import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GardenEditor } from '@/components/GardenEditor';
import type { GardenLocation, Conditions } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Edit, Check, X } from 'lucide-react';
import { db } from '@/lib/db';


type GardenEditSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  locations: GardenLocation[];
  handleLocationFieldChange: (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => void;
  handleConditionChange: (value: string, field: keyof Conditions, locationId: string) => void;
  handleGetCurrentLocation: (locationId: string) => void;
  isLocating: boolean;
  handleAnalyzeConditions: (locationId: string) => Promise<void>;
  isAnalyzing: string | null;
};

export function GardenEditSheet({
  isOpen,
  onOpenChange,
  locations,
  ...rest
}: GardenEditSheetProps) {

  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  
  const getTitle = () => {
    if (locations.length > 1) {
        if (locations.every(l => selectedGardenIds.includes(l.id))) {
            return 'Edit All Gardens';
        }
        return `Edit ${locations.length} Selected Gardens`;
    }
    return locations[0]?.name ? `Edit ${locations[0].name}`: `Edit Garden`;
  }
  
  const selectedGardenIds = locations.map(l => l.id);


  const handleEditClick = (loc: GardenLocation) => {
    setEditingLocationId(loc.id);
    setEditingName(loc.name);
  };

  const handleCancelEdit = () => {
    setEditingLocationId(null);
    setEditingName('');
  };

  const handleSaveEdit = async () => {
    if (editingLocationId && editingName.trim()) {
      await db.locations.update(editingLocationId, { name: editingName.trim() });
      handleCancelEdit();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  }
  
  useEffect(() => {
    if (!isOpen) {
        handleCancelEdit();
    }
  }, [isOpen]);
  
  const sheetTitle = locations.length > 1 ? `Edit ${locations.length} Gardens` : 'Edit Garden';

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className={cn("p-6 pb-4 border-b")}>
            <SheetTitle className="font-headline">{sheetTitle}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full w-full">
                <div className="divide-y divide-border">
                {locations.map((loc) => (
                    <div key={loc.id} className="p-6 space-y-6">
                        <div className="sticky top-0 bg-background z-10 -mx-6 px-6 -mt-6 pt-6 pb-4 border-b">
                            <div className="flex items-center gap-2">
                                {editingLocationId === loc.id ? (
                                    <div className="flex items-center gap-2 w-full">
                                        <Input
                                            autoFocus
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onKeyDown={handleEditKeyDown}
                                            className="text-xl font-headline h-auto p-0 border-0 shadow-none focus-visible:ring-0"
                                        />
                                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleSaveEdit}><Check className="h-5 w-5 text-green-600"/></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleCancelEdit}><X className="h-5 w-5 text-destructive"/></Button>
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-xl font-headline flex-1 truncate">{loc.name}</h2>
                                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(loc)}>
                                            <Edit className="h-5 w-5 text-muted-foreground" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        <GardenEditor 
                            loc={loc}
                            {...rest} 
                        />
                    </div>
                ))}
                </div>
            </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
