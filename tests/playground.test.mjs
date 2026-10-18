import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario, createGame } from '../src/scenarios.js';
import { DT, fleet, launchRock, setGravity, step } from '../src/simulation.js';

test('Slingshot Playground starts paused-ready with twelve prepared rocks and three defended targets', () => {
  const w=createScenario('playground');
  assert.equal(w.time,0);assert.equal(w.planets.length,3);assert.deepEqual(w.planets.map(p=>p.team),['player','enemy','enemy']);
  assert.equal(w.unlimitedMetal,true);assert.equal(w.ai.disabled,true);
  const rocks=w.units.filter(u=>u.type==='rock');assert.equal(rocks.length,12);
  for(const r of rocks){
    const b=w.units.find(u=>u.id===r.boosterId);
    assert.equal(r.boosterTeam,'player');assert.ok(b.loaded);assert.equal(b.attachedRockId,r.id);
    assert.equal(b.vx,r.vx);assert.equal(b.vy,r.vy);assert.equal(b.hostId,'verdant');assert.equal(b.color,w.planets[0].color);
  }
  for(const p of w.planets)assert.deepEqual(w.units.filter(u=>u.hostId===p.id&&u.type!=='booster').map(u=>u.type).sort(),['drone','drone','platform','ship']);
  assert.equal(fleet(w,'player').length,16);assert.equal(fleet(w,'enemy').length,8);
  for(const p of w.planets)for(const u of w.units.filter(u=>u.hostId===p.id)){assert.equal(u.team,p.team);assert.equal(u.color,p.color);}
  setGravity(w,{g:2,sunMass:8000});assert.deepEqual(createGame(w.setup).gravity,w.gravity);
});

test('waiting ammunition is not attacked and the opponent never builds or sends expeditions', () => {
  const w=createScenario('playground'),rock=w.units.find(u=>u.type==='rock'),b=w.units.find(u=>u.id===rock.boosterId),p=w.planets[1];
  // Put waiting equipment directly beside defenders; it must still be ignored.
  Object.assign(rock,{x:p.x+60,y:p.y,vx:p.vx,vy:p.vy});
  for(let i=0;i<3/DT;i++)step(w);
  assert.equal(rock.hp,rock.maxHp);assert.equal(b.hp,b.maxHp);
  w.time=600;w.ai.buildAt=0;w.ai.attackAt=0;w.ai.rockAt=0;
  const count=w.units.length;step(w);assert.equal(w.units.length,count);
  for(const u of fleet(w,'enemy'))assert.equal(u.order.kind,'defend');
  assert.equal(w.outcome,null);
});

test('free launch starts a real burn and defenses intercept incoming rocks', () => {
  const w=createScenario('playground'),p=w.planets[0],r=w.units.find(u=>u.type==='rock');
  w.metal.player=0;
  Object.assign(r,{x:p.x+80,y:p.y,vx:p.vx-1,vy:p.vy});
  const hp=p.hp;assert.equal(launchRock(w,r.id,{x:-1,y:0}).error,undefined);
  assert.equal(w.metal.player,0);assert.equal(r.burn.remaining,4);
  for(let i=0;i<15/DT&&r.hp>0;i++)step(w);
  assert.equal(r.hp,0);assert.equal(r.impact,undefined,'defenders must shoot it down, not a collision');
  assert.equal(p.hp,hp);assert.ok(w.events.some(e=>e.text==='Asteroid intercepted'));
});

test('undefended impacts cause damage without ending the playground; reset restores everything', () => {
  const w=createScenario('playground'),p=w.planets[0],r=w.units.find(u=>u.type==='rock');
  w.units=w.units.filter(u=>['rock','booster'].includes(u.type));
  Object.assign(r,{x:p.x+p.radius+r.radius+2,y:p.y,vx:-120,vy:p.vy});
  launchRock(w,r.id,{x:0,y:0});step(w);assert.ok(p.hp<p.maxHp);
  for(const planet of w.planets)planet.hp=0;
  step(w);assert.equal(w.outcome,null);
  const fresh=createGame(w.setup);assert.equal(fresh.time,0);
  assert.ok(fresh.planets.every(p=>p.hp===p.maxHp));
  assert.equal(fresh.units.filter(u=>u.type==='rock'&&u.boosterTeam==='player').length,12);
});
