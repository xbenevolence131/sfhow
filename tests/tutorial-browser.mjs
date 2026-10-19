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
  await stage(-1);
  assert.equal(await page.locator('#selection').evaluate(el=>el.classList.contains('tutorial-focus')),true);
  await page.locator('#tutorial-start').click();
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
  assert.equal(await page.locator('#practice').isVisible(),false);
  assert.equal(await page.locator('#tutorial-title').innerText(),'Select your spent booster');
  const spent=await pos(booster);await page.mouse.click(spent.x,spent.y);
  assert.equal(await page.evaluate(()=>orbital.ui.tutorialId),'verdant');
  const refuelHome=await page.evaluate(()=>orbital.renderer.screen(orbital.world.planets.find(p=>p.id==='verdant')));
  await page.mouse.click(refuelHome.x,refuelHome.y,{button:'right'});
  assert.equal(await page.locator('#tutorial-title').innerText(),'Confirm the return home');
  await page.locator('#cancel').click();
  assert.equal(await page.evaluate(()=>orbital.world.lesson.refuelled),undefined);
  await page.mouse.click(refuelHome.x,refuelHome.y,{button:'right'});
  await page.locator('#confirm').click();
  await page.locator('[data-speed="20"]').click();await stage(6);
  await page.locator('#pause').click();
  assert.equal(await page.evaluate(()=>orbital.world.lesson.refuelled),true);
  assert.equal(await page.evaluate(id=>orbital.world.units.find(u=>u.id===id).loaded,booster),true);
  await page.locator('#practice').click(); await stage(7);
  await page.locator('[data-speed="20"]').click();
  await stage(8);
  assert.equal(await page.evaluate(()=>orbital.world.lesson.firstImpact),true);
  assert.equal(await page.evaluate(()=>orbital.world.planets[0].hp),175);
  assert.equal(await page.evaluate(()=>orbital.world.outcome),null);
  assert.equal(await page.evaluate(()=>orbital.world.lesson.phase),'fortify');
  assert.equal(await page.evaluate(()=>orbital.world.lesson.grant),true);
  const home=await page.evaluate(()=>orbital.renderer.screen(orbital.world.planets.find(p=>p.id==='verdant')));
  await page.mouse.click(home.x,home.y);
  const beforeMetal=await page.evaluate(()=>orbital.world.metal.player);
  for(const type of ['platform','drone','drone','ship']) await page.locator(`[data-build="${type}"]`).click();
  assert.equal(Math.round(beforeMetal-await page.evaluate(()=>orbital.world.metal.player)),190);
  await stage(9);
  await page.screenshot({path:'test-results/orbital-tutorial-reinforce.png'});
  await page.locator('#tutorial-attack').click(); await stage(10);
  await page.locator('[data-speed="20"]').click();
  await stage(11);
  assert.equal(await page.evaluate(()=>orbital.world.lesson.finalIntercepted),true);
  assert.equal(await page.evaluate(()=>orbital.world.planets[0].hp),175,'new defenses prevent a second hit');
  assert.equal(await page.evaluate(()=>orbital.world.lesson.phase),'combat');
  const combatShip=await page.evaluate(()=>orbital.ui.tutorialId);
  const shipPoint=await pos(combatShip); await page.mouse.click(shipPoint.x,shipPoint.y);
  const enemy=await page.evaluate(()=>orbital.ui.tutorialId), enemyPoint=await pos(enemy);
  await page.mouse.click(enemyPoint.x,enemyPoint.y,{button:'right'});
  await page.locator('#cancel').click();
  assert.equal(await page.evaluate(()=>orbital.world.lesson.attackerId),null);
  await page.mouse.click(enemyPoint.x,enemyPoint.y,{button:'right'});
  await page.locator('#confirm').click();
  await page.locator('[data-speed="20"]').click();
  await stage(12);
  assert.equal(await page.evaluate(()=>orbital.world.lesson.phase),'assault');
  assert.equal(await page.evaluate(()=>orbital.world.outcome),null);
  assert.equal(await page.evaluate(()=>orbital.world.units.filter(u=>u.hp>0&&u.team==='enemy'&&u.hostId==='ochre').length),5);
  const assaultHome=await page.evaluate(()=>orbital.renderer.screen(orbital.world.planets.find(p=>p.id==='verdant')));
  await page.mouse.click(assaultHome.x,assaultHome.y);
  for(const type of ['booster','ship','ship'])await page.locator(`[data-build="${type}"]`).click();
  await stage(13);
  const boosters=await page.evaluate(()=>orbital.world.units.filter(u=>u.hp>0&&u.team==='player'&&u.type==='booster').map(u=>u.id));
  for(const id of boosters) {
    const bp=await pos(id);await page.mouse.click(bp.x,bp.y);
    const rid=await page.evaluate(()=>orbital.ui.tutorialId);
    const rp=await pos(rid);await page.mouse.click(rp.x,rp.y,{button:'right'});
    await page.locator('#confirm').click();
  }
  await page.locator('[data-speed="20"]').click();
  await stage(14);await page.locator('#pause').click();
  await page.screenshot({path:'test-results/orbital-tutorial-assault.png'});
  const prepared=await page.evaluate(()=>orbital.world.units.filter(u=>u.hp>0&&u.type==='rock'&&!u.launched&&u.boosterTeam==='player').map(u=>u.id));
  assert.equal(prepared.length,2);
  for(const id of prepared) {
    let launched=false;
    for(let attempt=0;attempt<12&&!launched;attempt++) {
      // Select by ID when an orbit has moved behind a panel; aim and launch use actual controls.
      await page.evaluate(id=>orbital.select(id),id);
      const target=await page.evaluate(()=>orbital.renderer.screen(orbital.world.planets.find(p=>p.id==='ochre')));
      await page.mouse.click(target.x,target.y,{button:'right'});
      if(await page.locator('#confirm').isEnabled()){await page.locator('#confirm').click();launched=true;}
      else {await page.locator('#cancel').click();await page.locator('[data-speed="20"]').click();await page.waitForTimeout(400);await page.locator('#pause').click();}
    }
    assert.equal(launched,true,'find a verified attack window');
  }
  assert.equal(await page.evaluate(()=>orbital.world.lesson.assaultLaunches),2);
  const assaultShips=await page.evaluate(()=>orbital.world.units.filter(u=>u.hp>0&&u.type==='ship'&&u.team==='player').map(u=>u.id));
  for(const id of assaultShips) {
    await page.evaluate(id=>orbital.select(id),id);
    const target=await page.evaluate(()=>orbital.renderer.screen(orbital.world.planets.find(p=>p.id==='ochre')));
    await page.mouse.click(target.x,target.y,{button:'right'});await page.locator('#confirm').click();
  }
  await page.locator('[data-speed="20"]').click();
  for(let wave=0;wave<3;wave++) {
    await page.waitForFunction(()=>orbital.world.outcome==='victory'||!orbital.world.units.some(u=>u.hp>0&&u.team==='player'&&u.type==='ship'&&u.order.kind==='attack'),null,{timeout:30000});
    if(await page.evaluate(()=>orbital.world.outcome==='victory'))break;
    await page.locator('#pause').click();
    await page.evaluate(()=>orbital.select('verdant'));
    for(let i=0;i<3;i++)await page.locator('[data-build="ship"]').click();
    const reinforcements=await page.evaluate(()=>orbital.world.units.filter(u=>u.hp>0&&u.type==='ship'&&u.team==='player').map(u=>u.id));
    assert.ok(reinforcements.length>=2,'remaining grant can fund another wave');
    for(const id of reinforcements) {
      await page.evaluate(id=>orbital.select(id),id);
      const target=await page.evaluate(()=>orbital.renderer.screen(orbital.world.planets.find(p=>p.id==='ochre')));
      await page.mouse.click(target.x,target.y,{button:'right'});await page.locator('#confirm').click();
    }
    await page.locator('[data-speed="20"]').click();
  }
  await stage(15);
  assert.equal(await page.evaluate(()=>orbital.world.planets.find(p=>p.id==='ochre').hp),0);
  assert.equal(await page.evaluate(()=>orbital.world.outcome),'victory');
  await page.locator('#modal-secondary').click();
  assert.equal(await page.locator('#tutorial').isVisible(),false);
  // Starting again, skipping, and changing scenario clear all highlights.
  await page.reload(); await page.locator('#modal-action').click(); await stage(-1);
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
  console.log('Tutorial passed: attachment/launch, return preview/cancel/confirm and completed refuelling, undefended colony impact, grant, paid platform/two drones/ship, staged interception, booster destruction, funded assault fleet, two real booster expeditions, two rock launches plus ship attacks, defended colony victory, skip, free exploration, scenario change, and mobile layout.');
} catch(error) {
  console.log(await page.evaluate(()=>JSON.stringify({time:orbital.world.time,stage:orbital.tutorial?.stage,lesson:orbital.world.lesson,paused:orbital.paused,outcome:orbital.world.outcome,selected:orbital.ui.selectedId,copy:document.getElementById('tutorial-copy').innerText,units:orbital.world.units.filter(u=>u.type!=='rock'||u.boosterTeam||u.launched).map(u=>({id:u.id,type:u.type,hp:u.hp,team:u.team,order:u.order,attached:u.attachedRockId})),planets:orbital.world.planets.map(p=>({id:p.id,hp:p.hp}))})));
  throw error;
} finally { await browser.close(); }
