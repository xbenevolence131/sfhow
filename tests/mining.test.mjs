import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/scenarios.js';
import {spawn,setOrder,predict,advanceMotion,step,DT,MINING_RATE,launchRock,entity,addRock} from '../src/simulation.js';
import {contextualOrder} from '../src/orders.js';

function fixture(){
  const w=createGame({mode:'skirmish',layoutSeed:17,visitorSeed:42});w.ai.disabled=true;w.visitors.nextAt=Infinity;
  const home=w.planets.find(p=>p.team==='player'),rock=w.units.find(u=>u.innerRock),miner=spawn(w,'miner','player',home);
  Object.assign(miner,{x:rock.x+80,y:rock.y,vx:rock.vx,vy:rock.vy});
  return {w,home,rock,miner};
}
function dock(w,miner,rock){
  assert.ok(setOrder(w,miner.id,{kind:'mine',targetId:rock.id}));
  for(let i=0;i<120/DT&&!miner.miningRockId;i++)advanceMotion(w,DT,true);
  assert.equal(miner.miningRockId,rock.id);assert.equal(rock.minerId,miner.id);
}

test('miner deployment, contextual order and docking forecast match real flight without forecast income',()=>{
  const {w,rock,miner}=fixture();assert.equal(w.metal.player,135);assert.equal(miner.hp,65);
  const order=contextualOrder(w,miner.id,rock,rock);assert.equal(order.pending.order.kind,'mine');
  const before=structuredClone(w),forecast=predict(w,[miner.id],order.pending).get(miner.id);assert.deepEqual(w,before);
  assert.ok(forecast.attachment);dock(w,miner,rock);
  assert.ok(Math.abs(w.time-forecast.attachment.time)<DT);
  const balance=w.metal.player;for(let i=0;i<20;i++)step(w);
  assert.ok(Math.abs(w.metal.player-balance-(.4+MINING_RATE))<1e-7);
  assert.ok(Math.abs(miner.vx-rock.vx)<1e-9);
});

test('mining stops on departure, launch or death and a dock cannot be double occupied',()=>{
  const {w,home,rock,miner}=fixture();dock(w,miner,rock);
  const second=spawn(w,'miner','player',home,true);
  assert.equal(setOrder(w,second.id,{kind:'mine',targetId:rock.id}),false);
  assert.ok(contextualOrder(w,second.id,rock,rock).error);
  const before=structuredClone(w);predict(w,[miner.id],{id:miner.id,order:{kind:'move',x:600,y:700}});assert.deepEqual(w,before);
  assert.ok(setOrder(w,miner.id,{kind:'defend',targetId:home.id}));assert.equal(rock.minerId,null);
  dock(w,miner,rock);
  const booster=w.units.find(u=>u.type==='booster'&&u.team==='player');
  Object.assign(booster,{attachedRockId:rock.id,loaded:true,attachOffset:{x:20,y:0},order:{kind:'attached',targetId:rock.id}});
  Object.assign(rock,{boosterId:booster.id,boosterTeam:'player'});
  assert.ok(!launchRock(w,rock.id,{x:2,y:1}).error);assert.equal(miner.miningRockId,null);assert.equal(rock.minerId,null);assert.ok(miner.hp>0);
  const fresh=fixture();dock(fresh.w,fresh.miner,fresh.rock);fresh.miner.hp=0;advanceMotion(fresh.w);assert.equal(fresh.rock.minerId,null);
  const impact=fixture();dock(impact.w,impact.miner,impact.rock);impact.rock.hp=0;advanceMotion(impact.w);assert.equal(impact.miner.hp,0);
});

test('warships escort moving miners and engage enemies near their escort',()=>{
  const {w,miner}=fixture();const ship=w.units.find(u=>u.type==='ship'&&u.team==='player');
  const order=contextualOrder(w,ship.id,miner,miner);assert.equal(order.label,'Escort');assert.equal(order.pending.order.kind,'defend');
  assert.ok(setOrder(w,ship.id,order.pending.order));
  Object.assign(ship,{x:miner.x+30,y:miner.y,vx:miner.vx,vy:miner.vy});
  const foe=w.units.find(u=>u.type==='booster'&&u.team==='enemy');Object.assign(foe,{x:miner.x+60,y:miner.y,vx:miner.vx,vy:miner.vy});foe.order={kind:'stop',x:foe.x,y:foe.y};
  ship.fireTimer=0;step(w);assert.ok(foe.hp<foe.maxHp);assert.equal(ship.order.targetId,miner.id);
  assert.ok(entity(w,miner.id));
});

test('enemy builds and dispatches a paid miner in skirmish',()=>{
  const w=createGame({mode:'skirmish',layoutSeed:17,visitorSeed:42});w.time=110;w.metal.enemy=100;w.visitors.nextAt=Infinity;
  w.ai.buildAt=110;w.ai.attackAt=w.ai.rockAt=w.ai.launchAt=w.ai.upgradeAt=Infinity;
  step(w);const miner=w.units.find(u=>u.type==='miner'&&u.team==='enemy');assert.ok(miner);assert.equal(miner.order.kind,'mine');assert.ok(w.metal.enemy<76);
});

test('finite reserves scale by size, conserve partial extraction, stop at depletion and survive forecasts',()=>{
  const {w,rock,miner}=fixture();
  for(const [size,reserve] of [['small',40],['medium',80],['large',160]]){
    const r=addRock(w,1,1200,`reserve ${size}`,size);assert.equal(r.metalRemaining,reserve);assert.equal(r.metalCapacity,reserve);
  }
  dock(w,miner,rock);rock.metalRemaining=.025;w.metal.player=100;
  const before=structuredClone(w);predict(w,[rock.id]);assert.deepEqual(w,before);
  for(let i=0;i<20;i++)advanceMotion(w);
  assert.ok(Math.abs(w.metal.player-100.025)<1e-8);assert.equal(rock.metalRemaining,0);
  assert.equal(w.events.filter(e=>e.text===`${rock.name} depleted`).length,1);
  assert.ok(contextualOrder(w,miner.id,rock,rock).error);
  assert.equal(setOrder(w,miner.id,{kind:'mine',targetId:rock.id}),false);
  assert.equal(miner.miningRockId,rock.id,'invalid order keeps miner docked');
  rock.metalRemaining=1;w.metal.player=999;advanceMotion(w);assert.equal(rock.metalRemaining,1,'full treasury does not discard ore');
  rock.metalRemaining=0;const damage=rock.damage;
  const booster=w.units.find(u=>u.type==='booster'&&u.team==='player');Object.assign(booster,{attachedRockId:rock.id,loaded:true,attachOffset:{x:20,y:0},order:{kind:'attached',targetId:rock.id}});
  Object.assign(rock,{boosterId:booster.id,boosterTeam:'player'});
  assert.ok(!launchRock(w,rock.id,{x:2,y:1}).error);assert.equal(rock.damage,damage);assert.equal(miner.miningRockId,null);
});

test('enemy miner moves to fresh ore after depletion',()=>{
  const w=createGame({mode:'skirmish',layoutSeed:17,visitorSeed:42});w.visitors.nextAt=Infinity;
  w.ai.buildAt=w.ai.attackAt=w.ai.rockAt=w.ai.launchAt=w.ai.upgradeAt=Infinity;
  const home=w.planets.find(p=>p.team==='enemy'),miner=spawn(w,'miner','enemy',home,true),rock=w.units.find(u=>u.type==='rock');
  Object.assign(miner,{miningRockId:rock.id,miningOffset:{x:20,y:0},order:{kind:'mine',targetId:rock.id}});rock.minerId=miner.id;rock.metalRemaining=0;
  step(w);assert.equal(miner.miningRockId,null);assert.equal(miner.order.kind,'mine');assert.notEqual(miner.order.targetId,rock.id);
});
