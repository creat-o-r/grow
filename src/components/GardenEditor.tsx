
'use client';

import React from 'react';
import type { GardenLocation, Conditions } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Locate, Loader2, Sparkles, Square, CopyCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

export type GardenEnvField =
  | 'location'
  | 'currentSeason'
  | 'temperature'
  | 'sunlight'
  | 'soil'
  | 'growingSystems'
  | 'growingMethods';

export type FieldShareStatus = {
  status: 'shared-all' | 'shared-subset' | 'unique' | 'unset';
  matchCount: number;
  totalCount: number;
};

export type MultiGardenEditorContext = {
  getFieldShareInfo: (field: GardenEnvField, value?: string) => FieldShareStatus;
  onApplyFieldToAll?: (field: GardenEnvField, value: string) => void;
};

type GardenEditorProps = {
  loc: GardenLocation;
  handleLocationFieldChange: (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => void;
  handleConditionChange: (value: string, field: keyof Conditions, locationId: string) => void;
  handleGetCurrentLocation: (locationId: string) => void;
  isLocating: boolean;
  handleAnalyzeConditions: (locationId: string) => Promise<void>;
  handleStopAnalyzeConditions?: (locationId: string) => void;
  isAnalyzing: string | null;
  multiGardenContext?: MultiGardenEditorContext;
};

export const GardenEditor = React.memo(function GardenEditor({
  loc,
  handleLocationFieldChange,
  handleConditionChange,
  handleGetCurrentLocation,
  isLocating,
  handleAnalyzeConditions,
  handleStopAnalyzeConditions,
  isAnalyzing,
  multiGardenContext,
}: GardenEditorProps) {
  const renderFieldStatus = (field: GardenEnvField, currentValue?: string) => {
    if (!multiGardenContext) return null;
    const info = multiGardenContext.getFieldShareInfo(field, currentValue);
    if (info.status === 'unset') {
      return null;
    }
    const isUnique = info.status === 'unique';
    const isSharedSubset = info.status === 'shared-subset';
    const canSyncAll = (isUnique || isSharedSubset) && Boolean(currentValue?.trim());

    return (
      <span className="inline-flex items-center gap-1 ml-auto">
        <Badge
          variant={isUnique ? 'secondary' : 'outline'}
          className={
            isUnique
              ? 'text-[10px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-normal'
              : isSharedSubset
              ? 'text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/30 font-normal'
              : 'text-[10px] px-1.5 py-0 h-4 text-muted-foreground font-normal'
          }
        >
          {isUnique
            ? 'Unique'
            : isSharedSubset
            ? `Shared (${info.matchCount}/${info.totalCount})`
            : 'Shared'}
        </Badge>
        {canSyncAll && currentValue && multiGardenContext.onApplyFieldToAll && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-4 px-1 text-[10px] text-primary hover:underline"
            onClick={() => multiGardenContext.onApplyFieldToAll?.(field, currentValue)}
            title="Apply this condition to all selected gardens"
          >
            <CopyCheck className="h-2.5 w-2.5 mr-0.5" />
            Sync All
          </Button>
        )}
      </span>
    );
  };

  return (
    <div key={loc.id} className="grid gap-6">
       <div className="grid grid-cols-1 gap-4 items-end">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="space-y-1.5">
              <Label htmlFor={`name-${loc.id}`}>Garden Name</Label>
              <Input
                key={`name-${loc.id}-${loc.name}`}
                id={`name-${loc.id}`}
                name="name"
                defaultValue={loc.name}
                onBlur={handleLocationFieldChange}
                onKeyDown={handleLocationFieldChange}
                autoComplete="off"
                placeholder="e.g., Backyard Raised Beds"
              />
              <p className="text-xs text-muted-foreground">Press Enter or click away to save.</p>
            </div>
            <div className="relative space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor={`location-${loc.id}`}>Location</Label>
                {renderFieldStatus('location', loc.location)}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-full">
                  <Input
                    key={`location-${loc.id}-${loc.location}`}
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
              <p className="text-xs text-muted-foreground">Enter a location to analyze its growing conditions.</p>
            </div>
          </div>
          
          <Card className="bg-background/50">
            <CardHeader className="flex-row items-center justify-between pb-4">
                <div className="space-y-1">
                    <CardTitle className="text-base font-medium">Environmental Conditions</CardTitle>
                    <CardDescription className="text-xs">Enter a location above, then click analyze to auto-fill.</CardDescription>
                </div>
                {isAnalyzing === loc.id ? (
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" disabled className="h-8 text-xs">
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Analyzing...
                    </Button>
                    {handleStopAnalyzeConditions && (
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="h-8 text-xs px-2.5" 
                        onClick={() => handleStopAnalyzeConditions(loc.id)}
                        title="Stop analyzing conditions"
                      >
                        <Square className="mr-1 h-3 w-3 fill-current" />
                        Stop
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => handleAnalyzeConditions(loc.id)}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze
                  </Button>
                )}
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                    <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`season-${loc.id}`}>Current Season</Label>
                      {renderFieldStatus('currentSeason', loc.conditions.currentSeason)}
                    </div>
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
                    <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`temperature-${loc.id}`}>Soil Temperature</Label>
                      {renderFieldStatus('temperature', loc.conditions.temperature)}
                    </div>
                    <Input 
                        key={`temp-${loc.id}-${loc.conditions.temperature}`}
                        id={`temperature-${loc.id}`} 
                        name="temperature"
                        defaultValue={loc.conditions.temperature || ''} 
                        onBlur={handleLocationFieldChange} 
                        onKeyDown={handleLocationFieldChange}
                    />
                    </div>
                    <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`sunlight-${loc.id}`}>Sunlight</Label>
                      {renderFieldStatus('sunlight', loc.conditions.sunlight)}
                    </div>
                    <Input 
                        key={`sun-${loc.id}-${loc.conditions.sunlight}`}
                        id={`sunlight-${loc.id}`} 
                        name="sunlight"
                        defaultValue={loc.conditions.sunlight || ''} 
                        onBlur={handleLocationFieldChange} 
                        onKeyDown={handleLocationFieldChange}
                    />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`soil-${loc.id}`}>Soil</Label>
                          {renderFieldStatus('soil', loc.conditions.soil)}
                        </div>
                        <Input 
                        key={`soil-${loc.id}-${loc.conditions.soil}`}
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
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`growing-systems-${loc.id}`}>Growing Systems</Label>
                  {renderFieldStatus('growingSystems', loc.growingSystems)}
                </div>
                <Input
                    key={`sys-${loc.id}-${loc.growingSystems}`}
                    id={`growing-systems-${loc.id}`}
                    name="growingSystems"
                    defaultValue={loc.growingSystems || ''}
                    onBlur={handleLocationFieldChange}
                    onKeyDown={handleLocationFieldChange}
                    placeholder="e.g., greenhouse, seed trays, pots"
                />
            </div>
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`growing-methods-${loc.id}`}>Growing Methods</Label>
                  {renderFieldStatus('growingMethods', loc.growingMethods)}
                </div>
                <Input
                    key={`meth-${loc.id}-${loc.growingMethods}`}
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
