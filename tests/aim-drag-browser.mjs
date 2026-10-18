import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: process.env.ORBITAL_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(new URL('../dist/index.html', import.meta.url).href);
  await page.evaluate(() => { orbital.load('playground'); orbital.closeModal(); });
  const before = await page.evaluate(() => ({ time: orbital.world.time, metal: orbital.world.metal.player, camera: { ...orbital.renderer.camera } }));
  const preview = () => page.evaluate(() => ({ pending: orbital.ui.pending, points: orbital.ui.predictions.get(orbital.ui.selectedId).points }));
  await page.mouse.move(650, 600);
  await page.mouse.down({ button: 'right' });
  const initial = await preview();
  assert.ok(initial.pending.impulse);
  await page.mouse.move(800, 650, { steps: 8 });
  await page.waitForFunction(() => !orbital.previewDirty);
  const moved = await preview();
  assert.notDeepEqual(moved.pending.impulse, initial.pending.impulse);
  assert.notDeepEqual(moved.points, initial.points, 'trajectory changes before releasing the button');
  assert.ok(Math.hypot(moved.pending.impulse.x, moved.pending.impulse.y) <= 26.000001);
  // Crossing a planet during a manual drag must not switch to automatic aim,
  // including browsers which dispatch their context menu on mouse release.
  const planet = await page.evaluate(() => orbital.renderer.screen(orbital.world.planets[0]));
  await page.mouse.move(planet.x, planet.y, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  await page.locator('canvas').dispatchEvent('contextmenu', { clientX: planet.x, clientY: planet.y, button: 2 });
  const released = await preview();
  assert.equal(released.pending.aim, undefined);
  assert.equal(await page.evaluate(() => orbital.world.units.find(u => u.id === orbital.ui.selectedId).launched), false);
  assert.deepEqual(await page.evaluate(() => ({ time: orbital.world.time, metal: orbital.world.metal.player, camera: { ...orbital.renderer.camera } })), before);
  await page.keyboard.press('Escape');
  // Escape during a held drag must not recreate a cancelled preview.
  await page.mouse.move(650, 600); await page.mouse.down({ button: 'right' });
  await page.keyboard.press('Escape'); await page.mouse.move(750, 600); await page.mouse.up({ button: 'right' });
  assert.equal(await page.evaluate(() => orbital.ui.pending), null);
  // A later click on a planet still requests normal automatic targeting.
  await page.mouse.click(planet.x, planet.y, { button: 'right' });
  assert.ok(await page.evaluate(() => orbital.ui.pending.aim));
  await page.keyboard.press('Escape');
  await page.mouse.click(650, 600, { button: 'right' });
  await page.locator('#confirm').click();
  assert.equal(await page.evaluate(() => orbital.world.units.find(u => u.id === orbital.ui.selectedId).launched), true);
  assert.deepEqual(errors, []);
  console.log('Held right-drag passed: live trajectory, impulse cap, release over planet, no premature launch or pan, Escape, subsequent automatic aim, explicit launch confirmation.');
} finally { await browser.close(); }
