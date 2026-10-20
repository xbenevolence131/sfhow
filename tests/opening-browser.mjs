import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.ORBITAL_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}});
try{
 await page.goto(new URL('../dist/index.html',import.meta.url).href);
 await page.locator('#modal-action').click();
 assert.equal(await page.evaluate(()=>orbital.paused),false);
 await page.waitForFunction(()=>orbital.world.time>1);
 assert.equal(await page.evaluate(()=>orbital.world.awaitingFirstOrder),true);
 await page.locator('#tutorial-start').click();
 await page.evaluate(()=>orbital.select(orbital.world.units.find(u=>u.type==='booster'&&u.team==='player').id));
 assert.equal(await page.evaluate(()=>orbital.world.awaitingFirstOrder),true);
 await page.locator('#order-defend').click();
 assert.equal(await page.evaluate(()=>orbital.paused),true);
 await page.locator('#cancel').click();
 assert.equal(await page.evaluate(()=>orbital.world.awaitingFirstOrder),true);
 await page.locator('#order-defend').click();await page.locator('#confirm').click();
 assert.equal(await page.evaluate(()=>orbital.world.awaitingFirstOrder),false);
 assert.equal(await page.evaluate(()=>orbital.paused),false);
 await page.evaluate(()=>{orbital.load('neighbors',{mode:'skirmish',layoutSeed:17,visitorSeed:42});});
 await page.locator('#modal-action').click();await page.waitForFunction(()=>orbital.world.time>.5);
 assert.equal(await page.evaluate(()=>orbital.world.awaitingFirstOrder),true);
 await page.locator('[data-build="miner"]').click();
 assert.equal(await page.evaluate(()=>orbital.world.awaitingFirstOrder),true);
 console.log('Opening browser passed: tutorial and skirmish run immediately; selection, purchases and canceled previews stay safe; first confirmed order starts activity and resumes time.');
}finally{await browser.close();}
