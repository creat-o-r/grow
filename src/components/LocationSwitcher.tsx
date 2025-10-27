
'use client';

import { MouseEvent, useState, useEffect, KeyboardEvent } from 'react';
import type { GardenLocation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ChevronsUpDown, Plus, Trash2, Edit, Check, X, List, Rows } from 'lucide-react';
import { db } from '@/lib/db';
import { Switch } from './ui/switch';
import { Label } from './ui/label';

type GardenSelectionMode = 'single' | 'multiple';

type LocationSwitcherProps = {
  locations: GardenLocation[];
  activeLocationId: string | null;
  onLocationChange: (id: string) => void;
  onAddLocation: (name: string) => void;
  onDeleteLocation: (location: GardenLocation) => void;
  selectionMode: GardenSelectionMode;
  onSelectionModeChange: (mode: GardenSelectionMode) => void;
  selectedGardenIds: string[];
  onSelectedGardenIdsChange: (ids: string[]) => void;
};

export function LocationSwitcher({
  locations,
  activeLocationId,
  onLocationChange,
  onAddLocation,
  onDeleteLocation,
  selectionMode,
  onSelectionModeChange,
  selectedGardenIds,
  onSelectedGardenIdsChange,
}: LocationSwitcherProps) {
  const [newLocationName, setNewLocationName] = useState('');
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const activeLocation = locations.find(loc => loc.id === activeLocationId);

  useEffect(() => {
    if (editingLocationId) {
      const locationToEdit = locations.find(loc => loc.id === editingLocationId);
      if (locationToEdit) {
        setEditingName(locationToEdit.name);
      }
    } else {
      setEditingName('');
    }
  }, [editingLocationId, locations]);


  const handleAddLocation = () => {
    if (newLocationName.trim()) {
      onAddLocation(newLocationName.trim());
      setNewLocationName('');
    }
  };

  const handleDeleteClick = (e: MouseEvent, location: GardenLocation) => {
    e.stopPropagation();
    onDeleteLocation(location);
  };
  
  const handleEditClick = (e: MouseEvent, location: GardenLocation) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingLocationId(location.id);
  };

  const handleCancelEdit = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingLocationId(null);
  };

  const handleSaveEdit = async (e: MouseEvent) => {
     e.stopPropagation();
     e.preventDefault();
    if (editingLocationId && editingName.trim()) {
      await db.locations.update(editingLocationId, { name: editingName.trim() });
      setEditingLocationId(null);
    }
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingLocationId && editingName.trim()) {
        db.locations.update(editingLocationId, { name: editingName.trim() });
        setEditingLocationId(null);
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditingLocationId(null);
    }
  }

  const handleCheckboxChange = (locationId: string, checked: boolean) => {
    onSelectedGardenIdsChange(
      checked 
        ? [...selectedGardenIds, locationId]
        : selectedGardenIds.filter(id => id !== locationId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    onSelectedGardenIdsChange(checked ? locations.map(l => l.id) : []);
  }

  const triggerText = () => {
    if (selectionMode === 'multiple') {
      if (selectedGardenIds.length === 0) return 'Select Gardens';
      if (selectedGardenIds.length === 1) {
        return locations.find(l => l.id === selectedGardenIds[0])?.name || '1 Garden';
      }
      if (selectedGardenIds.length === locations.length) return 'All Gardens';
      return `${selectedGardenIds.length} Gardens`;
    }
    return activeLocation ? activeLocation.name : 'Select Garden';
  }


  return (
    <DropdownMenu open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setEditingLocationId(null);
    }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="px-2 py-1 h-auto font-semibold text-base -ml-2">
          {triggerText()}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
          <div className="flex items-center justify-between p-2">
              <Label htmlFor="multi-select-switch" className="text-xs font-normal pr-2">Select Multiple</Label>
              <Switch
                id="multi-select-switch"
                checked={selectionMode === 'multiple'}
                onCheckedChange={(checked) => onSelectionModeChange(checked ? 'multiple' : 'single')}
              />
          </div>
          <DropdownMenuSeparator />
          {selectionMode === 'multiple' ? (
              <>
                <DropdownMenuCheckboxItem
                    checked={selectedGardenIds.length === locations.length}
                    onCheckedChange={handleSelectAll}
                    onSelect={(e) => e.preventDefault()}
                >
                    All Gardens
                </DropdownMenuCheckboxItem>
                {locations.map(location => (
                    <DropdownMenuCheckboxItem
                        key={location.id}
                        checked={selectedGardenIds.includes(location.id)}
                        onCheckedChange={(checked) => handleCheckboxChange(location.id, !!checked)}
                        onSelect={(e) => e.preventDefault()}
                    >
                        {location.name}
                    </DropdownMenuCheckboxItem>
                ))}
              </>
          ) : (
             locations.map(location => (
                 <DropdownMenuItem key={location.id} onSelect={(e) => e.preventDefault()} className="focus:bg-transparent p-0">
                    {editingLocationId === location.id ? (
                        <div className="flex items-center gap-1 w-full px-2 py-1.5">
                          <Input 
                            autoFocus
                            value={editingName} 
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            className="h-7"
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveEdit}><Check className="h-4 w-4 text-green-600"/></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelEdit}><X className="h-4 w-4 text-destructive"/></Button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center w-full cursor-pointer hover:bg-accent rounded-sm px-2 py-1.5"
                          onClick={() => {
                              onLocationChange(location.id);
                              setIsOpen(false);
                          }}
                        >
                          <span className="flex-1">{location.name}</span>
                          <div className="flex items-center">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={(e) => handleEditClick(e, location)}
                                aria-label={`Edit ${location.name}`}
                              >
                                <Edit className="h-4 w-4"/>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={(e) => handleDeleteClick(e, location)}
                                aria-label={`Delete ${location.name}`}
                              >
                                  <Trash2 className="h-4 w-4 text-destructive"/>
                              </Button>
                          </div>
                        </div>
                    )}
                </DropdownMenuItem>
              ))
          )}

        <DropdownMenuSeparator />
        <div className="p-2 space-y-2">
            <p className="text-xs font-medium text-muted-foreground px-2">Add New Garden</p>
            <div className="flex items-center space-x-2 px-2">
                <Input
                    placeholder="New garden name..."
                    value={newLocationName}
                    onChange={e => setNewLocationName(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleAddLocation();
                    }}
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
