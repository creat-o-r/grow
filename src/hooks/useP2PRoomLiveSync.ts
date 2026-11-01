'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AiDataset, FreeLlmConfig } from '@/lib/types';
import {
  getSavedP2PRoomId,
  saveP2PRoomId,
  getAutoMergePreference,
  saveAutoMergePreference,
  getAutoStreamPreference,
  saveAutoStreamPreference,
  subscribeToP2PGardenRoom,
  broadcastGardenToP2PRoom,
  getOrCreateGrowerIdentity,
} from '@/lib/p2p-signals';
import { mergeSeedPackIntoDb } from '@/lib/seed-pack';
import { useToast } from '@/hooks/use-toast';

export const P2P_ROOM_CHANGE_EVENT = 'grow:p2p-room-changed';

export function notifyP2PRoomChanged(newRoomId: string) {
  if (typeof window !== 'undefined') {
    saveP2PRoomId(newRoomId);
    window.dispatchEvent(new CustomEvent(P2P_ROOM_CHANGE_EVENT, { detail: { roomId: newRoomId } }));
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
  const [autoMerge, setAutoMergeState] = useState<boolean>(false);
  const [autoStream, setAutoStreamState] = useState<boolean>(false);
  const [lastPeer, setLastPeer] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isStreamingRef = useRef<boolean>(false);

  // Initialize preferences on client mount
  useEffect(() => {
    setRoomId(getSavedP2PRoomId());
    setAutoMergeState(getAutoMergePreference());
    setAutoStreamState(getAutoStreamPreference());

    const handleRoomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ roomId: string }>;
      if (customEvent.detail?.roomId !== undefined) {
        setRoomId(customEvent.detail.roomId.trim());
      }
    };

    window.addEventListener(P2P_ROOM_CHANGE_EVENT, handleRoomChange);
    return () => {
      window.removeEventListener(P2P_ROOM_CHANGE_EVENT, handleRoomChange);
    };
  }, []);

  const setAutoMerge = useCallback((enabled: boolean) => {
    saveAutoMergePreference(enabled);
    setAutoMergeState(enabled);
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
      async (incomingDataset, peerName, timestamp, apiKeys) => {
        setLastPeer(peerName);
        setLastSyncTime(new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        // Handle shared API keys if broadcaster included them
        if (apiKeys && options?.onApiKeysReceived) {
          options.onApiKeysReceived(apiKeys, peerName);
        }

        const plantCount = incomingDataset.plantings?.length || 0;
        const gardenName = incomingDataset.locations?.[0]?.name || 'Garden';

        // Auto-merge path: seamlessly ingest without modal popup
        if (getAutoMergePreference()) {
          try {
            const result = await mergeSeedPackIntoDb(incomingDataset, {
              mode: 'add',
              targetGardenId: options?.activeLocationId || null,
              author: peerName,
            });

            toast({
              title: `🌿 Garden Synced from @${peerName}`,
              description: `Auto-merged ${result.addedPlantings} planting(s) into ${result.targetGardenName || gardenName}.`,
            });
          } catch (err: any) {
            console.error('[P2P LiveSync] Auto-merge failed:', err);
            toast({
              title: `Sync Failed from @${peerName}`,
              description: err?.message || 'Could not auto-merge incoming garden.',
              variant: 'destructive',
            });
          }
          return;
        }

        // Safe Notification path (default): notify user with 1-click merge or review options
        toast({
          title: `🌱 @${peerName} updated "${trimmed}"`,
          description: `${plantCount} plants streamed in "${gardenName}". Click to review & merge.`,
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
          console.warn('[P2P LiveSync] Auto-stream broadcast error:', err);
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
    autoMerge,
    setAutoMerge,
    autoStream,
    setAutoStream,
    lastPeer,
    lastSyncTime,
    triggerDebouncedStream,
  };
}
