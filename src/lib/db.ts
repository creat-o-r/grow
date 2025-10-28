

import Dexie, { type EntityTable } from 'dexie';
import type { Plant, Planting, GardenLocation, AiLog } from '@/lib/types';

const db = new Dexie('growDB') as Dexie & {
  plants: EntityTable<Plant, 'id'>;
  plantings: EntityTable<Planting, 'id'>;
  locations: EntityTable<GardenLocation, 'id'>;
  aiLogs: EntityTable<AiLog, 'id'>;
};

// Latest version
db.version(4).stores({
  plants: '++id, species',
  plantings: '++id, plantId, gardenId',
  locations: '++id, name',
  aiLogs: '++id, timestamp',
});


// Upgrade from version 3 to 4
db.version(3).stores({
  plants: '++id, species',
  plantings: '++id, plantId, gardenId',
  locations: '++id, name',
  aiLogs: '++id, timestamp',
}).upgrade(async tx => {
    // This schema change adds an optional imageUrl property to plants,
    // so no data migration is needed for existing plant objects.
});

// Upgrade from version 2 to 3
db.version(2).stores({
  plants: '++id, species',
  plantings: '++id, plantId, status', // index status for filtering
  locations: '++id, name',
  aiLogs: '++id, timestamp',
}).upgrade(async tx => {
    // This schema change adds optional properties, so no data migration is needed
    // for existing location objects. They will just lack the new properties until set.
});


// Upgrade from version 1 to 2
db.version(1).stores({
  plants: '++id, species',
  locations: '++id, name',
  aiLogs: '++id, timestamp',
}).upgrade(async tx => {
  // This is a destructive upgrade. A real-world app would need a more careful migration.
  const oldPlants = await tx.table('plants').toArray();
  
  const newPlants: Plant[] = [];
  const newPlantings: Omit<Planting, 'id'>[] = [];
  
  const speciesMap = new Map<string, Plant>();

  for (const oldPlant of oldPlants) {
    let plant = speciesMap.get(oldPlant.species);
    if (!plant) {
      plant = {
        id: `plant-${newPlants.length + 1}`,
        species: oldPlant.species,
        germinationNeeds: oldPlant.germinationNeeds,
        optimalConditions: oldPlant.optimalConditions,
      };
      newPlants.push(plant);
      speciesMap.set(oldPlant.species, plant);
    }
    
    newPlantings.push({
      plantId: plant.id,
      gardenId: '', // No location data was previously tied to a plant instance
      name: oldPlant.species,
      createdAt: oldPlant.history?.[0]?.date || new Date().toISOString(),
      history: oldPlant.history || [],
      seedsOnHand: oldPlant.seedsOnHand,
      plannedQty: oldPlant.plannedQty,
    });
  }

  await tx.table('plants').clear();
  await tx.table('plants').bulkAdd(newPlants);
  await tx.table('plantings').bulkAdd(newPlantings as Planting[]);
});


export { db };
