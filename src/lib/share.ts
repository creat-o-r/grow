'use server';

import { z } from 'zod';
import { ShareMode, ShareInstance, Plant, Planting, GardenLocation } from '@/lib/types';
import { db } from '@/lib/db';
import { ulid } from 'ulid';

const createShareInstanceSchema = z.object({
  mode: z.enum(['mirror', 'bulk', 'read-only']),
  handle: z.string().optional(),
});

export const createShareInstance = async (input: z.infer<typeof createShareInstanceSchema>) => {
  const newInstance: ShareInstance = {
    id: ulid(),
    mode: input.mode,
    handle: input.handle,
    createdAt: new Date().toISOString(),
  };

  await db.shareInstances.add(newInstance);
  return newInstance;
};

export const getShareInstance = async (id: string) => {
  return await db.shareInstances.get(id);
};

export const addGardenToShare = async (shareId: string, gardenId: string) => {
  await db.sharedGardens.add({
    id: ulid(),
    shareId,
    gardenId,
  });
};

export const getSharedGardens = async (shareId: string) => {
    return await db.sharedGardens.where('shareId').equals(shareId).toArray();
}

export const getDataForShare = async (shareId: string) => {
    const shareInstance = await db.shareInstances.get(shareId);
    if (!shareInstance) {
        throw new Error('Share instance not found');
    }

    if (shareInstance.mode === 'mirror') {
        const plants = await db.plants.toArray();
        const plantings = await db.plantings.toArray();
        const locations = await db.locations.toArray();
        return { plants, plantings, locations };
    }

    if (shareInstance.mode === 'bulk') {
        const sharedGardens = await getSharedGardens(shareId);
        const gardenIds = sharedGardens.map(g => g.gardenId);
        const plants = await db.plants.toArray(); // Plants are global
        const plantings = await db.plantings.where('gardenId').anyOf(gardenIds).toArray();
        const locations = await db.locations.where('id').anyOf(gardenIds).toArray();
        return { plants, plantings, locations };
    }

    if (shareInstance.mode === 'read-only') {
        const plants = await db.plants.toArray();
        return { plants };
    }
};

export const syncDataFromShare = async (shareId: string, data: { plants: Plant[], plantings?: Planting[], locations?: GardenLocation[] }) => {
    const shareInstance = await db.shareInstances.get(shareId);
    if (!shareInstance) {
        throw new Error('Share instance not found');
    }

    if (shareInstance.mode === 'mirror' || shareInstance.mode === 'bulk') {
        await db.plants.bulkPut(data.plants);
        if (data.plantings) {
            await db.plantings.bulkPut(data.plantings);
        }
        if (data.locations) {
            await db.locations.bulkPut(data.locations);
        }
    } else if (shareInstance.mode === 'read-only') {
        await db.plants.bulkPut(data.plants);
    }
};
