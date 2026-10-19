import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.ORBITAL_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(new URL('../dist/index.html',import.meta.url).href);await page.locator('#modal-secondary').click();
  await page.evaluate(()=>{
    const g=orbital;g.load('neighbors',{mode:'skirmish',layoutSeed:17,visitorSeed:42});g.closeModal();
    const w=g.world,s=w.units.find(u=>u.type==='ship'&&u.team==='player');w.units=[s];w.ai.disabled=true;w.visitors.nextAt=Infinity;
    s.hp=50;s.lastDamageAt=w.time;g.select(s.id);
  });
  assert.match(await page.locator('#selected-meta').innerText(),/Home repairs in 10s/);
  await page.locator('#autopause').uncheck();await page.locator('[data-speed="20"]').click();
  await page.waitForFunction(()=>orbital.world.units[0].hp>52);
  await page.locator('#pause').click();
  assert.match(await page.locator('#selected-meta').innerText(),/Repairing at home/);
  const hp=await page.evaluate(()=>orbital.world.units[0].hp);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>orbital.world.units[0].hp),hp);
  await page.evaluate(()=>{const g=orbital,s=g.world.units[0],h=g.world.planets.find(p=>p.id===s.hostId);s.x=h.x+300;s.y=h.y;g.updateUI();});
  assert.match(await page.locator('#selected-meta').innerText(),/Return home for free repairs/);
  assert.deepEqual(errors,[]);console.log('Repair browser flow passed: cooldown text, real home healing, pause freezes healing, away guidance.');
}finally{await browser.close();}
