
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GardenEditor } from '@/components/GardenEditor';
import type { GardenLocation, Conditions } from '@/lib/types';
import { cn } from '@/lib/utils';


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
  
  const getTitle = () => {
    if (locations.length > 1) {
      return `Edit ${locations.length} Gardens`;
    }
    if (locations.length === 1) {
      return `Edit Garden`;
    }
    return 'Edit Garden';
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className={cn("p-6 pb-4 border-b")}>
            <SheetTitle className="font-headline">{getTitle()}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full w-full">
                <div className="space-y-8 p-6">
                {locations.map((loc) => (
                    <div key={loc.id}>
                        <GardenEditor 
                            loc={loc} 
                            showNameAsHeader={locations.length > 1}
                            {...rest} 
                        />
                         {locations.length > 1 && <hr className="mt-8"/>}
                    </div>
                ))}
                </div>
            </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
