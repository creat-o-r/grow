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
];

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

  return {
    source: 'browser-indexeddb-snapshot',
    gardens: dataset.locations,
    plantCount: dataset.plants.length,
    plantingCount: dataset.plantings.length,
    plantings: enrichedPlantings,
    openInGrowUrl: `${origin}/?pack=${encodeSeedPackToParam(dataset)}`,
  };
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const packParam = req.nextUrl.searchParams.get('pack');
  const resources = availableDatasets.map((d) => ({
    uri: `grow://datasets/${d.key}`,
    name: d.name,
    description: d.description,
    mimeType: 'application/json',
  }));

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
        prompts: [],
      },
    };
  }

  if (method === 'resources/list') {
    const resources = availableDatasets.map((d) => ({
      uri: `grow://datasets/${d.key}`,
      name: d.name,
      description: d.description,
      mimeType: 'application/json',
    }));
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
    return {
      jsonrpc: '2.0',
      id,
      result: {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(dataset, null, 2),
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

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  species: plant.species,
                  viability,
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
                  matches: matches.slice(0, 15),
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
