import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,createScenario} from '../src/scenarios.js';
import {DT,step,activateSystem} from '../src/simulation.js';

test('opening orbits move safely while combat, production, income and visitors wait for an order',()=>{
  const w=createGame({mode:'skirmish',layoutSeed:17,visitorSeed:42});w.awaitingFirstOrder=true;
  const initial=structuredClone(w),home=w.planets[0];
  for(let i=0;i<180/DT;i++)step(w);
  assert.ok(Math.hypot(home.x-initial.planets[0].x,home.y-initial.planets[0].y)>10);
  assert.equal(w.units.length,initial.units.length);assert.deepEqual(w.metal,initial.metal);
  assert.deepEqual(w.units.map(u=>u.hp),initial.units.map(u=>u.hp));assert.equal(w.visitors.count,0);assert.equal(w.outcome,null);
  assert.equal(activateSystem(w),true);assert.equal(activateSystem(w),false);
  assert.ok(Math.abs(w.visitors.nextAt-w.time-40)<1e-7);
  assert.ok(Math.abs(w.ai.buildAt-w.time-initial.ai.buildAt)<1e-7);
  step(w);assert.ok(w.metal.player>initial.metal.player);assert.equal(w.visitors.count,0);
});

test('looking around Hold the Orbit cannot finish the survival timer',()=>{
  const w=createScenario('hold');w.awaitingFirstOrder=true;
  for(let i=0;i<250/DT;i++)step(w);
  assert.equal(w.outcome,null);activateSystem(w);
  assert.ok(Math.abs(w.duration-w.time-240)<1e-7);step(w);assert.equal(w.outcome,null);
});
