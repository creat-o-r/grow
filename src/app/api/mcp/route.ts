import { NextRequest, NextResponse } from 'next/server';
import { availableDatasets, loadDataset } from '@/lib/datasets';
import {
  analyzeViability,
  generateLocalViabilityReasoning,
  getSuitableSeasons,
  getUpcomingViability,
} from '@/lib/viability';
import {
  decodeSeedPackFromInput,
  encodeSeedPackToParam,
  toSpeciesUid,
} from '@/lib/seed-pack';
import {
  formatGardenAsGrowMarkdown,
  formatMicroclimateHeader,
  getViabilityBadge,
  GROW_AI_SYSTEM_INSTRUCTIONS,
  GROW_DATA_HANDLING_RULES,
  GROW_UI_SCHEMA,
} from '@/lib/ai-presentation';
import type { AiDataset, Conditions, Plant } from '@/lib/types';

/**
 * Stateless Streamable HTTP Model Context Protocol (MCP) Server for `Grow`.
 * 100% compatible with Vercel's Free Hobby Tier (no persistent WebSockets or long-lived SSE required).
 */

const MCP_TOOLS = [
  {
    name: 'assess-plant-viability',
    description:
      'Evaluates whether a plant species is High, Medium, or Low viability for a specific garden microclimate (temperature, sunlight, soil, and season) and checks for upcoming seasonal viability improvements.',
    inputSchema: {
      type: 'object',
      properties: {
        species: {
          type: 'string',
          description: 'Scientific or common cultivar name of the plant.',
        },
        germinationNeeds: {
          type: 'string',
          description: 'Temperature, moisture, or sowing requirements for germination.',
        },
        optimalConditions: {
          type: 'string',
          description: 'Ideal sunlight, soil type, and temperature conditions for growth.',
        },
        gardenConditions: {
          type: 'object',
          properties: {
            temperature: { type: 'string', description: 'Garden temperature (e.g. "19°C" or "68°F").' },
            sunlight: { type: 'string', description: 'Available sunlight (e.g. "Full sun", "Partial shade").' },
            soil: { type: 'string', description: 'Soil composition (e.g. "Well-drained volcanic loam").' },
            currentSeason: {
              type: 'string',
              enum: ['Spring', 'Summer', 'Autumn', 'Winter'],
              description: 'Current hemisphere season.',
            },
          },
          required: ['temperature', 'sunlight', 'soil'],
        },
      },
      required: ['species', 'germinationNeeds', 'optimalConditions', 'gardenConditions'],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: 'search-cultivar-datasets',
    description:
      'Searches across all curated regional and thematic plant datasets (New Zealand, Herbs, Vegetables, Fruit, Fungi, Medicinal, All Seasons) for matching cultivars or seasonal recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keyword (species, soil type, season, or dataset key like "new-zealand").',
        },
      },
      required: ['query'],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: 'create-forkable-seed-pack-link',
    description:
      'Generates a 1-click non-destructive `?pack=` URL that a user can open to merge the specified plants and garden microclimate into their local Grow instance.',
    inputSchema: {
      type: 'object',
      properties: {
        datasetKey: {
          type: 'string',
          description: 'Key of an existing starter dataset to package (e.g. "new-zealand", "herbs", "vegetables").',
        },
      },
      required: ['datasetKey'],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: 'get-my-browser-garden',
    description:
      "Reads the user's live browser IndexedDB garden (locations, microclimate conditions, plants, plantings, seed counts, and viability scores) from the `/api/mcp?pack=` URL snapshot or `pack` argument.",
    inputSchema: {
      type: 'object',
      properties: {
        pack: {
          type: 'string',
          description:
            'Optional `?pack=` URL or encoded seed pack exported from the browser IndexedDB if not already passed on the `/api/mcp?pack=` endpoint URL.',
        },
      },
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: 'push-ai-seed-pack-to-garden',
    description:
      "Pushes an AI-generated plant dataset directly into the user's open Grow browser tab (IndexedDB) via live relay and returns a 1-click direct auto-import URL.",
    inputSchema: {
      type: 'object',
      properties: {
        importMode: {
          type: 'string',
          enum: ['add', 'new'],
          default: 'add',
          description:
            'Whether to add plants into the active garden ("add") or create a new garden location ("new").',
        },
        garden: {
          type: 'object',
          description: 'Optional garden microclimate metadata (used when importMode is "new").',
          properties: {
            name: { type: 'string', description: 'Garden name.' },
            location: { type: 'string', description: 'City, region, or country.' },
            temperatureUnit: { type: 'string', enum: ['C', 'F'], default: 'C' },
            conditions: {
              type: 'object',
              properties: {
                temperature: { type: 'string', description: 'Average temperature (e.g. "19°C").' },
                sunlight: { type: 'string', description: 'Sunlight exposure (e.g. "Full sun").' },
                soil: { type: 'string', description: 'Soil type (e.g. "Volcanic loam").' },
                currentSeason: {
                  type: 'string',
                  enum: ['Spring', 'Summer', 'Autumn', 'Winter'],
                },
              },
            },
          },
        },
        plants: {
          type: 'array',
          description: 'List of plants to push directly into the user garden.',
          items: {
            type: 'object',
            properties: {
              species: {
                type: 'string',
                description: 'Common and scientific name of the plant cultivar.',
              },
              germinationNeeds: {
                type: 'string',
                description: 'Sowing depth, moisture, season, and temperature for germination.',
              },
              optimalConditions: {
                type: 'string',
                description: 'Ideal sunlight, soil, temperature, and season for growth.',
              },
              plantingName: {
                type: 'string',
                description: 'Optional friendly label for this planting.',
              },
              status: {
                type: 'string',
                enum: ['Wishlist', 'Planting', 'Growing', 'Harvest'],
                default: 'Wishlist',
              },
              notes: {
                type: 'string',
                description: 'Optional horticultural note for the planting history.',
              },
            },
            required: ['species', 'germinationNeeds', 'optimalConditions'],
          },
        },
        channel: {
          type: 'string',
          default: 'default',
          description: 'Optional relay channel ID matching the user browser tab.',
        },
      },
      required: ['plants'],
    },
    annotations: {
      readOnlyHint: false,
    },
  },
];

interface QueuedAiPush {
  id: string;
  createdAt: string;
  importMode: 'add' | 'new';
  dataset: AiDataset;
}

const globalRelay = globalThis as unknown as {
  __growPendingAiPushes?: Map<string, QueuedAiPush[]>;
};

function getPendingAiPushMap(): Map<string, QueuedAiPush[]> {
  if (!globalRelay.__growPendingAiPushes) {
    globalRelay.__growPendingAiPushes = new Map<string, QueuedAiPush[]>();
  }
  return globalRelay.__growPendingAiPushes;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, Authorization, MCP-Session-Id, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'MCP-Session-Id',
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function DELETE() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function formatBrowserGardenReport(dataset: AiDataset, origin: string) {
  const plantMap = new Map(dataset.plants.map((p) => [p.id, p]));
  const locationMap = new Map(dataset.locations.map((l) => [l.id, l]));
  const defaultLocation = dataset.locations[0];

  const enrichedPlantings = dataset.plantings.map((planting) => {
    const plant = plantMap.get(planting.plantId);
    const location =
      (planting.gardenId && locationMap.get(planting.gardenId)) || defaultLocation;
    const conditions: Conditions = location?.conditions || {
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
      gardenName: location?.name || 'Active Garden',
      status: latestStatus,
      seedsOnHand: planting.seedsOnHand ?? 0,
      plannedQty: planting.plannedQty ?? 0,
      viability,
      suitableSeasons,
      optimalConditions: plant?.optimalConditions || '',
      germinationNeeds: plant?.germinationNeeds || '',
    };
  });

  const openInGrowUrl = `${origin}/?pack=${encodeSeedPackToParam(dataset)}`;
  return {
    source: 'browser-indexeddb-snapshot',
    uiSchema: GROW_UI_SCHEMA,
    dataHandlingRules: GROW_DATA_HANDLING_RULES,
    uiDisplayInstructions:
      'Present the formattedDisplayMarkdown below to mirror the Grow dashboard layout (Microclimate Header Bar, Viability Badges, and Plant Cards). Keep seedsOnHand and plannedQty at 0 unless modified by the user.',
    formattedDisplayMarkdown: formatGardenAsGrowMarkdown({
      gardens: dataset.locations,
      plantings: enrichedPlantings,
      openInGrowUrl,
    }),
    gardens: dataset.locations,
    plantCount: dataset.plants.length,
    plantingCount: dataset.plantings.length,
    plantings: enrichedPlantings,
    openInGrowUrl,
  };
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const pollChannel = req.nextUrl.searchParams.get('pollAiPush');
  if (pollChannel) {
    const queueMap = getPendingAiPushMap();
    const items = queueMap.get(pollChannel) || [];
    queueMap.set(pollChannel, []);
    return NextResponse.json(
      {
        channel: pollChannel,
        queuedPushes: items,
      },
      { headers: CORS_HEADERS }
    );
  }

  const packParam = req.nextUrl.searchParams.get('pack');
  const resources = [
    {
      uri: 'grow://guidelines/ui-and-data-spec',
      name: 'Grow AI UI Display & Data Handling Specification',
      description:
        'Canonical Look & Feel template (Microclimate Header, Viability Badges, Plant Cards) and data rules (0 default seed counts, non-destructive imports).',
      mimeType: 'text/markdown',
    },
    ...availableDatasets.map((d) => ({
      uri: `grow://datasets/${d.key}`,
      name: d.name,
      description: d.description,
      mimeType: 'application/json',
    })),
  ];

  if (packParam) {
    resources.unshift({
      uri: 'grow://my-garden/indexeddb',
      name: 'My Browser Garden (Live IndexedDB Snapshot)',
      description: 'Live locations, plants, and plantings exported from your browser IndexedDB.',
      mimeType: 'application/json',
    });
  }

  return NextResponse.json(
    {
      protocol: 'mcp-streamable-http',
      serverInfo: {
        name: 'grow-p2p-botanical-mcp',
        version: '1.1.0',
        description:
          'Local-first P2P botanical viability engine & forkable microclimate dataset server.',
        homepage: origin,
        hasBrowserIndexedDbSnapshot: Boolean(packParam),
      },
      instructions: GROW_AI_SYSTEM_INSTRUCTIONS,
      uiSchema: GROW_UI_SCHEMA,
      dataHandlingRules: GROW_DATA_HANDLING_RULES,
      tools: MCP_TOOLS,
      resources,
    },
    { headers: CORS_HEADERS }
  );
}

async function handleJsonRpcMessage(
  message: any,
  origin: string,
  urlPackParam?: string | null
): Promise<any | null> {
  const { id, method, params } = message || {};

  // JSON-RPC notifications (e.g., "notifications/initialized", "notifications/cancelled")
  if (typeof method === 'string' && method.startsWith('notifications/')) {
    if (id === undefined || id === null) {
      return null;
    }
    return { jsonrpc: '2.0', id, result: {} };
  }

  if (method === 'ping') {
    return {
      jsonrpc: '2.0',
      id,
      result: {},
    };
  }

  if (method === 'initialize') {
    const requestedVersion = params?.protocolVersion;
    const supportedVersions = ['2025-03-26', '2024-11-05'];
    const protocolVersion = supportedVersions.includes(requestedVersion)
      ? requestedVersion
      : '2025-03-26';

    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: {
          name: 'grow-p2p-botanical-mcp',
          version: '1.1.0',
        },
        instructions: GROW_AI_SYSTEM_INSTRUCTIONS,
        uiSchema: GROW_UI_SCHEMA,
        dataHandlingRules: GROW_DATA_HANDLING_RULES,
      },
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: MCP_TOOLS,
      },
    };
  }

  if (method === 'prompts/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        prompts: [
          {
            name: 'grow-dashboard-view',
            description:
              'Formats garden microclimate conditions, plant cards, and viability scores matching the Grow dashboard look and feel.',
          },
          {
            name: 'grow-seed-pack-builder',
            description:
              'Builds a Grow-compatible plant pack with explicit seasonal germination/optimal conditions and 0/0 default seed inventory.',
          },
        ],
      },
    };
  }

  if (method === 'prompts/get') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        description: 'Grow Botanical UI & Data Handling Specification',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: GROW_AI_SYSTEM_INSTRUCTIONS,
            },
          },
        ],
      },
    };
  }

  if (method === 'resources/list') {
    const resources = [
      {
        uri: 'grow://guidelines/ui-and-data-spec',
        name: 'Grow AI UI Display & Data Handling Specification',
        description:
          'Canonical Look & Feel template (Microclimate Header, Viability Badges, Plant Cards) and data rules (0 default seed counts, non-destructive imports).',
        mimeType: 'text/markdown',
      },
      ...availableDatasets.map((d) => ({
        uri: `grow://datasets/${d.key}`,
        name: d.name,
        description: d.description,
        mimeType: 'application/json',
      })),
    ];
    if (urlPackParam) {
      resources.unshift({
        uri: 'grow://my-garden/indexeddb',
        name: 'My Browser Garden (Live IndexedDB Snapshot)',
        description:
          'Live locations, plants, and plantings exported from your browser IndexedDB.',
        mimeType: 'application/json',
      });
    }
    return {
      jsonrpc: '2.0',
      id,
      result: {
        resources,
      },
    };
  }

  if (method === 'resources/templates/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        resourceTemplates: [],
      },
    };
  }

  if (method === 'resources/read') {
    const uri: string = params?.uri || '';
    if (uri === 'grow://guidelines/ui-and-data-spec') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: GROW_AI_SYSTEM_INSTRUCTIONS,
            },
          ],
        },
      };
    }
    if (uri === 'grow://my-garden/indexeddb' && urlPackParam) {
      const userDataset = decodeSeedPackFromInput(urlPackParam);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(formatBrowserGardenReport(userDataset, origin), null, 2),
            },
          ],
        },
      };
    }
    const key = uri.replace('grow://datasets/', '');
    const dataset = await loadDataset(key);
    const datasetReport = formatBrowserGardenReport(dataset, origin);
    return {
      jsonrpc: '2.0',
      id,
      result: {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                ...dataset,
                formattedDisplayMarkdown: datasetReport.formattedDisplayMarkdown,
                uiSchema: GROW_UI_SCHEMA,
                dataHandlingRules: GROW_DATA_HANDLING_RULES,
              },
              null,
              2
            ),
          },
        ],
      },
    };
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};

    if (toolName === 'get-my-browser-garden') {
      const rawPack = args.pack || urlPackParam;
      if (!rawPack) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error:
                      'No browser IndexedDB snapshot was attached to this request. In your Grow browser tab, click "Live Browser MCP" or "Copy Live IndexedDB MCP URL" in Settings to generate an `/api/mcp?pack=...` URL containing your live IndexedDB garden.',
                  },
                  null,
                  2
                ),
              },
            ],
          },
        };
      }
      const userDataset = decodeSeedPackFromInput(String(rawPack));
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatBrowserGardenReport(userDataset, origin), null, 2),
            },
          ],
        },
      };
    }

    if (toolName === 'assess-plant-viability') {
      const plant: Plant = {
        id: 'mcp-temp',
        uid: toSpeciesUid(args.species || 'unknown'),
        species: args.species || 'Unknown Species',
        germinationNeeds: args.germinationNeeds || '',
        optimalConditions: args.optimalConditions || '',
      };
      const conditions: Conditions = {
        temperature: args.gardenConditions?.temperature || '18°C',
        sunlight: args.gardenConditions?.sunlight || 'Full sun',
        soil: args.gardenConditions?.soil || 'Loam',
        currentSeason: args.gardenConditions?.currentSeason,
      };
      const viability = analyzeViability(plant, conditions);
      const reasoning = generateLocalViabilityReasoning(plant, conditions);
      const suitableSeasons = getSuitableSeasons(plant);
      const upcoming = getUpcomingViability(plant, conditions, viability);

      const formattedCard = [
        formatMicroclimateHeader(null, conditions),
        '',
        `### 🌿 ${plant.species}`,
        `- **Viability:** \`${getViabilityBadge(viability)}\`${upcoming.upcomingTiming ? ` *(Improves to ${getViabilityBadge(upcoming.upcomingViability || 'High')} in ${upcoming.upcomingTiming})*` : ''}`,
        `- **Suitable Seasons:** ${suitableSeasons.length > 0 ? suitableSeasons.join(', ') : 'All Seasons'}`,
        `- **Germination Needs:** ${plant.germinationNeeds}`,
        `- **Optimal Conditions:** ${plant.optimalConditions}`,
        `- **Seed Inventory:** Seeds on Hand: \`0\` • Planned Qty: \`0\``,
        '',
        `\`\`\`text\n${reasoning}\n\`\`\``,
      ].join('\n');

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  formattedDisplayMarkdown: formattedCard,
                  species: plant.species,
                  viability,
                  viabilityBadge: getViabilityBadge(viability),
                  reasoning,
                  suitableSeasons,
                  ...upcoming,
                  interactiveAppUrl: origin,
                },
                null,
                2
              ),
            },
          ],
        },
      };
    }

    if (toolName === 'search-cultivar-datasets') {
      const q = normalizeText(String(args.query || ''));
      const matches: any[] = [];

      for (const info of availableDatasets) {
        const ds = await info.loader();
        for (const p of ds.plants) {
          const hay = normalizeText(
            `${info.key} ${info.name} ${p.species} ${p.germinationNeeds} ${p.optimalConditions}`
          );
          if (hay.includes(q)) {
            matches.push({
              datasetKey: info.key,
              datasetName: info.name,
              plant: p,
            });
          }
        }
      }

      const topMatches = matches.slice(0, 15);
      const formattedMatchesMarkdown = topMatches
        .map((m) =>
          [
            `### 🌿 ${m.plant.species} *(${m.datasetName})*`,
            `- **Status:** \`📋 Wishlist\` | **Suitable Seasons:** ${getSuitableSeasons(m.plant).join(', ') || 'All Seasons'}`,
            `- **Germination Needs:** ${m.plant.germinationNeeds}`,
            `- **Optimal Conditions:** ${m.plant.optimalConditions}`,
            `- **Seed Inventory:** Seeds on Hand: \`0\` • Planned Qty: \`0\``,
          ].join('\n')
        )
        .join('\n\n');

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  query: args.query,
                  matchCount: matches.length,
                  formattedDisplayMarkdown:
                    formattedMatchesMarkdown || `No cultivars matched "${args.query}".`,
                  uiSchema: GROW_UI_SCHEMA,
                  dataHandlingRules: GROW_DATA_HANDLING_RULES,
                  matches: topMatches,
                  forkInGrowUrl: `${origin}/?dataset=${encodeURIComponent(matches[0]?.datasetKey || 'new-zealand')}`,
                },
                null,
                2
              ),
            },
          ],
        },
      };
    }

    if (toolName === 'create-forkable-seed-pack-link') {
      const dataset = await loadDataset(args.datasetKey || 'new-zealand');
      const encoded = encodeSeedPackToParam(dataset);
      const packUrl = `${origin}/?pack=${encoded}`;
      const directAutoImportUrl = `${origin}/?aiPushPack=${encoded}&mode=add`;
      const report = formatBrowserGardenReport(dataset, origin);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  datasetKey: args.datasetKey,
                  plantCount: dataset.plants.length,
                  formattedDisplayMarkdown: `${report.formattedDisplayMarkdown}\n🚀 **[1-Click Direct Import to Grow](${directAutoImportUrl})**`,
                  uiSchema: GROW_UI_SCHEMA,
                  dataHandlingRules: GROW_DATA_HANDLING_RULES,
                  directAutoImportUrl,
                  forkUrl: packUrl,
                },
                null,
                2
              ),
            },
          ],
        },
      };
    }

    if (toolName === 'push-ai-seed-pack-to-garden') {
      const rawPlants = Array.isArray(args.plants) ? args.plants : [];
      if (rawPlants.length === 0) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { error: 'Pass a non-empty plants array to push to the user garden.' },
                  null,
                  2
                ),
              },
            ],
          },
        };
      }

      const importMode: 'add' | 'new' = args.importMode === 'new' ? 'new' : 'add';
      const channel = typeof args.channel === 'string' && args.channel.trim() ? args.channel.trim() : 'default';
      const now = Date.now();
      const gardenId = `ai-push-garden-${now}`;

      const dataset: AiDataset = {
        locations: [
          {
            id: gardenId,
            name: args.garden?.name || 'AI Pushed Garden Pack',
            location: args.garden?.location || '',
            temperatureUnit: args.garden?.temperatureUnit === 'F' ? 'F' : 'C',
            conditions: {
              temperature: args.garden?.conditions?.temperature || '18°C',
              sunlight: args.garden?.conditions?.sunlight || 'Full sun',
              soil: args.garden?.conditions?.soil || 'Well-drained loam',
              currentSeason: args.garden?.conditions?.currentSeason || 'Spring',
            },
          },
        ],
        plants: rawPlants.map((p: any, idx: number) => ({
          id: `ai-push-plant-${now}-${idx}`,
          uid: toSpeciesUid(p.species || `plant-${idx}`),
          species: p.species || `Cultivar ${idx + 1}`,
          germinationNeeds: p.germinationNeeds || 'Sow in moist soil.',
          optimalConditions: p.optimalConditions || 'Full sun to partial shade.',
        })),
        plantings: rawPlants.map((p: any, idx: number) => ({
          id: `ai-push-planting-${now}-${idx}`,
          plantId: `ai-push-plant-${now}-${idx}`,
          gardenId,
          name: p.plantingName || String(p.species || `Plant ${idx + 1}`).split('(')[0].trim(),
          createdAt: new Date().toISOString(),
          seedsOnHand: 0,
          plannedQty: 0,
          history: [
            {
              id: `ai-push-hist-${now}-${idx}`,
              status: ['Wishlist', 'Planting', 'Growing', 'Harvest'].includes(p.status)
                ? p.status
                : 'Wishlist',
              date: new Date().toISOString(),
              notes: p.notes || 'Pushed directly from AI via MCP.',
            },
          ],
        })),
      };

      const queueMap = getPendingAiPushMap();
      const existingQueue = queueMap.get(channel) || [];
      existingQueue.push({
        id: `push-${now}`,
        createdAt: new Date().toISOString(),
        importMode,
        dataset,
      });
      queueMap.set(channel, existingQueue.slice(-10));

      const encoded = encodeSeedPackToParam(dataset);
      const directAutoImportUrl = `${origin}/?aiPushPack=${encoded}&mode=${importMode}`;
      const reviewUrl = `${origin}/?pack=${encoded}`;
      const report = formatBrowserGardenReport(dataset, origin);

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'pushed',
                  channel,
                  importMode,
                  plantCount: dataset.plants.length,
                  message:
                    'Queued for automatic live import into the open Grow browser tab (IndexedDB). Render formattedDisplayMarkdown below and surface directAutoImportUrl.',
                  formattedDisplayMarkdown: `${report.formattedDisplayMarkdown}\n🚀 **[1-Click Direct Import to Grow (${importMode === 'new' ? 'New Garden' : 'Add to Active Garden'})](${directAutoImportUrl})**`,
                  directAutoImportUrl,
                  reviewUrl,
                },
                null,
                2
              ),
            },
          ],
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Unknown tool: ${toolName}` },
    };
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Unsupported MCP method: ${method}` },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const origin = req.nextUrl.origin;
    const packParam = req.nextUrl.searchParams.get('pack');

    if (Array.isArray(body)) {
      const responses = (
        await Promise.all(body.map((msg) => handleJsonRpcMessage(msg, origin, packParam)))
      ).filter((r) => r !== null);

      if (responses.length === 0) {
        return new NextResponse(null, { status: 202, headers: CORS_HEADERS });
      }
      return NextResponse.json(responses, { headers: CORS_HEADERS });
    }

    const response = await handleJsonRpcMessage(body, origin, packParam);
    if (response === null) {
      return new NextResponse(null, { status: 202, headers: CORS_HEADERS });
    }

    return NextResponse.json(response, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: err?.message || 'Internal MCP server error' },
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
