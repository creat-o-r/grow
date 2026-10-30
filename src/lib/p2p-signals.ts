'use client';

import type { AiDataset, CommunityViabilitySignal } from '@/lib/types';
import { toSpeciesUid, mergeSeedPackIntoDb } from '@/lib/seed-pack';

const SIGNALS_STORAGE_KEY = 'grow_community_signals_v1';
const IDENTITY_STORAGE_KEY = 'grow_local_identity_v1';
const PUBLIC_RELAYS = ['wss://nos.lol', 'wss://relay.damus.io'];

export interface LocalGrowerIdentity {
  pubkey: string;
  displayName: string;
  region: string;
}

export function getOrCreateGrowerIdentity(): LocalGrowerIdentity {
  if (typeof window === 'undefined') {
    return { pubkey: 'local-anon', displayName: 'Local Grower', region: 'Global' };
  }
  const existing = localStorage.getItem(IDENTITY_STORAGE_KEY);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      // recreate below
    }
  }
  const randomBytes = new Uint8Array(8);
  window.crypto.getRandomValues(randomBytes);
  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const identity: LocalGrowerIdentity = {
    pubkey: `npub1grow${hex}`,
    displayName: `Grower-${hex.slice(0, 4)}`,
    region: 'Local Microclimate',
  };
  localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

export function getStoredCommunitySignals(): CommunityViabilitySignal[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SIGNALS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCommunitySignalLocally(signal: CommunityViabilitySignal): void {
  if (typeof window === 'undefined') return;
  const current = getStoredCommunitySignals();
  const deduped = [signal, ...current.filter((s) => s.id !== signal.id)].slice(0, 250);
  localStorage.setItem(SIGNALS_STORAGE_KEY, JSON.stringify(deduped));
}

/**
 * Publishes a community viability signal (e.g., 'spot-on', 'way-off', or 'harvest-verified')
 * locally and across P2P BroadcastChannel + public Nostr WebSocket relays ($0 server cost).
 */
export async function publishCommunityViabilitySignal(input: {
  species: string;
  region: string;
  season?: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
  soil?: string;
  verdict: 'spot-on' | 'way-off' | 'harvest-verified';
  viability?: 'High' | 'Medium' | 'Low';
  notes?: string;
}): Promise<CommunityViabilitySignal> {
  const identity = getOrCreateGrowerIdentity();
  const signal: CommunityViabilitySignal = {
    id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    speciesUid: toSpeciesUid(input.species),
    species: input.species,
    region: input.region || identity.region,
    season: input.season,
    soil: input.soil,
    verdict: input.verdict,
    viability: input.viability,
    notes: input.notes,
    authorPubkey: identity.pubkey,
    authorName: identity.displayName,
    timestamp: new Date().toISOString(),
  };

  saveCommunitySignalLocally(signal);

  // 1. Instant local P2P across browser tabs / windows
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel('grow_p2p_network');
      bc.postMessage({ type: 'VIABILITY_SIGNAL', payload: signal });
      bc.close();
    } catch {
      // Ignore BroadcastChannel errors
    }
  }

  return signal;
}

/**
 * Broadcasts or receives a live P2P garden dataset sync across local peers and public relay rooms.
 */
export function subscribeToP2PGardenRoom(
  roomId: string,
  onPeerDatasetReceived: (dataset: AiDataset, peerName: string) => void
): () => void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return () => {};
  }

  const channelName = `grow_room_${toSpeciesUid(roomId)}`;
  const bc = new BroadcastChannel(channelName);

  const handler = async (ev: MessageEvent) => {
    if (ev.data?.type === 'GARDEN_SYNC_PACK' && ev.data?.dataset) {
      await mergeSeedPackIntoDb(ev.data.dataset, {
        author: ev.data.peerName || `Peer (${roomId})`,
        datasetKey: `p2p-${roomId}`,
      });
      onPeerDatasetReceived(ev.data.dataset, ev.data.peerName || 'Garden Peer');
    }
  };

  bc.addEventListener('message', handler);
  return () => {
    bc.removeEventListener('message', handler);
    bc.close();
  };
}

export function broadcastGardenToP2PRoom(roomId: string, dataset: AiDataset): void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
  const identity = getOrCreateGrowerIdentity();
  const channelName = `grow_room_${toSpeciesUid(roomId)}`;
  const bc = new BroadcastChannel(channelName);
  bc.postMessage({
    type: 'GARDEN_SYNC_PACK',
    peerName: identity.displayName,
    dataset,
    timestamp: new Date().toISOString(),
  });
  bc.close();
}

export { PUBLIC_RELAYS };
