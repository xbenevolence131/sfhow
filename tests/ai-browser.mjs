import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.ORBITAL_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(new URL('../dist/index.html',import.meta.url).href);
  await page.locator('#modal-secondary').click();
  await page.evaluate(()=>{
    orbital.load('neighbors',{mode:'skirmish',layoutSeed:17,visitorSeed:42});orbital.closeModal();
  });
  await page.locator('#autopause').uncheck();
  await page.locator('[data-speed="20"]').click();
  await page.waitForFunction(()=>orbital.world.time>=160,null,{timeout:60000});
  await page.locator('#pause').click();
  const result=await page.evaluate(()=>{
    const w=orbital.world,own=w.units.filter(u=>u.team==='enemy'&&u.type!=='rock'&&u.hp>0);
    return {time:w.time,metal:w.metal.enemy,own:own.map(u=>({type:u.type,tier:u.tier,order:u.order})),home:w.planets.find(p=>p.team==='enemy').id};
  });
  assert.ok(result.own.length<=12);
  assert.ok(result.metal>=0);
  assert.ok(result.own.some(u=>u.type==='miner'&&u.order.kind==='mine'));
  assert.ok(result.own.some(u=>u.tier===2));
  assert.ok(result.own.some(u=>u.type==='ship'&&u.order.kind==='defend'&&u.order.targetId===result.home));
  assert.deepEqual(errors,[]);
  console.log('AI browser passed: seeded Skirmish runs 160 seconds, builds and assigns miners, upgrades, keeps a guard, respects budget/cap, no browser errors.');
  console.log(JSON.stringify(result));
}finally{await browser.close();}
