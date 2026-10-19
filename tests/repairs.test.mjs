import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/scenarios.js';
import {DT,step,setGravity,setOrder,shipRepairStatus,upgradeUnit,predict,spawn} from '../src/simulation.js';
function fixture(team='player'){
  const w=createGame({mode:'skirmish',layoutSeed:17,visitorSeed:42});w.ai.disabled=true;w.visitors.nextAt=Infinity;setGravity(w,{g:0});
  const ship=w.units.find(u=>u.type==='ship'&&u.team===team),home=w.planets.find(p=>p.id===ship.hostId);
  w.mode='sandbox';w.units=[ship];Object.assign(ship,{hp:50,x:home.x+home.radius+60,y:home.y,vx:0,vy:0});setOrder(w,ship.id,{kind:'stop',x:ship.x,y:ship.y},team);
  return {w,ship,home};
}
const tick=(w,t)=>{for(let i=0;i<Math.round(t/DT);i++)step(w);};
test('both factions repair free at one HP/s only after ten undamaged seconds; Super caps correctly',()=>{
  for(const team of ['player','enemy']){
    const {w,ship}=fixture(team);const metal=w.metal[team];
    tick(w,10);assert.ok(Math.abs(ship.hp-50)<1e-8);assert.equal(shipRepairStatus(w,ship).kind,'repairing');
    tick(w,5);assert.ok(Math.abs(ship.hp-55)<1e-8);
    assert.ok(Math.abs(w.metal[team]-(metal+.4*15))<1e-7,'only ordinary colony income, no repair charge');
    w.metal[team]=100;upgradeUnit(w,ship.id,team);ship.hp=ship.maxHp-.1;tick(w,1);assert.equal(ship.hp,145);assert.equal(shipRepairStatus(w,ship),null);
  }
});
test('repairs require a living owned home nearby and cannot revive ships or heal other unit types',()=>{
  for(const variant of ['away','enemy home','destroyed home','dead ship','booster']){
    const {w,ship,home}=fixture();w.time=20;
    if(variant==='away'){ship.x=home.x+home.radius+150;ship.order.x=ship.x;}
    if(variant==='enemy home')home.team='enemy';
    if(variant==='destroyed home')home.hp=0;
    if(variant==='dead ship')ship.hp=0;
    if(variant==='booster')ship.type='booster';
    const hp=ship.hp;step(w);assert.equal(ship.hp,hp,variant);
  }
});
test('actual gunfire interrupts repairs and leaving then returning preserves the cooldown',()=>{
  const {w,ship,home}=fixture();w.time=20;
  const enemy=spawn(w,'ship','enemy',w.planets.find(p=>p.team==='enemy'),true);
  Object.assign(enemy,{x:ship.x+40,y:ship.y,vx:0,vy:0,fireTimer:0});ship.fireTimer=999;
  step(w);assert.equal(ship.hp,42);assert.equal(ship.lastDamageAt,w.time);assert.equal(shipRepairStatus(w,ship).kind,'waiting');
  enemy.hp=0;ship.x=home.x+home.radius+150;ship.vx=ship.vy=0;ship.order={kind:'stop',x:ship.x,y:ship.y};tick(w,5);assert.equal(ship.hp,42);
  ship.x=home.x+home.radius+60;ship.order.x=ship.x;tick(w,5);assert.ok(Math.abs(ship.hp-42)<1e-8);tick(w,1);assert.ok(Math.abs(ship.hp-43)<1e-8);
});
test('drone rams restart the damage timer and previews never repair live units',()=>{
  const {w,ship}=fixture();w.time=20;ship.hp=100;
  const drone=spawn(w,'drone','enemy',w.planets.find(p=>p.team==='enemy'),true);
  Object.assign(drone,{x:ship.x,y:ship.y,vx:0,vy:0,order:{kind:'defend',targetId:drone.hostId}});
  const anchor=w.planets.find(p=>p.id===drone.hostId);Object.assign(anchor,{x:ship.x+30,y:ship.y});
  // Anchor needs a matching fixed position when planets advance at zero gravity.
  anchor.orbit=Math.hypot(anchor.x,anchor.y);anchor.phase=Math.atan2(anchor.y,anchor.x);
  ship.fireTimer=999;step(w);assert.equal(drone.hp,0);assert.equal(ship.hp,55);assert.ok(ship.lastDamageAt>=20);
  const before=structuredClone(w);predict(w,[ship.id],null,20);assert.deepEqual(w,before);
});
