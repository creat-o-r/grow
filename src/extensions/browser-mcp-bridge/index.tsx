'use client';

import React, { useEffect, useState } from 'react';
import { useWebMCP } from 'use-webmcp-tool';
import type { GrowExtension, ExtensionContext } from '../registry';
import { db } from '@/lib/db';
import {
  decodeSeedPackFromInput,
  encodeSeedPackToParam,
  mergeSeedPackIntoDb,
  toSpeciesUid,
} from '@/lib/seed-pack';
import { analyzeViability, getSuitableSeasons } from '@/lib/viability';
import {
  formatGardenAsGrowMarkdown,
  GROW_AI_SYSTEM_INSTRUCTIONS,
} from '@/lib/ai-presentation';
import type { AiDataset, Conditions } from '@/lib/types';
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
import { Check, Copy, Cpu, Database, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const GET_GARDEN_SCHEMA = {
  type: 'object',
  properties: {
    activeGardenOnly: {
      type: 'boolean',
      default: false,
      description: 'Whether to filter plantings to only the currently selected garden.',
    },
  },
} as const;

const ADD_PLANT_SCHEMA = {
  type: 'object',
  properties: {
    species: {
      type: 'string',
      description: 'Common and scientific name of the plant cultivar.',
    },
    germinationNeeds: {
      type: 'string',
      description: 'Sowing depth, moisture, and temperature needed for germination.',
    },
    optimalConditions: {
      type: 'string',
      description: 'Ideal sunlight, soil, temperature range, and season for growing.',
    },
    seedsOnHand: {
      type: 'number',
      default: 0,
      minimum: 0,
      description: 'Quantity of seeds currently in inventory.',
    },
    plannedQty: {
      type: 'number',
      default: 0,
      minimum: 0,
      description: 'Quantity of plants planned for the active garden.',
    },
  },
  required: ['species', 'germinationNeeds', 'optimalConditions'],
} as const;

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
} as const;

const WRITE_PLANT_ANNOTATIONS = {
  readOnlyHint: false,
  consequentialHint: false,
} as const;

async function readLiveIndexedDbGarden(
  activeGardenId?: string,
  activeGardenOnly: boolean = false,
  signal?: AbortSignal
) {
  signal?.throwIfAborted?.();
  const [locations, plants, plantings] = await Promise.all([
    db.locations.toArray(),
    db.plants.toArray(),
    db.plantings.toArray(),
  ]);
  signal?.throwIfAborted?.();

  const plantMap = new Map(plants.map((p) => [p.id, p]));
  const locationMap = new Map(locations.map((l) => [l.id, l]));
  const activeLocation =
    (activeGardenId && locationMap.get(activeGardenId)) || locations[0];

  const filteredPlantings =
    activeGardenOnly && activeLocation
      ? plantings.filter((p) => p.gardenId === activeLocation.id)
      : plantings;

  const enrichedPlantings = filteredPlantings.map((planting) => {
    const plant = plantMap.get(planting.plantId);
    const loc =
      (planting.gardenId && locationMap.get(planting.gardenId)) || activeLocation;
    const conditions: Conditions = loc?.conditions || {
      temperature: '18°C',
      sunlight: 'Full sun',
      soil: 'Loam',
      currentSeason: 'Spring',
    };
    const viability = plant ? analyzeViability(plant, conditions) : 'Medium';
    const suitableSeasons = plant ? getSuitableSeasons(plant) : [];
    const latestStatus =
      planting.history?.[planting.history.length - 1]?.status || 'Wishlist';

    return {
      plantingId: planting.id,
      name: planting.name,
      species: plant?.species || planting.name,
      gardenId: planting.gardenId,
      gardenName: loc?.name || 'Default Garden',
      status: latestStatus,
      seedsOnHand: planting.seedsOnHand ?? 0,
      plannedQty: planting.plannedQty ?? 0,
      viability,
      suitableSeasons,
      optimalConditions: plant?.optimalConditions || '',
      germinationNeeds: plant?.germinationNeeds || '',
    };
  });

  return {
    source: 'browser-indexeddb-live',
    uiDisplayInstructions: GROW_AI_SYSTEM_INSTRUCTIONS,
    formattedDisplayMarkdown: formatGardenAsGrowMarkdown({
      gardens: activeLocation ? [activeLocation] : locations,
      plantings: enrichedPlantings,
    }),
    activeGarden: activeLocation || null,
    gardenCount: locations.length,
    plantCount: plants.length,
    plantingCount: enrichedPlantings.length,
    gardens: locations,
    plantings: enrichedPlantings,
  };
}

function BrowserMcpBridgeWidget({ plantings, activeLocation }: ExtensionContext) {
  const { toast } = useToast();
  const [copiedLiveMcpUrl, setCopiedLiveMcpUrl] = useState(false);
  const [copiedAiPrompt, setCopiedAiPrompt] = useState(false);
  const [previewOutput, setPreviewOutput] = useState<string | null>(null);

  // 1. Register client-side WebMCP read tool using official `use-webmcp-tool` hook
  const getGardenToolState = useWebMCP<{ activeGardenOnly?: boolean }, unknown>({
    name: 'get_live_garden_indexeddb',
    description:
      "Reads the user's live gardens, microclimate conditions, plants, and plantings from browser IndexedDB. Use when the user asks about their current garden, seed inventory, or plant viability.",
    inputSchema: GET_GARDEN_SCHEMA,
    annotations: READ_ONLY_ANNOTATIONS,
    execute: async (input, { signal }) => {
      const activeOnly =
        typeof input?.activeGardenOnly === 'boolean' ? input.activeGardenOnly : false;
      try {
        return await readLiveIndexedDbGarden(activeLocation?.id, activeOnly, signal);
      } catch (err) {
        if (signal?.aborted) {
          throw err;
        }
        return {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  // 2. Register client-side WebMCP write/merge tool using official `use-webmcp-tool` hook
  const addPlantToolState = useWebMCP<
    {
      species?: string;
      germinationNeeds?: string;
      optimalConditions?: string;
      seedsOnHand?: number;
      plannedQty?: number;
    },
    unknown
  >({
    name: 'add_plant_to_live_garden',
    description:
      "Adds or merges a plant species into the user's active garden in browser IndexedDB. Use when the user wants to add a new cultivar or seed to their garden.",
    inputSchema: ADD_PLANT_SCHEMA,
    annotations: WRITE_PLANT_ANNOTATIONS,
    execute: async (input, { signal }) => {
      const species = typeof input?.species === 'string' ? input.species.trim() : '';
      const germinationNeeds =
        typeof input?.germinationNeeds === 'string'
          ? input.germinationNeeds.trim()
          : '';
      const optimalConditions =
        typeof input?.optimalConditions === 'string'
          ? input.optimalConditions.trim()
          : '';
      const seedsOnHand =
        typeof input?.seedsOnHand === 'number' && input.seedsOnHand >= 0
          ? input.seedsOnHand
          : 0;
      const plannedQty =
        typeof input?.plannedQty === 'number' && input.plannedQty >= 0
          ? input.plannedQty
          : 0;

      if (!species || !germinationNeeds || !optimalConditions) {
        return {
          error:
            'Provide non-empty species, germinationNeeds, and optimalConditions to add a plant.',
        };
      }

      try {
        signal?.throwIfAborted?.();
        const now = Date.now();
        const tempPlantId = `webmcp-plant-${now}`;
        const pack: AiDataset = {
          locations: activeLocation ? [activeLocation] : [],
          plants: [
            {
              id: tempPlantId,
              uid: toSpeciesUid(species),
              species,
              germinationNeeds,
              optimalConditions,
            },
          ],
          plantings: [
            {
              id: `webmcp-planting-${now}`,
              plantId: tempPlantId,
              gardenId: activeLocation?.id || '',
              name: species,
              createdAt: new Date().toISOString(),
              seedsOnHand,
              plannedQty,
              history: [
                {
                  id: `webmcp-hist-${now}`,
                  status: 'Wishlist',
                  date: new Date().toISOString(),
                  notes: 'Added via Browser WebMCP tool into live IndexedDB.',
                },
              ],
            },
          ],
        };

        const mergeResult = await mergeSeedPackIntoDb(pack, {
          mode: 'add',
          targetGardenId: activeLocation?.id,
          author: 'Browser WebMCP Agent',
        });
        signal?.throwIfAborted?.();
        return {
          status: 'added',
          species,
          mergeResult,
        };
      } catch (err) {
        if (signal?.aborted) {
          throw err;
        }
        return {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  // 3. Same-browser BroadcastChannel ('grow-indexeddb-mcp') + Direct AI Push Listener (?aiPushPack= & /api/mcp?pollAiPush=default)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 3a. Handle 1-click direct auto-import URL (?aiPushPack=<encoded>&mode=add|new)
    const params = new URLSearchParams(window.location.search);
    const aiPushPack = params.get('aiPushPack');
    const modeParam = params.get('mode') === 'new' ? 'new' : 'add';
    if (aiPushPack) {
      window.history.replaceState({}, '', window.location.pathname);
      try {
        const dataset = decodeSeedPackFromInput(aiPushPack);
        mergeSeedPackIntoDb(dataset, {
          mode: modeParam,
          targetGardenId: activeLocation?.id,
          author: 'AI Direct Push',
        }).then((res) => {
          toast({
            title: 'AI Direct Import Complete!',
            description: `Added ${res.addedPlantings} planting(s) directly into "${res.targetGardenName}".`,
          });
        });
      } catch (err) {
        console.warn('Could not decode ?aiPushPack= param:', err);
      }
    }

    // 3b. Poll /api/mcp?pollAiPush=default when tab is visible so external AI MCP calls push straight into IndexedDB
    let cancelled = false;
    const pollAiRelay = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/mcp?pollAiPush=default', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const pushes = Array.isArray(data?.queuedPushes) ? data.queuedPushes : [];
        for (const item of pushes) {
          if (!item?.dataset) continue;
          const mergeRes = await mergeSeedPackIntoDb(item.dataset, {
            mode: item.importMode === 'new' ? 'new' : 'add',
            targetGardenId: activeLocation?.id,
            author: 'AI MCP Live Push',
          });
          toast({
            title: 'AI Pushed Plants to Your Garden!',
            description: `Imported ${mergeRes.addedPlantings} planting(s) directly into "${mergeRes.targetGardenName}".`,
          });
        }
      } catch {
        // Ignore transient network errors during background polling
      }
    };

    const interval = setInterval(pollAiRelay, 4000);
    window.addEventListener('focus', pollAiRelay);

    // 3c. Same-browser BroadcastChannel for instant cross-tab / extension read & push
    let channel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel('grow-indexeddb-mcp');
      channel.onmessage = async (event: MessageEvent) => {
        const msg = event.data;
        if (!msg) return;
        if (msg.type === 'mcp-request') {
          try {
            const snapshot = await readLiveIndexedDbGarden(activeLocation?.id, false);
            channel?.postMessage({
              type: 'mcp-response',
              id: msg.id,
              result: snapshot,
            });
          } catch (err) {
            channel?.postMessage({
              type: 'mcp-response',
              id: msg.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else if (msg.type === 'mcp-push-import' && msg.dataset) {
          try {
            const mergeRes = await mergeSeedPackIntoDb(msg.dataset, {
              mode: msg.mode === 'new' ? 'new' : 'add',
              targetGardenId: activeLocation?.id,
              author: 'Same-Browser AI Push',
            });
            channel?.postMessage({
              type: 'mcp-push-response',
              id: msg.id,
              result: mergeRes,
            });
            toast({
              title: 'AI Pushed Plants to Your Garden!',
              description: `Imported ${mergeRes.addedPlantings} planting(s) directly into "${mergeRes.targetGardenName}".`,
            });
          } catch (err) {
            channel?.postMessage({
              type: 'mcp-push-response',
              id: msg.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      };
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', pollAiRelay);
      channel?.close();
    };
  }, [activeLocation?.id, toast]);

  const handleRunLivePreview = async () => {
    const result = await readLiveIndexedDbGarden(activeLocation?.id, true);
    setPreviewOutput(JSON.stringify(result, null, 2));
  };

  const handleCopyLiveIndexedDbMcpUrl = async () => {
    const [locations, plants, allPlantings] = await Promise.all([
      db.locations.toArray(),
      db.plants.toArray(),
      db.plantings.toArray(),
    ]);
    const encoded = encodeSeedPackToParam({
      locations,
      plants,
      plantings: allPlantings,
    });
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const liveMcpUrl = `${origin}/api/mcp?pack=${encoded}`;
    await navigator.clipboard.writeText(liveMcpUrl);
    setCopiedLiveMcpUrl(true);
    setTimeout(() => setCopiedLiveMcpUrl(false), 2500);
    toast({
      title: 'Live IndexedDB MCP URL Copied!',
      description:
        'This /api/mcp?pack=... endpoint carries your live browser IndexedDB garden so any MCP agent can query your actual plants.',
    });
  };

  const handleCopyAiStructuredPrompt = async () => {
    const result = await readLiveIndexedDbGarden(activeLocation?.id, false);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const promptBundle = [
      GROW_AI_SYSTEM_INSTRUCTIONS,
      '',
      '---',
      '## Current Live Browser IndexedDB Garden',
      result.formattedDisplayMarkdown,
      '',
      `MCP Endpoint for Direct Push: ${origin}/api/mcp`,
    ].join('\n');

    await navigator.clipboard.writeText(promptBundle);
    setCopiedAiPrompt(true);
    setTimeout(() => setCopiedAiPrompt(false), 2500);
    toast({
      title: 'AI UI Spec + Live Garden Copied!',
      description:
        'Paste into Claude, ChatGPT, or Gemini—the AI will match Grow’s look, feel, and 0-seed default data rules.',
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span>Browser MCP</span>
          <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
            {plantings.length}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Live Browser IndexedDB &amp; WebMCP Bridge
          </DialogTitle>
          <DialogDescription>
            Exposes your live <code>IndexedDB (growDB)</code> directly in this browser tab via{' '}
            <code>document.modelContext</code> (WebMCP) and stateless <code>/api/mcp?pack=</code>{' '}
            snapshots.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-primary" />
                In-Tab WebMCP (<code>document.modelContext</code>)
              </span>
              <Badge
                variant={
                  getGardenToolState.registered && addPlantToolState.registered
                    ? 'default'
                    : 'outline'
                }
              >
                {getGardenToolState.registered
                  ? '2 Live Tools Registered'
                  : 'Enable #enable-webmcp-testing'}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Tools registered directly against your browser&apos;s live <code>IndexedDB</code>:{' '}
              <code>get_live_garden_indexeddb</code> and <code>add_plant_to_live_garden</code>.
            </p>
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <div className="font-semibold">
              Bridge Live Browser IndexedDB to External MCP Clients
            </div>
            <p className="text-muted-foreground">
              Because external MCP servers cannot reach inside your browser tab&apos;s{' '}
              <code>IndexedDB</code> directly, click below to copy an{' '}
              <code>/api/mcp?pack=...</code> URL with your live <code>IndexedDB</code> snapshot
              embedded.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleCopyLiveIndexedDbMcpUrl}
                className="gap-1.5 flex-1"
              >
                {copiedLiveMcpUrl ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedLiveMcpUrl
                  ? 'Copied /api/mcp?pack= URL!'
                  : 'Copy Live IndexedDB MCP URL'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleCopyAiStructuredPrompt}
                className="gap-1.5"
              >
                {copiedAiPrompt ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedAiPrompt ? 'Copied AI UI Spec!' : 'Copy AI UI Spec + Garden'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRunLivePreview}
                className="gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                Inspect Live IndexedDB
              </Button>
            </div>
          </div>

          {previewOutput && (
            <pre className="max-h-56 overflow-auto rounded-md bg-muted p-2.5 text-[11px] font-mono">
              {previewOutput}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const browserMcpBridgeExtension: GrowExtension = {
  id: 'browser-mcp-bridge',
  name: 'Live Browser IndexedDB MCP Bridge',
  description:
    'Exposes live browser IndexedDB (growDB) to in-browser WebMCP agents (document.modelContext) and generates live /api/mcp?pack= snapshot endpoints.',
  version: '1.0.0',
  slots: ['dashboard-toolbar'],
  contributor: {
    name: 'Grow Core Community',
    githubOrNostr: 'creat-o-r',
    url: 'https://github.com/creat-o-r/grow',
  },
  DashboardWidget: BrowserMcpBridgeWidget,
};
