import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('../.orbital-playtest/', import.meta.url));
const port = Number(process.env.ORBITAL_PLAYTEST_PORT || 9333);
const ago = Math.max(0, Number(process.argv.find(a => a.startsWith('--ago='))?.slice(6) || 0));
const seconds = Math.max(1, Math.min(120, Number(process.argv.find(a => a.startsWith('--seconds='))?.slice(10) || 20)));
const readJSON = async file => JSON.parse(await readFile(file, 'utf8'));
let live = true, metadata, history, status;
try {
  metadata = await fetch(`http://127.0.0.1:${port}/snapshot`, { signal: AbortSignal.timeout(15000) }).then(r => r.json());
  status = await fetch(`http://127.0.0.1:${port}/status`).then(r => r.json());
  history = await fetch(`http://127.0.0.1:${port}/recent?seconds=${ago ? 120 : seconds}`).then(r => r.json());
} catch {
  live = false;
  try { status = await readJSON(path.join(directory, 'session.json')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.log(JSON.stringify({ live: false, ready: false, note: 'The shared playtest is still starting or has not been launched. Run npm run playtest, then inspect again.' }, null, 2));
    process.exit(0);
  }
  history = await readJSON(path.join(status.sessionDir, 'history.json'));
  metadata = status.latest;
}
if (ago) {
  const target = Date.now() - ago * 1000;
  metadata = history.frames.filter(f => f.capturedAt <= target).at(-1);
  if (!metadata) throw new Error(`No frame remains from ${ago} seconds ago. Available rolling history is up to 120 seconds.`);
}
if (!metadata?.snapshotPath) {
  console.log(JSON.stringify({ live, status, message: 'No recorded game frame is available yet.' }, null, 2));
} else {
  const snapshot = await readJSON(metadata.snapshotPath), start = (ago ? metadata.capturedAt : Date.now()) - seconds * 1000;
  const end = ago ? metadata.capturedAt + 1000 : Date.now();
  console.log(JSON.stringify({
    live: live && !ago && metadata.recording, recording: status.recording,
    note: !live ? 'Window not connected; inspecting saved history.' : metadata.reason || (ago ? 'Historical frame.' : 'Current game session.'),
    capturedAt: new Date(metadata.capturedAt).toISOString(), ageSeconds: Math.round((Date.now() - metadata.capturedAt) / 1000),
    screenshotPath: metadata.screenshotPath, snapshotPath: metadata.snapshotPath, sessionDir: status.sessionDir,
    cursor: snapshot.cursor, viewport: snapshot.viewport, state: snapshot.controls,
    selected: snapshot.selected, ui: snapshot.ui,
    threats: snapshot.world.units.filter(u => u.hp > 0 && u.team === 'enemy' && (u.launched && u.type === 'rock' || ['attack', 'fit'].includes(u.order?.kind))).map(u => ({ id: u.id, name: u.name, type: u.type, x: u.x, y: u.y, hp: u.hp, order: u.order, attachProgress: u.attachProgress })),
    recentEvents: history.events.filter(e => e.at >= start && e.at <= end && e.type !== 'pointermove').slice(-45),
  }, null, 2));
}
