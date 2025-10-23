
'use client';

import { useState } from 'react';
import type { GardenLocation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ChevronsUpDown, Plus } from 'lucide-react';

type LocationSwitcherProps = {
  locations: GardenLocation[];
  activeLocationId: string | null;
  onLocationChange: (id: string) => void;
  onAddLocation: (name: string) => void;
};

export function LocationSwitcher({
  locations,
  activeLocationId,
  onLocationChange,
  onAddLocation,
}: LocationSwitcherProps) {
  const [newLocationName, setNewLocationName] = useState('');

  const handleAddLocation = () => {
    if (newLocationName.trim()) {
      onAddLocation(newLocationName.trim());
      setNewLocationName('');
    }
  };

  const activeLocation = locations.find(loc => loc.id === activeLocationId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="px-2 py-1 h-auto font-semibold text-base -ml-2">
          {activeLocation ? activeLocation.name : 'Select Location'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuRadioGroup value={activeLocationId ?? ''} onValueChange={onLocationChange}>
          {locations.map(location => (
            <DropdownMenuRadioItem key={location.id} value={location.id}>
              <div className="flex flex-col">
                <span>{location.name}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {location.conditions.temperature}, {location.conditions.sunlight}
                </span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <div className="p-2 space-y-2">
            <p className="text-xs font-medium text-muted-foreground px-2">Add New Garden</p>
            <div className="flex items-center space-x-2 px-2">
                <Input
                    placeholder="New garden name..."
                    value={newLocationName}
                    onChange={e => setNewLocationName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddLocation()}
                    className="h-8"
                />
                <Button size="icon" className="h-8 w-8" onClick={handleAddLocation}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

    