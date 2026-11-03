'use client';

import type {
  AiDataset,
  PlantingWithPlant,
  GardenLocation,
  StatusHistory,
  Plant,
  Planting,
} from '@/lib/types';
import { toSpeciesUid } from '@/lib/seed-pack';
import { fingerprintDataset, getOrCreateGrowerIdentity, parseGrowerAddress } from '@/lib/p2p-signals';
import { db } from '@/lib/db';

export interface DiscrepancyItemNew {
  type: 'new';
  incomingPlantingId: string;
  incomingPlantId: string;
  species: string;
  cultivarName: string;
  stage: string;
  seedsOnHand?: number;
  optimalConditions?: string;
  imageUrl?: string;
}

export interface DiscrepancyItemUpdated {
  type: 'updated';
  localPlantingId: string;
  incomingPlantingId: string;
  plantName: string;
  species: string;
  localStage: string;
  incomingStage: string;
  stageChanged: boolean;
  localSeedsOnHand?: number;
  incomingSeedsOnHand?: number;
  seedsChanged: boolean;
  incomingNotes?: string;
}

export interface DiscrepancyItemIdentical {
  type: 'identical';
  localPlantingId: string;
  plantName: string;
  species: string;
  stage: string;
}

export interface GardenDiscrepancy {
  incomingGardenName: string;
  peerHandle: string;
  timestamp: string;
  fingerprint: string;
  newItems: DiscrepancyItemNew[];
  updatedItems: DiscrepancyItemUpdated[];
  identicalItems: DiscrepancyItemIdentical[];
  totalIncoming: number;
  hasDiscrepancies: boolean;
  summaryText: string;
}

export interface SyncActivityEvent {
  id: string;
  timestamp: string;
  direction: 'inward' | 'outward';
  peerHandle: string;
  gardenName: string;
  summary: string;
  addedCount: number;
  updatedCount: number;
  status: 'merged' | 'reviewed' | 'broadcast';
}

const SYNC_ACTIVITY_KEY = 'grow_sync_activity_log_v2';

export function getSyncActivityLog(): SyncActivityEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SYNC_ACTIVITY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordSyncActivity(event: Omit<SyncActivityEvent, 'id' | 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getSyncActivityLog();
    const newEntry: SyncActivityEvent = {
      ...event,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    const updated = [newEntry, ...current].slice(0, 30);
    localStorage.setItem(SYNC_ACTIVITY_KEY, JSON.stringify(updated));
  } catch {
    // ignore quota errors
  }
}

/**
 * Computes the exact discrepancy between a local garden's plantings
 * and an incoming peer dataset snapshot.
 */
export function computeGardenDiscrepancy(
  localPlantings: PlantingWithPlant[],
  incomingDataset: AiDataset,
  peerHandle: string,
  peerPubkey?: string
): GardenDiscrepancy {
  const newItems: DiscrepancyItemNew[] = [];
  const updatedItems: DiscrepancyItemUpdated[] = [];
  const identicalItems: DiscrepancyItemIdentical[] = [];

  const incomingPlants = incomingDataset.plants || [];
  const incomingPlantings = incomingDataset.plantings || [];
  const incomingGardenName =
    incomingDataset.locations?.[0]?.name || 'Shared Garden';
  const fingerprint = fingerprintDataset(incomingDataset);

  // Index incoming plants by ID
  const incomingPlantMap = new Map<string, Plant>();
  for (const plant of incomingPlants) {
    incomingPlantMap.set(plant.id, plant);
  }

  // Map local plantings by species UID and name for robust deduplication
  const localPlantingByUid = new Map<string, PlantingWithPlant>();
  for (const p of localPlantings) {
    const uid = p.plant?.uid || toSpeciesUid(p.plant?.species || p.name);
    localPlantingByUid.set(uid, p);
    localPlantingByUid.set(p.name.trim().toLowerCase(), p);
  }

  for (const incPlanting of incomingPlantings) {
    const incPlant = incomingPlantMap.get(incPlanting.plantId);
    const incSpecies = incPlant?.species || incPlanting.name;
    const incUid = incPlant?.uid || toSpeciesUid(incSpecies);
    const incStage =
      incPlanting.history?.slice(-1)[0]?.status || 'Wishlist';

    // Find local match
    const localMatch =
      localPlantingByUid.get(incUid) ||
      localPlantingByUid.get(incPlanting.name.trim().toLowerCase());

    if (!localMatch) {
      // New plant to add
      newItems.push({
        type: 'new',
        incomingPlantingId: incPlanting.id,
        incomingPlantId: incPlanting.plantId,
        species: incSpecies,
        cultivarName: incPlanting.name,
        stage: incStage,
        seedsOnHand: incPlanting.seedsOnHand,
        optimalConditions: incPlant?.optimalConditions,
        imageUrl: incPlant?.imageUrl,
      });
    } else {
      // Match found - check for stage, seeds, or notes discrepancy
      const localStage =
        localMatch.history?.slice(-1)[0]?.status || 'Wishlist';
      const stageChanged = localStage !== incStage;
      const localSeeds = localMatch.seedsOnHand ?? 0;
      const incSeeds = incPlanting.seedsOnHand ?? 0;
      const seedsChanged = localSeeds !== incSeeds && incPlanting.seedsOnHand !== undefined;

      const incLastHistory = incPlanting.history?.slice(-1)[0];
      const incomingNotes = incLastHistory?.notes;

      if (stageChanged || seedsChanged) {
        updatedItems.push({
          type: 'updated',
          localPlantingId: localMatch.id,
          incomingPlantingId: incPlanting.id,
          plantName: localMatch.name,
          species: incSpecies,
          localStage,
          incomingStage: incStage,
          stageChanged,
          localSeedsOnHand: localSeeds,
          incomingSeedsOnHand: incSeeds,
          seedsChanged,
          incomingNotes,
        });
      } else {
        identicalItems.push({
          type: 'identical',
          localPlantingId: localMatch.id,
          plantName: localMatch.name,
          species: incSpecies,
          stage: localStage,
        });
      }
    }
  }

  const hasDiscrepancies = newItems.length > 0 || updatedItems.length > 0;
  let summaryText = 'All plants in sync';
  if (newItems.length > 0 && updatedItems.length > 0) {
    summaryText = `+${newItems.length} new, ~${updatedItems.length} updated`;
  } else if (newItems.length > 0) {
    summaryText = `+${newItems.length} new plant${newItems.length === 1 ? '' : 's'}`;
  } else if (updatedItems.length > 0) {
    summaryText = `~${updatedItems.length} stage update${updatedItems.length === 1 ? '' : 's'}`;
  }

  const parsedPeer = parseGrowerAddress(peerHandle);
  const myIdentity = getOrCreateGrowerIdentity();
  const isFromMyOtherDevice =
    myIdentity.isClaimed &&
    parsedPeer.rootHandle.toLowerCase() === myIdentity.rootHandle.toLowerCase();

  const formattedPeer = peerHandle.startsWith('@') ? peerHandle : `@${peerHandle}`;
  const prefix = isFromMyOtherDevice ? `Device Mirror (${formattedPeer}): ` : `${formattedPeer}: `;
  const fullSummary = hasDiscrepancies ? `${prefix}${summaryText}` : `${prefix}Garden is up to date`;

  return {
    incomingGardenName,
    peerHandle: formattedPeer,
    timestamp: new Date().toISOString(),
    fingerprint,
    newItems,
    updatedItems,
    identicalItems,
    totalIncoming: incomingPlantings.length,
    hasDiscrepancies,
    summaryText: fullSummary,
  };
}

/**
 * Applies discrepancies into the database for a target garden:
 * - Appends new plants/plantings
 * - Updates stage history & seed counts for modified plants non-destructively
 * - Preserves user garden data and records sync event
 */
export async function applyGardenDiscrepancies(
  discrepancy: GardenDiscrepancy,
  incomingDataset: AiDataset,
  targetGardenId: string
): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;

  const incomingPlants = incomingDataset.plants || [];
  const incomingPlantings = incomingDataset.plantings || [];
  const plantMap = new Map<string, Plant>();
  for (const p of incomingPlants) {
    plantMap.set(p.id, p);
  }

  // 1. Process new plants
  for (const item of discrepancy.newItems) {
    const incPlant = plantMap.get(item.incomingPlantId);
    const incPlanting = incomingPlantings.find(
      (p) => p.id === item.incomingPlantingId
    );
    if (!incPlanting) continue;

    const uid = incPlant?.uid || toSpeciesUid(item.species);
    let targetPlantId = `plant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Check if species already exists globally in db.plants
    const existingPlant = await db.plants
      .where('species')
      .equalsIgnoreCase(item.species)
      .first();

    if (existingPlant) {
      targetPlantId = existingPlant.id;
    } else {
      const newPlant: Plant = {
        id: targetPlantId,
        species: item.species,
        uid,
        optimalConditions: item.optimalConditions || incPlant?.optimalConditions || '',
        germinationNeeds: incPlant?.germinationNeeds || '',
        imageUrl: item.imageUrl || incPlant?.imageUrl,
      };
      await db.plants.add(newPlant);
    }

    const newPlantingId = `planting-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newPlanting: Planting = {
      ...incPlanting,
      id: newPlantingId,
      plantId: targetPlantId,
      gardenId: targetGardenId,
      name: item.cultivarName || item.species,
      seedsOnHand: item.seedsOnHand ?? 0,
      createdAt: new Date().toISOString(),
      history: incPlanting.history || [
        {
          id: `hist-${Date.now()}`,
          status: (item.stage as any) || 'Wishlist',
          date: new Date().toISOString(),
          notes: `Added via P2P Sync from ${discrepancy.peerHandle}`,
        },
      ],
    };

    await db.plantings.add(newPlanting);
    added++;
  }

  // 2. Process updated plantings (append new history transition non-destructively)
  for (const item of discrepancy.updatedItems) {
    const localPlanting = await db.plantings.get(item.localPlantingId);
    if (!localPlanting) continue;

    const currentHistory = localPlanting.history || [];
    const updates: Partial<Planting> = {};

    if (item.stageChanged) {
      const newHistoryEntry: StatusHistory = {
        id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        status: (item.incomingStage as any) || 'Growing',
        date: new Date().toISOString(),
        notes: item.incomingNotes
          ? `Synced from ${discrepancy.peerHandle}: ${item.incomingNotes}`
          : `Stage synced from ${discrepancy.peerHandle} (${item.localStage} -> ${item.incomingStage})`,
      };
      updates.history = [...currentHistory, newHistoryEntry];
    }

    if (item.seedsChanged && item.incomingSeedsOnHand !== undefined) {
      updates.seedsOnHand = item.incomingSeedsOnHand;
    }

    if (Object.keys(updates).length > 0) {
      await db.plantings.update(item.localPlantingId, updates);
      updated++;
    }
  }

  // Update target garden's lastSyncedAt timestamp
  try {
    await db.locations.update(targetGardenId, {
      lastSyncedAt: new Date().toISOString(),
    });
  } catch {
    // ignore
  }

  // Log activity
  recordSyncActivity({
    direction: 'inward',
    peerHandle: discrepancy.peerHandle,
    gardenName: discrepancy.incomingGardenName,
    summary: discrepancy.summaryText,
    addedCount: added,
    updatedCount: updated,
    status: 'merged',
  });

  return { added, updated };
}
