import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.ORBITAL_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const heldClick = selector => page.locator(selector).click({ delay: 350 });
try {
  await page.goto(process.env.ORBITAL_URL || new URL('../dist/index.html', import.meta.url).href);
  await heldClick('#modal-action');
  // Every control must survive both refreshes and scenario/selection changes.
  const audit = await page.evaluate(() => {
    const controls = [...document.querySelectorAll('button, input, select, a')];
    let refreshes = 0;
    for (const scenario of ['garden', 'hold', 'neighbors']) {
      orbital.load(scenario); orbital.closeModal();
      for (const object of [...orbital.world.planets, ...orbital.world.units, null]) {
        orbital.select(object?.id || null);
        for (let i = 0; i < 3; i++) {
          if (object) object.hp -= .1;
          if (object?.type === 'ship') orbital.ui.predictions.set(object.id, { eta: 20 - i });
          orbital.updateUI(); refreshes++;
        }
      }
    }
    return { count: controls.length, refreshes, removed: controls.filter(c => !c.isConnected).map(c => c.id || c.outerHTML) };
  });
  assert.deepEqual(audit.removed, []);
  for (const type of ['drone', 'ship', 'booster']) {
    await page.evaluate(type => {
      orbital.load('garden'); orbital.closeModal();
      orbital.select(orbital.world.units.find(u => u.type === type).id);
      orbital.setSpeed(5);
    }, type);
    await page.locator('#order-stop').focus();
    await page.waitForTimeout(750);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'order-stop');
    await heldClick('#order-stop');
    assert.equal(await page.evaluate(() => orbital.ui.pending?.order.kind), 'stop');
    await heldClick('#confirm');
    assert.equal(await page.evaluate(() => orbital.world.units.find(u => u.id === orbital.ui.selectedId).order.kind), 'stop');
    await heldClick('[data-speed="5"]');
    await heldClick('#order-defend');
    assert.equal(await page.evaluate(() => orbital.ui.pending?.order.kind), type === 'booster' ? 'rearm' : 'defend');
    await heldClick('#cancel');
    assert.equal(await page.evaluate(() => orbital.ui.pending), null);
    await heldClick('#order-defend'); await heldClick('#confirm');
    assert.equal(await page.evaluate(() => orbital.world.units.find(u => u.id === orbital.ui.selectedId).order.kind), type === 'booster' ? 'rearm' : 'defend');
    await heldClick('#order-home');
    assert.equal(await page.evaluate(() => orbital.ui.selectedId), 'verdant');
  }
  // Empty/destroyed selection still offers a functioning route back to deployment.
  await page.evaluate(() => orbital.select('missing-unit'));
  await heldClick('#order-home');
  assert.equal(await page.evaluate(() => orbital.ui.selectedId), 'verdant');
  await page.evaluate(() => { orbital.load('garden'); orbital.closeModal(); orbital.setSpeed(5); });
  for (const type of ['ship', 'platform', 'drone', 'booster']) {
    const before = await page.evaluate(() => orbital.world.units.length);
    await heldClick(`[data-build="${type}"]`);
    assert.equal(await page.evaluate(() => orbital.world.units.length), before + 1);
  }
  await heldClick('#rock-tool');
  assert.equal(await page.evaluate(() => orbital.world.units.find(u => u.id === orbital.ui.selectedId).type), 'rock');
  await heldClick('#order-fit');
  assert.equal(await page.evaluate(() => orbital.ui.pending?.order.kind), 'fit');
  await heldClick('#cancel');
  await heldClick('[data-speed="5"]');
  await heldClick('#pause'); assert.equal(await page.evaluate(() => orbital.paused), true);
  for (const speed of [1, 5, 20]) {
    await heldClick(`[data-speed="${speed}"]`);
    assert.equal(await page.evaluate(() => orbital.speed), speed);
    assert.equal(await page.evaluate(() => orbital.paused), false);
  }
  for (const selector of ['#trajectories', '#ranges', '#autopause']) {
    const before = await page.locator(selector).isChecked();
    await heldClick(selector);
    assert.equal(await page.locator(selector).isChecked(), !before);
  }
  await page.evaluate(() => { orbital.renderer.camera.zoom = 2; });
  await heldClick('#fit'); assert.ok(await page.evaluate(() => orbital.renderer.camera.zoom) < 2);
  await page.evaluate(() => { orbital.renderer.camera.zoom = 2; });
  await heldClick('.wordmark'); assert.ok(await page.evaluate(() => orbital.renderer.camera.zoom) < 2);
  await heldClick('#help');
  assert.equal(await page.evaluate(() => orbital.modalOpen()), true);
  await heldClick('#modal-action');
  await heldClick('#restart');
  assert.equal(await page.evaluate(() => orbital.world.time), 0);
  await heldClick('#modal-action');
  for (const scenario of ['hold', 'neighbors', 'garden']) {
    await page.locator('#scenario').selectOption(scenario);
    assert.equal(await page.evaluate(() => orbital.world.scenario), scenario);
    await heldClick('#modal-action');
  }
  await heldClick('#practice');
  assert.equal(await page.evaluate(() => orbital.world.units.filter(u => u.practice).length), 1);
  await page.evaluate(() => { orbital.world.outcome = 'victory'; orbital.showOutcome(); });
  await heldClick('#modal-secondary');
  assert.equal(await page.evaluate(() => orbital.world.continueSandbox), true);
  assert.deepEqual(errors, []);
  console.log(`Control audit passed: ${audit.count} controls persisted through ${audit.refreshes} changing-state refreshes; held clicks exercised deployment, navigation, toggles, and mobile orders. Attachment-specific buttons are exercised in the browser gameplay test.`);
} finally { await browser.close(); }
