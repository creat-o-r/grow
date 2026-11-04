
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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

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
  User,
  KeyRound,
  X,
  Package,
  ShieldCheck,
  History,
  Smartphone,
  Users,
  CheckCircle2,
  ArrowRight,
  Lock,
  Unlock,
  RotateCcw,
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
import { decodeSeedPackFromInput, buildShareableSeedPackUrl, toSpeciesUid } from '@/lib/seed-pack';
import {
  getSavedP2PRoomId,
  saveP2PRoomId,
  getInwardStreamMode,
  saveInwardStreamMode,
  type InwardStreamMode,
  getTrustedGrowers,
  saveTrustedGrowers,
  addTrustedGrower,
  removeTrustedGrower,
  isGrowerTrusted,
  getAutoMergePreference,
  saveAutoMergePreference,
  getAutoStreamPreference,
  saveAutoStreamPreference,
  broadcastGardenToP2PRoom,
  fetchLatestFromP2PRoom,
  subscribeToP2PGardenRoom,
  inspectP2PRoom,
  fingerprintDataset,
  getOrCreateGrowerIdentity,
  updateGrowerIdentity,
  claimGrowerHandle,
  updateDeviceExtension,
  resetGrowerIdentity,
  formatGrowerAddress,
  parseGrowerAddress,
  type LocalGrowerIdentity,
} from '@/lib/p2p-signals';
import { notifyP2PRoomChanged, notifyTrustedGrowersChanged } from '@/hooks/useP2PRoomLiveSync';
import {
  computeGardenDiscrepancy,
  applyGardenDiscrepancies,
  getSyncActivityLog,
  type GardenDiscrepancy,
  type SyncActivityEvent,
} from '@/lib/sync-diff';
import type { GardenSyncTopology } from '@/lib/types';

type ImportMode = 'replace' | 'add' | 'new';
export type UnifiedImportTab = 'single' | 'ai-generate' | 'packs' | 'live-sync' | 'import-pack';
export type DataShareSubTab = 'p2p-room' | 'share-link' | 'starter-packs';

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
  initialSubTab?: DataShareSubTab;
  apiKeys: FreeLlmConfig;
  areApiKeysSet: boolean;
  onComplete: () => void;
  activeLocation?: GardenLocation | null;
  existingPlantings?: PlantingWithPlant[];
  allPlantings?: PlantingWithPlant[];
  allLocations?: GardenLocation[];
  initialDataset?: { data: AiDataset; title: string } | null;
  onClearInitialDataset?: () => void;
  // Single Plant (PlantForm) & Export props for unified hub:
  plantingToEdit?: PlantingWithPlant | null;
  defaultStatus?: StatusHistory['status'];
  onPlantSubmit?: (plantingData: any, plantData: any) => void;
  onConfigureApiKey?: () => void;
  onApiKeysChange?: (keys: FreeLlmConfig) => void;
  plants?: Plant[];
  onPublish?: () => void;
};

export function AiDataImportSheet({
  isOpen,
  onOpenChange,
  initialTab = 'single',
  initialSubTab = 'p2p-room',
  apiKeys,
  areApiKeysSet,
  onComplete,
  activeLocation,
  existingPlantings,
  allPlantings,
  allLocations,
  initialDataset,
  onClearInitialDataset,
  plantingToEdit,
  defaultStatus = 'Wishlist',
  onPlantSubmit,
  onConfigureApiKey,
  onApiKeysChange,
  plants = [],
  onPublish,
}: AiDataImportSheetProps) {
  const [activeTab, setActiveTab] = useState<UnifiedImportTab>(initialTab);
  const [dataShareSubTab, setDataShareSubTab] = useState<DataShareSubTab>(initialSubTab);
  const [theme, setTheme] = useState('');
  const [refinement, setRefinement] = useState('');
  const [generatedData, setGeneratedData] = useState<AiDataset | null>(null);
  const [loadedPackTitle, setLoadedPackTitle] = useState<string | null>(null);
  const [clipboardInput, setClipboardInput] = useState('');
  const [p2pRoomId, setP2pRoomId] = useState('');
  const [shareScope, setShareScope] = useState<'active' | 'all'>('all');
  const [isP2pSyncing, setIsP2pSyncing] = useState(false);
  const [growerHandle, setGrowerHandle] = useState('');
  const [growerIdentity, setGrowerIdentity] = useState<LocalGrowerIdentity | null>(null);
  const [rootHandle, setRootHandle] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [tempRootHandle, setTempRootHandle] = useState('');
  const [tempDeviceId, setTempDeviceId] = useState('');
  const [isEditingHandle, setIsEditingHandle] = useState(false);
  const [isEditingDeviceId, setIsEditingDeviceId] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [tempHandle, setTempHandle] = useState('');
  const [lastStreamFingerprint, setLastStreamFingerprint] = useState<string | null>(null);
  const [lastPullFingerprint, setLastPullFingerprint] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<{
    hasSnapshot: boolean;
    source: string;
    fingerprint: string | null;
    fromThisSession: boolean;
    hasApiKeys?: boolean;
    sharedKeyProviders?: string[];
    packet: {
      packetId?: string;
      peerName: string;
      gardenName: string;
      gardenCount: number;
      plantCount: number;
      timestamp: string;
      hasApiKeys?: boolean;
      sharedKeyProviders?: string[];
    } | null;
  } | null>(null);
  const [shareApiKeysWithBroadcast, setShareApiKeysWithBroadcast] = useState(false);
  const [pulledApiKeys, setPulledApiKeys] = useState<FreeLlmConfig | null>(null);
  const [inwardMode, setInwardMode] = useState<InwardStreamMode>('off');
  const [trustedGrowers, setTrustedGrowers] = useState<string[]>([]);
  const [newGrowerInput, setNewGrowerInput] = useState('');
  const [autoStreamEnabled, setAutoStreamEnabled] = useState(false);
  const [syncTopology, setSyncTopology] = useState<GardenSyncTopology>('coop');
  const [activityLog, setActivityLog] = useState<SyncActivityEvent[]>([]);

  const handleSelectTopology = async (topology: GardenSyncTopology) => {
    setSyncTopology(topology);
    if (activeLocation?.id) {
      await db.locations.update(activeLocation.id, {
        syncTopology: topology,
        p2pRoomId: topology === 'none' ? undefined : p2pRoomId,
        autoSyncInward: topology === 'mirror' ? true : inwardMode === 'selected',
        autoSyncOutward: topology === 'mirror' ? true : autoStreamEnabled,
      });
    }
    if (topology === 'mirror') {
      handleToggleAutoStream(true);
      handleSelectInwardMode('all');
    } else if (topology === 'none') {
      handleToggleAutoStream(false);
      handleSelectInwardMode('off');
    }
  };

  const handleSelectInwardMode = (mode: InwardStreamMode) => {
    setInwardMode(mode);
    saveInwardStreamMode(mode);
    if (activeLocation?.id) {
      void db.locations.update(activeLocation.id, {
        autoSyncInward: mode === 'selected' || mode === 'all',
      });
    }
  };

  const handleAddTrustedGrower = (growerName?: string) => {
    const target = (growerName || newGrowerInput).trim();
    if (!target) return;
    const updated = addTrustedGrower(target);
    setTrustedGrowers(updated);
    notifyTrustedGrowersChanged(updated);
    if (activeLocation?.id) {
      void db.locations.update(activeLocation.id, {
        trustedGrowers: updated,
      });
    }
    setNewGrowerInput('');
  };

  const handleRemoveTrustedGrower = (target: string) => {
    const updated = removeTrustedGrower(target);
    setTrustedGrowers(updated);
    notifyTrustedGrowersChanged(updated);
    if (activeLocation?.id) {
      void db.locations.update(activeLocation.id, {
        trustedGrowers: updated,
      });
    }
  };

  const handleToggleAutoStream = (checked: boolean) => {
    setAutoStreamEnabled(checked);
    saveAutoStreamPreference(checked);
    if (activeLocation?.id) {
      void db.locations.update(activeLocation.id, {
        autoSyncOutward: checked,
      });
    }
  };

  const currentDiscrepancy = useMemo(() => {
    if (!generatedData) return null;
    const peer = roomStatus?.packet?.peerName || 'Garden Peer';
    return computeGardenDiscrepancy(
      existingPlantings || [],
      generatedData,
      peer,
      {
        targetGardenId: activeLocation?.id || null,
        allLocalPlantings: allPlantings || existingPlantings || [],
        allLocalLocations: allLocations || (activeLocation ? [activeLocation] : []),
        peerPubkey: (roomStatus?.packet as any)?.peerPubkey,
      }
    );
  }, [generatedData, existingPlantings, allPlantings, allLocations, activeLocation, roomStatus]);

  const handleMergeDiscrepancies = async () => {
    if (!currentDiscrepancy || !generatedData || !activeLocation?.id) return;
    try {
      const res = await applyGardenDiscrepancies(currentDiscrepancy, generatedData, activeLocation.id);
      toast({
        title: 'Garden Discrepancies Merged',
        description: `Added ${res.added} plant(s) and updated ${res.updated} stage transition(s).`,
      });
      setActivityLog(getSyncActivityLog());
      onComplete?.();
    } catch (err: any) {
      toast({
        title: 'Merge Failed',
        description: err?.message || 'Could not apply garden discrepancies.',
        variant: 'destructive',
      });
    }
  };

  const activeKeyProviders = useMemo(() => {
    const list: string[] = [];
    if (apiKeys?.gemini) list.push('Gemini');
    if (apiKeys?.groq) list.push('Groq');
    if (apiKeys?.openrouter) list.push('OpenRouter');
    if (apiKeys?.ollamaUrl) list.push('Ollama');
    return list;
  }, [apiKeys]);

  const formatKeyProviders = (keys?: FreeLlmConfig | null) => {
    if (!keys) return '';
    const list: string[] = [];
    if (keys.gemini) list.push('Gemini');
    if (keys.groq) list.push('Groq');
    if (keys.openrouter) list.push('OpenRouter');
    if (keys.ollamaUrl) list.push('Ollama');
    return list.join(', ');
  };

  const handleApplySharedApiKeys = () => {
    if (!pulledApiKeys) return;
    const merged: FreeLlmConfig = {
      gemini: pulledApiKeys.gemini || apiKeys.gemini || '',
      groq: pulledApiKeys.groq || apiKeys.groq,
      openrouter: pulledApiKeys.openrouter || apiKeys.openrouter,
      ollamaUrl: pulledApiKeys.ollamaUrl || apiKeys.ollamaUrl,
    };
    localStorage.setItem('grow_apiKeys', JSON.stringify(merged));
    onApiKeysChange?.(merged);
    toast({
      title: 'Shared API Keys Applied',
      description: `Configured ${formatKeyProviders(pulledApiKeys)} for this device.`,
    });
  };
  // Last room snapshot (packetId) this session has seen, used to detect new streams from other sessions
  const seenPacketIdRef = useRef<string | null>(null);
  const pullRef = useRef<() => void>(() => {});
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>(activeLocation ? 'add' : 'new');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState<string | null>(null);

  // Tracks which plantings (both recommended and variations) are selected for import
  const [selectedPlantingIds, setSelectedPlantingIds] = useState<Set<string>>(new Set());

  // Helper to initialize selection with recommended plants (variations excluded by default)
  const initSelectedPlantings = (dataset: AiDataset) => {
    const recIds = new Set(
      (dataset.plantings || [])
        .filter((pl) => {
          const p = dataset.plants?.find((plant) => String(plant.id) === String(pl.plantId));
          return !p?.isExistingVariation;
        })
        .map((pl) => String(pl.id))
    );
    setSelectedPlantingIds(recIds);
  };

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
      const savedShareKeys = localStorage.getItem('grow_share_keys_with_broadcast');
      if (savedShareKeys !== null) {
        setShareApiKeysWithBroadcast(savedShareKeys === 'true');
      }
      setInwardMode(getInwardStreamMode());
      setTrustedGrowers(activeLocation?.trustedGrowers || getTrustedGrowers());
      setAutoStreamEnabled(getAutoStreamPreference());
      if (activeLocation?.syncTopology) {
        setSyncTopology(activeLocation.syncTopology);
      }
      if (activeLocation?.p2pRoomId) {
        setP2pRoomId(activeLocation.p2pRoomId);
      }
      setActivityLog(getSyncActivityLog());
      const identity = getOrCreateGrowerIdentity();
      setGrowerIdentity(identity);
      setRootHandle(identity.rootHandle);
      setDeviceId(identity.deviceId);
      setTempRootHandle(identity.rootHandle);
      setTempDeviceId(identity.deviceId);
      setGrowerHandle(identity.displayName);
      setTempHandle(identity.displayName);
      setIsEditingHandle(false);
      setIsEditingDeviceId(false);
      if (plantingToEdit) {
        setActiveTab('single');
      } else if (initialDataset?.data) {
        setActiveTab('packs');
        setGeneratedData(initialDataset.data);
        setLoadedPackTitle(initialDataset.title);
        setTheme(initialDataset.title);
        initSelectedPlantings(initialDataset.data);
        setError(null);
      } else if (initialTab) {
        setActiveTab(initialTab === 'import-pack' ? 'packs' : initialTab);
        if (initialSubTab) {
          setDataShareSubTab(initialSubTab);
        }
      }
    }
  }, [isOpen, initialTab, initialSubTab, plantingToEdit, initialDataset, activeLocation]);

  useEffect(() => {
    if (!isOpen || !p2pRoomId.trim()) {
      setRoomStatus(null);
      return;
    }
    saveP2PRoomId(p2pRoomId);

    // Cross-session updates: poll the room (cheap "peek", no dataset download) while this sheet is
    // open and the tab is visible. A new packetId written by a DIFFERENT session raises a toast.
    let cancelled = false;
    let baselineSet = false;
    seenPacketIdRef.current = null;
    const poll = async () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      const res = await inspectP2PRoom(p2pRoomId);
      if (cancelled || !res) return;
      setRoomStatus(res);
      const id = res.packet?.packetId ?? null;
      if (!baselineSet) {
        baselineSet = true;
        seenPacketIdRef.current = id;
        return;
      }
      if (id && id !== seenPacketIdRef.current) {
        seenPacketIdRef.current = id;
        if (!res.fromThisSession) {
          const keysNote = res.hasApiKeys ? ' (with shared API keys)' : '';
          toast({
            title: `New garden snapshot in "${p2pRoomId.trim()}"`,
            description: `${res.packet?.peerName || 'Another session'} streamed ${res.packet?.plantCount ?? 0} plants across ${res.packet?.gardenCount ?? 1} garden(s)${keysNote}.`,
            action: (
              <ToastAction altText="Pull now" onClick={() => pullRef.current()}>
                Pull now
              </ToastAction>
            ),
          });
        }
      }
    };
    poll();
    const pollInterval = setInterval(poll, 8000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);

    const unsubscribe = subscribeToP2PGardenRoom(p2pRoomId, (peerDataset, peerName, timestamp, peerApiKeys) => {
      const packName = `${peerDataset.locations?.[0]?.name || 'Shared Garden'} (from ${peerName})`;
      setGeneratedData(peerDataset);
      setLoadedPackTitle(packName);
      setTheme(packName);
      setSelectedPlantingIds(new Set((peerDataset.plantings || []).map((p) => String(p.id))));
      if (peerApiKeys && Object.values(peerApiKeys).some(Boolean)) {
        setPulledApiKeys(peerApiKeys);
      }
      const hasKeys = Boolean(peerApiKeys && Object.values(peerApiKeys).some(Boolean));
      toast({
        title: `Live P2P Garden Received`,
        description: `${peerName} broadcasted "${peerDataset.locations?.[0]?.name || 'Garden'}" (${peerDataset.plantings?.length || 0} plants)${hasKeys ? ` with shared API keys (${formatKeyProviders(peerApiKeys)})` : ''}. Review below to import!`,
      });
    });
    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
    };
  }, [isOpen, p2pRoomId, toast]);

  const buildCurrentGardenDataset = async (scope: 'active' | 'all' = shareScope): Promise<AiDataset | null> => {
    const allLocations = await db.locations.toArray();
    const allPlants = await db.plants.toArray();
    const allPlantings = await db.plantings.toArray();
    if (allLocations.length === 0) return null;

    if (scope === 'all') {
      return {
        locations: allLocations,
        plants: allPlants,
        plantings: allPlantings,
      };
    }

    const targetLoc = activeLocation || allLocations[0];
    if (!targetLoc) return null;
    const gardenPlantings = allPlantings.filter(
      (p) =>
        String(p.gardenId) === String(targetLoc.id) ||
        (allLocations.length === 1 && !p.gardenId)
    );

    // If the active garden has 0 plants while other gardens have plants, fall back to streaming all gardens so we never push 0 plants
    if (gardenPlantings.length === 0 && allPlantings.length > 0) {
      return {
        locations: allLocations,
        plants: allPlants,
        plantings: allPlantings,
      };
    }

    const plantIds = new Set(gardenPlantings.map((p) => String(p.plantId)));
    const gardenPlants = allPlants.filter((p) => plantIds.has(String(p.id)));
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

  const handleClaimRootHandle = () => {
    try {
      const clean = tempRootHandle.trim();
      if (!clean) return;
      const updated = claimGrowerHandle(clean, tempDeviceId || deviceId);
      setGrowerIdentity(updated);
      setRootHandle(updated.rootHandle);
      setDeviceId(updated.deviceId);
      setGrowerHandle(updated.displayName);
      setIsEditingHandle(false);
      toast({
        title: 'Grower Handle Claimed',
        description: `Permanently claimed "@${updated.rootHandle}" on this device. Full address: ${updated.displayName}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Claim Failed',
        description: err?.message || 'Could not claim handle.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveRootHandle = () => {
    try {
      const clean = tempRootHandle.trim();
      if (!clean) return;
      const updated = claimGrowerHandle(clean, tempDeviceId || deviceId);
      setGrowerIdentity(updated);
      setRootHandle(updated.rootHandle);
      setDeviceId(updated.deviceId);
      setGrowerHandle(updated.displayName);
      setIsEditingHandle(false);
      toast({
        title: 'Grower Handle Saved',
        description: `Set grower handle to "@${updated.rootHandle}". Full address: ${updated.displayName}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Save Failed',
        description: err?.message || 'Could not save handle.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveDeviceExtension = () => {
    try {
      const cleanDev = tempDeviceId.trim();
      const updated = updateDeviceExtension(cleanDev);
      setGrowerIdentity(updated);
      setDeviceId(updated.deviceId);
      setGrowerHandle(updated.displayName);
      setIsEditingDeviceId(false);
      toast({
        title: 'Device Extension Updated',
        description: `Device identified as "${updated.deviceId}". Full address: ${updated.displayName}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err?.message || 'Could not update device extension.',
        variant: 'destructive',
      });
    }
  };

  const handleResetIdentity = () => {
    const fresh = resetGrowerIdentity();
    setGrowerIdentity(fresh);
    setRootHandle(fresh.rootHandle);
    setDeviceId(fresh.deviceId);
    setTempRootHandle(fresh.rootHandle);
    setTempDeviceId(fresh.deviceId);
    setGrowerHandle(fresh.displayName);
    setIsEditingHandle(false);
    setIsEditingDeviceId(false);
    setIsResetConfirmOpen(false);
    toast({
      title: 'Identity Reset',
      description: `Generated new provisional grower identity: ${fresh.displayName}.`,
    });
  };

  const handleSaveGrowerHandle = () => {
    const clean = tempHandle.trim();
    if (!clean) return;
    const updated = updateGrowerIdentity({ displayName: clean });
    setGrowerIdentity(updated);
    setRootHandle(updated.rootHandle);
    setDeviceId(updated.deviceId);
    setGrowerHandle(updated.displayName);
    setIsEditingHandle(false);
    toast({
      title: 'Grower Handle Updated',
      description: `Broadcasting as "${updated.displayName}".`,
    });
  };

  const handlePushToP2PRoom = async () => {
    if (!p2pRoomId.trim()) return;
    setIsP2pSyncing(true);
    setError(null);
    try {
      saveP2PRoomId(p2pRoomId);
    notifyP2PRoomChanged(p2pRoomId);
      const ds = await buildCurrentGardenDataset(shareScope);
      if (!ds) {
        throw new Error('No gardens found to broadcast.');
      }
      if (ds.plantings.length === 0) {
        throw new Error(
          'Your garden currently has 0 plants to stream. Add or import plants into your garden first before streaming to the room.'
        );
      }
      await broadcastGardenToP2PRoom(p2pRoomId, ds, {
        shareApiKeys: shareApiKeysWithBroadcast,
        apiKeys,
      });
      const fp = fingerprintDataset(ds);
      setLastStreamFingerprint(fp);
      const updatedStatus = await inspectP2PRoom(p2pRoomId);
      if (updatedStatus) setRoomStatus(updatedStatus);
      const label =
        ds.locations.length > 1
          ? `All ${ds.locations.length} Gardens`
          : `"${ds.locations[0].name}"`;
      const keysSuffix = shareApiKeysWithBroadcast && activeKeyProviders.length > 0
        ? ` with shared API keys (${activeKeyProviders.join(', ')})`
        : '';
      toast({
        title: `Streamed to Room "${p2pRoomId.trim()}"`,
        description: `${label} (${ds.plantings.length} plants, fingerprint ${fp})${keysSuffix}. Now open a DIFFERENT session (other browser/profile/device), enter the same room code and Pull — it must show the same fingerprint.`,
      });
    } catch (err: any) {
      setError(err?.message || 'Could not broadcast to P2P room.');
    } finally {
      setIsP2pSyncing(false);
    }
  };

  const handleCopyOtherSessionLink = async () => {
    const roomCode = p2pRoomId.trim();
    if (!roomCode) return;
    try {
      saveP2PRoomId(roomCode);
      const link = `${window.location.origin}${window.location.pathname}?p2p_room=${encodeURIComponent(roomCode)}`;
      await navigator.clipboard.writeText(link);
      toast({
        title: 'Link Copied',
        description: `Open ${link} in a different browser, profile, or device to pull room "${roomCode}" there. Nothing is streamed by copying.`,
      });
    } catch (err: any) {
      setError(err?.message || 'Could not copy link.');
    }
  };

  const handlePullFromP2PRoom = async () => {
    if (!p2pRoomId.trim()) return;
    setIsP2pSyncing(true);
    setError(null);
    try {
      saveP2PRoomId(p2pRoomId);
    notifyP2PRoomChanged(p2pRoomId);
      const latest = await fetchLatestFromP2PRoom(p2pRoomId);
      if (!latest) {
        toast({
          title: 'No Snapshot Found in Room',
          description: `No garden has been streamed to room "${p2pRoomId.trim()}" in the last 24h yet. Click "Stream All Gardens" from the sender session first.`,
          variant: 'destructive',
        });
        return;
      }
      const normalizedDataset: AiDataset = {
        ...latest.dataset,
        locations: (latest.dataset.locations || []).map((l) => ({
          ...l,
          id: String(l.id),
        })),
        plants: (latest.dataset.plants || []).map((p) => ({
          ...p,
          id: String(p.id),
        })),
        plantings: (latest.dataset.plantings || []).map((pl) => ({
          ...pl,
          id: String(pl.id),
          plantId: String(pl.plantId),
          gardenId: String(pl.gardenId),
        })),
      };
      const locCount = normalizedDataset.locations.length;
      const baseTitle =
        locCount > 1
          ? `${locCount} Gardens (${normalizedDataset.locations.map((l) => l.name).join(', ')})`
          : normalizedDataset.locations?.[0]?.name || 'P2P Garden';
      const packName = `${baseTitle} — ${latest.peerName}`;
      setGeneratedData(normalizedDataset);
      setLoadedPackTitle(packName);
      setTheme(packName);
      // Pre-select all pulled plantings even if some match existing species
      setSelectedPlantingIds(new Set(normalizedDataset.plantings.map((p) => String(p.id))));
      if (locCount > 1 || !activeLocation) {
        setImportMode('new');
      }
      const fp = fingerprintDataset(normalizedDataset);
      setLastPullFingerprint(fp);
      if (latest.apiKeys && Object.values(latest.apiKeys).some(Boolean)) {
        setPulledApiKeys(latest.apiKeys);
      }
      const roomNow = await inspectP2PRoom(p2pRoomId);
      const sameSession = Boolean(roomNow?.fromThisSession);
      const keysSuffix = latest.apiKeys && Object.values(latest.apiKeys).some(Boolean)
        ? ` (includes shared API keys: ${formatKeyProviders(latest.apiKeys)})`
        : '';
      toast({
        title: sameSession
          ? `Pulled ${baseTitle} — but written by THIS session`
          : `Pulled ${baseTitle} from another session`,
        description: sameSession
          ? `This snapshot was streamed by this same browser profile, so it does NOT prove cross-session sync. Pull from a different browser/profile/device. (fingerprint ${fp})${keysSuffix}`
          : `Loaded ${normalizedDataset.plantings.length} plants across ${locCount} garden${locCount === 1 ? '' : 's'} from ${latest.peerName} (fingerprint ${fp} — must match the sender's)${keysSuffix}. Review and click Import below.`,
        variant: sameSession ? 'destructive' : undefined,
      });
    } catch (err: any) {
      setError(err?.message || 'Could not pull from P2P room.');
    } finally {
      setIsP2pSyncing(false);
    }
  };

  pullRef.current = handlePullFromP2PRoom;

  const handleLoadStarterDataset = async (datasetKey: string) => {
    try {
      setError(null);
      const ds = await loadDataset(datasetKey);
      setGeneratedData(ds);
      setLoadedPackTitle(ds.name);
      setTheme(ds.name);
      initSelectedPlantings(ds);
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
      initSelectedPlantings(decoded);
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
      setSelectedPlantingIds(new Set());
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

      // Enrich generated plants with real botanical photographs
      const enrichedPlants = await Promise.all(
        (result.plants || []).map(async (p) => {
          if (p.imageUrl) return p;
          const matchingPlanting = result.plantings?.find((pl) => pl.plantId === p.id);
          const resolvedUrl = await resolveRealPlantImage(p.species, matchingPlanting?.name, p.id);
          return resolvedUrl ? { ...p, imageUrl: resolvedUrl } : p;
        })
      );
      if (controller.signal.aborted) return;
      const enrichedResult: AiDataset = { ...result, plants: enrichedPlants };

      setGeneratedData(enrichedResult);
      setRefinement('');
      initSelectedPlantings(enrichedResult);
      
      const sanitizedPrompt = { ...promptData };
      delete (sanitizedPrompt as any).apiKeys;

      const newLog: AiLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        flow: 'createDataset',
        prompt: sanitizedPrompt,
        results: enrichedResult,
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

      const sanitizedPrompt = { ...promptData };
      delete (sanitizedPrompt as any).apiKeys;

      const errorLog: AiLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        flow: 'createDataset',
        prompt: sanitizedPrompt,
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
    setSelectedPlantingIds(prev => {
      const next = new Set(prev);
      next.delete(plantingId);
      return next;
    });
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
      
      const resolvedPhoto = await resolveRealPlantImage(result.species, result.commonName);
      const newPlant: Plant = {
        ...result,
        id: `ai-plant-${Date.now()}`,
        ...(resolvedPhoto ? { imageUrl: resolvedPhoto } : {}),
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
         setSelectedPlantingIds(prev => new Set([...prev, newPlanting.id]));
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
          const candidatePlantings = (generatedData.plantings || []).filter(p => selectedPlantingIds.has(String(p.id)));
          if (candidatePlantings.length === 0) {
            toast({
              title: 'No Plants Selected',
              description: 'Please select at least one plant to import.',
              variant: 'destructive',
            });
            setIsImporting(false);
            return;
          }
          const selectedPlantIds = new Set(candidatePlantings.map(p => String(p.plantId)));
          const candidatePlants = (generatedData.plants || []).filter(p => selectedPlantIds.has(String(p.id)));

          await db.plants.clear();
          await db.plantings.clear();
          await db.locations.clear();

          await db.locations.bulkAdd(generatedData.locations);
          await db.plants.bulkAdd(candidatePlants);
          await db.plantings.bulkAdd(
            candidatePlantings.map((p) => ({
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
            description: `Your garden has been replaced with ${candidatePlantings.length} selected plants.`,
          });

        } else if (importMode === 'new') {
            const candidatePlantings = (generatedData.plantings || []).filter(p => selectedPlantingIds.has(String(p.id)));
            if (candidatePlantings.length === 0) {
              toast({
                title: 'No Plants Selected',
                description: 'Please select at least one plant to create your garden.',
                variant: 'destructive',
              });
              setIsImporting(false);
              return;
            }
            const selectedPlantIds = new Set(candidatePlantings.map(p => String(p.plantId)));
            const candidatePlants = (generatedData.plants || []).filter(p => selectedPlantIds.has(String(p.id)));

            const now = Date.now();
            const idSuffix = `-${now}-${Math.random().toString(36).substring(2, 6)}`;

            const locationIdMap = new Map<string, string>();
            const newLocations: GardenLocation[] = (generatedData.locations || []).map((loc, idx) => {
              const newLocId = `garden-${now}-${idx}`;
              locationIdMap.set(String(loc.id), newLocId);
              return {
                ...loc,
                id: newLocId,
              };
            });

            const fallbackGardenId = newLocations[0]?.id || `garden-${now}`;

            const plantIdMap = new Map<string, string>();
            const newPlants: Plant[] = candidatePlants.map((p, i) => {
              const newId = `plant${idSuffix}-${i}`;
              plantIdMap.set(String(p.id), newId);
              return { ...p, id: newId };
            });

            const newPlantings: Planting[] = candidatePlantings.map((p, i) => ({
              ...p,
              id: `planting${idSuffix}-${i}`,
              plantId: plantIdMap.get(String(p.plantId)) || `unknown-plant${idSuffix}-${i}`,
              gardenId: locationIdMap.get(String(p.gardenId)) || fallbackGardenId,
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
            description: `A new garden "${newLocations[0]?.name || 'New Garden'}" was created with ${newPlantings.length} selected plants.`,
          });
  
        } else if (importMode === 'add' && activeLocation) {
          const candidatePlantings = (generatedData.plantings || []).filter(p => selectedPlantingIds.has(String(p.id)));

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
            const plant = generatedPlantMap.get(String(p.plantId));
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

      const candidatePlantings = (generatedData.plantings || []).filter(p => selectedPlantingIds.has(String(p.id)));

      await db.transaction('rw', db.plants, db.plantings, async () => {
        const existingPlants = await db.plants.toArray();
        const plantIdMap = new Map<string, string>();
        const plantsToAdd: Plant[] = [];

        // 1. Process candidate plants for db.plants
        for (const planting of candidatePlantings) {
          const res = resolutionMap.get(planting.id);
          if (res?.action === 'skip') continue;

          const newPlant = generatedPlantMap.get(String(planting.plantId));
          if (!newPlant || plantIdMap.has(String(newPlant.id))) continue;

          const existingPlant = existingPlants.find(p => p.species.toLowerCase().trim() === newPlant.species.toLowerCase().trim());
          const resolvedImg = newPlant.imageUrl || getCuratedPlantImage(newPlant, planting.name);
          if (existingPlant) {
            plantIdMap.set(String(newPlant.id), String(existingPlant.id));
            if (resolvedImg && !existingPlant.imageUrl) {
              await db.plants.update(existingPlant.id, { imageUrl: resolvedImg });
              existingPlant.imageUrl = resolvedImg;
            }
          } else {
            const newDbPlantId = `plant-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            plantIdMap.set(String(newPlant.id), newDbPlantId);
            plantsToAdd.push({ ...newPlant, id: newDbPlantId, ...(resolvedImg ? { imageUrl: resolvedImg } : {}) });
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
          const newPlantId = plantIdMap.get(String(newPlanting.plantId));
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
    return new Map(generatedData.plants.map(p => [String(p.id), p]));
  }, [generatedData]);

  // Split generated plantings into "Usual Results" (Recommended New Plants)
  // and "Existing Plant Variations & Matches" (Put outside the usual results)
  const { recommendedPlantings, variationPlantings } = useMemo(() => {
    if (!generatedData) return { recommendedPlantings: [], variationPlantings: [] };

    const recs: Planting[] = [];
    const vars: Planting[] = [];

    generatedData.plantings.forEach(planting => {
      const plant = generatedPlantMap.get(String(planting.plantId));
      if (!plant) return;

      const incUid = plant.uid || toSpeciesUid(plant.species || planting.name);
      const incNormSpecies = plant.species?.toLowerCase().trim();
      const incNormName = planting.name?.toLowerCase().trim();

      const matchingInActive = existingPlantings?.find(ep => 
        (ep.plant?.species && incNormSpecies && ep.plant.species.toLowerCase().trim() === incNormSpecies) ||
        (ep.name && incNormName && ep.name.toLowerCase().trim() === incNormName) ||
        toSpeciesUid(ep.plant?.species || ep.name) === incUid
      );

      const matchingInAny = !matchingInActive && allPlantings?.find(ap => 
        (ap.plant?.species && incNormSpecies && ap.plant.species.toLowerCase().trim() === incNormSpecies) ||
        (ap.name && incNormName && ap.name.toLowerCase().trim() === incNormName) ||
        toSpeciesUid(ap.plant?.species || ap.name) === incUid
      );

      if (plant.isExistingVariation || matchingInActive || matchingInAny) {
        vars.push(planting);
      } else {
        recs.push(planting);
      }
    });

    return { recommendedPlantings: recs, variationPlantings: vars };
  }, [generatedData, generatedPlantMap, existingPlantings, allPlantings]);

  const togglePlantingSelection = (plantingId: string) => {
    setSelectedPlantingIds(prev => {
      const next = new Set(prev);
      if (next.has(plantingId)) {
        next.delete(plantingId);
      } else {
        next.add(plantingId);
      }
      return next;
    });
  };

  const handleSelectAllRecommended = () => {
    setSelectedPlantingIds(prev => {
      const next = new Set(prev);
      recommendedPlantings.forEach(p => next.add(String(p.id)));
      return next;
    });
  };

  const handleDeselectAllRecommended = () => {
    setSelectedPlantingIds(prev => {
      const next = new Set(prev);
      recommendedPlantings.forEach(p => next.delete(String(p.id)));
      return next;
    });
  };

  const handleSelectAllVariations = () => {
    setSelectedPlantingIds(prev => {
      const next = new Set(prev);
      variationPlantings.forEach(p => next.add(String(p.id)));
      return next;
    });
  };

  const handleDeselectAllVariations = () => {
    setSelectedPlantingIds(prev => {
      const next = new Set(prev);
      variationPlantings.forEach(p => next.delete(String(p.id)));
      return next;
    });
  };

  const selectedRecommendedCount = useMemo(() => {
    return recommendedPlantings.filter(p => selectedPlantingIds.has(String(p.id))).length;
  }, [recommendedPlantings, selectedPlantingIds]);

  const selectedVariationsCount = useMemo(() => {
    return variationPlantings.filter(p => selectedPlantingIds.has(String(p.id))).length;
  }, [variationPlantings, selectedPlantingIds]);

  const totalSelectedCount = useMemo(() => {
    if (!generatedData) return 0;
    return generatedData.plantings.filter(p => selectedPlantingIds.has(String(p.id))).length;
  }, [generatedData, selectedPlantingIds]);


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
              : 'Add a single plant, generate with AI, explore starter packs & links, or sync live across devices.'}
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab === 'import-pack' ? 'packs' : activeTab}
          onValueChange={(val) => {
            setError(null);
            setActiveTab(val as UnifiedImportTab);
          }}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-3 h-auto p-1 bg-muted/70 gap-1 rounded-lg">
            <TabsTrigger value="single" className="text-xs sm:text-sm py-2 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Sprout className="h-3.5 w-3.5 shrink-0" />
              <span>{plantingToEdit ? 'Edit Plant' : 'Single Plant'}</span>
            </TabsTrigger>
            <TabsTrigger value="ai-generate" className="text-xs sm:text-sm py-2 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>AI Generator</span>
            </TabsTrigger>
            <TabsTrigger value="packs" className="text-xs sm:text-sm py-2 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Package className="h-3.5 w-3.5 shrink-0" />
              <span>Packs &amp; Links</span>
            </TabsTrigger>
            <TabsTrigger value="live-sync" className="text-xs sm:text-sm py-2 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Radio className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="flex items-center gap-1.5">
                <span>Live Sync</span>
                {p2pRoomId.trim() && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-6 -mr-6">
            {/* TAB 1: SINGLE PLANT (AI Search, Camera Scan, Species Selector, Status History) */}
            <TabsContent value="single" className="mt-0">
              {onPlantSubmit ? (
                <PlantForm
                  plantingToEdit={plantingToEdit}
                  defaultStatus={defaultStatus}
                  conditions={activeLocation?.conditions}
                  onSubmit={(plantingData, plantData) => {
                    onPlantSubmit(plantingData, plantData);
                    handleClose();
                  }}
                  onConfigureApiKey={() => {
                    handleClose();
                    onConfigureApiKey?.();
                  }}
                  onSwitchToAiGenerateTab={() => setActiveTab('ai-generate')}
                  onSwitchToImportTab={() => setActiveTab('packs')}
                  areApiKeysSet={areApiKeysSet}
                  apiKeys={apiKeys}
                  plants={plants}
                  locations={allLocations}
                  defaultGardenId={activeLocation?.id}
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

              {/* TAB 4: LIVE GARDEN SYNC */}
              {activeTab === 'live-sync' && (
                <div className="space-y-5">
                  {/* Top Status & Grower Handle Bar */}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-primary animate-pulse shrink-0" />
                        <span className="font-semibold text-sm text-foreground">
                          Live Sync for: <span className="text-primary">{activeLocation?.name || 'All Gardens'}</span>
                        </span>
                        {p2pRoomId.trim() && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-emerald-600 hover:bg-emerald-600">
                            Active Room
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        P2P cross-device sync with zero server costs ($0). Changes mirror peer-to-peer.
                      </p>
                    </div>

                    {/* Grower Handle & Device Extension Card */}
                    <div className="flex flex-col gap-2 bg-background/90 border rounded-lg p-2.5 text-xs w-full sm:w-auto sm:min-w-[270px]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-muted-foreground font-medium text-[11px]">Grower Identity:</span>
                        </div>
                        {growerIdentity?.isClaimed ? (
                          <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 px-1.5 py-0 h-4 font-mono font-medium">
                            <Lock className="h-2.5 w-2.5" /> Claimed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 px-1.5 py-0 h-4 font-mono">
                            Unclaimed (Provisional)
                          </Badge>
                        )}
                      </div>

                      {growerIdentity?.isClaimed ? (
                        /* CLAIMED STATE: Root handle & device extension both editable on mobile & desktop */
                        <div className="flex flex-col gap-1.5 pt-0.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1 min-w-0 font-mono text-xs flex-wrap">
                              {/* Root Handle Editor */}
                              {isEditingHandle ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground font-semibold">@</span>
                                  <Input
                                    value={tempRootHandle}
                                    onChange={(e) => setTempRootHandle(e.target.value)}
                                    placeholder="colby_gardens"
                                    className="h-6 text-xs font-mono font-medium py-0 px-1.5 w-28"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveRootHandle();
                                      if (e.key === 'Escape') setIsEditingHandle(false);
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 hover:bg-primary/10"
                                    onClick={handleSaveRootHandle}
                                    title="Save Root Handle"
                                  >
                                    <Check className="h-3.5 w-3.5 text-primary" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 hover:bg-muted"
                                    onClick={() => setIsEditingHandle(false)}
                                    title="Cancel"
                                  >
                                    <X className="h-3 w-3 text-muted-foreground" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span
                                    className="font-bold text-foreground truncate cursor-pointer hover:text-primary hover:underline"
                                    onClick={() => {
                                      setTempRootHandle(rootHandle);
                                      setIsEditingHandle(true);
                                    }}
                                    title="Click to edit root handle"
                                  >
                                    @{rootHandle || 'grower'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTempRootHandle(rootHandle);
                                      setIsEditingHandle(true);
                                    }}
                                    className="text-muted-foreground hover:text-primary text-[10px] ml-0.5"
                                    title="Edit root handle"
                                  >
                                    edit
                                  </button>
                                </div>
                              )}

                              <span className="text-muted-foreground font-bold">/</span>

                              {/* Device Extension Editor */}
                              {isEditingDeviceId ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={tempDeviceId}
                                    onChange={(e) => setTempDeviceId(e.target.value)}
                                    placeholder="laptop"
                                    className="h-6 text-xs font-mono font-medium py-0 px-1.5 w-20"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveDeviceExtension();
                                      if (e.key === 'Escape') setIsEditingDeviceId(false);
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 hover:bg-primary/10"
                                    onClick={handleSaveDeviceExtension}
                                    title="Save Device Extension"
                                  >
                                    <Check className="h-3.5 w-3.5 text-primary" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span
                                    className="text-primary font-semibold truncate bg-muted/70 px-1.5 py-0.5 rounded text-[11px] cursor-pointer hover:bg-muted"
                                    onClick={() => {
                                      setTempDeviceId(deviceId);
                                      setIsEditingDeviceId(true);
                                    }}
                                    title="Click to edit device extension"
                                  >
                                    {deviceId || 'device'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTempDeviceId(deviceId);
                                      setIsEditingDeviceId(true);
                                    }}
                                    className="text-muted-foreground hover:text-primary text-[10px] ml-0.5"
                                    title="Edit device extension"
                                  >
                                    edit
                                  </button>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setIsResetConfirmOpen(true)}
                              className="text-[10px] text-muted-foreground hover:text-destructive underline shrink-0 ml-auto"
                              title="Reset identity and generate new keypair"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* UNCLAIMED STATE: User can enter desired handle and click Claim Handle */
                        <div className="space-y-1.5 pt-0.5">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 font-mono text-xs">
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                              <span className="text-muted-foreground font-semibold">@</span>
                              <Input
                                value={tempRootHandle}
                                onChange={(e) => setTempRootHandle(e.target.value)}
                                placeholder="colby_gardens"
                                className="h-7 text-xs font-mono font-medium py-0 px-2 flex-1 min-w-0"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleClaimRootHandle();
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-muted-foreground font-bold">/</span>
                              <Input
                                value={tempDeviceId}
                                onChange={(e) => setTempDeviceId(e.target.value)}
                                placeholder="phone"
                                className="h-7 text-xs font-mono font-medium py-0 px-1.5 w-16"
                                title="Device ID extension"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 text-[10px] px-2.5 gap-1 shrink-0 ml-auto sm:ml-0"
                                onClick={handleClaimRootHandle}
                                disabled={!tempRootHandle.trim()}
                                title="Claim and save root handle"
                              >
                                <Lock className="h-2.5 w-2.5" />
                                <span>Claim</span>
                              </Button>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Claiming sets your root handle across P2P rooms and proofs.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sync Topology Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                      <span>Garden Sync Topology</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        Defines how updates flow between devices
                      </span>
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* 1. Device Mirror */}
                      <button
                        type="button"
                        onClick={() => handleSelectTopology('mirror')}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-all flex flex-col justify-between gap-2",
                          syncTopology === 'mirror'
                            ? "border-primary bg-primary/10 ring-2 ring-primary/25 shadow-sm"
                            : "border-border bg-card hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1.5">
                            <Smartphone className="h-4 w-4 text-primary" />
                            <span className="text-xs font-semibold text-foreground">Device Mirror</span>
                          </div>
                          <Badge variant={syncTopology === 'mirror' ? 'default' : 'secondary'} className="text-[9px] px-1 py-0">
                            1:1
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Mirrors seamlessly across your phone, tablet, and PC. Auto-broadcasts outward &amp; auto-merges inward.
                        </p>
                      </button>

                      {/* 2. Community Co-op */}
                      <button
                        type="button"
                        onClick={() => handleSelectTopology('coop')}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-all flex flex-col justify-between gap-2",
                          syncTopology === 'coop'
                            ? "border-primary bg-primary/10 ring-2 ring-primary/25 shadow-sm"
                            : "border-border bg-card hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="text-xs font-semibold text-foreground">Community Co-op</span>
                          </div>
                          <Badge variant={syncTopology === 'coop' ? 'default' : 'secondary'} className="text-[9px] px-1 py-0">
                            M:1
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Collaborate with peers or allotment neighbours. Auto-broadcasts outward; choose trusted handles to auto-merge.
                        </p>
                      </button>

                      {/* 3. Local Only */}
                      <button
                        type="button"
                        onClick={() => handleSelectTopology('none')}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-all flex flex-col justify-between gap-2",
                          syncTopology === 'none'
                            ? "border-primary bg-primary/10 ring-2 ring-primary/25 shadow-sm"
                            : "border-border bg-card hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-semibold text-foreground">Local Only</span>
                          </div>
                          <Badge variant={syncTopology === 'none' ? 'default' : 'secondary'} className="text-[9px] px-1 py-0">
                            Isolated
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Strictly isolated to this browser session. Background broadcast and inward auto-merge are turned off.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Room Connection Card */}
                  <Card className="border-border shadow-sm">
                    <CardHeader className="pb-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-headline text-sm sm:text-base flex items-center gap-2">
                          <Radio className="h-4 w-4 text-primary" />
                          <span>P2P Room Connection</span>
                        </CardTitle>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={shareScope === 'active' ? 'default' : 'outline'}
                            className="h-6 text-[10px] px-2"
                            onClick={() => setShareScope('active')}
                          >
                            Active Garden
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={shareScope === 'all' ? 'default' : 'outline'}
                            className="h-6 text-[10px] px-2"
                            onClick={() => setShareScope('all')}
                          >
                            All Gardens
                          </Button>
                        </div>
                      </div>
                      <CardDescription className="text-xs">
                        Enter a shared room code to broadcast your garden or pull updates from other devices.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3.5">

                        {/* Room Code & Stream/Pull Row */}
                        <div className="space-y-1.5">
                          <Label htmlFor="p2p-room-input" className="text-xs font-medium">
                            Room Code
                          </Label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                              <Input
                                id="p2p-room-input"
                                placeholder="e.g., backyard-co-op-2026"
                                value={p2pRoomId}
                                onChange={(e) => setP2pRoomId(e.target.value)}
                                className="font-mono text-xs pr-8"
                              />
                              {p2pRoomId.trim() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(p2pRoomId.trim());
                                    toast({ title: 'Room code copied to clipboard' });
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  title="Copy Room Code"
                                >
                                  <ClipboardPaste className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                onClick={handlePushToP2PRoom}
                                disabled={!p2pRoomId.trim() || isP2pSyncing}
                                className="h-9 text-xs flex-1 sm:flex-initial gap-1.5"
                              >
                                {isP2pSyncing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Share2 className="h-3.5 w-3.5" />
                                )}
                                <span>{shareScope === 'all' ? 'Stream All' : 'Stream Active'}</span>
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={handlePullFromP2PRoom}
                                disabled={!p2pRoomId.trim() || isP2pSyncing}
                                className="h-9 text-xs flex-1 sm:flex-initial gap-1.5"
                              >
                                {isP2pSyncing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                                <span>Pull Latest</span>
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Option to share API keys with broadcast */}
                        <div className="rounded-lg border p-2.5 bg-muted/20 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <Label htmlFor="share-api-keys-toggle" className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                                <KeyRound className="h-3.5 w-3.5 text-primary" />
                                <span>Share API Keys with this broadcast</span>
                              </Label>
                              <p className="text-[11px] text-muted-foreground">
                                {areApiKeysSet
                                  ? `Include configured credentials (${activeKeyProviders.join(', ')}) so other devices on this room can use AI.`
                                  : 'Configure free API keys in Settings to share them with other devices.'}
                              </p>
                            </div>
                            <Switch
                              id="share-api-keys-toggle"
                              checked={shareApiKeysWithBroadcast}
                              onCheckedChange={(checked) => {
                                setShareApiKeysWithBroadcast(checked);
                                localStorage.setItem('grow_share_keys_with_broadcast', checked ? 'true' : 'false');
                              }}
                              disabled={!areApiKeysSet}
                            />
                          </div>
                          {shareApiKeysWithBroadcast && (
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span>Security note: Anyone with room code &quot;{p2pRoomId || '...'}&quot; will receive your keys. Only use private room codes.</span>
                            </div>
                          )}
                        </div>

                        {/* Real-Time Live Sync Automation */}
                        <div className="rounded-lg border p-3 bg-muted/20 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
                              <Sparkles className="h-3.5 w-3.5 text-primary" />
                              Real-Time Sync Automation
                            </span>
                            <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
                              Zero Server Cost
                            </Badge>
                          </div>

                          {/* Inward Auto-Streaming Controls */}
                          <div className="space-y-2 pt-1 border-t border-border/50">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="space-y-0.5">
                                <Label className="text-xs font-medium">Auto-Stream Inwards (Live Merge)</Label>
                                <p className="text-[11px] text-muted-foreground">
                                  Automatically ingest incoming room updates into your garden without prompting.
                                </p>
                              </div>
                              <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={inwardMode === 'selected' ? 'default' : 'ghost'}
                                  className="h-6 text-[11px] px-2"
                                  onClick={() => handleSelectInwardMode('selected')}
                                  title="Only auto-stream from selected trusted grower handles or devices"
                                >
                                  Selected
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={inwardMode === 'all' ? 'default' : 'ghost'}
                                  className="h-6 text-[11px] px-2"
                                  onClick={() => handleSelectInwardMode('all')}
                                  title="Auto-stream inwards from any broadcaster in this room"
                                >
                                  All Peers
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={inwardMode === 'off' ? 'default' : 'ghost'}
                                  className="h-6 text-[11px] px-2"
                                  onClick={() => handleSelectInwardMode('off')}
                                  title="Require manual review for all incoming updates"
                                >
                                  Off
                                </Button>
                              </div>
                            </div>

                            {/* Selected Growers Management */}
                            {inwardMode === 'selected' && (
                              <div className="rounded-md border bg-background/80 p-2.5 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-[11px] text-foreground">
                                    Selected Growers ({trustedGrowers.length})
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    Only updates from these handles auto-merge
                                  </span>
                                </div>

                                {trustedGrowers.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {trustedGrowers.map((grower) => (
                                      <Badge
                                        key={grower}
                                        variant="secondary"
                                        className="gap-1 py-0.5 px-2 text-xs font-mono font-medium"
                                      >
                                        <span>{grower.startsWith('@') ? grower : `@${grower}`}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveTrustedGrower(grower)}
                                          className="text-muted-foreground hover:text-destructive ml-0.5"
                                          title={`Remove ${grower}`}
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-muted-foreground italic">
                                    No growers selected yet. Add a grower handle below.
                                  </p>
                                )}

                                {/* Add grower input row */}
                                <div className="flex items-center gap-1.5 pt-1">
                                  <Input
                                    value={newGrowerInput}
                                    onChange={(e) => setNewGrowerInput(e.target.value)}
                                    placeholder="Add grower handle (e.g. @colby, Grower-4026)..."
                                    className="h-7 text-xs font-mono"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleAddTrustedGrower();
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 text-xs px-2.5 shrink-0"
                                    onClick={() => handleAddTrustedGrower()}
                                    disabled={!newGrowerInput.trim()}
                                  >
                                    + Add
                                  </Button>
                                </div>

                                {/* Quick chip from snapshot peer if available */}
                                {roomStatus?.packet?.peerName &&
                                  !isGrowerTrusted(roomStatus.packet.peerName) && (
                                    <div className="pt-0.5">
                                      <button
                                        type="button"
                                        onClick={() => handleAddTrustedGrower(roomStatus.packet?.peerName)}
                                        className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1"
                                      >
                                        <span>+ Add current room broadcaster</span>
                                        <span className="font-mono font-semibold">
                                          @{roomStatus.packet.peerName}
                                        </span>
                                      </button>
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>

                          {/* Outward Auto-Streaming Controls */}
                          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
                            <div className="space-y-0.5">
                              <Label htmlFor="auto-stream-toggle" className="text-xs font-medium cursor-pointer">
                                Auto-Stream Outwards (Broadcast Edits)
                              </Label>
                              <p className="text-[11px] text-muted-foreground">
                                Automatically broadcasts debounced garden updates to this room whenever you add plants or log status changes.
                              </p>
                            </div>
                            <Switch
                              id="auto-stream-toggle"
                              checked={autoStreamEnabled}
                              onCheckedChange={handleToggleAutoStream}
                            />
                          </div>
                        </div>

                        {/* Banner if received shared API keys */}
                        {pulledApiKeys && Object.values(pulledApiKeys).some(Boolean) && (
                          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-start gap-2">
                                <KeyRound className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <div>
                                  <div className="font-semibold text-foreground">
                                    Shared API Keys Received ({formatKeyProviders(pulledApiKeys)})
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    The broadcaster shared their free AI provider keys. Apply them to enable AI generation and viability diagnosis on this device.
                                  </div>
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 text-xs shrink-0 gap-1.5 self-end sm:self-center"
                                onClick={handleApplySharedApiKeys}
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Apply to Device</span>
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Live Room Status Alert Box */}
                        <div
                          className={cn(
                            'rounded-lg border p-3 text-xs space-y-2 transition-colors',
                            roomStatus?.hasSnapshot
                              ? 'bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-950/20'
                              : 'bg-muted/40 border-border'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'h-2 w-2 rounded-full shrink-0',
                                  roomStatus?.hasSnapshot ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'
                                )}
                              />
                              {roomStatus?.hasSnapshot && roomStatus.packet ? (
                                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                                  In Room: {roomStatus.packet.plantCount} plants in {roomStatus.packet.gardenCount || 1} garden(s)
                                </span>
                              ) : p2pRoomId.trim() ? (
                                <span className="text-muted-foreground font-medium">
                                  Room &quot;{p2pRoomId.trim()}&quot; is empty. Click Stream to broadcast your garden.
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  Enter a room code above to sync across devices.
                                </span>
                              )}
                            </div>
                            {roomStatus?.hasSnapshot && (
                              <div className="flex items-center gap-1.5">
                                {roomStatus.hasApiKeys && (
                                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 shrink-0">
                                    🔑 Includes API Keys
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-[10px] shrink-0 font-normal">
                                  {roomStatus.fromThisSession ? 'From this device' : `By ${roomStatus.packet?.peerName}`}
                                </Badge>
                              </div>
                            )}
                          </div>

                          {/* Monospace Fingerprint Row */}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono text-muted-foreground pt-0.5">
                            {roomStatus?.fingerprint && (
                              <span className="bg-background/80 px-1.5 py-0.5 rounded border">
                                Room FP: <strong>{roomStatus.fingerprint}</strong>
                              </span>
                            )}
                            {lastStreamFingerprint && (
                              <span className="bg-background/80 px-1.5 py-0.5 rounded border">
                                Streamed: <strong>{lastStreamFingerprint}</strong>
                              </span>
                            )}
                            {lastPullFingerprint && (
                              <span className="bg-background/80 px-1.5 py-0.5 rounded border">
                                Pulled: <strong>{lastPullFingerprint}</strong>
                              </span>
                            )}
                          </div>

                          {/* 1-Click Link to Open in Another Session */}
                          <div className="pt-1 flex items-center justify-between border-t border-border/50">
                            <p className="text-[11px] text-muted-foreground">
                              Auto-detects live streams while this sheet is open.
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleCopyOtherSessionLink}
                              disabled={!p2pRoomId.trim()}
                              className="h-6 text-[11px] px-2 text-primary hover:text-primary"
                            >
                              <Link2 className="mr-1 h-3 w-3" />
                              Copy 1-Click Link for Other Session
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Discrepancy Diffing Engine Card */}
                    {currentDiscrepancy && (currentDiscrepancy.newItems.length > 0 || currentDiscrepancy.updatedItems.length > 0) && (
                      <Card className="border-primary/40 bg-primary/5 shadow-sm">
                        <CardHeader className="pb-2.5">
                          <div className="flex items-center justify-between">
                            <CardTitle className="font-headline text-sm sm:text-base flex items-center gap-2">
                              <GitMerge className="h-4 w-4 text-primary" />
                              <span>Garden Discrepancy Analysis</span>
                            </CardTitle>
                            <Badge variant="default" className="text-[10px]">
                              Changes Detected
                            </Badge>
                          </div>
                          <CardDescription className="text-xs">
                            {currentDiscrepancy.summaryText}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* 3 Metric Pills */}
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg border bg-emerald-500/10 border-emerald-500/30 p-2">
                              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                +{currentDiscrepancy.newItems.length}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-medium">New Plants</div>
                            </div>
                            <div className="rounded-lg border bg-amber-500/10 border-amber-500/30 p-2">
                              <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                                ~{currentDiscrepancy.updatedItems.length}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-medium">Stage Updates</div>
                            </div>
                            <div className="rounded-lg border bg-muted/40 border-border p-2">
                              <div className="text-lg font-bold text-muted-foreground">
                                ={currentDiscrepancy.identicalItems.length}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-medium">Identical</div>
                            </div>
                          </div>

                          {/* Breakdown items */}
                          <div className="rounded-lg border bg-background/80 p-2.5 max-h-36 overflow-y-auto space-y-1 text-xs">
                            {currentDiscrepancy.newItems.map((item, idx) => (
                              <div key={`new-${idx}`} className="flex items-center justify-between text-emerald-800 dark:text-emerald-300">
                                <span className="font-medium">+ {item.cultivarName || item.species}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {item.alreadyInOtherGarden
                                    ? `In "${item.alreadyInOtherGarden}"`
                                    : item.targetGardenName && item.targetGardenName !== 'Shared Garden'
                                    ? `For ${item.targetGardenName} (${item.stage})`
                                    : `New planting (${item.stage})`}
                                </span>
                              </div>
                            ))}
                            {currentDiscrepancy.updatedItems.map((item, idx) => (
                              <div key={`upd-${idx}`} className="flex items-center justify-between text-amber-800 dark:text-amber-300">
                                <span className="font-medium">~ {item.plantName}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {item.localStage} &rarr; {item.incomingStage}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Merge Discrepancies Action */}
                          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                            <Button
                              type="button"
                              onClick={handleMergeDiscrepancies}
                              className="w-full sm:flex-1 text-xs h-9 gap-1.5"
                            >
                              <GitMerge className="h-3.5 w-3.5" />
                              <span>Merge Discrepancies Into Garden</span>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Up-to-date Status Card (All In Sync) */}
                    {currentDiscrepancy && !currentDiscrepancy.hasDiscrepancies && (
                      <Card className="border-border bg-muted/20">
                        <CardContent className="p-3 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                            <span>
                              All {currentDiscrepancy.totalIncoming} plant(s) across gardens are in sync. Existing plants will not be duplicated.
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/20 shrink-0">
                            In Sync
                          </Badge>
                        </CardContent>
                      </Card>
                    )}

                    {/* Recent Sync Activity Log */}
                    {activityLog.length > 0 && (
                      <Card className="border-border shadow-sm">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="font-headline text-xs sm:text-sm flex items-center gap-1.5 text-muted-foreground">
                              <History className="h-3.5 w-3.5 text-primary" />
                              <span>Recent Sync Activity</span>
                            </CardTitle>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {activityLog.length} events logged
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {activityLog.slice(0, 6).map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-[11px] rounded border bg-background/50 px-2 py-1 font-mono"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className={cn(
                                    "h-1.5 w-1.5 rounded-full shrink-0",
                                    item.direction === 'outward' ? "bg-primary" : "bg-emerald-500"
                                  )} />
                                  <span className="font-semibold text-foreground">@{item.peerHandle}:</span>
                                  <span className="truncate text-muted-foreground">{item.summary}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* TAB 3: STARTER PACKS & SHAREABLE LINKS */}
                {(activeTab === 'packs' || activeTab === 'import-pack') && (
                  <div className="space-y-5">
                    {/* Curated Regional & Starter Datasets */}
                    <Card className="border-border shadow-sm">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="font-headline text-base flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" />
                            <span>Curated Regional &amp; Starter Datasets</span>
                          </CardTitle>
                          <Badge variant="outline" className="text-[10px]">
                            {availableDatasets.length} Packs Available
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Click any starter pack below to preview cultivars, companions, and planting windows in the Review section.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {availableDatasets.map((dataset) => {
                            const isSelected = loadedPackTitle === dataset.name;
                            return (
                              <Button
                                key={dataset.key}
                                type="button"
                                onClick={() => handleLoadStarterDataset(dataset.key)}
                                variant={isSelected ? 'default' : 'outline'}
                                size="sm"
                                className={cn(
                                  "justify-start h-auto py-2.5 px-3 text-left flex flex-col items-start gap-1 transition-all",
                                  isSelected && "ring-2 ring-primary/40 shadow-sm"
                                )}
                              >
                                <div className="flex items-center gap-1.5 w-full">
                                  <Download className="h-3.5 w-3.5 shrink-0" />
                                  <span className="font-semibold text-xs sm:text-sm truncate flex-1">{dataset.name}</span>
                                  {isSelected && (
                                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Active</Badge>
                                  )}
                                </div>
                                <span
                                  className={cn(
                                    'text-[11px] line-clamp-2 font-normal',
                                    isSelected ? 'text-primary-foreground/90' : 'text-muted-foreground'
                                  )}
                                >
                                  {dataset.description}
                                </span>
                              </Button>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Shareable Link & JSON Export / Import */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card className="border-border shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="font-headline text-sm sm:text-base flex items-center gap-2">
                            <Link2 className="h-4 w-4 text-primary" />
                            <span>1-Click Seed Link &amp; Export</span>
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Share your garden via compressed permalink or JSON backup.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2.5">
                          <Button
                            type="button"
                            variant="default"
                            onClick={handleCopyShareablePackLink}
                            className="w-full text-xs h-9 justify-center"
                          >
                            <Link2 className="mr-2 h-3.5 w-3.5" />
                            Copy 1-Click Shareable Link
                          </Button>
                          {onPublish && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={onPublish}
                              className="w-full text-xs h-9 justify-center"
                            >
                              <Upload className="mr-2 h-3.5 w-3.5" />
                              Export JSON to Clipboard
                            </Button>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="border-border shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="font-headline text-sm sm:text-base flex items-center gap-2">
                            <ClipboardPaste className="h-4 w-4 text-primary" />
                            <span>Import Link or JSON Backup</span>
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Paste a <code>?pack=...</code> link or exported JSON to import.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Textarea
                            placeholder="Paste link or raw JSON dataset here..."
                            value={clipboardInput}
                            onChange={(e) => setClipboardInput(e.target.value)}
                            rows={2}
                            className="font-mono text-xs resize-none"
                          />
                          <Button
                            type="button"
                            onClick={handleDecodeClipboardPack}
                            disabled={!clipboardInput.trim()}
                            className="w-full text-xs h-8"
                          >
                            <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
                            Review &amp; Import Pack
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
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
                <div className="space-y-5 animate-in fade-in-50 border-t pt-5">
                  {/* Highlighted Pack Banner with Quick Import */}
                  <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="default" className="text-xs px-2 py-0.5">
                          Pack Ready
                        </Badge>
                        <span className="font-semibold text-sm sm:text-base truncate">
                          {loadedPackTitle || generatedData.locations?.[0]?.name || 'Garden Pack'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {totalSelectedCount} of {generatedData.plantings.length} plants selected for import
                        </span>
                        {' '}&bull; {generatedData.locations.length} garden(s) &bull; FP:{' '}
                        <span className="font-mono font-medium text-foreground">
                          {fingerprintDataset(generatedData)}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs flex-1 sm:flex-initial"
                        onClick={() => {
                          setGeneratedData(null);
                          setLoadedPackTitle(null);
                        }}
                      >
                        Clear
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs flex-1 sm:flex-initial gap-1.5"
                        onClick={handleImport}
                        disabled={isImporting || totalSelectedCount === 0}
                      >
                        {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        <span>Import Selected ({totalSelectedCount})</span>
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-base sm:text-lg">
                        {importMode === 'add' && activeLocation
                          ? `Review Plants for "${activeLocation.name}"`
                          : 'Review Your New Garden'}
                      </h3>
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
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm flex items-center gap-2">
                              <span>Recommended Plants</span>
                              <Badge
                                variant={selectedRecommendedCount > 0 ? "default" : "outline"}
                                className="text-xs px-2 py-0.5"
                              >
                                {selectedRecommendedCount} of {recommendedPlantings.length} selected
                              </Badge>
                            </h4>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs"
                              onClick={handleSelectAllRecommended}
                              disabled={recommendedPlantings.length === 0 || selectedRecommendedCount === recommendedPlantings.length}
                            >
                              Select All
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                              onClick={handleDeselectAllRecommended}
                              disabled={selectedRecommendedCount === 0}
                            >
                              Deselect All
                            </Button>
                          </div>
                        </div>
                        {recommendedPlantings.length > 0 ? (
                          <ScrollArea className="h-64 rounded-md border">
                            <Accordion type="single" collapsible className="w-full">
                              {recommendedPlantings.map((planting) => {
                                const plant = generatedPlantMap.get(String(planting.plantId));
                                if (!plant) return null;
                                const isSelected = selectedPlantingIds.has(String(planting.id));
                                const previewImgUrl = plant.imageUrl || getCuratedPlantImage(plant, planting.name);

                                return (
                                  <AccordionItem
                                    value={planting.id}
                                    key={planting.id}
                                    className={cn(
                                      "border-x-0 border-t-0 px-4 transition-all duration-150",
                                      isSelected
                                        ? "bg-primary/[0.03]"
                                        : "opacity-60 bg-muted/10 hover:opacity-85"
                                    )}
                                  >
                                    <div className="flex items-center w-full py-3 gap-3">
                                      <div
                                        className="flex items-center justify-center shrink-0 cursor-pointer p-0.5"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          togglePlantingSelection(planting.id);
                                        }}
                                      >
                                        <Checkbox
                                          id={`select-${planting.id}`}
                                          checked={isSelected}
                                          onCheckedChange={() => togglePlantingSelection(planting.id)}
                                          aria-label={`Select ${planting.name} for import`}
                                          className="data-[state=checked]:bg-primary h-4 w-4"
                                        />
                                      </div>
                                      <AccordionTrigger className="p-0 hover:no-underline flex-1 justify-start text-left gap-3">
                                        {previewImgUrl && (
                                          <img
                                            src={previewImgUrl}
                                            alt={plant.species}
                                            width={40}
                                            height={40}
                                            {...({ fetchPriority: 'low' } as any)}
                                            loading="lazy"
                                            className={cn(
                                              "h-10 w-10 rounded-md object-cover shrink-0 bg-muted transition-all",
                                              !isSelected && "grayscale-[50%]"
                                            )}
                                          />
                                        )}
                                        <div className="flex flex-col flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-sm sm:text-base leading-tight truncate">
                                              {planting.name}
                                            </span>
                                            {isSelected ? (
                                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-primary/40 text-primary bg-primary/5">
                                                Selected
                                              </Badge>
                                            ) : (
                                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-muted-foreground border-muted-foreground/30">
                                                Unselected
                                              </Badge>
                                            )}
                                            {planting.viability && (
                                              <Badge
                                                variant="outline"
                                                className={cn(
                                                  "text-[10px] py-0 px-1.5 h-4 font-normal flex items-center gap-1",
                                                  planting.viability === 'High' &&
                                                    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300",
                                                  planting.viability === 'Medium' &&
                                                    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300",
                                                  planting.viability === 'Low' &&
                                                    "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-300"
                                                )}
                                              >
                                                <Sparkles className="h-2.5 w-2.5" />
                                                <span>{planting.viability} Viability</span>
                                              </Badge>
                                            )}
                                          </div>
                                          <span className="text-xs text-muted-foreground truncate">{plant.species}</span>
                                        </div>
                                      </AccordionTrigger>
                                    </div>
                                    <AccordionContent className="pb-4 space-y-4">
                                      {planting.viability && (
                                        <div className="rounded-md border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 text-xs space-y-1">
                                          <div className="flex items-center gap-1.5 font-semibold text-emerald-900 dark:text-emerald-200">
                                            <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                            <span>
                                              Viability in Shared Garden
                                              {generatedData.locations?.find((l) => l.id === planting.gardenId)?.name
                                                ? ` (${generatedData.locations.find((l) => l.id === planting.gardenId)!.name})`
                                                : ''}
                                              : {planting.viability}
                                            </span>
                                          </div>
                                          {planting.viabilityReasoning && (
                                            <p className="text-muted-foreground leading-relaxed">
                                              {planting.viabilityReasoning}
                                            </p>
                                          )}
                                          {planting.upcomingTiming && (
                                            <p className="text-[11px] text-muted-foreground font-medium pt-0.5">
                                              Upcoming outlook: {planting.upcomingViability || 'High'} in {planting.upcomingTiming}
                                              {planting.upcomingReasoning ? ` — ${planting.upcomingReasoning}` : ''}
                                            </p>
                                          )}
                                        </div>
                                      )}
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
                                      <div className="flex items-center flex-wrap gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant={isSelected ? "secondary" : "default"}
                                          className="h-7 text-xs flex items-center gap-1.5"
                                          onClick={() => togglePlantingSelection(planting.id)}
                                        >
                                          {isSelected ? (
                                            <>
                                              <Check className="h-3 w-3 text-primary" />
                                              <span>Selected for Import</span>
                                            </>
                                          ) : (
                                            <>
                                              <Plus className="h-3 w-3" />
                                              <span>Select this Plant</span>
                                            </>
                                          )}
                                        </Button>
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
                                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={() => handleRemovePlanting(planting.id)}>
                                          <Trash2 className="mr-1.5 h-3 w-3" />
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
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                  <Sparkles className="h-4 w-4" />
                                  Existing Plant Variations & Strong Matches
                                </span>
                                <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30">
                                  {selectedVariationsCount} of {variationPlantings.length} selected
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-[11px] text-amber-900 dark:text-amber-200 border-amber-500/30"
                                  onClick={handleSelectAllVariations}
                                  disabled={variationPlantings.length === 0 || selectedVariationsCount === variationPlantings.length}
                                >
                                  Include All
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-[11px] text-amber-900/80 dark:text-amber-200/80 border-amber-500/30"
                                  onClick={handleDeselectAllVariations}
                                  disabled={selectedVariationsCount === 0}
                                >
                                  Exclude All
                                </Button>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Placed outside the standard results. These are variations or cultivars of plants already in your garden, recommended only because of a specific horticultural match.
                            </p>
                          </div>

                          <div className="space-y-2.5">
                            {variationPlantings.map((planting) => {
                              const plant = generatedPlantMap.get(String(planting.plantId));
                              if (!plant) return null;
                              const isIncluded = selectedPlantingIds.has(String(planting.id));
                              const matchingExisting = existingPlantings?.find(
                                (ep) =>
                                  (ep.plant?.species && plant.species && ep.plant.species.toLowerCase().trim() === plant.species.toLowerCase().trim()) ||
                                  (ep.name && planting.name && ep.name.toLowerCase().trim() === planting.name.toLowerCase().trim())
                              );
                              const relatedTo = plant.relatedExistingPlant || matchingExisting?.name || plant.species;

                              return (
                                <div
                                  key={planting.id}
                                  className={cn(
                                    "p-3 rounded-md border text-xs space-y-2 transition-all",
                                    isIncluded ? "bg-background/95 border-amber-500/40" : "bg-background/50 border-border opacity-75"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                      <div
                                        className="pt-0.5 cursor-pointer shrink-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          togglePlantingSelection(planting.id);
                                        }}
                                      >
                                        <Checkbox
                                          id={`select-var-${planting.id}`}
                                          checked={isIncluded}
                                          onCheckedChange={() => togglePlantingSelection(planting.id)}
                                          aria-label={`Include variation ${planting.name}`}
                                          className="data-[state=checked]:bg-primary h-4 w-4"
                                        />
                                      </div>
                                      <div className="space-y-1 min-w-0">
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
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={isIncluded ? 'default' : 'outline'}
                                        className="h-7 text-xs px-2.5"
                                        onClick={() => togglePlantingSelection(planting.id)}
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
                    <Button
                      onClick={handleImport}
                      disabled={isImporting || totalSelectedCount === 0}
                      className="w-full"
                    >
                      {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                      {totalSelectedCount === 0
                        ? 'Select at Least 1 Plant to Import'
                        : `Confirm Import (${totalSelectedCount} Plant${totalSelectedCount === 1 ? '' : 's'})`}
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

      {/* Identity Reset Confirmation Dialog */}
      <AlertDialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span>Reset Claimed Grower Identity?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs">
              <p>
                You are currently broadcasting as <strong>@{rootHandle}</strong> with device extension <strong>/{deviceId}</strong>.
              </p>
              <p>
                Resetting will revoke this claimed handle on this device, generate a new cryptographic keypair, and assign a fresh provisional identity. Peered devices that have added <strong>@{rootHandle}</strong> to their trusted inward stream list will need to be re-paired.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Claimed Handle</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetIdentity}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reset Identity
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

    
    
    
