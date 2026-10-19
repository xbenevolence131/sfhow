import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.ORBITAL_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const clickUnit = async id => {
  const p = await page.evaluate(id => orbital.renderer.screen(orbital.world.units.find(u => u.id === id)), id);
  await page.mouse.click(p.x, p.y);
};
try {
  await page.goto(new URL('../dist/index.html', import.meta.url).href);
  await page.getByRole('button', { name: 'Explore freely' }).click();
  const ids = await page.evaluate(() => {
    orbital.load('playground'); orbital.closeModal();
    const r = orbital.world.units.find(u => u.type === 'rock' && u.boosterId);
    const b = orbital.world.units.find(u => u.id === r.boosterId);
    r.x = 0; r.y = 350; b.x = 16; b.y = 350;
    orbital.select(null);
    return { rock: r.id, booster: b.id };
  });
  await clickUnit(ids.booster);
  assert.equal(await page.evaluate(() => orbital.ui.selectedId), ids.rock);
  assert.equal(await page.locator('#order-aim').innerText(), 'Select booster');
  await page.locator('#order-aim').click({ delay: 350 });
  assert.equal(await page.evaluate(() => orbital.ui.selectedId), ids.booster);
  assert.equal(await page.locator('#order-aim').innerText(), 'Select rock');
  await page.mouse.click(750, 650, { button: 'right' });
  assert.equal(await page.evaluate(() => orbital.ui.pending.order.kind), 'move');
  assert.match(await page.locator('#plan-note').innerText(), /Detach/);
  await page.locator('#cancel').click();
  assert.equal(await page.evaluate(id => orbital.world.units.find(u => u.id === id).attachedRockId, ids.booster), ids.rock);
  await page.locator('#order-aim').click();
  assert.equal(await page.evaluate(() => orbital.ui.selectedId), ids.rock);
  await page.locator('#order-aim').click();
  const home = await page.evaluate(() => orbital.renderer.screen(orbital.world.planets.find(p => p.team === 'player')));
  await page.mouse.click(home.x, home.y, { button: 'right' });
  assert.equal(await page.evaluate(() => orbital.ui.pending.order.kind), 'rearm');
  await page.locator('#confirm').click();
  assert.equal(await page.evaluate(id => orbital.world.units.find(u => u.id === id).attachedRockId, ids.booster), null);
  assert.equal(await page.evaluate(id => orbital.world.units.find(u => u.id === id).order.kind, ids.booster), 'rearm');
  assert.equal(await page.locator('#order-aim').isVisible(), false);
  await page.evaluate(() => orbital.select(null));
  await clickUnit(ids.booster);
  assert.equal(await page.evaluate(() => orbital.ui.selectedId), ids.booster);
  assert.deepEqual(errors, []);
  console.log('Attached-pair selection, held toggle clicks, move preview/cancel, return-home confirmation, and separate selection after detach passed.');
} finally { await browser.close(); }
