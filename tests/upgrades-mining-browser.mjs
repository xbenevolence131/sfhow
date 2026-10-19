import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.ORBITAL_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(new URL('../dist/index.html',import.meta.url).href);await page.locator('#modal-secondary').click();
  await page.evaluate(()=>{orbital.load('neighbors',{mode:'skirmish',budget:400,layoutSeed:17,visitorSeed:42});orbital.closeModal();orbital.world.ai.disabled=true;orbital.world.visitors.nextAt=Infinity;});
  for(const type of ['ship','platform','drone']){
    await page.evaluate(type=>orbital.select(orbital.world.units.find(u=>u.type===type&&u.team==='player').id),type);
    const button=await page.locator('#order-upgrade').elementHandle();await button.hover();await page.waitForTimeout(400);
    assert.ok(await button.evaluate(el=>el===document.getElementById('order-upgrade')));
    await page.locator('#order-upgrade').click();assert.match(await page.locator('#selected-meta').innerText(),/SUPER/);
    assert.equal(await page.locator('#unit-upgrade').isVisible(),false);
  }
  assert.equal(await page.evaluate(()=>orbital.world.metal.player),332.5);
  await page.evaluate(()=>orbital.select(orbital.world.planets.find(p=>p.team==='player').id));
  await page.locator('[data-build="miner"]').click();
  const target=await page.evaluate(()=>{const g=orbital,m=g.world.units.find(u=>u.type==='miner'&&u.team==='player'),r=g.world.units.filter(u=>u.innerRock).sort((a,b)=>Math.hypot(a.x-m.x,a.y-m.y)-Math.hypot(b.x-m.x,b.y-m.y))[0];g.select(m.id);g.renderer.camera.x=r.x;g.renderer.camera.y=r.y;return {id:r.id,...g.renderer.screen(r)};});
  await page.mouse.click(target.x,target.y,{button:'right'});await page.waitForFunction(()=>orbital.ui.pending?.order?.kind==='mine');
  assert.match(await page.locator('#plan-note').innerText(),/treasury/);
  await page.locator('#confirm').click();await page.locator('#autopause').uncheck();await page.locator('[data-speed="20"]').click();
  await page.waitForFunction(()=>orbital.world.units.some(u=>u.type==='miner'&&u.team==='player'&&u.miningRockId),null,{timeout:45000});
  await page.evaluate(()=>{orbital.paused=true;orbital.updateUI();});assert.match(await page.locator('#selected-meta').innerText(),/Mining.*0.2/);
  const money=await page.evaluate(()=>orbital.world.metal.player);assert.ok(money>240);
  assert.match(await page.locator('#selected-meta').innerText(),/Metal remaining:/);
  await page.evaluate(()=>{const m=orbital.world.units.find(u=>u.type==='miner'&&u.team==='player');orbital.world.units.find(r=>r.id===m.miningRockId).metalRemaining=.02;orbital.setSpeed(5);});
  await page.waitForFunction(()=>orbital.world.units.some(u=>u.type==='rock'&&u.minerId&&u.metalRemaining===0));
  await page.evaluate(()=>{orbital.paused=true;orbital.updateUI();});
  assert.match(await page.locator('#selected-meta').innerText(),/depleted/);
  assert.ok(!(await page.locator('#income-hint').innerText()).includes('from miners'));
  await page.evaluate(()=>{const g=orbital,m=g.world.units.find(u=>u.type==='miner'&&u.team==='player');g.select(g.world.units.find(u=>u.type==='ship'&&u.team==='player').id);g.renderer.camera.x=m.x;g.renderer.camera.y=m.y;});
  const minerPoint=await page.evaluate(()=>orbital.renderer.screen(orbital.world.units.find(u=>u.type==='miner'&&u.team==='player')));
  await page.mouse.click(minerPoint.x,minerPoint.y,{button:'right'});await page.locator('#confirm').click();assert.match(await page.locator('#selected-meta').innerText(),/Escort/);
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/upgrades-mining.png'});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>orbital.select(orbital.world.units.find(u=>u.type==='miner'&&u.team==='player').id));
  await page.screenshot({path:'test-results/upgrades-mining-mobile.png'});
  assert.ok(await page.locator('#order-defend').isVisible());await page.locator('#order-defend').click();await page.locator('#confirm').click();
  assert.equal(await page.evaluate(()=>orbital.world.units.find(u=>u.type==='miner'&&u.team==='player').miningRockId),null);
  assert.deepEqual(errors,[]);console.log('Upgrades/mining passed: stable buttons, paid three upgrades, miner deployment, actual right-click docking, finite treasury income and depletion, warship escort and mobile return-home.');
}finally{await browser.close();}
