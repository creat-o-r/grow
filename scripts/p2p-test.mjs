#!/usr/bin/env node
/**
 * Simplest cross-session P2P test.
 *
 *   npm run test:p2p            (dev server must be running on :9002)
 *   BASE=https://your.app npm run test:p2p
 *
 * Session A streams a garden into a random room. Session B (a separate fetch client with no
 * shared state) pulls it back. Then it bypasses the app server and reads the public relay
 * directly, proving the cross-device path works even if server memory is cold (e.g. Vercel).
 */
import zlib from 'node:zlib';

const BASE = process.env.BASE || 'http://localhost:9002';
const room = `p2p-selftest-${Date.now().toString(36)}`;
const PLANTS = 12;

const plants = Array.from({ length: PLANTS }, (_, i) => ({
  id: `p-${i}`,
  species: `Solanum lycopersicum var. ${i}`,
  commonName: `Tomato ${i}`,
  optimalConditions: 'Full sun, warm loamy soil',
  germinationNeeds: '22C moist seed mix',
}));
const dataset = {
  locations: [{ id: 'g-1', name: 'Session A Garden', location: 'Test', conditions: { sunlight: 'Full Sun', soil: 'Loam' } }],
  plants,
  plantings: plants.map((p, i) => ({
    id: `pl-${i}`,
    plantId: p.id,
    gardenId: 'g-1',
    name: p.commonName,
    createdAt: new Date().toISOString(),
    history: [{ id: `h-${i}`, status: 'Planted', date: new Date().toISOString(), notes: 'ok' }],
  })),
};

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
};

const slug = room.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);

console.log(`Server: ${BASE}\nRoom:   ${room}\n`);

try {
  // Session A: stream
  const a = await fetch(`${BASE}/api/p2p`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'broadcast', roomId: room, peerPubkey: 'npub-A', peerName: 'Session-A', dataset }),
  }).then((r) => r.json());
  check('A streams garden', a.ok, `wire=${a.wireBytes}B`);
  check('A -> server memory', a.memoryStored);
  check('A -> public relay', a.relayPublished, `status=${a.relayStatus}`);

  // Session B: pull via app API
  const b = await fetch(`${BASE}/api/p2p?room=${encodeURIComponent(room)}`, { cache: 'no-store' }).then((r) => r.json());
  check('B pulls snapshot', b.hasSnapshot, `source=${b.source}`);
  check('B gets all plants', b.dataset?.plantings?.length === PLANTS, `${b.dataset?.plantings?.length}/${PLANTS}`);
  check('B sees sender', b.packet?.peerName === 'Session-A');

  // Session C: relay only (no app server memory involved)
  const topic = `https://ntfy.sh/grow-p2p-v2-${slug}`;
  const lines = (await fetch(`${topic}/json?poll=1&since=1h`).then((r) => r.text())).split('\n').filter(Boolean);
  let relayPlants = 0;
  for (const line of lines.reverse()) {
    const env = JSON.parse(line);
    let raw = env.message || '';
    if (env.attachment?.url) raw = await fetch(env.attachment.url).then((r) => r.text());
    if (!raw.startsWith('GROW_PACK:')) continue;
    const pkt = JSON.parse(raw.slice('GROW_PACK:'.length));
    const ds = JSON.parse(zlib.inflateRawSync(Buffer.from(pkt.compressedDataset, 'base64url')).toString());
    relayPlants = ds.plantings.length;
    break;
  }
  check('C reads relay directly (cold server)', relayPlants === PLANTS, `${relayPlants}/${PLANTS}`);
} catch (e) {
  check('test run', false, e.message + ' (is the dev server running?)');
}

console.log(failed ? `\n${failed} check(s) failed` : '\nCross-session P2P works.');
process.exit(failed ? 1 : 0);
