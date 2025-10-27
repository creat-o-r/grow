
'use client';

import { MouseEvent, useState, useEffect, KeyboardEvent } from 'react';
import type { GardenLocation, GardenViewMode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ChevronsUpDown, Plus, Trash2, Edit, Check, X } from 'lucide-react';
import { db } from '@/lib/db';
import { cn } from '../lib/utils';


type LocationSwitcherProps = {
  locations: GardenLocation[];
  activeLocationId: string | null;
  onLocationChange: (id: string) => void;
  onAddLocation: (name: string) => void;
  onDeleteLocation: (location: GardenLocation) => void;
  gardenViewMode: GardenViewMode;
  onGardenViewModeChange: (mode: GardenViewMode) => void;
  selectedGardenIds: string[];
  onSelectedGardenIdsChange: (ids: string[]) => void;
};

export function LocationSwitcher({
  locations,
  activeLocationId,
  onLocationChange,
  onAddLocation,
  onDeleteLocation,
  gardenViewMode,
  onGardenViewModeChange,
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

  const triggerText = () => {
    if (gardenViewMode === 'multiple') {
      if (selectedGardenIds.length === 0) return 'Select Gardens';
      if (selectedGardenIds.length === 1) {
        return locations.find(l => l.id === selectedGardenIds[0])?.name || '1 Garden';
      }
      if (selectedGardenIds.length === locations.length) return 'All Selected';
      return `${selectedGardenIds.length} Gardens Selected`;
    }
    if (gardenViewMode === 'all') return 'All Gardens';
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
          {locations.map(location => {
            const isSelected = gardenViewMode === 'multiple' && selectedGardenIds.includes(location.id);
            return (
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
                        className={cn("flex items-center w-full cursor-pointer hover:bg-accent rounded-sm px-2 py-1.5", isSelected && 'bg-accent/50')}
                        onClick={() => {
                          if (gardenViewMode !== 'multiple') {
                            onLocationChange(location.id);
                            setIsOpen(false);
                          }
                        }}
                      >
                        {gardenViewMode === 'multiple' && (
                            <DropdownMenuCheckboxItem
                                key={location.id}
                                checked={isSelected}
                                onCheckedChange={(checked) => handleCheckboxChange(location.id, !!checked)}
                                className="p-0 mr-2 border-0 focus:ring-0"
                                onSelect={(e) => e.preventDefault()}
                            />
                        )}
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
          )})}

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
        <DropdownMenuSeparator />
        <div className="p-2">
          <div className="flex items-center justify-center rounded-md bg-muted p-1">
              <Button 
                variant={gardenViewMode === 'multiple' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="flex-1 h-7 text-xs" 
                onClick={() => onGardenViewModeChange('multiple')}
              >
                Selected
              </Button>
               <Button 
                variant={gardenViewMode === 'single' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="flex-1 h-7 text-xs" 
                onClick={() => onGardenViewModeChange('single')}
              >
                Single
              </Button>
               <Button 
                variant={gardenViewMode === 'all' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="flex-1 h-7 text-xs" 
                onClick={() => onGardenViewModeChange('all')}
              >
                All
              </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
