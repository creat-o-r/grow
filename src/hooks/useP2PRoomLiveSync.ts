'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AiDataset, FreeLlmConfig, PlantingWithPlant } from '@/lib/types';
import {
  getSavedP2PRoomId,
  saveP2PRoomId,
  getAutoStreamPreference,
  saveAutoStreamPreference,
  getInwardStreamMode,
  saveInwardStreamMode,
  type InwardStreamMode,
  getTrustedGrowers,
  saveTrustedGrowers,
  addTrustedGrower as addTrustedGrowerStorage,
  removeTrustedGrower as removeTrustedGrowerStorage,
  isGrowerTrusted,
  subscribeToP2PGardenRoom,
  broadcastGardenToP2PRoom,
} from '@/lib/p2p-signals';
import { mergeSeedPackIntoDb } from '@/lib/seed-pack';
import {
  computeGardenDiscrepancy,
  applyGardenDiscrepancies,
  applySinglePlantingDiscrepancy,
  type GardenDiscrepancy,
  type DiscrepancyItemUpdated,
} from '@/lib/sync-diff';
import { db } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';

export const P2P_ROOM_CHANGE_EVENT = 'grow:p2p-room-changed';
export const P2P_TRUSTED_CHANGE_EVENT = 'grow:p2p-trusted-changed';

export function notifyP2PRoomChanged(newRoomId: string) {
  if (typeof window !== 'undefined') {
    saveP2PRoomId(newRoomId);
    window.dispatchEvent(new CustomEvent(P2P_ROOM_CHANGE_EVENT, { detail: { roomId: newRoomId } }));
  }
}

export function notifyTrustedGrowersChanged(growers: string[]) {
  if (typeof window !== 'undefined') {
    saveTrustedGrowers(growers);
    window.dispatchEvent(new CustomEvent(P2P_TRUSTED_CHANGE_EVENT, { detail: { growers } }));
  }
}

export interface UseP2PRoomLiveSyncOptions {
  activeLocationId?: string;
  onReviewRequested?: (dataset: AiDataset, peerName: string) => void;
  onApiKeysReceived?: (keys: FreeLlmConfig, peerName: string) => void;
}

export function useP2PRoomLiveSync(options?: UseP2PRoomLiveSyncOptions) {
  const { toast } = useToast();
  const [roomId, setRoomId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [inwardMode, setInwardModeState] = useState<InwardStreamMode>('off');
  const [trustedGrowers, setTrustedGrowersState] = useState<string[]>([]);
  const [autoStream, setAutoStreamState] = useState<boolean>(false);
  const [lastPeer, setLastPeer] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Pre-operation multi-device state awareness
  const [pendingRemoteDiscrepancy, setPendingRemoteDiscrepancy] = useState<GardenDiscrepancy | null>(null);
  const [remotePlantingUpdates, setRemotePlantingUpdates] = useState<Map<string, DiscrepancyItemUpdated>>(new Map());
  const [latestRemoteDataset, setLatestRemoteDataset] = useState<{ dataset: AiDataset; peerName: string; timestamp: string } | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isStreamingRef = useRef<boolean>(false);

  // Initialize preferences on client mount
  useEffect(() => {
    setRoomId(getSavedP2PRoomId());
    setInwardModeState(getInwardStreamMode());
    setTrustedGrowersState(getTrustedGrowers());
    setAutoStreamState(getAutoStreamPreference());

    const handleRoomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ roomId: string }>;
      if (customEvent.detail?.roomId !== undefined) {
        setRoomId(customEvent.detail.roomId.trim());
      }
    };

    const handleTrustedChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ growers: string[] }>;
      if (customEvent.detail?.growers !== undefined) {
        setTrustedGrowersState(customEvent.detail.growers);
      }
    };

    window.addEventListener(P2P_ROOM_CHANGE_EVENT, handleRoomChange);
    window.addEventListener(P2P_TRUSTED_CHANGE_EVENT, handleTrustedChange);
    return () => {
      window.removeEventListener(P2P_ROOM_CHANGE_EVENT, handleRoomChange);
      window.removeEventListener(P2P_TRUSTED_CHANGE_EVENT, handleTrustedChange);
    };
  }, []);

  const setInwardMode = useCallback((mode: InwardStreamMode) => {
    saveInwardStreamMode(mode);
    setInwardModeState(mode);
  }, []);

  const addTrusted = useCallback((grower: string) => {
    const updated = addTrustedGrowerStorage(grower);
    setTrustedGrowersState(updated);
    notifyTrustedGrowersChanged(updated);
  }, []);

  const removeTrusted = useCallback((grower: string) => {
    const updated = removeTrustedGrowerStorage(grower);
    setTrustedGrowersState(updated);
    notifyTrustedGrowersChanged(updated);
  }, []);

  const setAutoStream = useCallback((enabled: boolean) => {
    saveAutoStreamPreference(enabled);
    setAutoStreamState(enabled);
  }, []);

  // Lookup helper for individual plantings
  const checkRemoteUpdateForPlanting = useCallback((plantingId: string): DiscrepancyItemUpdated | undefined => {
    return remotePlantingUpdates.get(plantingId);
  }, [remotePlantingUpdates]);

  const dismissRemoteUpdateForPlanting = useCallback((plantingId: string) => {
    setRemotePlantingUpdates(prev => {
      const next = new Map(prev);
      next.delete(plantingId);
      return next;
    });
  }, []);

  const clearPendingRemoteUpdates = useCallback(() => {
    setPendingRemoteDiscrepancy(null);
    setRemotePlantingUpdates(new Map());
    setLatestRemoteDataset(null);
  }, []);

  // Apply a single remote update (e.g. from pre-operation conflict dialog or plant card)
  const applyRemoteUpdateForPlanting = useCallback(async (plantingId: string): Promise<boolean> => {
    const update = remotePlantingUpdates.get(plantingId);
    if (!update || !latestRemoteDataset) return false;
    try {
      await applySinglePlantingDiscrepancy(update, latestRemoteDataset.dataset);
      dismissRemoteUpdateForPlanting(plantingId);
      toast({
        title: 'Remote Update Applied',
        description: `Synced changes for ${update.plantName} from @${update.peerHandle || 'remote device'}.`,
      });
      return true;
    } catch (err: any) {
      console.error('[P2P LiveSync] Failed to apply single remote update:', err);
      toast({
        title: 'Sync Failed',
        description: err?.message || 'Could not apply remote update.',
        variant: 'destructive',
      });
      return false;
    }
  }, [remotePlantingUpdates, latestRemoteDataset, dismissRemoteUpdateForPlanting, toast]);

  // Apply all pending remote discrepancies
  const applyAllPendingRemoteDiscrepancies = useCallback(async (): Promise<void> => {
    if (!pendingRemoteDiscrepancy || !latestRemoteDataset) return;
    try {
      await applyGardenDiscrepancies(
        pendingRemoteDiscrepancy,
        latestRemoteDataset.dataset,
        options?.activeLocationId || pendingRemoteDiscrepancy.updatedItems[0]?.targetGardenId || ''
      );
      clearPendingRemoteUpdates();
      toast({
        title: 'All Remote Changes Synced',
        description: `Synced ${pendingRemoteDiscrepancy.updatedItems.length + pendingRemoteDiscrepancy.newItems.length} changes from @${pendingRemoteDiscrepancy.peerHandle}.`,
      });
    } catch (err: any) {
      console.error('[P2P LiveSync] Failed to apply all pending remote discrepancies:', err);
      toast({
        title: 'Sync Failed',
        description: err?.message || 'Could not apply remote discrepancies.',
        variant: 'destructive',
      });
    }
  }, [pendingRemoteDiscrepancy, latestRemoteDataset, options?.activeLocationId, clearPendingRemoteUpdates, toast]);

  // Subscribe to live room updates (EventSource SSE + BroadcastChannel)
  useEffect(() => {
    const trimmed = roomId.trim();
    if (!trimmed) {
      setIsConnected(false);
      return;
    }

    setIsConnected(true);

    const unsubscribe = subscribeToP2PGardenRoom(
      trimmed,
      async (incomingDataset, peerName, timestamp, apiKeys, peerPubkey) => {
        setLastPeer(peerName);
        setLastSyncTime(new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        // Handle shared API keys if broadcaster included them
        if (apiKeys && options?.onApiKeysReceived) {
          options.onApiKeysReceived(apiKeys, peerName);
        }

        const plantCount = incomingDataset.plantings?.length || 0;
        const gardenName = incomingDataset.locations?.[0]?.name || 'Garden';

        // Fetch local database state to compute discrepancy accurately across devices
        let disc: GardenDiscrepancy | null = null;
        try {
          const allLocations = await db.locations.toArray();
          const allPlants = await db.plants.toArray();
          const allPlantings = await db.plantings.toArray();
          const plantMap = new Map(allPlants.map(p => [p.id, p]));
          const locationMap = new Map(allLocations.map(l => [l.id, l]));
          const plantingsWithPlants: PlantingWithPlant[] = allPlantings.map(p => ({
            ...p,
            plant: plantMap.get(p.plantId) || { id: p.plantId, species: p.name, name: p.name, germinationNeeds: '', optimalConditions: '' },
            garden: locationMap.get(p.gardenId),
          }));

          disc = computeGardenDiscrepancy(
            plantingsWithPlants.filter(p => !options?.activeLocationId || p.gardenId === options.activeLocationId),
            incomingDataset,
            peerName,
            {
              targetGardenId: options?.activeLocationId || null,
              allLocalPlantings: plantingsWithPlants,
              allLocalLocations: allLocations,
              peerPubkey,
            }
          );
        } catch (discErr) {
          console.warn('[P2P LiveSync] Could not compute incoming discrepancy:', discErr);
        }

        setLatestRemoteDataset({ dataset: incomingDataset, peerName, timestamp });

        const currentMode = getInwardStreamMode();
        const isTrusted = isGrowerTrusted(peerName) || isGrowerTrusted(peerPubkey);
        const shouldAutoMerge = currentMode === 'all' || (currentMode === 'selected' && isTrusted);

        // Auto-merge path: seamlessly ingest without modal popup
        if (shouldAutoMerge) {
          try {
            const result = await mergeSeedPackIntoDb(incomingDataset, {
              mode: 'add',
              targetGardenId: options?.activeLocationId || null,
              author: peerName,
            });

            // Clear pending since auto-merged
            setPendingRemoteDiscrepancy(null);
            setRemotePlantingUpdates(new Map());

            const modeLabel = currentMode === 'selected' ? ' [Trusted Grower]' : '';
            let syncDesc = `All plants in ${result.targetGardenName || gardenName} are already in sync.`;
            if (result.addedPlantings > 0 && result.mergedPlants > 0) {
              syncDesc = `Added ${result.addedPlantings} new plant(s) and updated ${result.mergedPlants} in ${result.targetGardenName || gardenName}.`;
            } else if (result.addedPlantings > 0) {
              syncDesc = `Added ${result.addedPlantings} new planting(s) into ${result.targetGardenName || gardenName}.`;
            } else if (result.mergedPlants > 0) {
              syncDesc = `Updated ${result.mergedPlants} existing planting(s) in ${result.targetGardenName || gardenName}.`;
            }

            toast({
              title: `🌿 Inward Stream: @${peerName}${modeLabel}`,
              description: syncDesc,
            });
          } catch (err: any) {
            console.error('[P2P LiveSync] Inward auto-stream merge failed:', err);
            toast({
              title: `Sync Failed from @${peerName}`,
              description: err?.message || 'Could not auto-merge incoming garden.',
              variant: 'destructive',
            });
          }
          return;
        }

        // Pre-operation multi-device awareness: store updates so user is informed before operations
        if (disc && disc.hasDiscrepancies) {
          setPendingRemoteDiscrepancy(disc);
          const map = new Map<string, DiscrepancyItemUpdated>();
          for (const item of disc.updatedItems) {
            if (item.localPlantingId) {
              map.set(item.localPlantingId, item);
            }
          }
          setRemotePlantingUpdates(map);
        }

        // Safe Notification path: either mode is 'off', or mode is 'selected' but this grower is unselected
        const isUnselected = currentMode === 'selected' && !isTrusted;
        const modifiedCount = disc ? disc.updatedItems.length : 0;
        const newCount = disc ? disc.newItems.length : 0;
        const changeDetails = modifiedCount > 0 ? ` (${modifiedCount} updated)` : '';

        toast({
          title: isUnselected
            ? `🌱 Stream from @${peerName} (Unselected Grower)`
            : `🌱 @${peerName} updated "${trimmed}"${changeDetails}`,
          description: isUnselected
            ? `${plantCount} plants in "${gardenName}". Not on your selected inward stream list.`
            : `${plantCount} plants streamed in "${gardenName}". Changes available before next operation.`,
        });

        if (options?.onReviewRequested) {
          options.onReviewRequested(incomingDataset, peerName);
        }
      }
    );

    return () => {
      setIsConnected(false);
      unsubscribe();
    };
  }, [roomId, options?.activeLocationId, toast]);

  // Debounced auto-stream function to broadcast garden edits when autoStream is enabled
  const triggerDebouncedStream = useCallback(
    (getDataset: () => Promise<AiDataset | null>) => {
      if (!getAutoStreamPreference() || !roomId.trim()) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        if (isStreamingRef.current) return;
        isStreamingRef.current = true;
        try {
          const dataset = await getDataset();
          if (dataset && (dataset.locations?.length || 0) > 0) {
            await broadcastGardenToP2PRoom(roomId.trim(), dataset);
            setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
        } catch (err) {
          console.warn('[P2P LiveSync] Outward auto-stream broadcast error:', err);
        } finally {
          isStreamingRef.current = false;
        }
      }, 2200);
    },
    [roomId]
  );

  return {
    roomId,
    setRoomId,
    isConnected,
    inwardMode,
    setInwardMode,
    autoMerge: inwardMode !== 'off',
    trustedGrowers,
    addTrustedGrower: addTrusted,
    removeTrustedGrower: removeTrusted,
    isGrowerTrusted,
    autoStream,
    setAutoStream,
    lastPeer,
    lastSyncTime,
    triggerDebouncedStream,
    // Multi-device pre-operation awareness
    pendingRemoteDiscrepancy,
    remotePlantingUpdates,
    latestRemoteDataset,
    checkRemoteUpdateForPlanting,
    dismissRemoteUpdateForPlanting,
    clearPendingRemoteUpdates,
    applyRemoteUpdateForPlanting,
    applyAllPendingRemoteDiscrepancies,
  };
}
