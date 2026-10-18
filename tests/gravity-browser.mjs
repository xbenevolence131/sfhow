import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.ORBITAL_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(new URL('../dist/index.html',import.meta.url).href);await page.locator('#modal-action').click();
  await page.locator('[data-speed="5"]').click();
  await page.locator('#gravity-g').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>orbital.paused),true);
  assert.equal(await page.evaluate(()=>orbital.world.gravity.g),1.05);
  const state=await page.evaluate(()=>{
    window.gravityNodes=[...document.querySelectorAll('[data-gravity]')];
    const r=orbital.world.units.find(u=>u.type==='rock');orbital.select(r.id);orbital.refreshPredictions();
    return {time:orbital.world.time,planets:structuredClone(orbital.world.planets),units:structuredClone(orbital.world.units),path:orbital.ui.predictions.get(r.id).points};
  });
  for(const [id,value] of [['gravity-g','2'],['gravity-planet','4200'],['gravity-sun','8200']]) {
    await page.locator('#'+id).fill(value);
    assert.equal(await page.locator('#'+id+'-value').innerText(),id==='gravity-g'?'2.00':value);
  }
  const changed=await page.evaluate(()=>({time:orbital.world.time,planets:orbital.world.planets,units:orbital.world.units,path:orbital.ui.predictions.get(orbital.ui.selectedId).points}));
  const free=u=>u.type!=='platform' && (u.type!=='rock' || u.launched);
  assert.equal(changed.time,state.time);assert.deepEqual(changed.units.filter(free),state.units.filter(free));assert.notDeepEqual(changed.path,state.path);
  for(const rock of changed.units.filter(u=>u.type==='rock')) { const old=state.units.find(u=>u.id===rock.id); assert.equal(rock.x,old.x);assert.equal(rock.y,old.y); }
  for(let i=0;i<changed.planets.length;i++){
    const p=changed.planets[i],before=state.planets[i];
    assert.equal(p.x,before.x);assert.equal(p.y,before.y);
    assert.ok(Math.hypot(p.vx,p.vy)>Math.hypot(before.vx,before.vy));
    assert.ok(Math.abs(Math.hypot(p.vx,p.vy)-Math.sqrt(3*2*8200/p.orbit))<1e-10);
  }
  assert.ok(await page.evaluate(()=>gravityNodes.every(n=>n.isConnected)));
  // A held drag must survive repeated UI updates and keep keyboard focus.
  const box=await page.locator('#gravity-g').boundingBox();await page.mouse.move(box.x+box.width*.7,box.y+box.height/2);await page.mouse.down();
  await page.waitForTimeout(450);await page.mouse.move(box.x+box.width*.8,box.y+box.height/2,{steps:8});await page.mouse.up();
  assert.ok(await page.evaluate(()=>orbital.world.gravity.g)>2);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'gravity-g');
  await page.keyboard.press(' ');assert.equal(await page.evaluate(()=>orbital.paused),true);
  const tuning=await page.evaluate(()=>({...orbital.world.gravity}));
  await page.locator('#restart').click();await page.locator('#modal-action').click();
  assert.deepEqual(await page.evaluate(()=>orbital.world.gravity),tuning);
  await page.locator('#gravity-reset').click({delay:250});
  assert.deepEqual(await page.evaluate(()=>orbital.world.gravity),{g:1,planetMass:2800,sunMass:5400});
  await page.evaluate(()=>{
    const w=orbital.world,r=w.units.find(u=>u.type==='rock'),b=w.units.find(u=>u.type==='booster'),p=w.planets[0];
    w.units=[r,b];Object.assign(r,{x:p.x-500,y:p.y+200,vx:0,vy:0,beltOrbit:null,team:'player',boosterTeam:'player',boosterId:b.id});
    Object.assign(b,{x:r.x+16,y:r.y,attachedRockId:r.id,attachOffset:{x:16,y:0},order:{kind:'attached',targetId:r.id}});orbital.select(r.id);
  });
  const home=await page.evaluate(()=>orbital.renderer.screen(orbital.world.planets[0]));
  await page.mouse.click(home.x,home.y,{button:'right'});assert.equal(await page.evaluate(()=>orbital.ui.pending.aim.verified),true);
  const impulse=await page.evaluate(()=>({...orbital.ui.pending.impulse}));
  await page.locator('#gravity-g').fill('0');
  assert.deepEqual(await page.evaluate(()=>orbital.ui.pending.impulse),impulse);
  assert.equal(await page.evaluate(()=>orbital.ui.pending.aim.verified),false);
  assert.equal(await page.locator('#confirm').isDisabled(),true);
  await page.locator('#cancel').click();await page.locator('#gravity-reset').click();
  await page.evaluate(()=>{orbital.select('verdant');orbital.toastUntil=0;document.getElementById('toast').classList.remove('visible');});
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/orbital-gravity.png'});
  await page.setViewportSize({width:390,height:844});await page.locator('#fit').click();
  await page.screenshot({path:'test-results/orbital-gravity-mobile.png'});
  for(const id of ['gravity-g','gravity-planet','gravity-sun','gravity-reset']){
    const b=await page.locator('#'+id).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=390&&b.y+b.height<700,`${id} fits above deployment`);
  }
  await page.locator('#gravity-sun').fill('10000');assert.equal(await page.evaluate(()=>orbital.world.gravity.sunMass),10000);
  await page.locator('#new-game').click();await page.locator('[data-mode="sandbox"]').click();await page.locator('#start-game').click();await page.locator('#modal-action').click();
  assert.deepEqual(await page.evaluate(()=>orbital.world.gravity),{g:1,planetMass:2800,sunMass:5400});
  assert.deepEqual(errors,[]);
  console.log('Gravity browser checks passed: three sliders, pause, stable held drag/focus, preview refresh without motion changes, restart/reset, targeted-shot revalidation, mobile layout, fresh-game defaults.');
}finally{await browser.close();}
