import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.ORBITAL_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(new URL('../dist/index.html',import.meta.url).href);await page.locator('#modal-secondary').click();
  await page.evaluate(()=>{
    const g=orbital;g.load('neighbors',{mode:'skirmish',layoutSeed:17,visitorSeed:42});g.closeModal();
    const w=g.world;w.ai.disabled=true;w.visitors.nextAt=Infinity;w.gravity.g=0;
    for(const p of w.planets){p.omega=0;p.vx=p.vy=0;}
    const p=w.units.find(u=>u.type==='platform'&&u.team==='enemy'),h=w.planets.find(h=>h.id===p.hostId),r=w.units.find(u=>u.type==='rock'&&u.size==='medium');
    Object.assign(h,{x:700,y:0,orbit:700,phase:0});
    Object.assign(p,{x:600,y:0,orbit:100,phase:Math.PI,omega:0,vx:0,vy:0,fireTimer:999});
    Object.assign(r,{x:500,y:0,vx:100,vy:0,launched:true,beltOrbit:null,team:'player'});w.units=[p,r];
    window.impactTest={p,r,h,initial:h.hp};g.ui.selectedId=r.id;g.refreshPredictions();g.updateUI();
  });
  assert.equal(await page.evaluate(()=>orbital.ui.predictions.get(impactTest.r.id)?.impact?.targetId),await page.evaluate(()=>impactTest.p.id));
  await page.locator('#autopause').uncheck();await page.locator('[data-speed="5"]').click();
  await page.waitForFunction(()=>impactTest.r.hp===0);
  const result=await page.evaluate(()=>({hp:impactTest.p.hp,colony:impactTest.h.hp,initial:impactTest.initial}));
  assert.equal(result.hp,165);assert.equal(result.colony,result.initial);assert.deepEqual(errors,[]);
  console.log('Platform impact browser passed: preview ends at platform, live impact deals 65 damage, consumes rock, protects colony.');
}finally{await browser.close();}
