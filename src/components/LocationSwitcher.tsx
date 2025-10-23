'use client';

import { useState } from 'react';
import { GardenLocation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ChevronsUpDown, PlusCircle } from 'lucide-react';

type LocationSwitcherProps = {
  locations: GardenLocation[];
  activeLocationId: string | null;
  setActiveLocationId: (id: string) => void;
  onAddLocation: (name: string) => void;
};

export function LocationSwitcher({
  locations,
  activeLocationId,
  setActiveLocationId,
  onAddLocation,
}: LocationSwitcherProps) {
  const [newLocationName, setNewLocationName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const activeLocation = locations.find(loc => loc.id === activeLocationId);

  const handleAdd = () => {
    if (newLocationName.trim()) {
      onAddLocation(newLocationName.trim());
      setNewLocationName('');
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="truncate pr-2">
              {activeLocation ? activeLocation.name : 'Select a Location'}
            </span>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
          <DropdownMenuLabel>My Gardens</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {locations.map(location => (
            <DropdownMenuItem
              key={location.id}
              onSelect={() => setActiveLocationId(location.id)}
            >
              {location.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setIsAdding(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Location
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isAdding && (
        <div className="flex space-x-2 p-2 bg-muted rounded-md">
          <Input
            placeholder="New location name..."
            value={newLocationName}
            onChange={e => setNewLocationName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <Button size="icon" onClick={handleAdd}>
            <PlusCircle className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
