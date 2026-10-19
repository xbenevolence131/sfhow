import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/scenarios.js';
import { DT, distance, setOrder, setGravity, advanceMotion, predict, step } from '../src/simulation.js';

function pursuitFixture(type = 'booster', moving = true) {
  const w = createGame({ mode: 'sandbox', enemies: true });
  w.ai = { buildAt: Infinity, attackAt: Infinity, rockAt: Infinity, launchAt: Infinity };
  const ship = w.units.find(u => u.type === 'ship' && u.team === 'player');
  const target = w.units.find(u => u.type === type && u.team === 'enemy');
  w.units = [ship, target];
  Object.assign(target, { x: 550, y: 350, vx: moving ? 19 : 0, vy: 0, hp: 10000,
    order: moving ? { kind: 'move', x: 1600, y: 350 } : { kind: 'stop', x: 550, y: 350 } });
  Object.assign(ship, { x: 490, y: 350, vx: target.vx, vy: 0, fireTimer: 0 });
  setOrder(w, ship.id, { kind: 'attack', targetId: target.id });
  return { w, ship, target };
}

test('attack tracks a moving booster in range while firing at every available cooldown', () => {
  const { w, ship, target } = pursuitFixture();
  let angle = Math.atan2(ship.y - target.y, ship.x - target.x), turn = 0, inRange = 0, min = Infinity, max = 0;
  const frames = 40 / DT;
  for (let i = 0; i < frames; i++) {
    step(w);
    const next = Math.atan2(ship.y - target.y, ship.x - target.x);
    turn += Math.atan2(Math.sin(next-angle), Math.cos(next-angle)); angle = next;
    const d = distance(ship,target); min=Math.min(min,d);max=Math.max(max,d);
    if(d <= ship.range) inRange++;
  }
  assert.ok(Math.abs(turn) < .5, `must track without circling, actual turn ${turn}`);
  assert.ok(inRange / frames > .95, `must stay in firing range: ${inRange/frames}`);
  assert.ok(min > ship.radius + target.radius, `must not pass through target: ${min}`);
  assert.ok(max < ship.range, `must not drift ahead out of range: ${max}`);
  assert.ok(10000-target.hp >= ship.damage * 17, `must fire consistently: ${10000-target.hp} damage`);
  assert.equal(ship.order.targetId,target.id);
});

test('attack acquires a distant unit and the curved forecast matches actual assisted flight', () => {
  const { w, ship, target } = pursuitFixture('booster',false);
  ship.x -= 230; ship.vx=0;
  const forecast=predict(w,[ship.id],null,50).get(ship.id);
  for(let n=1;n<=50/DT;n++) {
    advanceMotion(w);
    if(n%12===0) assert.ok(distance(ship,forecast.points[n/12]) < 1e-8);
  }
  assert.ok(distance(ship,target) < ship.range);
  assert.ok(forecast.eta < 25);
});

test('unit attack keeps priority over closer enemies and ends when target dies or order changes', () => {
  const { w, ship, target } = pursuitFixture('booster',false);
  target.hp=ship.damage;
  const decoy={...target,id:'decoy',name:'DECOY',x:ship.x+20,y:ship.y,hp:100};
  w.units.push(decoy);
  step(w);
  assert.equal(target.hp,0); assert.equal(decoy.hp,100);
  step(w); assert.equal(ship.order.kind,'stop');
  setOrder(w,ship.id,{kind:'attack',targetId:decoy.id});
  setOrder(w,ship.id,{kind:'defend',targetId:'verdant'});
  advanceMotion(w); assert.equal(ship.order.kind,'defend');
  setOrder(w,ship.id,{kind:'stop',x:ship.x,y:ship.y});
  advanceMotion(w); assert.equal(ship.order.kind,'stop');
});

test('tracking also follows moving combat ships, drones, and prescribed-orbit platforms', () => {
  for(const type of ['ship','drone','platform']) {
    const {w,ship,target}=pursuitFixture(type);
    if(type==='platform') {
      const host=w.planets.find(p=>p.id===target.hostId);
      target.x=host.x+Math.cos(target.phase)*target.orbit;
      target.y=host.y+Math.sin(target.phase)*target.orbit;
      ship.x=target.x+60;ship.y=target.y;ship.vx=host.vx;ship.vy=host.vy;
    }
    let inRange=0,turn=0,angle=Math.atan2(ship.y-target.y,ship.x-target.x), clearance=Infinity;
    for(let i=0;i<40/DT;i++) {
      advanceMotion(w);
      if(distance(ship,target)<=ship.range) inRange++;
      for(const p of w.planets) clearance=Math.min(clearance,distance(ship,p)-p.radius-ship.radius);
      const next=Math.atan2(ship.y-target.y,ship.x-target.x);
      turn+=Math.atan2(Math.sin(next-angle),Math.cos(next-angle));angle=next;
    }
    assert.ok(inRange/(40/DT)>.8,`${type}: in range ${inRange/(40/DT)}`);

    assert.ok(clearance>0,`${type}: must clear planets, actual ${clearance}`);
  }
});

test('enemy ships use the same direct tracking rules', () => {
  const { w, ship, target } = pursuitFixture();
  ship.team='enemy';target.team='player';
  let turn=0,angle=Math.atan2(ship.y-target.y,ship.x-target.x);
  for(let i=0;i<30/DT;i++) {
    advanceMotion(w);
    const next=Math.atan2(ship.y-target.y,ship.x-target.x);
    turn+=Math.atan2(Math.sin(next-angle),Math.cos(next-angle));angle=next;
  }
  assert.ok(Math.abs(turn)<.5);assert.ok(distance(ship,target)<ship.range);
});

test('clear stationary approaches stay direct and brake inside range for both factions',()=>{
  for(const team of ['player','enemy']){
    const {w,ship,target}=pursuitFixture('booster',false);setGravity(w,{g:0});
    ship.team=team;target.team=team==='player'?'enemy':'player';
    ship.x=250;ship.vx=ship.vy=0;
    const preview=predict(w,[ship.id],null,30).get(ship.id);
    assert.ok(preview.eta>0&&preview.eta<20,'ETA reports entry into gun range, not a docking distance');
    let maxSideways=0;
    for(let i=0;i<30/DT;i++){step(w);maxSideways=Math.max(maxSideways,Math.abs(ship.y-350));}
    assert.ok(maxSideways<1e-7);assert.ok(distance(ship,target)<ship.range);
    assert.ok(distance(ship,target)>ship.range*.7,'brakes without diving onto the target');
    assert.ok(Math.hypot(ship.vx,ship.vy)<.1);assert.ok(target.hp<10000);
  }
});

test('incoming units enter the guns without the fighter retreating to maintain distance',()=>{
  for(const kind of ['attack','defend']){
    const {w,ship,target}=pursuitFixture();setGravity(w,{g:0});
    Object.assign(ship,{x:400,y:350,vx:0,vy:0});
    Object.assign(target,{x:590,y:350,vx:-19,vy:0,order:{kind:'move',x:0,y:350}});
    if(kind==='defend'){
      const home=w.planets.find(p=>p.id===ship.hostId);
      Object.assign(home,{x:400,y:270,orbit:Math.hypot(400,270),phase:Math.atan2(270,400),omega:0});
      setOrder(w,ship.id,{kind:'defend',targetId:home.id});
    }
    for(let i=0;i<5/DT&&target.hp===10000;i++){
      step(w);assert.ok(ship.x>=400-1e-7,'do not back away from incoming enemy');
      assert.ok(Math.abs(ship.y-350)<1e-7,'no forced sideways motion');
    }
    assert.ok(target.hp<10000,`${kind} must open fire within five seconds`);
  }
});
