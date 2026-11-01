'use client';

import type { AiDataset, CommunityViabilitySignal, FreeLlmConfig } from '@/lib/types';
import {
  toSpeciesUid,
  encodeSeedPackToParam,
  decodeSeedPackFromInput,
} from '@/lib/seed-pack';

const SIGNALS_STORAGE_KEY = 'grow_community_signals_v1';
const IDENTITY_STORAGE_KEY = 'grow_local_identity_v1';
const P2P_ROOM_STORAGE_KEY = 'grow_p2p_room_id_v1';
const P2P_AUTO_MERGE_KEY = 'grow_p2p_auto_merge_v1';
const P2P_AUTO_STREAM_KEY = 'grow_p2p_auto_stream_v1';
const P2P_INWARD_MODE_KEY = 'grow_p2p_inward_mode_v2';
const P2P_TRUSTED_GROWERS_KEY = 'grow_p2p_trusted_growers_v2';
const PUBLIC_RELAYS = ['https://ntfy.sh', 'wss://nos.lol', 'wss://relay.damus.io'];

export interface LocalGrowerIdentity {
  pubkey: string;
  displayName: string;
  region: string;
}

export function getOrCreateGrowerIdentity(): LocalGrowerIdentity {
  if (typeof window === 'undefined') {
    return { pubkey: 'local-anon', displayName: 'Grower-Local', region: 'Global' };
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

export function updateGrowerIdentity(updates: Partial<LocalGrowerIdentity>): LocalGrowerIdentity {
  const current = getOrCreateGrowerIdentity();
  const updated: LocalGrowerIdentity = {
    ...current,
    displayName:
      updates.displayName !== undefined && updates.displayName.trim()
        ? updates.displayName.trim()
        : current.displayName,
    region:
      updates.region !== undefined && updates.region.trim()
        ? updates.region.trim()
        : current.region,
    pubkey:
      updates.pubkey !== undefined && updates.pubkey.trim()
        ? updates.pubkey.trim()
        : current.pubkey,
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(updated));
  }
  return updated;
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

export function getAutoMergePreference(): boolean {
  if (typeof window === 'undefined') return false;
  return getInwardStreamMode() !== 'off';
}

export function saveAutoMergePreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(P2P_AUTO_MERGE_KEY, enabled ? 'true' : 'false');
  localStorage.setItem(P2P_INWARD_MODE_KEY, enabled ? 'all' : 'off');
}

export function getAutoStreamPreference(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(P2P_AUTO_STREAM_KEY) === 'true';
}

export function saveAutoStreamPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(P2P_AUTO_STREAM_KEY, enabled ? 'true' : 'false');
}

export type InwardStreamMode = 'off' | 'all' | 'selected';

export function getInwardStreamMode(): InwardStreamMode {
  if (typeof window === 'undefined') return 'off';
  const saved = localStorage.getItem(P2P_INWARD_MODE_KEY);
  if (saved === 'all' || saved === 'selected' || saved === 'off') {
    return saved;
  }
  const legacyAutoMerge = localStorage.getItem(P2P_AUTO_MERGE_KEY);
  if (legacyAutoMerge === 'true') return 'all';
  return 'off';
}

export function saveInwardStreamMode(mode: InwardStreamMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(P2P_INWARD_MODE_KEY, mode);
  localStorage.setItem(P2P_AUTO_MERGE_KEY, mode === 'off' ? 'false' : 'true');
}

export function getTrustedGrowers(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(P2P_TRUSTED_GROWERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveTrustedGrowers(growers: string[]): void {
  if (typeof window === 'undefined') return;
  const cleaned = Array.from(
    new Set(
      growers
        .map((g) => g.trim())
        .filter(Boolean)
    )
  );
  localStorage.setItem(P2P_TRUSTED_GROWERS_KEY, JSON.stringify(cleaned));
}

export function addTrustedGrower(grower: string): string[] {
  const current = getTrustedGrowers();
  const trimmed = grower.trim();
  if (!trimmed) return current;
  const updated = Array.from(new Set([...current, trimmed]));
  saveTrustedGrowers(updated);
  return updated;
}

export function removeTrustedGrower(grower: string): string[] {
  const current = getTrustedGrowers();
  const normalized = grower.trim().toLowerCase().replace(/^@/, '');
  const updated = current.filter(
    (g) => g.trim().toLowerCase().replace(/^@/, '') !== normalized
  );
  saveTrustedGrowers(updated);
  return updated;
}

export function isGrowerTrusted(handleOrPubkey?: string | null): boolean {
  if (!handleOrPubkey) return false;
  const candidate = handleOrPubkey.trim().toLowerCase().replace(/^@/, '');
  if (!candidate) return false;
  const trusted = getTrustedGrowers();
  return trusted.some((entry) => {
    const cleanEntry = entry.trim().toLowerCase().replace(/^@/, '');
    return cleanEntry === candidate;
  });
}

function getRelayTopicUrl(roomId: string): string {
  const slug = toSpeciesUid(roomId) || 'default-room';
  return `https://ntfy.sh/grow-p2p-v2-${slug}`;
}

/**
 * Decompresses a deflate-raw base64url encoded wire dataset across modern browser and Node environments.
 */
export async function decompressDatasetFromWire(wireCompressed: string): Promise<AiDataset | null> {
  if (!wireCompressed || typeof wireCompressed !== 'string') return null;
  try {
    if (typeof window !== 'undefined' && typeof DecompressionStream !== 'undefined') {
      const base64 = wireCompressed.replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
      const binStr = atob(base64 + pad);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      const stream = new Response(bytes).body?.pipeThrough(new DecompressionStream('deflate-raw'));
      if (stream) {
        const text = await new Response(stream).text();
        return JSON.parse(text) as AiDataset;
      }
    }
  } catch (err) {
    console.warn('[P2P] Could not decompress dataset from wire:', err);
  }
  return null;
}

function createEmptySyncDataset(): AiDataset {
  return {
    locations: [
      {
        id: 'keys-sync',
        name: 'API Key Broadcast',
        location: 'Shared Sync',
        temperatureUnit: 'C',
        conditions: {
          temperature: '20',
          sunlight: 'Full Sun',
          soil: 'Standard',
        },
      },
    ],
    plants: [],
    plantings: [],
  };
}

export interface P2PRoomPacket {
  packetId: string;
  type: 'GARDEN_SYNC_PACK';
  peerPubkey: string;
  peerName: string;
  packParam?: string;
  compressedDataset?: string;
  gardenName: string;
  gardenCount?: number;
  plantCount: number;
  timestamp: string;
  apiKeys?: FreeLlmConfig;
}

function getRoomCacheKey(roomId: string): string {
  const slug = toSpeciesUid(roomId) || 'default-room';
  return `grow_p2p_room_cache_${slug}`;
}

/**
 * Short, order-independent fingerprint of a dataset's planting IDs (e.g. "12-3fa9c1d2").
 * Shown on the sender after streaming and on the receiver after pulling, so you can confirm
 * two DIFFERENT sessions are looking at the exact same garden data.
 * (scripts/p2p-test.mjs uses the identical algorithm.)
 */
export function fingerprintDataset(dataset: AiDataset | null | undefined): string {
  const ids = (dataset?.plantings || []).map((p) => String(p.id)).sort();
  let h = 0x811c9dc5;
  for (const ch of ids.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${ids.length}-${h.toString(16).padStart(8, '0')}`;
}

/**
 * Reads what is currently waiting in a room (never writes). `fromThisSession` is true when the
 * snapshot was written by this browser profile, i.e. pulling it would NOT prove cross-session sync.
 */
export async function inspectP2PRoom(roomId: string): Promise<{
  hasSnapshot: boolean;
  source: string;
  fingerprint: string | null;
  fromThisSession: boolean;
  hasApiKeys?: boolean;
  sharedKeyProviders?: string[];
  packet: {
    packetId?: string;
    peerName: string;
    gardenName: string;
    gardenCount: number;
    plantCount: number;
    timestamp: string;
    hasApiKeys?: boolean;
    sharedKeyProviders?: string[];
  } | null;
} | null> {
  if (!roomId.trim()) return null;
  try {
    const res = await fetch(`/api/p2p?room=${encodeURIComponent(roomId.trim())}&peek=1`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const identity = getOrCreateGrowerIdentity();
    return {
      hasSnapshot: Boolean(data?.hasSnapshot),
      source: data?.source || 'none',
      fingerprint: data?.hasSnapshot ? data.fingerprint || null : null,
      fromThisSession: Boolean(data?.packet?.peerPubkey && data.packet.peerPubkey === identity.pubkey),
      hasApiKeys: Boolean(data?.packet?.hasApiKeys),
      sharedKeyProviders: data?.packet?.sharedKeyProviders || [],
      packet: data?.packet || null,
    };
  } catch {
    return null;
  }
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
        if (
          parsed?.type === 'GARDEN_SYNC_PACK' &&
          (parsed.compressedDataset || parsed.packParam || parsed.apiKeys)
        ) {
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
      if (
        parsed?.type === 'GARDEN_SYNC_PACK' &&
        (parsed.compressedDataset || parsed.packParam || parsed.apiKeys)
      ) {
        return parsed as P2PRoomPacket;
      }
    } catch {
      // ignore non-Grow messages
    }
  }

  return null;
}

/**
 * Fetches the most recent cached P2P garden snapshot from the same-origin `/api/p2p`
 * hybrid store (in-memory + deflate-compressed public relay) with fallback to legacy topic.
 */
export async function fetchLatestFromP2PRoom(
  roomId: string
): Promise<{ dataset: AiDataset; peerName: string; timestamp: string; apiKeys?: FreeLlmConfig } | null> {
  if (!roomId.trim()) return null;

  // 1. Primary path: same-origin /api/p2p (immune to browser adblockers/CORS, uses deflate compression + server memory)
  try {
    const apiRes = await fetch(`/api/p2p?room=${encodeURIComponent(roomId.trim())}`, {
      cache: 'no-store',
    });
    if (apiRes.ok) {
      const apiData = await apiRes.json();
      const hasDataset = Boolean(apiData?.hasSnapshot && apiData?.dataset);
      const hasKeys = Boolean(
        apiData?.apiKeys &&
        (apiData.apiKeys.gemini || apiData.apiKeys.groq || apiData.apiKeys.openrouter || apiData.apiKeys.ollamaUrl)
      );
      if (hasDataset || hasKeys) {
        return {
          dataset: (apiData.dataset || createEmptySyncDataset()) as AiDataset,
          peerName: apiData.packet?.peerName || 'Garden Peer',
          timestamp: apiData.packet?.timestamp || new Date().toISOString(),
          apiKeys: apiData.apiKeys || apiData.packet?.apiKeys,
        };
      }
    }
  } catch {
    // Fall through to direct relay fallback
  }

  // 2. Fallback: legacy direct ntfy.sh topic poll
  let fallbackEmptyResult: { dataset: AiDataset; peerName: string; timestamp: string; apiKeys?: FreeLlmConfig } | null = null;
  try {
    const topicUrl = `${getRelayTopicUrl(roomId)}/json?poll=1&since=24h`;
    const resp = await fetch(topicUrl, { cache: 'no-store' });
    if (resp.ok) {
      const text = await resp.text();
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const envelope = JSON.parse(lines[i]);
          const packet = await extractPacketFromNtfyEnvelope(envelope);
          if (packet?.type === 'GARDEN_SYNC_PACK') {
            let dataset: AiDataset | null = null;
            if (packet.compressedDataset) {
              dataset = await decompressDatasetFromWire(packet.compressedDataset);
            }
            if (!dataset && packet.packParam) {
              dataset = decodeSeedPackFromInput(packet.packParam);
            }
            if (!dataset) {
              dataset = createEmptySyncDataset();
            }
            const candidate = {
              dataset,
              peerName: packet.peerName || 'Garden Peer',
              timestamp: packet.timestamp || new Date().toISOString(),
              apiKeys: packet.apiKeys,
            };
            if ((dataset.plantings?.length || 0) > 0 || packet.apiKeys) {
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
    }
  } catch {
    // ignore direct relay error
  }

  // 3. Check local browser cache if relay had no populated snapshot
  if (typeof window !== 'undefined') {
    try {
      const cachedRaw = localStorage.getItem(getRoomCacheKey(roomId));
      if (cachedRaw) {
        const cachedPacket: P2PRoomPacket = JSON.parse(cachedRaw);
        const dataset = cachedPacket.packParam
          ? decodeSeedPackFromInput(cachedPacket.packParam)
          : createEmptySyncDataset();
        if ((dataset.plantings?.length || 0) > 0 || cachedPacket.apiKeys) {
          return {
            dataset,
            peerName: cachedPacket.peerName || 'Local Peer',
            timestamp: cachedPacket.timestamp,
            apiKeys: cachedPacket.apiKeys,
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
  onPeerDatasetReceived: (
    dataset: AiDataset,
    peerName: string,
    timestamp: string,
    apiKeys?: FreeLlmConfig,
    peerPubkey?: string
  ) => void
): () => void {
  if (typeof window === 'undefined' || !roomId.trim()) {
    return () => {};
  }

  const identity = getOrCreateGrowerIdentity();
  const seenPacketIds = new Set<string>();
  const channelName = `grow_room_${toSpeciesUid(roomId)}`;

  const handlePacket = async (packet: P2PRoomPacket) => {
    if (!packet || packet.type !== 'GARDEN_SYNC_PACK') return;
    if (seenPacketIds.has(packet.packetId)) return;
    seenPacketIds.add(packet.packetId);
    // Ignore our own broadcasts from echoing back via SSE
    if (packet.peerPubkey && packet.peerPubkey === identity.pubkey) return;
    try {
      let dataset: AiDataset | null = null;
      if (packet.compressedDataset) {
        dataset = await decompressDatasetFromWire(packet.compressedDataset);
      }
      if (!dataset && packet.packParam) {
        dataset = decodeSeedPackFromInput(packet.packParam);
      }
      if (!dataset && !packet.apiKeys) {
        const latest = await fetchLatestFromP2PRoom(roomId);
        if (latest) {
          dataset = latest.dataset;
        }
      }
      if (!dataset) {
        dataset = createEmptySyncDataset();
      }
      onPeerDatasetReceived(
        dataset,
        packet.peerName || 'Garden Peer',
        packet.timestamp || new Date().toISOString(),
        packet.apiKeys,
        packet.peerPubkey
      );
    } catch {
      // ignore malformed packet
    }
  };

  let bc: BroadcastChannel | null = null;
  const bcHandler = (ev: MessageEvent) => {
    if (ev.data?.type === 'GARDEN_SYNC_PACK') {
      void handlePacket(ev.data as P2PRoomPacket);
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
            await handlePacket(packet);
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
 * Broadcasts a garden dataset across:
 * 1. Same-origin `/api/p2p` (instant server memory store + deflate-compressed `ntfy.sh` v2 relay)
 * 2. Local `BroadcastChannel` + `localStorage` cache
 */
export async function broadcastGardenToP2PRoom(
  roomId: string,
  dataset: AiDataset,
  options?: {
    apiKeys?: FreeLlmConfig;
    shareApiKeys?: boolean;
  }
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

  let cleanKeys: FreeLlmConfig | undefined = undefined;
  if (options?.shareApiKeys && options.apiKeys) {
    const raw = options.apiKeys;
    const sanitized: FreeLlmConfig = {
      gemini: raw.gemini ? String(raw.gemini).trim() : '',
      groq: raw.groq ? String(raw.groq).trim() : undefined,
      openrouter: raw.openrouter ? String(raw.openrouter).trim() : undefined,
      ollamaUrl: raw.ollamaUrl ? String(raw.ollamaUrl).trim() : undefined,
    };
    if (sanitized.gemini || sanitized.groq || sanitized.openrouter || sanitized.ollamaUrl) {
      cleanKeys = sanitized;
    }
  }

  const packet: P2PRoomPacket = {
    packetId: `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'GARDEN_SYNC_PACK',
    peerPubkey: identity.pubkey,
    peerName: identity.displayName,
    packParam,
    gardenName: dataset.locations?.[0]?.name || (cleanKeys ? 'API Key Broadcast' : 'Shared Garden'),
    gardenCount: dataset.locations?.length || (cleanKeys ? 1 : 0),
    plantCount: dataset.plantings?.length || 0,
    timestamp: new Date().toISOString(),
    apiKeys: cleanKeys,
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

  // Primary publish via same-origin /api/p2p (stores in memory + deflate-compressed global relay)
  const apiRes = await fetch('/api/p2p', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'broadcast',
      roomId: roomId.trim(),
      peerPubkey: identity.pubkey,
      peerName: identity.displayName,
      dataset: compactDataset,
      apiKeys: cleanKeys,
    }),
  });

  if (!apiRes.ok) {
    // Fallback to direct relay if /api/p2p failed
    const resp = await fetch(getRelayTopicUrl(roomId), {
      method: 'POST',
      body: `GROW_PACK:${JSON.stringify(packet)}`,
    });
    if (!resp.ok) {
      throw new Error(`Relay broadcast failed with HTTP ${resp.status}`);
    }
  }

  return packet;
}

/**
 * Convenience helper to broadcast API keys to a P2P room (e.g., from SettingsSheet)
 * without needing plants or plantings.
 */
export async function broadcastApiKeysToP2PRoom(
  roomId: string,
  apiKeys: FreeLlmConfig
): Promise<P2PRoomPacket> {
  const placeholderDataset: AiDataset = createEmptySyncDataset();
  return broadcastGardenToP2PRoom(roomId, placeholderDataset, {
    apiKeys,
    shareApiKeys: true,
  });
}

export { PUBLIC_RELAYS };
