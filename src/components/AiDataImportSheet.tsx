
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

import { Loader2, Sparkles, AlertTriangle, CheckCircle, Replace, PlusCircle, Wand2, RefreshCw, Trash2, ExternalLink, Square, GitMerge, Check, Eye } from 'lucide-react';
import { createDataset } from '@/ai/flows/create-dataset-flow';
import { aiSearchPlantData } from '@/ai/flows/ai-search-plant-data';
import type { AiDataset, AiLog, Plant, Planting, PlantingWithPlant, GardenLocation } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { ToastAction } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

type ImportMode = 'replace' | 'add' | 'new';

export type DuplicateResolution = {
  newPlanting: Planting;
  newPlant: Plant;
  existingPlanting: PlantingWithPlant;
  action: 'merge' | 'add' | 'skip';
};

type AiDataImportSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  apiKeys: { gemini: string };
  areApiKeysSet: boolean;
  onComplete: () => void;
  activeLocation?: GardenLocation | null;
  existingPlantings?: PlantingWithPlant[];
};

export function AiDataImportSheet({ isOpen, onOpenChange, apiKeys, areApiKeysSet, onComplete, activeLocation, existingPlantings }: AiDataImportSheetProps) {
  const [theme, setTheme] = useState('');
  const [refinement, setRefinement] = useState('');
  const [generatedData, setGeneratedData] = useState<AiDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>(activeLocation ? 'add' : 'new');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState<string | null>(null);

  // Tracks which variation plantings outside the usual results are selected for import
  const [includedVariationIds, setIncludedVariationIds] = useState<Set<string>>(new Set());

  // Merge Prompt Dialog state for duplicate detection
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [pendingDuplicates, setPendingDuplicates] = useState<DuplicateResolution[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchMoreAbortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (activeLocation) {
      setImportMode('add');
    }
  }, [activeLocation, isOpen]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    toast({
      title: 'Generation Stopped',
      description: 'AI plant generation was cancelled.',
    });
  };

  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (fetchMoreAbortRef.current) {
      fetchMoreAbortRef.current.abort();
      fetchMoreAbortRef.current = null;
    }
    onOpenChange(false);
    setTimeout(() => {
      setTheme('');
      setRefinement('');
      setGeneratedData(null);
      setError(null);
      setImportMode(activeLocation ? 'add' : 'new');
      setIsGenerating(false);
      setIsImporting(false);
      setIncludedVariationIds(new Set());
      setPendingDuplicates([]);
      setIsMergeModalOpen(false);
    }, 300);
  };

  const handleGenerate = async (isRefinement = false) => {
    if (!theme.trim() || !areApiKeysSet) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    if (!isRefinement) {
        setGeneratedData(null);
    }
    setError(null);

    const fullTheme = isRefinement && refinement.trim() 
        ? `${theme} - REFINEMENT INSTRUCTIONS: ${refinement}`
        : theme;

    const existingPlantSpecies = existingPlantings
      ?.map(p => p.plant?.species || p.name)
      .filter(Boolean) || [];

    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    const promptData = { 
        theme: fullTheme,
        currentMonth,
        ...(activeLocation ? { activeLocation } : {}),
        ...(existingPlantSpecies.length > 0 ? { existingPlants: existingPlantSpecies } : {})
    };

    const abortPromise = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('Generation cancelled by user')));
    });

    try {
      const result = await Promise.race([
        createDataset({ ...promptData, apiKeys }),
        abortPromise,
      ]);
      if (controller.signal.aborted) return;
      setGeneratedData(result);
      setRefinement('');
      setIncludedVariationIds(new Set());
      
      const newLog: AiLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        flow: 'createDataset',
        prompt: promptData,
        results: result,
        model: (result as any)?._modelUsed || 'googleai/gemini-3.8-flash',
      };
      await db.aiLogs.add(newLog);

    } catch (err: any) {
      if (controller.signal.aborted || err.message === 'Generation cancelled by user') {
        return;
      }
      console.error('AI dataset creation failed:', err);
      const errorMessage = err.message || 'Could not create the dataset. Please try again.';
      setError(errorMessage);
      const errorLog: AiLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        flow: 'createDataset',
        prompt: promptData,
        status: 'error',
        error: errorMessage,
        model: 'googleai/gemini-3.8-flash',
      };
      await db.aiLogs.add(errorLog);

      toast({
          title: 'AI Generation Failed',
          description: (
              <div className="flex flex-col gap-2">
                  <p className="text-xs">An error occurred during dataset generation:</p>
                  <pre className="text-xs whitespace-pre-wrap p-2 bg-destructive/20 rounded-md max-h-36 overflow-y-auto font-mono">
                      {errorMessage}
                  </pre>
                  <div className="flex items-center gap-2 mt-1">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="text-xs h-7 px-2"
                      onClick={() => {
                        navigator.clipboard.writeText(errorMessage);
                        toast({ title: 'Copied error to clipboard' });
                      }}
                    >
                      Copy Error
                    </Button>
                  </div>
              </div>
          ),
          variant: 'destructive',
          duration: Infinity,
      });
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handleLocationNameChange = (newName: string) => {
    if (!generatedData) return;
    const updatedLocations = [...generatedData.locations];
    updatedLocations[0].name = newName;
    setGeneratedData({ ...generatedData, locations: updatedLocations });
  };

  const handleRemovePlanting = (plantingId: string) => {
    if (!generatedData) return;
    const updatedPlantings = generatedData.plantings.filter(p => p.id !== plantingId);
    setGeneratedData({ ...generatedData, plantings: updatedPlantings });
  };

  const handleStopFetchMore = () => {
    if (fetchMoreAbortRef.current) {
      fetchMoreAbortRef.current.abort();
      fetchMoreAbortRef.current = null;
    }
    setIsFetchingMore(null);
  };

  const handleFetchMoreLikeThis = async (plant: Plant) => {
    if (fetchMoreAbortRef.current) {
      fetchMoreAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchMoreAbortRef.current = controller;

    setIsFetchingMore(plant.id);
    try {
      const abortPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('Fetch more was stopped by user.')));
      });

      const result = await Promise.race([
        aiSearchPlantData({ searchTerm: `A plant similar to ${plant.species} that fits in a garden with ${theme}`, apiKeys }),
        abortPromise
      ]);
      
      const newPlant: Plant = {
        ...result,
        id: `ai-plant-${Date.now()}`,
      };

      const newPlanting: Planting = {
        id: `ai-planting-${Date.now()}`,
        plantId: newPlant.id,
        gardenId: generatedData?.locations[0].id || '',
        name: result.species,
        createdAt: new Date().toISOString(),
        history: [{ id: 'new-1', 'status': 'Wishlist', date: new Date().toISOString(), notes: `Suggested as similar to ${plant.species}` }],
      }

      if (generatedData) {
         const plantIndex = generatedData.plantings.findIndex(p => p.plantId === plant.id);
         const newPlants = [...generatedData.plants, newPlant];
         const newPlantings = [...generatedData.plantings];
         newPlantings.splice(plantIndex + 1, 0, newPlanting);
         setGeneratedData({ ...generatedData, plants: newPlants, plantings: newPlantings });
      }

    } catch (err: any) {
      if (controller.signal.aborted || err?.message?.includes('stopped by user')) {
        return;
      }
      console.error('Fetch more failed:', err);
      toast({ title: 'Error', description: `Could not fetch a similar plant: ${err.message}`, variant: 'destructive' });
    } finally {
      if (fetchMoreAbortRef.current === controller) {
        fetchMoreAbortRef.current = null;
      }
      setIsFetchingMore(null);
    }
  };

  const handleUndoImport = async (importedPlantingIds: string[], importedPlantIds: string[]) => {
    try {
      await db.plantings.bulkDelete(importedPlantingIds);
      await db.plants.bulkDelete(importedPlantIds);
      toast({
        title: 'Undo Successful',
        description: 'The imported data has been removed.',
      });
    } catch (e) {
      toast({
        title: 'Undo Failed',
        description: 'Could not remove the imported data.',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    if (!generatedData) return;
  
    setIsImporting(true);
    setError(null);
  
    try {
      await db.transaction('rw', db.plants, db.plantings, db.locations, async () => {
        if (importMode === 'replace') {
          await db.plants.clear();
          await db.plantings.clear();
          await db.locations.clear();
  
          await db.locations.bulkAdd(generatedData.locations);
          await db.plants.bulkAdd(generatedData.plants);
          await db.plantings.bulkAdd(generatedData.plantings);
  
          toast({
            title: 'Import Successful',
            description: 'Your garden has been replaced with the new dataset.',
          });
  
        } else if (importMode === 'new') {
            const now = Date.now();
            const newGardenId = `garden-${now}`;
            const idSuffix = `-${now}-${Math.random().toString(36).substring(2, 6)}`;

            const plantIdMap = new Map<string, string>();
            const newPlants: Plant[] = generatedData.plants.map((p, i) => {
              const newId = `plant${idSuffix}-${i}`;
              plantIdMap.set(p.id, newId);
              return { ...p, id: newId };
            });

            const newPlantings: Planting[] = generatedData.plantings.map((p, i) => ({
              ...p,
              id: `planting${idSuffix}-${i}`,
              plantId: plantIdMap.get(p.plantId) || `unknown-plant${idSuffix}-${i}`,
              gardenId: newGardenId,
            }));
            
            const newLocation: GardenLocation = {
                ...generatedData.locations[0],
                id: newGardenId,
            };

          await db.locations.add(newLocation);
          await db.plants.bulkAdd(newPlants);
          await db.plantings.bulkAdd(newPlantings);

          toast({
            title: 'Import Successful',
            description: 'A new garden has been created with the generated plants.',
          });
  
        } else if (importMode === 'add' && activeLocation) {
          const candidatePlantings = [
            ...recommendedPlantings,
            ...variationPlantings.filter(p => includedVariationIds.has(p.id))
          ];

          if (candidatePlantings.length === 0) {
            toast({
              title: 'No Plants Selected',
              description: 'Please select at least one plant to add to your garden.',
              variant: 'destructive',
            });
            setIsImporting(false);
            return;
          }

          // Detect duplicates matching active garden plantings
          const detectedDuplicates: DuplicateResolution[] = [];
          candidatePlantings.forEach(p => {
            const plant = generatedPlantMap.get(p.plantId);
            if (!plant) return;

            const match = existingPlantings?.find(ep => 
              (ep.plant?.species && plant.species && ep.plant.species.toLowerCase().trim() === plant.species.toLowerCase().trim()) ||
              (ep.name && p.name && ep.name.toLowerCase().trim() === p.name.toLowerCase().trim())
            );

            if (match) {
              detectedDuplicates.push({
                newPlanting: p,
                newPlant: plant,
                existingPlanting: match,
                action: 'merge',
              });
            }
          });

          if (detectedDuplicates.length > 0) {
            setPendingDuplicates(detectedDuplicates);
            setIsMergeModalOpen(true);
            setIsImporting(false);
            return;
          }

          // No duplicates found, execute directly
          await executeAddImport([]);
          return;
        }
      });
  
      if (importMode !== 'add') {
        onComplete();
        handleClose();
      }
    } catch (err: any) {
      console.error('Data import failed:', err);
      setError(err.message || 'An unexpected error occurred during import.');
      toast({
        title: 'Import Failed',
        description: 'Could not import the data. Please check the console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const executeAddImport = async (resolutions: DuplicateResolution[] = []) => {
    if (!generatedData || !activeLocation) return;
    setIsImporting(true);
    setIsMergeModalOpen(false);

    try {
      const resolutionMap = new Map<string, DuplicateResolution>();
      resolutions.forEach(r => resolutionMap.set(r.newPlanting.id, r));

      const candidatePlantings = [
        ...recommendedPlantings,
        ...variationPlantings.filter(p => includedVariationIds.has(p.id))
      ];

      await db.transaction('rw', db.plants, db.plantings, async () => {
        const existingPlants = await db.plants.toArray();
        const plantIdMap = new Map<string, string>();
        const plantsToAdd: Plant[] = [];

        // 1. Process candidate plants for db.plants
        for (const planting of candidatePlantings) {
          const res = resolutionMap.get(planting.id);
          if (res?.action === 'skip') continue;

          const newPlant = generatedPlantMap.get(planting.plantId);
          if (!newPlant || plantIdMap.has(newPlant.id)) continue;

          const existingPlant = existingPlants.find(p => p.species.toLowerCase().trim() === newPlant.species.toLowerCase().trim());
          if (existingPlant) {
            plantIdMap.set(newPlant.id, existingPlant.id);
          } else {
            const newDbPlantId = `plant-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            plantIdMap.set(newPlant.id, newDbPlantId);
            plantsToAdd.push({ ...newPlant, id: newDbPlantId });
          }
        }

        if (plantsToAdd.length > 0) {
          await db.plants.bulkAdd(plantsToAdd);
        }

        // 2. Process plantings: handle merge vs add vs skip
        const plantingsToAdd: Planting[] = [];
        let mergedCount = 0;

        for (const newPlanting of candidatePlantings) {
          const res = resolutionMap.get(newPlanting.id);

          if (res?.action === 'skip') {
            continue;
          }

          if (res?.action === 'merge') {
            // MERGE into existing planting: update notes/history without creating duplicate
            const existing = res.existingPlanting;
            const updatedHistory = [
              ...(existing.history || []),
              {
                id: `merge-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                status: existing.history?.slice(-1)[0]?.status || 'Wishlist',
                date: new Date().toISOString(),
                notes: `Merged cultivar from AI dataset: "${newPlanting.name}" (${res.newPlant.optimalConditions})`,
              }
            ];
            await db.plantings.update(existing.id, {
              history: updatedHistory,
              plannedQty: (existing.plannedQty || 0) + (newPlanting.plannedQty || 0) || existing.plannedQty,
            });
            mergedCount++;
            continue;
          }

          // Normal add or user chose "add as separate variation"
          const newPlantId = plantIdMap.get(newPlanting.plantId);
          if (newPlantId) {
            plantingsToAdd.push({
              ...newPlanting,
              id: `planting-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              plantId: newPlantId,
              gardenId: activeLocation.id,
            });
          }
        }

        if (plantingsToAdd.length > 0) {
          await db.plantings.bulkAdd(plantingsToAdd);
        }

        const descriptions: string[] = [];
        if (plantingsToAdd.length > 0) descriptions.push(`${plantingsToAdd.length} new plants added`);
        if (mergedCount > 0) descriptions.push(`${mergedCount} existing plants merged`);

        toast({
          title: 'Import Successful',
          description: `${descriptions.length > 0 ? descriptions.join(' and ') : 'Import completed'} in "${activeLocation.name}".`,
        });
      });

      onComplete();
      handleClose();
    } catch (err: any) {
      console.error('Data import failed:', err);
      setError(err.message || 'An unexpected error occurred during import.');
      toast({
        title: 'Import Failed',
        description: 'Could not import the data. Please check the console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const generatedPlantMap = useMemo(() => {
    if (!generatedData) return new Map();
    return new Map(generatedData.plants.map(p => [p.id, p]));
  }, [generatedData]);

  // Split generated plantings into "Usual Results" (Recommended New Plants)
  // and "Existing Plant Variations & Matches" (Put outside the usual results)
  const { recommendedPlantings, variationPlantings } = useMemo(() => {
    if (!generatedData) return { recommendedPlantings: [], variationPlantings: [] };

    const recs: Planting[] = [];
    const vars: Planting[] = [];

    generatedData.plantings.forEach(planting => {
      const plant = generatedPlantMap.get(planting.plantId);
      if (!plant) return;

      const matchingExisting = existingPlantings?.find(ep => 
        (ep.plant?.species && plant.species && ep.plant.species.toLowerCase().trim() === plant.species.toLowerCase().trim()) ||
        (ep.name && planting.name && ep.name.toLowerCase().trim() === planting.name.toLowerCase().trim())
      );

      if (plant.isExistingVariation || matchingExisting) {
        vars.push(planting);
      } else {
        recs.push(planting);
      }
    });

    return { recommendedPlantings: recs, variationPlantings: vars };
  }, [generatedData, generatedPlantMap, existingPlantings]);

  const toggleVariationInclusion = (plantingId: string) => {
    setIncludedVariationIds(prev => {
      const next = new Set(prev);
      if (next.has(plantingId)) {
        next.delete(plantingId);
      } else {
        next.add(plantingId);
      }
      return next;
    });
  };


  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-2xl w-[90vw] flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-headline">Generate Data with AI</SheetTitle>
          <SheetDescription>
            Describe a garden theme, and the AI will generate a dataset for you. You can then refine it conversationally.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto pr-6 -mr-6">
            <div className="space-y-6">
                 {!areApiKeysSet ? (
                    <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>API Key Required</AlertTitle>
                    <AlertDescription>
                        You must save a Gemini API key in the Settings to use this feature.
                    </AlertDescription>
                    </Alert>
                ) : (
                    <div className="space-y-2">
                    <Label htmlFor="ai-theme">Garden Theme</Label>
                    <div className="flex gap-2">
                        <Input 
                            id="ai-theme" 
                            placeholder="e.g., A beginner-friendly herb garden"
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleGenerate()}
                            disabled={isGenerating}
                        />
                        {isGenerating && !generatedData ? (
                            <Button variant="destructive" onClick={handleStopGeneration}>
                                <Square className="mr-2 h-4 w-4 fill-current" />
                                Stop
                            </Button>
                        ) : (
                            <Button onClick={() => handleGenerate()} disabled={!theme.trim() || isGenerating}>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Generate
                            </Button>
                        )}
                    </div>
                     {activeLocation && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>
                            Using active garden <strong>"{activeLocation.name}"</strong>
                            {activeLocation.location ? ` (${activeLocation.location})` : ' (no city/location set)'} as context.
                          </p>
                          {!activeLocation.location && (
                            <p className="text-amber-600 dark:text-amber-400">
                              💡 Tip: Set a city on "{activeLocation.name}" and click "Analyse Conditions" so the AI generates plants for your actual climate and season.
                            </p>
                          )}
                        </div>
                     )}
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>An Error Occurred</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {(isGenerating && !generatedData) && (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-muted-foreground text-sm">Generating plant recommendations with AI...</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                          onClick={handleStopGeneration}
                        >
                          <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                          Stop Generating
                        </Button>
                    </div>
                )}
            
                {generatedData && (
                     <div className="space-y-6 animate-in fade-in-50">
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">
                                {importMode === 'add' && activeLocation 
                                    ? `Review Plants for "${activeLocation.name}"` 
                                    : 'Review Your New Garden'}
                            </h3>
                            <Card>
                                <CardHeader>
                                     <div className="space-y-1">
                                        <Label htmlFor="garden-name">
                                            {importMode === 'add' && activeLocation ? 'Target Garden' : 'Garden Name'}
                                        </Label>
                                        {importMode === 'add' && activeLocation ? (
                                            <div className="text-lg font-headline font-semibold">{activeLocation.name}</div>
                                        ) : (
                                            <Input
                                                id="garden-name"
                                                value={generatedData.locations[0].name}
                                                onChange={(e) => handleLocationNameChange(e.target.value)}
                                                className="text-lg font-headline h-auto p-0 border-0 shadow-none focus-visible:ring-0"
                                            />
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {importMode === 'add' && activeLocation ? (
                                        <>
                                            <p className="text-sm text-muted-foreground">{activeLocation.location || 'Location not set'}</p>
                                            <p className='text-sm text-muted-foreground'>
                                                {activeLocation.conditions.temperature || 'Temp not set'}, {activeLocation.conditions.sunlight || 'Sunlight not set'}, {activeLocation.conditions.soil || 'Soil not set'}
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm text-muted-foreground">{generatedData.locations[0].location}</p>
                                            <p className='text-sm text-muted-foreground'>
                                                {generatedData.locations[0].conditions.temperature || 'Temp'}, {generatedData.locations[0].conditions.sunlight || 'Sunlight'}, {generatedData.locations[0].conditions.soil || 'Soil'}
                                            </p>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                             <div className="space-y-4">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-sm flex items-center gap-2">
                                      <span>Recommended Plants</span>
                                      <Badge variant="outline" className="text-xs">{recommendedPlantings.length}</Badge>
                                    </h4>
                                  </div>
                                  {recommendedPlantings.length > 0 ? (
                                    <ScrollArea className="h-60 rounded-md border">
                                        <Accordion type="single" collapsible className="w-full">
                                            {recommendedPlantings.map(planting => {
                                                const plant = generatedPlantMap.get(planting.plantId);
                                                if (!plant) return null;

                                                return (
                                                <AccordionItem value={planting.id} key={planting.id} className="border-x-0 border-t-0 px-4">
                                                    <div className="flex items-center w-full py-3">
                                                        <AccordionTrigger className="p-0 hover:no-underline flex-1 justify-start text-left">
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold">{planting.name}</span>
                                                                <span className="text-sm text-muted-foreground">{plant.species}</span>
                                                            </div>
                                                        </AccordionTrigger>
                                                    </div>
                                                    <AccordionContent className="pb-4 space-y-4">
                                                        <div className="text-xs text-muted-foreground space-y-2 mt-2">
                                                            <div>
                                                                <p className="font-semibold text-foreground/80">Germination</p>
                                                                <p>{plant.germinationNeeds}</p>
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-foreground/80">Conditions</p>
                                                                <p>{plant.optimalConditions}</p>
                                                            </div>
                                                        </div>
                                                         <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                                                            {isFetchingMore === plant.id ? (
                                                              <Button variant="destructive" size="sm" className="h-7 text-xs flex items-center gap-1" onClick={handleStopFetchMore}>
                                                                <Square className="h-3 w-3 fill-current" />
                                                                Stop
                                                              </Button>
                                                            ) : (
                                                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleFetchMoreLikeThis(plant)} disabled={!!isFetchingMore}>
                                                                <RefreshCw className="mr-2 h-3 w-3"/>
                                                                More like this
                                                              </Button>
                                                            )}
                                                            <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => handleRemovePlanting(planting.id)}>
                                                                <Trash2 className="mr-2 h-3 w-3"/>
                                                                Remove
                                                            </Button>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            )})}
                                        </Accordion>
                                    </ScrollArea>
                                  ) : (
                                    <div className="p-4 text-center border rounded-md border-dashed text-xs text-muted-foreground">
                                      No new plant species in this dataset. Check the existing variations below.
                                    </div>
                                  )}
                                </div>

                                {/* OUTSIDE USUAL RESULTS: Existing Variations & Matches */}
                                {variationPlantings.length > 0 && (
                                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                          <Sparkles className="h-4 w-4" />
                                          Existing Plant Variations & Strong Matches
                                        </span>
                                        <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30">
                                          {variationPlantings.length}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        Placed outside the standard results. These are variations or cultivars of plants already in your garden, recommended only because of a specific horticultural match.
                                      </p>
                                    </div>

                                    <div className="space-y-2.5">
                                      {variationPlantings.map(planting => {
                                        const plant = generatedPlantMap.get(planting.plantId);
                                        if (!plant) return null;
                                        const isIncluded = includedVariationIds.has(planting.id);
                                        const matchingExisting = existingPlantings?.find(ep => 
                                          (ep.plant?.species && plant.species && ep.plant.species.toLowerCase().trim() === plant.species.toLowerCase().trim()) ||
                                          (ep.name && planting.name && ep.name.toLowerCase().trim() === planting.name.toLowerCase().trim())
                                        );
                                        const relatedTo = plant.relatedExistingPlant || matchingExisting?.name || plant.species;

                                        return (
                                          <div key={planting.id} className="p-3 rounded-md border bg-background/90 text-xs space-y-2">
                                            <div className="flex items-start justify-between gap-2">
                                              <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <span className="font-semibold text-sm">{planting.name}</span>
                                                  <span className="text-muted-foreground">({plant.species})</span>
                                                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40">
                                                    Variation of {relatedTo}
                                                  </Badge>
                                                </div>
                                                {/* Strong Reason/Match Callout */}
                                                <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-foreground/90">
                                                  <span className="font-semibold text-amber-700 dark:text-amber-400">Strong Match: </span>
                                                  <span>{plant.variationReason || `Matches existing planting "${matchingExisting?.name}". Include if you wish to grow this variation.`}</span>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-1.5 shrink-0">
                                                <Button
                                                  type="button"
                                                  size="sm"
                                                  variant={isIncluded ? "default" : "outline"}
                                                  className="h-7 text-xs px-2.5"
                                                  onClick={() => toggleVariationInclusion(planting.id)}
                                                >
                                                  {isIncluded ? <CheckCircle className="mr-1 h-3 w-3" /> : <PlusCircle className="mr-1 h-3 w-3" />}
                                                  {isIncluded ? "Included" : "Include"}
                                                </Button>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                                  onClick={() => handleRemovePlanting(planting.id)}
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Conversational Refinement</h3>
                             <div className="space-y-2">
                                <Label htmlFor="ai-refinement">Refinement Instructions</Label>
                                <div className="flex gap-2">
                                    <Textarea 
                                        id="ai-refinement" 
                                        placeholder="e.g., Add basil and parsley. Make it suitable for a shady balcony."
                                        value={refinement}
                                        onChange={(e) => setRefinement(e.target.value)}
                                        disabled={isGenerating}
                                    />
                                    {isGenerating && generatedData ? (
                                        <Button onClick={handleStopGeneration} variant="destructive" size="icon" title="Stop refinement">
                                            <Square className="h-4 w-4 fill-current" />
                                        </Button>
                                    ) : (
                                        <Button onClick={() => handleGenerate(true)} disabled={!refinement.trim() || isGenerating} variant="outline" size="icon">
                                            <RefreshCw className="h-4 w-4" />
                                            <span className="sr-only">Refine</span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Import Options</h3>
                            <RadioGroup value={importMode} onValueChange={(value) => setImportMode(value as ImportMode)}>
                                {activeLocation && (
                                    <Label htmlFor="r2" className="flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary">
                                        <RadioGroupItem value="add" id="r2" />
                                        <div className="flex flex-col">
                                            <span className="font-bold flex items-center gap-2"><PlusCircle/> Add Plants to Active Garden</span>
                                            <span className="text-sm text-muted-foreground">Adds new plants to your active garden "{activeLocation.name}". Skips species that already exist.</span>
                                        </div>
                                    </Label>
                                )}
                                <Label htmlFor="r3" className="flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary">
                                    <RadioGroupItem value="new" id="r3" />
                                    <div className="flex flex-col">
                                        <span className="font-bold flex items-center gap-2"><Wand2/> Create as New Garden</span>
                                        <span className="text-sm text-muted-foreground">Adds the new location and plants without affecting existing data.</span>
                                    </div>
                                </Label>
                                <Label htmlFor="r1" className="flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary">
                                    <RadioGroupItem value="replace" id="r1" />
                                    <div className="flex flex-col">
                                        <span className="font-bold flex items-center gap-2"><Replace/> Replace Current Garden</span>
                                        <span className="text-sm text-muted-foreground">Deletes all existing data and creates this new garden.</span>
                                    </div>
                                </Label>
                            </RadioGroup>
                            <Button onClick={handleImport} disabled={isImporting} className="w-full">
                                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                Confirm Import
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </SheetContent>

      {/* Duplicate Detection & Merge Prompt Dialog */}
      <Dialog open={isMergeModalOpen} onOpenChange={setIsMergeModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-amber-500" />
              Duplicate Plants Detected
            </DialogTitle>
            <DialogDescription>
              Some plants you are adding match plants already planted in <strong>{activeLocation?.name}</strong>. Choose how you'd like to handle them:
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end gap-2 py-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setPendingDuplicates(prev => prev.map(d => ({ ...d, action: 'merge' })));
              }}
            >
              Merge All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setPendingDuplicates(prev => prev.map(d => ({ ...d, action: 'skip' })));
              }}
            >
              Skip All
            </Button>
          </div>

          <ScrollArea className="max-h-72 pr-3">
            <div className="space-y-3">
              {pendingDuplicates.map((item, idx) => (
                <div key={item.newPlanting.id} className="p-3 rounded-lg border bg-muted/40 space-y-2">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">{item.newPlanting.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Species: {item.newPlant.species} · Matches existing: <em>{item.existingPlanting.name}</em>
                    </span>
                  </div>

                  <RadioGroup
                    value={item.action}
                    onValueChange={(val) => {
                      setPendingDuplicates(prev => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], action: val as 'merge' | 'add' | 'skip' };
                        return next;
                      });
                    }}
                    className="grid grid-cols-3 gap-1 pt-1"
                  >
                    <Label
                      htmlFor={`action-merge-${item.newPlanting.id}`}
                      className="flex items-center gap-1.5 p-2 rounded border cursor-pointer text-xs font-normal hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <RadioGroupItem value="merge" id={`action-merge-${item.newPlanting.id}`} className="sr-only" />
                      <GitMerge className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Merge (Keep One)</span>
                    </Label>

                    <Label
                      htmlFor={`action-add-${item.newPlanting.id}`}
                      className="flex items-center gap-1.5 p-2 rounded border cursor-pointer text-xs font-normal hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <RadioGroupItem value="add" id={`action-add-${item.newPlanting.id}`} className="sr-only" />
                      <PlusCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span>Add as Variant</span>
                    </Label>

                    <Label
                      htmlFor={`action-skip-${item.newPlanting.id}`}
                      className="flex items-center gap-1.5 p-2 rounded border cursor-pointer text-xs font-normal hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <RadioGroupItem value="skip" id={`action-skip-${item.newPlanting.id}`} className="sr-only" />
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>Skip</span>
                    </Label>
                  </RadioGroup>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="ghost" onClick={() => setIsMergeModalOpen(false)}>
              Back
            </Button>
            <Button onClick={() => executeAddImport(pendingDuplicates)}>
              Proceed with Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

    
    
    
