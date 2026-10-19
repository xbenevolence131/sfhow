import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/scenarios.js';
import {step,setGravity,spawn,COST,DT} from '../src/simulation.js';

function fixture(count=5){
  const w=createGame({mode:'skirmish',layoutSeed:17,visitorSeed:42});
  setGravity(w,{g:0});w.visitors.nextAt=Infinity;w.threatScanAt=Infinity;
  for(const key of ['buildAt','attackAt','rockAt','launchAt','upgradeAt'])w.ai[key]=Infinity;
  const home=w.planets.find(p=>p.team==='enemy'),target=w.planets.find(p=>p.team==='player');
  w.units=[];
  const ships=Array.from({length:count},()=>spawn(w,'ship','enemy',home,true));
  for(const s of ships)s.fireTimer=999;
  return {w,home,target,ships};
}

test('damaged fighters retreat and do not resume duties before recovering at home',()=>{
  const {w,home,target,ships}=fixture(1),s=ships[0];
  s.hp=s.maxHp*.3;s.order={kind:'attack',targetId:target.id};
  step(w);assert.equal(s.aiRepairing,true);assert.deepEqual(s.order,{kind:'defend',targetId:home.id});
  s.hp=s.maxHp*.6;w.ai.thinkAt=0;step(w);assert.equal(s.aiRepairing,true);
  s.hp=s.maxHp*.86;Object.assign(s,{x:home.x+60,y:home.y,vx:0,vy:0});w.ai.thinkAt=0;
  step(w);assert.equal(s.aiRepairing,false);
});

test('opponent keeps a guard, escorts exposed support, and sends a pair against exposed economy',()=>{
  const {w,home,target,ships}=fixture();
  const miner=spawn(w,'miner','enemy',home,true),booster=spawn(w,'booster','enemy',home,true);
  // A real scenario rock keeps the support orders valid during movement.
  const rocks=createGame({mode:'skirmish',layoutSeed:17,visitorSeed:42}).units.filter(u=>u.type==='rock').slice(0,2);
  for(let i=0;i<2;i++){rocks[i].id=`test-rock-${i}`;w.units.push(rocks[i]);}
  Object.assign(miner,{x:home.x+350,y:home.y,order:{kind:'mine',targetId:rocks[0].id}});
  Object.assign(booster,{x:home.x+360,y:home.y,order:{kind:'fit',targetId:rocks[1].id}});
  const prey=spawn(w,'miner','player',target,true);prey.x=target.x+300;prey.order={kind:'stop',x:prey.x,y:prey.y};
  w.ai.attackAt=0;step(w);
  assert.equal(ships.filter(s=>s.order.kind==='defend'&&s.order.targetId===home.id).length,1);
  assert.equal(ships.filter(s=>s.order.targetId===miner.id).length,1);
  assert.equal(ships.filter(s=>s.order.targetId===booster.id).length,1);
  assert.equal(ships.filter(s=>s.order.kind==='attack'&&s.order.targetId===prey.id).length,2);
});

test('a near-term rock threat late in a match recalls two guards and postpones new raids',()=>{
  const {w,home,target,ships}=fixture();w.time=200;
  for(const s of ships)s.order={kind:'attack',targetId:target.id};
  w.rockThreats={incoming:{targetId:home.id,time:220}};w.ai.attackAt=0;
  step(w);
  assert.equal(ships.filter(s=>s.order.kind==='defend'&&s.order.targetId===home.id).length,2);
  assert.equal(w.ai.attackAt,0,'raid timer remains ready rather than announcing another wave');
});

test('rebuilding spends normal metal and respects the twelve-unit cap',()=>{
  const {w}=fixture(1);w.metal.enemy=100;w.ai.buildAt=0;
  step(w);assert.equal(w.units.length,2);assert.ok(Math.abs(w.metal.enemy-(100+.8*DT-COST.ship))<1e-8);
  const full=fixture(12);full.w.metal.enemy=400;full.w.ai.buildAt=0;
  step(full.w);assert.equal(full.w.units.length,12);assert.ok(Math.abs(full.w.metal.enemy-(400+.8*DT))<1e-8);
});
