
'use client';

import React from 'react';
import type { GardenLocation, Conditions } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Locate, Loader2, Sparkles } from 'lucide-react';

type GardenEditorProps = {
  loc: GardenLocation;
  handleLocationFieldChange: (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => void;
  handleConditionChange: (value: string, field: keyof Conditions, locationId: string) => void;
  handleGetCurrentLocation: (locationId: string) => void;
  isLocating: boolean;
  handleAnalyzeConditions: (locationId: string) => Promise<void>;
  isAnalyzing: string | null;
  showNameAsHeader?: boolean;
};

export const GardenEditor = React.memo(function GardenEditor({
  loc,
  handleLocationFieldChange,
  handleConditionChange,
  handleGetCurrentLocation,
  isLocating,
  handleAnalyzeConditions,
  isAnalyzing,
  showNameAsHeader = false,
}: GardenEditorProps) {
  return (
    <div key={loc.id} className="grid gap-6">
      {showNameAsHeader && (
        <h2 className="text-xl font-headline sticky top-0 bg-background py-2 -mt-2 z-10 border-b -mx-6 px-6">
            {loc.name}
        </h2>
      )}
       {!showNameAsHeader && (
        <div className="space-y-1 hidden">
              <Label htmlFor={`name-${loc.id}`}>Garden Name</Label>
              <Input
                  id={`name-${loc.id}`}
                  name="name"
                  defaultValue={loc.name}
                  onBlur={handleLocationFieldChange}
                  onKeyDown={handleLocationFieldChange}
                  className="text-lg font-headline h-auto"
              />
          </div>
       )}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="sm:col-span-2 lg:col-span-1 relative">
            <Label htmlFor={`location-${loc.id}`}>Location</Label>
            <div className="flex items-center gap-2">
              <div className="relative w-full">
                <Input
                  id={`location-${loc.id}`}
                  name="location"
                  defaultValue={loc.location}
                  onBlur={handleLocationFieldChange}
                  onKeyDown={handleLocationFieldChange}
                  autoComplete="off"
                />
              </div>
              <Button size="icon" variant="outline" onClick={() => handleGetCurrentLocation(loc.id)} disabled={isLocating}>
                {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 sm:col-span-2 lg:col-span-4 gap-4 items-end">
            <div>
              <Label htmlFor={`season-${loc.id}`}>Current Season</Label>
              <Select
                value={loc.conditions.currentSeason || ''}
                onValueChange={(value) => handleConditionChange(value, 'currentSeason', loc.id)}
              >
                <SelectTrigger id={`season-${loc.id}`}>
                  <SelectValue placeholder="Select season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Spring">Spring</SelectItem>
                  <SelectItem value="Summer">Summer</SelectItem>
                  <SelectItem value="Autumn">Autumn</SelectItem>
                  <SelectItem value="Winter">Winter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`temperature-${loc.id}`}>Soil Temperature</Label>
              <Input 
                id={`temperature-${loc.id}`} 
                name="temperature"
                defaultValue={loc.conditions.temperature || ''} 
                onBlur={handleLocationFieldChange} 
                onKeyDown={handleLocationFieldChange}
              />
            </div>
            <div>
              <Label htmlFor={`sunlight-${loc.id}`}>Sunlight</Label>
              <Input 
                id={`sunlight-${loc.id}`} 
                name="sunlight"
                defaultValue={loc.conditions.sunlight || ''} 
                onBlur={handleLocationFieldChange} 
                onKeyDown={handleLocationFieldChange}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor={`soil-${loc.id}`}>Soil</Label>
                <Input 
                  id={`soil-${loc.id}`} 
                  name="soil"
                  defaultValue={loc.conditions.soil || ''} 
                  onBlur={handleLocationFieldChange} 
                  onKeyDown={handleLocationFieldChange}
                />
              </div>
              <Button size="icon" variant="outline" onClick={() => handleAnalyzeConditions(loc.id)} disabled={isAnalyzing === loc.id}>
                {isAnalyzing === loc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
            <div>
                <Label htmlFor={`growing-systems-${loc.id}`}>Growing Systems</Label>
                <Input
                    id={`growing-systems-${loc.id}`}
                    name="growingSystems"
                    defaultValue={loc.growingSystems || ''}
                    onBlur={handleLocationFieldChange}
                    onKeyDown={handleLocationFieldChange}
                    placeholder="e.g., greenhouse, seed trays, pots"
                />
            </div>
            <div>
                <Label htmlFor={`growing-methods-${loc.id}`}>Growing Methods</Label>
                <Input
                    id={`growing-methods-${loc.id}`}
                    name="growingMethods"
                    defaultValue={loc.growingMethods || ''}
                    onBlur={handleLocationFieldChange}
                    onKeyDown={handleLocationFieldChange}
                    placeholder="e.g., direct sow, transplant"
                />
            </div>
        </div>
    </div>
  );
});
