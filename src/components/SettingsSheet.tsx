'use client';

import { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Upload,
  Download,
  KeyRound,
  Sparkles,
  AlertTriangle,
  SearchCheck,
  Rocket,
  MessageSquare,
  GitBranch,
  ExternalLink,
  BrainCircuit,
  Cpu,
  ClipboardPaste,
  GitFork,
  Puzzle,
  Copy,
  Check,
  PlusCircle,
  Wand2,
  Replace,
  Eye,
  User,
  LayoutGrid,
  Radio,
  Loader2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  getOrCreateGrowerIdentity,
  updateGrowerIdentity,
  getSavedP2PRoomId,
  broadcastApiKeysToP2PRoom,
  fetchLatestFromP2PRoom,
} from '@/lib/p2p-signals';
import { availableDatasets, loadDataset } from '@/lib/datasets';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type {
  ViabilityAnalysisMode,
  AiDataset,
  FreeLlmConfig,
  GardenLocation,
} from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  decodeSeedPackFromInput,
  encodeSeedPackToParam,
  mergeSeedPackIntoDb,
  type GardenImportMode,
} from '@/lib/seed-pack';
import { db } from '@/lib/db';
import {
  REPO_URL,
  FEEDBACK_URL,
} from '@/lib/constants';
import { registeredExtensions } from '@/extensions/registry';
import {
  useExtensions,
  ExtensionToggleList,
  OPEN_SETTINGS_EVENT,
} from '@/extensions/use-extensions';

type SettingsSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onImport: (datasetKey: string) => void;
  onAiImportOpen: () => void;
  onOpenDatasetReview?: (dataset: AiDataset, title: string) => void;
  activeLocation?: GardenLocation | null;
  onPublish: () => void;
  onApiKeysChange: (keys: FreeLlmConfig) => void;
  apiKeys: FreeLlmConfig;
  viabilityMechanism: ViabilityAnalysisMode;
  onViabilityMechanismChange: (mechanism: ViabilityAnalysisMode) => void;
  onDuplicateReviewOpen: () => void;
};

type ConfirmationState = {
  title: string;
  datasetKey?: string;
  data: AiDataset;
} | null;

export function SettingsSheet({
  isOpen,
  onOpenChange,
  onImport,
  onAiImportOpen,
  onOpenDatasetReview,
  activeLocation,
  onPublish,
  onApiKeysChange,
  apiKeys,
  onDuplicateReviewOpen,
}: SettingsSheetProps) {
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>(null);
  const [selectedImportMode, setSelectedImportMode] = useState<GardenImportMode>(
    activeLocation ? 'add' : 'new'
  );
  const [localApiKeys, setLocalApiKeys] = useState<FreeLlmConfig>(apiKeys);
  const [isClipboardImportOpen, setIsClipboardImportOpen] = useState(false);
  const [clipboardData, setClipboardData] = useState('');
  const [builtInAiStatus, setBuiltInAiStatus] = useState<string>('checking...');
  const [upstreamCommit, setUpstreamCommit] = useState<{ sha: string; date: string } | null>(null);
  const [copiedMcp, setCopiedMcp] = useState(false);
  const [growerHandle, setGrowerHandle] = useState('');
  const [growerRegion, setGrowerRegion] = useState('');
  const [shareApiKeysWithBroadcast, setShareApiKeysWithBroadcast] = useState(false);
  const [keySyncRoomId, setKeySyncRoomId] = useState('');
  const [isKeySyncing, setIsKeySyncing] = useState(false);

  const { toast } = useToast();
  const { enabledExtensions } = useExtensions();

  const allPlantings = useLiveQuery(() => db.plantings.toArray(), []);

  const matrixData = useMemo(() => {
    const list = activeLocation
      ? allPlantings?.filter((p) => p.gardenId === activeLocation.id)
      : allPlantings;

    const stages: ('Wishlist' | 'Planting' | 'Growing' | 'Harvest')[] = [
      'Wishlist',
      'Planting',
      'Growing',
      'Harvest',
    ];

    const stats: Record<
      'Wishlist' | 'Planting' | 'Growing' | 'Harvest',
      { High: number; Medium: number; Low: number; Pending: number; Total: number }
    > = {
      Wishlist: { High: 0, Medium: 0, Low: 0, Pending: 0, Total: 0 },
      Planting: { High: 0, Medium: 0, Low: 0, Pending: 0, Total: 0 },
      Growing: { High: 0, Medium: 0, Low: 0, Pending: 0, Total: 0 },
      Harvest: { High: 0, Medium: 0, Low: 0, Pending: 0, Total: 0 },
    };

    let grandTotal = 0;
    const totals = { High: 0, Medium: 0, Low: 0, Pending: 0 };

    list?.forEach((p) => {
      const lastStatus = (p.history && p.history.length > 0
        ? p.history[p.history.length - 1].status
        : 'Wishlist') as 'Wishlist' | 'Planting' | 'Growing' | 'Harvest';

      if (stats[lastStatus]) {
        stats[lastStatus].Total++;
        grandTotal++;
        const v = p.viability;
        if (v === 'High' || v === 'Medium' || v === 'Low') {
          stats[lastStatus][v]++;
          totals[v]++;
        } else {
          stats[lastStatus].Pending++;
          totals.Pending++;
        }
      }
    });

    return { stages, stats, grandTotal, totals };
  }, [allPlantings, activeLocation]);

  useEffect(() => {
    setSelectedImportMode(activeLocation ? 'add' : 'new');
  }, [activeLocation, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const identity = getOrCreateGrowerIdentity();
      setGrowerHandle(identity.displayName);
      setGrowerRegion(identity.region);
    }
  }, [isOpen]);

  const handleSaveGrowerIdentity = () => {
    const updated = updateGrowerIdentity({
      displayName: growerHandle.trim(),
      region: growerRegion.trim(),
    });
    setGrowerHandle(updated.displayName);
    setGrowerRegion(updated.region);
    toast({
      title: 'Grower Handle Saved',
      description: `Broadcasting as "${updated.displayName}" in ${updated.region}.`,
    });
  };

  useEffect(() => {
    const handleOpenSettingsEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ section?: string }>).detail;
      onOpenChange(true);
      if (detail?.section === 'extensions') {
        setTimeout(() => {
          const el = document.getElementById('settings-crowd-extensions');
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 180);
      }
    };

    window.addEventListener(OPEN_SETTINGS_EVENT, handleOpenSettingsEvent);
    return () => {
      window.removeEventListener(OPEN_SETTINGS_EVENT, handleOpenSettingsEvent);
    };
  }, [onOpenChange]);

  useEffect(() => {
    if (isOpen) {
      setLocalApiKeys(apiKeys);
      setKeySyncRoomId(getSavedP2PRoomId());
      const savedShare = localStorage.getItem('grow_share_keys_with_broadcast');
      if (savedShare !== null) {
        setShareApiKeysWithBroadcast(savedShare === 'true');
      }

      if (typeof self !== 'undefined' && 'LanguageModel' in self) {
        (self as any).LanguageModel.availability()
          .then((status: string) => setBuiltInAiStatus(status))
          .catch(() => setBuiltInAiStatus('unavailable'));
      } else {
        setBuiltInAiStatus('unavailable');
      }

      const cached = sessionStorage.getItem('grow_upstream_commit');
      if (cached) {
        try {
          setUpstreamCommit(JSON.parse(cached));
        } catch {
          // ignore
        }
      } else {
        fetch('https://api.github.com/repos/creat-o-r/grow/commits/main')
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.sha) {
              const info = {
                sha: String(data.sha).slice(0, 7),
                date: data.commit?.committer?.date?.slice(0, 10) || 'latest',
              };
              setUpstreamCommit(info);
              sessionStorage.setItem('grow_upstream_commit', JSON.stringify(info));
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, apiKeys]);

  const areApiKeysSet = Boolean(
    apiKeys.gemini || apiKeys.groq || apiKeys.openrouter || apiKeys.ollamaUrl
  );
  const vercelDeployUrl = `https://vercel.com/new/clone?repository-url=${encodeURIComponent(REPO_URL)}`;
  const feedbackUrl = FEEDBACK_URL;

  const handleImportClick = async (datasetKey: string) => {
    try {
      const ds = await loadDataset(datasetKey);
      // If parent provided the full Review & Import sheet handler, open it directly or offer the 3 garden options
      setConfirmationState({
        title: ds.name,
        datasetKey,
        data: ds,
      });
    } catch (err: any) {
      toast({
        title: 'Failed to Load Dataset',
        description: err?.message || 'Could not load starter dataset.',
        variant: 'destructive',
      });
    }
  };

  const handleReviewBeforeImport = () => {
    if (!confirmationState) return;
    const { data, title } = confirmationState;
    setConfirmationState(null);
    onOpenChange(false);
    onOpenDatasetReview?.(data, title);
  };

  const handleConfirm = async () => {
    if (!confirmationState) return;

    try {
      // If the user selected 'add' to active garden and we have the full Review & Duplicate Resolution sheet,
      // route through mergeSeedPackIntoDb with the exact chosen GardenImportMode ('add' | 'new' | 'replace')
      if (selectedImportMode === 'replace' && confirmationState.datasetKey) {
        onImport(confirmationState.datasetKey);
        setConfirmationState(null);
        onOpenChange(false);
        return;
      }

      const res = await mergeSeedPackIntoDb(confirmationState.data, {
        mode: selectedImportMode,
        targetGardenId: activeLocation?.id || null,
        datasetKey: confirmationState.datasetKey,
        author: confirmationState.data.contributor?.name || confirmationState.title,
      });

      toast({
        title:
          selectedImportMode === 'add'
            ? `Added to "${res.targetGardenName}"`
            : selectedImportMode === 'new'
            ? `Created New Garden "${res.targetGardenName}"`
            : 'Garden Replaced',
        description: `Imported ${res.addedPlantings} plantings (${res.addedPlants} new species, ${res.mergedPlants} matched existing).`,
      });

      if (selectedImportMode === 'new' || selectedImportMode === 'replace') {
        window.location.reload();
      }
    } catch (err: any) {
      console.error('Dataset import failed:', err);
      toast({
        title: 'Import Failed',
        description: err?.message || 'The dataset could not be imported.',
        variant: 'destructive',
      });
    }

    setConfirmationState(null);
    onOpenChange(false);
  };

  const handleSaveApiKeys = () => {
    onApiKeysChange(localApiKeys);
    onOpenChange(false);
  };

  const handleBroadcastApiKeys = async () => {
    if (!keySyncRoomId.trim()) return;
    setIsKeySyncing(true);
    try {
      await broadcastApiKeysToP2PRoom(keySyncRoomId.trim(), localApiKeys);
      toast({
        title: `API Keys Broadcasted to "${keySyncRoomId.trim()}"`,
        description: 'Enter this room code on your other device or browser profile and click "Pull Keys" to sync.',
      });
    } catch (err: any) {
      toast({
        title: 'Broadcast Failed',
        description: err?.message || 'Could not broadcast API keys.',
        variant: 'destructive',
      });
    } finally {
      setIsKeySyncing(false);
    }
  };

  const handlePullApiKeys = async () => {
    if (!keySyncRoomId.trim()) return;
    setIsKeySyncing(true);
    try {
      const latest = await fetchLatestFromP2PRoom(keySyncRoomId.trim());
      if (!latest?.apiKeys || !Object.values(latest.apiKeys).some(Boolean)) {
        toast({
          title: 'No Keys Found in Room',
          description: `No API keys were found in room "${keySyncRoomId.trim()}". Make sure the other device clicked "Broadcast Keys".`,
          variant: 'destructive',
        });
        return;
      }
      const newKeys: FreeLlmConfig = {
        gemini: latest.apiKeys.gemini || localApiKeys.gemini || '',
        groq: latest.apiKeys.groq || localApiKeys.groq,
        openrouter: latest.apiKeys.openrouter || localApiKeys.openrouter,
        ollamaUrl: latest.apiKeys.ollamaUrl || localApiKeys.ollamaUrl,
      };
      setLocalApiKeys(newKeys);
      onApiKeysChange(newKeys);
      const configured = (['gemini', 'groq', 'openrouter', 'ollamaUrl'] as const)
        .filter((k) => Boolean(latest.apiKeys?.[k]))
        .join(', ');
      toast({
        title: 'API Keys Pulled & Saved',
        description: `Imported keys from ${latest.peerName} (${configured}).`,
      });
    } catch (err: any) {
      toast({
        title: 'Pull Failed',
        description: err?.message || 'Could not pull keys from room.',
        variant: 'destructive',
      });
    } finally {
      setIsKeySyncing(false);
    }
  };

  const handleClipboardImport = (openInReviewSheet = false) => {
    try {
      const parsedData = decodeSeedPackFromInput(clipboardData);
      const packName =
        parsedData.locations?.[0]?.name || 'Clipboard / Seed Pack Dataset';
      setIsClipboardImportOpen(false);
      setClipboardData('');

      if (openInReviewSheet && onOpenDatasetReview) {
        onOpenChange(false);
        onOpenDatasetReview(parsedData, packName);
        return;
      }

      setConfirmationState({
        title: packName,
        data: parsedData,
      });
    } catch {
      toast({
        title: 'Invalid Seed Pack or JSON',
        description:
          'Paste either a ?pack= shareable URL or valid JSON exported from Grow.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyMcpUrl = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const [locations, plants, plantings] = await Promise.all([
      db.locations.toArray(),
      db.plants.toArray(),
      db.plantings.toArray(),
    ]);
    const hasLiveData = locations.length > 0 || plants.length > 0 || plantings.length > 0;
    const mcpUrl = hasLiveData
      ? `${origin}/api/mcp?pack=${encodeSeedPackToParam({ locations, plants, plantings })}`
      : `${origin}/api/mcp`;

    await navigator.clipboard.writeText(mcpUrl);
    setCopiedMcp(true);
    setTimeout(() => setCopiedMcp(false), 2000);
    toast({
      title: hasLiveData ? 'Live IndexedDB MCP URL Copied' : 'MCP Server URL Copied',
      description: hasLiveData
        ? 'Copied /api/mcp?pack=... carrying your live browser IndexedDB garden for Claude, Cursor, or Antigravity.'
        : 'Add this Streamable HTTP endpoint to Claude, Cursor, Antigravity, or another Grow instance.',
    });
  };

  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmationState(null);
            setLocalApiKeys(apiKeys);
          }
          onOpenChange(open);
        }}
      >
        <SheetContent className="sm:max-w-lg w-[90vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-headline">Settings & Collaboration Hub</SheetTitle>
            <SheetDescription>
              Manage seed packs, free AI providers, MCP/A2A agent endpoints, and crowd extensions.
            </SheetDescription>
          </SheetHeader>
          <div className="py-6 space-y-6">
            {/* Garden Status & Viability Matrix Overview */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-headline text-lg flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-primary" />
                    <span>Garden Viability Matrix</span>
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-mono">
                    {matrixData.grandTotal} Plant{matrixData.grandTotal === 1 ? '' : 's'}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {activeLocation
                    ? `Cross-tabular overview of lifecycle stages and viability for "${activeLocation.name}".`
                    : 'Cross-tabular overview of lifecycle stages and viability across your garden.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-5 text-center text-xs font-semibold bg-muted/50 p-2 border-b">
                    <div className="text-left font-bold text-muted-foreground pl-1">Stage</div>
                    <div className="text-green-600 dark:text-green-400 font-mono">High</div>
                    <div className="text-yellow-600 dark:text-yellow-400 font-mono">Med</div>
                    <div className="text-red-600 dark:text-red-400 font-mono">Low</div>
                    <div className="text-muted-foreground font-mono">Total</div>
                  </div>
                  <div className="divide-y divide-border/60 text-xs">
                    {matrixData.stages.map((st) => {
                      const row = matrixData.stats[st];
                      return (
                        <div key={st} className="grid grid-cols-5 items-center p-2 text-center hover:bg-muted/30 transition-colors">
                          <div className="text-left font-medium pl-1 flex items-center gap-1.5">
                            <span className="truncate">{st}</span>
                          </div>
                          <div>
                            {row.High > 0 ? (
                              <Badge className="bg-green-600 text-white font-mono px-1.5 py-0 h-4 text-[10px]">
                                {row.High}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/50 font-mono">0</span>
                            )}
                          </div>
                          <div>
                            {row.Medium > 0 ? (
                              <Badge className="bg-yellow-500 text-black font-mono px-1.5 py-0 h-4 text-[10px]">
                                {row.Medium}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/50 font-mono">0</span>
                            )}
                          </div>
                          <div>
                            {row.Low > 0 ? (
                              <Badge className="bg-red-600 text-white font-mono px-1.5 py-0 h-4 text-[10px]">
                                {row.Low}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/50 font-mono">0</span>
                            )}
                          </div>
                          <div className="font-mono font-semibold text-foreground">
                            {row.Total}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-5 items-center p-2 text-center bg-muted/40 border-t font-semibold text-xs">
                    <div className="text-left pl-1 text-muted-foreground">Total</div>
                    <div className="font-mono text-green-600 dark:text-green-400">{matrixData.totals.High}</div>
                    <div className="font-mono text-yellow-600 dark:text-yellow-400">{matrixData.totals.Medium}</div>
                    <div className="font-mono text-red-600 dark:text-red-400">{matrixData.totals.Low}</div>
                    <div className="font-mono text-foreground font-bold">{matrixData.grandTotal}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Grower Handle & Microclimate */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-headline text-lg flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span>Grower Handle</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Your public handle and microclimate region used on live P2P garden rooms and community viability proofs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="grower-handle-input" className="text-xs">Grower Handle</Label>
                    <Input
                      id="grower-handle-input"
                      value={growerHandle}
                      onChange={(e) => setGrowerHandle(e.target.value)}
                      placeholder="e.g., Grower-4026, @colby, SunnyBalcony"
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="grower-region-input" className="text-xs">Microclimate / Region</Label>
                    <Input
                      id="grower-region-input"
                      value={growerRegion}
                      onChange={(e) => setGrowerRegion(e.target.value)}
                      placeholder="e.g., Auckland Zone 10, Pacific NW"
                      className="text-xs h-8"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleSaveGrowerIdentity}
                  >
                    Save Grower Handle
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* P0: Data Management & Non-Destructive Seed Pack Merging */}
            <Card>
              <CardHeader>
                <CardTitle className="font-headline text-lg">Data Management</CardTitle>
                <CardDescription className="text-xs">
                  Add plants to your active garden, create a new garden, or replace existing data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    Import a sample dataset
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {availableDatasets.map((dataset) => (
                      <Button
                        key={dataset.key}
                        onClick={() => handleImportClick(dataset.key)}
                        variant="outline"
                        size="sm"
                        className="justify-start truncate"
                        title={dataset.description}
                      >
                        <Download className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">{dataset.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="border-t pt-4 space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    Generate a new dataset with AI
                  </h4>
                  {!areApiKeysSet && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Free AI Key Required</AlertTitle>
                      <AlertDescription>
                        Add a free Gemini, Groq, or OpenRouter key below to generate custom AI packs.
                      </AlertDescription>
                    </Alert>
                  )}
                  <Button
                    onClick={onAiImportOpen}
                    disabled={!areApiKeysSet}
                    className="w-full"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Data with AI
                  </Button>
                </div>
                <div className="border-t pt-4 space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    Backup & Sync Between Devices
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Paste a <code>?pack=</code> link or JSON backup to add to your active garden, create a new garden, or restore.
                  </p>
                  <Button
                    onClick={() => setIsClipboardImportOpen(true)}
                    variant="outline"
                    className="w-full"
                  >
                    <ClipboardPaste className="mr-2 h-4 w-4" />
                    Import from Clipboard / Seed Pack Link
                  </Button>
                  <Button onClick={onPublish} variant="outline" className="w-full">
                    <Upload className="mr-2 h-4 w-4" />
                    Export to Clipboard
                  </Button>
                </div>
                <div className="border-t pt-4 space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Maintenance</h4>
                  <Button
                    onClick={onDuplicateReviewOpen}
                    variant="outline"
                    className="w-full"
                  >
                    <SearchCheck className="mr-2 h-4 w-4" />
                    Review & Merge Duplicates
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* P2: Multi-Free-LLM Router Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="font-headline text-lg">
                  AI Settings (Free-LLM Cascade)
                </CardTitle>
                <CardDescription className="text-xs">
                  Use Google Gemini, Groq, OpenRouter (`:free`), or Local Ollama—works with any single key or all together.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm flex items-center gap-2">
                        <BrainCircuit className="h-4 w-4 text-primary" />
                        Cloud Free-Tier Pool (Gemini • Groq • OpenRouter)
                      </Label>
                      <div className="text-xs text-muted-foreground">
                        {areApiKeysSet
                          ? 'Active. Multi-model fallback cascade ready.'
                          : 'Configure one or more free API keys below.'}
                      </div>
                    </div>
                    <Badge variant={areApiKeysSet ? 'default' : 'secondary'}>
                      {areApiKeysSet ? 'Active' : 'Key Needed'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-primary" />
                        Browser Built-in AI (Gemini Nano)
                      </Label>
                      <div className="text-xs text-muted-foreground">
                        Zero-latency on-device `LanguageModel` API when supported by browser.
                      </div>
                    </div>
                    <Badge variant={builtInAiStatus === 'available' ? 'default' : 'outline'}>
                      {builtInAiStatus}
                    </Badge>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="gemini-key" className="text-xs flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>1. Google Gemini API Key (Optional if Groq/OpenRouter set)</span>
                      </Label>
                      {!localApiKeys.gemini && (
                        <a
                          href="https://aistudio.google.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Get Free Key <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <Input
                      id="gemini-key"
                      type="password"
                      placeholder="AIza..."
                      value={localApiKeys.gemini || ''}
                      onChange={(e) =>
                        setLocalApiKeys((prev) => ({ ...prev, gemini: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="groq-key" className="text-xs flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>2. Groq API Key (Works Standalone — Llama 3.3 70B Free)</span>
                      </Label>
                      {!localApiKeys.groq && (
                        <a
                          href="https://console.groq.com/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Get Free Key <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <Input
                      id="groq-key"
                      type="password"
                      placeholder="gsk_..."
                      value={localApiKeys.groq || ''}
                      onChange={(e) =>
                        setLocalApiKeys((prev) => ({ ...prev, groq: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="openrouter-key" className="text-xs flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>3. OpenRouter API Key (`:free` Model Pool)</span>
                      </Label>
                      {!localApiKeys.openrouter && (
                        <a
                          href="https://openrouter.ai/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Get Free Key <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <Input
                      id="openrouter-key"
                      type="password"
                      placeholder="sk-or-v1-..."
                      value={localApiKeys.openrouter || ''}
                      onChange={(e) =>
                        setLocalApiKeys((prev) => ({ ...prev, openrouter: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ollama-url" className="text-xs flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5" />
                      <span>4. Local Ollama Endpoint ($0 Offline Inference)</span>
                    </Label>
                    <Input
                      id="ollama-url"
                      type="text"
                      placeholder="http://localhost:11434"
                      value={localApiKeys.ollamaUrl || ''}
                      onChange={(e) =>
                        setLocalApiKeys((prev) => ({ ...prev, ollamaUrl: e.target.value }))
                      }
                    />
                  </div>

                  <Button onClick={handleSaveApiKeys} className="w-full">
                    Save API Keys
                  </Button>

                  {/* P2P Broadcast & Key Sharing */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />
                        <span>P2P Broadcast &amp; Key Sharing</span>
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Broadcast configured AI credentials to other devices on a private room code ($0 server cost).
                      </p>
                    </div>

                    {/* Option toggle for garden broadcast */}
                    <div className="flex items-center justify-between rounded-lg border p-2.5 bg-muted/20">
                      <div className="space-y-0.5 pr-2">
                        <Label htmlFor="settings-share-keys-toggle" className="text-xs font-medium cursor-pointer">
                          Share API keys with garden broadcasts
                        </Label>
                        <div className="text-[11px] text-muted-foreground">
                          When streaming gardens in Share &amp; Sync, bundle your AI keys so receiving devices can run AI directly.
                        </div>
                      </div>
                      <Switch
                        id="settings-share-keys-toggle"
                        checked={shareApiKeysWithBroadcast}
                        onCheckedChange={(checked) => {
                          setShareApiKeysWithBroadcast(checked);
                          localStorage.setItem('grow_share_keys_with_broadcast', checked ? 'true' : 'false');
                        }}
                      />
                    </div>

                    {/* Room Code + Broadcast / Pull Buttons */}
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label htmlFor="settings-key-sync-room" className="text-xs">
                          Broadcast Room Code
                        </Label>
                        <Input
                          id="settings-key-sync-room"
                          value={keySyncRoomId}
                          onChange={(e) => setKeySyncRoomId(e.target.value)}
                          placeholder="e.g., my-keys-room-2026"
                          className="text-xs h-8 font-mono"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs h-8 gap-1"
                          disabled={!keySyncRoomId.trim() || isKeySyncing || !areApiKeysSet}
                          onClick={handleBroadcastApiKeys}
                        >
                          {isKeySyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                          <span>Broadcast Keys</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs h-8 gap-1"
                          disabled={!keySyncRoomId.trim() || isKeySyncing}
                          onClick={handlePullApiKeys}
                        >
                          {isKeySyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          <span>Pull Keys</span>
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Note: Anyone with this room code can access broadcasted keys. Only use private room codes.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* P1 & P3: MCP / A2A Agent Endpoints & Crowd Extensions */}
            <Card>
              <CardHeader>
                <CardTitle className="font-headline text-lg">
                  About, MCP/A2A & Crowd Development
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Agent Endpoints (MCP & Google A2A)
                  </Label>
                  <div className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-xs">
                    <div className="truncate">
                      <div className="font-mono font-medium">/api/mcp</div>
                      <div className="text-muted-foreground">
                        Streamable HTTP MCP + <code>/.well-known/agent.json</code>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleCopyMcpUrl}>
                      {copiedMcp ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <div
                  id="settings-crowd-extensions"
                  className="border-t pt-4 space-y-2 scroll-mt-6"
                >
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Puzzle className="h-3.5 w-3.5" />
                    Loaded Crowd Extensions ({enabledExtensions.length}/{registeredExtensions.length} Active)
                  </Label>
                  <ExtensionToggleList />
                </div>

                <div className="border-t pt-4 space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    Features &amp; Tour
                  </h4>
                  <a href="/marketing">
                    <Button variant="secondary" className="w-full">
                      <Sparkles className="mr-2 h-4 w-4 text-primary" />
                      View Features &amp; Benefits Overview
                    </Button>
                  </a>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    Deploy Your Own Instance
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Click below to deploy your own copy of this application for free on Vercel.
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <a href={vercelDeployUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full">
                        <Rocket className="mr-2 h-4 w-4" />
                        Deploy Free on Vercel
                      </Button>
                    </a>
                    <a href={`${REPO_URL}/fork`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full">
                        <GitFork className="mr-2 h-4 w-4" />
                        Fork on GitHub (Build 1-File Extensions)
                      </Button>
                    </a>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs p-3 bg-muted rounded-md">
                    <span className="font-semibold text-amber-400 uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 font-headline">
                      Experimental
                    </span>
                    {upstreamCommit ? (
                      <a
                        href={`${REPO_URL}/commits/main`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-mono flex items-center gap-1"
                      >
                        <GitBranch className="h-3 w-3" />
                        git @{upstreamCommit.sha} ({upstreamCommit.date})
                      </a>
                    ) : (
                      <a
                        href={REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-mono flex items-center gap-1"
                      >
                        <GitBranch className="h-3 w-3" />
                        git @main
                      </a>
                    )}
                  </div>

                  <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="block">
                    <Button variant="outline" className="w-full">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Send Feedback / Bug Report
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isClipboardImportOpen} onOpenChange={setIsClipboardImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import from Clipboard / Seed Pack Link</DialogTitle>
            <DialogDescription>
              Paste a shareable <code>?pack=...</code> link or exported JSON dataset. You can review individual plants and variations or choose your garden import mode next.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Paste your garden JSON or https://.../?pack=... link here..."
            className="min-h-[180px] font-mono text-xs"
            value={clipboardData}
            onChange={(e) => setClipboardData(e.target.value)}
          />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            {onOpenDatasetReview && (
              <Button
                variant="outline"
                onClick={() => handleClipboardImport(true)}
                disabled={!clipboardData.trim()}
              >
                <Eye className="mr-2 h-4 w-4" />
                Review Plants & Variations
              </Button>
            )}
            <Button
              onClick={() => handleClipboardImport(false)}
              disabled={!clipboardData.trim()}
            >
              Continue to Garden Options
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmationState}
        onOpenChange={(open) => !open && setConfirmationState(null)}
      >
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline">
              Import Options for &ldquo;{confirmationState?.title}&rdquo;
            </AlertDialogTitle>
            <AlertDialogDescription>
              Choose how you would like to import these{' '}
              <strong>{confirmationState?.data.plants.length || 0} plants</strong> into your garden:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2 space-y-3">
            <RadioGroup
              value={selectedImportMode}
              onValueChange={(val) => setSelectedImportMode(val as GardenImportMode)}
              className="space-y-2"
            >
              {activeLocation && (
                <Label
                  htmlFor="settings-import-add"
                  className="flex items-start space-x-3 space-y-0 rounded-md border p-3.5 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary"
                >
                  <RadioGroupItem value="add" id="settings-import-add" className="mt-0.5" />
                  <div className="flex flex-col space-y-0.5">
                    <span className="font-bold flex items-center gap-2 text-sm">
                      <PlusCircle className="h-4 w-4 text-primary" /> Add Plants to Active Garden
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Adds new plants directly into your active garden &ldquo;{activeLocation.name}&rdquo; without deleting existing plants.
                    </span>
                  </div>
                </Label>
              )}

              <Label
                htmlFor="settings-import-new"
                className="flex items-start space-x-3 space-y-0 rounded-md border p-3.5 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary"
              >
                <RadioGroupItem value="new" id="settings-import-new" className="mt-0.5" />
                <div className="flex flex-col space-y-0.5">
                  <span className="font-bold flex items-center gap-2 text-sm">
                    <Wand2 className="h-4 w-4 text-primary" /> Create as New Garden
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Creates &ldquo;{confirmationState?.data.locations?.[0]?.name || confirmationState?.title}&rdquo; as a separate garden location without affecting your existing gardens.
                  </span>
                </div>
              </Label>

              <Label
                htmlFor="settings-import-replace"
                className="flex items-start space-x-3 space-y-0 rounded-md border p-3.5 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary"
              >
                <RadioGroupItem value="replace" id="settings-import-replace" className="mt-0.5" />
                <div className="flex flex-col space-y-0.5">
                  <span className="font-bold flex items-center gap-2 text-sm">
                    <Replace className="h-4 w-4 text-destructive" /> Replace Current Garden
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Deletes all existing data and replaces it with this dataset.
                  </span>
                </div>
              </Label>
            </RadioGroup>

            {onOpenDatasetReview && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full text-xs"
                onClick={handleReviewBeforeImport}
              >
                <Eye className="mr-2 h-3.5 w-3.5" />
                Review Plants, Variations & Duplicate Merge Options First...
              </Button>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmationState(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirm Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
