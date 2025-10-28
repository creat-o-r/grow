
'use client';

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
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
  const title = locations.length > 1 ? 'Edit Gardens' : locations[0]?.name || 'Edit Garden';

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-headline">{title}</SheetTitle>
          <SheetDescription>
            Modify the details for your garden location(s) below.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full w-full pr-4">
                <div className="space-y-6 pb-6">
                {locations.map(loc => (
                    <div key={loc.id} className="p-4 border rounded-lg bg-muted/20">
                        <GardenEditor loc={loc} {...rest} />
                    </div>
                ))}
                </div>
            </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
