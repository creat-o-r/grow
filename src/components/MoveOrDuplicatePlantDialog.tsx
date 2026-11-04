'use client';

import { useState, useEffect, useMemo } from 'react';
import type { PlantingWithPlant, GardenLocation, Planting, StatusHistory, PlantStatus } from '@/lib/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRightLeft, Copy, CopyPlus, Fence, Plus, Check, MapPin, Sparkles, AlertCircle, Calendar } from 'lucide-react';
import { getCuratedPlantImage } from '@/lib/plant-images';

export type MoveOrDuplicatePlantDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  planting: PlantingWithPlant;
  initialMode?: 'move' | 'duplicate';
  onSuccess?: (action: 'move' | 'duplicate', targetGarden: GardenLocation, newPlantingId?: string) => void;
  onSwitchGarden?: (gardenId: string) => void;
};

const statusColors: Record<string, string> = {
  Wishlist: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
  Planting: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
  Growing: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
  Harvest: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800',
};

export function MoveOrDuplicatePlantDialog({
  isOpen,
  onOpenChange,
  planting,
  initialMode = 'move',
  onSuccess,
  onSwitchGarden,
}: MoveOrDuplicatePlantDialogProps) {
  const { toast } = useToast();
  const locations = useLiveQuery(() => db.locations.toArray(), []) || [];
  
  const [activeTab, setActiveTab] = useState<'move' | 'duplicate'>(initialMode);
  const [targetGardenId, setTargetGardenId] = useState<string>('');
  
  // Duplicate-specific options
  const [duplicateName, setDuplicateName] = useState<string>('');
  const [targetStatus, setTargetStatus] = useState<PlantStatus>('Wishlist');
  const [copyQuantities, setCopyQuantities] = useState<boolean>(true);
  const [copyHistory, setCopyHistory] = useState<boolean>(false);
  const [autoSwitchGarden, setAutoSwitchGarden] = useState<boolean>(true);

  // Quick garden creation state
  const [isCreatingGarden, setIsCreatingGarden] = useState(false);
  const [newGardenName, setNewGardenName] = useState('');
  const [isSavingNewGarden, setIsSavingNewGarden] = useState(false);

  // Current garden info
  const currentGarden = useMemo(() => {
    return locations.find(loc => loc.id === planting.gardenId) || planting.garden;
  }, [locations, planting.gardenId, planting.garden]);

  const otherGardens = useMemo(() => {
    return locations.filter(loc => loc.id !== planting.gardenId);
  }, [locations, planting.gardenId]);

  const latestStatus = planting.history && planting.history.length > 0
    ? planting.history[planting.history.length - 1].status
    : 'Wishlist';

  // Initialize form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
      setIsCreatingGarden(false);
      setNewGardenName('');
      
      // Default target garden for move: first other garden if available
      const firstOther = locations.find(loc => loc.id !== planting.gardenId);
      if (firstOther) {
        setTargetGardenId(firstOther.id);
      } else if (locations.length > 0) {
        setTargetGardenId(locations[0].id);
      } else {
        setTargetGardenId('');
      }

      // Default duplicate options
      setDuplicateName(`${planting.name}`);
      setTargetStatus(latestStatus);
      setCopyQuantities(true);
      setCopyHistory(false);
      setAutoSwitchGarden(true);
    }
  }, [isOpen, initialMode, planting, locations, latestStatus]);

  // Adjust duplicate name default if target garden is same garden
  useEffect(() => {
    if (targetGardenId === planting.gardenId) {
      setDuplicateName(prev => {
        if (!prev || prev === planting.name) {
          return `${planting.name} (Copy)`;
        }
        return prev;
      });
    } else {
      setDuplicateName(prev => {
        if (prev === `${planting.name} (Copy)`) {
          return planting.name;
        }
        return prev;
      });
    }
  }, [targetGardenId, planting.gardenId, planting.name]);

  const handleCreateQuickGarden = async () => {
    const trimmed = newGardenName.trim();
    if (!trimmed) return;
    setIsSavingNewGarden(true);
    try {
      const newLoc: GardenLocation = {
        id: Date.now().toString(),
        name: trimmed,
        location: '',
        temperatureUnit: currentGarden?.temperatureUnit || 'C',
        conditions: {
          temperature: currentGarden?.conditions?.temperature || '',
          sunlight: currentGarden?.conditions?.sunlight || '',
          soil: currentGarden?.conditions?.soil || '',
          currentSeason: currentGarden?.conditions?.currentSeason || 'Spring',
        },
        growingSystems: '',
        growingMethods: '',
      };
      await db.locations.add(newLoc);
      setTargetGardenId(newLoc.id);
      setNewGardenName('');
      setIsCreatingGarden(false);
      toast({
        title: 'New Garden Created',
        description: `"${newLoc.name}" created and selected as destination.`,
      });
    } catch (err) {
      toast({
        title: 'Error Creating Garden',
        description: 'Failed to create new garden.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingNewGarden(false);
    }
  };

  const handleMovePlant = async () => {
    if (!targetGardenId || targetGardenId === planting.gardenId) {
      toast({
        title: 'Select Destination',
        description: 'Please select a different destination garden.',
        variant: 'destructive',
      });
      return;
    }

    const target = locations.find(loc => loc.id === targetGardenId);
    if (!target) return;

    try {
      // Update planting to new garden location & clear stale location-specific cached assessments
      await db.plantings.update(planting.id, {
        gardenId: targetGardenId,
        viability: undefined,
        viabilityReasoning: undefined,
        stageViability: undefined,
        prepForecast: undefined,
        growAssessment: undefined,
        harvestAssessment: undefined,
        methodViabilities: undefined,
        seasonalViabilities: undefined,
      });

      toast({
        title: 'Plant Moved',
        description: `"${planting.name}" moved from "${currentGarden?.name || 'current garden'}" to "${target.name}".`,
        action: onSwitchGarden ? (
          <ToastAction altText={`Switch to ${target.name}`} onClick={() => onSwitchGarden(target.id)}>
            Switch Garden
          </ToastAction>
        ) : undefined,
      });

      if (autoSwitchGarden && onSwitchGarden) {
        onSwitchGarden(target.id);
      }

      onSuccess?.('move', target);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Move Failed',
        description: 'Could not move the plant to the selected garden.',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicatePlant = async () => {
    if (!targetGardenId) {
      toast({
        title: 'Select Destination',
        description: 'Please select a garden for the duplicated plant.',
        variant: 'destructive',
      });
      return;
    }

    const target = locations.find(loc => loc.id === targetGardenId);
    if (!target) return;

    try {
      const newPlantingId = `planting-${Date.now()}`;
      const nowIso = new Date().toISOString();

      const initialHistory: StatusHistory[] = copyHistory && planting.history && planting.history.length > 0
        ? planting.history.map((h, idx) => ({ ...h, id: `status-${Date.now()}-${idx}` }))
        : [
            {
              id: `status-${Date.now()}`,
              status: targetStatus,
              date: nowIso,
              notes: `Duplicated from ${planting.name} (${currentGarden?.name || 'Original Garden'})`,
            },
          ];

      const newPlanting: Planting = {
        id: newPlantingId,
        plantId: planting.plantId,
        gardenId: targetGardenId,
        name: duplicateName.trim() || `${planting.name} (Copy)`,
        createdAt: nowIso,
        history: initialHistory,
        seedsOnHand: copyQuantities ? planting.seedsOnHand : undefined,
        plannedQty: copyQuantities ? planting.plannedQty : undefined,
        propagationMethod: planting.propagationMethod || 'seed',
        swapAvailable: planting.swapAvailable,
      };

      await db.plantings.add(newPlanting);

      toast({
        title: 'Plant Duplicated',
        description: `Created "${newPlanting.name}" in "${target.name}".`,
        action: target.id !== planting.gardenId && onSwitchGarden ? (
          <ToastAction altText={`View in ${target.name}`} onClick={() => onSwitchGarden(target.id)}>
            View Garden
          </ToastAction>
        ) : undefined,
      });

      if (autoSwitchGarden && target.id !== planting.gardenId && onSwitchGarden) {
        onSwitchGarden(target.id);
      }

      onSuccess?.('duplicate', target, newPlantingId);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Duplicate Failed',
        description: 'Could not duplicate the plant.',
        variant: 'destructive',
      });
    }
  };

  const selectedTargetGarden = locations.find(loc => loc.id === targetGardenId);
  const imageUrl = getCuratedPlantImage(planting.plant, planting.name) || planting.plant.imageUrl;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-headline">
            {activeTab === 'move' ? (
              <>
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                <span>Move Plant to Garden</span>
              </>
            ) : (
              <>
                <CopyPlus className="h-5 w-5 text-primary" />
                <span>Duplicate Plant to Garden</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Relocate or clone this plant instance into another garden location.
          </DialogDescription>
        </DialogHeader>

        {/* Plant Overview Header Pill */}
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40 my-1">
          {imageUrl && (
            <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
              <img
                src={imageUrl}
                alt={planting.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate leading-tight">{planting.name}</h4>
            <p className="text-xs text-muted-foreground truncate italic">{planting.plant.species}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex items-center gap-1 font-mono">
                <Fence className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="truncate max-w-[120px]">{currentGarden?.name || 'Unassigned Garden'}</span>
              </Badge>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border font-medium ${statusColors[latestStatus] || ''}`}>
                {latestStatus}
              </Badge>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Move vs Duplicate */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'move' | 'duplicate')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="move" className="flex items-center gap-1.5 text-xs">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>Move Plant</span>
            </TabsTrigger>
            <TabsTrigger value="duplicate" className="flex items-center gap-1.5 text-xs">
              <CopyPlus className="h-3.5 w-3.5" />
              <span>Duplicate / Copy</span>
            </TabsTrigger>
          </TabsList>

          {/* MOVE TAB CONTENT */}
          <TabsContent value="move" className="space-y-4 pt-1">
            {otherGardens.length === 0 && !isCreatingGarden ? (
              <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 space-y-3">
                <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="text-xs space-y-1">
                    <p className="font-medium">Only 1 garden location available</p>
                    <p className="text-muted-foreground">
                      You currently only have &ldquo;{currentGarden?.name || 'one garden'}&rdquo;. To move plants, create a second garden location (such as a Greenhouse, Balcony, or Raised Bed).
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsCreatingGarden(true)}
                  className="w-full text-xs h-8 gap-1.5 border-amber-300 dark:border-amber-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Destination Garden
                </Button>
              </div>
            ) : isCreatingGarden ? (
              <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
                <Label className="text-xs font-medium">New Garden Name</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Greenhouse, Raised Bed #2"
                    value={newGardenName}
                    onChange={(e) => setNewGardenName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateQuickGarden()}
                    className="h-8 text-xs"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs px-3"
                    onClick={handleCreateQuickGarden}
                    disabled={!newGardenName.trim() || isSavingNewGarden}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs px-2"
                    onClick={() => setIsCreatingGarden(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="target-garden-move" className="text-xs font-medium">
                      Destination Garden
                    </Label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingGarden(true)}
                      className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" />
                      New Garden
                    </button>
                  </div>
                  <Select value={targetGardenId} onValueChange={setTargetGardenId}>
                    <SelectTrigger id="target-garden-move" className="h-9 text-xs">
                      <SelectValue placeholder="Choose destination garden..." />
                    </SelectTrigger>
                    <SelectContent>
                      {otherGardens.map(loc => (
                        <SelectItem key={loc.id} value={loc.id} className="text-xs">
                          <span className="font-medium">{loc.name}</span>
                          {loc.location ? ` — ${loc.location}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTargetGarden && (
                  <div className="p-3 rounded-md bg-muted/40 border border-muted text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <span>{selectedTargetGarden.name}</span>
                      {selectedTargetGarden.location && (
                        <span className="text-muted-foreground font-normal">({selectedTargetGarden.location})</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {selectedTargetGarden.conditions?.currentSeason && (
                        <span>Season: <strong className="text-foreground">{selectedTargetGarden.conditions.currentSeason}</strong></span>
                      )}
                      {selectedTargetGarden.conditions?.sunlight && (
                        <span>Sun: <strong className="text-foreground">{selectedTargetGarden.conditions.sunlight}</strong></span>
                      )}
                      {selectedTargetGarden.conditions?.soil && (
                        <span>Soil: <strong className="text-foreground">{selectedTargetGarden.conditions.soil}</strong></span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground pt-1 border-t border-muted/60">
                      💡 Viability assessments and seasonal forecasts will automatically adapt to this garden&apos;s conditions.
                    </p>
                  </div>
                )}

                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="auto-switch-move"
                    checked={autoSwitchGarden}
                    onCheckedChange={(checked) => setAutoSwitchGarden(!!checked)}
                  />
                  <Label htmlFor="auto-switch-move" className="text-xs font-normal cursor-pointer">
                    Switch active garden view to destination after moving
                  </Label>
                </div>
              </div>
            )}
          </TabsContent>

          {/* DUPLICATE TAB CONTENT */}
          <TabsContent value="duplicate" className="space-y-4 pt-1">
            <div className="space-y-3">
              {/* Target Garden Selection (can be same or different) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="target-garden-dup" className="text-xs font-medium">
                    Destination Garden
                  </Label>
                  {!isCreatingGarden && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingGarden(true)}
                      className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" />
                      New Garden
                    </button>
                  )}
                </div>
                {isCreatingGarden ? (
                  <div className="p-2.5 border rounded-lg bg-muted/30 space-y-2">
                    <Label className="text-[11px] font-medium">Create New Garden</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. Nursery, Greenhouse"
                        value={newGardenName}
                        onChange={(e) => setNewGardenName(e.target.value)}
                        className="h-7 text-xs"
                        autoFocus
                      />
                      <Button size="sm" className="h-7 text-xs px-2.5" onClick={handleCreateQuickGarden}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setIsCreatingGarden(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Select value={targetGardenId} onValueChange={setTargetGardenId}>
                    <SelectTrigger id="target-garden-dup" className="h-9 text-xs">
                      <SelectValue placeholder="Choose garden..." />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id} className="text-xs">
                          <span className="font-medium">{loc.name}</span>
                          {loc.id === planting.gardenId ? ' (Current Garden)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Name for duplicated plant */}
              <div className="space-y-1.5">
                <Label htmlFor="duplicate-name" className="text-xs font-medium">
                  Name for Copied Plant
                </Label>
                <Input
                  id="duplicate-name"
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  placeholder="e.g. Carrots 2024 Lot B"
                  className="h-8 text-xs"
                />
              </div>

              {/* Initial Lifecycle Stage */}
              <div className="space-y-1.5">
                <Label htmlFor="duplicate-status" className="text-xs font-medium">
                  Starting Lifecycle Stage
                </Label>
                <Select value={targetStatus} onValueChange={(val) => setTargetStatus(val as PlantStatus)}>
                  <SelectTrigger id="duplicate-status" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Wishlist" className="text-xs">Wishlist (Planning / Next Season)</SelectItem>
                    <SelectItem value="Planting" className="text-xs">Planting (Seeds / Starts Prepared)</SelectItem>
                    <SelectItem value="Growing" className="text-xs">Growing (In Ground / Active Growth)</SelectItem>
                    <SelectItem value="Harvest" className="text-xs">Harvest (Ripening / Harvest Stage)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Duplicate options toggles */}
              <div className="space-y-2 pt-1 border-t border-muted/60">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="copy-quantities"
                    checked={copyQuantities}
                    onCheckedChange={(checked) => setCopyQuantities(!!checked)}
                  />
                  <Label htmlFor="copy-quantities" className="text-xs font-normal cursor-pointer">
                    Copy seeds on hand ({planting.seedsOnHand ?? 0}) and planned quantity ({planting.plannedQty ?? 0})
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="copy-history"
                    checked={copyHistory}
                    onCheckedChange={(checked) => setCopyHistory(!!checked)}
                  />
                  <Label htmlFor="copy-history" className="text-xs font-normal cursor-pointer">
                    Copy complete status history timeline ({planting.history?.length || 0} event{planting.history?.length === 1 ? '' : 's'})
                  </Label>
                </div>

                {targetGardenId !== planting.gardenId && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="auto-switch-dup"
                      checked={autoSwitchGarden}
                      onCheckedChange={(checked) => setAutoSwitchGarden(!!checked)}
                    />
                    <Label htmlFor="auto-switch-dup" className="text-xs font-normal cursor-pointer">
                      Switch active garden view to destination after duplicating
                    </Label>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>

          {activeTab === 'move' ? (
            <Button
              type="button"
              size="sm"
              onClick={handleMovePlant}
              disabled={!targetGardenId || targetGardenId === planting.gardenId}
              className="text-xs gap-1.5"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>Move Plant</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleDuplicatePlant}
              disabled={!targetGardenId || !duplicateName.trim()}
              className="text-xs gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Duplicate Plant</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
