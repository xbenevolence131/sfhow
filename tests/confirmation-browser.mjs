import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.ORBITAL_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(new URL('../dist/index.html',import.meta.url).href);await page.locator('#modal-secondary').click();
 await page.evaluate(()=>{orbital.load('playground');orbital.closeModal();});
 const point=await page.evaluate(()=>orbital.renderer.screen(orbital.world.units.find(u=>u.type==='rock'&&u.id!==orbital.ui.selectedId)));
 await page.mouse.click(point.x,point.y,{button:'right'});
 assert.equal(await page.evaluate(()=>orbital.ui.pending?.aim?.targetType),'rock');
 for(const viewport of [{width:1440,height:960},{width:1024,height:768},{width:720,height:800},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(100);
  for(const scroll of [0,10000]){
   await page.locator('#plan-details').evaluate((n,scroll)=>n.scrollTop=scroll,scroll);
   const bounds=await page.locator('#plan').boundingBox();
   const deck=await page.locator('#command-panel').boundingBox();
   assert.ok(bounds.y+bounds.height<deck.y,'confirmation floats above the bottom deck');
   assert.ok(Math.abs(bounds.x-(viewport.width<=720?8:16))<1,'confirmation aligns to the left edge');
   assert.equal(await page.locator('#action-panel #plan').count(),0);
   for(const id of ['confirm','cancel']){
    const b=await page.locator('#'+id).boundingBox();
    assert.ok(b.y>=bounds.y&&b.y+b.height<=bounds.y+bounds.height,`${id} stays vertically visible at ${viewport.width}`);
    assert.ok(b.x>=bounds.x&&b.x+b.width<=bounds.x+bounds.width,`${id} fits horizontally at ${viewport.width}`);
   }
  }
  await page.screenshot({path:`test-results/confirmation-${viewport.width}.png`});
 }
 await page.locator('#cancel').click();assert.equal(await page.evaluate(()=>orbital.ui.pending),null);
 assert.deepEqual(errors,[]);console.log('Confirmation browser passed: rock-target previews keep Confirm/Cancel inside the floating box above the deck at 1440, 1024, 720 and 390 pixels, including after scrolling details; Cancel works.');
}finally{await browser.close();}
