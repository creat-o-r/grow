import { db } from '@/lib/db';
import type {
  AiDataset,
  ForkProvenance,
  GardenLocation,
  Plant,
  Planting,
  PlantingWithPlant,
} from '@/lib/types';

export type GardenImportMode = 'add' | 'new' | 'replace';

export type DuplicateResolutionItem = {
  newPlanting: Planting;
  newPlant: Plant;
  existingPlanting: PlantingWithPlant;
  action: 'merge' | 'add' | 'skip';
};

/**
 * Generates a deterministic, URL-safe slug UID for a plant species/cultivar
 * so independent local instances and P2P peers can deduplicate and merge cleanly.
 */
export function toSpeciesUid(species: string): string {
  return species
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Encodes an AiDataset into a compact URL-safe base64 string for 1-click `?pack=` sharing.
 */
export function encodeSeedPackToParam(dataset: AiDataset): string {
  const payload = JSON.stringify(dataset);
  if (typeof window !== 'undefined') {
    const bytes = new TextEncoder().encode(payload);
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return Buffer.from(payload, 'utf-8').toString('base64url');
}

/**
 * Decodes a `?pack=` URL parameter or raw JSON string back into a validated AiDataset.
 */
export function decodeSeedPackFromInput(input: string): AiDataset {
  const trimmed = input.trim();

  // 1. Direct JSON object
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    validateDatasetShape(parsed);
    return parsed;
  }

  // 2. Full URL containing ?pack=...
  let encoded = trimmed;
  if (trimmed.includes('pack=')) {
    try {
      const url = new URL(trimmed);
      encoded = url.searchParams.get('pack') || trimmed;
    } catch {
      const match = trimmed.match(/[?&]pack=([^&#]+)/);
      if (match?.[1]) encoded = match[1];
    }
  }

  // 3. Base64url decode
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '==='.slice((base64.length + 3) % 4);
  let jsonStr: string;
  if (typeof window !== 'undefined') {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    jsonStr = new TextDecoder().decode(bytes);
  } else {
    jsonStr = Buffer.from(padded, 'base64').toString('utf-8');
  }

  const parsed = JSON.parse(jsonStr);
  validateDatasetShape(parsed);
  return parsed;
}

function validateDatasetShape(data: any): asserts data is AiDataset {
  if (
    !data ||
    !Array.isArray(data.plants) ||
    !Array.isArray(data.plantings) ||
    !Array.isArray(data.locations)
  ) {
    throw new Error(
      'Invalid Seed Pack format: expected plants, plantings, and locations arrays.'
    );
  }
}

export interface MergePackResult {
  mode: GardenImportMode;
  targetGardenId: string;
  targetGardenName: string;
  addedPlants: number;
  mergedPlants: number;
  addedPlantings: number;
  addedLocations: number;
  duplicatesDetected: number;
}

/**
 * Detects duplicate plantings between an incoming dataset and the active garden's existing plantings.
 */
export function detectDatasetDuplicates(
  incoming: AiDataset,
  existingPlantingsInGarden: PlantingWithPlant[]
): DuplicateResolutionItem[] {
  const plantMap = new Map(incoming.plants.map((p) => [p.id, p]));
  const detected: DuplicateResolutionItem[] = [];

  for (const p of incoming.plantings) {
    const plant = plantMap.get(p.plantId);
    if (!plant) continue;

    const incomingUid = plant.uid || toSpeciesUid(plant.species);
    const match = existingPlantingsInGarden.find((ep) => {
      const existingUid = ep.plant?.uid || toSpeciesUid(ep.plant?.species || '');
      return (
        (existingUid && incomingUid && existingUid === incomingUid) ||
        (ep.name && p.name && ep.name.toLowerCase().trim() === p.name.toLowerCase().trim())
      );
    });

    if (match) {
      detected.push({
        newPlanting: p,
        newPlant: plant,
        existingPlanting: match,
        action: 'merge',
      });
    }
  }

  return detected;
}

/**
 * Executes a garden dataset import supporting all 3 Garden Import Modes:
 * - `'add'`: Adds plants into the user's currently active garden (`targetGardenId`), applying duplicate resolutions (`merge` | `add` | `skip`).
 * - `'new'`: Creates a brand-new garden from `incoming.locations[0]` without affecting existing gardens, and returns its new `targetGardenId` so the UI switches to it.
 * - `'replace'`: Replaces all existing gardens, plants, and plantings with the incoming dataset.
 */
export async function mergeSeedPackIntoDb(
  incoming: AiDataset,
  options?: {
    mode?: GardenImportMode;
    targetGardenId?: string | null;
    resolutions?: DuplicateResolutionItem[];
    author?: string;
    datasetKey?: string;
    instanceUrl?: string;
  }
): Promise<MergePackResult> {
  const provenance: ForkProvenance = {
    author:
      options?.author ||
      incoming.contributor?.name ||
      incoming.forkedFrom?.author ||
      'Community Peer',
    datasetKey: options?.datasetKey || incoming.forkedFrom?.datasetKey,
    instanceUrl:
      options?.instanceUrl ||
      incoming.forkedFrom?.instanceUrl ||
      (typeof window !== 'undefined' ? window.location.origin : undefined),
    timestamp: new Date().toISOString(),
  };

  let addedPlants = 0;
  let mergedPlants = 0;
  let addedPlantings = 0;
  let addedLocations = 0;
  let duplicatesDetected = 0;
  let finalTargetGardenId = options?.targetGardenId || '';
  let finalTargetGardenName = '';

  const resolutionMap = new Map<string, DuplicateResolutionItem>();
  options?.resolutions?.forEach((r) => resolutionMap.set(r.newPlanting.id, r));

  await db.transaction('rw', db.plants, db.plantings, db.locations, async () => {
    const existingLocations = await db.locations.toArray();
    const existingPlants = await db.plants.toArray();

    // Determine effective mode:
    // If mode is 'add' and an active garden exists, add directly into that active garden!
    // If no gardens exist yet, 'add' automatically promotes to 'new'.
    const requestedMode: GardenImportMode = options?.mode || 'add';
    const activeLoc =
      (options?.targetGardenId &&
        existingLocations.find((l) => l.id === options.targetGardenId)) ||
      existingLocations[0];

    const effectiveMode: GardenImportMode =
      requestedMode === 'add' && !activeLoc ? 'new' : requestedMode;

    if (effectiveMode === 'replace') {
      await db.plants.clear();
      await db.plantings.clear();
      await db.locations.clear();

      const now = Date.now();
      const locToUse: GardenLocation = incoming.locations?.[0]
        ? {
            ...incoming.locations[0],
            uid:
              incoming.locations[0].uid ||
              toSpeciesUid(`${incoming.locations[0].name}-${incoming.locations[0].location}`),
            forkedFrom: incoming.locations[0].forkedFrom || provenance,
          }
        : {
            id: `garden-${now}`,
            name: 'Imported Garden',
            location: '',
            temperatureUnit: 'C',
            conditions: { temperature: '', sunlight: '', soil: '', currentSeason: 'Spring' },
            forkedFrom: provenance,
          };

      await db.locations.add(locToUse);
      finalTargetGardenId = locToUse.id;
      finalTargetGardenName = locToUse.name;
      addedLocations = 1;

      const plantsWithMeta = incoming.plants.map((p) => ({
        ...p,
        uid: p.uid || toSpeciesUid(p.species),
        forkedFrom: p.forkedFrom || provenance,
        contributor: p.contributor || incoming.contributor,
      }));
      await db.plants.bulkAdd(plantsWithMeta);
      addedPlants = plantsWithMeta.length;

      const plantingsWithGarden = incoming.plantings.map((pl) => ({
        ...pl,
        gardenId: locToUse.id,
        forkedFrom: pl.forkedFrom || provenance,
      }));
      await db.plantings.bulkAdd(plantingsWithGarden);
      addedPlantings = plantingsWithGarden.length;
      return;
    }

    if (effectiveMode === 'new') {
      const now = Date.now();
      const idSuffix = `-${now}-${Math.random().toString(36).slice(2, 6)}`;
      const newGardenId = `garden${idSuffix}`;
      const baseLoc = incoming.locations?.[0];
      const newLocation: GardenLocation = {
        id: newGardenId,
        uid: toSpeciesUid(`${baseLoc?.name || 'New Garden'}-${baseLoc?.location || ''}`),
        name: baseLoc?.name || 'Imported Community Garden',
        location: baseLoc?.location || '',
        temperatureUnit: baseLoc?.temperatureUnit || 'C',
        conditions: baseLoc?.conditions || {
          temperature: '',
          sunlight: '',
          soil: '',
          currentSeason: 'Spring',
        },
        growingSystems: baseLoc?.growingSystems,
        growingMethods: baseLoc?.growingMethods,
        forkedFrom: baseLoc?.forkedFrom || provenance,
      };

      await db.locations.add(newLocation);
      finalTargetGardenId = newGardenId;
      finalTargetGardenName = newLocation.name;
      addedLocations = 1;

      const plantIdMap = new Map<string, string>();
      for (const incomingPlant of incoming.plants) {
        const incomingUid = incomingPlant.uid || toSpeciesUid(incomingPlant.species);
        const existingMatch = existingPlants.find(
          (ep) => (ep.uid || toSpeciesUid(ep.species)) === incomingUid
        );
        if (existingMatch) {
          plantIdMap.set(incomingPlant.id, existingMatch.id);
          mergedPlants++;
        } else {
          const newPlantId = `plant${idSuffix}-${addedPlants}`;
          const newPlant: Plant = {
            ...incomingPlant,
            id: newPlantId,
            uid: incomingUid,
            forkedFrom: incomingPlant.forkedFrom || provenance,
            contributor: incomingPlant.contributor || incoming.contributor,
          };
          await db.plants.add(newPlant);
          existingPlants.push(newPlant);
          plantIdMap.set(incomingPlant.id, newPlantId);
          addedPlants++;
        }
      }

      for (const incomingPlanting of incoming.plantings) {
        const mappedPlantId =
          plantIdMap.get(incomingPlanting.plantId) || incomingPlanting.plantId;
        const newPlanting: Planting = {
          ...incomingPlanting,
          id: `planting${idSuffix}-${addedPlantings}`,
          plantId: mappedPlantId,
          gardenId: newGardenId,
          forkedFrom: incomingPlanting.forkedFrom || provenance,
        };
        await db.plantings.add(newPlanting);
        addedPlantings++;
      }
      return;
    }

    // Mode === 'add': Add plants directly into the active garden (`activeLoc`)
    finalTargetGardenId = activeLoc.id;
    finalTargetGardenName = activeLoc.name;

    const existingPlantings = await db.plantings
      .where('gardenId')
      .equals(activeLoc.id)
      .toArray();

    const plantIdMap = new Map<string, string>();

    for (const incomingPlant of incoming.plants) {
      const incomingUid = incomingPlant.uid || toSpeciesUid(incomingPlant.species);
      const existingMatch = existingPlants.find(
        (ep) => (ep.uid || toSpeciesUid(ep.species)) === incomingUid
      );

      if (existingMatch) {
        plantIdMap.set(incomingPlant.id, existingMatch.id);
        if (incomingPlant.verifiedGrowerCount && !existingMatch.verifiedGrowerCount) {
          await db.plants.update(existingMatch.id, {
            verifiedGrowerCount: incomingPlant.verifiedGrowerCount,
          });
        }
      } else {
        const newPlantId = `plant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newPlant: Plant = {
          ...incomingPlant,
          id: newPlantId,
          uid: incomingUid,
          forkedFrom: incomingPlant.forkedFrom || provenance,
          contributor: incomingPlant.contributor || incoming.contributor,
        };
        await db.plants.add(newPlant);
        existingPlants.push(newPlant);
        plantIdMap.set(incomingPlant.id, newPlantId);
        addedPlants++;
      }
    }

    for (const incomingPlanting of incoming.plantings) {
      const res = resolutionMap.get(incomingPlanting.id);
      if (res?.action === 'skip') {
        continue;
      }

      const mappedPlantId =
        plantIdMap.get(incomingPlanting.plantId) || incomingPlanting.plantId;

      if (res?.action === 'merge') {
        const existing = res.existingPlanting;
        const updatedHistory = [
          ...(existing.history || []),
          {
            id: `merge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            status: existing.history?.slice(-1)[0]?.status || ('Wishlist' as const),
            date: new Date().toISOString(),
            notes: `Merged cultivar from Seed Pack: "${incomingPlanting.name}" (${res.newPlant.optimalConditions})`,
          },
        ];
        await db.plantings.update(existing.id, {
          history: updatedHistory,
          plannedQty:
            (existing.plannedQty || 0) + (incomingPlanting.plannedQty || 0) ||
            existing.plannedQty,
          seedsOnHand:
            (existing.seedsOnHand || 0) + (incomingPlanting.seedsOnHand || 0) ||
            existing.seedsOnHand,
        });
        mergedPlants++;
        continue;
      }

      // If no explicit resolution was provided, check if an identical species planting already exists in activeLoc
      const existingSameSpeciesPlanting = existingPlantings.find(
        (ep) => ep.plantId === mappedPlantId
      );
      if (existingSameSpeciesPlanting && !res) {
        duplicatesDetected++;
      }

      const newPlantingId = `planting-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newPlanting: Planting = {
        ...incomingPlanting,
        id: newPlantingId,
        plantId: mappedPlantId,
        gardenId: activeLoc.id,
        forkedFrom: incomingPlanting.forkedFrom || provenance,
      };
      await db.plantings.add(newPlanting);
      existingPlantings.push(newPlanting);
      addedPlantings++;
    }
  });

  if (typeof window !== 'undefined' && finalTargetGardenId) {
    localStorage.setItem('grow_activeLocation', finalTargetGardenId);
  }

  return {
    mode: options?.mode || 'add',
    targetGardenId: finalTargetGardenId,
    targetGardenName: finalTargetGardenName,
    addedPlants,
    mergedPlants,
    addedPlantings,
    addedLocations,
    duplicatesDetected,
  };
}

/**
 * Builds a shareable `?pack=` URL for the current browser origin.
 */
export function buildShareableSeedPackUrl(dataset: AiDataset, baseUrl?: string): string {
  const origin =
    baseUrl ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://grow.vercel.app');
  const encoded = encodeSeedPackToParam(dataset);
  return `${origin}/?pack=${encoded}`;
}

/**
 * Builds a 1-click GitHub web PR creation URL so any user can contribute their custom
 * Seed Pack directly into `src/lib/datasets/<slug>.json` without using command-line Git.
 */
export function buildGitHubContributeDatasetUrl(
  dataset: AiDataset,
  packTitle: string,
  repoUrl: string = 'https://github.com/creat-o-r/grow'
): string {
  const slug = toSpeciesUid(packTitle || 'community-pack') || 'community-pack';
  const filename = `src/lib/datasets/${slug}.json`;
  const cleanJson = JSON.stringify(dataset, null, 2);
  const params = new URLSearchParams({
    filename,
    value: cleanJson,
    message: `feat(dataset): add ${packTitle} community seed pack`,
  });
  return `${repoUrl.replace(/\/$/, '')}/new/main?${params.toString()}`;
}
