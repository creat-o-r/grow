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
  targetGardenId?: string;
  targetGardenName?: string;
  alreadyInOtherGarden?: string;
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
  targetGardenId?: string;
  targetGardenName?: string;
}

export interface DiscrepancyItemIdentical {
  type: 'identical';
  localPlantingId: string;
  plantName: string;
  species: string;
  stage: string;
  targetGardenId?: string;
  targetGardenName?: string;
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
  matchedGardenCount?: number;
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

export interface DiscrepancyOptions {
  targetGardenId?: string | null;
  allLocalPlantings?: PlantingWithPlant[];
  allLocalLocations?: GardenLocation[];
  peerPubkey?: string;
}

/**
 * Computes the exact discrepancy between local garden plantings
 * and an incoming peer dataset snapshot with full cross-garden awareness:
 * - Never suggests existing plants as new imports
 * - Matches plantings by ID, plantId, species UID, and normalized name
 * - Preserves garden boundaries across multi-garden setups
 */
export function computeGardenDiscrepancy(
  localPlantings: PlantingWithPlant[],
  incomingDataset: AiDataset,
  peerHandle: string,
  peerPubkeyOrOptions?: string | DiscrepancyOptions
): GardenDiscrepancy {
  const options: DiscrepancyOptions =
    typeof peerPubkeyOrOptions === 'object' && peerPubkeyOrOptions !== null
      ? peerPubkeyOrOptions
      : { peerPubkey: peerPubkeyOrOptions };

  const targetGardenId = options.targetGardenId || null;
  const allLocalPlantings = options.allLocalPlantings || localPlantings || [];
  const allLocalLocations = options.allLocalLocations || [];

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

  // Index incoming locations by ID
  const incomingLocationMap = new Map<string, GardenLocation>();
  for (const loc of incomingDataset.locations || []) {
    incomingLocationMap.set(loc.id, loc);
  }

  // Index local locations by ID
  const localLocationById = new Map<string, GardenLocation>();
  for (const loc of allLocalLocations) {
    localLocationById.set(loc.id, loc);
  }

  // Identify target local location
  const targetLocation =
    (targetGardenId && localLocationById.get(targetGardenId)) ||
    allLocalLocations[0] ||
    undefined;

  // 1. Build local indexes for active/target garden plantings
  const targetLocalById = new Map<string, PlantingWithPlant>();
  const targetLocalByPlantId = new Map<string, PlantingWithPlant>();
  const targetLocalByUid = new Map<string, PlantingWithPlant>();
  const targetLocalBySpecies = new Map<string, PlantingWithPlant>();
  const targetLocalByName = new Map<string, PlantingWithPlant>();

  for (const p of localPlantings) {
    targetLocalById.set(p.id, p);
    if (p.plantId) targetLocalByPlantId.set(p.plantId, p);
    const uid = p.plant?.uid || toSpeciesUid(p.plant?.species || p.name);
    targetLocalByUid.set(uid, p);
    if (p.plant?.species) {
      targetLocalBySpecies.set(p.plant.species.trim().toLowerCase(), p);
    }
    targetLocalByName.set(p.name.trim().toLowerCase(), p);
  }

  // 2. Build comprehensive cross-garden indexes across ALL gardens
  const crossGardenById = new Map<string, { planting: PlantingWithPlant; gardenName: string }>();
  const crossGardenByPlantId = new Map<string, { planting: PlantingWithPlant; gardenName: string }>();
  const crossGardenByUid = new Map<string, { planting: PlantingWithPlant; gardenName: string }>();
  const crossGardenBySpecies = new Map<string, { planting: PlantingWithPlant; gardenName: string }>();
  const crossGardenByName = new Map<string, { planting: PlantingWithPlant; gardenName: string }>();

  // Index by (gardenId + key)
  const crossGardenByGardenAndId = new Map<string, PlantingWithPlant>();
  const crossGardenByGardenAndPlantId = new Map<string, PlantingWithPlant>();
  const crossGardenByGardenAndUid = new Map<string, PlantingWithPlant>();
  const crossGardenByGardenAndName = new Map<string, PlantingWithPlant>();

  for (const p of allLocalPlantings) {
    const loc = localLocationById.get(p.gardenId);
    const gName = loc?.name || 'Another Garden';
    crossGardenById.set(p.id, { planting: p, gardenName: gName });
    if (p.plantId) {
      crossGardenByPlantId.set(p.plantId, { planting: p, gardenName: gName });
    }
    const uid = p.plant?.uid || toSpeciesUid(p.plant?.species || p.name);
    crossGardenByUid.set(uid, { planting: p, gardenName: gName });
    if (p.plant?.species) {
      crossGardenBySpecies.set(p.plant.species.trim().toLowerCase(), { planting: p, gardenName: gName });
    }
    crossGardenByName.set(p.name.trim().toLowerCase(), { planting: p, gardenName: gName });

    const gKey = p.gardenId || 'default';
    crossGardenByGardenAndId.set(`${gKey}::${p.id}`, p);
    if (p.plantId) {
      crossGardenByGardenAndPlantId.set(`${gKey}::${p.plantId}`, p);
    }
    crossGardenByGardenAndUid.set(`${gKey}::${uid}`, p);
    crossGardenByGardenAndName.set(`${gKey}::${p.name.trim().toLowerCase()}`, p);
    if (p.plant?.species) {
      crossGardenByGardenAndName.set(`${gKey}::${p.plant.species.trim().toLowerCase()}`, p);
    }
  }

  let matchedGardenCount = 0;
  const matchedGardens = new Set<string>();

  for (const incPlanting of incomingPlantings) {
    const incPlant = incomingPlantMap.get(incPlanting.plantId);
    const incSpecies = incPlant?.species || incPlanting.name;
    const incUid = incPlant?.uid || toSpeciesUid(incSpecies);
    const incNormSpecies = incSpecies.trim().toLowerCase();
    const incNormName = incPlanting.name.trim().toLowerCase();
    const incStage = incPlanting.history?.slice(-1)[0]?.status || 'Wishlist';

    // 1. Determine incoming location
    const incLoc =
      (incPlanting.gardenId && incomingLocationMap.get(incPlanting.gardenId)) ||
      incomingDataset.locations?.[0];

    // Find if a local garden corresponds to incLoc
    let matchedLocalLocation: GardenLocation | undefined;
    if (incLoc && allLocalLocations.length > 0) {
      matchedLocalLocation = allLocalLocations.find(
        (l) =>
          l.id === incLoc.id ||
          (l.uid && incLoc.uid && l.uid === incLoc.uid) ||
          l.name.trim().toLowerCase() === incLoc.name.trim().toLowerCase()
      );
    }

    if (matchedLocalLocation) {
      matchedGardens.add(matchedLocalLocation.id);
    }

    // 2. Cross-garden preservation: Check if this planting belongs to a different local garden
    const belongsToDifferentGarden =
      targetGardenId &&
      matchedLocalLocation &&
      matchedLocalLocation.id !== targetGardenId;

    if (belongsToDifferentGarden && matchedLocalLocation) {
      // This planting belongs to another garden (e.g. "Balcony")!
      // Check if it already exists in that specific garden:
      const otherGardenPlanting =
        crossGardenByGardenAndId.get(`${matchedLocalLocation.id}::${incPlanting.id}`) ||
        (incPlanting.plantId ? crossGardenByGardenAndPlantId.get(`${matchedLocalLocation.id}::${incPlanting.plantId}`) : undefined) ||
        crossGardenByGardenAndUid.get(`${matchedLocalLocation.id}::${incUid}`) ||
        crossGardenByGardenAndName.get(`${matchedLocalLocation.id}::${incNormName}`) ||
        crossGardenByGardenAndName.get(`${matchedLocalLocation.id}::${incNormSpecies}`);

      if (otherGardenPlanting) {
        // It ALREADY EXISTS in its rightful other garden: NEVER suggest as new plant!
        const localStage = otherGardenPlanting.history?.slice(-1)[0]?.status || 'Wishlist';
        const stageChanged = localStage !== incStage;
        const localSeeds = otherGardenPlanting.seedsOnHand ?? 0;
        const incSeeds = incPlanting.seedsOnHand ?? 0;
        const seedsChanged = localSeeds !== incSeeds && incPlanting.seedsOnHand !== undefined;

        if (stageChanged || seedsChanged) {
          updatedItems.push({
            type: 'updated',
            localPlantingId: otherGardenPlanting.id,
            incomingPlantingId: incPlanting.id,
            plantName: otherGardenPlanting.name,
            species: incSpecies,
            localStage,
            incomingStage: incStage,
            stageChanged,
            localSeedsOnHand: localSeeds,
            incomingSeedsOnHand: incSeeds,
            seedsChanged,
            incomingNotes: incPlanting.history?.slice(-1)[0]?.notes,
            targetGardenId: matchedLocalLocation.id,
            targetGardenName: matchedLocalLocation.name,
          });
        } else {
          identicalItems.push({
            type: 'identical',
            localPlantingId: otherGardenPlanting.id,
            plantName: otherGardenPlanting.name,
            species: incSpecies,
            stage: localStage,
            targetGardenId: matchedLocalLocation.id,
            targetGardenName: matchedLocalLocation.name,
          });
        }
        continue;
      }
    }

    // 3. Check for match in active/target garden
    const localMatch =
      targetLocalById.get(incPlanting.id) ||
      (incPlanting.plantId ? targetLocalByPlantId.get(incPlanting.plantId) : undefined) ||
      targetLocalByUid.get(incUid) ||
      targetLocalBySpecies.get(incNormSpecies) ||
      targetLocalByName.get(incNormName);

    if (localMatch) {
      // Plant ALREADY EXISTS in the target garden: NEVER suggest as new!
      const localStage = localMatch.history?.slice(-1)[0]?.status || 'Wishlist';
      const stageChanged = localStage !== incStage;
      const localSeeds = localMatch.seedsOnHand ?? 0;
      const incSeeds = incPlanting.seedsOnHand ?? 0;
      const seedsChanged = localSeeds !== incSeeds && incPlanting.seedsOnHand !== undefined;
      const incomingNotes = incPlanting.history?.slice(-1)[0]?.notes;

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
          targetGardenId: targetGardenId || localMatch.gardenId,
          targetGardenName: targetLocation?.name,
        });
      } else {
        identicalItems.push({
          type: 'identical',
          localPlantingId: localMatch.id,
          plantName: localMatch.name,
          species: incSpecies,
          stage: localStage,
          targetGardenId: targetGardenId || localMatch.gardenId,
          targetGardenName: targetLocation?.name,
        });
      }
      continue;
    }

    // 4. Plant was NOT found in target garden.
    // Check if it already exists in ANY OTHER local garden:
    const existingInAnyOtherGarden =
      crossGardenById.get(incPlanting.id) ||
      (incPlanting.plantId ? crossGardenByPlantId.get(incPlanting.plantId) : undefined) ||
      crossGardenByUid.get(incUid) ||
      crossGardenBySpecies.get(incNormSpecies) ||
      crossGardenByName.get(incNormName);

    const effectiveTargetGardenId =
      (matchedLocalLocation && matchedLocalLocation.id) ||
      targetGardenId ||
      allLocalLocations[0]?.id;

    const effectiveTargetGardenName =
      (matchedLocalLocation && matchedLocalLocation.name) ||
      targetLocation?.name ||
      incomingGardenName;

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
      targetGardenId: effectiveTargetGardenId,
      targetGardenName: effectiveTargetGardenName,
      alreadyInOtherGarden: existingInAnyOtherGarden?.gardenName,
    });
  }

  matchedGardenCount = matchedGardens.size;
  const hasDiscrepancies = newItems.length > 0 || updatedItems.length > 0;
  let summaryText = 'All plants in sync across gardens';
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
    matchedGardenCount,
  };
}

/**
 * Applies discrepancies into the database for a target garden:
 * - Appends new plants/plantings with STRICT pre-add duplicate verification
 * - Updates stage history & seed counts for modified plants non-destructively
 * - Preserves user garden data and records sync event
 */
export async function applyGardenDiscrepancies(
  discrepancy: GardenDiscrepancy,
  incomingDataset: AiDataset,
  defaultTargetGardenId: string
): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;

  const incomingPlants = incomingDataset.plants || [];
  const incomingPlantings = incomingDataset.plantings || [];
  const plantMap = new Map<string, Plant>();
  for (const p of incomingPlants) {
    plantMap.set(p.id, p);
  }

  // 1. Process new plants (guaranteed idempotent with strict pre-add duplicate verification)
  for (const item of discrepancy.newItems) {
    const incPlant = plantMap.get(item.incomingPlantId);
    const incPlanting = incomingPlantings.find(
      (p) => p.id === item.incomingPlantingId
    );
    if (!incPlanting) continue;

    const targetGardenId = item.targetGardenId || defaultTargetGardenId;
    if (!targetGardenId) continue;

    // Strict duplicate check against target garden before adding:
    const existingInTarget = await db.plantings
      .where('gardenId')
      .equals(targetGardenId)
      .toArray();

    const existingPlants = await db.plants.toArray();
    const existingPlantMap = new Map(existingPlants.map((p) => [p.id, p]));
    const incUid = incPlant?.uid || toSpeciesUid(item.species);
    const incNormSpecies = item.species.trim().toLowerCase();
    const incNormName = (item.cultivarName || item.species).trim().toLowerCase();

    const alreadyExists = existingInTarget.find((p) => {
      if (p.id === incPlanting.id) return true;
      if (p.plantId && incPlanting.plantId && p.plantId === incPlanting.plantId) return true;
      const plant = existingPlantMap.get(p.plantId);
      const plantSpecies = plant?.species?.toLowerCase().trim();
      if (plantSpecies && plantSpecies === incNormSpecies) return true;
      if (p.name.toLowerCase().trim() === incNormName) return true;
      if (toSpeciesUid(plant?.species || p.name) === incUid) return true;
      return false;
    });

    if (alreadyExists) {
      // Existing plant detected in target garden! DO NOT INSERT A DUPLICATE!
      // Update stage if newer:
      const localStage = alreadyExists.history?.slice(-1)[0]?.status || 'Wishlist';
      if (localStage !== item.stage) {
        const newHist = [
          ...(alreadyExists.history || []),
          {
            id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            status: (item.stage as any) || 'Wishlist',
            date: new Date().toISOString(),
            notes: `Stage updated from ${discrepancy.peerHandle}`,
          },
        ];
        await db.plantings.update(alreadyExists.id, { history: newHist });
        updated++;
      }
      continue;
    }

    // Resolve or add to global db.plants
    let targetPlantId = `plant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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
        uid: incUid,
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
    await db.locations.update(defaultTargetGardenId, {
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
