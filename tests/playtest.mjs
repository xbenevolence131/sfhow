import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startPlaytest } from '../scripts/playtest.mjs';
const directory = fileURLToPath(new URL(`../test-results/playtest-${Date.now()}/`, import.meta.url));
// --headed exercises native Windows popups; headless Chrome does not reproduce
// the original screenshot-dismisses-select regression.
const headed = process.argv.includes('--headed');
const session = await startPlaytest({ headless: !headed, directory, port: 9334, interval: 60000 });
const page = session.page, errors = [];
page.on('pageerror', error => errors.push(error.message));
const get = async endpoint => fetch(`http://127.0.0.1:9334${endpoint}`).then(r => r.json());
try {
  assert.ok(await page.locator('#playtest-status').innerText().then(t => t.includes('RECORDING')));
  await page.locator('#modal-action').click();
  // Keep the real select popup open across repeated captures, then commit a
  // choice through its keyboard interaction (selectOption bypasses the popup).
  for (const [scenario, steps] of [['hold', 1], ['neighbors', 2], ['garden', 0]]) {
    await page.locator('#scenario').click();
    assert.equal(await page.locator('#scenario').evaluate(e => e.matches(':open')), true);
    const viewportBefore = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]);
    for (let i = 0; i < 3; i++) {
      await get('/snapshot');
      assert.equal(await page.locator('#scenario').evaluate(e => e.matches(':open')), true, 'Recording must leave the scenario popup open');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'scenario');
      assert.deepEqual(await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]), viewportBefore);
    }
    await page.keyboard.press('Home');
    for (let i = 0; i < steps; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => orbital.world.scenario), scenario);
    await page.locator('#modal-action').click();
  }
  const drone = await page.evaluate(() => orbital.renderer.screen(orbital.world.units.find(u => u.type === 'drone')));
  await page.mouse.click(drone.x, drone.y);
  await Promise.all([page.locator('#order-stop').click({ delay: 350 }), get('/snapshot')]);
  await Promise.all([page.locator('#confirm').click({ delay: 350 }), get('/snapshot')]);
  await page.mouse.move(700, 450);
  const current = await get('/snapshot');
  assert.equal(current.recording, true);
  const snapshot = JSON.parse(await readFile(current.snapshotPath, 'utf8'));
  assert.equal(snapshot.selected.type, 'drone'); assert.equal(snapshot.selected.order.kind, 'stop');
  assert.equal(snapshot.cursor.x, 700); assert.equal(snapshot.cursor.y, 450); assert.equal(snapshot.cursor.inside, true);
  await access(current.screenshotPath);
  await Promise.all([page.locator('#order-defend').click({ delay: 350 }), get('/snapshot')]);
  await Promise.all([page.locator('#confirm').click({ delay: 350 }), get('/snapshot')]);
  assert.equal(await page.evaluate(() => orbital.world.units.find(u => u.id === orbital.ui.selectedId).order.kind), 'defend');
  await Promise.all([page.locator('#order-home').click({ delay: 350 }), get('/snapshot')]);
  assert.equal(await page.evaluate(() => orbital.ui.selectedId), 'verdant');
  let history = await get('/recent?seconds=120');
  assert.ok(history.events.some(e => e.type === 'pointerdown' && e.target.id === 'space' && e.worldPoint));
  assert.ok(history.events.some(e => e.type === 'action' && e.action === 'confirm' && e.accepted));
  assert.ok(history.events.some(e => e.type === 'input-result'));
  // Rejected game action has both feedback and an unchanged result in the log.
  await page.evaluate(() => {
    const rock = orbital.world.units.find(u => u.type === 'rock' && !u.boosterTeam);
    orbital.plan({ id: rock.id, impulse: { x: -5, y: 0 } });
  });
  await get('/snapshot'); history = await get('/recent?seconds=120');
  assert.ok(history.events.some(e => e.type === 'action' && e.action === 'plan' && e.accepted === false));
  assert.ok(history.events.some(e => e.type === 'feedback' && e.message.includes('Attach a booster')));
  await page.locator('#playtest-mark').click();
  const marked = await get('/snapshot');
  const folders = await readdir(path.join(session.sessionDir, 'marks'));
  assert.equal(folders.length, 1);
  const mark = JSON.parse(await readFile(path.join(session.sessionDir, 'marks', folders[0], 'history.json'), 'utf8'));
  assert.equal(mark.mark.type, 'bookmark'); assert.ok(mark.frames.length >= 2);
  for (const frame of mark.frames) await access(frame.screenshotPath);
  await page.locator('#playtest-toggle').click();
  await page.mouse.move(900, 500);
  const paused = await get('/snapshot');
  assert.equal(paused.recording, false); assert.equal(paused.capturedAt, marked.capturedAt);
  history = await get('/recent?seconds=120');
  assert.ok(history.events.some(e => e.type === 'recording-paused'));
  assert.equal(history.events.some(e => e.type === 'pointermove' && e.cursor.x === 900 && e.cursor.y === 500), false);
  await page.locator('#playtest-toggle').click();
  const resumed = await get('/snapshot'); assert.equal(resumed.recording, true); assert.ok(resumed.capturedAt > paused.capturedAt);
  // Marking and immediately pausing still preserves the prior recorded history.
  await page.locator('#playtest-mark').click(); await page.locator('#playtest-toggle').click();
  await get('/snapshot');
  assert.equal((await readdir(path.join(session.sessionDir, 'marks'))).length, 2);
  await page.locator('#playtest-toggle').click();
  // Reload gets a new recorder sequence without losing the existing history.
  await page.reload(); await get('/snapshot'); history = await get('/recent?seconds=120');
  assert.equal(history.events.filter(e => e.type === 'session-start').length, 2);
  const beforeNavigation = (await get('/status')).lastCaptureAt;
  await page.goto('about:blank');
  const away = await get('/snapshot'); assert.equal(away.recording, false); assert.equal(away.capturedAt, beforeNavigation);
  // The normal game has neither a recorder nor debug controls.
  await page.goto(new URL('../dist/index.html', import.meta.url).href);
  assert.equal(await page.evaluate(() => !!window.orbitalPlaytest), false);
  assert.equal(await page.locator('#playtest-toolbar').count(), 0);
  assert.deepEqual(errors, []);
  console.log(`Shared playtest checks passed (${headed ? 'headed' : 'headless'}): native scenario menu survives repeated captures, all scenarios selectable, held order clicks during capture, same-session screenshots/state, cursor and input history, accepted/rejected actions, preserved bookmarks, recording pause/resume, reload continuity, game-only capture, and opt-in isolation.`);
} finally { await session.close(); }
