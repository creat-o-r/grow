

'use client';

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GardenEditor } from '@/components/GardenEditor';
import type { GardenLocation, Conditions } from '@/lib/types';

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
  const count = locations.length;
  let title = "Edit Garden";
  if (count > 1) {
    title = `Edit ${count} Gardens`;
  } else if (count === 1) {
    title = locations[0].name;
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="font-headline">{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full w-full">
                <div className="space-y-8 p-6">
                {locations.map((loc) => (
                    <div key={loc.id}>
                        <GardenEditor 
                            loc={loc} 
                            showNameAsHeader={count > 1}
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
