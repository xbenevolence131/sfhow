import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createScenario } from '../src/scenarios.js';
import { updateVisitors, predict, step, DT, BELT_INNER, isBeltRock, addRock, scanRockThreats } from '../src/simulation.js';

test('natural visitors are sparse, seeded, neutral, and restricted to skirmish',()=>{
  const a=createGame({mode:'skirmish',visitorSeed:42}),b=createGame(a.setup);
  updateVisitors(a);assert.equal(a.visitors.count,0);
  a.time=b.time=40;
  const r=updateVisitors(a),copy=updateVisitors(b);
  assert.ok(r);assert.deepEqual(r,copy);assert.equal(r.team,'neutral');assert.equal(isBeltRock(r),false);
  assert.ok(Math.hypot(r.x,r.y)>BELT_INNER+400);
  assert.ok(r.beltArrivalAt-a.time>10);assert.ok(a.events.at(-1).major);
  assert.ok(a.visitors.nextAt>=140 && a.visitors.nextAt<=200);
  assert.deepEqual(a.metal,{player:160,enemy:160});
  a.time=a.visitors.nextAt;assert.ok(updateVisitors(a));
  a.time=a.visitors.nextAt;assert.equal(updateVisitors(a),undefined);assert.equal(a.visitors.count,2);
  for(const w of [createScenario('garden'),createGame({mode:'sandbox'})]){w.time=500;assert.equal(updateVisitors(w),undefined);assert.ok(!w.units.some(u=>u.visitor));}
});

test('varied visitor trajectories cross obliquely and avoid the sun under real gravity',()=>{
  for(const seed of [1,7,42,123,999]){
    const w=createGame({mode:'skirmish',visitorSeed:seed});w.time=40;
    const r=updateVisitors(w);assert.ok(r,`seed ${seed}`);
    assert.ok(Math.abs(r.x*r.vy-r.y*r.vx)>3000);
    const isolated=structuredClone(w);isolated.units=[structuredClone(r)];
    const route=predict(isolated,[r.id],null,200,false).get(r.id);
    assert.notEqual(route.impact?.targetId,'star');
    const radii=route.points.map(p=>Math.hypot(p.x,p.y));
    assert.ok(Math.min(...radii)>=100);assert.ok(Math.min(...radii)<BELT_INNER);
    assert.ok(route.impact || radii.at(-1)>1400);
  }
});

test('both factions detect and fire on neutral visitors threatening their colonies',()=>{
  for(const team of ['player','enemy']){
    const w=createGame({mode:'skirmish',visitorSeed:1});w.ai.disabled=true;w.visitors.nextAt=Infinity;
    const home=w.planets.find(p=>p.team===team);
    const platform=w.units.find(u=>u.type==='platform' && u.team===team);
    w.units=[platform];
    const rock=addRock(w,0);Object.assign(rock,{visitor:true,arrivedAt:0,launched:true,x:home.x+80,y:home.y,vx:home.vx-10,vy:home.vy});delete rock.beltOrbit;
    platform.phase=0;platform.fireTimer=0;
    scanRockThreats(w);assert.equal(w.rockThreats[rock.id]?.targetId,home.id);
    for(let i=0;i<20;i++)step(w,DT);
    assert.ok(rock.hp<rock.maxHp,`${team} defenses fire at neutral threat`);
  }
});
