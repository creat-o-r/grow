

'use client';

import React, { useState, useEffect, useCallback, MouseEvent, useMemo, useRef, KeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Plant, Planting, PlantingWithPlant, GardenLocation, Conditions, StatusHistory, AiLog, ViabilityAnalysisMode, GardenViewMode, AiDataset, FreeLlmConfig } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { usePrevious } from '@/hooks/use-previous';
import { getEnvironmentalData } from '@/ai/flows/get-environmental-data';
import { getAiViability } from '@/ai/flows/get-ai-viability';
import { loadDataset } from '@/lib/datasets';
import { Viability, getSuitableSeasons, getUpcomingViability } from '@/lib/viability';
import { decodeSeedPackFromInput, mergeSeedPackIntoDb } from '@/lib/seed-pack';
import { publishCommunityViabilitySignal } from '@/lib/p2p-signals';
import { ExtensionSlotBar } from '@/extensions/ExtensionSlotBar';

import { LocationSwitcher } from '@/components/LocationSwitcher';
import { PlantCard } from '@/components/PlantCard';
import { PlantForm } from '@/components/PlantForm';
import { AiLogPanel } from '@/components/AiLogPanel';
import { SettingsSheet } from '@/components/SettingsSheet';
import { AiDataImportSheet, type UnifiedImportTab } from '@/components/AiDataImportSheet';
import { DuplicateReviewSheet } from '@/components/DuplicateReviewSheet';
import { PlantingDashboard } from '@/components/PlantingDashboard';
import { GardenEditor } from '@/components/GardenEditor';
import { GardenEditSheet } from '@/components/GardenEditSheet';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Upload, Locate, Loader2, X, Sparkles, NotebookText, Settings, Info, Rocket, AlertCircle, Fence, Square } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToastAction } from '@/components/ui/toast';
import { Progress } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';


type PlantStatus = StatusHistory['status'];

const REPO_URL = 'https://github.com/creat-o-r/grow';


export default function Home() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [plantingToEdit, setPlantingToEdit] = useState<PlantingWithPlant | null>(null);
  const [newPlantDefaultStatus, setNewPlantDefaultStatus] = useState<PlantStatus>('Wishlist');
  const [isClient, setIsClient] = useState(false);
  const [accordionValue, setAccordionValue] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<PlantStatus | 'All'>('All');
  const [isLocating, setIsLocating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [wishlistSortOrder, setWishlistSortOrder] = useState<'season' | 'viability'>('season');
  
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [selectedGardenIds, setSelectedGardenIds] = useState<string[]>([]);
  const [gardenViewMode, setGardenViewMode] = useState<GardenViewMode>('one');


  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<GardenLocation | null>(null);
  const [plantingToDelete, setPlantingToDelete] = useState<PlantingWithPlant | null>(null);


  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
  const [isGardenEditSheetOpen, setIsGardenEditSheetOpen] = useState(false);
  const [isAiImportSheetOpen, setIsAiImportSheetOpen] = useState(false);
  const [unifiedImportTab, setUnifiedImportTab] = useState<UnifiedImportTab>('single');
  const [preloadedDatasetForReview, setPreloadedDatasetForReview] = useState<{ data: AiDataset; title: string } | null>(null);
  const [isDuplicateReviewSheetOpen, setIsDuplicateReviewSheetOpen] = useState(false);
  const [hasDuplicates, setHasDuplicates] = useState(false);

  const [duplicateSelectionMode, setDuplicateSelectionMode] = useState<PlantingWithPlant | null>(null);
  
  const unspecifiedSeasonSectionRef = useRef<HTMLDivElement>(null);
  const conditionAbortRef = useRef<AbortController | null>(null);
  const batchViabilityAbortRef = useRef<AbortController | null>(null);
  const singleViabilityAbortRef = useRef<AbortController | null>(null);
  const isBatchRunningRef = useRef(false);
  const lastAnalyzedConditionsRef = useRef<string | null>(null);


  const { toast, dismiss } = useToast();

  const plants = useLiveQuery(() => db.plants.toArray(), []);
  const plantings = useLiveQuery(() => db.plantings.toArray(), []);
  const locations = useLiveQuery(() => db.locations.toArray(), []);
  const aiLogs = useLiveQuery(() => db.aiLogs.orderBy('timestamp').reverse().limit(10).toArray(), []);
  
  const [apiKeys, setApiKeys] = useState<FreeLlmConfig>({ gemini: '' });
  const [areApiKeysSet, setAreApiKeysSet] = useState(false);
  const [viabilityMechanism, setViabilityMechanism] = useState<ViabilityAnalysisMode>('ai');
  const [viabilityData, setViabilityData] = useState<Record<string, Viability | undefined>>({});
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const previousViabilityMechanism = usePrevious(viabilityMechanism);
  const activeLocation = useMemo(() => locations?.find(loc => loc.id === activeLocationId), [locations, activeLocationId]);
  const vercelDeployUrl = `https://vercel.com/new/clone?repository-url=${encodeURIComponent(REPO_URL)}`;

  useEffect(() => {
    setIsClient(true);
    
    const initDb = async () => {
        const locationCount = await db.locations.count();
        if (locationCount > 0) {
             const savedActiveLocation = localStorage.getItem('grow_activeLocation');
             let foundLocation = false;
             if (savedActiveLocation) {
                const doesLocationExist = await db.locations.get(savedActiveLocation);
                if (doesLocationExist) {
                    setActiveLocationId(savedActiveLocation);
                    setSelectedGardenIds([savedActiveLocation]);
                    foundLocation = true;
                }
             }
             if (!foundLocation) {
                const firstLocation = await db.locations.toCollection().first();
                if (firstLocation) {
                    setActiveLocationId(firstLocation.id);
                    setSelectedGardenIds([firstLocation.id]);
                }
             }
        }

        // Restore any past AI viability evaluations from db.aiLogs into db.plantings
        try {
          const pastViabilityLogs = await db.aiLogs
            .where('flow')
            .equals('getAiViability')
            .reverse()
            .toArray();

          if (pastViabilityLogs.length > 0) {
            const allPlantings = await db.plantings.toArray();
            const allPlants = await db.plants.toArray();
            const plantMap = new Map(allPlants.map(p => [p.id, p]));

            for (const planting of allPlantings) {
              if (!planting.viability) {
                const plant = plantMap.get(planting.plantId);
                const matchingLog = pastViabilityLogs.find(log => 
                  log.results?.viability && (
                    log.prompt?.plant?.species === plant?.species ||
                    log.prompt?.plant?.species === planting.name ||
                    log.prompt?.plant === plant?.species
                  )
                );
                if (matchingLog?.results?.viability) {
                  await db.plantings.update(planting.id, {
                    viability: matchingLog.results.viability,
                    viabilityReasoning: matchingLog.results.reasoning,
                    viabilityAssessedAt: matchingLog.timestamp,
                  });
                }
              }
            }
          }
        } catch (syncErr) {
          console.warn('Could not sync past viability logs:', syncErr);
        }
    }
    initDb();

    const storedKeys = localStorage.getItem('grow_apiKeys');
    if (storedKeys) {
      const parsedKeys = JSON.parse(storedKeys);
      setApiKeys(parsedKeys);
      if (parsedKeys.gemini || parsedKeys.groq || parsedKeys.openrouter || parsedKeys.ollamaUrl) {
        setAreApiKeysSet(true);
      }
    }

    // Handle 1-click forkable ?pack= or ?dataset= deep links by opening the full Review & Garden Import Options sheet
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const packParam = params.get('pack');
      const datasetParam = params.get('dataset');

      if (packParam) {
        try {
          const decoded = decodeSeedPackFromInput(packParam);
          const packTitle = decoded.locations?.[0]?.name || 'Shared Seed Pack';
          setPreloadedDatasetForReview({ data: decoded, title: packTitle });
          setIsAiImportSheetOpen(true);
          window.history.replaceState({}, '', window.location.pathname);
        } catch (err) {
          console.warn('Could not decode ?pack= URL param:', err);
        }
      } else if (datasetParam) {
        loadDataset(datasetParam)
          .then((ds) => {
            setPreloadedDatasetForReview({ data: ds, title: ds.name });
            setIsAiImportSheetOpen(true);
            window.history.replaceState({}, '', window.location.pathname);
          })
          .catch((err) => console.warn('Could not load ?dataset= URL param:', err));
      }
    }

    const storedMechanism = localStorage.getItem('grow_viabilityMechanism') as ViabilityAnalysisMode | null;
    if (storedMechanism && storedMechanism === 'ai') {
      setViabilityMechanism('ai');
    } else {
      setViabilityMechanism('ai');
      localStorage.setItem('grow_viabilityMechanism', 'ai');
    }

  }, []);

  useEffect(() => {
    if (activeLocationId) {
        localStorage.setItem('grow_activeLocation', activeLocationId);
    } else {
        localStorage.removeItem('grow_activeLocation');
    }
  }, [activeLocationId]);
  
  const handleApiKeysChange = (newKeys: FreeLlmConfig) => {
    localStorage.setItem('grow_apiKeys', JSON.stringify(newKeys));
    setApiKeys(newKeys);
    if (newKeys.gemini || newKeys.groq || newKeys.openrouter || newKeys.ollamaUrl) {
      setAreApiKeysSet(true);
      toast({
        title: 'AI Provider Settings Saved',
        description: 'Your free LLM cascade configuration has been updated.',
      });
    } else {
      setAreApiKeysSet(false);
    }
  };

  const handleViabilityMechanismChange = (_mechanism: ViabilityAnalysisMode) => {
    setViabilityMechanism('ai');
    localStorage.setItem('grow_viabilityMechanism', 'ai');
  };

  useEffect(() => {
    if (locations && locations.length > 0 && !activeLocationId) {
      const firstLocation = locations[0];
      setActiveLocationId(firstLocation.id);
      setSelectedGardenIds([firstLocation.id]);
    }
  }, [locations, activeLocationId]);

  const handleAddPlant = async (plantingData: Omit<Planting, 'id'>, plantData: Omit<Plant, 'id'>) => {
    let plantId = (await db.plants.where('species').equalsIgnoreCase(plantData.species).first())?.id;

    if (!plantId) {
        const newPlant: Plant = { ...plantData, id: `plant-${Date.now()}` };
        plantId = await db.plants.add(newPlant);
    }

    const newPlanting: Planting = {
        ...plantingData,
        id: `planting-${Date.now()}`,
        plantId: plantId.toString(),
        gardenId: activeLocationId || '',
    };
    await db.plantings.add(newPlanting);

    setIsSheetOpen(false);
    setIsAiImportSheetOpen(false);
    toast({
      title: 'Plant Added',
      description: `${plantingData.name} has been added to your collection.`,
    });
};

const handleUpdatePlant = async (updatedPlanting: Planting, updatedPlant: Plant) => {
    await db.plantings.put(updatedPlanting);
    await db.plants.put(updatedPlant);

    setPlantingToEdit(null);
    setIsSheetOpen(false);
    setIsAiImportSheetOpen(false);
    toast({
        title: 'Plant Updated',
        description: `${updatedPlanting.name} has been updated.`,
    });
};

  const handleDeletePlanting = async () => {
    if (!plantingToDelete) return;
    await db.plantings.delete(plantingToDelete.id);
    toast({
      title: 'Plant Removed',
      description: `${plantingToDelete.name} has been removed.`,
      variant: 'destructive',
    });
    setPlantingToDelete(null);
    setIsDeleteAlertOpen(false);
  };
  
  const handleEditPlanting = (planting: PlantingWithPlant) => {
    setPlantingToEdit(planting);
    setPreloadedDatasetForReview(null);
    setUnifiedImportTab('single');
    setIsAiImportSheetOpen(true);
  };

  const handleOpenAddSheet = (defaultStatus?: PlantStatus, tab: UnifiedImportTab = 'single') => {
    setPlantingToEdit(null);
    setNewPlantDefaultStatus(defaultStatus || 'Wishlist');
    setPreloadedDatasetForReview(null);
    setUnifiedImportTab(tab);
    setIsAiImportSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open);
    setIsAiImportSheetOpen(open);
    if (!open) {
      setPlantingToEdit(null);
    }
  };

  const handleImport = async (datasetKey: string) => {
    try {
        const dataset = await loadDataset(datasetKey);
        await importData(dataset, dataset.name);
    } catch (error: any) {
        console.error('Failed to import dataset:', error);
        toast({
            title: 'Import Failed',
            description: `There was an error loading the dataset: ${error.message}`,
            variant: 'destructive',
        });
    }
  };

  const importData = async (data: AiDataset, name: string) => {
    setViabilityData({}); // Clear old viability data
    await db.transaction('rw', db.plants, db.plantings, db.locations, async () => {
        await db.plants.clear();
        await db.plantings.clear();
        await db.locations.clear();

        if (data.locations && data.locations.length > 0) {
            await db.locations.bulkAdd(data.locations);
        }
        if (data.plants && data.plants.length > 0) {
            await db.plants.bulkAdd(data.plants);
        }
        if (data.plantings && data.plantings.length > 0) {
            const gardenId = data.locations?.[0]?.id;
            if (gardenId) {
                const plantingsWithGardenId = data.plantings.map((p: any) => ({
                    ...p,
                    gardenId: gardenId,
                }));
                await db.plantings.bulkAdd(plantingsWithGardenId);
            } else {
                await db.plantings.bulkAdd(data.plantings);
            }
        }
    });

    const firstLocation = data.locations?.[0];
    if (firstLocation) {
        setActiveLocationId(firstLocation.id);
        setSelectedGardenIds([firstLocation.id]);
        setGardenViewMode('one');
    } else {
        setActiveLocationId(null);
        setSelectedGardenIds([]);
    }

    toast({
        title: 'Data Imported',
        description: `The "${name}" dataset has been loaded.`,
    });
    setIsSettingsSheetOpen(false);
};

  const handlePublish = async () => {
    const plantsData = await db.plants.toArray();
    const plantingsData = await db.plantings.toArray();
    const locationsData = await db.locations.toArray();
    const dataToPublish = {
      plants: plantsData,
      plantings: plantingsData,
      locations: locationsData,
      activeLocationId,
    };
    navigator.clipboard.writeText(JSON.stringify(dataToPublish, null, 2));
    toast({
      title: 'Data Published',
      description: 'Your entire dataset has been copied to the clipboard.',
    });
  };

  const handleAnalyzeConditions = useCallback(async (locationId: string, locationOverride?: string) => {
    if (!areApiKeysSet) {
      toast({
        title: 'API Key Required',
        description: 'Please set your Gemini API key in the settings.',
        variant: 'destructive',
      });
      setIsSettingsSheetOpen(true);
      return;
    }
    
    const locationToAnalyze = locationOverride || locations?.find(l => l.id === locationId)?.location;

    if (!locationToAnalyze || !locationToAnalyze.trim()) {
      toast({
        title: 'Location Required',
        description: 'Please enter a specific location before analyzing conditions.',
        variant: 'destructive',
      });
      return;
    }

    let effectiveKeys = apiKeys;
    if (!effectiveKeys?.gemini && !effectiveKeys?.groq && !effectiveKeys?.openrouter && !effectiveKeys?.ollamaUrl && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('grow_apiKeys');
        if (stored) {
          effectiveKeys = JSON.parse(stored);
        }
      } catch (e) {
        console.error('Failed reading keys from localStorage', e);
      }
    }

    const hasAnyKey = Boolean(
      effectiveKeys?.gemini ||
      effectiveKeys?.groq ||
      effectiveKeys?.openrouter ||
      effectiveKeys?.ollamaUrl
    );

    if (!hasAnyKey) {
      toast({
        title: 'AI Key Required',
        description: 'Please set a free Gemini, Groq, OpenRouter, or Local Ollama key in Settings before analyzing conditions.',
        variant: 'destructive',
      });
      setIsSettingsSheetOpen(true);
      return;
    }

    if (conditionAbortRef.current) {
      conditionAbortRef.current.abort();
    }
    const controller = new AbortController();
    conditionAbortRef.current = controller;

    setIsAnalyzing(locationId);
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    const promptData = { location: locationToAnalyze, currentMonth, apiKeys: effectiveKeys };

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI environmental analysis timed out after 90 seconds. Please try again.')), 90000)
      );

      const abortPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error('Conditions analysis was stopped by user.'));
        });
      });

      const result = await Promise.race([
        getEnvironmentalData(promptData),
        timeoutPromise,
        abortPromise
      ]);
      
      await db.locations.update(locationId, {
        conditions: {
            temperature: result.soilTemperature,
            sunlight: result.sunlightHours,
            soil: result.soilDescription,
            currentSeason: result.currentSeason,
        }
      });
      
      const newLog: AiLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        flow: 'getEnvironmentalData',
        prompt: promptData,
        results: result,
        model: (result as any)?._modelUsed || 'googleai/gemini-3.8-flash',
      };
      
      await db.aiLogs.add(newLog);

      toast({
        title: 'AI Analysis Complete',
        description: `Conditions for ${locationToAnalyze} have been populated.`,
      });
    } catch (error: any) {
        if (controller.signal.aborted || error?.message?.includes('stopped by user')) {
          toast({
            title: 'Analysis Stopped',
            description: `Conditions analysis for ${locationToAnalyze} was stopped.`,
          });
          return;
        }

        const errorLog: AiLog = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          flow: 'getEnvironmentalData',
          prompt: promptData,
          status: 'error',
          error: error.message || String(error),
          model: 'googleai/gemini-3.8-flash',
        };
        await db.aiLogs.add(errorLog);

        toast({
            title: 'AI Analysis Failed',
            description: (
                <div className="flex flex-col gap-2">
                    <p className="text-xs">Google Gemini analysis encountered an issue:</p>
                    <pre className="text-xs whitespace-pre-wrap p-2 bg-destructive/20 rounded-md max-h-36 overflow-y-auto font-mono">
                        {error.message}
                    </pre>
                    <div className="flex items-center gap-2 mt-1">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="text-xs h-7 px-2"
                        onClick={() => {
                          navigator.clipboard.writeText(error.message);
                          toast({ title: 'Copied error to clipboard' });
                        }}
                      >
                        Copy Error
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-7 px-2"
                        onClick={() => setIsLogPanelOpen(true)}
                      >
                        Open AI Log
                      </Button>
                    </div>
                </div>
            ),
            variant: 'destructive',
            duration: Infinity,
        });
    } finally {
      if (conditionAbortRef.current === controller) {
        conditionAbortRef.current = null;
      }
      setIsAnalyzing(null);
    }
  }, [areApiKeysSet, apiKeys, locations, toast]);

  const handleStopAnalyzeConditions = useCallback((_locationId?: string) => {
    if (conditionAbortRef.current) {
      conditionAbortRef.current.abort();
      conditionAbortRef.current = null;
    }
    setIsAnalyzing(null);
  }, []);

  const handleGetCurrentLocation = useCallback((locationId: string) => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation Not Supported',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          const locationName = data.address?.city || data.address?.town || data.display_name || 'Unknown Location';
          
          await db.locations.update(locationId, { location: locationName });
          handleAnalyzeConditions(locationId, locationName);

          toast({
            title: 'Location Found',
            description: `Set to ${locationName} and analyzed conditions.`,
          });
        } catch (error) {
          console.error("Error fetching location name:", error);
          await db.locations.update(locationId, { location: 'Current Location'});
          toast({
            title: 'Could Not Get Location Name',
            description: 'Location set to your current position.',
            variant: 'destructive',
          });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        toast({
          title: 'Geolocation Error',
          description: error.message,
          variant: 'destructive',
        });
        setIsLocating(false);
      }
    );
  }, [handleAnalyzeConditions, toast]);

  const handleConditionChange = useCallback((value: string, field: keyof Conditions, locationId: string) => {
    db.locations.get(locationId).then(location => {
      if (location) {
          const newConditions = { ...location.conditions, [field]: value };
          db.locations.update(locationId, { conditions: newConditions });
      }
    });
  }, []);
  
  const handleLocationFieldChange = useCallback((e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
    if (e.type === 'keydown' && (e as React.KeyboardEvent).key !== 'Enter') {
      return;
    }
    const target = e.currentTarget;
    const locationId = target.id.replace(/^(name|location|temperature|sunlight|soil|growing-systems|growing-methods)-/, '');
    const field = target.name as keyof GardenLocation | keyof Conditions;
    const value = target.value;
  
    db.locations.get(locationId).then(location => {
      if (!location) return;
  
      if (['name', 'location', 'growingSystems', 'growingMethods'].includes(field)) {
        const trimmedValue = value.trim();
        if (trimmedValue !== (location as any)[field]) {
          db.locations.update(locationId, { [field]: trimmedValue });
        }
      } else {
        const newConditions = { ...location.conditions, [field]: value };
        db.locations.update(locationId, { conditions: newConditions });
      }
    });
  }, []);
  
  const handleAddLocation = async (name: string) => {
    const newLocation: GardenLocation = {
      id: Date.now().toString(),
      name,
      location: '',
      temperatureUnit: 'F',
      conditions: {
        temperature: '',
        sunlight: '',
        soil: '',
        currentSeason: 'Spring',
      },
      growingSystems: '',
      growingMethods: '',
    };
    const newId = await db.locations.add(newLocation);
    if (gardenViewMode !== 'all') {
      setActiveLocationId(newId.toString());
    }
    setAccordionValue('item-1');
    setTimeout(() => {
      const locationInput = document.getElementById(`location-${newId}`);
      if (locationInput) {
        locationInput.focus();
      }
    }, 100);
  };
  
  const promptDelete = (item: GardenLocation | PlantingWithPlant) => {
    if ('conditions' in item) { // It's a GardenLocation
        setLocationToDelete(item);
    } else { // It's a PlantingWithPlant
        setPlantingToDelete(item);
    }
    setIsDeleteAlertOpen(true);
  };

  const handleDeleteLocation = async () => {
    if (!locationToDelete || !locations) return;

    const locationIdToDelete = locationToDelete.id;
    const locationName = locationToDelete.name;

    await db.locations.delete(locationIdToDelete);

    if (activeLocationId === locationIdToDelete) {
      const remainingLocations = locations.filter(loc => loc.id !== locationIdToDelete);
      if (remainingLocations.length > 0) {
        setActiveLocationId(remainingLocations[0].id);
      } else {
        setActiveLocationId(null);
      }
    }
    
    setSelectedGardenIds(ids => ids.filter(id => id !== locationIdToDelete));

    toast({
      title: 'Garden Deleted',
      description: `${locationName} has been deleted.`,
      variant: 'destructive',
    });

    setLocationToDelete(null);
    setIsDeleteAlertOpen(false);
  };
  
  const handleGetViability = async (planting: PlantingWithPlant) => {
    if (!areApiKeysSet) {
      toast({
        title: 'API Key Required',
        description: 'Please set your Gemini API key in Settings for AI-powered viability analysis.',
        variant: 'destructive',
      });
      setIsSettingsSheetOpen(true);
      return;
    }

    if (!activeLocation) return;

    if (singleViabilityAbortRef.current) {
      singleViabilityAbortRef.current.abort();
    }
    const controller = new AbortController();
    singleViabilityAbortRef.current = controller;

    const { id: viabilityToastId } = toast({
      title: 'Generating Viability Analysis...',
      description: (
        <div className="flex items-center justify-between gap-2">
          <span>Analyzing {planting.name} for your garden.</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
            onClick={() => {
              controller.abort();
              dismiss(viabilityToastId);
            }}
          >
            <Square className="h-3 w-3 fill-current mr-1" /> Stop
          </Button>
        </div>
      ),
      duration: 90000,
    });

    try {
      const promptData = {
          plant: {
              species: planting.plant.species,
              germinationNeeds: planting.plant.germinationNeeds,
              optimalConditions: planting.plant.optimalConditions,
          },
          garden: {
              conditions: {
                  ...activeLocation.conditions,
                  currentSeason: activeLocation.conditions.currentSeason || 'Not specified'
              },
              growingSystems: activeLocation.growingSystems,
              growingMethods: activeLocation.growingMethods,
          },
          apiKeys,
      };

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout analyzing ${planting.name} after 90 seconds`)), 90000)
      );

      const abortPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error('Viability analysis stopped by user.'));
        });
      });

      const result = await Promise.race([
        getAiViability(promptData),
        timeoutPromise,
        abortPromise
      ]);

      const logData = { 
        flow: 'getAiViability', 
        prompt: promptData, 
        results: result, 
        viabilityType: 'ai' as const,
        model: (result as any)?._modelUsed || 'googleai/gemini-3.8-flash',
      };
      const finalViability = result.viability;
      
      const newLog: AiLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        ...logData,
      };
      
      await db.aiLogs.add(newLog);

      if (finalViability) {
        const assessedAt = new Date().toISOString();
        const duplicatePlantings = plantingsWithPlants?.filter(
          p => p.gardenId === planting.gardenId && (
            p.id === planting.id ||
            p.plantId === planting.plantId ||
            (p.plant?.species && planting.plant?.species && p.plant.species === planting.plant.species)
          )
        ) || [planting];

        for (const p of duplicatePlantings) {
          await db.plantings.update(p.id, {
            viability: finalViability,
            viabilityReasoning: result.reasoning,
            viabilityAssessedAt: assessedAt,
            upcomingViability: result.upcomingViability,
            upcomingTiming: result.upcomingTiming,
            upcomingReasoning: result.upcomingReasoning,
          });
        }

        setViabilityData(prev => {
          const updated = { ...prev };
          duplicatePlantings.forEach(p => {
            updated[p.id] = finalViability;
          });
          return updated;
        });
      }

      dismiss(viabilityToastId);
      toast({
        title: 'Analysis Complete',
        description: `Analysis for ${planting.name} has been added to the AI Log.`,
      });
      setIsLogPanelOpen(true);

    } catch (error: any) {
      dismiss(viabilityToastId);
      if (controller.signal.aborted || error?.message?.includes('stopped by user')) {
        toast({
          title: 'Analysis Stopped',
          description: `Analysis for ${planting.name} was cancelled.`,
        });
        return;
      }

      const errorLog: AiLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        flow: 'getAiViability',
        prompt: { plant: planting.plant.species, garden: activeLocation.name },
        status: 'error',
        error: error.message || String(error),
        model: 'googleai/gemini-3.8-flash',
      };
      await db.aiLogs.add(errorLog);

      toast({
        title: 'Analysis Failed',
        description: (
            <div className="flex flex-col gap-2">
                <p className="text-xs">An error occurred during analysis:</p>
                <pre className="text-xs whitespace-pre-wrap p-2 bg-destructive/20 rounded-md max-h-36 overflow-y-auto font-mono">
                    {error.message}
                </pre>
                <div className="flex items-center gap-2 mt-1">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="text-xs h-7 px-2"
                    onClick={() => {
                      navigator.clipboard.writeText(error.message);
                      toast({ title: 'Copied error to clipboard' });
                    }}
                  >
                    Copy Error
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs h-7 px-2"
                    onClick={() => setIsLogPanelOpen(true)}
                  >
                    Open AI Log
                  </Button>
                </div>
            </div>
        ),
        variant: 'destructive',
        duration: Infinity,
      });
    } finally {
      if (singleViabilityAbortRef.current === controller) {
        singleViabilityAbortRef.current = null;
      }
    }
  };
  
  const handleMarkAsDuplicate = (planting: PlantingWithPlant) => {
    setDuplicateSelectionMode(planting);
  };

  const handleDuplicateSelection = async (plantingToModify: PlantingWithPlant) => {
    if (!duplicateSelectionMode) return;

    try {
      await db.plantings.update(plantingToModify.id, { plantId: duplicateSelectionMode.plantId });
      toast({
        title: 'Duplicate Marked',
        description: `"${plantingToModify.name}" is now marked as a duplicate of "${duplicateSelectionMode.name}".`,
      });
      setDuplicateSelectionMode(null);
      setIsDuplicateReviewSheetOpen(true);
    } catch (error) {
      console.error('Failed to mark as duplicate:', error);
      toast({
        title: 'Error',
        description: 'Could not mark planting as duplicate. See console for details.',
        variant: 'destructive',
      });
      setDuplicateSelectionMode(null);
    }
  };

  const handleQuickStatusChange = async (planting: PlantingWithPlant, newStatus: PlantStatus) => {
    const originalHistory = planting.history;

    const newHistoryEntry: StatusHistory = {
      id: `hist-${Date.now()}`,
      status: newStatus,
      date: new Date().toISOString(),
      notes: 'Status changed via Quick Change',
    };

    const newHistory = [...originalHistory, newHistoryEntry];

    try {
      await db.plantings.update(planting.id, { history: newHistory });

      if (newStatus === 'Harvest') {
        await publishCommunityViabilitySignal({
          species: planting.plant.species,
          region: activeLocation?.location || activeLocation?.name || 'Local Microclimate',
          season: activeLocation?.conditions?.currentSeason,
          soil: activeLocation?.conditions?.soil,
          verdict: 'harvest-verified',
          viability: 'High',
          notes: `Harvest verified for ${planting.name}`,
        });
      }

      const handleUndo = async () => {
        try {
          await db.plantings.update(planting.id, { history: originalHistory });
          toast({
            title: 'Undo Successful',
            description: `${planting.name}'s status has been reverted.`,
          });
        } catch (undoError) {
          toast({
            title: 'Undo Failed',
            description: 'Could not revert the change.',
            variant: 'destructive',
          });
        }
      };

      toast({
        title: 'Status Updated',
        description: `${planting.name} is now "${newStatus}".`,
        action: <ToastAction altText="Undo" onClick={handleUndo}>Undo</ToastAction>,
      });
    } catch (error) {
      console.error("Failed to update status:", error);
      toast({
        title: 'Update Failed',
        description: 'Could not change the planting status.',
        variant: 'destructive',
      });
    }
  };

  const effectivelySingleGardenView = useMemo(() => {
      if (gardenViewMode === 'one') return true;
      if (gardenViewMode === 'selected' && selectedGardenIds.length <= 1) return true;
      return false;
  }, [gardenViewMode, selectedGardenIds]);

  const plantingsWithPlants = useMemo((): PlantingWithPlant[] => {
    if (!plantings || !plants) return [];
    const plantMap = new Map(plants.map(p => [p.id, p]));
    
    let plantingsToDisplay = plantings;

    if (effectivelySingleGardenView) {
        plantingsToDisplay = plantings.filter(p => p.gardenId === activeLocationId);
    } else if (gardenViewMode === 'selected') {
        plantingsToDisplay = plantings.filter(p => selectedGardenIds.includes(p.gardenId));
    }

    return plantingsToDisplay
      .map(p => ({ ...p, plant: plantMap.get(p.plantId)!, garden: locations?.find(l => l.id === p.gardenId) }))
      .filter(p => p.plant);
  }, [plantings, plants, locations, gardenViewMode, selectedGardenIds, activeLocationId, effectivelySingleGardenView]);

  useEffect(() => {
    if (!plantingsWithPlants) return;

    const plantingsByPlantId = new Map<string, PlantingWithPlant[]>();
    plantingsWithPlants.forEach(p => {
        const existing = plantingsByPlantId.get(p.plantId) || [];
        plantingsByPlantId.set(p.plantId, [...existing, p]);
    });

    let found = false;
    for (const group of plantingsByPlantId.values()) {
        if (group.length > 1) {
            found = true;
            break;
        }
    }
    setHasDuplicates(found);
  }, [plantingsWithPlants]);
  
  const wishlistPlantings = useMemo(() => {
    if (!plantingsWithPlants) return [];
    return plantingsWithPlants.filter(p => p.history?.slice(-1)[0]?.status === 'Wishlist');
  }, [plantingsWithPlants]);

  const handleBatchAiViabilityAnalysis = useCallback(async (plantingsToAnalyze: PlantingWithPlant[]) => {
    if (!activeLocation?.conditions || plantingsToAnalyze.length === 0 || !areApiKeysSet) {
        return;
    }

    // Prevent duplicate concurrent batch runs
    if (isBatchRunningRef.current) {
        console.log('Batch AI viability analysis already in progress. Skipping duplicate run.');
        return;
    }
    isBatchRunningRef.current = true;

    if (batchViabilityAbortRef.current) {
      batchViabilityAbortRef.current.abort();
    }
    const controller = new AbortController();
    batchViabilityAbortRef.current = controller;

    const stopBatch = () => {
      controller.abort();
    };

    // Deduplicate plantings by unique plant identity (plantId or species/name)
    const plantGroupMap = new Map<string, PlantingWithPlant[]>();
    for (const p of plantingsToAnalyze) {
      const key = p.plantId || p.plant?.id || p.plant?.species || p.name || p.id;
      const group = plantGroupMap.get(key) || [];
      group.push(p);
      plantGroupMap.set(key, group);
    }

    const newViabilityData: Record<string, Viability> = {};
    let successfulAnalyses = 0;
    const groupsToAnalyze: { key: string; plantings: PlantingWithPlant[]; samplePlanting: PlantingWithPlant }[] = [];

    // Check if any duplicate group already has an existing assessment we can reuse
    for (const [key, group] of plantGroupMap.entries()) {
      const existing = group.find(p => p.viability && p.viabilityReasoning);
      if (existing?.viability && existing.viabilityReasoning) {
        for (const p of group) {
          if (!p.viability || !p.viabilityReasoning) {
            await db.plantings.update(p.id, {
              viability: existing.viability,
              viabilityReasoning: existing.viabilityReasoning,
              viabilityAssessedAt: existing.viabilityAssessedAt || new Date().toISOString(),
              upcomingViability: existing.upcomingViability,
              upcomingTiming: existing.upcomingTiming,
              upcomingReasoning: existing.upcomingReasoning,
            });
            newViabilityData[p.id] = existing.viability;
          }
        }
        setViabilityData(prev => {
          const updated = { ...prev };
          group.forEach(p => { updated[p.id] = existing.viability; });
          return updated;
        });
        successfulAnalyses += group.length;
      } else {
        groupsToAnalyze.push({ key, plantings: group, samplePlanting: group[0] });
      }
    }

    // If all plants in this batch already have assessments or were satisfied by duplicates, nothing to call
    if (groupsToAnalyze.length === 0) {
      isBatchRunningRef.current = false;
      return;
    }

    const totalUniquePlants = groupsToAnalyze.length;
    const totalPlantings = plantingsToAnalyze.length;

    const { id: toastId } = toast({
        title: 'Batch AI Viability Analysis',
        description: (
            <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span>Analyzing 0 of {totalUniquePlants} unique plant{totalUniquePlants > 1 ? 's' : ''} ({totalPlantings} plantings)...</span>
                    <Button 
                        variant="destructive" 
                        size="sm" 
                        className="h-6 px-2 text-xs flex items-center gap-1 font-medium"
                        onClick={() => {
                            stopBatch();
                            dismiss(toastId);
                        }}
                    >
                        <Square className="h-3 w-3 fill-current" /> Stop
                    </Button>
                </div>
                <Progress value={0} className="mt-1" />
            </div>
        ),
        duration: Infinity,
    });

    let completedCount = 0;
    let firstError: any = null;
    setAnalysisProgress(0);

    let effectiveKeys: FreeLlmConfig = { ...apiKeys };
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('grow_apiKeys');
        if (stored) effectiveKeys = { ...JSON.parse(stored), ...effectiveKeys };
      } catch (e) {}
    }

    try {
      for (let i = 0; i < groupsToAnalyze.length; i++) {
        if (controller.signal.aborted) {
          break;
        }

        const { plantings: group, samplePlanting } = groupsToAnalyze[i];

        try {
          const promptData = {
            plant: samplePlanting.plant,
          garden: {
            conditions: {
              ...activeLocation.conditions,
              currentSeason: activeLocation.conditions.currentSeason || 'Not specified'
            },
            growingSystems: activeLocation.growingSystems,
            growingMethods: activeLocation.growingMethods,
          },
          apiKeys: effectiveKeys,
        };

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout analyzing ${samplePlanting.name} after 90 seconds`)), 90000)
        );

        const abortPromise = new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Batch analysis cancelled by user'));
          });
        });

        const result = await Promise.race([
          getAiViability(promptData),
          timeoutPromise,
          abortPromise
        ]);

        if (result?.viability) {
          const assessedAt = new Date().toISOString();

          // Apply the AI viability result to ALL duplicate plantings in this group
          for (const planting of group) {
            await db.plantings.update(planting.id, {
              viability: result.viability,
              viabilityReasoning: result.reasoning,
              viabilityAssessedAt: assessedAt,
              upcomingViability: result.upcomingViability,
              upcomingTiming: result.upcomingTiming,
              upcomingReasoning: result.upcomingReasoning,
            });
            newViabilityData[planting.id] = result.viability;
          }

          const batchLog: AiLog = {
            id: `batch-${Date.now()}-${samplePlanting.id}`,
            timestamp: assessedAt,
            flow: 'getAiViability',
            prompt: promptData,
            results: result,
            viabilityType: 'ai' as const,
            model: (result as any)?._modelUsed || 'googleai/gemini-3.8-flash',
          };
          await db.aiLogs.add(batchLog);

          setViabilityData(prev => {
            const updated = { ...prev };
            group.forEach(p => { updated[p.id] = result.viability; });
            return updated;
          });
          successfulAnalyses += group.length;
        }
      } catch (error: any) {
        if (controller.signal.aborted) {
          break;
        }
        console.error(`AI analysis failed for ${samplePlanting.name}:`, error);
        if (!firstError) firstError = error;
      } finally {
        completedCount++;
        const progress = (completedCount / groupsToAnalyze.length) * 100;
        setAnalysisProgress(progress);

        if (!controller.signal.aborted) {
          (toast as any)({
            id: toastId,
            title: 'Batch AI Viability Analysis',
            description: (
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>{completedCount} of {totalUniquePlants} unique plants analyzed ({successfulAnalyses} plantings updated)</span>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-6 px-2 text-xs flex items-center gap-1 font-medium"
                    onClick={() => {
                      stopBatch();
                      dismiss(toastId);
                    }}
                  >
                    <Square className="h-3 w-3 fill-current" /> Stop
                  </Button>
                </div>
                <Progress value={progress} className="mt-1" />
              </div>
            ),
            duration: Infinity,
          });
        }
      }
    }
  } finally {
    dismiss(toastId);
    isBatchRunningRef.current = false;
    if (batchViabilityAbortRef.current === controller) {
      batchViabilityAbortRef.current = null;
    }
  }

    if (controller.signal.aborted) {
      toast({
        title: 'Batch Analysis Stopped',
        description: `Stopped by user. Analyzed ${successfulAnalyses} of ${plantingsToAnalyze.length} plants.`,
      });
    } else if (successfulAnalyses < plantingsToAnalyze.length && firstError) {
      toast({
        title: 'Batch Analysis Partially Failed',
        description: (
          <div className="flex flex-col gap-2">
            <p>Analyzed {successfulAnalyses} of {plantingsToAnalyze.length} plants. An error occurred:</p>
            <pre className="text-xs whitespace-pre-wrap p-2 bg-destructive/20 rounded-md">
              {firstError.message}
            </pre>
          </div>
        ),
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Batch Analysis Complete',
        description: `Analyzed ${successfulAnalyses} out of ${plantingsToAnalyze.length} plantings across ${totalUniquePlants} unique plant species.`,
      });
    }
  }, [activeLocation, apiKeys, areApiKeysSet, toast, dismiss]);

  useEffect(() => {
    if (!areApiKeysSet || !plantingsWithPlants || !activeLocation?.conditions) {
      return;
    }

    const conditionsSignature = JSON.stringify({
      conditions: activeLocation.conditions,
      growingSystems: activeLocation.growingSystems,
      growingMethods: activeLocation.growingMethods,
      gardenId: activeLocationId,
    });

    const isInitialMount = lastAnalyzedConditionsRef.current === null;
    const conditionsChanged = !isInitialMount && lastAnalyzedConditionsRef.current !== conditionsSignature;

    if (isInitialMount) {
      lastAnalyzedConditionsRef.current = conditionsSignature;
      // On initial load, only run for plantings that have NEVER been analyzed yet (missing viability)
      const unanalyzedPlantings = plantingsWithPlants.filter(
        p => p.gardenId === activeLocationId && !p.viability
      );
      if (unanalyzedPlantings.length > 0 && !isBatchRunningRef.current) {
        handleBatchAiViabilityAnalysis(unanalyzedPlantings);
      }
    } else if (conditionsChanged) {
      lastAnalyzedConditionsRef.current = conditionsSignature;
      // When garden conditions genuinely change, re-analyze plantings for this garden
      const plantingsToAnalyze = plantingsWithPlants.filter(p => p.gardenId === activeLocationId);
      if (plantingsToAnalyze.length > 0 && !isBatchRunningRef.current) {
        handleBatchAiViabilityAnalysis(plantingsToAnalyze);
      }
    }
  }, [
    activeLocationId,
    activeLocation,
    areApiKeysSet,
    handleBatchAiViabilityAnalysis,
    plantingsWithPlants
  ]);

    const currentViabilityData = useMemo(() => {
        const map: Record<string, Viability | undefined> = { ...viabilityData };
        plantingsWithPlants?.forEach(p => {
            if (p.viability && !map[p.id]) {
                map[p.id] = p.viability;
            }
        });
        return map;
    }, [plantingsWithPlants, viabilityData]);

    const currentReasoningData = useMemo(() => {
        const map: Record<string, string | undefined> = {};
        plantingsWithPlants?.forEach(p => {
            if (p.viabilityReasoning) {
                map[p.id] = p.viabilityReasoning;
            }
        });
        return map;
    }, [plantingsWithPlants]);

    const currentUpcomingData = useMemo(() => {
        const map: Record<string, { upcomingViability?: 'High' | 'Medium'; upcomingTiming?: string; upcomingReasoning?: string }> = {};
        plantingsWithPlants?.forEach(p => {
            if (p.upcomingViability) {
                map[p.id] = {
                    upcomingViability: p.upcomingViability,
                    upcomingTiming: p.upcomingTiming,
                    upcomingReasoning: p.upcomingReasoning,
                };
            } else {
                const currentV = p.viability || currentViabilityData[p.id];
                map[p.id] = getUpcomingViability(p.plant, activeLocation?.conditions, currentV);
            }
        });
        return map;
    }, [plantingsWithPlants, currentViabilityData, activeLocation?.conditions]);

  const sortedAndFilteredPlantings = useMemo(() => {
    if (!plantingsWithPlants) return [];

    const getStatus = (p: Planting) => p.history && p.history.length > 0 ? p.history[p.history.length - 1].status : null;

    const filtered = statusFilter === 'All'
        ? plantingsWithPlants 
        : plantingsWithPlants.filter(p => getStatus(p) === statusFilter);

    if (activeLocation?.conditions) {
        const viabilityOrder: Record<Viability, number> = { 'High': 0, 'Medium': 1, 'Low': 2 };
        
        return filtered.slice().sort((a, b) => {
            const viabilityA = currentViabilityData[a.id] || 'Low';
            const viabilityB = currentViabilityData[b.id] || 'Low';
            return viabilityOrder[viabilityA] - viabilityOrder[viabilityB];
        });
    }
    
    return filtered;
  }, [plantingsWithPlants, statusFilter, activeLocation?.conditions, currentViabilityData]);
  

  const organizedWishlist = useMemo(() => {
    if (!wishlistPlantings || !activeLocation?.conditions) return null;

    const getBestPlantSeason = (plant: Plant): string => {
        const suitableSeasons = getSuitableSeasons(plant);
        if (suitableSeasons.length === 4 && activeLocation.conditions.currentSeason) {
            return activeLocation.conditions.currentSeason;
        }
        if (suitableSeasons.length === 0) return 'Season Not Specified';

        const seasonOrder = ['Spring', 'Summer', 'Autumn', 'Winter'];
        const currentSeason = activeLocation.conditions.currentSeason;
        const currentSeasonIndex = currentSeason ? seasonOrder.indexOf(currentSeason) : -1;

        if (currentSeasonIndex === -1) return suitableSeasons[0];

        for (let i = 0; i < seasonOrder.length; i++) {
            const seasonIndex = (currentSeasonIndex + i) % seasonOrder.length;
            const season = seasonOrder[seasonIndex];
            if (suitableSeasons.includes(season)) {
                return season;
            }
        }
        return 'Season Not Specified';
    };

    const viabilityOrder: Record<Viability, number> = { 'High': 0, 'Medium': 1, 'Low': 2 };
    const seasonOrder = ['Spring', 'Summer', 'Autumn', 'Winter', 'Season Not Specified'];
    const currentSeason = activeLocation.conditions.currentSeason;
    const currentSeasonIndex = currentSeason ? seasonOrder.indexOf(currentSeason) : 0;

    const getSeasonScore = (season: string) => {
        const seasonIndex = seasonOrder.indexOf(season);
        if (seasonIndex === -1 || season === 'Season Not Specified') return 4;
        return (seasonIndex - currentSeasonIndex + seasonOrder.length) % seasonOrder.length;
    };

    wishlistPlantings.sort((a, b) => {
        const seasonA = getBestPlantSeason(a.plant);
        const seasonB = getBestPlantSeason(b.plant);
        const seasonScoreA = getSeasonScore(seasonA);
        const seasonScoreB = getSeasonScore(seasonB);

        if (seasonScoreA !== seasonScoreB) {
            return seasonScoreA - seasonScoreB;
        }
        
        const viabilityA = currentViabilityData[a.id] || 'Low';
        const viabilityB = currentViabilityData[b.id] || 'Low';
        return viabilityOrder[viabilityA] - viabilityOrder[viabilityB];
    });

    const groupedBySeason: { [season: string]: PlantingWithPlant[] } = {};
    wishlistPlantings.forEach(p => {
        const bestSeason = getBestPlantSeason(p.plant);
        if (!groupedBySeason[bestSeason]) {
            groupedBySeason[bestSeason] = [];
        }
        groupedBySeason[bestSeason].push(p);
    });

    const orderedGroupNames = Object.keys(groupedBySeason).sort((a, b) => {
        return getSeasonScore(a) - getSeasonScore(b);
    });

    return orderedGroupNames.map(seasonName => {
        let groupTitle = seasonName;
        if (seasonName === activeLocation.conditions.currentSeason) {
            groupTitle = `Current Season: ${seasonName}`;
        }
        if (seasonName === 'Season Not Specified') {
            groupTitle = 'Season Not Specified';
        }
        return {
            groupTitle: groupTitle,
            plantings: groupedBySeason[seasonName]
        };
    });

}, [wishlistPlantings, activeLocation?.conditions, currentViabilityData]);

const sortedWishlistByViability = useMemo(() => {
    if (!wishlistPlantings || !activeLocation?.conditions) return [];
    const viabilityOrder: Record<Viability, number> = { 'High': 0, 'Medium': 1, 'Low': 2 };
    return [...wishlistPlantings].sort((a, b) => {
        const viabilityA = currentViabilityData[a.id] || 'Low';
        const viabilityB = currentViabilityData[b.id] || 'Low';
        return viabilityOrder[viabilityA] - viabilityOrder[viabilityB];
    });
}, [wishlistPlantings, activeLocation?.conditions, currentViabilityData]);

const unspecifiedSeasonCount = useMemo(() => {
    if (wishlistSortOrder !== 'season' || !organizedWishlist) return 0;
    const unspecifiedGroup = organizedWishlist.find(g => g.groupTitle === 'Season Not Specified');
    return unspecifiedGroup ? unspecifiedGroup.plantings.length : 0;
}, [organizedWishlist, wishlistSortOrder]);

  const plantingsInPlantingStatus = useMemo(() => {
      if (!plantingsWithPlants) return [];
      return plantingsWithPlants.filter(p => p.history && p.history.length > 0 && p.history[p.history.length-1].status === 'Planting');
  }, [plantingsWithPlants]);
  
  const plantingDashboardPlantings = useMemo(() => {
    if (!plantingsWithPlants) return [];
    return plantingsWithPlants.filter(p => p.history && p.history.length > 0 && ['Wishlist', 'Harvest'].includes(p.history[p.history.length-1].status));
  }, [plantingsWithPlants]);

  const statusCounts = useMemo(() => {
    const counts: { [key in PlantStatus | 'All']: number } = {
        All: 0, Wishlist: 0, Planting: 0, Growing: 0, Harvest: 0
    };
    if (!plantingsWithPlants) return counts;
    counts.All = plantingsWithPlants.length;
    plantingsWithPlants.forEach(p => {
        if (p.history && p.history.length > 0) {
            const lastStatus = p.history[p.history.length - 1].status;
            counts[lastStatus]++;
        }
    });
    return counts;
  }, [plantingsWithPlants]);

    const viabilityCounts = useMemo(() => {
        const counts: Record<Viability, number> = { High: 0, Medium: 0, Low: 0 };
        
        plantingsWithPlants?.forEach(p => {
            const viability = p.viability || currentViabilityData[p.id];
            if (viability && counts[viability] !== undefined) {
              counts[viability]++;
            }
        });

        return counts;
    }, [plantingsWithPlants, currentViabilityData]);

    const totalAnalyzedCount = useMemo(() => {
        return viabilityCounts.High + viabilityCounts.Medium + viabilityCounts.Low;
    }, [viabilityCounts]);

  const allFilters: (PlantStatus | 'All')[] = ['All', 'Wishlist', 'Planting', 'Growing', 'Harvest'];

  const selectedLocations = useMemo(() => {
      if (!locations) return [];
      if (effectivelySingleGardenView) return activeLocation ? [activeLocation] : [];
      if (gardenViewMode === 'all') return locations;
      return locations.filter(loc => selectedGardenIds.includes(loc.id));
  }, [locations, selectedGardenIds, gardenViewMode, activeLocation, effectivelySingleGardenView]);

  const locationSwitcherTriggerText = useMemo(() => {
    if (effectivelySingleGardenView) {
       return activeLocation?.name || 'Select Garden';
    }
    if (gardenViewMode === 'selected') {
        if (locations && selectedGardenIds.length === locations.length) return 'All Gardens';
        if (selectedGardenIds.length > 1) return `${selectedGardenIds.length} Gardens Selected`;
        return `${selectedGardenIds.length} Garden Selected`;
    }
    if (gardenViewMode === 'all') return 'All Gardens';
    return activeLocation?.name || 'Select Garden';
}, [gardenViewMode, activeLocation, selectedGardenIds, locations, effectivelySingleGardenView]);

const mainAddButtonDefaultStatus = useMemo(() => {
    if (statusFilter === 'Planting' || statusFilter === 'Growing' || statusFilter === 'Harvest') {
        return 'Planting';
    }
    return 'Wishlist';
}, [statusFilter]);

  if (!isClient) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <main className="flex-1">
        <div className="container mx-auto p-4 md:p-8">
            {duplicateSelectionMode && (
                 <Card className="mb-6 bg-blue-900/20 border-blue-500">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Info className="h-5 w-5 text-blue-400" />
                            <p className="text-sm font-medium">
                                Select a plant to mark as a duplicate of <span className="font-bold text-white">{duplicateSelectionMode.name}</span>.
                            </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setDuplicateSelectionMode(null)}>
                            <X className="h-5 w-5" />
                        </Button>
                    </CardContent>
                </Card>
            )}
          <div>
            <div className="flex items-center gap-2 mb-4 md:hidden">
                <Button onClick={() => handleOpenAddSheet(mainAddButtonDefaultStatus)} className="flex-1">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Plant
                </Button>
                <Button variant="outline" size="icon" onClick={() => setIsSettingsSheetOpen(true)} className="h-10 w-10 flex-shrink-0">
                  <Settings className="h-4 w-4" />
                  <span className="sr-only">Settings</span>
                </Button>
            </div>

            {(!activeLocation && locations && locations.length === 0) ? (
              <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
                <CardHeader>
                  <CardTitle className="font-headline">Welcome to grow</CardTitle>
                  <CardDescription>
                    Create a garden or import a starter dataset to find plants you can grow.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={() => handleAddLocation('My First Garden')}>
                    <Plus className="mr-2 h-4 w-4" /> Add Your First Garden
                  </Button>
                  <Button variant="secondary" onClick={() => handleOpenAddSheet(undefined, 'import-pack')}>
                    <Upload className="mr-2 h-4 w-4" /> Import Starter Dataset
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Accordion type="single" collapsible className="w-full mb-6 bg-muted/50 rounded-lg" value={accordionValue} onValueChange={setAccordionValue}>
                  <AccordionItem value="item-1" className="border-0">
                      <div className="flex flex-col md:flex-row items-center justify-between w-full px-4 py-3 gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
                               <div onClick={(e) => e.stopPropagation()}>
                                  <LocationSwitcher 
                                    locations={locations || []}
                                    activeLocationId={activeLocationId}
                                    onLocationChange={(id) => {
                                        setActiveLocationId(id);
                                        if (gardenViewMode === 'selected' && selectedGardenIds.length > 1) {
                                            setSelectedGardenIds([id]);
                                        }
                                    }}
                                    onAddLocation={handleAddLocation}
                                    onDeleteLocation={(loc) => promptDelete(loc)}
                                    gardenViewMode={gardenViewMode}
                                    onGardenViewModeChange={setGardenViewMode}
                                    selectedGardenIds={selectedGardenIds}
                                    onSelectedGardenIdsChange={setSelectedGardenIds}
                                    triggerText={locationSwitcherTriggerText}
                                    onEditLocation={() => setIsGardenEditSheetOpen(true)}
                                  />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div
                                  className="p-0 hover:no-underline justify-start gap-2 w-full flex items-center text-left cursor-pointer"
                                  onClick={() => {
                                      const isMobile = window.innerWidth < 768; // md breakpoint
                                      if (isMobile) {
                                        setIsGardenEditSheetOpen(true);
                                      } else {
                                        setAccordionValue(accordionValue === 'item-1' ? '' : 'item-1');
                                      }
                                  }}
                                >
                                  {effectivelySingleGardenView && activeLocation ? (
                                      <span className='text-sm text-muted-foreground font-normal truncate'>
                                          {activeLocation.conditions.temperature || 'Temp'}, {activeLocation.conditions.sunlight || 'Sunlight'}, {activeLocation.conditions.soil || 'Soil'}
                                      </span>
                                  ) : (
                                      <div className="flex flex-col items-start text-sm text-muted-foreground font-normal">
                                          {selectedLocations.map((loc, index) => (
                                              <React.Fragment key={loc.id}>
                                                  <div className="truncate">
                                                      <span className="font-semibold">{loc.name}:</span> {loc.conditions.temperature || 'N/A'}
                                                  </div>
                                                  {index < selectedLocations.length - 1 && <hr className="w-full border-t border-border my-1" />}
                                              </React.Fragment>
                                          ))}
                                      </div>
                                  )}
                                  <AccordionTrigger className="p-0 hover:no-underline md:flex hidden" />
                                </div>
                              </div>
                          </div>
                          
                          <div className="hidden md:flex items-center gap-2 pl-0 md:pl-4">
                             <Button onClick={() => handleOpenAddSheet(mainAddButtonDefaultStatus)}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add Plant
                              </Button>
                              <Button variant="outline" size="icon" onClick={() => setIsSettingsSheetOpen(true)} className="h-10 w-10 flex-shrink-0">
                                <Settings className="h-4 w-4" />
                                <span className="sr-only">Settings</span>
                              </Button>
                          </div>
                      </div>

                      <AccordionContent className="p-6 pt-2 space-y-6 hidden md:block">
                        {selectedLocations.map(loc => (
                          <GardenEditor
                            key={loc.id}
                            loc={loc}
                            handleLocationFieldChange={handleLocationFieldChange}
                            handleConditionChange={handleConditionChange}
                            handleGetCurrentLocation={handleGetCurrentLocation}
                            isLocating={isLocating}
                            handleAnalyzeConditions={handleAnalyzeConditions}
                            handleStopAnalyzeConditions={handleStopAnalyzeConditions}
                            isAnalyzing={isAnalyzing}
                          />
                        ))}
                      </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <ExtensionSlotBar
                  plants={plants || []}
                  plantings={plantingsWithPlants || []}
                  activeLocation={activeLocation}
                  conditions={activeLocation?.conditions}
                />
                
                <div className="mb-4 flex items-center gap-4">
                  <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-2">
                        {allFilters.map((status) => {
                           if (status === 'All') {
                            return (
                               <div
                                key={status}
                                className={cn(
                                  buttonVariants({
                                    variant: statusFilter === status ? 'default' : 'outline',
                                    size: 'sm'
                                  }),
                                  'h-8 flex-shrink-0 cursor-pointer flex items-center gap-2 p-0 relative'
                                )}
                                onClick={() => setStatusFilter(status)}
                              >
                                <div className="pl-3 pr-1.5 h-full flex items-center font-medium">All ({statusCounts.All})</div>
                                <div className="flex items-center gap-1 pr-2">
                                    {viabilityCounts.High > 0 && <Badge className="bg-green-600 hover:bg-green-600 text-white px-1.5 py-0.5 text-xs font-mono">{viabilityCounts.High} High</Badge>}
                                    {viabilityCounts.Medium > 0 && <Badge className="bg-yellow-500 hover:bg-yellow-500 text-black px-1.5 py-0.5 text-xs font-mono">{viabilityCounts.Medium} Med</Badge>}
                                    {viabilityCounts.Low > 0 && <Badge className="bg-red-600 hover:bg-red-600 text-white px-1.5 py-0.5 text-xs font-mono">{viabilityCounts.Low} Low</Badge>}
                                    {statusCounts.All > totalAnalyzedCount && (
                                      <Badge variant="outline" className="text-muted-foreground px-1.5 py-0.5 text-xs font-mono" title={`${statusCounts.All - totalAnalyzedCount} plants pending AI viability analysis`}>
                                        {statusCounts.All - totalAnalyzedCount} pending
                                      </Badge>
                                    )}
                                </div>
                                {hasDuplicates && (
                                    <Button
                                    variant="destructive"
                                    className="h-6 w-6 p-0 mr-1 self-center"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsDuplicateReviewSheetOpen(true);
                                    }}
                                    >
                                    <span className="font-bold text-lg">!</span>
                                    </Button>
                                )}
                              </div>
                            );
                          }
                          if (status === 'Planting') {
                              return (
                                <Button
                                    key={status}
                                    variant={statusFilter === status ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setStatusFilter(status)}
                                    className="h-8 flex-shrink-0"
                                >
                                    {status}
                                    <Badge variant="secondary" className={cn("ml-2 rounded-full px-1.5 py-0.5 text-xs font-mono")}>
                                      {statusCounts.Planting}
                                    </Badge>
                                </Button>
                              )
                          }
                          return (
                            <Button
                                key={status}
                                variant={statusFilter === status ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setStatusFilter(status)}
                                className="h-8 flex-shrink-0"
                            >
                                {status}
                                <Badge variant="secondary" className={cn("ml-2 rounded-full px-1.5 py-0.5 text-xs font-mono")}>
                                    {statusCounts[status]}
                                </Badge>
                            </Button>
                        )})}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
                
                {plantings && plantings.length > 0 ? (
                    <>
                      {statusFilter === 'Wishlist' ? (
                          wishlistPlantings.length > 0 ? (
                            <>
                              <div className="flex justify-end items-center mb-4">
                                  <div className="flex items-center gap-4">
                                      {unspecifiedSeasonCount > 0 && (
                                          <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 gap-2 text-muted-foreground"
                                              onClick={() => {
                                                  setWishlistSortOrder('season');
                                                  setTimeout(() => {
                                                      unspecifiedSeasonSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
                                                  }, 100);
                                              }}
                                          >
                                              <AlertCircle className="h-4 w-4" />
                                              <span className="font-mono">{unspecifiedSeasonCount}</span>
                                          </Button>
                                      )}
                                      <div className="flex items-center gap-2">
                                          <Button
                                              size="sm"
                                              variant={wishlistSortOrder === 'season' ? 'default' : 'outline'}
                                              onClick={() => setWishlistSortOrder('season')}
                                              className="h-8"
                                          >
                                              Season
                                          </Button>
                                          <Button
                                              size="sm"
                                              variant={wishlistSortOrder === 'viability' ? 'default' : 'outline'}
                                              onClick={() => setWishlistSortOrder('viability')}
                                              className="h-8"
                                          >
                                              Viability
                                          </Button>
                                      </div>
                                  </div>
                              </div>
                              {wishlistSortOrder === 'viability' ? (
                                  <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                      {sortedWishlistByViability.map(p => (
                                        <div key={p.id} role="button" onClick={() => handleEditPlanting(p)} onKeyDown={(e) => e.key === 'Enter' && handleEditPlanting(p)} tabIndex={0} className="focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
                                          <PlantCard
                                              planting={p}
                                              viability={p.viability || currentViabilityData[p.id]}
                                              viabilityReasoning={p.viabilityReasoning || currentReasoningData[p.id]}
                                              upcomingViability={currentUpcomingData[p.id]?.upcomingViability || p.upcomingViability}
                                              upcomingTiming={currentUpcomingData[p.id]?.upcomingTiming || p.upcomingTiming}
                                              upcomingReasoning={currentUpcomingData[p.id]?.upcomingReasoning || p.upcomingReasoning}
                                              currentSeason={activeLocation?.conditions?.currentSeason}
                                              onEdit={() => handleEditPlanting(p)}
                                              onDelete={() => promptDelete(p)}
                                              onMarkAsDuplicate={() => handleMarkAsDuplicate(p)}
                                              onQuickStatusChange={(newStatus) => handleQuickStatusChange(p, newStatus)}
                                              isDuplicateSource={duplicateSelectionMode?.id === p.id}
                                              isSelectionMode={!!duplicateSelectionMode}
                                              onSelectDuplicate={() => handleDuplicateSelection(p)}
                                              onGetViability={() => handleGetViability(p)}
                                              showGardenLabel={!effectivelySingleGardenView}
                                          />
                                        </div>
                                      ))}
                                  </div>
                              ) : (
                                <div className="space-y-8">
                                    {organizedWishlist && organizedWishlist.map((group) => (
                                        <section 
                                          key={group.groupTitle}
                                          ref={group.groupTitle === 'Season Not Specified' ? unspecifiedSeasonSectionRef : null}
                                        >
                                            <div className="flex justify-between items-center mb-4 sticky top-0 bg-background py-2 z-10">
                                              <h2 className="text-2xl font-headline capitalize">
                                                  {group.groupTitle.toLowerCase()}
                                              </h2>
                                            </div>
                                            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                                {group.plantings.map(p => (
                                                  <div key={p.id} role="button" onClick={() => handleEditPlanting(p)} onKeyDown={(e) => e.key === 'Enter' && handleEditPlanting(p)} tabIndex={0} className="focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
                                                    <PlantCard
                                                        planting={p}
                                                        viability={p.viability || currentViabilityData[p.id]}
                                               viabilityReasoning={p.viabilityReasoning || currentReasoningData[p.id]}
                                                        upcomingViability={currentUpcomingData[p.id]?.upcomingViability || p.upcomingViability}
                                                        upcomingTiming={currentUpcomingData[p.id]?.upcomingTiming || p.upcomingTiming}
                                                        upcomingReasoning={currentUpcomingData[p.id]?.upcomingReasoning || p.upcomingReasoning}
                                                        currentSeason={activeLocation?.conditions?.currentSeason}
                                                        onEdit={() => handleEditPlanting(p)}
                                                        onDelete={() => promptDelete(p)}
                                                        onMarkAsDuplicate={() => handleMarkAsDuplicate(p)}
                                                        onQuickStatusChange={(newStatus) => handleQuickStatusChange(p, newStatus)}
                                                        isDuplicateSource={duplicateSelectionMode?.id === p.id}
                                                        isSelectionMode={!!duplicateSelectionMode}
                                                        onSelectDuplicate={() => handleDuplicateSelection(p)}
                                                        onGetViability={() => handleGetViability(p)}
                                                        showGardenLabel={!effectivelySingleGardenView}
                                                    />
                                                  </div>
                                                ))}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                              )}
                            </>
                          ) : (
                              <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
                                  <CardHeader>
                                      <CardTitle className="font-headline">No Wishlist Items</CardTitle>
                                      <CardDescription>
                                          Add some plants to your wishlist to get started.
                                      </CardDescription>
                                  </CardHeader>
                              </Card>
                          )
                      ) : statusFilter === 'Planting' ? (
                          <div className="space-y-8">
                              {plantingsInPlantingStatus.length > 0 && (
                                <div>
                                    <h2 className="text-2xl font-headline mb-4">Currently Planting</h2>
                                    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {plantingsInPlantingStatus.map(p => (
                                            <div key={p.id} role="button" onClick={() => handleEditPlanting(p)} onKeyDown={(e) => e.key === 'Enter' && handleEditPlanting(p)} tabIndex={0} className="focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
                                              <PlantCard 
                                                  planting={p} 
                                                  viability={p.viability || currentViabilityData[p.id]}
                                               viabilityReasoning={p.viabilityReasoning || currentReasoningData[p.id]}
                                                  upcomingViability={currentUpcomingData[p.id]?.upcomingViability || p.upcomingViability}
                                                  upcomingTiming={currentUpcomingData[p.id]?.upcomingTiming || p.upcomingTiming}
                                                  upcomingReasoning={currentUpcomingData[p.id]?.upcomingReasoning || p.upcomingReasoning}
                                                  currentSeason={activeLocation?.conditions?.currentSeason}
                                                  onEdit={() => handleEditPlanting(p)}
                                                  onDelete={() => promptDelete(p)}
                                                  onMarkAsDuplicate={() => handleMarkAsDuplicate(p)}
                                                  onQuickStatusChange={(newStatus) => handleQuickStatusChange(p, newStatus)}
                                                  isDuplicateSource={duplicateSelectionMode?.id === p.id}
                                                  isSelectionMode={!!duplicateSelectionMode}
                                                  onSelectDuplicate={() => handleDuplicateSelection(p)}
                                                  onGetViability={() => handleGetViability(p)}
                                                  showGardenLabel={!effectivelySingleGardenView}
                                              />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                              )}
                              <PlantingDashboard
                                  plantings={plantingDashboardPlantings}
                                  viabilityData={currentViabilityData}
                                   reasoningData={currentReasoningData}
                                  upcomingData={currentUpcomingData}
                                  gardenConditions={activeLocation?.conditions}
                                  onOpenAddSheet={() => handleOpenAddSheet('Planting', 'single')}
                                  onOpenSettings={() => handleOpenAddSheet('Planting', 'import-pack')}
                                  onQuickStatusChange={handleQuickStatusChange}
                              />
                          </div>
                      ) : (
                          sortedAndFilteredPlantings.length > 0 ? (
                              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                  {sortedAndFilteredPlantings.map(p => (
                                      <div key={p.id} role="button" onClick={() => handleEditPlanting(p)} onKeyDown={(e) => e.key === 'Enter' && handleEditPlanting(p)} tabIndex={0} className="focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
                                        <PlantCard 
                                            planting={p} 
                                            viability={p.viability || currentViabilityData[p.id]}
                                            viabilityReasoning={p.viabilityReasoning || currentReasoningData[p.id]}
                                            upcomingViability={currentUpcomingData[p.id]?.upcomingViability || p.upcomingViability}
                                            upcomingTiming={currentUpcomingData[p.id]?.upcomingTiming || p.upcomingTiming}
                                            upcomingReasoning={currentUpcomingData[p.id]?.upcomingReasoning || p.upcomingReasoning}
                                            currentSeason={activeLocation?.conditions?.currentSeason}
                                            onEdit={() => handleEditPlanting(p)}
                                            onDelete={() => promptDelete(p)}
                                            onMarkAsDuplicate={() => handleMarkAsDuplicate(p)}
                                            onQuickStatusChange={(newStatus) => handleQuickStatusChange(p, newStatus)}
                                            isDuplicateSource={duplicateSelectionMode?.id === p.id}
                                            isSelectionMode={!!duplicateSelectionMode}
                                            onSelectDuplicate={() => handleDuplicateSelection(p)}
                                            onGetViability={() => handleGetViability(p)}
                                            showGardenLabel={!effectivelySingleGardenView}
                                        />
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
                                  <CardHeader>
                                      <CardTitle className="font-headline">No Plants Found</CardTitle>
                                      <CardDescription>
                                          No plants with the status "{statusFilter}".
                                      </CardDescription>
                                  </CardHeader>
                              </Card>
                          )
                      )}
                    </>
                ) : (
                  <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
                    <CardHeader>
                      <CardTitle className="font-headline">Your Garden is Empty</CardTitle>
                      <CardDescription>
                        Add a plant or import a sample dataset to get started.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                       <Button onClick={() => handleOpenAddSheet(undefined, 'single')} className="w-full">
                         <Plus className="mr-2 h-4 w-4" /> Add Your First Plant
                      </Button>
                       <Button onClick={() => handleOpenAddSheet(undefined, 'import-pack')} variant="secondary" className="w-full">
                         <Upload className="mr-2 h-4 w-4" /> Import Datasets
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </main>

       <footer className="w-full py-6">
          <div className="container mx-auto text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Rocket className="h-4 w-4" />
            <a href={vercelDeployUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
              Host your own copy of this software for free
            </a>
          </div>
        </footer>

      {(aiLogs && aiLogs.length > 0 || areApiKeysSet) && (
        <div className="fixed bottom-4 right-4 z-20">
          <Button
            size="icon"
            onClick={() => setIsLogPanelOpen(true)}
            aria-label="Open AI Log"
          >
            <NotebookText />
          </Button>
        </div>
      )}
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            {locationToDelete && (
                <AlertDialogDescription>
                    This will permanently delete "{locationToDelete.name}" and all of its associated data. This action cannot be undone.
                </AlertDialogDescription>
            )}
            {plantingToDelete && (
                 <AlertDialogDescription>
                    This will permanently delete the plant "{plantingToDelete.name}". This action cannot be undone.
                </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
                setIsDeleteAlertOpen(false);
                setLocationToDelete(null);
                setPlantingToDelete(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={locationToDelete ? handleDeleteLocation : handleDeletePlanting}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AiLogPanel 
        logs={aiLogs || []}
        isOpen={isLogPanelOpen}
        onOpenChange={setIsLogPanelOpen}
        onOpenSettings={() => setIsSettingsSheetOpen(true)}
        areApiKeysSet={areApiKeysSet}
      />

      <SettingsSheet 
        isOpen={isSettingsSheetOpen}
        onOpenChange={setIsSettingsSheetOpen}
        onImport={handleImport}
        onAiImportOpen={() => {
            setPlantingToEdit(null);
            setPreloadedDatasetForReview(null);
            setUnifiedImportTab('ai-generate');
            setIsSettingsSheetOpen(false);
            setIsAiImportSheetOpen(true);
        }}
        onOpenDatasetReview={(dataset, title) => {
            setPlantingToEdit(null);
            setPreloadedDatasetForReview({ data: dataset, title });
            setUnifiedImportTab('import-pack');
            setIsSettingsSheetOpen(false);
            setIsAiImportSheetOpen(true);
        }}
        activeLocation={activeLocation}
        onPublish={handlePublish}
        onApiKeysChange={handleApiKeysChange}
        apiKeys={apiKeys}
        viabilityMechanism={viabilityMechanism}
        onViabilityMechanismChange={handleViabilityMechanismChange}
        onDuplicateReviewOpen={() => {
            setIsSettingsSheetOpen(false);
            setIsDuplicateReviewSheetOpen(true);
        }}
      />

      <AiDataImportSheet
        isOpen={isAiImportSheetOpen}
        onOpenChange={(open) => {
            setIsAiImportSheetOpen(open);
            if (!open) {
                setPlantingToEdit(null);
            }
        }}
        initialTab={unifiedImportTab}
        apiKeys={apiKeys}
        areApiKeysSet={areApiKeysSet}
        onComplete={() => {
            window.location.reload();
        }}
        activeLocation={activeLocation}
        existingPlantings={plantingsWithPlants?.filter(p => p.gardenId === activeLocation?.id)}
        initialDataset={preloadedDatasetForReview}
        onClearInitialDataset={() => setPreloadedDatasetForReview(null)}
        plantingToEdit={plantingToEdit}
        defaultStatus={newPlantDefaultStatus}
        onPlantSubmit={plantingToEdit ? handleUpdatePlant : handleAddPlant}
        onConfigureApiKey={() => {
            setIsAiImportSheetOpen(false);
            setIsSettingsSheetOpen(true);
        }}
        plants={plants || []}
        onPublish={handlePublish}
      />

      <DuplicateReviewSheet
        isOpen={isDuplicateReviewSheetOpen}
        onOpenChange={setIsDuplicateReviewSheetOpen}
        plantings={plantingsWithPlants}
      />

      {selectedLocations && (
        <GardenEditSheet
          isOpen={isGardenEditSheetOpen}
          onOpenChange={setIsGardenEditSheetOpen}
          locations={selectedLocations}
          handleLocationFieldChange={handleLocationFieldChange}
          handleConditionChange={handleConditionChange}
          handleGetCurrentLocation={handleGetCurrentLocation}
          isLocating={isLocating}
          handleAnalyzeConditions={handleAnalyzeConditions}
          handleStopAnalyzeConditions={handleStopAnalyzeConditions}
          isAnalyzing={isAnalyzing}
        />
      )}

      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="w-full max-w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-headline">{plantingToEdit ? 'Edit Plant' : 'Add a New Plant'}</SheetTitle>
          </SheetHeader>
          <PlantForm 
            plantingToEdit={plantingToEdit}
            defaultStatus={newPlantDefaultStatus}
            onSubmit={plantingToEdit ? handleUpdatePlant : handleAddPlant}
            onConfigureApiKey={() => {
              handleSheetOpenChange(false);
              setIsSettingsSheetOpen(true);
            }}
            areApiKeysSet={areApiKeysSet}
            apiKeys={apiKeys}
            plants={plants || []}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
