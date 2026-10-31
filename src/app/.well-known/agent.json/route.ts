import { NextRequest, NextResponse } from 'next/server';
import { availableDatasets } from '@/lib/datasets';
import { registeredExtensions } from '@/extensions/registry';
import { GROW_AI_SYSTEM_INSTRUCTIONS } from '@/lib/ai-presentation';

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
    url: origin,
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
      mcp: `${origin}/api/mcp`,
      forkClone: `https://vercel.com/new/clone?repository-url=${encodeURIComponent('https://github.com/creat-o-r/grow')}`,
    },
    defaultInputModes: ['application/json', 'text/plain'],
    defaultOutputModes: ['application/json', 'text/plain'],
    instructions: GROW_AI_SYSTEM_INSTRUCTIONS,
    dataHandlingRules: {
      defaultSeedsOnHand: 0,
      defaultPlannedQty: 0,
      defaultImportMode: 'add',
      allowedStatuses: ['Wishlist', 'Planting', 'Growing', 'Harvest'],
      allowedSeasons: ['Spring', 'Summer', 'Autumn', 'Winter'],
    },
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
        id: 'fork-regional-seed-pack',
        name: 'Regional Seed Pack Discovery & Forking',
        description: `Exposes ${availableDatasets.length} curated starter datasets (${availableDatasets.map((d) => d.key).join(', ')}) and ${registeredExtensions.length} crowd extensions.`,
        tags: ['datasets', 'seed-swap', 'p2p', 'open-data'],
      },
    ],
  };

  return NextResponse.json(agentCard, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
