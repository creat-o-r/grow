
'use client';

import React from 'react';
import type { GardenLocation, Conditions } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Locate, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

type GardenEditorProps = {
  loc: GardenLocation;
  handleLocationFieldChange: (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => void;
  handleConditionChange: (value: string, field: keyof Conditions, locationId: string) => void;
  handleGetCurrentLocation: (locationId: string) => void;
  isLocating: boolean;
  handleAnalyzeConditions: (locationId: string) => Promise<void>;
  isAnalyzing: string | null;
};

export const GardenEditor = React.memo(function GardenEditor({
  loc,
  handleLocationFieldChange,
  handleConditionChange,
  handleGetCurrentLocation,
  isLocating,
  handleAnalyzeConditions,
  isAnalyzing,
}: GardenEditorProps) {

  return (
    <div key={loc.id} className="grid gap-6">
       <div className="grid grid-cols-1 gap-4 items-end">
          <div className="relative">
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
                   placeholder="e.g., San Francisco, USA"
                />
              </div>
              <Button size="icon" variant="outline" onClick={() => handleGetCurrentLocation(loc.id)} disabled={isLocating}>
                {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
              </Button>
            </div>
             <p className="text-xs text-muted-foreground mt-2">Enter a location to analyze its growing conditions.</p>
          </div>
          
          <Card className="bg-background/50">
            <CardHeader className="flex-row items-center justify-between pb-4">
                <div className="space-y-1">
                    <CardTitle className="text-base font-medium">Environmental Conditions</CardTitle>
                    <CardDescription className="text-xs">Enter a location above, then click analyze to auto-fill.</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleAnalyzeConditions(loc.id)} disabled={isAnalyzing === loc.id}>
                    {isAnalyzing === loc.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Analyze
                </Button>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
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
                    <div className="sm:col-span-2 lg:col-span-3">
                        <Label htmlFor={`soil-${loc.id}`}>Soil</Label>
                        <Input 
                        id={`soil-${loc.id}`} 
                        name="soil"
                        defaultValue={loc.conditions.soil || ''} 
                        onBlur={handleLocationFieldChange} 
                        onKeyDown={handleLocationFieldChange}
                        />
                    </div>
                </div>
            </CardContent>
          </Card>
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
