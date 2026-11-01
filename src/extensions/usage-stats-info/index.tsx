'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { GrowExtension, ExtensionContext } from '../registry';
import { db } from '@/lib/db';
import {
  buildShareableSeedPackUrl,
  buildGitHubContributeDatasetUrl,
} from '@/lib/seed-pack';
import type { AiDataset } from '@/lib/types';
import {
  APP_VERSION,
  REPO_URL,
  FEEDBACK_URL,
  ISSUES_URL,
  DISCUSSIONS_URL,
} from '@/lib/constants';
import { getOrCreateGrowerIdentity, getSavedP2PRoomId } from '@/lib/p2p-signals';
import { openSettingsToExtensions, OPEN_SETTINGS_EVENT } from '../use-extensions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Activity,
  BarChart3,
  HardDrive,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Download,
  ExternalLink,
  Sparkles,
  Sprout,
  HeartHandshake,
  Cpu,
  Layers,
  Globe,
  RefreshCw,
  Info,
  Lock,
  Unlock,
  Package,
  Share2,
  Zap,
  Terminal,
  Sliders,
  Radio,
} from 'lucide-react';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function UsageStatsInfoWidget({ plants, plantings, activeLocation }: ExtensionContext) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [copiedMcp, setCopiedMcp] = useState(false);
  const [copiedA2A, setCopiedA2A] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Storage estimation and persistence state
  const [storageEstimate, setStorageEstimate] = useState<{
    usage?: number;
    quota?: number;
  }>({});
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const [isRequestingPersist, setIsRequestingPersist] = useState(false);

  // Browser feature detection
  const hasStorageApi =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'storage' in navigator;
  const hasChromeAi =
    typeof window !== 'undefined' &&
    ('ai' in window || 'LanguageModel' in (window as any) || 'LanguageModel' in (self as any));
  const hasWebMcp =
    typeof window !== 'undefined' &&
    ('modelContextProtocol' in (navigator as any) || 'webmcp' in (window as any));

  // Query live Dexie tables
  const dbCounts = useLiveQuery(async () => {
    const [plantCount, plantingCount, locationCount, aiLogCount] = await Promise.all([
      db.plants.count(),
      db.plantings.count(),
      db.locations.count(),
      db.aiLogs.count(),
    ]);
    return { plantCount, plantingCount, locationCount, aiLogCount };
  }, []);

  const aiLogs = useLiveQuery(() => db.aiLogs.toArray(), []);

  // Refresh storage estimate and persistence status
  const refreshStorageInfo = useCallback(async () => {
    if (!hasStorageApi) return;
    try {
      if (navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        setStorageEstimate({ usage: est.usage, quota: est.quota });
      }
      if (navigator.storage.persisted) {
        const persisted = await navigator.storage.persisted();
        setIsPersisted(persisted);
      }
    } catch (err) {
      console.warn('Could not read storage metrics:', err);
    }
  }, [hasStorageApi]);

  useEffect(() => {
    if (isOpen) {
      refreshStorageInfo();
    }
  }, [isOpen, refreshStorageInfo]);

  // Request browser storage persistence grant
  const handleRequestPersistence = async () => {
    if (!hasStorageApi || !navigator.storage.persist) {
      toast({
        title: 'Not Supported',
        description: 'Your current browser does not support the Storage Persistence API.',
        variant: 'destructive',
      });
      return;
    }
    setIsRequestingPersist(true);
    try {
      const granted = await navigator.storage.persist();
      setIsPersisted(granted);
      if (granted) {
        toast({
          title: 'Persistent Storage Granted!',
          description:
            'Your browser promises not to evict your garden IndexedDB under disk pressure.',
        });
      } else {
        toast({
          title: 'Persistence Not Granted by Browser',
          description:
            'The browser declined persistent storage. Bookmark or install Grow as a PWA, or check device disk space.',
        });
      }
    } catch (err) {
      console.error('Failed to request persistence:', err);
      toast({
        title: 'Request Failed',
        description: 'An error occurred while requesting persistent storage.',
        variant: 'destructive',
      });
    } finally {
      setIsRequestingPersist(false);
    }
  };

  // Build full garden backup dataset
  const buildFullBackupDataset = async (): Promise<AiDataset> => {
    const [allLocations, allPlants, allPlantings] = await Promise.all([
      db.locations.toArray(),
      db.plants.toArray(),
      db.plantings.toArray(),
    ]);
    return {
      locations: allLocations,
      plants: allPlants,
      plantings: allPlantings,
    };
  };

  // Copy full seed pack URL
  const handleCopyBackupUrl = async () => {
    setIsExporting(true);
    try {
      const dataset = await buildFullBackupDataset();
      const url = buildShareableSeedPackUrl(dataset);
      await navigator.clipboard.writeText(url);
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2500);
      toast({
        title: 'Full Garden Seed Pack Copied!',
        description: `Exported ${dataset.plants.length} plants and ${dataset.plantings.length} plantings into a shareable 1-click restore URL.`,
      });
    } catch (err) {
      console.error('Failed to copy backup URL:', err);
      toast({
        title: 'Export Failed',
        description: 'Could not generate backup seed pack.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Download raw JSON backup
  const handleDownloadJsonBackup = async () => {
    setIsExporting(true);
    try {
      const dataset = await buildFullBackupDataset();
      const blob = new Blob([JSON.stringify(dataset, null, 2)], {
        type: 'application/json',
      });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `grow-garden-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      toast({
        title: 'JSON Backup Downloaded',
        description: 'Saved complete garden database to your device.',
      });
    } catch (err) {
      console.error('Failed to download JSON:', err);
      toast({
        title: 'Download Failed',
        description: 'Could not export JSON backup file.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Copy MCP / A2A endpoints
  const handleCopyMcp = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    await navigator.clipboard.writeText(`${origin}/api/mcp`);
    setCopiedMcp(true);
    setTimeout(() => setCopiedMcp(false), 2500);
    toast({
      title: 'MCP Endpoint Copied!',
      description: 'Paste into Claude Desktop, Cursor, or your local agent configuration.',
    });
  };

  const handleCopyA2A = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    await navigator.clipboard.writeText(`${origin}/.well-known/agent.json`);
    setCopiedA2A(true);
    setTimeout(() => setCopiedA2A(false), 2500);
    toast({
      title: 'A2A Discovery URL Copied!',
      description: 'Standard Google Agent-to-Agent discovery card endpoint.',
    });
  };

  // Open settings to AI section
  const handleOpenAiSettings = () => {
    setIsOpen(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(OPEN_SETTINGS_EVENT, {
          detail: { section: 'ai' },
        })
      );
    }
  };

  // Calculate garden inventory and stage metrics
  const stageMetrics = useMemo(() => {
    let wishlist = 0;
    let planting = 0;
    let growing = 0;
    let harvest = 0;
    let totalOnHand = 0;
    let totalPlanned = 0;
    let totalSurplus = 0;
    let highViability = 0;
    let medViability = 0;
    let lowViability = 0;
    let unassessedViability = 0;

    for (const p of plantings) {
      const currentStage = p.history?.[p.history.length - 1]?.status;
      if (currentStage === 'Wishlist') wishlist++;
      else if (currentStage === 'Planting') planting++;
      else if (currentStage === 'Growing') growing++;
      else if (currentStage === 'Harvest') harvest++;

      const onHand = p.seedsOnHand ?? 0;
      const planned = p.plannedQty ?? 0;
      totalOnHand += onHand;
      totalPlanned += planned;
      totalSurplus += Math.max(0, onHand - planned);

      if (p.viability === 'High') highViability++;
      else if (p.viability === 'Medium') medViability++;
      else if (p.viability === 'Low') lowViability++;
      else unassessedViability++;
    }

    return {
      wishlist,
      planting,
      growing,
      harvest,
      totalOnHand,
      totalPlanned,
      totalSurplus,
      highViability,
      medViability,
      lowViability,
      unassessedViability,
    };
  }, [plantings]);

  // Calculate AI operation statistics
  const aiStats = useMemo(() => {
    if (!aiLogs || aiLogs.length === 0) {
      return {
        total: 0,
        success: 0,
        errors: 0,
        successRate: 100,
        ratings: { spotOn: 0, ok: 0, bad: 0, wayOff: 0 },
        satisfactionRate: 100,
        modelsUsed: {} as Record<string, number>,
      };
    }

    let success = 0;
    let errors = 0;
    const ratings = { spotOn: 0, ok: 0, bad: 0, wayOff: 0 };
    const modelsUsed: Record<string, number> = {};

    for (const log of aiLogs) {
      if (log.status === 'error' || log.error) {
        errors++;
      } else {
        success++;
      }

      if (log.feedback === 'spot-on') ratings.spotOn++;
      else if (log.feedback === 'ok') ratings.ok++;
      else if (log.feedback === 'bad') ratings.bad++;
      else if (log.feedback === 'way-off') ratings.wayOff++;

      const modelKey = log.model || (log.viabilityType === 'local' ? 'Local Deterministic' : 'Gemini / Cloud Cascade');
      modelsUsed[modelKey] = (modelsUsed[modelKey] || 0) + 1;
    }

    const totalRatings = ratings.spotOn + ratings.ok + ratings.bad + ratings.wayOff;
    const satisfactionRate =
      totalRatings > 0
        ? Math.round(((ratings.spotOn + ratings.ok) / totalRatings) * 100)
        : 100;

    const total = aiLogs.length;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 100;

    return {
      total,
      success,
      errors,
      successRate,
      ratings,
      satisfactionRate,
      modelsUsed,
    };
  }, [aiLogs]);

  // Storage percentages
  const storagePercent = useMemo(() => {
    if (!storageEstimate.usage || !storageEstimate.quota || storageEstimate.quota <= 0) {
      return 0.1;
    }
    return Math.min(100, Math.max(0.01, (storageEstimate.usage / storageEstimate.quota) * 100));
  }, [storageEstimate]);

  const identity = useMemo(() => getOrCreateGrowerIdentity(), []);
  const p2pRoomId = useMemo(() => getSavedP2PRoomId(), []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs font-medium"
          title="Garden usage metrics, local storage health, and project sustainability"
        >
          <Activity className="h-4 w-4 text-primary animate-pulse" />
          <span>Stats &amp; Info</span>
          <Badge variant="secondary" className="hidden sm:inline-flex px-1.5 py-0 text-[10px]">
            100% Free
          </Badge>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-headline text-lg sm:text-xl flex items-center gap-2">
                  Usage Stats &amp; Sustainability Hub
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Live garden inventory, storage resilience, zero-cost architecture, and what keeps Grow thriving.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="hidden sm:flex text-[11px] font-mono border-primary/40 text-primary">
              v{APP_VERSION}
            </Badge>
          </div>
        </DialogHeader>

        {/* Tabbed Content Area */}
        <Tabs defaultValue="sustainability" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-3 border-b bg-background">
            <TabsList className="grid grid-cols-3 w-full sm:w-auto sm:inline-flex h-9">
              <TabsTrigger value="sustainability" className="text-xs gap-1.5 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>Keeping It Going</span>
              </TabsTrigger>
              <TabsTrigger value="stats" className="text-xs gap-1.5 font-medium">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                <span>Usage &amp; Storage</span>
              </TabsTrigger>
              <TabsTrigger value="system" className="text-xs gap-1.5 font-medium">
                <Cpu className="h-3.5 w-3.5 text-primary" />
                <span>System &amp; MCP</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 p-6 overflow-y-auto">
            {/* ========================================================================= */}
            {/* TAB 1: KEEPING IT GOING (SUSTAINABILITY & DATA RESILIENCE)               */}
            {/* ========================================================================= */}
            <TabsContent value="sustainability" className="m-0 space-y-6">
              {/* Core Philosophy Banner */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 relative overflow-hidden">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary text-primary-foreground rounded-lg shrink-0 mt-0.5">
                    <HeartHandshake className="h-5 w-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-headline text-base font-semibold text-foreground">
                      What It Takes to Keep Grow Going
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Grow is built under a strict <strong>Zero-Server-Cost &amp; Local-First architecture</strong>.
                      There are no subscription fees, no venture-capital pressure, and no cloud database bills.
                      Because the app runs on client-side IndexedDB and Vercel&apos;s Free Hobby tier, <strong>Grow will never be shut down due to server costs</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actionable Health & Resilience Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-headline text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>Garden Data Resilience Checklist</span>
                  </h4>
                  <Badge variant="outline" className="text-[11px] font-mono">
                    {isPersisted ? 'Storage Protected' : 'Action Recommended'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Storage Persistence */}
                  <Card className="border">
                    <CardHeader className="p-3.5 pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-semibold flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-primary" />
                          <span>Browser Storage Persistence</span>
                        </CardTitle>
                        {isPersisted === true ? (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                            Persisted
                          </Badge>
                        ) : isPersisted === false ? (
                          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
                            Ephemeral
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Checking...</Badge>
                        )}
                      </div>
                      <CardDescription className="text-[11px] leading-relaxed pt-1">
                        When granted, your browser promises never to evict IndexedDB garden data during disk cleanup.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-0">
                      {isPersisted ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Protected against automated eviction.</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-8 gap-1.5"
                          onClick={handleRequestPersistence}
                          disabled={isRequestingPersist || !hasStorageApi}
                        >
                          <Lock className="h-3.5 w-3.5" />
                          <span>{isRequestingPersist ? 'Requesting...' : 'Request Storage Persistence'}</span>
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Seed Pack Backups */}
                  <Card className="border">
                    <CardHeader className="p-3.5 pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-semibold flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          <span>Zero-Lock-in Seed Pack Portability</span>
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px]">
                          1-Click Export
                        </Badge>
                      </div>
                      <CardDescription className="text-[11px] leading-relaxed pt-1">
                        Export your full garden anytime. Seed packs use non-destructive merging so your plants are always safe.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-0 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs h-8 gap-1"
                        onClick={handleCopyBackupUrl}
                        disabled={isExporting}
                      >
                        {copiedBackup ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedBackup ? 'Copied!' : 'Copy Pack Link'}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-xs h-8 gap-1"
                        onClick={handleDownloadJsonBackup}
                        disabled={isExporting}
                        title="Download JSON backup file"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>JSON</span>
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Free-LLM Cascade Quotas */}
                  <Card className="border">
                    <CardHeader className="p-3.5 pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-semibold flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span>Free AI Quotas &amp; Fallbacks</span>
                        </CardTitle>
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                          $0.00 / month
                        </Badge>
                      </div>
                      <CardDescription className="text-[11px] leading-relaxed pt-1">
                        Runs on Gemini Free Tier (15 RPM), Groq Free Tier, OpenRouter :free, or 100% offline Local Ollama / Built-in AI.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-8 gap-1.5"
                        onClick={handleOpenAiSettings}
                      >
                        <Sliders className="h-3.5 w-3.5" />
                        <span>Configure Keys &amp; Local Models</span>
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Deterministic Offline Rules */}
                  <Card className="border">
                    <CardHeader className="p-3.5 pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-semibold flex items-center gap-2">
                          <Sprout className="h-4 w-4 text-primary" />
                          <span>Offline Viability Engine</span>
                        </CardTitle>
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px]">
                          100% Offline
                        </Badge>
                      </div>
                      <CardDescription className="text-[11px] leading-relaxed pt-1">
                        Even with zero internet or no AI keys, Grow&apos;s deterministic botanical matrix evaluates viability locally in microseconds.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3.5 pt-0">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        <span>Always functional without external servers</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* What It Takes From The Community (How You Keep Grow Going) */}
              <div className="space-y-3 pt-2">
                <h4 className="font-headline text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <HeartHandshake className="h-4 w-4 text-primary" />
                  <span>How You Keep Grow Thriving (5 Community Pillars)</span>
                </h4>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-lg border bg-card space-y-1">
                    <div className="font-semibold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">1</span>
                        Contribute Regional Plant Datasets
                      </span>
                      <a
                        href={buildGitHubContributeDatasetUrl(
                          { locations: [], plants: plants.slice(0, 10), plantings: [] },
                          'My Region'
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 gap-1 text-primary">
                          <span>Submit via PR</span>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    </div>
                    <p className="text-muted-foreground pl-6">
                      Add native cultivars, heritage seeds, and microclimate guidelines for your zone in <code className="bg-muted px-1 py-0.5 rounded">src/lib/datasets/</code>.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border bg-card space-y-1">
                    <div className="font-semibold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">2</span>
                        Build Modular Crowd Extensions
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px] px-2 gap-1 text-primary"
                        onClick={openSettingsToExtensions}
                      >
                        <span>Manage Extensions</span>
                        <Sliders className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-muted-foreground pl-6">
                      Drop new widgets, companion rules, or moon planting calculators into <code className="bg-muted px-1 py-0.5 rounded">src/extensions/</code> with zero git merge conflicts.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border bg-card space-y-1">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">3</span>
                      Broadcast Viability &amp; Harvest Signals
                    </div>
                    <p className="text-muted-foreground pl-6">
                      Rate AI suggestions as &ldquo;spot-on&rdquo; or &ldquo;way-off&rdquo; in the AI Reasoning Log. Your feedback calibrates crowd viability observations over P2P relays.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border bg-card space-y-1">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">4</span>
                      Share Surplus Seeds Locally
                    </div>
                    <p className="text-muted-foreground pl-6">
                      Digital tools support living soil. Use the <strong>Seed Swap</strong> extension to trade surplus seeds with neighbours and preserve genetic diversity.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border bg-card space-y-1">
                    <div className="font-semibold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">5</span>
                        Star &amp; Open Source Stewardship
                      </span>
                      <div className="flex gap-1">
                        <a href={REPO_URL} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 gap-1">
                            <span>GitHub</span>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </a>
                        <a href={FEEDBACK_URL} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 gap-1">
                            <span>Feedback</span>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </a>
                      </div>
                    </div>
                    <p className="text-muted-foreground pl-6">
                      Open source thrives on developer stewardship. Star the repo, file bug reports, and invite community gardens to build with us.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ========================================================================= */}
            {/* TAB 2: USAGE & STORAGE METRICS                                           */}
            {/* ========================================================================= */}
            <TabsContent value="stats" className="m-0 space-y-6">
              {/* Top 4 Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3.5 bg-card">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                    <span>Species Library</span>
                    <Sprout className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="text-2xl font-bold font-headline mt-1">
                    {dbCounts?.plantCount ?? plants.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Unique cultivars
                  </div>
                </Card>

                <Card className="p-3.5 bg-card">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                    <span>Active Plantings</span>
                    <Layers className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="text-2xl font-bold font-headline mt-1">
                    {dbCounts?.plantingCount ?? plantings.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Across {dbCounts?.locationCount ?? 1} garden bed{(dbCounts?.locationCount ?? 1) === 1 ? '' : 's'}
                  </div>
                </Card>

                <Card className="p-3.5 bg-card">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                    <span>Seed Inventory</span>
                    <Package className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="text-2xl font-bold font-headline mt-1">
                    {stageMetrics.totalOnHand}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    +{stageMetrics.totalSurplus} surplus for swap
                  </div>
                </Card>

                <Card className="p-3.5 bg-card">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                    <span>AI &amp; Viability Logs</span>
                    <Activity className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="text-2xl font-bold font-headline mt-1">
                    {dbCounts?.aiLogCount ?? aiStats.total}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Est. Cost: <strong className="text-emerald-600 dark:text-emerald-400">$0.00</strong>
                  </div>
                </Card>
              </div>

              {/* Lifecycle Stage Breakdown */}
              <Card>
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span>Planting Lifecycle Distribution</span>
                    <Badge variant="outline" className="text-xs font-mono">
                      {plantings.length} Total
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Current stage distribution across your active garden.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-lg border bg-muted/30">
                      <div className="font-semibold text-muted-foreground">Wishlist</div>
                      <div className="text-xl font-bold mt-1 text-foreground">{stageMetrics.wishlist}</div>
                      <div className="text-[10px] text-muted-foreground">Planning phase</div>
                    </div>
                    <div className="p-2.5 rounded-lg border bg-amber-500/5 border-amber-500/20">
                      <div className="font-semibold text-amber-600 dark:text-amber-400">Planting / Sown</div>
                      <div className="text-xl font-bold mt-1 text-foreground">{stageMetrics.planting}</div>
                      <div className="text-[10px] text-muted-foreground">Germinating</div>
                    </div>
                    <div className="p-2.5 rounded-lg border bg-blue-500/5 border-blue-500/20">
                      <div className="font-semibold text-blue-600 dark:text-blue-400">Growing</div>
                      <div className="text-xl font-bold mt-1 text-foreground">{stageMetrics.growing}</div>
                      <div className="text-[10px] text-muted-foreground">Vegetative</div>
                    </div>
                    <div className="p-2.5 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400">Harvest</div>
                      <div className="text-xl font-bold mt-1 text-foreground">{stageMetrics.harvest}</div>
                      <div className="text-[10px] text-muted-foreground">Harvest ready</div>
                    </div>
                  </div>

                  {/* Viability Summary Pill */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-md bg-muted/40 text-xs">
                    <span className="font-medium text-muted-foreground">Viability Health:</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{stageMetrics.highViability} High</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">{stageMetrics.medViability} Med</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-600 dark:text-red-400 font-semibold">{stageMetrics.lowViability} Low</span>
                      {stageMetrics.unassessedViability > 0 && (
                        <>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-muted-foreground">{stageMetrics.unassessedViability} Unassessed</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Local Storage Meter */}
              <Card>
                <CardHeader className="p-4 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-primary" />
                      <span>IndexedDB Local Storage Meter</span>
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                      onClick={refreshStorageInfo}
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Refresh</span>
                    </Button>
                  </div>
                  <CardDescription className="text-xs">
                    Physical browser storage consumed by <code className="bg-muted px-1 py-0.5 rounded font-mono">growDB</code>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span>Used: {formatBytes(storageEstimate.usage)}</span>
                      <span className="text-muted-foreground">
                        Quota: {formatBytes(storageEstimate.quota)} ({storagePercent.toFixed(3)}%)
                      </span>
                    </div>
                    <Progress value={Math.max(1, storagePercent)} className="h-2" />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    IndexedDB storage is local-first and private to your device. No user data leaves your browser unless you explicitly copy a seed pack or broadcast a P2P signal.
                  </p>
                </CardContent>
              </Card>

              {/* AI Operations Breakdown */}
              {aiStats.total > 0 && (
                <Card>
                  <CardHeader className="p-4 pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>AI Inference Analytics</span>
                      </span>
                      <Badge variant="outline" className="text-xs font-mono">
                        {aiStats.successRate}% Success
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Breakdown of reasoning flows executed through the Free-LLM router.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 border rounded-md">
                        <div className="text-muted-foreground font-mono">Successes</div>
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {aiStats.success}
                        </div>
                      </div>
                      <div className="p-2 border rounded-md">
                        <div className="text-muted-foreground font-mono">Errors / 429s</div>
                        <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                          {aiStats.errors}
                        </div>
                      </div>
                      <div className="p-2 border rounded-md">
                        <div className="text-muted-foreground font-mono">Satisfaction</div>
                        <div className="text-lg font-bold text-primary mt-0.5">
                          {aiStats.satisfactionRate}%
                        </div>
                      </div>
                    </div>

                    {Object.keys(aiStats.modelsUsed).length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Models &amp; Engines Invoked
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(aiStats.modelsUsed).map(([model, count]) => (
                            <Badge key={model} variant="secondary" className="text-[11px] font-mono gap-1">
                              <span>{model}</span>
                              <span className="text-muted-foreground font-normal">({count})</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ========================================================================= */}
            {/* TAB 3: SYSTEM, MCP & PROTOCOL HEALTH                                     */}
            {/* ========================================================================= */}
            <TabsContent value="system" className="m-0 space-y-6">
              {/* Agent Protocol Endpoints */}
              <div className="space-y-3">
                <h4 className="font-headline text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Terminal className="h-4 w-4 text-primary" />
                  <span>Autonomous Agent Endpoints (MCP &amp; Google A2A)</span>
                </h4>

                <div className="space-y-2">
                  {/* MCP HTTP Endpoint */}
                  <div className="p-3 rounded-lg border bg-card flex items-center justify-between gap-3">
                    <div className="truncate space-y-0.5">
                      <div className="font-mono text-xs font-semibold flex items-center gap-2">
                        <span>POST /api/mcp</span>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          JSON-RPC 2.0
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Streamable Model Context Protocol server. Connects Claude Desktop, Cursor, or local agents.
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={handleCopyMcp}>
                      {copiedMcp ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      <span className="text-xs">{copiedMcp ? 'Copied' : 'Copy URL'}</span>
                    </Button>
                  </div>

                  {/* A2A Discovery Card */}
                  <div className="p-3 rounded-lg border bg-card flex items-center justify-between gap-3">
                    <div className="truncate space-y-0.5">
                      <div className="font-mono text-xs font-semibold flex items-center gap-2">
                        <span>GET /.well-known/agent.json</span>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          A2A Protocol
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Google Agent-to-Agent discovery card exposing garden skills and plant viability tools.
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={handleCopyA2A}>
                      {copiedA2A ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      <span className="text-xs">{copiedA2A ? 'Copied' : 'Copy URL'}</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Browser Platform Capabilities */}
              <div className="space-y-3">
                <h4 className="font-headline text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-primary" />
                  <span>Web Platform Features &amp; Fallbacks</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-md border flex items-center justify-between">
                    <div>
                      <div className="font-semibold">Chrome Built-in AI</div>
                      <div className="text-[11px] text-muted-foreground">LanguageModel Prompt API</div>
                    </div>
                    {hasChromeAi ? (
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                        Available
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Cascading to Cloud
                      </Badge>
                    )}
                  </div>

                  <div className="p-3 rounded-md border flex items-center justify-between">
                    <div>
                      <div className="font-semibold">WebMCP In-Browser Bridge</div>
                      <div className="text-[11px] text-muted-foreground">navigator.modelContextProtocol</div>
                    </div>
                    {hasWebMcp ? (
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        HTTP Fallback
                      </Badge>
                    )}
                  </div>

                  <div className="p-3 rounded-md border flex items-center justify-between">
                    <div>
                      <div className="font-semibold">Storage Persistence API</div>
                      <div className="text-[11px] text-muted-foreground">navigator.storage.persist</div>
                    </div>
                    {hasStorageApi ? (
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                        Supported
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Unsupported
                      </Badge>
                    )}
                  </div>

                  <div className="p-3 rounded-md border flex items-center justify-between">
                    <div>
                      <div className="font-semibold">P2P Decentralized Sync</div>
                      <div className="text-[11px] text-muted-foreground">Nostr / ntfy Room Relays</div>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                      {p2pRoomId ? `Room: ${p2pRoomId.slice(0, 8)}...` : 'Ready'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Local Grower Identity */}
              <div className="p-3.5 rounded-lg border bg-muted/20 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-primary" />
                    <span>Local Grower Cryptographic Identity</span>
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">{identity.displayName}</span>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground break-all bg-muted p-2 rounded">
                  {identity.pubkey}
                </div>
                <p className="text-[11px] text-muted-foreground pt-0.5">
                  Used for zero-server P2P key synchronization and viability crowd signals. Private keys never leave your device.
                </p>
              </div>

              {/* Upstream & Community Links */}
              <div className="border-t pt-4 flex flex-wrap gap-2 justify-between items-center text-xs">
                <span className="text-muted-foreground">
                  Grow {APP_VERSION} • Open Source under MIT
                </span>
                <div className="flex gap-2">
                  <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    <span>GitHub</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className="text-muted-foreground">•</span>
                  <a href={ISSUES_URL} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    <span>Issues</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className="text-muted-foreground">•</span>
                  <a href={DISCUSSIONS_URL} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    <span>Discussions</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export const usageStatsInfoExtension: GrowExtension = {
  id: 'usage-stats-info',
  name: 'Usage Stats & Info',
  description:
    'Live garden metrics, storage persistence, and clear insights on what keeps Grow running forever.',
  version: '1.0.0',
  slots: ['dashboard-toolbar'],
  contributor: {
    name: 'Grow Core & Community',
    githubOrNostr: 'creat-o-r',
    url: 'https://github.com/creat-o-r/grow',
  },
  DashboardWidget: UsageStatsInfoWidget,
};
