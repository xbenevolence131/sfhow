import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/scenarios.js';
import { contextualOrder } from '../src/orders.js';
import { DT, MAX_IMPULSE, planRockTarget, predict, launchRock, advanceMotion, setOrder } from '../src/simulation.js';

const setup = () => {
  const w = createGame({ mode: 'skirmish' });
  const unit = (type, team = 'player') => w.units.find(u => u.type === type && u.team === team);
  return { w, unit, home: w.planets[0], enemy: w.planets[1], rock: unit('rock', 'neutral'), point: { x: 800, y: 600 } };
};
const attach = (rock, booster) => {
  Object.assign(rock, { team: 'player', boosterTeam: 'player', boosterId: booster.id });
  Object.assign(booster, { attachedRockId: rock.id, attachOffset: { x: 16, y: 0 }, order: { kind: 'attached', targetId: rock.id } });
};

test('cursor hint and right-click share valid orders for each unit/target pairing', () => {
  const { w, unit, home, enemy, rock, point } = setup();
  const cases = [
    ['ship', enemy, 'attack', 'Attack'], ['ship', unit('booster','enemy'), 'attack', 'Attack'],
    ['ship', unit('booster'), 'defend', 'Escort'], ['ship', unit('drone'), 'defend', 'Escort'],
    ['ship', home, 'defend', 'Defend'], ['ship', unit('platform'), 'defend', 'Defend'],
    ['ship', null, 'move', 'Move'], ['booster', rock, 'fit', 'Attach booster'],
    ['booster', home, 'rearm', 'Return and reload'], ['booster', null, 'move', 'Move'],
    ['drone', home, 'defend', 'Defend'], ['drone', unit('platform'), 'defend', 'Defend'],
  ];
  for (const [type, target, kind, label] of cases) {
    const u = unit(type), action = contextualOrder(w, u.id, target, point);
    assert.equal(action.label,label); assert.equal(action.pending.order.kind,kind);
    assert.ok(setOrder(w,u.id,action.pending.order));
    if(target) assert.equal(u.order.targetId,target.id);
    else assert.equal(u.order.x,point.x);
  }
  for(const [u,target] of [[unit('drone'),null],[unit('drone'),enemy],[unit('booster'),enemy],[unit('platform'),home]]) {
    assert.ok(contextualOrder(w,u.id,target,point).error);
  }
  attach(rock,unit('booster'));
  assert.ok(contextualOrder(w,unit('booster').id,home,point).error,'attached ship must detach before travel');
});

test('equipped rocks target planets or manually aim with a capped additional impulse', () => {
  const { w, unit, rock, home, point }=setup();
  assert.ok(contextualOrder(w,rock.id,home,point).error);
  attach(rock,unit('booster'));
  const targeted=contextualOrder(w,rock.id,home,point);
  assert.equal(targeted.rockTargetId,home.id);
  const manual=contextualOrder(w,rock.id,null,{x:rock.x+10000,y:rock.y});
  assert.equal(manual.label,'Aim launch');assert.equal(manual.pending.impulse.x,MAX_IMPULSE);
  assert.equal(manual.pending.impulse.y,0);
  assert.ok(contextualOrder(w,rock.id,unit('ship'),point).error);
  rock.launched=true;assert.ok(contextualOrder(w,rock.id,null,point).error);
});

test('planet auto-aim verifies moving-target impact with the real burn and flight rules', () => {
  for(const targetId of ['verdant','cinder','ochre']) {
    const { w, unit, rock }=setup(), target=w.planets.find(p=>p.id===targetId);
    Object.assign(rock,{x:target.x+250,y:target.y+90,vx:0,vy:0});attach(rock,unit('booster'));
    const before=structuredClone(w), pending=planRockTarget(w,rock,target);
    assert.deepEqual(w,before,'planning must not spend metal, launch, or move anything');
    assert.ok(pending.aim.verified, `${targetId}: ${pending.aim.reason}`);
    assert.ok(Math.hypot(pending.impulse.x,pending.impulse.y)<=MAX_IMPULSE+1e-9);
    const f=predict(w,[rock.id],pending).get(rock.id);
    assert.equal(f.impact.targetId,targetId); assert.ok(f.ghost);
    assert.ok(!launchRock(w,rock.id,pending.impulse).error);
    for(let i=0;i<90/DT&&rock.hp>0;i++) advanceMotion(w);
    assert.equal(rock.impact.targetId,targetId);
    assert.ok(Math.abs(rock.impact.time-f.impact.time)<DT);
  }
});

test('an unreachable planet returns an honest unverified preview within the impulse cap', () => {
  const { w, unit, rock, home }=setup();
  Object.assign(rock,{x:-2300,y:-1300,vx:-20,vy:-10});attach(rock,unit('booster'));
  const pending=planRockTarget(w,rock,home);
  assert.equal(pending.aim.verified,false);assert.ok(pending.aim.reason);
  assert.ok(Math.hypot(pending.impulse.x,pending.impulse.y)<=MAX_IMPULSE+1e-9);
  assert.equal(rock.launched,false);
});
