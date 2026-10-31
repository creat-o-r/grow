import type { Conditions, GardenLocation } from '@/lib/types';
import type { Viability } from '@/lib/viability';

/**
 * Canonical AI Presentation ("Look & Feel") and Data Handling Specification for `Grow`.
 * Shared across MCP (`initialize` instructions, `prompts/*`, tool outputs),
 * Google A2A (`/.well-known/agent.json`), and Browser WebMCP (`document.modelContext`).
 */
export const GROW_AI_SYSTEM_INSTRUCTIONS = `
# Grow Botanical UI & Data Handling Specification for AI Agents

When presenting, analyzing, or modifying garden and plant data from **Grow**, mirror the application's local-first botanical dashboard look, feel, and data rules:

## 1. Visual Look & Feel (Structured Dashboard Layout)
Always render garden and plant information using this consistent hierarchy:

1. **Garden Microclimate Header Bar**:
   > 🌱 **{Garden Name}** ({Location})
   > 🌡️ **Temp:** {temperature} | ☀️ **Sunlight:** {sunlight} | 🪨 **Soil:** {soil} | 🍂 **Season:** {currentSeason}

2. **Viability Badge Convention**:
   - \`🟢 High Viability\` — Ideal match (5–6/6 score) for the garden's sunlight, temperature, soil, and current season.
   - \`🟡 Medium Viability\` — Workable match (3–4/6 score) with microclimate care (mulch, shade cloth, or cloche).
   - \`🔴 Low Viability\` — Poor match for current conditions (0–2/6 score); recommend keeping in \`Wishlist\` until its upcoming suitable season.

3. **Plant Card Structure** (use Markdown cards or structured tables):
   ### 🌿 {Planting Name} — *{Species (Scientific Name)}*
   - **Status:** \`{Wishlist | Planting | Growing | Harvest}\` | **Viability:** \`{🟢 High | 🟡 Medium | 🔴 Low}\`
   - **Suitable Seasons:** {Spring, Summer, Autumn, Winter} *(if Low/Medium now, note upcoming season improvement)*
   - **Germination Needs:** {germinationNeeds}
   - **Optimal Conditions:** {optimalConditions}
   - **Seed Inventory:** Seeds on Hand: \`{seedsOnHand}\` • Planned Qty: \`{plannedQty}\`

4. **Direct Action Links**:
   Whenever you generate or recommend plants, always surface the clickable **1-Click Direct Import to Grow** link (\`directAutoImportUrl\`) and **Review in Grow** link (\`reviewUrl\`).

## 2. Strict Data Handling & Mutation Rules
1. **Default Inventory is Always \`0\`**:
   - \`seedsOnHand\` and \`plannedQty\` MUST default to \`0\` on all plants, plantings, and seed packs unless the user explicitly provides a count.
2. **Non-Destructive Imports by Default**:
   - Default \`importMode\` to \`"add"\` so new cultivars merge into the user's active garden without overwriting existing plants or locations. Use \`"new"\` only when creating a separate garden location.
3. **Deterministic Viability Engine Compatibility**:
   - Every plant's \`germinationNeeds\` and \`optimalConditions\` MUST explicitly mention:
     - **Season(s)** using exact terms: \`Spring\`, \`Summer\`, \`Autumn\`, or \`Winter\`.
     - **Sunlight** using clear terms: \`Full sun\`, \`Partial shade\`, or \`Shade\`.
     - **Temperature range** in \`°C\` or \`°F\` (e.g., \`15-24°C\`).
     - **Soil preference** (e.g., \`well-drained loam\`, \`sandy\`, \`clay\`, \`compost-rich\`).
4. **Allowed Planting Statuses**:
   - Status history entries must use one of: \`"Wishlist"\`, \`"Planting"\`, \`"Growing"\`, or \`"Harvest"\`.
`.trim();

export function getViabilityBadge(viability: Viability | string): string {
  if (viability === 'High') return '🟢 High Viability';
  if (viability === 'Medium') return '🟡 Medium Viability';
  return '🔴 Low Viability';
}

export function getStatusBadge(status: string): string {
  switch (status) {
    case 'Planting':
      return '🌰 Planting';
    case 'Growing':
      return '🌿 Growing';
    case 'Harvest':
      return '🧺 Harvest';
    default:
      return '📋 Wishlist';
  }
}

export function formatMicroclimateHeader(
  garden?: Partial<GardenLocation> | null,
  fallbackConditions?: Conditions
): string {
  const name = garden?.name || 'Active Garden';
  const loc = garden?.location ? ` (${garden.location})` : '';
  const c = garden?.conditions || fallbackConditions;
  const temp = c?.temperature || 'Unspecified';
  const sun = c?.sunlight || 'Unspecified';
  const soil = c?.soil || 'Unspecified';
  const season = c?.currentSeason || 'Spring';

  return [
    `> 🌱 **${name}**${loc}`,
    `> 🌡️ **Temp:** ${temp} | ☀️ **Sunlight:** ${sun} | 🪨 **Soil:** ${soil} | 🍂 **Season:** ${season}`,
  ].join('\n');
}

export interface EnrichedPlantingSummary {
  plantingId: string;
  name: string;
  species: string;
  gardenName: string;
  status: string;
  seedsOnHand: number;
  plannedQty: number;
  viability: Viability | string;
  suitableSeasons: string[];
  optimalConditions: string;
  germinationNeeds: string;
}

export function formatGardenAsGrowMarkdown(params: {
  gardens: GardenLocation[];
  plantings: EnrichedPlantingSummary[];
  openInGrowUrl?: string;
}): string {
  const primaryGarden = params.gardens[0];
  const header = formatMicroclimateHeader(primaryGarden);

  const highCount = params.plantings.filter((p) => p.viability === 'High').length;
  const medCount = params.plantings.filter((p) => p.viability === 'Medium').length;
  const lowCount = params.plantings.filter((p) => p.viability === 'Low').length;

  const summaryLine = `**Garden Summary:** ${params.plantings.length} Plantings (\`🟢 ${highCount} High\` • \`🟡 ${medCount} Medium\` • \`🔴 ${lowCount} Low\`)`;

  const cards = params.plantings.map((p) => {
    const seasonsText =
      p.suitableSeasons && p.suitableSeasons.length > 0
        ? p.suitableSeasons.join(', ')
        : 'All Seasons';
    return [
      `### 🌿 ${p.name} — *${p.species}*`,
      `- **Status:** \`${getStatusBadge(p.status)}\` | **Viability:** \`${getViabilityBadge(p.viability)}\` | **Garden:** ${p.gardenName}`,
      `- **Suitable Seasons:** ${seasonsText}`,
      `- **Germination Needs:** ${p.germinationNeeds}`,
      `- **Optimal Conditions:** ${p.optimalConditions}`,
      `- **Seed Inventory:** Seeds on Hand: \`${p.seedsOnHand ?? 0}\` • Planned Qty: \`${p.plannedQty ?? 0}\``,
    ].join('\n');
  });

  const footer = params.openInGrowUrl
    ? `\n---\n🔗 **[Open or Merge This Garden in Grow](${params.openInGrowUrl})**`
    : '';

  return [header, '', summaryLine, '', ...cards, footer].filter(Boolean).join('\n');
}
