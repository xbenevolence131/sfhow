import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/scenarios.js';
import { DT, distance, setOrder, advanceMotion, predict, step } from '../src/simulation.js';

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

test('attack circles a moving booster in range while firing at every available cooldown', () => {
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
  assert.ok(Math.abs(turn) > Math.PI * 1.5, `must visibly circle, actual turn ${turn}`);
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

test('circling also follows moving combat ships, drones, and prescribed-orbit platforms', () => {
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
    assert.ok(Math.abs(turn)>Math.PI,`${type}: turn ${turn}`);
    assert.ok(clearance>0,`${type}: must clear planets, actual ${clearance}`);
  }
});

test('enemy ships use the same circling rules', () => {
  const { w, ship, target } = pursuitFixture();
  ship.team='enemy';target.team='player';
  let turn=0,angle=Math.atan2(ship.y-target.y,ship.x-target.x);
  for(let i=0;i<30/DT;i++) {
    advanceMotion(w);
    const next=Math.atan2(ship.y-target.y,ship.x-target.x);
    turn+=Math.atan2(Math.sin(next-angle),Math.cos(next-angle));angle=next;
  }
  assert.ok(Math.abs(turn)>Math.PI);assert.ok(distance(ship,target)<ship.range);
});
