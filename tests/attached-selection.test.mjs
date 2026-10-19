import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario } from '../src/scenarios.js';
import { setOrder, predict, launchRock, advanceMotion, DT } from '../src/simulation.js';
import { contextualOrder } from '../src/orders.js';

function fixture() {
  const w = createScenario('playground');
  const rock = w.units.find(u => u.type === 'rock' && u.boosterId);
  const booster = w.units.find(u => u.id === rock.boosterId);
  return { w, rock, booster, home: w.planets.find(p => p.team === 'player') };
}

test('attached booster departure previews are reversible; invalid orders do not detach', () => {
  const { w, rock, booster, home } = fixture();
  assert.equal(setOrder(w, booster.id, { kind: 'rearm', targetId: 'missing' }), false);
  assert.equal(booster.attachedRockId, rock.id);
  const action = contextualOrder(w, booster.id, home, home);
  assert.match(action.label, /Detach/);
  const before = structuredClone(w);
  predict(w, [booster.id], action.pending, 3);
  assert.deepEqual(w, before);
  assert.ok(setOrder(w, booster.id, action.pending.order));
  assert.equal(booster.attachedRockId, null);
  assert.equal(rock.boosterId, null);
  assert.equal(rock.team, 'neutral');
  assert.equal(rock.launched, false);
  assert.equal(booster.loaded, true);
  assert.equal(booster.order.kind, 'rearm');
});

test('booster can detach to empty space and follows the same preview as actual flight', () => {
  const { w, rock, booster } = fixture();
  const action = contextualOrder(w, booster.id, null, { x: rock.x + 120, y: rock.y + 100 });
  const flight = predict(w, [booster.id], action.pending, 3).get(booster.id);
  const sample = flight.points.at(-1);
  assert.ok(setOrder(w, booster.id, action.pending.order));
  for (let i = 0; i < Math.round(sample.t / DT); i++) advanceMotion(w);
  assert.ok(Math.hypot(booster.x - sample.x, booster.y - sample.y) < 1e-7);
  assert.equal(booster.order.kind, 'move');
});

test('departure during launch waits for burn completion and is included in prediction', () => {
  const { w, rock, booster } = fixture();
  assert.ok(!launchRock(w, rock.id, { x: 2, y: 0 }).error);
  const action = contextualOrder(w, booster.id, null, { x: rock.x + 100, y: rock.y + 160 });
  assert.match(action.label, /After burn/);
  const flight = predict(w, [booster.id], action.pending, 8).get(booster.id);
  assert.ok(setOrder(w, booster.id, action.pending.order));
  assert.equal(booster.attachedRockId, rock.id);
  assert.equal(setOrder(w, booster.id, { kind: 'detach' }), false);
  const sample = flight.points.at(-1);
  for (let i = 0; i < Math.round(sample.t / DT); i++) advanceMotion(w);
  assert.equal(booster.attachedRockId, null);
  assert.equal(booster.departureOrder, null);
  assert.equal(booster.order.kind, 'move');
  assert.equal(booster.loaded, false);
  assert.ok(Math.hypot(booster.x - sample.x, booster.y - sample.y) < 1e-7);
});

