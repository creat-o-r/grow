
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Replace,
  PlusCircle,
  Wand2,
  RefreshCw,
  Trash2,
  ExternalLink,
  Square,
  GitMerge,
  Check,
  Eye,
  Plus,
  Download,
  Upload,
  ClipboardPaste,
  Sprout,
  Radio,
  Share2,
  Link2,
} from 'lucide-react';
import { createDataset } from '@/ai/flows/create-dataset-flow';
import { aiSearchPlantData } from '@/ai/flows/ai-search-plant-data';
import { getCuratedPlantImage, resolveRealPlantImage } from '@/lib/plant-images';
import type {
  AiDataset,
  AiLog,
  Plant,
  Planting,
  PlantingWithPlant,
  GardenLocation,
  FreeLlmConfig,
  StatusHistory,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { ToastAction } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PlantForm } from '@/components/PlantForm';
import { availableDatasets, loadDataset } from '@/lib/datasets';
import { decodeSeedPackFromInput, buildShareableSeedPackUrl } from '@/lib/seed-pack';
import {
  getSavedP2PRoomId,
  saveP2PRoomId,
  broadcastGardenToP2PRoom,
  fetchLatestFromP2PRoom,
  subscribeToP2PGardenRoom,
} from '@/lib/p2p-signals';

type ImportMode = 'replace' | 'add' | 'new';
export type UnifiedImportTab = 'single' | 'ai-generate' | 'import-pack';

export type DuplicateResolution = {
  newPlanting: Planting;
  newPlant: Plant;
  existingPlanting: PlantingWithPlant;
  action: 'merge' | 'add' | 'skip';
};

type AiDataImportSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialTab?: UnifiedImportTab;
  apiKeys: FreeLlmConfig;
  areApiKeysSet: boolean;
  onComplete: () => void;
  activeLocation?: GardenLocation | null;
  existingPlantings?: PlantingWithPlant[];
  initialDataset?: { data: AiDataset; title: string } | null;
  onClearInitialDataset?: () => void;
  // Single Plant (PlantForm) & Export props for unified hub:
  plantingToEdit?: PlantingWithPlant | null;
  defaultStatus?: StatusHistory['status'];
  onPlantSubmit?: (plantingData: any, plantData: any) => void;
  onConfigureApiKey?: () => void;
  plants?: Plant[];
  onPublish?: () => void;
};

export function AiDataImportSheet({
  isOpen,
  onOpenChange,
  initialTab = 'single',
  apiKeys,
  areApiKeysSet,
  onComplete,
  activeLocation,
  existingPlantings,
  initialDataset,
  onClearInitialDataset,
  plantingToEdit,
  defaultStatus = 'Wishlist',
  onPlantSubmit,
  onConfigureApiKey,
  plants = [],
  onPublish,
}: AiDataImportSheetProps) {
  const [activeTab, setActiveTab] = useState<UnifiedImportTab>(initialTab);
  const [theme, setTheme] = useState('');
  const [refinement, setRefinement] = useState('');
  const [generatedData, setGeneratedData] = useState<AiDataset | null>(null);
  const [loadedPackTitle, setLoadedPackTitle] = useState<string | null>(null);
  const [clipboardInput, setClipboardInput] = useState('');
  const [p2pRoomId, setP2pRoomId] = useState('');
  const [shareScope, setShareScope] = useState<'active' | 'all'>('active');
  const [isP2pSyncing, setIsP2pSyncing] = useState(false);
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
    } else {
      setImportMode('new');
    }
  }, [activeLocation, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setP2pRoomId(getSavedP2PRoomId());
      if (plantingToEdit) {
        setActiveTab('single');
      } else if (initialDataset?.data) {
        setActiveTab('import-pack');
        setGeneratedData(initialDataset.data);
        setLoadedPackTitle(initialDataset.title);
        setTheme(initialDataset.title);
        setIncludedVariationIds(new Set());
        setError(null);
      } else if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab, plantingToEdit, initialDataset]);

  useEffect(() => {
    if (!isOpen || !p2pRoomId.trim()) return;
    saveP2PRoomId(p2pRoomId);
    const unsubscribe = subscribeToP2PGardenRoom(p2pRoomId, (peerDataset, peerName) => {
      const packName = `${peerDataset.locations?.[0]?.name || 'Shared Garden'} (from ${peerName})`;
      setGeneratedData(peerDataset);
      setLoadedPackTitle(packName);
      setTheme(packName);
      setIncludedVariationIds(new Set());
      toast({
        title: `Live P2P Garden Received`,
        description: `${peerName} broadcasted "${peerDataset.locations?.[0]?.name || 'Garden'}" (${peerDataset.plantings?.length || 0} plants). Review below to import!`,
      });
    });
    return unsubscribe;
  }, [isOpen, p2pRoomId, toast]);

  const buildCurrentGardenDataset = async (scope: 'active' | 'all' = shareScope): Promise<AiDataset | null> => {
    const allLocations = await db.locations.toArray();
    if (allLocations.length === 0) return null;

    if (scope === 'all') {
      const allPlants = await db.plants.toArray();
      const allPlantings = await db.plantings.toArray();
      return {
        locations: allLocations,
        plants: allPlants,
        plantings: allPlantings,
      };
    }

    const targetLoc = activeLocation || allLocations[0];
    if (!targetLoc) return null;
    const gardenPlantings = await db.plantings.where('gardenId').equals(targetLoc.id).toArray();
    const plantIds = new Set(gardenPlantings.map((p) => p.plantId));
    const allPlants = await db.plants.toArray();
    const gardenPlants = allPlants.filter((p) => plantIds.has(p.id));
    return {
      locations: [targetLoc],
      plants: gardenPlants,
      plantings: gardenPlantings,
    };
  };

  const handleCopyShareablePackLink = async () => {
    try {
      const ds = await buildCurrentGardenDataset(shareScope);
      if (!ds) {
        toast({
          title: 'No Gardens Found',
          description: 'Create or select a garden first to share a ?pack= link.',
          variant: 'destructive',
        });
        return;
      }
      const url = buildShareableSeedPackUrl(ds);
      await navigator.clipboard.writeText(url);
      const label =
        ds.locations.length > 1
          ? `All ${ds.locations.length} Gardens`
          : `"${ds.locations[0].name}"`;
      toast({
        title: 'Shareable ?pack= Link Copied!',
        description: `Copied permalink for ${label} (${ds.plantings.length} plants). Open it in any browser or session to import.`,
      });
    } catch (err: any) {
      toast({
        title: 'Could Not Copy Link',
        description: err?.message || 'Failed to build shareable link.',
        variant: 'destructive',
      });
    }
  };

  const handlePushToP2PRoom = async () => {
    if (!p2pRoomId.trim()) return;
    setIsP2pSyncing(true);
    setError(null);
    try {
      saveP2PRoomId(p2pRoomId);
      const ds = await buildCurrentGardenDataset(shareScope);
      if (!ds) {
        throw new Error('No gardens found to broadcast.');
      }
      await broadcastGardenToP2PRoom(p2pRoomId, ds);
      const label =
        ds.locations.length > 1
          ? `All ${ds.locations.length} Gardens`
          : `"${ds.locations[0].name}"`;
      toast({
        title: `Streamed to Room "${p2pRoomId.trim()}"`,
        description: `${label} (${ds.plantings.length} plants) is now live on the P2P room across tabs, sessions, and devices.`,
      });
    } catch (err: any) {
      setError(err?.message || 'Could not broadcast to P2P room.');
    } finally {
      setIsP2pSyncing(false);
    }
  };

  const handlePullFromP2PRoom = async () => {
    if (!p2pRoomId.trim()) return;
    setIsP2pSyncing(true);
    setError(null);
    try {
      saveP2PRoomId(p2pRoomId);
      const latest = await fetchLatestFromP2PRoom(p2pRoomId);
      if (!latest) {
        toast({
          title: 'No Snapshot Found in Room',
          description: `No garden has been pushed to room "${p2pRoomId.trim()}" in the last 24h yet. Click "Push Active Garden" from another session first.`,
          variant: 'destructive',
        });
        return;
      }
      const packName = `${latest.dataset.locations?.[0]?.name || 'P2P Garden'} (${latest.peerName})`;
      setGeneratedData(latest.dataset);
      setLoadedPackTitle(packName);
      setTheme(packName);
      setIncludedVariationIds(new Set());
      toast({
        title: `Pulled "${latest.dataset.locations?.[0]?.name || 'Garden'}"`,
        description: `Loaded ${latest.dataset.plantings?.length || 0} plants from ${latest.peerName}. Review and choose your import mode below.`,
      });
    } catch (err: any) {
      setError(err?.message || 'Could not pull from P2P room.');
    } finally {
      setIsP2pSyncing(false);
    }
  };

  const handleLoadStarterDataset = async (datasetKey: string) => {
    try {
      setError(null);
      const ds = await loadDataset(datasetKey);
      setGeneratedData(ds);
      setLoadedPackTitle(ds.name);
      setTheme(ds.name);
      setIncludedVariationIds(new Set());
      toast({
        title: `Loaded "${ds.name}"`,
        description: `Review ${ds.plantings.length} plants below and choose how to import them.`,
      });
    } catch (err: any) {
      setError(err?.message || 'Could not load starter dataset.');
    }
  };

  const handleDecodeClipboardPack = () => {
    if (!clipboardInput.trim()) return;
    try {
      setError(null);
      const decoded = decodeSeedPackFromInput(clipboardInput);
      const packName = decoded.locations?.[0]?.name || 'Imported Seed Pack';
      setGeneratedData(decoded);
      setLoadedPackTitle(packName);
      setTheme(packName);
      setClipboardInput('');
      setIncludedVariationIds(new Set());
      toast({
        title: `Loaded "${packName}"`,
        description: `Review ${decoded.plantings?.length || 0} plants below and choose your garden import option.`,
      });
    } catch {
      setError('Invalid Seed Pack or JSON. Paste a valid ?pack= shareable link or JSON exported from Grow.');
    }
  };

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
      setLoadedPackTitle(null);
      setClipboardInput('');
      setError(null);
      setImportMode(activeLocation ? 'add' : 'new');
      setIsGenerating(false);
      setIsImporting(false);
      setIncludedVariationIds(new Set());
      setPendingDuplicates([]);
      setIsMergeModalOpen(false);
      onClearInitialDataset?.();
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
          await db.plantings.bulkAdd(
            generatedData.plantings.map((p) => ({
              ...p,
              seedsOnHand: p.seedsOnHand ?? 0,
              plannedQty: p.plannedQty ?? 0,
            }))
          );

          if (typeof window !== 'undefined' && generatedData.locations[0]?.id) {
            localStorage.setItem('grow_activeLocation', generatedData.locations[0].id);
          }

          toast({
            title: 'Import Successful',
            description: 'Your garden has been replaced with the new dataset.',
          });

        } else if (importMode === 'new') {
            const now = Date.now();
            const idSuffix = `-${now}-${Math.random().toString(36).substring(2, 6)}`;

            const locationIdMap = new Map<string, string>();
            const newLocations: GardenLocation[] = (generatedData.locations || []).map((loc, idx) => {
              const newLocId = `garden-${now}-${idx}`;
              locationIdMap.set(loc.id, newLocId);
              return {
                ...loc,
                id: newLocId,
              };
            });

            const fallbackGardenId = newLocations[0]?.id || `garden-${now}`;

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
              gardenId: locationIdMap.get(p.gardenId) || fallbackGardenId,
              seedsOnHand: p.seedsOnHand ?? 0,
              plannedQty: p.plannedQty ?? 0,
            }));

          if (newLocations.length > 0) {
            await db.locations.bulkAdd(newLocations);
          }
          await db.plants.bulkAdd(newPlants);
          await db.plantings.bulkAdd(newPlantings);

          if (typeof window !== 'undefined') {
            localStorage.setItem('grow_activeLocation', fallbackGardenId);
          }

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
              plannedQty: (existing.plannedQty ?? 0) + (newPlanting.plannedQty ?? 0),
              seedsOnHand: (existing.seedsOnHand ?? 0) + (newPlanting.seedsOnHand ?? 0),
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
              seedsOnHand: newPlanting.seedsOnHand ?? 0,
              plannedQty: newPlanting.plannedQty ?? 0,
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
          <SheetTitle className="font-headline">
            {plantingToEdit
              ? `Edit Plant: ${plantingToEdit.name}`
              : 'Add Plants & Import Garden Datasets'}
          </SheetTitle>
          <SheetDescription>
            {plantingToEdit
              ? 'Update plant details, AI search species info, or log status history.'
              : 'Add a single plant (with AI search or camera scan), generate a custom dataset with AI, or import a starter pack / shared seed link.'}
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setError(null);
            setActiveTab(val as UnifiedImportTab);
          }}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid w-full grid-cols-3 mb-2">
            <TabsTrigger value="single" className="text-xs sm:text-sm gap-1.5">
              <Sprout className="h-3.5 w-3.5 shrink-0" />
              <span>{plantingToEdit ? 'Edit Plant' : 'Single Plant'}</span>
            </TabsTrigger>
            <TabsTrigger value="ai-generate" className="text-xs sm:text-sm gap-1.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Generate with AI</span>
            </TabsTrigger>
            <TabsTrigger value="import-pack" className="text-xs sm:text-sm gap-1.5">
              <Upload className="h-3.5 w-3.5 shrink-0" />
              <span>Import Dataset</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-6 -mr-6">
            {/* TAB 1: SINGLE PLANT (AI Search, Camera Scan, Species Selector, Status History) */}
            <TabsContent value="single" className="mt-0">
              {onPlantSubmit ? (
                <PlantForm
                  plantingToEdit={plantingToEdit}
                  defaultStatus={defaultStatus}
                  onSubmit={(plantingData, plantData) => {
                    onPlantSubmit(plantingData, plantData);
                    handleClose();
                  }}
                  onConfigureApiKey={() => {
                    handleClose();
                    onConfigureApiKey?.();
                  }}
                  onSwitchToAiGenerateTab={() => setActiveTab('ai-generate')}
                  onSwitchToImportTab={() => setActiveTab('import-pack')}
                  areApiKeysSet={areApiKeysSet}
                  apiKeys={apiKeys}
                  plants={plants}
                />
              ) : null}
            </TabsContent>

            {/* TAB 2 & TAB 3: GENERATE WITH AI & IMPORT DATASET / SEED PACK */}
            <div className={activeTab === 'single' ? 'hidden' : 'space-y-6 py-4'}>
              {activeTab === 'ai-generate' && (
                <div className="space-y-4">
                  {!areApiKeysSet ? (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>AI Key Required</AlertTitle>
                      <AlertDescription className="flex flex-col gap-2">
                        <span>
                          Save a free AI provider key (Gemini, Groq, OpenRouter, or Local Ollama) in Settings to generate custom datasets with AI.
                        </span>
                        {onConfigureApiKey && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-fit"
                            onClick={() => {
                              handleClose();
                              onConfigureApiKey();
                            }}
                          >
                            Configure Free AI Key in Settings
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="font-headline text-lg flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span>Generate a Garden Dataset with AI</span>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Describe a garden theme, microclimate, or culinary goal and refine it conversationally.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="ai-theme">Garden Theme</Label>
                          <div className="flex gap-2">
                            <Input
                              id="ai-theme"
                              placeholder="e.g., A beginner-friendly herb garden, shady balcony greens..."
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
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {activeTab === 'import-pack' && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="font-headline text-lg">
                        Starter & Regional Datasets
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Select any starter dataset below to preview its plants, inspect variations against your garden, and choose how to import.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {availableDatasets.map((dataset) => {
                          const isSelected = loadedPackTitle === dataset.name;
                          return (
                            <Button
                              key={dataset.key}
                              type="button"
                              onClick={() => handleLoadStarterDataset(dataset.key)}
                              variant={isSelected ? 'default' : 'outline'}
                              size="sm"
                              className="justify-start h-auto py-2.5 px-3 text-left flex flex-col items-start gap-0.5"
                            >
                              <span className="font-medium flex items-center gap-1.5 text-xs sm:text-sm">
                                <Download className="h-3.5 w-3.5 shrink-0" />
                                <span>{dataset.name}</span>
                              </span>
                              <span
                                className={
                                  isSelected
                                    ? 'text-[11px] text-primary-foreground/80 line-clamp-1 font-normal'
                                    : 'text-[11px] text-muted-foreground line-clamp-1 font-normal'
                                }
                              >
                                {dataset.description}
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/25">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-headline text-lg flex items-center gap-2">
                        <Radio className="h-4 w-4 text-primary" />
                        <span>P2P Garden Sharing & Cross-Session Sync</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Share your active garden via a 1-click <code>?pack=</code> link, or use a shared Room Code to push &amp; pull gardens across browsers, sessions, and devices ($0 server cost).
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2">
                        <span className="text-xs font-medium text-muted-foreground">What to Stream / Share:</span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={shareScope === 'active' ? 'default' : 'ghost'}
                            className="h-7 text-xs px-2.5"
                            onClick={() => setShareScope('active')}
                          >
                            Active Garden ({activeLocation?.name || 'Current'})
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={shareScope === 'all' ? 'default' : 'ghost'}
                            className="h-7 text-xs px-2.5"
                            onClick={() => setShareScope('all')}
                          >
                            All Existing Gardens
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleCopyShareablePackLink}
                          className="flex-1"
                        >
                          <Link2 className="mr-2 h-4 w-4" />
                          Copy 1-Click Shareable ?pack= Link
                        </Button>
                        {onPublish && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={onPublish}
                            className="sm:w-auto"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Export JSON to Clipboard
                          </Button>
                        )}
                      </div>

                      <div className="border-t pt-3 space-y-2">
                        <Label htmlFor="p2p-room-input" className="text-xs flex items-center justify-between">
                          <span>Cross-Session P2P Sync Room Code</span>
                          {p2pRoomId.trim() && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-primary border-primary/30">
                              Room Active
                            </Badge>
                          )}
                        </Label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            id="p2p-room-input"
                            placeholder="e.g., my-garden-sync-2026"
                            value={p2pRoomId}
                            onChange={(e) => setP2pRoomId(e.target.value)}
                            className="font-mono text-xs flex-1"
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handlePushToP2PRoom}
                              disabled={!p2pRoomId.trim() || isP2pSyncing}
                              className="h-10 text-xs flex-1 sm:flex-initial"
                              title="Broadcast active garden to this room so other sessions/devices can pull it"
                            >
                              {isP2pSyncing ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Share2 className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              {shareScope === 'all' ? 'Stream All Gardens' : 'Stream Active Garden'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={handlePullFromP2PRoom}
                              disabled={!p2pRoomId.trim() || isP2pSyncing}
                              className="h-10 text-xs flex-1 sm:flex-initial"
                              title="Pull the latest broadcasted garden from this room into the Review & Import options below"
                            >
                              {isP2pSyncing ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Pull Latest from Room
                            </Button>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Works across tabs instantly via <code>BroadcastChannel</code> and across different browsers, incognito sessions, or devices for 24h via encrypted-slug public relay.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="font-headline text-lg">
                        Import from Seed Pack Link or Clipboard JSON
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Paste a shareable <code>?pack=...</code> URL or exported JSON backup to review and import into your garden.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        placeholder="Paste ?pack=... URL or exported JSON here..."
                        value={clipboardInput}
                        onChange={(e) => setClipboardInput(e.target.value)}
                        rows={3}
                        className="font-mono text-xs"
                      />
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          type="button"
                          onClick={handleDecodeClipboardPack}
                          disabled={!clipboardInput.trim()}
                          className="flex-1"
                        >
                          <ClipboardPaste className="mr-2 h-4 w-4" />
                          Load Pack for Review & Import
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>An Error Occurred</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {isGenerating && !generatedData && (
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

              {/* UNIFIED REVIEW & 3-MODE GARDEN IMPORT OPTIONS (shared by AI Generate & Dataset/Seed Pack Import) */}
              {generatedData && (
                <div className="space-y-6 animate-in fade-in-50 border-t pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-lg">
                        {importMode === 'add' && activeLocation
                          ? `Review Plants for "${activeLocation.name}"`
                          : 'Review Your New Garden'}
                      </h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => {
                          setGeneratedData(null);
                          setLoadedPackTitle(null);
                        }}
                      >
                        Clear Review
                      </Button>
                    </div>
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
                            <p className="text-sm text-muted-foreground">
                              {activeLocation.conditions.temperature || 'Temp not set'}, {activeLocation.conditions.sunlight || 'Sunlight not set'}, {activeLocation.conditions.soil || 'Soil not set'}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-muted-foreground">{generatedData.locations[0].location}</p>
                            <p className="text-sm text-muted-foreground">
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
                              {recommendedPlantings.map((planting) => {
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
                                        {areApiKeysSet && (
                                          isFetchingMore === plant.id ? (
                                            <Button variant="destructive" size="sm" className="h-7 text-xs flex items-center gap-1" onClick={handleStopFetchMore}>
                                              <Square className="h-3 w-3 fill-current" />
                                              Stop
                                            </Button>
                                          ) : (
                                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleFetchMoreLikeThis(plant)} disabled={!!isFetchingMore}>
                                              <RefreshCw className="mr-2 h-3 w-3" />
                                              More like this
                                            </Button>
                                          )
                                        )}
                                        <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => handleRemovePlanting(planting.id)}>
                                          <Trash2 className="mr-2 h-3 w-3" />
                                          Remove
                                        </Button>
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                );
                              })}
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
                            {variationPlantings.map((planting) => {
                              const plant = generatedPlantMap.get(planting.plantId);
                              if (!plant) return null;
                              const isIncluded = includedVariationIds.has(planting.id);
                              const matchingExisting = existingPlantings?.find(
                                (ep) =>
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
                                      <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-foreground/90">
                                        <span className="font-semibold text-amber-700 dark:text-amber-400">Strong Match: </span>
                                        <span>{plant.variationReason || `Matches existing planting "${matchingExisting?.name}". Include if you wish to grow this variation.`}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={isIncluded ? 'default' : 'outline'}
                                        className="h-7 text-xs px-2.5"
                                        onClick={() => toggleVariationInclusion(planting.id)}
                                      >
                                        {isIncluded ? <CheckCircle className="mr-1 h-3 w-3" /> : <PlusCircle className="mr-1 h-3 w-3" />}
                                        {isIncluded ? 'Included' : 'Include'}
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

                  {areApiKeysSet && (
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
                  )}

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Garden Import Options</h3>
                    <RadioGroup value={importMode} onValueChange={(value) => setImportMode(value as ImportMode)}>
                      {activeLocation && (
                        <Label htmlFor="r2" className="flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary">
                          <RadioGroupItem value="add" id="r2" />
                          <div className="flex flex-col">
                            <span className="font-bold flex items-center gap-2"><PlusCircle /> Add Plants to Active Garden</span>
                            <span className="text-sm text-muted-foreground">Adds new plants to your active garden "{activeLocation.name}". Prompts to merge or skip duplicates.</span>
                          </div>
                        </Label>
                      )}
                      <Label htmlFor="r3" className="flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary">
                        <RadioGroupItem value="new" id="r3" />
                        <div className="flex flex-col">
                          <span className="font-bold flex items-center gap-2"><Wand2 /> Create as New Garden</span>
                          <span className="text-sm text-muted-foreground">Adds the new location and plants without affecting existing data.</span>
                        </div>
                      </Label>
                      <Label htmlFor="r1" className="flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary">
                        <RadioGroupItem value="replace" id="r1" />
                        <div className="flex flex-col">
                          <span className="font-bold flex items-center gap-2"><Replace /> Replace Current Garden</span>
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
        </Tabs>
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

    
    
    
