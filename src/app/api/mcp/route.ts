import { NextRequest, NextResponse } from 'next/server';
import { availableDatasets, loadDataset } from '@/lib/datasets';
import {
  analyzeViability,
  generateLocalViabilityReasoning,
  getSuitableSeasons,
  getUpcomingViability,
} from '@/lib/viability';
import { encodeSeedPackToParam, toSpeciesUid } from '@/lib/seed-pack';
import type { Conditions, Plant } from '@/lib/types';

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
];

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  return NextResponse.json({
    protocol: 'mcp-streamable-http',
    serverInfo: {
      name: 'grow-p2p-botanical-mcp',
      version: '1.1.0',
      description:
        'Local-first P2P botanical viability engine & forkable microclimate dataset server.',
      homepage: origin,
    },
    tools: MCP_TOOLS,
    resources: availableDatasets.map((d) => ({
      uri: `grow://datasets/${d.key}`,
      name: d.name,
      description: d.description,
      mimeType: 'application/json',
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, method, params } = body;
    const origin = req.nextUrl.origin;

    if (method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: 'grow-p2p-botanical-mcp',
            version: '1.1.0',
          },
        },
      });
    }

    if (method === 'tools/list') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS,
        },
      });
    }

    if (method === 'resources/list') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          resources: availableDatasets.map((d) => ({
            uri: `grow://datasets/${d.key}`,
            name: d.name,
            description: d.description,
            mimeType: 'application/json',
          })),
        },
      });
    }

    if (method === 'resources/read') {
      const uri: string = params?.uri || '';
      const key = uri.replace('grow://datasets/', '');
      const dataset = await loadDataset(key);
      return NextResponse.json({
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
      });
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};

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

        return NextResponse.json({
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
        });
      }

      if (toolName === 'search-cultivar-datasets') {
        const q = String(args.query || '').toLowerCase();
        const matches: any[] = [];

        for (const info of availableDatasets) {
          const ds = await info.loader();
          for (const p of ds.plants) {
            const hay = `${info.key} ${info.name} ${p.species} ${p.germinationNeeds} ${p.optimalConditions}`.toLowerCase();
            if (hay.includes(q)) {
              matches.push({
                datasetKey: info.key,
                datasetName: info.name,
                plant: p,
              });
            }
          }
        }

        return NextResponse.json({
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
        });
      }

      if (toolName === 'create-forkable-seed-pack-link') {
        const dataset = await loadDataset(args.datasetKey || 'new-zealand');
        const encoded = encodeSeedPackToParam(dataset);
        const packUrl = `${origin}/?pack=${encoded}`;
        return NextResponse.json({
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
        });
      }

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unsupported MCP method: ${method}` },
      },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: err?.message || 'Internal MCP server error' },
      },
      { status: 500 }
    );
  }
}
