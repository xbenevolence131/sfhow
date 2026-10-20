import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.ORBITAL_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const clickView=async(team,type)=>{
  const point=await page.evaluate(({team,type})=>{
    const v=orbital.planetViews.views.find(v=>v.team===team),w=orbital.world;
    const u=type==='planet'?v.planet:w.units.find(u=>u.team===team&&u.type===type&&u.hp>0);
    const p=v.renderer.screen(u),b=v.canvas.getBoundingClientRect();return {x:b.left+p.x,y:b.top+p.y,id:u.id};
  },{team,type});
  await page.mouse.click(point.x,point.y);return point.id;
};
try{
  await page.goto(new URL('../dist/index.html?playtest=1',import.meta.url).href);
  await page.locator('#modal-secondary').click();
  await page.evaluate(()=>{orbital.load('neighbors',{mode:'skirmish',layoutSeed:17,visitorSeed:42});orbital.closeModal();});
  await page.waitForFunction(()=>orbital.planetViews.views[1].planet===orbital.world.planets.find(p=>p.team==='enemy'));
  const camera=await page.evaluate(()=>({...orbital.renderer.camera}));
  const enemy=await clickView('enemy','ship');
  assert.equal(await page.evaluate(()=>orbital.ui.selectedId),enemy);
  assert.match(await page.locator('#selected-owner').innerText(),/ENEMY.*Ship/);
  assert.equal(await page.locator('#selected-actions').isVisible(),false);
  const ship=await clickView('player','ship');
  assert.equal(await page.evaluate(()=>orbital.ui.selectedId),ship);
  assert.deepEqual(await page.evaluate(()=>orbital.renderer.camera),camera);
  assert.ok(await page.locator('#action-panel #order-upgrade').isVisible());
  await page.locator('#order-upgrade').click();
  assert.equal(await page.evaluate(id=>orbital.world.units.find(u=>u.id===id).tier,ship),2);
  assert.match(await page.locator('#selected-meta').innerText(),/SUPER/);
  const destination=await page.evaluate(()=>orbital.renderer.screen({x:320,y:300}));
  await page.mouse.click(destination.x,destination.y,{button:'right'});
  assert.ok(await page.locator('#plan #confirm').isVisible());
  assert.equal(await page.locator('#game-control-panel #pause').isVisible(),true);
  await page.locator('#confirm').click();
  assert.equal(await page.evaluate(id=>orbital.world.units.find(u=>u.id===id).order.kind,ship),'move');
  await clickView('player','planet');
  assert.ok(await page.locator('#action-panel [data-build="miner"]').isVisible());
  await page.evaluate(()=>{orbital.paused=true;orbital.accumulator=0;});
  const before=await page.evaluate(()=>orbital.world.metal.player);
  await page.locator('[data-build="miner"]').click();
  assert.equal(await page.evaluate(()=>orbital.world.metal.player),before-25);
  await page.locator('#playtest-toggle').click();assert.match(await page.locator('#playtest-status').innerText(),/PAUSED/);
  assert.ok(await page.locator('#game-control-panel #playtest-toggle').isVisible());
  await page.locator('#autopause').uncheck();await page.locator('[data-speed="5"]').click();
  await page.waitForFunction(()=>orbital.world.time>=3);await page.locator('#pause').click();
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(()=>orbital.planetViews.views.every(v=>Math.hypot(v.renderer.camera.x-v.planet.x,v.renderer.camera.y-v.planet.y)<.01)),'close-ups follow moving planets');
  assert.deepEqual(await page.evaluate(()=>orbital.renderer.camera),camera,'close-up following never pans the main map');
  for(const viewport of [{width:1440,height:960},{width:1024,height:768},{width:720,height:800}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(100);
    const boxes=await page.evaluate(()=>[...document.querySelectorAll('#command-panel>.command-section')].map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom};}));
    assert.equal(boxes.length,3);assert.ok(Math.abs(boxes[0].w-boxes[2].w)<1);
    for(const box of boxes){assert.ok(box.x>=0&&box.right<=viewport.width+1);assert.ok(box.bottom<=viewport.height+1);}
    assert.equal(await page.locator('#system-details').getAttribute('open'),null);
    await page.screenshot({path:`test-results/hud-${viewport.width}.png`});
  }
  await page.setViewportSize({width:1440,height:960});
  await page.evaluate(()=>{orbital.load('neighbors',{mode:'sandbox',enemies:false});orbital.closeModal();});
  await page.waitForTimeout(150);assert.equal(await page.locator('#enemy-view-canvas').isVisible(),false);
  assert.match(await page.locator('#enemy-view .view-empty').innerText(),/No enemy/);
  await page.evaluate(()=>{orbital.load('garden',undefined,true);});
  await page.locator('#modal-action').click();
  assert.ok(await page.locator('#tutorial-start').isVisible());
  assert.match(await page.locator('#tutorial-copy').innerText(),/close-up/);
  await page.waitForFunction(()=>orbital.planetViews.views[1].planet?.id==='ochre');
  assert.equal(await page.evaluate(()=>orbital.world.planets.find(p=>p.id==='ochre').team),'enemy');
  assert.ok(await page.locator('#enemy-view-canvas').isVisible());
  assert.match(await page.locator('#enemy-view-integrity').innerText(),/OCHRE INTEGRITY.*100%/s);
  await page.evaluate(()=>{const p=orbital.world.planets.find(p=>p.id==='verdant');p.hp=p.maxHp*.73;});
  await page.waitForFunction(()=>document.querySelector('#player-view-integrity .integrity-value').textContent==='73%');
  await page.screenshot({path:'test-results/hud-tutorial-integrity.png'});
  assert.deepEqual(errors,[]);
  console.log('HUD browser passed: PIP selection, enemy inspection, main-map orders, purchases, recorder controls, equal responsive panels, empty enemy view, tutorial entry.');
}finally{await browser.close();}
