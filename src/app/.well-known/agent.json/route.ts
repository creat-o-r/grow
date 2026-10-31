import { NextRequest, NextResponse } from 'next/server';
import { availableDatasets, loadDataset } from '@/lib/datasets';
import { registeredExtensions } from '@/extensions/registry';
import {
  formatGardenAsGrowMarkdown,
  GROW_AI_SYSTEM_INSTRUCTIONS,
  GROW_DATA_HANDLING_RULES,
  GROW_UI_SCHEMA,
} from '@/lib/ai-presentation';
import {
  decodeSeedPackFromInput,
  encodeSeedPackToParam,
} from '@/lib/seed-pack';
import { analyzeViability, getSuitableSeasons } from '@/lib/viability';
import type { AiDataset, Conditions } from '@/lib/types';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Google Agent2Agent (A2A) Discovery Endpoint (`/.well-known/agent.json`).
 * Every user who clones `Grow` via the 1-Click Free Vercel Deploy button automatically
 * hosts an A2A-compliant Garden Node that other agents and instances can discover and query.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  const agentCard = {
    name: 'Grow Botanical & Microclimate Node',
    description:
      'Local-first P2P botanical viability agent and forkable microclimate dataset node. Supports MCP Streamable HTTP and A2A microclimate comparison.',
    url: `${origin}/.well-known/agent.json`,
    version: '1.1.0',
    protocolVersion: '0.2.0',
    provider: {
      organization: 'Grow P2P Crowd Collective',
      url: 'https://github.com/creat-o-r/grow',
    },
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    endpoints: {
      a2a: `${origin}/.well-known/agent.json`,
      mcp: `${origin}/api/mcp`,
      forkClone: `https://vercel.com/new/clone?repository-url=${encodeURIComponent('https://github.com/creat-o-r/grow')}`,
    },
    defaultInputModes: ['application/json', 'text/plain'],
    defaultOutputModes: ['application/json', 'text/plain'],
    instructions: GROW_AI_SYSTEM_INSTRUCTIONS,
    uiSchema: GROW_UI_SCHEMA,
    dataHandlingRules: GROW_DATA_HANDLING_RULES,
    skills: [
      {
        id: 'assess-plant-viability',
        name: 'Microclimate Plant Viability Assessment',
        description:
          'Evaluates plant germination and growing viability against soil, sunlight, temperature, and seasonal conditions.',
        tags: ['horticulture', 'permaculture', 'viability', 'microclimate'],
        examples: [
          'Check if Owairaka Red Kūmara is viable in 19°C volcanic loam during Spring.',
        ],
      },
      {
        id: 'get-my-browser-garden',
        name: 'Live Browser IndexedDB Garden Inspection',
        description:
          'Decodes a ?pack= browser IndexedDB snapshot and returns formatted Grow plant cards with live viability scores.',
        tags: ['indexeddb', 'garden-state', 'viability', 'dashboard'],
      },
      {
        id: 'push-ai-seed-pack-to-garden',
        name: 'Direct AI Seed Pack Push to Browser IndexedDB',
        description:
          'Pushes AI-recommended cultivars (with 0/0 default seed inventory and non-destructive "add" import mode) directly into the user browser IndexedDB.',
        tags: ['import', 'seed-pack', 'indexeddb', 'automation'],
      },
      {
        id: 'fork-regional-seed-pack',
        name: 'Regional Seed Pack Discovery & Forking',
        description: `Exposes ${availableDatasets.length} curated starter datasets (${availableDatasets.map((d) => d.key).join(', ')}) and ${registeredExtensions.length} crowd extensions.`,
        tags: ['datasets', 'seed-swap', 'p2p', 'open-data'],
      },
    ],
  };

  return NextResponse.json(agentCard, {
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

function buildDatasetArtifact(dataset: AiDataset, origin: string) {
  const plantMap = new Map(dataset.plants.map((p) => [p.id, p]));
  const locationMap = new Map(dataset.locations.map((l) => [l.id, l]));
  const defaultLoc = dataset.locations[0];

  const plantings = dataset.plantings.map((planting) => {
    const plant = plantMap.get(planting.plantId);
    const loc = (planting.gardenId && locationMap.get(planting.gardenId)) || defaultLoc;
    const conditions: Conditions = loc?.conditions || {
      temperature: '18°C',
      sunlight: 'Full sun',
      soil: 'Loam',
      currentSeason: 'Spring',
    };
    const viability = plant ? analyzeViability(plant, conditions) : 'Medium';
    const suitableSeasons = plant ? getSuitableSeasons(plant) : [];
    const status = planting.history?.[planting.history.length - 1]?.status || 'Wishlist';
    return {
      plantingId: planting.id,
      name: planting.name,
      species: plant?.species || planting.name,
      gardenName: loc?.name || 'Active Garden',
      status,
      seedsOnHand: planting.seedsOnHand ?? 0,
      plannedQty: planting.plannedQty ?? 0,
      viability,
      suitableSeasons,
      optimalConditions: plant?.optimalConditions || '',
      germinationNeeds: plant?.germinationNeeds || '',
    };
  });

  const encoded = encodeSeedPackToParam(dataset);
  const openInGrowUrl = `${origin}/?pack=${encoded}`;
  const directAutoImportUrl = `${origin}/?aiPushPack=${encoded}&mode=add`;
  const formattedDisplayMarkdown = formatGardenAsGrowMarkdown({
    gardens: dataset.locations,
    plantings,
    openInGrowUrl,
  });

  return {
    formattedDisplayMarkdown,
    dataPayload: {
      uiSchema: GROW_UI_SCHEMA,
      dataHandlingRules: GROW_DATA_HANDLING_RULES,
      gardens: dataset.locations,
      plantings,
      openInGrowUrl,
      directAutoImportUrl,
    },
  };
}

/**
 * Google A2A JSON-RPC 2.0 Task Execution Handler (`message/send`, `tasks/send`).
 * Returns structured A2A Artifacts containing both a `TextPart` (Grow UI Card Markdown)
 * and a `DataPart` (`uiSchema`, `dataHandlingRules`, and 0-seed normalized plantings).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, method, params } = body || {};
    const origin = req.nextUrl.origin;
    const packParam = req.nextUrl.searchParams.get('pack');

    if (method === 'message/send' || method === 'tasks/send') {
      const taskId = params?.id || `a2a-task-${Date.now()}`;
      const datasetKey = params?.datasetKey || 'new-zealand';
      const dataset = packParam
        ? decodeSeedPackFromInput(packParam)
        : await loadDataset(datasetKey);

      const { formattedDisplayMarkdown, dataPayload } = buildDatasetArtifact(dataset, origin);

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            id: taskId,
            status: {
              state: 'completed',
              timestamp: new Date().toISOString(),
            },
            artifacts: [
              {
                name: 'grow-botanical-dashboard-artifact',
                description:
                  'Structured Grow dashboard cards (TextPart) and machine-readable botanical dataset (DataPart).',
                parts: [
                  {
                    type: 'text',
                    text: formattedDisplayMarkdown,
                  },
                  {
                    type: 'data',
                    data: dataPayload,
                  },
                ],
              },
            ],
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32601, message: `Unsupported A2A method: ${method}` },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: err?.message || 'Internal A2A error' },
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
