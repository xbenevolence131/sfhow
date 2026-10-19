import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario } from '../src/scenarios.js';
import { spawn, addRock, advanceMotion, step, predict, DT, BELT_INNER } from '../src/simulation.js';

function fixture(team='player') {
  const w=createScenario('neighbors');w.units=[];w.ai.disabled=true;
  w.gravity={g:0,planetMass:0,sunMass:0};
  const home=w.planets.find(p=>p.team===team);
  home.omega=0;home.phase=0;home.x=home.orbit;home.y=0;home.vx=home.vy=0;
  const drone=spawn(w,'drone',team,home,true);
  Object.assign(drone,{x:home.x+70,y:0,vx:0,vy:0});
  return {w,home,drone};
}

test('both factions use contact-only drones against attacking ships',()=>{
  for(const team of ['player','enemy']) {
    const {w,home,drone}=fixture(team);
    const opponent=team==='player'?'enemy':'player';
    const ship=spawn(w,'ship',opponent,w.planets.find(p=>p.team===opponent),true);
    Object.assign(ship,{x:drone.x+25,y:0,vx:0,vy:0,order:{kind:'attack',targetId:home.id},fireTimer:100});
    step(w);assert.equal(ship.hp,110,'no ranged damage');
    for(let n=0;n<200 && drone.hp>0;n++)advanceMotion(w);
    assert.equal(drone.hp,0);assert.equal(ship.hp,65);
    assert.equal(drone.impact.kind,'ram');
    assert.ok(w.effects.some(e=>e.type==='ram'));
    const hp=ship.hp;for(let n=0;n<20;n++)advanceMotion(w);
    assert.equal(ship.hp,hp,'one impact only');
  }
});

test('drone forecasts match swept rock interception and cannot tunnel',()=>{
  const {w,home,drone}=fixture();
  const rock=addRock(w,0,home.orbit+90,'INCOMING','medium');
  Object.assign(rock,{x:home.x+100,y:0,vx:-2000,vy:0,launched:true,team:'enemy',hp:40});
  const before=structuredClone(w), f=predict(w,[drone.id,rock.id],null,1);
  assert.deepEqual(w,before);
  advanceMotion(w);
  assert.equal(drone.hp,0);assert.equal(rock.hp,0);
  assert.equal(rock.impact.kind,'intercept');assert.equal(home.hp,240);
  assert.equal(w.progress.intercepted,true);
  assert.ok(Math.abs(drone.impact.time-f.get(drone.id).impact.time)<1e-9);
});

test('drones leave friends and idle rocks alone, return home, and abandon distant threats',()=>{
  const {w,home,drone}=fixture();
  const friend=spawn(w,'ship','player',home,true);
  Object.assign(friend,{x:drone.x,y:0,vx:0,vy:0});
  const rock=addRock(w,0,home.orbit+70,'IDLE','medium');
  Object.assign(rock,{x:drone.x,y:0,team:'enemy',launched:false});
  advanceMotion(w);assert.equal(drone.hp,38);assert.equal(friend.hp,110);assert.equal(rock.hp,50);
  const enemy=spawn(w,'ship','enemy',w.planets.find(p=>p.team==='enemy'),true);
  Object.assign(enemy,{x:home.x+175,y:0,vx:0,vy:0,order:{kind:'stop',x:home.x+175,y:0}});
  advanceMotion(w);assert.equal(drone.ramTargetId,enemy.id);
  enemy.x=home.x+500;enemy.order={kind:'stop',x:enemy.x,y:0};
  for(let i=0;i<40/DT;i++)advanceMotion(w);
  assert.equal(drone.ramTargetId,null);assert.equal(drone.hp,38);
  assert.ok(Math.hypot(drone.x-home.x,drone.y-home.y)<120);
});

test('outer planetary orbit is 80 percent of the belt, with proportional spacing',()=>{
  const w=createScenario('neighbors');
  const radii=w.planets.map(p=>p.orbit).sort((a,b)=>a-b);
  assert.equal(radii[2],BELT_INNER*.8);
  assert.ok(radii[1]-radii[0]>260);assert.ok(radii[2]-radii[1]>350);
});
