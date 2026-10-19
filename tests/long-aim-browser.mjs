import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.ORBITAL_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(new URL('../dist/index.html',import.meta.url).href);
  await page.locator('#modal-secondary').click();
  await page.locator('#scenario').selectOption('playground');await page.locator('#modal-action').click();
  const ids=await page.evaluate(()=>{
    const g=orbital,w=g.world,r=w.units.find(u=>u.type==='rock'),b=w.units.find(u=>u.id===r.boosterId),p=w.planets[1];
    w.gravity.g=0;
    Object.assign(r,{x:-1200,y:600,vx:0,vy:0,beltOrbit:null});Object.assign(b,{x:-1184,y:600,vx:0,vy:0});
    Object.assign(p,{x:1200,y:600,vx:0,vy:0,orbit:Math.hypot(1200,600),phase:Math.atan2(600,1200),omega:0});
    w.planets=[p];w.units=[r,b];g.ui.selectedId=null;g.renderer.camera={x:0,y:600,zoom:.22};g.refreshPredictions();g.updateUI();
    return {source:r.id,target:p.id,sourcePos:g.renderer.screen(r),targetPos:g.renderer.screen(p)};
  });
  await page.mouse.click(ids.sourcePos.x,ids.sourcePos.y);await page.mouse.click(ids.targetPos.x,ids.targetPos.y,{button:'right'});
  await page.waitForFunction(()=>orbital.ui.pending?.aim?.verified);
  assert.equal(await page.evaluate(()=>orbital.ui.pending.aim.horizon),120);
  assert.ok(await page.evaluate(()=>orbital.ui.pending.aim.flightTime>90));
  assert.equal(await page.evaluate(id=>orbital.ui.predictions.get(id).impact.targetId,ids.source),ids.target);
  await page.locator('#confirm').click();
  await page.evaluate(()=>orbital.refreshPredictions());
  assert.equal(await page.evaluate(id=>orbital.ui.predictions.get(id).impact.targetId,ids.source),ids.target,'long preview survives confirmation');
  await page.locator('#autopause').uncheck();await page.locator('[data-speed="20"]').click();
  await page.waitForFunction(id=>orbital.world.units.find(u=>u.id===id).impact,ids.source);
  assert.equal(await page.evaluate(id=>orbital.world.units.find(u=>u.id===id).impact.targetId,ids.source),ids.target);
  assert.deepEqual(errors,[]);
  console.log('Long-shot UI passed: right-click, verified >90-second arrival, 120-second preview, confirm retains impact preview, real impact.');
} finally {await browser.close();}
