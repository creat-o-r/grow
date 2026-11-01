import { NextRequest, NextResponse } from 'next/server';
import zlib from 'zlib';
import type { AiDataset, FreeLlmConfig } from '@/lib/types';

export const dynamic = 'force-dynamic';

export interface P2PRoomWirePacket {
  packetId: string;
  type: 'GARDEN_SYNC_PACK';
  roomId: string;
  peerPubkey: string;
  peerName: string;
  gardenName: string;
  gardenCount: number;
  plantCount: number;
  timestamp: string;
  /** Deflate-raw compressed base64url JSON of AiDataset */
  compressedDataset?: string;
  /** Legacy uncompressed base64url JSON of AiDataset */
  packParam?: string;
  /** Optional shared API keys (Gemini, Groq, OpenRouter, Ollama) */
  apiKeys?: FreeLlmConfig;
}

interface GlobalP2PStore {
  rooms: Map<string, { packet: P2PRoomWirePacket; dataset: AiDataset; updatedAt: number }>;
  pings: Map<string, { pingId: string; timestamp: string; sender: string }>;
}

const globalForP2P = globalThis as unknown as { __growP2PStore?: GlobalP2PStore };
if (!globalForP2P.__growP2PStore) {
  globalForP2P.__growP2PStore = {
    rooms: new Map(),
    pings: new Map(),
  };
}
const p2pStore = globalForP2P.__growP2PStore;

/** Identical to fingerprintDataset() in src/lib/p2p-signals.ts (FNV-1a over sorted planting ids). */
function fingerprintDataset(dataset: AiDataset): string {
  const ids = (dataset.plantings || []).map((p) => String(p.id)).sort();
  let h = 0x811c9dc5;
  for (const ch of ids.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${ids.length}-${h.toString(16).padStart(8, '0')}`;
}

function normalizeRoomSlug(roomId: string): string {
  return (
    roomId
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'default-room'
  );
}

function getRelayTopicUrl(roomId: string): string {
  const slug = normalizeRoomSlug(roomId);
  return `https://ntfy.sh/grow-p2p-v2-${slug}`;
}

function compressDataset(dataset: AiDataset): string {
  const compact: AiDataset = {
    locations: dataset.locations || [],
    plants: (dataset.plants || []).map((p) => ({
      ...p,
      imageUrl: p.imageUrl?.startsWith('data:') ? undefined : p.imageUrl,
    })),
    plantings: dataset.plantings || [],
  };
  const json = JSON.stringify(compact);
  return zlib.deflateRawSync(Buffer.from(json, 'utf-8')).toString('base64url');
}

function decompressDataset(packet: P2PRoomWirePacket): AiDataset | null {
  try {
    if (packet.compressedDataset) {
      const buf = Buffer.from(packet.compressedDataset, 'base64url');
      const json = zlib.inflateRawSync(buf).toString('utf-8');
      return JSON.parse(json) as AiDataset;
    }
    if (packet.packParam) {
      const json = Buffer.from(packet.packParam, 'base64url').toString('utf-8');
      return JSON.parse(json) as AiDataset;
    }
  } catch {
    // ignore malformed packet
  }
  return null;
}

async function parseEnvelopeToPacket(envelope: any): Promise<P2PRoomWirePacket | null> {
  if (!envelope || envelope.event !== 'message') return null;

  let rawText = '';
  if (envelope.attachment?.url) {
    try {
      const attRes = await fetch(envelope.attachment.url, { cache: 'no-store' });
      if (attRes.ok) {
        rawText = (await attRes.text()).trim();
      }
    } catch {
      // fall through
    }
  }
  if (!rawText && typeof envelope.message === 'string') {
    rawText = envelope.message.trim();
  }
  if (!rawText) return null;

  const cleaned = rawText.startsWith('GROW_PACK:')
    ? rawText.slice('GROW_PACK:'.length)
    : rawText;

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed?.type === 'GARDEN_SYNC_PACK') {
      return parsed as P2PRoomWirePacket;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * GET /api/p2p?room=<roomId>
 * Returns the latest garden snapshot in the room (from memory store + public relay)
 * along with connection diagnostic metadata.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // peek=1 returns metadata + fingerprint only (no dataset) so clients can poll cheaply for changes
  const peek = searchParams.get('peek') === '1';
  const roomId = (searchParams.get('room') || '').trim();
  if (!roomId) {
    return NextResponse.json({ ok: false, error: 'Missing room parameter' }, { status: 400 });
  }

  const slug = normalizeRoomSlug(roomId);
  const startMs = Date.now();
  const memoryEntry = p2pStore.rooms.get(slug);

  let relayPacket: P2PRoomWirePacket | null = null;
  let relayDataset: AiDataset | null = null;
  let relayReachable = false;
  let relayStatus = 0;

  try {
    const resp = await fetch(`${getRelayTopicUrl(roomId)}/json?poll=1&since=24h`, {
      cache: 'no-store',
    });
    relayStatus = resp.status;
    if (resp.ok) {
      relayReachable = true;
      const text = await resp.text();
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const env = JSON.parse(lines[i]);
          const pkt = await parseEnvelopeToPacket(env);
          if (pkt) {
            const ds = decompressDataset(pkt);
            const hasKeys = Boolean(
              pkt.apiKeys &&
              (pkt.apiKeys.gemini || pkt.apiKeys.groq || pkt.apiKeys.openrouter || pkt.apiKeys.ollamaUrl)
            );
            if (ds && ((ds.plantings?.length || 0) > 0 || hasKeys)) {
              relayPacket = pkt;
              relayDataset = ds;
              break;
            }
          }
        } catch {
          // continue
        }
      }
    }
  } catch {
    relayReachable = false;
  }

  // Pick whichever snapshot is newer between in-memory store and public relay
  let chosenPacket: P2PRoomWirePacket | null = null;
  let chosenDataset: AiDataset | null = null;
  let source: 'memory+relay' | 'memory' | 'relay' | 'none' = 'none';

  if (memoryEntry && relayPacket && relayDataset) {
    const memTime = new Date(memoryEntry.packet.timestamp).getTime() || memoryEntry.updatedAt;
    const relTime = new Date(relayPacket.timestamp).getTime() || 0;
    if (memTime >= relTime) {
      chosenPacket = memoryEntry.packet;
      chosenDataset = memoryEntry.dataset;
      source = 'memory+relay';
    } else {
      chosenPacket = relayPacket;
      chosenDataset = relayDataset;
      p2pStore.rooms.set(slug, {
        packet: relayPacket,
        dataset: relayDataset,
        updatedAt: Date.now(),
      });
      source = 'relay';
    }
  } else if (memoryEntry) {
    chosenPacket = memoryEntry.packet;
    chosenDataset = memoryEntry.dataset;
    source = relayReachable ? 'memory+relay' : 'memory';
  } else if (relayPacket && relayDataset) {
    chosenPacket = relayPacket;
    chosenDataset = relayDataset;
    p2pStore.rooms.set(slug, {
      packet: relayPacket,
      dataset: relayDataset,
      updatedAt: Date.now(),
    });
    source = 'relay';
  }

  return NextResponse.json({
    ok: true,
    roomId,
    slug,
    source,
    relayReachable,
    relayStatus,
    latencyMs: Date.now() - startMs,
    hasSnapshot: Boolean(chosenPacket && chosenDataset),
    packet: chosenPacket
      ? {
          packetId: chosenPacket.packetId,
          peerName: chosenPacket.peerName,
          peerPubkey: chosenPacket.peerPubkey,
          gardenName: chosenPacket.gardenName,
          gardenCount: chosenPacket.gardenCount,
          plantCount: chosenPacket.plantCount,
          timestamp: chosenPacket.timestamp,
          hasApiKeys: Boolean(
            chosenPacket.apiKeys &&
            (chosenPacket.apiKeys.gemini ||
              chosenPacket.apiKeys.groq ||
              chosenPacket.apiKeys.openrouter ||
              chosenPacket.apiKeys.ollamaUrl)
          ),
          sharedKeyProviders: chosenPacket.apiKeys
            ? (['gemini', 'groq', 'openrouter', 'ollamaUrl'] as const).filter(
                (k) => Boolean(chosenPacket?.apiKeys?.[k])
              )
            : [],
        }
      : null,
    dataset: peek ? undefined : chosenDataset,
    apiKeys: peek ? undefined : chosenPacket?.apiKeys,
    fingerprint: chosenDataset ? fingerprintDataset(chosenDataset) : null,
  });
}

/**
 * POST /api/p2p
 * Actions:
 * - { action: 'ping', roomId, peerName } -> Verifies end-to-end cross-session transport (memory + relay round-trip)
 * - { action: 'broadcast', roomId, peerPubkey, peerName, dataset } -> Compresses & stores garden snapshot in memory + public relay
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action || 'broadcast';
    const roomId = String(body?.roomId || '').trim();
    if (!roomId) {
      return NextResponse.json({ ok: false, error: 'Missing roomId' }, { status: 400 });
    }

    const slug = normalizeRoomSlug(roomId);
    const startMs = Date.now();

    if (action === 'ping') {
      const pingId = `ping-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const timestamp = new Date().toISOString();
      const sender = String(body?.peerName || 'Grower-Local');
      p2pStore.pings.set(slug, { pingId, timestamp, sender });

      let relayRoundTripOk = false;
      let relayStatus = 0;

      try {
        const postResp = await fetch(getRelayTopicUrl(roomId), {
          method: 'POST',
          body: `GROW_PING:${JSON.stringify({ pingId, roomId, sender, timestamp })}`,
        });
        relayStatus = postResp.status;
        if (postResp.ok) {
          const postJson = await postResp.json();
          relayRoundTripOk = Boolean(postJson?.id);
        }
      } catch {
        relayRoundTripOk = false;
      }

      const existingEntry = p2pStore.rooms.get(slug);

      return NextResponse.json({
        ok: true,
        action: 'ping',
        pingId,
        roomId,
        slug,
        memoryOk: p2pStore.pings.get(slug)?.pingId === pingId,
        relayRoundTripOk,
        relayStatus,
        latencyMs: Date.now() - startMs,
        roomSnapshot: existingEntry
          ? {
              peerName: existingEntry.packet.peerName,
              gardenName: existingEntry.packet.gardenName,
              gardenCount: existingEntry.packet.gardenCount,
              plantCount: existingEntry.packet.plantCount,
              timestamp: existingEntry.packet.timestamp,
            }
          : null,
      });
    }

    // Default action: 'broadcast'
    const dataset = body?.dataset as AiDataset | undefined;
    if (!dataset || !Array.isArray(dataset.plants) || !Array.isArray(dataset.plantings)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid dataset payload for P2P broadcast' },
        { status: 400 }
      );
    }

    const incomingApiKeys = body?.apiKeys as FreeLlmConfig | undefined;
    const sanitizedApiKeys: FreeLlmConfig | undefined = incomingApiKeys
      ? {
          gemini: incomingApiKeys.gemini ? String(incomingApiKeys.gemini).trim() : '',
          groq: incomingApiKeys.groq ? String(incomingApiKeys.groq).trim() : undefined,
          openrouter: incomingApiKeys.openrouter ? String(incomingApiKeys.openrouter).trim() : undefined,
          ollamaUrl: incomingApiKeys.ollamaUrl ? String(incomingApiKeys.ollamaUrl).trim() : undefined,
        }
      : undefined;
    const hasKeys = Boolean(
      sanitizedApiKeys &&
      (sanitizedApiKeys.gemini || sanitizedApiKeys.groq || sanitizedApiKeys.openrouter || sanitizedApiKeys.ollamaUrl)
    );

    const compressedDataset = compressDataset(dataset);
    const packet: P2PRoomWirePacket = {
      packetId: `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'GARDEN_SYNC_PACK',
      roomId,
      peerPubkey: String(body?.peerPubkey || 'local-peer'),
      peerName: String(body?.peerName || 'Grower-Local'),
      gardenName: dataset.locations?.[0]?.name || (hasKeys ? 'API Key Broadcast' : 'Shared Garden'),
      gardenCount: dataset.locations?.length || (hasKeys ? 1 : 0),
      plantCount: dataset.plantings?.length || 0,
      timestamp: new Date().toISOString(),
      compressedDataset,
      apiKeys: hasKeys ? sanitizedApiKeys : undefined,
    };

    // 1. Always save immediately to server memory store (instant cross-browser / cross-session sync)
    p2pStore.rooms.set(slug, {
      packet,
      dataset,
      updatedAt: Date.now(),
    });

    // 2. Also publish deflate-compressed packet to public relay (fits under 4KB without file attachment limits!)
    const wireString = `GROW_PACK:${JSON.stringify(packet)}`;
    let relayPublished = false;
    let relayStatus = 0;

    try {
      const headers: Record<string, string> = {};
      if (wireString.length > 3900) {
        headers.Filename = 'seedpack.json';
      }
      const resp = await fetch(getRelayTopicUrl(roomId), {
        method: 'POST',
        headers,
        body: wireString,
      });
      relayStatus = resp.status;
      relayPublished = resp.ok;
    } catch {
      relayPublished = false;
    }

    return NextResponse.json({
      ok: true,
      packet,
      wireBytes: wireString.length,
      memoryStored: true,
      relayPublished,
      relayStatus,
      latencyMs: Date.now() - startMs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'P2P server error' },
      { status: 500 }
    );
  }
}
