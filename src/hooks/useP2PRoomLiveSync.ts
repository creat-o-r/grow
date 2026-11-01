'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AiDataset, FreeLlmConfig } from '@/lib/types';
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

            const modeLabel = currentMode === 'selected' ? ' [Trusted Grower]' : '';
            toast({
              title: `🌿 Inward Stream: @${peerName}${modeLabel}`,
              description: `Auto-merged ${result.addedPlantings} planting(s) into ${result.targetGardenName || gardenName}.`,
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

        // Safe Notification path: either mode is 'off', or mode is 'selected' but this grower is unselected
        const isUnselected = currentMode === 'selected' && !isTrusted;
        toast({
          title: isUnselected
            ? `🌱 Stream from @${peerName} (Unselected Grower)`
            : `🌱 @${peerName} updated "${trimmed}"`,
          description: isUnselected
            ? `${plantCount} plants in "${gardenName}". Not on your selected inward stream list.`
            : `${plantCount} plants streamed in "${gardenName}". Click to review & merge.`,
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
  };
}
