'use client';

import type { AiDataset, CommunityViabilitySignal } from '@/lib/types';
import {
  toSpeciesUid,
  encodeSeedPackToParam,
  decodeSeedPackFromInput,
} from '@/lib/seed-pack';

const SIGNALS_STORAGE_KEY = 'grow_community_signals_v1';
const IDENTITY_STORAGE_KEY = 'grow_local_identity_v1';
const P2P_ROOM_STORAGE_KEY = 'grow_p2p_room_id_v1';
const PUBLIC_RELAYS = ['https://ntfy.sh', 'wss://nos.lol', 'wss://relay.damus.io'];

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

export function getSavedP2PRoomId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(P2P_ROOM_STORAGE_KEY) || '';
}

export function saveP2PRoomId(roomId: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = roomId.trim();
  if (trimmed) {
    localStorage.setItem(P2P_ROOM_STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(P2P_ROOM_STORAGE_KEY);
  }
}

function getRelayTopicUrl(roomId: string): string {
  const slug = toSpeciesUid(roomId) || 'default-room';
  return `https://ntfy.sh/grow-p2p-pack-${slug}`;
}

export interface P2PRoomPacket {
  packetId: string;
  type: 'GARDEN_SYNC_PACK';
  peerPubkey: string;
  peerName: string;
  packParam: string;
  gardenName: string;
  plantCount: number;
  timestamp: string;
}

function getRoomCacheKey(roomId: string): string {
  const slug = toSpeciesUid(roomId) || 'default-room';
  return `grow_p2p_room_cache_${slug}`;
}

async function extractPacketFromNtfyEnvelope(envelope: any): Promise<P2PRoomPacket | null> {
  if (!envelope || envelope.event !== 'message') return null;

  // 1. When payload > 4 KB, ntfy.sh stores the body in envelope.attachment.url (with CORS *)
  if (envelope.attachment?.url) {
    try {
      const attResp = await fetch(envelope.attachment.url, { cache: 'no-store' });
      if (attResp.ok) {
        const rawText = await attResp.text();
        const cleaned = rawText.startsWith('GROW_PACK:')
          ? rawText.slice('GROW_PACK:'.length)
          : rawText;
        const parsed = JSON.parse(cleaned);
        if (parsed?.type === 'GARDEN_SYNC_PACK' && parsed.packParam) {
          return parsed as P2PRoomPacket;
        }
      }
    } catch {
      // fall through to message check
    }
  }

  // 2. Inline message (<= 4 KB)
  if (typeof envelope.message === 'string' && envelope.message.trim()) {
    try {
      const rawText = envelope.message.trim();
      const cleaned = rawText.startsWith('GROW_PACK:')
        ? rawText.slice('GROW_PACK:'.length)
        : rawText;
      const parsed = JSON.parse(cleaned);
      if (parsed?.type === 'GARDEN_SYNC_PACK' && parsed.packParam) {
        return parsed as P2PRoomPacket;
      }
    } catch {
      // ignore non-Grow messages
    }
  }

  return null;
}

/**
 * Fetches the most recent cached P2P garden snapshot from the public cross-session relay
 * (retained for 24-48h even when the broadcasting session/device is closed).
 */
export async function fetchLatestFromP2PRoom(
  roomId: string
): Promise<{ dataset: AiDataset; peerName: string; timestamp: string } | null> {
  if (!roomId.trim()) return null;
  const topicUrl = `${getRelayTopicUrl(roomId)}/json?poll=1&since=24h`;
  const resp = await fetch(topicUrl, { cache: 'no-store' });
  if (!resp.ok) {
    throw new Error(`Relay returned HTTP ${resp.status}`);
  }
  const text = await resp.text();
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let fallbackEmptyResult: { dataset: AiDataset; peerName: string; timestamp: string } | null = null;

  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const envelope = JSON.parse(lines[i]);
      const packet = await extractPacketFromNtfyEnvelope(envelope);
      if (packet?.type === 'GARDEN_SYNC_PACK' && packet.packParam) {
        const dataset = decodeSeedPackFromInput(packet.packParam);
        const candidate = {
          dataset,
          peerName: packet.peerName || 'Garden Peer',
          timestamp: packet.timestamp || new Date().toISOString(),
        };
        if ((dataset.plantings?.length || 0) > 0) {
          return candidate;
        }
        if (!fallbackEmptyResult) {
          fallbackEmptyResult = candidate;
        }
      }
    } catch {
      // skip non-Grow messages
    }
  }

  // Check local browser cache if relay had no populated snapshot
  if (typeof window !== 'undefined') {
    try {
      const cachedRaw = localStorage.getItem(getRoomCacheKey(roomId));
      if (cachedRaw) {
        const cachedPacket: P2PRoomPacket = JSON.parse(cachedRaw);
        const dataset = decodeSeedPackFromInput(cachedPacket.packParam);
        if ((dataset.plantings?.length || 0) > 0) {
          return {
            dataset,
            peerName: cachedPacket.peerName || 'Local Peer',
            timestamp: cachedPacket.timestamp,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  return fallbackEmptyResult;
}

/**
 * Subscribes to live P2P garden dataset updates across BOTH:
 * 1. Local `BroadcastChannel` (instant tab-to-tab on the same browser)
 * 2. Public `ntfy.sh` SSE stream (cross-browser, cross-session, cross-device with $0 server cost)
 */
export function subscribeToP2PGardenRoom(
  roomId: string,
  onPeerDatasetReceived: (dataset: AiDataset, peerName: string, timestamp: string) => void
): () => void {
  if (typeof window === 'undefined' || !roomId.trim()) {
    return () => {};
  }

  const identity = getOrCreateGrowerIdentity();
  const seenPacketIds = new Set<string>();
  const channelName = `grow_room_${toSpeciesUid(roomId)}`;

  const handlePacket = (packet: P2PRoomPacket) => {
    if (!packet || packet.type !== 'GARDEN_SYNC_PACK' || !packet.packParam) return;
    if (seenPacketIds.has(packet.packetId)) return;
    seenPacketIds.add(packet.packetId);
    // Ignore our own broadcasts from echoing back via SSE
    if (packet.peerPubkey && packet.peerPubkey === identity.pubkey) return;
    try {
      const dataset = decodeSeedPackFromInput(packet.packParam);
      onPeerDatasetReceived(
        dataset,
        packet.peerName || 'Garden Peer',
        packet.timestamp || new Date().toISOString()
      );
    } catch {
      // ignore malformed packet
    }
  };

  let bc: BroadcastChannel | null = null;
  const bcHandler = (ev: MessageEvent) => {
    if (ev.data?.type === 'GARDEN_SYNC_PACK') {
      handlePacket(ev.data as P2PRoomPacket);
    }
  };

  if ('BroadcastChannel' in window) {
    bc = new BroadcastChannel(channelName);
    bc.addEventListener('message', bcHandler);
  }

  let es: EventSource | null = null;
  if ('EventSource' in window) {
    try {
      es = new EventSource(`${getRelayTopicUrl(roomId)}/sse`);
      es.onmessage = async (ev) => {
        try {
          const envelope = JSON.parse(ev.data);
          const packet = await extractPacketFromNtfyEnvelope(envelope);
          if (packet) {
            handlePacket(packet);
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore SSE connection failure
    }
  }

  return () => {
    if (bc) {
      bc.removeEventListener('message', bcHandler);
      bc.close();
    }
    if (es) {
      es.close();
    }
  };
}

/**
 * Broadcasts a garden dataset to both local tabs (`BroadcastChannel`) and the cross-session
 * public relay (`ntfy.sh`) so other sessions/devices can pull or live-stream it.
 */
export async function broadcastGardenToP2PRoom(
  roomId: string,
  dataset: AiDataset
): Promise<P2PRoomPacket> {
  const identity = getOrCreateGrowerIdentity();
  // Strip any huge inline base64 data:image URIs so the relay payload stays compact
  const compactDataset: AiDataset = {
    ...dataset,
    plants: (dataset.plants || []).map((p) => ({
      ...p,
      imageUrl: p.imageUrl?.startsWith('data:') ? undefined : p.imageUrl,
    })),
  };
  const packParam = encodeSeedPackToParam(compactDataset);
  const packet: P2PRoomPacket = {
    packetId: `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'GARDEN_SYNC_PACK',
    peerPubkey: identity.pubkey,
    peerName: identity.displayName,
    packParam,
    gardenName: dataset.locations?.[0]?.name || 'Shared Garden',
    plantCount: dataset.plantings?.length || 0,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(getRoomCacheKey(roomId), JSON.stringify(packet));
    } catch {
      // ignore quota errors
    }
    if ('BroadcastChannel' in window) {
      try {
        const channelName = `grow_room_${toSpeciesUid(roomId)}`;
        const bc = new BroadcastChannel(channelName);
        bc.postMessage(packet);
        bc.close();
      } catch {
        // ignore
      }
    }
  }

  const resp = await fetch(getRelayTopicUrl(roomId), {
    method: 'POST',
    headers: {
      Filename: 'seedpack.json',
    },
    body: `GROW_PACK:${JSON.stringify(packet)}`,
  });
  if (!resp.ok) {
    throw new Error(`Relay broadcast failed with HTTP ${resp.status}`);
  }

  return packet;
}

export { PUBLIC_RELAYS };
