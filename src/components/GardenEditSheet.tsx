
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GardenEditor } from '@/components/GardenEditor';
import type { GardenLocation, Conditions } from '@/lib/types';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

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
  handleLocationFieldChange,
  ...rest
}: GardenEditSheetProps) {
  const isSingleView = locations.length === 1;
  const singleLocation = isSingleView ? locations[0] : null;

  const [isScrolled, setIsScrolled] = useState(false);
  const [editingName, setEditingName] = useState(singleLocation?.name || '');
  const debouncedName = useDebounce(editingName, 500);

  useEffect(() => {
    if (isOpen && singleLocation) {
      setEditingName(singleLocation.name);
    }
  }, [isOpen, singleLocation]);
  
  useEffect(() => {
    if (isSingleView && singleLocation && debouncedName !== singleLocation.name) {
       const mockEvent = {
        currentTarget: {
          id: `name-${singleLocation.id}`,
          name: 'name',
          value: debouncedName,
        },
        type: 'blur'
      } as React.FocusEvent<HTMLInputElement>;
      handleLocationFieldChange(mockEvent);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedName, isSingleView, singleLocation]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    setIsScrolled(scrollTop > 0);
  };

  let title: React.ReactNode = "Edit Gardens";
  if (isSingleView) {
      if (isScrolled) {
        title = <SheetTitle className="font-headline truncate">{singleLocation?.name}</SheetTitle>;
      } else {
        title = (
           <Input
                id={`name-${singleLocation?.id}`}
                name="name"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="text-lg font-semibold leading-none tracking-tight h-auto p-0 border-0 shadow-none focus-visible:ring-0 font-headline"
            />
        );
      }
  } else if (locations.length > 1) {
    title = <SheetTitle className="font-headline">{`Edit ${locations.length} Gardens`}</SheetTitle>;
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className={cn("p-6 pb-4 border-b", isScrolled && "shadow-sm")}>
            {title}
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full w-full" onScroll={handleScroll}>
                <div className="space-y-8 p-6">
                {locations.map((loc) => (
                    <div key={loc.id}>
                        <GardenEditor 
                            loc={loc} 
                            showNameAsHeader={!isSingleView}
                            handleLocationFieldChange={handleLocationFieldChange}
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
