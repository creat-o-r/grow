export interface CompanionRule {
  a: string[];
  b: string[];
  relation: 'synergy' | 'conflict';
  reason: string;
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
    reason: 'Pollinator magnet: draws wild bees & beneficial hoverflies to garden.',
  },
  {
    a: ['brassica', 'cabbage', 'kale', 'broccoli', 'cauliflower'],
    b: ['mint', 'thyme', 'dill', 'chamomile', 'sage'],
    relation: 'synergy',
    reason: 'Aromatic herbs mask brassicas from white cabbage butterfly.',
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

export function matchesKeywords(speciesText: string, keywords: string[]): boolean {
  const lower = speciesText.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

export interface PlantGuildStatus {
  activeSynergies: { partnerName: string; reason: string }[];
  activeConflicts: { partnerName: string; reason: string }[];
  knownRule?: CompanionRule;
  badgeLabel?: string;
  summaryText?: string;
}

/**
 * Returns companion guild matches for a plant, utilizing the app's COMPANION_RULES.
 */
export function getPlantGuildStatus(
  targetName: string,
  targetSpecies?: string,
  otherPlantings: Array<{ name: string; species?: string }> = []
): PlantGuildStatus {
  const spA = `${targetName} ${targetSpecies || ''}`;
  const activeSynergies: { partnerName: string; reason: string }[] = [];
  const activeConflicts: { partnerName: string; reason: string }[] = [];

  for (const other of otherPlantings) {
    if (other.name === targetName) continue;
    const spB = `${other.name} ${other.species || ''}`;

    for (const rule of COMPANION_RULES) {
      const direct = matchesKeywords(spA, rule.a) && matchesKeywords(spB, rule.b);
      const reverse = matchesKeywords(spA, rule.b) && matchesKeywords(spB, rule.a);

      if (direct || reverse) {
        if (rule.relation === 'synergy') {
          activeSynergies.push({ partnerName: other.name, reason: rule.reason });
        } else {
          activeConflicts.push({ partnerName: other.name, reason: rule.reason });
        }
      }
    }
  }

  let knownRule: CompanionRule | undefined;
  for (const rule of COMPANION_RULES) {
    if (rule.relation === 'synergy' && (matchesKeywords(spA, rule.a) || matchesKeywords(spA, rule.b))) {
      knownRule = rule;
      break;
    }
  }

  let badgeLabel: string | undefined;
  let summaryText: string | undefined;

  if (activeSynergies.length > 0) {
    badgeLabel = `Guild Synergy: +${activeSynergies[0].partnerName}`;
    summaryText = `Synergy with ${activeSynergies.map((s) => s.partnerName).join(', ')}: ${activeSynergies[0].reason}`;
  } else if (knownRule) {
    if (knownRule.reason.includes('Three Sisters')) {
      badgeLabel = 'Three Sisters Guild';
      summaryText = knownRule.reason;
    } else if (knownRule.reason.includes('Pollinator')) {
      badgeLabel = 'Pollinator Guild';
      summaryText = knownRule.reason;
    } else if (knownRule.reason.includes('Orchard') || knownRule.reason.includes('orchard')) {
      badgeLabel = 'Orchard Guild';
      summaryText = knownRule.reason;
    } else {
      badgeLabel = 'Companion Guild';
      summaryText = knownRule.reason;
    }
  }

  return { activeSynergies, activeConflicts, knownRule, badgeLabel, summaryText };
}
