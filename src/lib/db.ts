
import Dexie, { type EntityTable } from 'dexie';
import type { Plant, GardenLocation, AiLog } from '@/lib/types';

const db = new Dexie('growDB') as Dexie & {
  plants: EntityTable<Plant, 'id'>;
  locations: EntityTable<GardenLocation, 'id'>;
  aiLogs: EntityTable<AiLog, 'id'>;
};

db.version(1).stores({
  plants: '++id, species',
  locations: '++id, name',
  aiLogs: '++id, timestamp',
});

export { db };
