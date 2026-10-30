import type React from 'react';
import type {
  Plant,
  PlantingWithPlant,
  GardenLocation,
  Conditions,
  ContributorMeta,
} from '@/lib/types';
import type { Viability } from '@/lib/viability';

export type ExtensionSlot =
  | 'dashboard-toolbar'
  | 'plant-card-badge'
  | 'viability-modifier';

export interface ExtensionContext {
  plants: Plant[];
  plantings: PlantingWithPlant[];
  activeLocation?: GardenLocation;
  conditions?: Conditions;
  onSharePackUrl?: (subset: {
    plants: Plant[];
    plantings: PlantingWithPlant[];
    title: string;
  }) => void;
}

export interface GrowExtension {
  /** Unique kebab-case ID (e.g. 'surplus-seed-swap') */
  id: string;
  /** Human-readable title */
  name: string;
  /** Short 1-sentence description */
  description: string;
  /** Version string */
  version: string;
  /** Which UI slot(s) this extension hooks into */
  slots: ExtensionSlot[];
  /** Contributor attribution displayed in UI and Settings */
  contributor: ContributorMeta;
  /** Optional dashboard toolbar / drawer widget */
  DashboardWidget?: React.ComponentType<ExtensionContext>;
  /** Optional badge or action rendered on individual PlantCards */
  PlantCardBadge?: React.ComponentType<{
    planting: PlantingWithPlant;
    activeLocation?: GardenLocation;
  }>;
  /** Optional pure function to refine local viability scores */
  modifyViability?: (
    current: Viability,
    plant: Plant,
    conditions: Conditions
  ) => { viability: Viability; note?: string } | null;
}

import { surplusSeedSwapExtension } from './surplus-seed-swap';
import { companionGuildExtension } from './companion-guild';

/**
 * Central zero-conflict registry for crowd-developed extensions.
 * Contributors add their folder under `src/extensions/<id>/index.tsx` and register it here.
 */
export const registeredExtensions: GrowExtension[] = [
  surplusSeedSwapExtension,
  companionGuildExtension,
];

export function getExtensionsBySlot(slot: ExtensionSlot): GrowExtension[] {
  return registeredExtensions.filter((ext) => ext.slots.includes(slot));
}
