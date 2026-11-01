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
import { browserMcpBridgeExtension } from './browser-mcp-bridge';
import { usageStatsInfoExtension } from './usage-stats-info';

/**
 * Central zero-conflict registry for crowd-developed extensions.
 * Contributors add their folder under `src/extensions/<id>/index.tsx` and register it here.
 */
export const registeredExtensions: GrowExtension[] = [
  surplusSeedSwapExtension,
  companionGuildExtension,
  browserMcpBridgeExtension,
  usageStatsInfoExtension,
];

export const DISABLED_EXTENSIONS_KEY = 'grow_disabled_extensions';
export const EXTENSIONS_CHANGED_EVENT = 'grow-extensions-changed';

export function getDisabledExtensionIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DISABLED_EXTENSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function isExtensionEnabled(id: string): boolean {
  return !getDisabledExtensionIds().includes(id);
}

export function setExtensionEnabled(id: string, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const currentDisabled = new Set(getDisabledExtensionIds());
    if (enabled) {
      currentDisabled.delete(id);
    } else {
      currentDisabled.add(id);
    }
    const nextDisabled = Array.from(currentDisabled);
    window.localStorage.setItem(DISABLED_EXTENSIONS_KEY, JSON.stringify(nextDisabled));
    window.dispatchEvent(
      new CustomEvent(EXTENSIONS_CHANGED_EVENT, {
        detail: { id, enabled, disabledIds: nextDisabled },
      })
    );
  } catch (err) {
    console.warn('Failed to persist extension toggle state:', err);
  }
}

export function toggleExtension(id: string): boolean {
  const nextEnabled = !isExtensionEnabled(id);
  setExtensionEnabled(id, nextEnabled);
  return nextEnabled;
}

export function setAllExtensionsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const nextDisabled = enabled ? [] : registeredExtensions.map((ext) => ext.id);
    window.localStorage.setItem(DISABLED_EXTENSIONS_KEY, JSON.stringify(nextDisabled));
    window.dispatchEvent(
      new CustomEvent(EXTENSIONS_CHANGED_EVENT, {
        detail: { enabled, disabledIds: nextDisabled },
      })
    );
  } catch (err) {
    console.warn('Failed to persist all-extensions state:', err);
  }
}

export function getExtensionsBySlot(
  slot: ExtensionSlot,
  includeDisabled = false
): GrowExtension[] {
  const disabledIds = includeDisabled ? [] : getDisabledExtensionIds();
  return registeredExtensions.filter(
    (ext) => ext.slots.includes(slot) && !disabledIds.includes(ext.id)
  );
}
