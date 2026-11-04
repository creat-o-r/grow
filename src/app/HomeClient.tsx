

'use client';

import React, { useState, useEffect, useCallback, MouseEvent, useMemo, useRef, KeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Plant, Planting, PlantingWithPlant, GardenLocation, Conditions, StatusHistory, AiLog, ViabilityAnalysisMode, GardenViewMode, AiDataset, FreeLlmConfig, StageViability, PropagationMethodInfo, SeasonalViability } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { usePrevious } from '@/hooks/use-previous';
import { getEnvironmentalData } from '@/ai/flows/get-environmental-data';
import { getAiViability } from '@/ai/flows/get-ai-viability';
import { loadDataset } from '@/lib/datasets';
import { Viability, SeasonName, getSuitableSeasons, getUpcomingViability, evaluatePlantingViability, getOverallViabilityLevel, getWishSeasonalViabilities, analyzeGrowViability, analyzeHarvestViability, ALL_PROPAGATION_METHODS } from '@/lib/viability';
import { decodeSeedPackFromInput, mergeSeedPackIntoDb } from '@/lib/seed-pack';
import { getCuratedPlantImage, resolveRealPlantImage } from '@/lib/plant-images';
import {
  publishCommunityViabilitySignal,
  saveP2PRoomId,
  fetchLatestFromP2PRoom,
} from '@/lib/p2p-signals';
import { ExtensionSlotBar } from '@/extensions/ExtensionSlotBar';
import { useP2PRoomLiveSync } from '@/hooks/useP2PRoomLiveSync';
import { PreOperationRemoteConflictDialog } from '@/components/PreOperationRemoteConflictDialog';
import type { DiscrepancyItemUpdated } from '@/lib/sync-diff';

import { LocationSwitcher } from '@/components/LocationSwitcher';
import { PlantCard } from '@/components/PlantCard';
import { AiLogPanel } from '@/components/AiLogPanel';
import { SettingsSheet } from '@/components/SettingsSheet';
import { AiDataImportSheet, type UnifiedImportTab } from '@/components/AiDataImportSheet';
import { DuplicateReviewSheet } from '@/components/DuplicateReviewSheet';
import { PlantingDashboard } from '@/components/PlantingDashboard';
import { GardenEditor, type GardenEnvField, type FieldShareStatus } from '@/components/GardenEditor';
import { GardenEditSheet } from '@/components/GardenEditSheet';
import { PlantSearchBar } from '@/components/PlantSearchBar';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Upload, Locate, Loader2, X, Sparkles, NotebookText, Settings, Info, Rocket, AlertCircle, AlertTriangle, RefreshCw, Fence, Square, Layers, Split, CopyCheck, Radio, Search, Cpu, BrainCircuit } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToastAction } from '@/components/ui/toast';
import { Progress } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { REPO_URL } from '@/lib/constants';

type PlantStatus = StatusHistory['status'];


export default function Home() {
  const [plantingToEdit, setPlantingToEdit] = useState<PlantingWithPlant | null>(null);
  const [newPlantDefaultStatus, setNewPlantDefaultStatus] = useState<PlantStatus>('Wishlist');
  const [isClient, setIsClient] = useState(false);
  const [accordionValue, setAccordionValue] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<PlantStatus | 'All'>('All');
  const [viabilityFilter, setViabilityFilter] = useState<Viability | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredTab, setHoveredTab] = useState<PlantStatus | 'All' | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [wishlistSortOrder, setWishlistSortOrder] = useState<'season' | 'viability'>('season');
  
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [selectedGardenIds, setSelectedGardenIds] = useState<string[]>([]);
  const [gardenViewMode, setGardenViewMode] = useState<GardenViewMode>('one');
  const [focusedMultiGardenId, setFocusedMultiGardenId] = useState<string | 'all'>('all');


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

  const getCurrentGardenDataset = useCallback(async (): Promise<AiDataset | null> => {
    const allLocations = await db.locations.toArray();
    const allPlants = await db.plants.toArray();
    const allPlantings = await db.plantings.toArray();
    if (allLocations.length === 0) return null;
    return {
      locations: allLocations,
      plants: allPlants,
      plantings: allPlantings,
    };
  }, []);

  const {
    roomId: liveRoomId,
    isConnected: isLiveRoomConnected,
    inwardMode: liveInwardMode,
    trustedGrowers: liveTrustedGrowers,
    autoStream: isLiveAutoStream,
    triggerDebouncedStream,
    pendingRemoteDiscrepancy,
    remotePlantingUpdates,
    latestRemoteDataset,
    checkRemoteUpdateForPlanting,
    dismissRemoteUpdateForPlanting,
    clearPendingRemoteUpdates,
    applyRemoteUpdateForPlanting,
    applyAllPendingRemoteDiscrepancies,
  } = useP2PRoomLiveSync({
    activeLocationId: activeLocationId || undefined,
    onReviewRequested: (incoming, peer) => {
      setPreloadedDatasetForReview({
        data: incoming,
        title: `${incoming.locations?.[0]?.name || 'Shared Garden'} (from @${peer})`,
      });
      setUnifiedImportTab('live-sync');
    },
    onApiKeysReceived: (keys, peer) => {
      handleApiKeysChange(keys);
      toast({
        title: `AI Credentials Received from @${peer}`,
        description: 'Free AI provider keys have been applied to this session.',
      });
    },
  });

  const [pendingConflictDialog, setPendingConflictDialog] = useState<{
    open: boolean;
    update: DiscrepancyItemUpdated | null;
    operationLabel: string;
    onProceed: () => void | Promise<void>;
  }>({
    open: false,
    update: null,
    operationLabel: '',
    onProceed: () => {},
  });

  const guardWithRemoteCheck = useCallback(
    (plantingId: string, operationLabel: string, executeOperation: () => void | Promise<void>) => {
      const remoteUpdate = checkRemoteUpdateForPlanting(plantingId);
      if (remoteUpdate) {
        setPendingConflictDialog({
          open: true,
          update: remoteUpdate,
          operationLabel,
          onProceed: async () => {
            dismissRemoteUpdateForPlanting(plantingId);
            await executeOperation();
          },
        });
        return false;
      }
      executeOperation();
      return true;
    },
    [checkRemoteUpdateForPlanting, dismissRemoteUpdateForPlanting]
  );

  const handleReviewRemoteUpdate = useCallback(
    (update: DiscrepancyItemUpdated) => {
      setPendingConflictDialog({
        open: true,
        update,
        operationLabel: 'Review Remote Update',
        onProceed: () => {
          dismissRemoteUpdateForPlanting(update.localPlantingId);
        },
      });
    },
    [dismissRemoteUpdateForPlanting]
  );

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

    // Handle 1-click forkable ?pack=, ?dataset=, or ?p2p_room= deep links by opening the full Review & Garden Import Options sheet
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const packParam = params.get('pack');
      const datasetParam = params.get('dataset');
      const p2pRoomParam = params.get('p2p_room');

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
      } else if (p2pRoomParam) {
        saveP2PRoomId(p2pRoomParam);
        setUnifiedImportTab('live-sync');
        setIsAiImportSheetOpen(true);
        fetchLatestFromP2PRoom(p2pRoomParam)
          .then((latest) => {
            if (latest && (latest.dataset.plantings?.length || 0) > 0) {
              const title = `${latest.dataset.locations?.[0]?.name || 'P2P Garden'} (${latest.peerName})`;
              setPreloadedDatasetForReview({ data: latest.dataset, title });
            }
          })
          .catch((err) => console.warn('Could not auto-pull ?p2p_room= param:', err));
        window.history.replaceState({}, '', window.location.pathname);
      }
    }

    const storedMechanism = localStorage.getItem('grow_viabilityMechanism') as ViabilityAnalysisMode | null;
    if (storedMechanism === 'ai' || storedMechanism === 'local') {
      setViabilityMechanism(storedMechanism);
    } else {
      setViabilityMechanism('local');
      localStorage.setItem('grow_viabilityMechanism', 'local');
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

  const handleViabilityMechanismChange = (mechanism: ViabilityAnalysisMode) => {
    setViabilityMechanism(mechanism);
    localStorage.setItem('grow_viabilityMechanism', mechanism);
    toast({
      title: mechanism === 'local' ? 'Local Viability Enabled' : 'Local Viability Turned Off (AI Only)',
      description: mechanism === 'local'
        ? 'Plants now calculate instant offline botanical viability from garden conditions.'
        : 'Plants now strictly display verified AI viability analyses.',
    });
  };

  useEffect(() => {
    if (locations && locations.length > 0 && !activeLocationId) {
      const firstLocation = locations[0];
      setActiveLocationId(firstLocation.id);
      setSelectedGardenIds([firstLocation.id]);
    }
  }, [locations, activeLocationId]);

  // Automatically backfill real botanical photographs for any existing plants in IndexedDB missing imageUrl
  useEffect(() => {
    if (!plants || plants.length === 0) return;
    const plantsMissingImages = plants.filter((p) => !p.imageUrl || !p.imageUrl.trim());
    if (plantsMissingImages.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const plant of plantsMissingImages) {
        if (cancelled) break;
        const resolvedUrl = await resolveRealPlantImage(plant.species, undefined, plant.id);
        if (resolvedUrl && !cancelled) {
          await db.plants.update(plant.id, { imageUrl: resolvedUrl });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plants]);

  const handleAddPlant = async (plantingData: Omit<Planting, 'id'>, plantData: Omit<Plant, 'id'>) => {
    const existingPlant = await db.plants.where('species').equalsIgnoreCase(plantData.species).first();
    let plantId = existingPlant?.id;
    const resolvedImageUrl =
      plantData.imageUrl ||
      (await resolveRealPlantImage(plantData.species, plantingData.name)) ||
      getCuratedPlantImage(plantData.species, plantingData.name);

    if (!plantId) {
        const newPlant: Plant = {
          ...plantData,
          id: `plant-${Date.now()}`,
          ...(resolvedImageUrl ? { imageUrl: resolvedImageUrl } : {}),
        };
        plantId = await db.plants.add(newPlant);
    } else if (existingPlant && !existingPlant.imageUrl && resolvedImageUrl) {
        await db.plants.update(existingPlant.id, { imageUrl: resolvedImageUrl });
    }

    const newPlanting: Planting = {
        ...plantingData,
        id: `planting-${Date.now()}`,
        plantId: plantId.toString(),
        gardenId: plantingData.gardenId || activeLocationId || '',
    };
    await db.plantings.add(newPlanting);
    triggerDebouncedStream(getCurrentGardenDataset);

    setIsAiImportSheetOpen(false);
    toast({
      title: 'Plant Added',
      description: `${plantingData.name} has been added to your collection.`,
    });
};

const handleUpdatePlant = async (updatedPlanting: Planting, updatedPlant: Plant) => {
    guardWithRemoteCheck(updatedPlanting.id, 'Save Plant Updates', async () => {
      const existing = await db.plantings.get(updatedPlanting.id);
      if (existing && existing.gardenId !== updatedPlanting.gardenId) {
        // Plant was moved to another garden location - clear stale garden assessments
        updatedPlanting.viability = undefined;
        updatedPlanting.viabilityReasoning = undefined;
        updatedPlanting.stageViability = undefined;
        updatedPlanting.prepForecast = undefined;
        updatedPlanting.growAssessment = undefined;
        updatedPlanting.harvestAssessment = undefined;
        updatedPlanting.methodViabilities = undefined;
        updatedPlanting.seasonalViabilities = undefined;
      }
      await db.plantings.put(updatedPlanting);
      await db.plants.put(updatedPlant);
      triggerDebouncedStream(getCurrentGardenDataset);

      setPlantingToEdit(null);
      setIsAiImportSheetOpen(false);
      toast({
          title: 'Plant Updated',
          description: `${updatedPlanting.name} has been updated.`,
      });
    });
};

  const handleDeletePlanting = async () => {
    if (!plantingToDelete) return;
    await db.plantings.delete(plantingToDelete.id);
    triggerDebouncedStream(getCurrentGardenDataset);
    toast({
      title: 'Plant Removed',
      description: `${plantingToDelete.name} has been removed.`,
      variant: 'destructive',
    });
    setPlantingToDelete(null);
    setIsDeleteAlertOpen(false);
  };
  
  const handleEditPlanting = (planting: PlantingWithPlant) => {
    guardWithRemoteCheck(planting.id, 'Edit Plant Details', () => {
      setPlantingToEdit(planting);
      setPreloadedDatasetForReview(null);
      setUnifiedImportTab('single');
      setIsAiImportSheetOpen(true);
    });
  };

  const handleOpenAddSheet = (defaultStatus?: PlantStatus, tab: UnifiedImportTab = 'single') => {
    setPlantingToEdit(null);
    setNewPlantDefaultStatus(defaultStatus || 'Wishlist');
    setPreloadedDatasetForReview(null);
    setUnifiedImportTab(tab);
    setIsAiImportSheetOpen(true);
  };

  const handleSwitchGarden = useCallback((targetGardenId: string) => {
    setActiveLocationId(targetGardenId);
    setSelectedGardenIds([targetGardenId]);
  }, []);

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
      
      if ((result as any)?._error) {
        throw new Error((result as any)._error);
      }

      await db.locations.update(locationId, {
        conditions: {
            temperature: result.soilTemperature,
            sunlight: result.sunlightHours,
            soil: result.soilDescription,
            currentSeason: result.currentSeason,
        }
      });
      
      const sanitizedPrompt = { ...promptData };
      delete (sanitizedPrompt as any).apiKeys;

      const newLog: AiLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        flow: 'getEnvironmentalData',
        prompt: sanitizedPrompt,
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

        const sanitizedPrompt = { ...promptData };
        delete (sanitizedPrompt as any).apiKeys;

        const errorLog: AiLog = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          flow: 'getEnvironmentalData',
          prompt: sanitizedPrompt,
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
        setIsDeleteAlertOpen(true);
    } else { // It's a PlantingWithPlant
        guardWithRemoteCheck(item.id, 'Delete Plant', () => {
          setPlantingToDelete(item);
          setIsDeleteAlertOpen(true);
        });
    }
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

    const stage: PlantStatus = (planting.history && planting.history.length > 0)
      ? planting.history[planting.history.length - 1].status
      : 'Wishlist';

    const promptData = {
        stage,
        propagationMethod: planting.propagationMethod || 'seed',
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

    try {

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

      if ((result as any)?._error) {
        throw new Error((result as any)._error);
      }

      const sanitizedPrompt = { ...promptData };
      delete (sanitizedPrompt as any).apiKeys;

      const logData = { 
        flow: 'getAiViability', 
        prompt: sanitizedPrompt, 
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

        // Map AI methodViabilities to PropagationMethodInfo if returned
        const mappedMethodViabilities = result.methodViabilities ? result.methodViabilities.map(mv => {
          const meta = ALL_PROPAGATION_METHODS.find(m => m.method === mv.method) || {
            method: mv.method,
            label: mv.method,
            shortLabel: mv.method,
            icon: '🌱',
          };
          return {
            method: mv.method,
            label: meta.label,
            shortLabel: meta.shortLabel,
            icon: meta.icon,
            prepViability: mv.viability,
            growViability: mv.viability,
            harvestViability: mv.viability,
            overallViability: mv.viability,
            prepReasoning: mv.reasoning || '',
            isIncompatible: mv.viability === 'N/A' || mv.isIncompatible,
            isRecommended: mv.viability === 'High',
          };
        }) : undefined;

        // PURE AI VIABILITY: No local fallback calculations or enrichments!
        const scoreMap: Record<string, number> = { High: 5, Medium: 3, Low: 1, 'N/A': 0 };
        const rawAiSeasons = (result.seasonalViabilities || []).map(sv => {
          return {
            season: sv.season,
            viability: sv.viability,
            score: scoreMap[sv.viability] || 0,
            reasoning: sv.reasoning || '',
            prepViability: sv.prepViability,
            prepSummary: sv.prepSummary,
            growViability: sv.growViability,
            harvestViability: sv.harvestViability,
            harvestType: sv.harvestType,
            harvestWindow: sv.harvestWindow,
            seedSavingNotes: sv.seedSavingNotes,
            growInfo: sv.growViability ? {
              vigorViability: sv.growViability,
              stressFactor: result.growAssessment?.stressFactor || 'None',
              tendingAdvice: result.growAssessment?.tendingAdvice || 'Monitor soil moisture and ambient sunlight.',
              reasoning: sv.reasoning || '',
            } : undefined,
            harvestInfo: (sv.harvestViability || sv.harvestType) ? {
              harvestType: sv.harvestType || result.harvestAssessment?.harvestType || 'Fruit / Crop',
              ripenessViability: sv.harvestViability || sv.viability,
              harvestWindow: sv.harvestWindow || result.harvestAssessment?.harvestWindow || '',
              description: sv.reasoning || '',
              seedSavingNotes: sv.seedSavingNotes || result.harvestAssessment?.seedSavingNotes,
              successionAdvice: result.harvestAssessment?.successionAdvice,
            } : undefined,
          };
        });

        const ALL_4_SEASONS: SeasonName[] = ['Spring', 'Summer', 'Autumn', 'Winter'];
        const aiSeasonMap = new Map<string, SeasonalViability>();
        rawAiSeasons.forEach(s => aiSeasonMap.set(s.season.toLowerCase(), s));

        const currentSeasonName = activeLocation.conditions?.currentSeason;

        const resolvedSeasonalViabilities = ALL_4_SEASONS.map(sName => {
          const existing = aiSeasonMap.get(sName.toLowerCase());
          if (existing) {
            if (currentSeasonName && existing.season.toLowerCase() === currentSeasonName.toLowerCase()) {
              return {
                ...existing,
                viability: finalViability,
                reasoning: result.reasoning || existing.reasoning,
                prepViability: result.prepForecast?.prepViability || finalViability,
                score: scoreMap[finalViability] || 0,
              };
            }
            return existing;
          }
          return {
            season: sName,
            viability: 'N/A' as Viability,
            score: 0,
            reasoning: `No AI viability evaluation provided for ${sName}.`,
          };
        });

        for (const p of duplicatePlantings) {
          const pStage: PlantStatus = (p.history && p.history.length > 0)
            ? p.history[p.history.length - 1].status
            : 'Wishlist';

          let aiStageViability: StageViability | undefined = undefined;
          if (pStage === 'Wishlist') {
            const seasons = resolvedSeasonalViabilities;
            const scoreMap: Record<string, number> = { High: 3, Medium: 2, Low: 1, 'N/A': 0 };
            const sortedByScore = [...seasons].sort((a, b) => (scoreMap[b.viability] || 0) - (scoreMap[a.viability] || 0));
            const bestSeason = sortedByScore.length > 0 ? sortedByScore[0].season : 'Spring';
            aiStageViability = {
              stage: 'Wishlist',
              overallViability: finalViability,
              seasons,
              activeSeasonMatch: activeLocation.conditions?.currentSeason ? seasons.some(s => s.season.toLowerCase() === activeLocation.conditions.currentSeason?.toLowerCase() && s.viability !== 'N/A' && s.viability !== 'Low') : false,
              bestSeason,
              reasoning: result.reasoning,
            };
          } else if (pStage === 'Planting' && result.prepForecast) {
            aiStageViability = {
              stage: 'Planting',
              propagationMethod: p.propagationMethod || 'seed',
              prepViability: result.prepForecast.prepViability,
              growViability: result.prepForecast.growViability,
              harvestViability: result.prepForecast.harvestViability,
              overallViability: result.prepForecast.overallViability || finalViability,
              isIncompatible: finalViability === 'N/A' || result.prepForecast.overallViability === 'N/A',
              prepReasoning: result.prepForecast.prepReasoning || result.reasoning,
              growReasoning: result.prepForecast.growReasoning,
              harvestReasoning: result.prepForecast.harvestReasoning,
              summary: result.prepForecast.summary || result.reasoning,
            };
          } else if (pStage === 'Growing' && result.growAssessment) {
            aiStageViability = {
              stage: 'Growing',
              vigorViability: result.growAssessment.vigorViability,
              stressFactor: result.growAssessment.stressFactor || 'None',
              tendingAdvice: result.growAssessment.tendingAdvice || 'Monitor soil moisture and ambient sunlight.',
              reasoning: result.growAssessment.reasoning || result.reasoning,
            };
          } else if (pStage === 'Harvest' && result.harvestAssessment) {
            aiStageViability = {
              stage: 'Harvest',
              ripenessViability: result.harvestAssessment.ripenessViability,
              harvestWindow: result.harvestAssessment.harvestWindow || 'Peak Window',
              harvestType: result.harvestAssessment.harvestType,
              seedSavingNotes: result.harvestAssessment.seedSavingNotes,
              successionAdvice: result.harvestAssessment.successionAdvice || 'Rotate bed to legumes or leafy greens.',
              reasoning: result.harvestAssessment.reasoning || result.reasoning,
            };
          }

          await db.plantings.update(p.id, {
            viability: finalViability,
            viabilityReasoning: result.reasoning,
            viabilityAssessedAt: assessedAt,
            upcomingViability: result.upcomingViability,
            upcomingTiming: result.upcomingTiming,
            upcomingReasoning: result.upcomingReasoning,
            ...(aiStageViability ? { stageViability: aiStageViability } : {}),
            seasonalViabilities: resolvedSeasonalViabilities,
            ...(result.prepForecast ? {
              prepForecast: {
                ...result.prepForecast,
                overallViability: result.prepForecast.overallViability || finalViability,
              }
            } : {}),
            ...(result.growAssessment ? {
              growAssessment: {
                ...result.growAssessment,
                tendingAdvice: result.growAssessment.tendingAdvice || 'Monitor soil moisture and ambient sunlight.',
                reasoning: result.growAssessment.reasoning || result.reasoning,
              }
            } : {}),
            ...(result.harvestAssessment ? {
              harvestAssessment: {
                ...result.harvestAssessment,
                harvestWindow: result.harvestAssessment.harvestWindow || 'Peak Window',
                successionAdvice: result.harvestAssessment.successionAdvice || 'Rotate bed after harvest.',
                reasoning: result.harvestAssessment.reasoning || result.reasoning,
              }
            } : {}),
            ...(mappedMethodViabilities ? { methodViabilities: mappedMethodViabilities } : {}),
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

      const sanitizedPrompt = { ...promptData };
      delete (sanitizedPrompt as any).apiKeys;

      const errorLog: AiLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        flow: 'getAiViability',
        prompt: sanitizedPrompt,
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
    guardWithRemoteCheck(planting.id, `Mark as ${newStatus}`, async () => {
      const originalHistory = planting.history;
      const originalStageViability = planting.stageViability;

      const newHistoryEntry: StatusHistory = {
        id: `hist-${Date.now()}`,
        status: newStatus,
        date: new Date().toISOString(),
        notes: 'Status changed via Quick Change',
      };

      const newHistory = [...originalHistory, newHistoryEntry];

      // Dynamically update stageViability to match the new stage using existing assessments
      let updatedStageViability: StageViability | undefined = undefined;
      if (newStatus === 'Growing' && planting.growAssessment) {
        updatedStageViability = {
          stage: 'Growing',
          ...planting.growAssessment,
          stressFactor: planting.growAssessment.stressFactor || 'None',
          tendingAdvice: planting.growAssessment.tendingAdvice || 'Monitor soil moisture and ambient sunlight.',
          reasoning: planting.growAssessment.reasoning || planting.viabilityReasoning || 'In-ground vigor assessment',
        };
      } else if (newStatus === 'Harvest' && planting.harvestAssessment) {
        updatedStageViability = {
          stage: 'Harvest',
          ...planting.harvestAssessment,
          harvestWindow: planting.harvestAssessment.harvestWindow || 'Peak Window',
          successionAdvice: planting.harvestAssessment.successionAdvice || 'Rotate bed after harvest.',
          reasoning: planting.harvestAssessment.reasoning || planting.viabilityReasoning || 'Harvest ripeness assessment',
        };
      } else if (newStatus === 'Planting' && planting.prepForecast) {
        updatedStageViability = {
          stage: 'Planting',
          ...planting.prepForecast,
          overallViability: planting.prepForecast.overallViability || planting.viability || 'Medium',
        };
      } else if (newStatus === 'Wishlist' && planting.seasonalViabilities) {
        const seasons = planting.seasonalViabilities;
        const scoreMap: Record<string, number> = { High: 3, Medium: 2, Low: 1, 'N/A': 0 };
        const sorted = [...seasons].sort((a, b) => (scoreMap[b.viability] || 0) - (scoreMap[a.viability] || 0));
        updatedStageViability = {
          stage: 'Wishlist',
          overallViability: planting.viability || sorted[0]?.viability || 'Medium',
          seasons,
          bestSeason: sorted[0]?.season || 'Spring',
          reasoning: planting.viabilityReasoning || 'AI Seasonal Viability Assessment',
        };
      }

      try {
        await db.plantings.update(planting.id, { 
          history: newHistory,
          ...(updatedStageViability ? { stageViability: updatedStageViability } : {})
        });
        triggerDebouncedStream(getCurrentGardenDataset);

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
            await db.plantings.update(planting.id, { 
              history: originalHistory,
              ...(originalStageViability !== undefined ? { stageViability: originalStageViability } : {})
            });
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
    });
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
  
  const resolvePlantViability = useCallback((p: PlantingWithPlant): Viability | undefined => {
    const currentStatus = (p.history && p.history.length > 0
      ? p.history[p.history.length - 1].status
      : 'Wishlist') as PlantStatus;

    if (viabilityMechanism === 'local') {
      return getOverallViabilityLevel(evaluatePlantingViability(p, activeLocation?.conditions, {
        growingSystems: p.garden?.growingSystems,
        growingMethods: p.garden?.growingMethods,
        propagationMethod: p.propagationMethod,
        ignoreAi: true,
      }));
    }

    // AI Mechanism:
    // 1. Stage-specific verified AI assessments
    if (currentStatus === 'Growing' && p.growAssessment?.vigorViability) {
      return p.growAssessment.vigorViability;
    }
    if (currentStatus === 'Harvest' && p.harvestAssessment?.ripenessViability) {
      return p.harvestAssessment.ripenessViability;
    }
    if (currentStatus === 'Planting' && p.prepForecast) {
      return p.prepForecast.overallViability || p.prepForecast.prepViability;
    }

    // 2. Active stageViability match
    if (p.stageViability && p.stageViability.stage === currentStatus) {
      return getOverallViabilityLevel(p.stageViability);
    }

    // 3. Overall / Wishlist AI assessment
    if (p.viability) return p.viability;
    if (currentViabilityData[p.id]) return currentViabilityData[p.id];

    return undefined;
  }, [currentViabilityData, viabilityMechanism, activeLocation?.conditions]);

  const wishlistPlantings = useMemo(() => {
    if (!plantingsWithPlants) return [];
    let list = plantingsWithPlants.filter(p => p.history?.slice(-1)[0]?.status === 'Wishlist');
    if (viabilityFilter) {
      list = list.filter(p => {
        const v = resolvePlantViability(p);
        return v === viabilityFilter;
      });
    }
    return list;
  }, [plantingsWithPlants, viabilityFilter, resolvePlantViability]);

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
          const stage: PlantStatus = (samplePlanting.history && samplePlanting.history.length > 0)
            ? samplePlanting.history[samplePlanting.history.length - 1].status
            : 'Wishlist';

          const promptData = {
            stage,
            propagationMethod: samplePlanting.propagationMethod,
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

        if (result?.viability && !(result as any)?._error) {
          const assessedAt = new Date().toISOString();

          // Map AI methodViabilities to PropagationMethodInfo if returned
          const mappedMethodViabilities = result.methodViabilities ? result.methodViabilities.map(mv => {
            const meta = ALL_PROPAGATION_METHODS.find(m => m.method === mv.method) || {
              method: mv.method,
              label: mv.method,
              shortLabel: mv.method,
              icon: '🌱',
            };
            return {
              method: mv.method,
              label: meta.label,
              shortLabel: meta.shortLabel,
              icon: meta.icon,
              prepViability: mv.viability,
              growViability: mv.viability,
              harvestViability: mv.viability,
              overallViability: mv.viability,
              prepReasoning: mv.reasoning || '',
              isIncompatible: mv.viability === 'N/A' || mv.isIncompatible,
              isRecommended: mv.viability === 'High',
            };
          }) : undefined;

          // PURE AI VIABILITY: No local fallback calculations or enrichments!
          const scoreMap: Record<string, number> = { High: 5, Medium: 3, Low: 1, 'N/A': 0 };
          const rawAiSeasons = (result.seasonalViabilities || []).map(sv => {
            return {
              season: sv.season,
              viability: sv.viability,
              score: scoreMap[sv.viability] || 0,
              reasoning: sv.reasoning || '',
              prepViability: sv.prepViability,
              prepSummary: sv.prepSummary,
              growViability: sv.growViability,
              harvestViability: sv.harvestViability,
              harvestType: sv.harvestType,
              harvestWindow: sv.harvestWindow,
              seedSavingNotes: sv.seedSavingNotes,
              growInfo: sv.growViability ? {
                vigorViability: sv.growViability,
                stressFactor: result.growAssessment?.stressFactor || 'None',
                tendingAdvice: result.growAssessment?.tendingAdvice || 'Monitor soil moisture and ambient sunlight.',
                reasoning: sv.reasoning || '',
              } : undefined,
              harvestInfo: (sv.harvestViability || sv.harvestType) ? {
                harvestType: sv.harvestType || result.harvestAssessment?.harvestType || 'Fruit / Crop',
                ripenessViability: sv.harvestViability || sv.viability,
                harvestWindow: sv.harvestWindow || result.harvestAssessment?.harvestWindow || '',
                description: sv.reasoning || '',
                seedSavingNotes: sv.seedSavingNotes || result.harvestAssessment?.seedSavingNotes,
                successionAdvice: result.harvestAssessment?.successionAdvice,
              } : undefined,
            };
          });

          const ALL_4_SEASONS: SeasonName[] = ['Spring', 'Summer', 'Autumn', 'Winter'];
          const aiSeasonMap = new Map<string, SeasonalViability>();
          rawAiSeasons.forEach(s => aiSeasonMap.set(s.season.toLowerCase(), s));

          const currentSeasonName = activeLocation.conditions?.currentSeason;

          const resolvedSeasonalViabilities = ALL_4_SEASONS.map(sName => {
            const existing = aiSeasonMap.get(sName.toLowerCase());
            if (existing) {
              if (currentSeasonName && existing.season.toLowerCase() === currentSeasonName.toLowerCase()) {
                return {
                  ...existing,
                  viability: result.viability,
                  reasoning: result.reasoning || existing.reasoning,
                  prepViability: result.prepForecast?.prepViability || result.viability,
                  score: scoreMap[result.viability] || 0,
                };
              }
              return existing;
            }
            return {
              season: sName,
              viability: 'N/A' as Viability,
              score: 0,
              reasoning: `No AI viability evaluation provided for ${sName}.`,
            };
          });

          // Apply the AI viability result to ALL duplicate plantings in this group
          for (const planting of group) {
            const pStage: PlantStatus = (planting.history && planting.history.length > 0)
              ? planting.history[planting.history.length - 1].status
              : 'Wishlist';

            let aiStageViability: StageViability | undefined = undefined;
            if (pStage === 'Wishlist') {
              const seasons = resolvedSeasonalViabilities;
              const scoreMap: Record<string, number> = { High: 3, Medium: 2, Low: 1, 'N/A': 0 };
              const sorted = [...seasons].sort((a, b) => (scoreMap[b.viability] || 0) - (scoreMap[a.viability] || 0));
              const bestSeason = sorted.length > 0 ? sorted[0].season : 'Spring';
              aiStageViability = {
                stage: 'Wishlist',
                overallViability: result.viability,
                seasons,
                activeSeasonMatch: activeLocation.conditions?.currentSeason ? seasons.some(s => s.season.toLowerCase() === activeLocation.conditions.currentSeason?.toLowerCase() && s.viability !== 'N/A' && s.viability !== 'Low') : false,
                bestSeason,
                reasoning: result.reasoning,
              };
            } else if (pStage === 'Planting' && result.prepForecast) {
              aiStageViability = {
                stage: 'Planting',
                propagationMethod: planting.propagationMethod || 'seed',
                prepViability: result.prepForecast.prepViability,
                growViability: result.prepForecast.growViability,
                harvestViability: result.prepForecast.harvestViability,
                overallViability: result.prepForecast.overallViability || result.viability,
                isIncompatible: result.viability === 'N/A' || result.prepForecast.overallViability === 'N/A',
                prepReasoning: result.prepForecast.prepReasoning || result.reasoning,
                growReasoning: result.prepForecast.growReasoning,
                harvestReasoning: result.prepForecast.harvestReasoning,
                summary: result.prepForecast.summary || result.reasoning,
              };
            } else if (pStage === 'Growing' && result.growAssessment) {
              aiStageViability = {
                stage: 'Growing',
                vigorViability: result.growAssessment.vigorViability,
                stressFactor: result.growAssessment.stressFactor || 'None',
                tendingAdvice: result.growAssessment.tendingAdvice || 'Monitor soil moisture and ambient sunlight.',
                reasoning: result.growAssessment.reasoning || result.reasoning,
              };
            } else if (pStage === 'Harvest' && result.harvestAssessment) {
              aiStageViability = {
                stage: 'Harvest',
                ripenessViability: result.harvestAssessment.ripenessViability,
                harvestWindow: result.harvestAssessment.harvestWindow || 'Peak Window',
                harvestType: result.harvestAssessment.harvestType,
                seedSavingNotes: result.harvestAssessment.seedSavingNotes,
                successionAdvice: result.harvestAssessment.successionAdvice || 'Rotate bed to legumes or leafy greens.',
                reasoning: result.harvestAssessment.reasoning || result.reasoning,
              };
            }

            await db.plantings.update(planting.id, {
              viability: result.viability,
              viabilityReasoning: result.reasoning,
              viabilityAssessedAt: assessedAt,
              upcomingViability: result.upcomingViability,
              upcomingTiming: result.upcomingTiming,
              upcomingReasoning: result.upcomingReasoning,
              ...(aiStageViability ? { stageViability: aiStageViability } : {}),
              seasonalViabilities: resolvedSeasonalViabilities,
              ...(result.prepForecast ? {
                prepForecast: {
                  ...result.prepForecast,
                  overallViability: result.prepForecast.overallViability || result.viability,
                }
              } : {}),
              ...(result.growAssessment ? {
                growAssessment: {
                  ...result.growAssessment,
                  tendingAdvice: result.growAssessment.tendingAdvice || 'Monitor soil moisture and ambient sunlight.',
                  reasoning: result.growAssessment.reasoning || result.reasoning,
                }
              } : {}),
              ...(result.harvestAssessment ? {
                harvestAssessment: {
                  ...result.harvestAssessment,
                  harvestWindow: result.harvestAssessment.harvestWindow || 'Peak Window',
                  successionAdvice: result.harvestAssessment.successionAdvice || 'Rotate bed after harvest.',
                  reasoning: result.harvestAssessment.reasoning || result.reasoning,
                }
              } : {}),
              ...(mappedMethodViabilities ? { methodViabilities: mappedMethodViabilities } : {}),
            });
            newViabilityData[planting.id] = result.viability;
          }

          const sanitizedBatchPrompt = { ...promptData };
          delete (sanitizedBatchPrompt as any).apiKeys;

          const batchLog: AiLog = {
            id: `batch-${Date.now()}-${samplePlanting.id}`,
            timestamp: assessedAt,
            flow: 'getAiViability',
            prompt: sanitizedBatchPrompt,
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

  const sortedAndFilteredPlantings = useMemo(() => {
    if (!plantingsWithPlants) return [];

    const getStatus = (p: Planting) => p.history && p.history.length > 0 ? p.history[p.history.length - 1].status : null;

    let filtered = statusFilter === 'All'
        ? plantingsWithPlants 
        : plantingsWithPlants.filter(p => getStatus(p) === statusFilter);

    if (viabilityFilter) {
      filtered = filtered.filter(p => {
        const v = resolvePlantViability(p);
        return v === viabilityFilter;
      });
    }

    if (activeLocation?.conditions) {
        const viabilityOrder: Record<Viability, number> = { 'High': 0, 'Medium': 1, 'Low': 2, 'N/A': 3 };
        
        return filtered.slice().sort((a, b) => {
            const viabilityA = resolvePlantViability(a) || 'N/A';
            const viabilityB = resolvePlantViability(b) || 'N/A';
            return viabilityOrder[viabilityA] - viabilityOrder[viabilityB];
        });
    }
    
    return filtered;
  }, [plantingsWithPlants, statusFilter, viabilityFilter, activeLocation?.conditions, resolvePlantViability]);
  

  const organizedWishlist = useMemo(() => {
    if (!wishlistPlantings || !activeLocation?.conditions) return null;

    const getBestPlantSeason = (plant: Plant): string => {
        const suitableSeasons = getSuitableSeasons(plant);
        if (suitableSeasons.length === 4 && activeLocation.conditions.currentSeason) {
            return activeLocation.conditions.currentSeason;
        }
        if (suitableSeasons.length === 0) return 'Season Not Specified';

        const seasonOrder: SeasonName[] = ['Spring', 'Summer', 'Autumn', 'Winter'];
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

    const viabilityOrder: Record<Viability, number> = { 'High': 0, 'Medium': 1, 'Low': 2, 'N/A': 3 };
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
        const wishSeasons = (p.stageViability && p.stageViability.stage === 'Wishlist' && p.stageViability.seasons && p.stageViability.seasons.length > 0)
            ? p.stageViability.seasons.filter(s => s.viability !== 'N/A')
            : (p.seasonalViabilities && p.seasonalViabilities.length > 0)
            ? p.seasonalViabilities.filter(s => s.viability !== 'N/A')
            : getWishSeasonalViabilities(p.plant, activeLocation.conditions);
        const qualifyingSeasons = wishSeasons.length > 0 
            ? wishSeasons.map(s => s.season) 
            : [getBestPlantSeason(p.plant)];

        qualifyingSeasons.forEach(seasonName => {
            if (!groupedBySeason[seasonName]) {
                groupedBySeason[seasonName] = [];
            }
            if (!groupedBySeason[seasonName].some(existing => existing.id === p.id)) {
                groupedBySeason[seasonName].push(p);
            }
        });
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
    const viabilityOrder: Record<Viability, number> = { 'High': 0, 'Medium': 1, 'Low': 2, 'N/A': 3 };
    return [...wishlistPlantings].sort((a, b) => {
        const viabilityA = resolvePlantViability(a) || 'N/A';
        const viabilityB = resolvePlantViability(b) || 'N/A';
        return viabilityOrder[viabilityA] - viabilityOrder[viabilityB];
    });
}, [wishlistPlantings, activeLocation?.conditions, resolvePlantViability]);

const unspecifiedSeasonCount = useMemo(() => {
    if (wishlistSortOrder !== 'season' || !organizedWishlist) return 0;
    const unspecifiedGroup = organizedWishlist.find(g => g.groupTitle === 'Season Not Specified');
    return unspecifiedGroup ? unspecifiedGroup.plantings.length : 0;
}, [organizedWishlist, wishlistSortOrder]);

  const plantingsInPlantingStatus = useMemo(() => {
      if (!plantingsWithPlants) return [];
      let list = plantingsWithPlants.filter(p => p.history && p.history.length > 0 && p.history[p.history.length-1].status === 'Planting');
      if (viabilityFilter) {
        list = list.filter(p => {
          const v = resolvePlantViability(p);
          return v === viabilityFilter;
        });
      }
      return list;
  }, [plantingsWithPlants, viabilityFilter, resolvePlantViability]);
  
  const plantingDashboardPlantings = useMemo(() => {
    if (!plantingsWithPlants) return [];
    return plantingsWithPlants.filter(p => p.history && p.history.length > 0 && ['Wishlist', 'Harvest'].includes(p.history[p.history.length-1].status));
  }, [plantingsWithPlants]);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || !plantingsWithPlants) {
      return {
        inCurrentSelection: [] as PlantingWithPlant[],
        inOtherSections: [] as PlantingWithPlant[],
        byStatus: { Wishlist: [], Planting: [], Growing: [], Harvest: [] } as Record<PlantStatus, PlantingWithPlant[]>,
        all: [] as PlantingWithPlant[],
        counts: { All: 0, Wishlist: 0, Planting: 0, Growing: 0, Harvest: 0 },
      };
    }

    const q = searchQuery.toLowerCase().trim();
    const getStatus = (p: Planting) =>
      (p.history && p.history.length > 0 ? p.history[p.history.length - 1].status : 'Wishlist') as PlantStatus;

    const matches = plantingsWithPlants.filter((p) => {
      const nameMatch = p.name?.toLowerCase().includes(q);
      const speciesMatch = p.plant?.species?.toLowerCase().includes(q);
      const condMatch = p.plant?.optimalConditions?.toLowerCase().includes(q);
      const germMatch = p.plant?.germinationNeeds?.toLowerCase().includes(q);
      const notesMatch = p.history?.some((h) => h.notes?.toLowerCase().includes(q));
      const viabilityMatch = (p.viability || currentViabilityData[p.id])?.toLowerCase().includes(q);
      const methodMatch = p.propagationMethod?.toLowerCase().includes(q);
      return !!(nameMatch || speciesMatch || condMatch || germMatch || notesMatch || viabilityMatch || methodMatch);
    });

    const byStatus: Record<PlantStatus, PlantingWithPlant[]> = {
      Wishlist: [],
      Planting: [],
      Growing: [],
      Harvest: [],
    };

    matches.forEach((p) => {
      const status = getStatus(p);
      if (byStatus[status]) {
        byStatus[status].push(p);
      }
    });

    const inCurrentSelection =
      statusFilter === 'All' ? matches : byStatus[statusFilter as PlantStatus] || [];

    const inOtherSections =
      statusFilter === 'All' ? [] : matches.filter((p) => getStatus(p) !== statusFilter);

    const counts = {
      All: matches.length,
      Wishlist: byStatus.Wishlist.length,
      Planting: byStatus.Planting.length,
      Growing: byStatus.Growing.length,
      Harvest: byStatus.Harvest.length,
    };

    return {
      inCurrentSelection,
      inOtherSections,
      byStatus,
      all: matches,
      counts,
    };
  }, [searchQuery, plantingsWithPlants, statusFilter, currentViabilityData]);

  const otherGardenSearchMatches = useMemo(() => {
    if (!searchQuery.trim() || !locations || locations.length <= 1 || !plantings || !plants) {
      return [] as PlantingWithPlant[];
    }
    const q = searchQuery.toLowerCase().trim();
    const plantMap = new Map(plants.map((p) => [p.id, p]));

    const currentGardenIds = effectivelySingleGardenView
      ? (activeLocationId ? [activeLocationId] : [])
      : selectedGardenIds;

    const otherPlantings = plantings.filter((p) => !currentGardenIds.includes(p.gardenId));
    return otherPlantings
      .map((p) => ({
        ...p,
        plant: plantMap.get(p.plantId)!,
        garden: locations.find((l) => l.id === p.gardenId),
      }))
      .filter((p) => p.plant)
      .filter((p) => {
        const nameMatch = p.name?.toLowerCase().includes(q);
        const speciesMatch = p.plant?.species?.toLowerCase().includes(q);
        const notesMatch = p.history?.some((h) => h.notes?.toLowerCase().includes(q));
        return !!(nameMatch || speciesMatch || notesMatch);
      });
  }, [searchQuery, locations, plantings, plants, effectivelySingleGardenView, activeLocationId, selectedGardenIds]);

  const statusCounts = useMemo(() => {
    const counts: { [key in PlantStatus | 'All']: number } = {
        All: 0, Wishlist: 0, Planting: 0, Growing: 0, Harvest: 0
    };
    if (!plantingsWithPlants) return counts;

    if (searchQuery.trim().length > 0) {
      return searchMatches.counts;
    }

    counts.All = plantingsWithPlants.length;
    plantingsWithPlants.forEach(p => {
        if (p.history && p.history.length > 0) {
            const lastStatus = p.history[p.history.length - 1].status;
            counts[lastStatus]++;
        }
    });
    return counts;
  }, [plantingsWithPlants, searchQuery, searchMatches.counts]);

  const tabViabilityData = useMemo(() => {
    const data: Record<PlantStatus | 'All', { High: number; Medium: number; Low: number; pending: number }> = {
      All: { High: 0, Medium: 0, Low: 0, pending: 0 },
      Wishlist: { High: 0, Medium: 0, Low: 0, pending: 0 },
      Planting: { High: 0, Medium: 0, Low: 0, pending: 0 },
      Growing: { High: 0, Medium: 0, Low: 0, pending: 0 },
      Harvest: { High: 0, Medium: 0, Low: 0, pending: 0 },
    };

    const targetPlantings = searchQuery.trim().length > 0 ? searchMatches.all : plantingsWithPlants;

    targetPlantings?.forEach(p => {
      const level = resolvePlantViability(p);
      const lastStatus = (p.history && p.history.length > 0 ? p.history[p.history.length - 1].status : null) as PlantStatus | null;

      if (level && (level === 'High' || level === 'Medium' || level === 'Low')) {
        data.All[level]++;
      } else {
        data.All.pending++;
      }

      if (lastStatus && data[lastStatus]) {
        if (level && (level === 'High' || level === 'Medium' || level === 'Low')) {
          data[lastStatus][level]++;
        } else {
          data[lastStatus].pending++;
        }
      }
    });

    return data;
  }, [plantingsWithPlants, currentViabilityData, searchQuery, searchMatches.all, activeLocation?.conditions]);

  const viabilityCounts = useMemo(() => {
    return {
      High: tabViabilityData.All.High,
      Medium: tabViabilityData.All.Medium,
      Low: tabViabilityData.All.Low,
    };
  }, [tabViabilityData]);

  const totalAnalyzedCount = useMemo(() => {
    return viabilityCounts.High + viabilityCounts.Medium + viabilityCounts.Low;
  }, [viabilityCounts]);

  const activeViabilityTab = hoveredTab ?? statusFilter;

  const allFilters: (PlantStatus | 'All')[] = ['All', 'Wishlist', 'Planting', 'Growing', 'Harvest'];

  const selectedLocations = useMemo(() => {
      if (!locations) return [];
      if (effectivelySingleGardenView) return activeLocation ? [activeLocation] : [];
      if (gardenViewMode === 'all') return locations;
      return locations.filter(loc => selectedGardenIds.includes(loc.id));
  }, [locations, selectedGardenIds, gardenViewMode, activeLocation, effectivelySingleGardenView]);

  const multiGardenEnvAnalysis = useMemo(() => {
    const fieldDefs: { field: GardenEnvField; label: string; getValue: (l: GardenLocation) => string }[] = [
      { field: 'location', label: 'Location', getValue: (l) => (l.location || '').trim() },
      { field: 'currentSeason', label: 'Season', getValue: (l) => (l.conditions?.currentSeason || '').trim() },
      { field: 'temperature', label: 'Soil Temp', getValue: (l) => (l.conditions?.temperature || '').trim() },
      { field: 'sunlight', label: 'Sunlight', getValue: (l) => (l.conditions?.sunlight || '').trim() },
      { field: 'soil', label: 'Soil', getValue: (l) => (l.conditions?.soil || '').trim() },
      { field: 'growingSystems', label: 'Systems', getValue: (l) => (l.growingSystems || '').trim() },
      { field: 'growingMethods', label: 'Methods', getValue: (l) => (l.growingMethods || '').trim() },
    ];

    const normalizeValue = (field: GardenEnvField, raw: string): string => {
      const cleaned = (raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!cleaned) return '';
      if (field === 'location') {
        // Normalize common country abbreviations and match on primary city/region if applicable
        const countryNormalized = cleaned
          .replace(/\bnew zealand\b/g, 'nz')
          .replace(/\bunited kingdom\b/g, 'uk')
          .replace(/\bunited states( of america)?\b/g, 'usa');
        const primarySegment = countryNormalized.split(/[,/]/)[0]?.trim() || countryNormalized;
        return primarySegment.length >= 3 ? primarySegment : countryNormalized;
      }
      if (field === 'temperature') {
        const tempMatch = cleaned.match(/-?\d+(\.\d+)?\s*°?\s*[cf]/i);
        if (tempMatch) {
          return tempMatch[0].replace(/\s+/g, '').toLowerCase();
        }
      }
      return cleaned;
    };

    const totalCount = selectedLocations.length;
    const valueCountsByField = new Map<
      GardenEnvField,
      Map<string, { displayValue: string; count: number; gardenNames: string[] }>
    >();

    for (const def of fieldDefs) {
      const map = new Map<string, { displayValue: string; count: number; gardenNames: string[] }>();
      for (const loc of selectedLocations) {
        const raw = def.getValue(loc);
        const norm = normalizeValue(def.field, raw);
        if (!norm) continue;
        const existing = map.get(norm);
        if (existing) {
          existing.count += 1;
          existing.gardenNames.push(loc.name);
        } else {
          map.set(norm, { displayValue: raw, count: 1, gardenNames: [loc.name] });
        }
      }
      valueCountsByField.set(def.field, map);
    }

    const shared: {
      field: GardenEnvField;
      label: string;
      value: string;
      count: number;
      total: number;
      isAll: boolean;
    }[] = [];
    const uniqueFields = new Set<GardenEnvField>();
    const uniqueFieldLabels: string[] = [];

    if (totalCount > 1) {
      for (const def of fieldDefs) {
        const map = valueCountsByField.get(def.field)!;
        let hasUnique = false;
        const nonEmptyGardensCount = Array.from(map.values()).reduce((sum, g) => sum + g.count, 0);

        for (const group of map.values()) {
          // A value is shared if 2+ gardens share it, OR if only 1 distinct value is set across all gardens that have this field populated
          if (group.count >= 2 || (map.size === 1 && nonEmptyGardensCount >= 1 && totalCount >= 2 && group.count === nonEmptyGardensCount)) {
            shared.push({
              field: def.field,
              label: def.label,
              value: group.displayValue,
              count: group.count,
              total: totalCount,
              isAll: group.count === totalCount,
            });
          }
          if (group.count === 1 && map.size > 1) {
            hasUnique = true;
          }
        }

        if (hasUnique) {
          uniqueFields.add(def.field);
          uniqueFieldLabels.push(def.label);
        }
      }
    }

    const getFieldShareInfo = (field: GardenEnvField, value?: string): FieldShareStatus => {
      const norm = normalizeValue(field, value || '');
      if (!norm) {
        return { status: 'unset', matchCount: 0, totalCount };
      }
      const map = valueCountsByField.get(field);
      const group = map?.get(norm);
      const matchCount = group?.count || 1;
      if (matchCount === totalCount) {
        return { status: 'shared-all', matchCount, totalCount };
      }
      if (matchCount >= 2 || (map && map.size === 1)) {
        return { status: 'shared-subset', matchCount, totalCount };
      }
      return { status: 'unique', matchCount: 1, totalCount };
    };

    const isUniqueField = (field: GardenEnvField) => uniqueFields.has(field);

    const getGardenUniqueSummary = (loc: GardenLocation): string[] => {
      const diffs: string[] = [];
      for (const def of fieldDefs) {
        const val = def.getValue(loc);
        const info = getFieldShareInfo(def.field, val);
        if (info.status === 'unique' && val) {
          diffs.push(`${def.label}: ${val}`);
        }
      }
      if (diffs.length === 0) {
        return ['Shares all set conditions'];
      }
      return diffs;
    };

    return {
      shared,
      uniqueFields,
      uniqueFieldLabels,
      isUniqueField,
      getFieldShareInfo,
      getGardenUniqueSummary,
    };
  }, [selectedLocations]);

  const handleApplyFieldToAllSelectedGardens = useCallback(
    async (field: GardenEnvField, value: string) => {
      if (!selectedLocations || selectedLocations.length <= 1) return;
      await db.transaction('rw', db.locations, async () => {
        for (const loc of selectedLocations) {
          if (field === 'location' || field === 'growingSystems' || field === 'growingMethods') {
            await db.locations.update(loc.id, { [field]: value });
          } else {
            const newConditions = { ...loc.conditions, [field]: value };
            await db.locations.update(loc.id, { conditions: newConditions });
          }
        }
      });
      toast({
        title: 'Combined Condition Applied',
        description: `Applied "${value}" to all ${selectedLocations.length} selected gardens.`,
      });
    },
    [selectedLocations, toast]
  );

  const visibleEditorLocations = useMemo(() => {
    if (selectedLocations.length <= 1 || focusedMultiGardenId === 'all') {
      return selectedLocations;
    }
    const found = selectedLocations.find((l) => l.id === focusedMultiGardenId);
    return found ? [found] : selectedLocations;
  }, [selectedLocations, focusedMultiGardenId]);

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

  const growingAnalysis = useMemo(() => {
    if (!plantingsWithPlants) return null;
    const growingPlants = plantingsWithPlants.filter(p => p.history?.slice(-1)[0]?.status === 'Growing');
    if (growingPlants.length === 0) return null;

    const stressed: { planting: PlantingWithPlant; data: ReturnType<typeof analyzeGrowViability> }[] = [];
    const thriving: { planting: PlantingWithPlant; data: ReturnType<typeof analyzeGrowViability> }[] = [];

    growingPlants.forEach(p => {
      const data = analyzeGrowViability(p.plant, activeLocation?.conditions, {
        growingSystems: p.garden?.growingSystems,
        growingMethods: p.garden?.growingMethods,
        propagationMethod: p.propagationMethod,
      });
      if (data.stressFactor && data.stressFactor !== 'None') {
        stressed.push({ planting: p, data });
      } else {
        thriving.push({ planting: p, data });
      }
    });

    return { growingPlants, stressed, thriving };
  }, [plantingsWithPlants, activeLocation?.conditions]);

  const harvestAnalysis = useMemo(() => {
    if (!plantingsWithPlants) return null;
    const harvestPlants = plantingsWithPlants.filter(p => p.history?.slice(-1)[0]?.status === 'Harvest');
    if (harvestPlants.length === 0) return null;

    const peak: { planting: PlantingWithPlant; data: ReturnType<typeof analyzeHarvestViability> }[] = [];
    const urgent: { planting: PlantingWithPlant; data: ReturnType<typeof analyzeHarvestViability> }[] = [];
    const standard: { planting: PlantingWithPlant; data: ReturnType<typeof analyzeHarvestViability> }[] = [];

    harvestPlants.forEach(p => {
      const data = analyzeHarvestViability(p.plant, activeLocation?.conditions, {
        growingSystems: p.garden?.growingSystems,
        growingMethods: p.garden?.growingMethods,
        propagationMethod: p.propagationMethod,
      });
      if (data.harvestWindow === 'Overdue / Bolt Risk' || data.harvestWindow === 'Approaching End') {
        urgent.push({ planting: p, data });
      } else if (data.harvestWindow === 'Peak Window') {
        peak.push({ planting: p, data });
      } else {
        standard.push({ planting: p, data });
      }
    });

    return { harvestPlants, peak, urgent, standard };
  }, [plantingsWithPlants, activeLocation?.conditions]);

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
                {liveRoomId.trim() ? (
                  <Button
                    variant="outline"
                    onClick={() => handleOpenAddSheet(undefined, 'live-sync')}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-medium border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors shrink-0"
                    title={`Live Room #${liveRoomId} is active. Click to view sync.`}
                  >
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-mono text-xs font-semibold">#{liveRoomId}</span>
                    {liveInwardMode === 'selected' ? (
                      <span className="text-[8px] uppercase tracking-wider font-bold bg-emerald-500/25 px-1 py-0.5 rounded text-emerald-300">
                        co-op ({liveTrustedGrowers.length})
                      </span>
                    ) : (
                      <span className="text-[8px] uppercase tracking-wider font-bold bg-emerald-500/25 px-1 py-0.5 rounded text-emerald-300">
                        live
                      </span>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => handleOpenAddSheet(undefined, 'live-sync')}
                    className="gap-1.5 px-3"
                    title="Live Garden Sync & Backup"
                  >
                    <Radio className="h-4 w-4 text-primary" />
                    <span>Sync</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViabilityMechanismChange(viabilityMechanism === 'local' ? 'ai' : 'local')}
                  className={cn(
                    "h-10 px-2.5 text-xs font-medium transition-colors shrink-0",
                    viabilityMechanism === 'local'
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : "border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300"
                  )}
                  title={viabilityMechanism === 'local' ? "Local Viability: ON (Click to turn OFF)" : "Local Viability: OFF (AI Only)"}
                >
                  {viabilityMechanism === 'local' ? (
                    <span className="flex items-center gap-1 font-mono text-[11px]">🌱 Local: ON</span>
                  ) : (
                    <span className="flex items-center gap-1 font-mono text-[11px]">🤖 AI Only</span>
                  )}
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
                                      <div className="flex flex-col items-start gap-1.5 text-xs text-muted-foreground font-normal w-full">
                                          {multiGardenEnvAnalysis.shared.length > 0 && (
                                              <div className="flex items-center flex-wrap gap-1.5">
                                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-background/80 flex items-center gap-1">
                                                      <Layers className="h-2.5 w-2.5 text-primary" />
                                                      <span>Combined</span>
                                                  </Badge>
                                                  <span className="text-foreground/90 font-medium">
                                                      {multiGardenEnvAnalysis.shared
                                                        .map((s) =>
                                                          s.isAll
                                                            ? `${s.label}: ${s.value}`
                                                            : `${s.label}: ${s.value} (${s.count}/${s.total})`
                                                        )
                                                        .join(' • ')}
                                                  </span>
                                              </div>
                                          )}
                                          <div className="flex items-center flex-wrap gap-1.5 w-full">
                                              {selectedLocations.map((loc) => {
                                                  const uniqueTraits = multiGardenEnvAnalysis.getGardenUniqueSummary(loc);
                                                  return (
                                                      <div
                                                          key={loc.id}
                                                          onClick={(e) => {
                                                              e.stopPropagation();
                                                              const isMobile = window.innerWidth < 768;
                                                              if (isMobile) {
                                                                  setIsGardenEditSheetOpen(true);
                                                              } else {
                                                                  setFocusedMultiGardenId(loc.id);
                                                                  setAccordionValue('item-1');
                                                              }
                                                          }}
                                                          className="inline-flex items-center gap-1.5 rounded-md border bg-background/80 px-2 py-0.5 text-xs hover:border-primary/60 transition-colors"
                                                          title="Click to inspect or edit this garden's unique conditions"
                                                      >
                                                          <span className="font-semibold text-foreground">{loc.name}:</span>
                                                          <span className="text-muted-foreground truncate max-w-[220px]">
                                                              {uniqueTraits.slice(0, 2).join(' · ')}
                                                          </span>
                                                      </div>
                                                  );
                                              })}
                                          </div>
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
                              {liveRoomId.trim() ? (
                                <Button
                                  variant="outline"
                                  onClick={() => handleOpenAddSheet(undefined, 'live-sync')}
                                  className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                  title={`Live Room #${liveRoomId} is active. Click to view sync.`}
                                >
                                  <span className="relative flex h-2 w-2 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                  </span>
                                  <span className="font-mono text-xs font-semibold">
                                    #{liveRoomId}
                                  </span>
                                  {liveInwardMode === 'selected' ? (
                                    <span className="text-[9px] uppercase tracking-wider font-bold bg-emerald-500/25 px-1.5 py-0.5 rounded text-emerald-300">
                                      co-op ({liveTrustedGrowers.length})
                                    </span>
                                  ) : (
                                    <span className="text-[9px] uppercase tracking-wider font-bold bg-emerald-500/25 px-1.5 py-0.5 rounded text-emerald-300">
                                      live
                                    </span>
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  onClick={() => handleOpenAddSheet(undefined, 'live-sync')}
                                  className="gap-1.5"
                                  title="Stream and sync gardens across devices"
                                >
                                  <Radio className="h-4 w-4 text-primary" />
                                  <span>Sync</span>
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                onClick={() => handleViabilityMechanismChange(viabilityMechanism === 'local' ? 'ai' : 'local')}
                                className={cn(
                                  "gap-1.5 h-10 px-3 transition-colors text-xs font-medium shrink-0",
                                  viabilityMechanism === 'local'
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20"
                                    : "border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300 hover:bg-blue-500/20"
                                )}
                                title={
                                  viabilityMechanism === 'local'
                                    ? "Local Viability: ON (Instant offline calculation). Click to turn OFF and use AI Viability only."
                                    : "Local Viability: OFF (AI Only). Click to turn ON local viability calculation."
                                }
                              >
                                {viabilityMechanism === 'local' ? (
                                  <>
                                    <Cpu className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    <span>Local Viability: ON</span>
                                  </>
                                ) : (
                                  <>
                                    <BrainCircuit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <span>Local Viability: OFF (AI Only)</span>
                                  </>
                                )}
                              </Button>
                              <Button variant="outline" size="icon" onClick={() => setIsSettingsSheetOpen(true)} className="h-10 w-10 flex-shrink-0">
                                <Settings className="h-4 w-4" />
                                <span className="sr-only">Settings</span>
                              </Button>
                          </div>
                      </div>

                      <AccordionContent className="p-6 pt-2 space-y-6 hidden md:block">
                        {selectedLocations.length > 1 && (
                          <Card className="border-primary/20 bg-background/70">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-sm font-semibold">
                                    <Layers className="h-4 w-4 text-primary" />
                                    <span>Multi-Garden Environment Manager ({selectedLocations.length} Gardens)</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Shared conditions are combined below. Unique microclimate conditions are badged per garden—click <strong>Sync All</strong> on any unique field to combine it across all gardens.
                                  </p>
                                </div>
                                <div className="flex items-center flex-wrap gap-2">
                                  <Select
                                    onValueChange={(season) => handleApplyFieldToAllSelectedGardens('currentSeason', season)}
                                  >
                                    <SelectTrigger className="h-8 w-[165px] text-xs">
                                      <SelectValue placeholder="Set Season for All..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Spring">All: Spring</SelectItem>
                                      <SelectItem value="Summer">All: Summer</SelectItem>
                                      <SelectItem value="Autumn">All: Autumn</SelectItem>
                                      <SelectItem value="Winter">All: Winter</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {activeLocation?.location && multiGardenEnvAnalysis.isUniqueField('location') && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs"
                                      onClick={() => handleApplyFieldToAllSelectedGardens('location', activeLocation.location)}
                                    >
                                      <CopyCheck className="mr-1.5 h-3.5 w-3.5" />
                                      Sync Location ("{activeLocation.location}") to All
                                    </Button>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                <div className="rounded-md border bg-muted/30 p-2.5 space-y-1.5">
                                  <div className="text-xs font-medium flex items-center gap-1.5">
                                    <Layers className="h-3.5 w-3.5 text-primary" />
                                    <span>Combined (Shared Across Gardens)</span>
                                  </div>
                                  {multiGardenEnvAnalysis.shared.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {multiGardenEnvAnalysis.shared.map((item, idx) => (
                                        <Badge key={`${item.field}-${idx}`} variant="secondary" className="text-xs font-normal">
                                          <strong className="mr-1">{item.label}:</strong> {item.value}
                                          {!item.isAll && (
                                            <span className="ml-1 text-muted-foreground">({item.count}/{item.total})</span>
                                          )}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      No identical conditions yet. Use "Sync All" on any field below to combine shared macro-climate values.
                                    </p>
                                  )}
                                </div>

                                <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-2.5 space-y-1.5">
                                  <div className="text-xs font-medium flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                                    <Split className="h-3.5 w-3.5" />
                                    <span>Separated (Unique Per Garden)</span>
                                  </div>
                                  {multiGardenEnvAnalysis.uniqueFieldLabels.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {multiGardenEnvAnalysis.uniqueFieldLabels.map((label) => (
                                        <Badge
                                          key={label}
                                          variant="outline"
                                          className="text-xs font-normal border-amber-500/30 text-amber-800 dark:text-amber-300"
                                        >
                                          {label} varies by garden
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      All environmental conditions are currently identical across these gardens.
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Filter bar to view all side-by-side or isolate a single garden's conditions */}
                              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                <span className="text-xs text-muted-foreground mr-1">Inspect Conditions:</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={focusedMultiGardenId === 'all' ? 'default' : 'outline'}
                                  className="h-7 text-xs px-2.5"
                                  onClick={() => setFocusedMultiGardenId('all')}
                                >
                                  Side-by-Side ({selectedLocations.length})
                                </Button>
                                {selectedLocations.map((loc) => (
                                  <Button
                                    key={loc.id}
                                    type="button"
                                    size="sm"
                                    variant={focusedMultiGardenId === loc.id ? 'default' : 'outline'}
                                    className="h-7 text-xs px-2.5"
                                    onClick={() => setFocusedMultiGardenId(loc.id)}
                                  >
                                    {loc.name}
                                  </Button>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        <div
                          className={cn(
                            'grid gap-6',
                            visibleEditorLocations.length > 1 ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'
                          )}
                        >
                          {visibleEditorLocations.map((loc) => {
                            const gardenPlantCount = plantings?.filter((p) => p.gardenId === loc.id).length || 0;
                            return (
                              <div
                                key={loc.id}
                                className={cn(
                                  selectedLocations.length > 1 &&
                                    'rounded-lg border bg-background/80 p-4 shadow-sm space-y-4'
                                )}
                              >
                                {selectedLocations.length > 1 && (
                                  <div className="flex items-center justify-between border-b pb-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Fence className="h-4 w-4 text-primary shrink-0" />
                                      <h3 className="font-headline font-semibold text-base truncate">{loc.name}</h3>
                                      <Badge variant="outline" className="text-xs font-mono">
                                        {gardenPlantCount} plant{gardenPlantCount === 1 ? '' : 's'}
                                      </Badge>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => {
                                        setActiveLocationId(loc.id);
                                        setGardenViewMode('one');
                                        setSelectedGardenIds([loc.id]);
                                      }}
                                    >
                                      Switch to Only This Garden
                                    </Button>
                                  </div>
                                )}
                                <GardenEditor
                                  loc={loc}
                                  handleLocationFieldChange={handleLocationFieldChange}
                                  handleConditionChange={handleConditionChange}
                                  handleGetCurrentLocation={handleGetCurrentLocation}
                                  isLocating={isLocating}
                                  handleAnalyzeConditions={handleAnalyzeConditions}
                                  handleStopAnalyzeConditions={handleStopAnalyzeConditions}
                                  isAnalyzing={isAnalyzing}
                                  multiGardenContext={
                                    selectedLocations.length > 1
                                      ? {
                                          getFieldShareInfo: multiGardenEnvAnalysis.getFieldShareInfo,
                                          onApplyFieldToAll: handleApplyFieldToAllSelectedGardens,
                                        }
                                      : undefined
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <ExtensionSlotBar
                  plants={plants || []}
                  plantings={plantingsWithPlants || []}
                  activeLocation={activeLocation}
                  conditions={activeLocation?.conditions}
                />

                {/* Pre-Operation Remote Updates Awareness Banner */}
                {remotePlantingUpdates.size > 0 && (
                  <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
                          <span>Remote updates detected on {remotePlantingUpdates.size} plant{remotePlantingUpdates.size === 1 ? '' : 's'}</span>
                          {latestRemoteDataset?.peerName && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-700 dark:text-amber-300">
                              from @{latestRemoteDataset.peerName}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Another device updated planting details. Review or sync changes before local operations to prevent accidental overwrites.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1 px-2.5 font-medium shadow-xs"
                        onClick={async () => {
                          await applyAllPendingRemoteDiscrepancies();
                        }}
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Sync All ({remotePlantingUpdates.size})</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => clearPendingRemoteUpdates()}
                        title="Dismiss remote updates notification"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span className="sr-only">Dismiss</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Mobile Floating Search Bar */}
                <div className="sm:hidden mb-2">
                  <PlantSearchBar
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    statusFilter={statusFilter}
                    onClearStatusFilter={() => setStatusFilter('All')}
                    currentSectionMatchesCount={searchMatches.inCurrentSelection.length}
                    otherSectionMatchesCount={searchMatches.inOtherSections.length}
                    otherGardenMatchesCount={otherGardenSearchMatches.length}
                    totalMatches={searchMatches.all.length}
                  />
                </div>
                
                {/* Mobile Sticky 4-Column All-In-One Pill Bar: Wish, Prep, Grow, Harv (Apart from All, All Totals & Viabilities, Only Pills on Columns) */}
                <div className="sm:hidden sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-md border-b border-border/40 mb-4 transition-all">
                  {/* Apart from All: Centered, Includes Total Plant Count and Total Viability Pills */}
                  <div className="flex items-center justify-center gap-2 mb-2 relative">
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('All');
                        setViabilityFilter(null);
                      }}
                      className={cn(
                        "text-xs font-semibold px-3 py-1 rounded-full transition-all flex items-center gap-1.5 active:scale-95 shrink-0",
                        statusFilter === 'All' && !viabilityFilter
                          ? "bg-foreground text-background shadow-xs font-bold"
                          : "bg-muted/70 text-muted-foreground border border-border"
                      )}
                    >
                      <span>All Plants</span>
                      <span className="font-mono text-[11px] opacity-80">({statusCounts.All})</span>
                    </button>

                    {/* Total Garden Viability Pills for All Plants */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge 
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusFilter('All');
                          setViabilityFilter(prev => (prev === 'High' && statusFilter === 'All') ? null : 'High');
                        }}
                        className={cn(
                          "bg-green-600 hover:bg-green-600 text-white font-mono text-[9px] px-1.5 py-0 h-4.5 justify-center shrink-0 cursor-pointer active:scale-90 transition-all",
                          viabilityFilter === 'High' && statusFilter === 'All' && "ring-2 ring-primary ring-offset-1 font-bold shadow-xs"
                        )}
                        title="Filter All Plants to High Viability"
                      >
                        {tabViabilityData.All.High}
                      </Badge>
                      <Badge 
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusFilter('All');
                          setViabilityFilter(prev => (prev === 'Medium' && statusFilter === 'All') ? null : 'Medium');
                        }}
                        className={cn(
                          "bg-yellow-500 hover:bg-yellow-500 text-black font-mono text-[9px] px-1.5 py-0 h-4.5 justify-center shrink-0 cursor-pointer active:scale-90 transition-all",
                          viabilityFilter === 'Medium' && statusFilter === 'All' && "ring-2 ring-primary ring-offset-1 font-bold shadow-xs"
                        )}
                        title="Filter All Plants to Med Viability"
                      >
                        {tabViabilityData.All.Medium}
                      </Badge>
                      <Badge 
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusFilter('All');
                          setViabilityFilter(prev => (prev === 'Low' && statusFilter === 'All') ? null : 'Low');
                        }}
                        className={cn(
                          "bg-red-600 hover:bg-red-600 text-white font-mono text-[9px] px-1.5 py-0 h-4.5 justify-center shrink-0 cursor-pointer active:scale-90 transition-all",
                          viabilityFilter === 'Low' && statusFilter === 'All' && "ring-2 ring-primary ring-offset-1 font-bold shadow-xs"
                        )}
                        title="Filter All Plants to Low Viability"
                      >
                        {tabViabilityData.All.Low}
                      </Badge>
                    </div>

                    {hasDuplicates && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1 rounded-full absolute right-0"
                        onClick={() => setIsDuplicateReviewSheetOpen(true)}
                        title="Review duplicate plants"
                      >
                        <span className="font-bold text-xs">!</span>
                      </Button>
                    )}
                  </div>

                  {/* 4 Columns: Wish, Prep, Grow, Harv (No Totals, Only Viability Pills) */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {([
                      { status: 'Wishlist' as PlantStatus, shortLabel: 'Wish' },
                      { status: 'Planting' as PlantStatus, shortLabel: 'Prep' },
                      { status: 'Growing' as PlantStatus, shortLabel: 'Grow' },
                      { status: 'Harvest' as PlantStatus, shortLabel: 'Harv' },
                    ]).map(({ status, shortLabel }) => {
                      const isSelected = statusFilter === status;
                      const viab = tabViabilityData[status];
                      return (
                        <div
                          key={status}
                          role="tab"
                          aria-selected={isSelected}
                          tabIndex={0}
                          onClick={() => {
                            if (isSelected) {
                              setStatusFilter('All');
                              setViabilityFilter(null);
                            } else {
                              setStatusFilter(status);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              if (isSelected) {
                                setStatusFilter('All');
                                setViabilityFilter(null);
                              } else {
                                setStatusFilter(status);
                              }
                            }
                          }}
                          className={cn(
                            "p-1.5 py-2 rounded-xl border text-center cursor-pointer transition-all active:scale-[0.98] select-none flex flex-col items-center justify-between gap-1.5 min-w-0",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                              : "border-border/80 bg-card hover:border-primary/40"
                          )}
                        >
                          <span className={cn("text-xs font-bold truncate leading-tight w-full", isSelected ? "text-primary" : "text-foreground")}>
                            {shortLabel}
                          </span>
                          <div className="flex items-center justify-center gap-0.5 w-full">
                            <Badge 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (viabilityFilter === 'High' && statusFilter === status) {
                                  setViabilityFilter(null);
                                } else {
                                  setStatusFilter(status);
                                  setViabilityFilter('High');
                                }
                              }}
                              className={cn(
                                "bg-green-600 hover:bg-green-600 text-white font-mono text-[9px] px-1 py-0 h-4 min-w-[18px] justify-center shrink-0 cursor-pointer active:scale-90 transition-transform",
                                viabilityFilter === 'High' && statusFilter === status && "ring-2 ring-foreground font-bold shadow-xs"
                              )}
                              title={`Filter ${status} to High Viability (${viab.High})`}
                            >
                              {viab.High}
                            </Badge>
                            <Badge 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (viabilityFilter === 'Medium' && statusFilter === status) {
                                  setViabilityFilter(null);
                                } else {
                                  setStatusFilter(status);
                                  setViabilityFilter('Medium');
                                }
                              }}
                              className={cn(
                                "bg-yellow-500 hover:bg-yellow-500 text-black font-mono text-[9px] px-1 py-0 h-4 min-w-[18px] justify-center shrink-0 cursor-pointer active:scale-90 transition-transform",
                                viabilityFilter === 'Medium' && statusFilter === status && "ring-2 ring-foreground font-bold shadow-xs"
                              )}
                              title={`Filter ${status} to Med Viability (${viab.Medium})`}
                            >
                              {viab.Medium}
                            </Badge>
                            <Badge 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (viabilityFilter === 'Low' && statusFilter === status) {
                                  setViabilityFilter(null);
                                } else {
                                  setStatusFilter(status);
                                  setViabilityFilter('Low');
                                }
                              }}
                              className={cn(
                                "bg-red-600 hover:bg-red-600 text-white font-mono text-[9px] px-1 py-0 h-4 min-w-[18px] justify-center shrink-0 cursor-pointer active:scale-90 transition-transform",
                                viabilityFilter === 'Low' && statusFilter === status && "ring-2 ring-foreground font-bold shadow-xs"
                              )}
                              title={`Filter ${status} to Low Viability (${viab.Low})`}
                            >
                              {viab.Low}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Desktop Bar: Tabs on Left, Floating Search Bar Horizontally on Right */}
                <div className="hidden sm:flex items-center justify-between gap-4 mb-4">
                  <div className="relative flex-1 min-w-0">
                    <ScrollArea className="w-full whitespace-nowrap">
                      <div role="tablist" aria-label="Filter plants by status" className="flex w-max items-center space-x-2 py-0.5">
                          {allFilters.map((status) => {
                            const isDisplayingViability = activeViabilityTab === status;
                            const tabViability = tabViabilityData[status];
                            const hasViabilityBadges = isDisplayingViability && (
                              tabViability.High > 0 || tabViability.Medium > 0 || tabViability.Low > 0 || tabViability.pending > 0
                            );
                            const shortLabel = status === 'Wishlist' ? 'Wish' : status === 'Planting' ? 'Prep' : status === 'Growing' ? 'Grow' : status === 'Harvest' ? 'Harv' : 'All';

                            return (
                              <div
                                key={status}
                                role="tab"
                                aria-selected={statusFilter === status}
                                tabIndex={0}
                                className={cn(
                                  buttonVariants({
                                    variant: statusFilter === status ? 'default' : 'outline',
                                    size: 'sm'
                                  }),
                                  'h-8 flex-shrink-0 cursor-pointer flex items-center gap-2 p-0 relative select-none rounded-md transition-all active:scale-[0.98]'
                                )}
                                onClick={() => setStatusFilter(status)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setStatusFilter(status);
                                  } else if (e.key === 'ArrowRight') {
                                    e.preventDefault();
                                    const idx = allFilters.indexOf(status);
                                    const next = allFilters[(idx + 1) % allFilters.length];
                                    setStatusFilter(next);
                                  } else if (e.key === 'ArrowLeft') {
                                    e.preventDefault();
                                    const idx = allFilters.indexOf(status);
                                    const prev = allFilters[(idx - 1 + allFilters.length) % allFilters.length];
                                    setStatusFilter(prev);
                                  }
                                }}
                                onMouseEnter={() => setHoveredTab(status)}
                                onMouseLeave={() => setHoveredTab(null)}
                                onFocus={() => setHoveredTab(status)}
                                onBlur={() => setHoveredTab(null)}
                              >
                                {hasViabilityBadges ? (
                                  <>
                                    <div className="pl-3.5 pr-1.5 h-full flex items-center font-medium">
                                      {shortLabel} ({statusCounts[status]})
                                    </div>
                                    <div className="flex items-center gap-1 pr-2">
                                      {tabViability.High > 0 && (
                                        <Badge 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setStatusFilter(status);
                                            setViabilityFilter(prev => (prev === 'High' && statusFilter === status) ? null : 'High');
                                          }}
                                          className={cn(
                                            "bg-green-600 hover:bg-green-600 text-white px-1.5 py-0.5 text-xs font-mono cursor-pointer active:scale-90 transition-all",
                                            viabilityFilter === 'High' && statusFilter === status && "ring-2 ring-white ring-offset-1 font-bold shadow-xs"
                                          )}
                                          title={`Filter ${status} by High Viability`}
                                        >
                                          {tabViability.High} High
                                        </Badge>
                                      )}
                                      {tabViability.Medium > 0 && (
                                        <Badge 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setStatusFilter(status);
                                            setViabilityFilter(prev => (prev === 'Medium' && statusFilter === status) ? null : 'Medium');
                                          }}
                                          className={cn(
                                            "bg-yellow-500 hover:bg-yellow-500 text-black px-1.5 py-0.5 text-xs font-mono cursor-pointer active:scale-90 transition-all",
                                            viabilityFilter === 'Medium' && statusFilter === status && "ring-2 ring-black ring-offset-1 font-bold shadow-xs"
                                          )}
                                          title={`Filter ${status} by Medium Viability`}
                                        >
                                          {tabViability.Medium} Med
                                        </Badge>
                                      )}
                                      {tabViability.Low > 0 && (
                                        <Badge 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setStatusFilter(status);
                                            setViabilityFilter(prev => (prev === 'Low' && statusFilter === status) ? null : 'Low');
                                          }}
                                          className={cn(
                                            "bg-red-600 hover:bg-red-600 text-white px-1.5 py-0.5 text-xs font-mono cursor-pointer active:scale-90 transition-all",
                                            viabilityFilter === 'Low' && statusFilter === status && "ring-2 ring-white ring-offset-1 font-bold shadow-xs"
                                          )}
                                          title={`Filter ${status} by Low Viability`}
                                        >
                                          {tabViability.Low} Low
                                        </Badge>
                                      )}
                                      {tabViability.pending > 0 && (
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "px-1.5 py-0.5 text-xs font-mono",
                                            statusFilter === status ? "border-primary-foreground/40 text-primary-foreground" : "text-muted-foreground"
                                          )}
                                          title={`${tabViability.pending} plants pending AI viability analysis`}
                                        >
                                          {tabViability.pending} pending
                                        </Badge>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <div className="px-3.5 h-full flex items-center font-medium gap-2">
                                    <span>{shortLabel}</span>
                                    <Badge variant="secondary" className="rounded-full px-1.5 py-0.5 text-xs font-mono">
                                      {statusCounts[status]}
                                    </Badge>
                                  </div>
                                )}
                                {status === 'All' && hasDuplicates && (
                                  <Button
                                    variant="destructive"
                                    className="h-6 w-6 p-0 mr-1.5 self-center rounded-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsDuplicateReviewSheetOpen(true);
                                    }}
                                    title="Review duplicate plants"
                                    aria-label="Review duplicate plants"
                                  >
                                    <span className="font-bold text-sm">!</span>
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>

                  {/* Floating Horizontal Search Bar on Desktop */}
                  <div className={cn(
                    "shrink-0 transition-all duration-200",
                    searchQuery.trim().length > 0 ? "w-80 lg:w-96" : "w-64 lg:w-72"
                  )}>
                    <PlantSearchBar
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      statusFilter={statusFilter}
                      onClearStatusFilter={() => setStatusFilter('All')}
                      currentSectionMatchesCount={searchMatches.inCurrentSelection.length}
                      otherSectionMatchesCount={searchMatches.inOtherSections.length}
                      otherGardenMatchesCount={otherGardenSearchMatches.length}
                      totalMatches={searchMatches.all.length}
                    />
                  </div>
                </div>
                
                {/* Active Viability Filter Indicator Chip */}
                {viabilityFilter && (
                  <div className="flex items-center justify-between gap-2 mb-4 p-2.5 rounded-lg bg-muted/60 border border-border/80">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Viability Filter:</span>
                      <Badge className={cn(
                        "text-xs px-2.5 py-0.5 font-semibold",
                        viabilityFilter === 'High' ? "bg-green-600 text-white" :
                        viabilityFilter === 'Medium' ? "bg-yellow-500 text-black" :
                        viabilityFilter === 'N/A' ? "bg-muted text-muted-foreground border border-border" :
                        "bg-red-600 text-white"
                      )}>
                        {viabilityFilter === 'N/A' ? 'No Use / N/A Only' : `${viabilityFilter} Viability Only`}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({sortedAndFilteredPlantings.length} matching)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViabilityFilter(null)}
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Clear Filter</span>
                    </Button>
                  </div>
                )}

                {plantings && plantings.length > 0 ? (
                    <>
                      {searchQuery.trim().length > 0 ? (
                        <div className="space-y-8">
                          {/* Floating Sticky Search Mode Ribbon: Clearly shows user is in Search View with an unmissable exit button */}
                          <div className="sticky top-2 z-30 rounded-xl border border-primary/30 bg-background/95 backdrop-blur-md px-4 py-2.5 shadow-md flex items-center justify-between gap-3 flex-wrap transition-all">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <Badge className="bg-primary text-primary-foreground text-xs font-semibold gap-1.5 py-1 px-2.5 shadow-xs">
                                <Search className="h-3.5 w-3.5" />
                                <span>Search View</span>
                              </Badge>
                              <span className="text-sm font-medium">
                                Results for <strong className="text-foreground">&ldquo;{searchQuery}&rdquo;</strong>
                              </span>
                              {statusFilter !== 'All' ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs cursor-pointer hover:bg-primary/20 gap-1.5 border-primary/40 bg-primary/10 text-primary font-medium select-none"
                                  onClick={() => setStatusFilter('All')}
                                  title="Filtered by current selection. Click to search all sections."
                                >
                                  <span>Filtered: {statusFilter}</span>
                                  <X className="h-3 w-3" />
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground font-mono">
                                  All Sections
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground font-mono">
                                ({searchMatches.all.length} match{searchMatches.all.length === 1 ? '' : 'es'})
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {statusFilter !== 'All' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => setStatusFilter('All')}
                                >
                                  <span>Show All Sections</span>
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 text-xs font-semibold gap-1.5 px-3 rounded-lg shadow-xs hover:bg-destructive/90 transition-all active:scale-95"
                                onClick={() => setSearchQuery('')}
                                title="Exit Search View (Esc)"
                              >
                                <span>Exit Search</span>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          {/* Case A: Filtered by current selection (statusFilter !== 'All') */}
                          {statusFilter !== 'All' ? (
                            <>
                              {/* Section 1: In Current Selection */}
                              <section className="space-y-4">
                                <div className="flex items-center justify-between border-b pb-2">
                                  <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-headline font-semibold flex items-center gap-2">
                                      <span>In {statusFilter}</span>
                                      <Badge variant="secondary" className="font-mono text-xs">
                                        {searchMatches.inCurrentSelection.length}
                                      </Badge>
                                    </h2>
                                    <Badge variant="outline" className="text-xs text-muted-foreground border-dashed">
                                      Current Selection
                                    </Badge>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
                                    onClick={() => setStatusFilter('All')}
                                  >
                                    <span>Show all sections</span>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>

                                {searchMatches.inCurrentSelection.length > 0 ? (
                                  <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {searchMatches.inCurrentSelection.map((p, idx) => (
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
                                          isPriority={idx === 0}
                                          otherPlantings={plantingsWithPlants}
                                           onSwitchGarden={handleSwitchGarden}
                                          viabilityMechanism={viabilityMechanism}
                                          remoteUpdate={checkRemoteUpdateForPlanting(p.id)}
                                          onReviewRemoteUpdate={handleReviewRemoteUpdate}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <Card className="p-5 border-dashed bg-muted/20 text-center space-y-2">
                                    <p className="text-sm font-medium text-foreground">
                                      No plants matching &ldquo;{searchQuery}&rdquo; in <span className="font-semibold">{statusFilter}</span>.
                                    </p>
                                    {searchMatches.inOtherSections.length > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        Found <strong className="text-foreground font-semibold">{searchMatches.inOtherSections.length} match{searchMatches.inOtherSections.length === 1 ? '' : 'es'}</strong> in other sections below!
                                      </p>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs h-7 gap-1 mt-1"
                                      onClick={() => setStatusFilter('All')}
                                    >
                                      <span>Clear {statusFilter} filter and search all sections</span>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </Card>
                                )}
                              </section>

                              {/* Section 2: Results from Other Sections ("actually better results from other sections too") */}
                              {searchMatches.inOtherSections.length > 0 && (
                                <section className="space-y-6 pt-4 border-t">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                      <Layers className="h-4 w-4 text-primary" />
                                      <h2 className="text-lg font-headline font-semibold">
                                        Results from Other Sections
                                      </h2>
                                      <Badge variant="secondary" className="font-mono text-xs">
                                        {searchMatches.inOtherSections.length}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {(['Wishlist', 'Planting', 'Growing', 'Harvest'] as PlantStatus[])
                                        .filter((st) => st !== statusFilter && searchMatches.byStatus[st].length > 0)
                                        .map((st) => (
                                          <Button
                                            key={st}
                                            variant="outline"
                                            size="sm"
                                            className="h-6 text-xs px-2 gap-1.5"
                                            onClick={() => setStatusFilter(st)}
                                            title={`Switch filter to ${st}`}
                                          >
                                            <span>{st}</span>
                                            <Badge variant="secondary" className="h-4 px-1 text-[10px] font-mono">
                                              {searchMatches.byStatus[st].length}
                                            </Badge>
                                          </Button>
                                        ))}
                                    </div>
                                  </div>

                                  <div className="space-y-6">
                                    {(['Wishlist', 'Planting', 'Growing', 'Harvest'] as PlantStatus[])
                                      .filter((st) => st !== statusFilter && searchMatches.byStatus[st].length > 0)
                                      .map((st) => (
                                        <div key={st} className="space-y-3">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <Badge className="font-semibold text-xs">{st}</Badge>
                                              <span className="text-xs text-muted-foreground font-mono">
                                                ({searchMatches.byStatus[st].length} plant{searchMatches.byStatus[st].length === 1 ? '' : 's'})
                                              </span>
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="text-xs h-6 px-2 text-primary hover:bg-primary/10"
                                              onClick={() => setStatusFilter(st)}
                                            >
                                              Switch to {st} tab
                                            </Button>
                                          </div>
                                          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                            {searchMatches.byStatus[st].map((p) => (
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
                                                  otherPlantings={plantingsWithPlants}
                                           onSwitchGarden={handleSwitchGarden}
                                                  viabilityMechanism={viabilityMechanism}
                                          remoteUpdate={checkRemoteUpdateForPlanting(p.id)}
                                          onReviewRemoteUpdate={handleReviewRemoteUpdate}
                                        />
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                </section>
                              )}
                            </>
                          ) : (
                            /* Case B: All Sections (statusFilter === 'All') */
                            <>
                              <div className="flex items-center justify-between border-b pb-2">
                                <div className="flex items-center gap-2">
                                  <h2 className="text-xl font-headline font-semibold">
                                    Matching Plants Across All Sections
                                  </h2>
                                  <Badge variant="secondary" className="font-mono text-xs">
                                    {searchMatches.all.length}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {(['Wishlist', 'Planting', 'Growing', 'Harvest'] as PlantStatus[])
                                    .filter((st) => searchMatches.byStatus[st].length > 0)
                                    .map((st) => (
                                      <Button
                                        key={st}
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-xs px-2 gap-1.5"
                                        onClick={() => setStatusFilter(st)}
                                        title={`Filter search to ${st}`}
                                      >
                                        <span>{st}</span>
                                        <Badge variant="secondary" className="h-4 px-1 text-[10px] font-mono">
                                          {searchMatches.byStatus[st].length}
                                        </Badge>
                                      </Button>
                                    ))}
                                </div>
                              </div>

                              {searchMatches.all.length > 0 ? (
                                <div className="space-y-6">
                                  {(['Wishlist', 'Planting', 'Growing', 'Harvest'] as PlantStatus[])
                                    .filter((st) => searchMatches.byStatus[st].length > 0)
                                    .map((st) => (
                                      <div key={st} className="space-y-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <Badge className="font-semibold text-xs">{st}</Badge>
                                            <span className="text-xs text-muted-foreground font-mono">
                                              ({searchMatches.byStatus[st].length} plant{searchMatches.byStatus[st].length === 1 ? '' : 's'})
                                            </span>
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs h-6 px-2 text-primary hover:bg-primary/10"
                                            onClick={() => setStatusFilter(st)}
                                          >
                                            Filter to {st}
                                          </Button>
                                        </div>
                                        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                          {searchMatches.byStatus[st].map((p, idx) => (
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
                                                isPriority={idx === 0}
                                                otherPlantings={plantingsWithPlants}
                                           onSwitchGarden={handleSwitchGarden}
                                                viabilityMechanism={viabilityMechanism}
                                          remoteUpdate={checkRemoteUpdateForPlanting(p.id)}
                                          onReviewRemoteUpdate={handleReviewRemoteUpdate}
                                        />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              ) : null}
                            </>
                          )}

                          {/* Matches in Other Gardens (if any) */}
                          {otherGardenSearchMatches.length > 0 && (
                            <section className="space-y-4 pt-4 border-t">
                              <div className="flex items-center gap-2">
                                <Fence className="h-4 w-4 text-primary" />
                                <h2 className="text-lg font-headline font-semibold">
                                  Matches in Other Gardens
                                </h2>
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {otherGardenSearchMatches.length}
                                </Badge>
                              </div>

                              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                {otherGardenSearchMatches.map((p) => (
                                  <Card key={p.id} className="p-4 flex items-center justify-between gap-3 bg-muted/30 hover:border-primary/50 transition-colors">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                          {p.garden?.name || 'Other Garden'}
                                        </Badge>
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                          {p.history?.[p.history.length - 1]?.status || 'Wishlist'}
                                        </Badge>
                                      </div>
                                      <h4 className="font-semibold text-sm truncate">{p.name}</h4>
                                      <p className="text-xs text-muted-foreground italic truncate">{p.plant.species}</p>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="shrink-0 text-xs h-8"
                                      onClick={() => {
                                        setActiveLocationId(p.gardenId);
                                        if (gardenViewMode === 'selected') {
                                          setSelectedGardenIds([p.gardenId]);
                                        }
                                      }}
                                    >
                                      Switch Garden
                                    </Button>
                                  </Card>
                                ))}
                              </div>
                            </section>
                          )}

                          {/* Zero Results Across All Sections and Gardens */}
                          {searchMatches.all.length === 0 && otherGardenSearchMatches.length === 0 && (
                            <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed">
                              <CardHeader className="space-y-2">
                                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-2">
                                  <Search className="h-6 w-6" />
                                </div>
                                <CardTitle className="font-headline text-xl">
                                  No plants found matching &ldquo;{searchQuery}&rdquo;
                                </CardTitle>
                                <CardDescription className="max-w-md mx-auto text-sm">
                                  {statusFilter !== 'All'
                                    ? `We checked ${statusFilter} and other sections in this garden, but found no matching plants.`
                                    : 'We searched across all statuses, notes, and care requirements in your garden.'}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="flex flex-col sm:flex-row items-center gap-3">
                                <Button variant="outline" onClick={() => setSearchQuery('')}>
                                  Clear Search
                                </Button>
                                <Button
                                  onClick={() => {
                                    handleOpenAddSheet(statusFilter === 'All' ? 'Wishlist' : statusFilter, 'single');
                                  }}
                                  className="gap-2"
                                >
                                  <Plus className="h-4 w-4" />
                                  <span>Add &ldquo;{searchQuery}&rdquo; to {statusFilter === 'All' ? 'Garden' : statusFilter}</span>
                                </Button>
                              </CardContent>
                            </Card>
                          )}
                          {/* Bottom Exit Bar for long result pages */}
                          {searchMatches.all.length > 0 && (
                            <div className="pt-4 border-t flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
                              <span>
                                Showing {searchMatches.all.length} matching plant{searchMatches.all.length === 1 ? '' : 's'} for &ldquo;{searchQuery}&rdquo;
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 gap-1.5 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                                onClick={() => setSearchQuery('')}
                              >
                                <span>Exit Search View</span>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        statusFilter === 'Wishlist' ? (
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
                                              otherPlantings={plantingsWithPlants}
                                           onSwitchGarden={handleSwitchGarden}
                                              viabilityMechanism={viabilityMechanism}
                                          remoteUpdate={checkRemoteUpdateForPlanting(p.id)}
                                          onReviewRemoteUpdate={handleReviewRemoteUpdate}
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
                                                        otherPlantings={plantingsWithPlants}
                                           onSwitchGarden={handleSwitchGarden}
                                                        viabilityMechanism={viabilityMechanism}
                                          remoteUpdate={checkRemoteUpdateForPlanting(p.id)}
                                          onReviewRemoteUpdate={handleReviewRemoteUpdate}
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
                                                  otherPlantings={plantingsWithPlants}
                                           onSwitchGarden={handleSwitchGarden}
                                                viabilityMechanism={viabilityMechanism}
                                          remoteUpdate={checkRemoteUpdateForPlanting(p.id)}
                                          onReviewRemoteUpdate={handleReviewRemoteUpdate}
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
                                  viabilityMechanism={viabilityMechanism}
                                  onSwitchGarden={handleSwitchGarden}
                                  remotePlantingUpdates={remotePlantingUpdates}
                                  onReviewRemoteUpdate={handleReviewRemoteUpdate}
                              />
                          </div>
                      ) : statusFilter === 'Growing' ? (
                          <div className="space-y-6">
                            {/* In-Ground Vigor & Acute Stress Watch Banner */}
                            <Card className="border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
                              <CardHeader className="p-4 pb-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-xs font-semibold gap-1 px-2 py-0.5">
                                        <span>🌿</span>
                                        <span>Grow Stage</span>
                                      </Badge>
                                      <CardTitle className="text-base sm:text-lg font-headline font-bold">
                                        In-Ground Vigor &amp; Acute Stress Watch
                                      </CardTitle>
                                    </div>
                                    <CardDescription className="text-xs">
                                      Continuous vegetative health monitoring and root-zone stress detection.
                                    </CardDescription>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge className="bg-green-600/90 text-white font-mono text-xs px-2 py-0.5">
                                      {growingAnalysis?.thriving.length ?? 0} Thriving
                                    </Badge>
                                    {(growingAnalysis?.stressed.length ?? 0) > 0 ? (
                                      <Badge className="bg-amber-600 text-white font-mono text-xs px-2 py-0.5 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        <span>{growingAnalysis?.stressed.length} Stress Alerts</span>
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-emerald-600 border-emerald-500/40 text-xs px-2 py-0.5">
                                        0 Stress Alerts
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </CardHeader>
                              {growingAnalysis && growingAnalysis.stressed.length > 0 && (
                                <CardContent className="p-4 pt-0 space-y-2">
                                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                                    <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                      <span>Active Acute Environmental Stressors &amp; Tending Priorities:</span>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {growingAnalysis.stressed.map(({ planting, data }) => (
                                        <div key={planting.id} className="text-xs rounded-md bg-background/80 border border-amber-500/20 p-2.5 space-y-1">
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="font-semibold text-foreground truncate">{planting.name}</span>
                                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40 font-mono shrink-0">
                                              {data.stressFactor}
                                            </Badge>
                                          </div>
                                          <p className="text-[11px] text-muted-foreground leading-snug">
                                            {data.tendingAdvice}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </CardContent>
                              )}
                            </Card>

                            {sortedAndFilteredPlantings.length > 0 ? (
                                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {sortedAndFilteredPlantings.map((p, idx) => (
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
                                              isPriority={idx === 0}
                                              otherPlantings={plantingsWithPlants}
                                           onSwitchGarden={handleSwitchGarden}
                                              viabilityMechanism={viabilityMechanism}
                                          remoteUpdate={checkRemoteUpdateForPlanting(p.id)}
                                          onReviewRemoteUpdate={handleReviewRemoteUpdate}
                                        />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
                                    <CardHeader>
                                        <CardTitle className="font-headline">No Growing Plants Found</CardTitle>
                                        <CardDescription>
                                            {viabilityFilter ? `No growing plants matching ${viabilityFilter} viability.` : 'No plants currently growing in your garden.'}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            )}
                          </div>
                      ) : statusFilter === 'Harvest' ? (
                          <div className="space-y-6">
                            {/* Harvest Readiness & Bed Turnover Banner */}
                            <Card className="border-purple-500/30 bg-purple-500/5 overflow-hidden">
                              <CardHeader className="p-4 pb-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <Badge className="bg-purple-600 hover:bg-purple-600 text-white text-xs font-semibold gap-1 px-2 py-0.5">
                                        <span>🧺</span>
                                        <span>Harv Stage</span>
                                      </Badge>
                                      <CardTitle className="text-base sm:text-lg font-headline font-bold">
                                        Harvest Readiness &amp; Bed Turnover
                                      </CardTitle>
                                    </div>
                                    <CardDescription className="text-xs">
                                      Ripeness windows, pick deadlines, and succession planting for vacated beds.
                                    </CardDescription>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge className="bg-purple-600 text-white font-mono text-xs px-2 py-0.5">
                                      {harvestAnalysis?.peak.length ?? 0} Peak Window
                                    </Badge>
                                    {(harvestAnalysis?.urgent.length ?? 0) > 0 && (
                                      <Badge className="bg-amber-600 text-white font-mono text-xs px-2 py-0.5 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        <span>{harvestAnalysis?.urgent.length} Urgent / Approaching End</span>
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </CardHeader>
                              {harvestAnalysis && harvestAnalysis.harvestPlants.length > 0 && (
                                <CardContent className="p-4 pt-0 space-y-2">
                                  <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 space-y-2">
                                    <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                                      <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                                      <span>Succession Recommendations for Vacated Beds:</span>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {harvestAnalysis.harvestPlants.slice(0, 4).map((p) => {
                                        const hData = analyzeHarvestViability(p.plant, activeLocation?.conditions, {
                                          growingSystems: p.garden?.growingSystems,
                                          growingMethods: p.garden?.growingMethods,
                                          propagationMethod: p.propagationMethod,
                                        });
                                        return (
                                          <div key={p.id} className="text-xs rounded-md bg-background/80 border border-purple-500/20 p-2.5 space-y-1">
                                            <div className="flex items-center justify-between gap-1">
                                              <span className="font-semibold text-foreground truncate">{p.name}</span>
                                              <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-500/40 font-mono shrink-0">
                                                {hData.harvestWindow}
                                              </Badge>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground leading-snug">
                                              {hData.successionAdvice}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </CardContent>
                              )}
                            </Card>

                            {sortedAndFilteredPlantings.length > 0 ? (
                                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {sortedAndFilteredPlantings.map((p, idx) => (
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
                                              isPriority={idx === 0}
                                              otherPlantings={plantingsWithPlants}
                                           onSwitchGarden={handleSwitchGarden}
                                              viabilityMechanism={viabilityMechanism}
                                          remoteUpdate={checkRemoteUpdateForPlanting(p.id)}
                                          onReviewRemoteUpdate={handleReviewRemoteUpdate}
                                        />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
                                    <CardHeader>
                                        <CardTitle className="font-headline">No Harvest-Ready Plants Found</CardTitle>
                                        <CardDescription>
                                            {viabilityFilter ? `No harvest plants matching ${viabilityFilter} viability.` : 'No plants currently in harvest status.'}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            )}
                          </div>
                      ) : (
                          sortedAndFilteredPlantings.length > 0 ? (
                              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                  {sortedAndFilteredPlantings.map((p, idx) => (
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
                                            isPriority={idx === 0}
                                            otherPlantings={plantingsWithPlants}
                                           onSwitchGarden={handleSwitchGarden}
                                          viabilityMechanism={viabilityMechanism}
                                          remoteUpdate={checkRemoteUpdateForPlanting(p.id)}
                                          onReviewRemoteUpdate={handleReviewRemoteUpdate}
                                        />
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
                                  <CardHeader>
                                      <CardTitle className="font-headline">No Plants Found</CardTitle>
                                      <CardDescription>
                                          {viabilityFilter ? `No plants matching ${viabilityFilter} viability.` : `No plants with the status "${statusFilter}".`}
                                      </CardDescription>
                                  </CardHeader>
                              </Card>
                          )
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
            setUnifiedImportTab('packs');
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
        allPlantings={plantingsWithPlants}
        allLocations={locations || []}
        initialDataset={preloadedDatasetForReview}
        onClearInitialDataset={() => setPreloadedDatasetForReview(null)}
        plantingToEdit={plantingToEdit}
        defaultStatus={newPlantDefaultStatus}
        onPlantSubmit={plantingToEdit ? handleUpdatePlant : handleAddPlant}
        onConfigureApiKey={() => {
            setIsAiImportSheetOpen(false);
            setIsSettingsSheetOpen(true);
        }}
        onApiKeysChange={handleApiKeysChange}
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
          getFieldShareInfo={multiGardenEnvAnalysis.getFieldShareInfo}
          onApplyFieldToAll={handleApplyFieldToAllSelectedGardens}
        />
      )}
      
      <PreOperationRemoteConflictDialog
        open={pendingConflictDialog.open}
        onOpenChange={(open) => setPendingConflictDialog(prev => ({ ...prev, open }))}
        update={pendingConflictDialog.update}
        operationLabel={pendingConflictDialog.operationLabel}
        onSyncRemoteFirst={async () => {
          if (pendingConflictDialog.update) {
            await applyRemoteUpdateForPlanting(pendingConflictDialog.update.localPlantingId);
          }
          setPendingConflictDialog(prev => ({ ...prev, open: false, update: null }));
        }}
        onProceedAnyway={async () => {
          const proceed = pendingConflictDialog.onProceed;
          setPendingConflictDialog(prev => ({ ...prev, open: false, update: null }));
          await proceed();
        }}
      />
    </div>
  );
}
