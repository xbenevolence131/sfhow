import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.ORBITAL_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(new URL('../dist/index.html',import.meta.url).href);
  await page.locator('#modal-action').click();
  const positions=await page.evaluate(()=>{
    orbital.load('neighbors',{mode:'skirmish'});orbital.closeModal();
    const w=orbital.world;
    w.ai={buildAt:Infinity,attackAt:Infinity,rockAt:Infinity,launchAt:Infinity};
    const ship=w.units.find(u=>u.type==='ship'&&u.team==='player');
    const target=w.units.find(u=>u.type==='booster'&&u.team==='enemy');
    w.units=[ship,target];
    Object.assign(target,{x:550,y:350,vx:19,vy:0,order:{kind:'move',x:1600,y:350}});
    Object.assign(ship,{x:490,y:350,vx:19,vy:0,fireTimer:0,order:{kind:'stop',x:490,y:350}});
    window.fight={ship,target,angle:Math.PI,turn:0,shots:0,rangeSamples:0,total:0};
    const sample=()=>{
      if(!orbital.paused&&target.hp>0){
        const angle=Math.atan2(ship.y-target.y,ship.x-target.x);
        fight.turn+=Math.atan2(Math.sin(angle-fight.angle),Math.cos(angle-fight.angle));fight.angle=angle;
        fight.total++;if(Math.hypot(ship.x-target.x,ship.y-target.y)<=ship.range)fight.rangeSamples++;
      }
      requestAnimationFrame(sample);
    };requestAnimationFrame(sample);
    orbital.updateUI();
    return {ship:orbital.renderer.screen(ship),target:orbital.renderer.screen(target)};
  });
  await page.mouse.click(positions.ship.x,positions.ship.y);
  await page.mouse.click(positions.target.x,positions.target.y,{button:'right'});
  assert.equal(await page.evaluate(()=>orbital.ui.pending.order.targetId),await page.evaluate(()=>fight.target.id));
  assert.ok((await page.locator('#plan-note').innerText()).includes('circle'));
  await page.locator('#confirm').click({delay:250});
  assert.ok((await page.locator('#selected-meta').innerText()).includes('Circling'));
  await page.locator('[data-speed="5"]').click();
  await page.waitForFunction(()=>fight.target.hp<=0&&fight.ship.order.kind==='stop',null,{timeout:15000});
  await page.locator('#pause').click();
  const result=await page.evaluate(()=>({turn:fight.turn,inRange:fight.rangeSamples/fight.total,hp:fight.target.hp,shipHp:fight.ship.hp,order:fight.ship.order.kind}));
  assert.ok(Math.abs(result.turn)>2,'must visibly arc around booster before destroying it');
  assert.ok(result.inRange>.95);assert.equal(result.hp,0);assert.equal(result.order,'stop');
  assert.deepEqual(errors,[]);
  console.log('Pursuit browser check passed: click target, preview, confirm, visible circling, sustained fire, target destroyed, then stop.',JSON.stringify(result));
}finally{await browser.close();}
