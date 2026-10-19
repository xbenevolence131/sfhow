import test from 'node:test';
import assert from 'node:assert/strict';
import {createScenario,createGame} from '../src/scenarios.js';
import {upgradeUnit,UPGRADES,TYPES,superColor,step,DT,entity,setGravity} from '../src/simulation.js';

test('paid individual upgrades preserve health fraction and orders, cannot stack or upgrade enemies',()=>{
  for(const type of Object.keys(UPGRADES)){
    const w=createScenario('playground');w.unlimitedMetal=false;w.metal.player=200;
    const u=w.units.find(u=>u.type===type&&u.team==='player'),order=structuredClone(u.order),oldColor=u.color;
    u.hp=u.maxHp/2;
    assert.equal(upgradeUnit(w,u.id),u);
    assert.equal(w.metal.player,200-UPGRADES[type].cost);assert.equal(u.tier,2);
    assert.equal(u.hp/u.maxHp,.5);assert.deepEqual(u.order,order);
    assert.equal(u.color,superColor(oldColor));assert.equal(u.baseColor,oldColor);
    assert.ok(upgradeUnit(w,u.id).error);assert.equal(w.metal.player,200-UPGRADES[type].cost);
    assert.ok(upgradeUnit(w,w.units.find(u=>u.type===type&&u.team==='enemy').id).error);
    assert.equal(TYPES[type].damage,type==='ship'?8:type==='platform'?12:45);
  }
  const w=createScenario('garden'),ship=w.units.find(u=>u.type==='ship');w.metal.player=0;
  assert.ok(upgradeUnit(w,ship.id).error);assert.equal(ship.tier,1);
  assert.ok(upgradeUnit(w,w.units.find(u=>u.type==='booster').id).error);
  w.unlimitedMetal=true;assert.equal(upgradeUnit(w,ship.id).tier,2);assert.equal(w.metal.player,0);
  ship.hp=0;assert.ok(upgradeUnit(w,ship.id).error);
});

test('super platform still fires at one target per cooldown and uses its increased range and beam color',()=>{
  const w=createGame({mode:'skirmish',layoutSeed:17,visitorSeed:42});w.ai.disabled=true;w.visitors.nextAt=Infinity;setGravity(w,{g:0});
  const p=w.units.find(u=>u.type==='platform'&&u.team==='player');p.omega=0;w.metal.player=200;upgradeUnit(w,p.id);
  const enemy=w.units.find(u=>u.type==='booster'&&u.team==='enemy');
  Object.assign(enemy,{x:p.x+155,y:p.y,vx:0,vy:0,hp:1000,maxHp:1000,thrust:0});enemy.order={kind:'stop',x:enemy.x,y:enemy.y};
  const other=structuredClone(enemy);other.id='other';other.y+=1;w.units=[p,enemy,other];p.fireTimer=0;
  step(w);assert.equal(enemy.hp,984);assert.equal(other.hp,1000);
  const shot=w.effects.find(e=>e.type==='shot');assert.equal(shot.tier,2);assert.equal(shot.color,p.color);
  for(let i=0;i<28;i++)step(w);assert.equal(enemy.hp,984);
  for(let i=0;i<3;i++)step(w);assert.equal(enemy.hp,968);assert.equal(other.hp,1000);
});

test('super drone acquires attackers beyond basic reach and delivers increased ram damage',()=>{
  const w=createGame({mode:'skirmish',layoutSeed:17,visitorSeed:42});w.ai.disabled=true;w.visitors.nextAt=Infinity;setGravity(w,{g:0});
  const drone=w.units.find(u=>u.type==='drone'&&u.team==='player'),home=entity(w,drone.hostId);
  const enemy=w.units.find(u=>u.type==='booster'&&u.team==='enemy');
  Object.assign(enemy,{x:home.x+220,y:home.y,vx:0,vy:0,hp:200,maxHp:200,thrust:0});enemy.order={kind:'stop',x:enemy.x,y:enemy.y};
  w.units=[drone,enemy];step(w);assert.equal(drone.ramTargetId,null);
  w.metal.player=100;upgradeUnit(w,drone.id);step(w);assert.equal(drone.ramTargetId,enemy.id);
  for(let i=0;i<20/DT && drone.hp>0;i++)step(w);
  assert.equal(drone.hp,0);assert.equal(enemy.hp,130);
});

test('skirmish opponent pays the same upgrade price and restart begins basic',()=>{
  const options={mode:'skirmish',layoutSeed:17,visitorSeed:42};const w=createGame(options);
  w.time=150;w.visitors.nextAt=Infinity;w.ai.buildAt=w.ai.attackAt=w.ai.rockAt=w.ai.launchAt=Infinity;w.metal.enemy=300;
  step(w);const u=w.units.find(u=>u.team==='enemy'&&u.tier===2);assert.ok(u);
  assert.ok(Math.abs(w.metal.enemy-(300+.4*DT-UPGRADES[u.type].cost))<1e-8);
  assert.ok(createGame(options).units.every(u=>u.tier!==2));
});
