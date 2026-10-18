import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({executablePath:process.env.ORBITAL_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:960}}), errors=[];
page.on('pageerror',e=>errors.push(e.message));
const stage = n => page.waitForFunction(n=>orbital.tutorial?.stage===n,n);
const pos = id => page.evaluate(id=>orbital.renderer.screen(orbital.world.units.find(u=>u.id===id)),id);
try {
  await page.goto(new URL('../dist/index.html',import.meta.url).href);
  assert.equal(await page.locator('#modal-action').innerText(),'Start tutorial');
  await page.locator('#modal-action').click();
  await stage(0);
  for(const selector of ['#tutorial-step','#tutorial-skip','#tutorial-title']) {
    assert.equal(await page.locator(selector).evaluate(el=>getComputedStyle(el).color),'rgb(255, 114, 237)');
  }
  assert.equal(await page.evaluate(()=>orbital.paused && orbital.world.time===0),true);
  const booster = await page.evaluate(()=>orbital.ui.tutorialId);
  const b=await pos(booster); await page.mouse.click(b.x,b.y); await stage(1);
  const rock = await page.evaluate(()=>orbital.ui.tutorialId);
  assert.equal(await page.evaluate(()=>orbital.ui.tutorialAction),'RIGHT-CLICK');
  const r=await pos(rock); await page.mouse.click(r.x,r.y,{button:'right'});
  assert.equal(await page.locator('#confirm').evaluate(el=>el.classList.contains('tutorial-focus')),true);
  await page.locator('#cancel').click(); await stage(1);
  await page.mouse.click(r.x,r.y,{button:'right'}); await page.locator('#confirm').click(); await stage(2);
  assert.equal(await page.evaluate(()=>orbital.paused),true);
  await page.locator('#autopause').uncheck();
  await page.locator('[data-speed="20"]').click();
  await stage(3); await page.locator('#pause').click();
  assert.equal(await page.evaluate(()=>orbital.ui.tutorialId),rock);
  assert.equal(await page.evaluate(()=>orbital.ui.tutorialAction),'LEFT-CLICK');
  const equipped=await pos(rock); await page.mouse.click(equipped.x,equipped.y);
  assert.equal(await page.evaluate(()=>orbital.ui.tutorialId),'ochre');
  assert.equal(await page.evaluate(()=>orbital.ui.tutorialAction),'RIGHT-CLICK');
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/orbital-tutorial-target.png'});
  const planet=await page.evaluate(()=>orbital.renderer.screen(orbital.world.planets.find(p=>p.id==='ochre')));
  await page.mouse.click(planet.x,planet.y,{button:'right'}); await stage(4);
  assert.equal(await page.evaluate(()=>orbital.ui.pending.aim.targetId),'ochre');
  await page.locator('#cancel').click(); await stage(3);
  await page.mouse.move(1060,480); await page.mouse.down({button:'right'});
  await page.mouse.move(1100,530,{steps:4}); await page.mouse.up({button:'right'}); await stage(4);
  assert.equal(await page.evaluate(()=>orbital.world.progress.launched),false);
  await page.locator('#cancel').click(); await stage(3);
  await page.mouse.click(1100,530,{button:'right'}); await stage(4);
  await page.locator('#confirm').click(); await stage(4);
  assert.equal(await page.locator('#tutorial-title').innerText(),'Let your rock fly');
  assert.equal(await page.locator('#pause').evaluate(el=>el.classList.contains('tutorial-focus')),true);
  await page.locator('[data-speed="20"]').click(); await stage(5);
  await page.locator('#pause').click();
  await page.locator('#practice').click(); await stage(6);
  // Observe a real interception. A practice booster may be intercepted before
  // launching; the guide must return to the retry instruction in that case.
  for(let attempt=0;attempt<4;attempt++) {
    await page.locator('[data-speed="20"]').click();
    await page.waitForFunction(()=>orbital.world.progress.intercepted || !orbital.world.units.some(u=>u.hp>0&&u.practice&&(u.type==='rock'||u.order?.kind==='fit')),null,{timeout:25000});
    if(await page.evaluate(()=>orbital.world.progress.intercepted))break;
    await stage(5); await page.locator('#practice').click(); await stage(6);
  }
  await stage(7);
  assert.equal(await page.evaluate(()=>orbital.world.progress.intercepted),true);
  await page.locator('#modal-secondary').click();
  assert.equal(await page.locator('#tutorial').isVisible(),false);
  // Starting again, skipping, and changing scenario clear all highlights.
  await page.reload(); await page.locator('#modal-action').click(); await stage(0);
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/orbital-tutorial.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/orbital-tutorial-mobile.png'});
  await page.locator('#tutorial-skip').click();
  assert.equal(await page.evaluate(()=>orbital.ui.tutorialId),null);
  assert.equal(await page.locator('.tutorial-focus').count(),0);
  await page.reload(); await page.locator('#modal-secondary').click();
  assert.equal(await page.locator('#tutorial').isVisible(),false);
  await page.reload(); await page.locator('#modal-action').click();
  await page.locator('#scenario').selectOption('hold'); await page.locator('#modal-action').click();
  assert.equal(await page.locator('#tutorial').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('Tutorial passed: real selection, canceled order, rendezvous/attachment, aim/cancel, launch, practice interception, completion, skip, free exploration, scenario change, and mobile layout.');
} finally { await browser.close(); }
