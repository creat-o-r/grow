/**
 * Companion Planting & Permaculture Guild Engine
 * Single source of truth for companion rules, permaculture guild roles,
 * and garden synergy detection.
 */

export interface CompanionRule {
  a: string[];
  b: string[];
  relation: 'synergy' | 'conflict';
  reason: string;
}

export interface GuildProfile {
  id: string;
  name: string; // e.g. "Pollinator & Insectary Guild"
  tag: string; // e.g. "🐝 Pollinator Guild"
  role: string; // e.g. "Attracts bees & hoverflies, serves as sturdy windbreak"
  beneficialCompanions: string[];
}

export const COMPANION_RULES: CompanionRule[] = [
  {
    a: ['tomato', 'solanum lycopersicum'],
    b: ['basil', 'ocimum'],
    relation: 'synergy',
    reason: 'Basil repels thrips/hornworms and enhances tomato vigor.',
  },
  {
    a: ['carrot', 'daucus'],
    b: ['onion', 'leek', 'chive', 'allium', 'rosemary'],
    relation: 'synergy',
    reason: 'Alliums & aromatic herbs mask carrot scent from carrot rust fly.',
  },
  {
    a: ['corn', 'maize', 'zea'],
    b: ['bean', 'phaseolus', 'squash', 'cucurbita', 'kumara'],
    relation: 'synergy',
    reason: 'Three Sisters / Polyculture guild: nitrogen fixation + living mulch groundcover.',
  },
  {
    a: ['feijoa', 'acca'],
    b: ['kawakawa', 'comfrey', 'clover', 'nasturtium'],
    relation: 'synergy',
    reason: 'Subtropical orchard guild: dynamic nutrient accumulation & pollinator attraction.',
  },
  {
    a: ['sunflower', 'helianthus'],
    b: ['cucumber', 'squash', 'corn', 'beans'],
    relation: 'synergy',
    reason: 'Pollinator magnet: draws wild bees & beneficial predatory hoverflies.',
  },
  {
    a: ['brassica', 'cabbage', 'kale', 'broccoli', 'cauliflower'],
    b: ['mint', 'thyme', 'dill', 'chamomile', 'sage'],
    relation: 'synergy',
    reason: 'Aromatic herbs mask brassicas from white cabbage butterfly & flea beetles.',
  },
  {
    a: ['tomato', 'solanum lycopersicum'],
    b: ['potato', 'taewa', 'solanum tuberosum', 'fennel'],
    relation: 'conflict',
    reason: 'Shared blight susceptibility (Solanaceae) or allelopathic root inhibition.',
  },
  {
    a: ['bean', 'pea', 'legume'],
    b: ['onion', 'garlic', 'allium'],
    relation: 'conflict',
    reason: 'Allium root exudates can inhibit rhizobia nitrogen-fixing bacteria on legumes.',
  },
];

export function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

const GUILD_PROFILES: {
  keywords: string[];
  profile: Omit<GuildProfile, 'id'> & { id: string };
}[] = [
  {
    keywords: ['sunflower', 'helianthus'],
    profile: {
      id: 'pollinator-insectary',
      name: 'Pollinator & Insectary Guild',
      tag: '🐝 Pollinator Guild',
      role: 'Attracts bees & hoverflies, serves as sturdy bird perch & windbreak',
      beneficialCompanions: ['Corn', 'Squash', 'Cucumbers', 'Bush Beans'],
    },
  },
  {
    keywords: ['corn', 'maize', 'zea'],
    profile: {
      id: 'three-sisters-trellis',
      name: 'Three Sisters Polyculture Guild',
      tag: '🌽 Three Sisters Guild',
      role: 'Living stalk trellis for climbing beans; provides vertical canopy structure',
      beneficialCompanions: ['Climbing Beans', 'Squash', 'Pumpkin', 'Sunflower'],
    },
  },
  {
    keywords: ['bean', 'pea', 'phaseolus', 'pisum', 'legume', 'clover', 'trifolium', 'lupin'],
    profile: {
      id: 'nitrogen-fixing',
      name: 'Nitrogen-Fixing Soil Guild',
      tag: '⚡ Nitrogen-Fixing Guild',
      role: 'Rhizobia root nodules feed organic nitrogen directly to soil & neighbors',
      beneficialCompanions: ['Sweet Corn', 'Squash', 'Carrots', 'Cucumbers'],
    },
  },
  {
    keywords: ['squash', 'pumpkin', 'zucchini', 'cucurbita', 'kumara', 'cucumber', 'cucumis'],
    profile: {
      id: 'living-mulch',
      name: 'Living Mulch Groundcover Guild',
      tag: '🌿 Living Mulch Guild',
      role: 'Broad prickly leaves shade soil, retain humidity & suppress weed competition',
      beneficialCompanions: ['Corn', 'Beans', 'Nasturtium', 'Radish'],
    },
  },
  {
    keywords: ['tomato', 'solanum lycopersicum'],
    profile: {
      id: 'solanaceae-herb',
      name: 'Nightshade & Aromatic Herb Guild',
      tag: '🍅 Nightshade & Herb Guild',
      role: 'Heavy nutrient feeder synergized by companion basil, marigolds & alliums',
      beneficialCompanions: ['Basil', 'Marigold', 'Carrot', 'Chives'],
    },
  },
  {
    keywords: ['basil', 'ocimum', 'mint', 'mentha', 'rosemary', 'rosmarinus', 'sage', 'salvia', 'thyme', 'thymus', 'lavender', 'lavandula'],
    profile: {
      id: 'aromatic-pest-shield',
      name: 'Aromatic Pest Shield Guild',
      tag: '🛡️ Aromatic Pest Shield Guild',
      role: 'Aromatic essential oils confuse pest sensors, deterring aphids & hornworms',
      beneficialCompanions: ['Tomatoes', 'Peppers', 'Brassicas', 'Carrots'],
    },
  },
  {
    keywords: ['onion', 'garlic', 'leek', 'chive', 'allium', 'shallot'],
    profile: {
      id: 'allium-bio-fumigant',
      name: 'Allium Bio-Fumigant Guild',
      tag: '🧄 Allium Bio-Shield Guild',
      role: 'Natural sulfur root exudates deter carrot rust fly, aphids & fungal blights',
      beneficialCompanions: ['Carrots', 'Beetroot', 'Tomatoes', 'Brassicas'],
    },
  },
  {
    keywords: ['carrot', 'daucus', 'parsnip', 'pastinaca', 'radish', 'raphanus', 'beet', 'beta vulgaris'],
    profile: {
      id: 'root-subsoil-miner',
      name: 'Root & Umbel Insectary Guild',
      tag: '🥕 Root Synergy Guild',
      role: 'Breaks subsoil compaction; flowers host parasitoid micro-wasps',
      beneficialCompanions: ['Alliums', 'Rosemary', 'Lettuce', 'Peas'],
    },
  },
  {
    keywords: ['brassica', 'cabbage', 'kale', 'broccoli', 'cauliflower'],
    profile: {
      id: 'brassica-cool-crop',
      name: 'Brassica & Herb Defense Guild',
      tag: '🥬 Brassica Defense Guild',
      role: 'Cool-season nutrient crop shielded from white butterfly by herbs & mints',
      beneficialCompanions: ['Mint', 'Thyme', 'Dill', 'Chamomile'],
    },
  },
  {
    keywords: ['feijoa', 'acca', 'citrus', 'apple', 'malus', 'peach', 'prunus', 'fig', 'ficus', 'avocado', 'persea'],
    profile: {
      id: 'orchard-overstory',
      name: 'Fruit Orchard Canopy Guild',
      tag: '🌳 Fruit Orchard Guild',
      role: 'Overstory fruit canopy paired with understory nutrient pumps & groundcover',
      beneficialCompanions: ['Kawakawa', 'Comfrey', 'Clover', 'Nasturtium'],
    },
  },
  {
    keywords: ['comfrey', 'symphytum', 'borage', 'borago', 'yarrow', 'achillea', 'dandelion'],
    profile: {
      id: 'dynamic-accumulator',
      name: 'Dynamic Nutrient Miner Guild',
      tag: '🌱 Dynamic Miner Guild',
      role: 'Deep taproot mines subsoil potassium, calcium & minerals to surface mulch',
      beneficialCompanions: ['Fruit Trees', 'Tomatoes', 'Berries', 'Potatoes'],
    },
  },
  {
    keywords: ['marigold', 'tagetes', 'calendula', 'nasturtium', 'tropaeolum'],
    profile: {
      id: 'trap-crop-insectary',
      name: 'Trap Crop & Insectary Guild',
      tag: '🌼 Trap Crop Guild',
      role: 'Traps caterpillars/aphids and suppresses root-knot soil nematodes',
      beneficialCompanions: ['Tomatoes', 'Squash', 'Cucumbers', 'Beans'],
    },
  },
  {
    keywords: ['strawberry', 'fragaria', 'raspberry', 'blackberry', 'rubus', 'blueberry', 'vaccinium'],
    profile: {
      id: 'berry-understory',
      name: 'Berry Polyculture Guild',
      tag: '🍓 Berry Polyculture Guild',
      role: 'Perennial fruit groundcover layer attracting native pollinators & predators',
      beneficialCompanions: ['Borage', 'Chives', 'Thyme', 'Spinach'],
    },
  },
];

/**
 * Returns the permaculture guild profile for a given plant name / species.
 */
export function getPlantGuildProfile(plantName: string, species?: string): GuildProfile {
  const combined = `${plantName} ${species || ''}`.trim();

  for (const entry of GUILD_PROFILES) {
    if (matchesKeywords(combined, entry.keywords)) {
      return entry.profile;
    }
  }

  return {
    id: 'companion-polyculture',
    name: 'Companion Polyculture Guild',
    tag: '🌱 Polyculture Guild',
    role: 'Biodiverse companion planting enhancing garden resilience & soil health',
    beneficialCompanions: ['Aromatic Herbs', 'Comfrey', 'Marigolds'],
  };
}

/**
 * Detects active companion synergies or conflicts between this plant and other garden plantings.
 */
export function detectGardenSynergies(
  targetPlantName: string,
  targetSpecies?: string,
  otherPlantings: Array<{ name: string; species?: string }> = []
): {
  synergies: { partnerName: string; reason: string }[];
  conflicts: { partnerName: string; reason: string }[];
} {
  const targetText = `${targetPlantName} ${targetSpecies || ''}`;
  const synergies: { partnerName: string; reason: string }[] = [];
  const conflicts: { partnerName: string; reason: string }[] = [];

  for (const other of otherPlantings) {
    if (other.name === targetPlantName) continue;
    const otherText = `${other.name} ${other.species || ''}`;

    for (const rule of COMPANION_RULES) {
      const directMatch =
        matchesKeywords(targetText, rule.a) && matchesKeywords(otherText, rule.b);
      const reverseMatch =
        matchesKeywords(targetText, rule.b) && matchesKeywords(otherText, rule.a);

      if (directMatch || reverseMatch) {
        if (rule.relation === 'synergy') {
          synergies.push({ partnerName: other.name, reason: rule.reason });
        } else {
          conflicts.push({ partnerName: other.name, reason: rule.reason });
        }
      }
    }
  }

  return { synergies, conflicts };
}
