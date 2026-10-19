import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.ORBITAL_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(new URL('../dist/index.html',import.meta.url).href);await page.locator('#modal-secondary').click();
  const points=await page.evaluate(()=>{
    const g=orbital;g.load('neighbors',{mode:'skirmish',layoutSeed:17,visitorSeed:42});g.closeModal();
    const w=g.world,s=w.units.find(u=>u.type==='ship'&&u.team==='player'),r=w.units.find(u=>u.type==='rock');
    w.ai.disabled=true;w.visitors.nextAt=Infinity;w.gravity.g=0;for(const p of w.planets){p.phase=Math.atan2(p.y,p.x);p.omega=0;p.vx=p.vy=0;}
    Object.assign(s,{x:600,y:600,vx:0,vy:0,fireTimer:0,order:{kind:'stop',x:600,y:600}});
    Object.assign(r,{x:880,y:600,vx:-40,vy:0,launched:true,team:'enemy',hp:1000});w.units=[s,r];
    g.ui.selectedId=null;g.renderer.camera={x:700,y:600,zoom:1};g.refreshPredictions();g.updateUI();
    return {ship:g.renderer.screen(s),rock:g.renderer.screen(r)};
  });
  await page.mouse.click(points.ship.x,points.ship.y);await page.mouse.click(points.rock.x,points.rock.y,{button:'right'});
  await page.locator('#confirm').click();assert.match(await page.locator('#selected-meta').innerText(),/seeking firing range/);
  await page.locator('#autopause').uncheck();await page.locator('[data-speed="20"]').click();
  await page.waitForFunction(()=>orbital.world.units[1].hp<1000);
  await page.locator('#pause').click();
  const state=await page.evaluate(()=>({time:orbital.world.time,ship:orbital.world.units[0]}));
  assert.ok(state.time<5);assert.ok(state.ship.x>=600 && state.ship.x<660);assert.ok(Math.abs(state.ship.y-600)<1e-6);
  assert.deepEqual(errors,[]);console.log('Ship interception browser passed: right-click rock, confirm, range-seeking UI, direct approach and early live firing.');
}finally{await browser.close();}
