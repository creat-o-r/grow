#!/usr/bin/env node
/**
 * Cross-session P2P check. Sends NOTHING and uses NO fake data.
 *
 *   1. In the app, click "Stream All Gardens" (or the Test button) with your real garden.
 *   2. From any other client/terminal:   npm run test:p2p -- <your-room-code>
 *      (BASE=https://your.app to point at a deployed copy; default http://localhost:9002)
 *
 * It pulls your real room two independent ways and prints what each one sees:
 *   - via the app server (/api/p2p)
 *   - directly from the public relay (no app server involved)
 */
import zlib from 'node:zlib';

const BASE = process.env.BASE || 'http://localhost:9002';
const room = process.argv[2];
if (!room) {
  console.error('Usage: npm run test:p2p -- <room-code>');
  process.exit(2);
}

const slug = room
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 64) || 'default-room';

const summarize = (ds) =>
  `${ds.plantings?.length ?? 0} plantings, ${ds.plants?.length ?? 0} plants, ${ds.locations?.length ?? 0} garden(s): ${(ds.locations || []).map((l) => l.name).join(', ')}`;

// Identical to fingerprintDataset() in src/lib/p2p-signals.ts: compare with the app's fingerprints.
const fingerprint = (ds) => {
  const ids = (ds.plantings || []).map((p) => String(p.id)).sort();
  let h = 0x811c9dc5;
  for (const ch of ids.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${ids.length}-${h.toString(16).padStart(8, '0')}`;
};

let failed = 0;
const report = (label, ds, extra = '') => {
  const ok = !!ds && (ds.plantings?.length ?? 0) > 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${ds ? `${summarize(ds)} | fingerprint ${fingerprint(ds)}` : 'nothing found'} ${extra}`);
};

console.log(`Room: ${room}\n`);

// Client 1: through the app server
try {
  const r = await fetch(`${BASE}/api/p2p?room=${encodeURIComponent(room)}`, { cache: 'no-store' }).then((x) => x.json());
  report('via app server', r.hasSnapshot ? r.dataset : null, `(source=${r.source}, handle: ${r.packet?.peerName ?? '?'})`);
} catch (e) {
  failed++;
  console.log(`FAIL  via app server: ${e.message} (is the dev server running at ${BASE}?)`);
}

// Client 2: straight from the relay
try {
  const topic = `https://ntfy.sh/grow-p2p-v2-${slug}`;
  const lines = (await fetch(`${topic}/json?poll=1&since=24h`).then((x) => x.text())).split('\n').filter(Boolean);
  let found = null;
  let peer = '?';
  for (const line of lines.reverse()) {
    const env = JSON.parse(line);
    let raw = env.message || '';
    if (env.attachment?.url) raw = await fetch(env.attachment.url).then((x) => x.text());
    if (!raw.startsWith('GROW_PACK:')) continue;
    const pkt = JSON.parse(raw.slice('GROW_PACK:'.length));
    if (!pkt.compressedDataset) continue;
    found = JSON.parse(zlib.inflateRawSync(Buffer.from(pkt.compressedDataset, 'base64url')).toString());
    peer = pkt.peerName;
    break;
  }
  report('via public relay (no app server)', found, `(handle: ${peer})`);
} catch (e) {
  failed++;
  console.log(`FAIL  via public relay: ${e.message}`);
}

console.log(failed ? '\nNo real garden found in that room. Stream one from the app first.' : '\nReal garden is retrievable from independent clients.');
process.exitCode = failed ? 1 : 0;
