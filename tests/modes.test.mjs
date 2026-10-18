import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/scenarios.js';
import { spawn, launchRock, step, CAP, COST, fleet } from '../src/simulation.js';

test('skirmish configuration is repeatable, balanced in budget, and keeps victory/defeat', () => {
  for (const system of ['two', 'three']) {
    const w = createGame({ mode: 'skirmish', system, budget: 400, enemies: false, unlimited: true });
    assert.equal(w.planets.length, system === 'two' ? 2 : 3);
    assert.deepEqual(w.metal, { player: 400, enemy: 400 });
    assert.equal(w.unlimitedMetal, false);
    assert.ok(fleet(w, 'enemy').length > 0);
    assert.deepEqual(createGame(w.setup), w);
    spawn(w, 'ship', 'player', w.planets[0]);
    assert.equal(w.metal.player, 400 - COST.ship);
    w.planets.find(p => p.team === 'enemy').hp = 0;
    step(w); assert.equal(w.outcome, 'victory');
    const loss = createGame(w.setup); loss.planets[0].hp = 0;
    step(loss); assert.equal(loss.outcome, 'defeat');
  }
});

test('quiet sandbox has no enemy spawning or outcome, even after colony destruction', () => {
  const w = createGame({ mode: 'sandbox', system: 'three', enemies: false, unlimited: false });
  assert.equal(w.planets.filter(p => p.team === 'neutral').length, 2);
  assert.equal(fleet(w, 'enemy').length, 0);
  w.time = 500; step(w);
  assert.equal(fleet(w, 'enemy').length, 0);
  w.planets[0].hp = 0;
  step(w); const previous = w.time; step(w);
  assert.equal(w.outcome, null); assert.ok(w.time > previous);
});

test('unlimited sandbox waives only player costs, retaining preparation, fleet cap and damage', () => {
  const w = createGame({ mode: 'sandbox', enemies: true, unlimited: true, budget: 160 });
  w.metal.player = 0; w.metal.enemy = 0;
  const home = w.planets[0], rival = w.planets.find(p => p.team === 'enemy');
  assert.equal(spawn(w, 'ship', 'player', home).error, undefined);
  assert.ok(spawn(w, 'ship', 'enemy', rival).error);
  assert.ok(spawn(w, 'ship', 'player', rival).error);
  const rock = w.units.find(u => u.type === 'rock');
  assert.ok(launchRock(w, rock.id, { x: 5, y: 0 }).error);
  const booster = w.units.find(u => u.type === 'booster' && u.team === 'player');
  Object.assign(booster, { attachedRockId: rock.id, attachOffset: { x: 18, y: 0 }, order: { kind: 'attached', targetId: rock.id } });
  Object.assign(rock, { boosterTeam: 'player', boosterId: booster.id, team: 'player' });
  assert.equal(launchRock(w, rock.id, { x: 5, y: 0 }).error, undefined);
  assert.equal(w.metal.player, 0); assert.equal(booster.loaded, false);
  while (fleet(w, 'player').length < CAP) spawn(w, 'drone', 'player', home);
  assert.ok(spawn(w, 'drone', 'player', home).error);
  // An incoming rock still damages the colony; sandbox does not make it invulnerable.
  Object.assign(rock, { x: home.x + home.radius + rock.radius + 1, y: home.y, vx: -100, vy: 0, burn: null });
  const hp = home.hp; step(w); assert.ok(home.hp < hp);
  home.hp = 0; rival.hp = 0; step(w); assert.equal(w.outcome, null);
});

test('sandbox with an opponent runs actual enemy production using its finite budget', () => {
  const w = createGame({ mode: 'sandbox', enemies: true, unlimited: true });
  const before = fleet(w, 'enemy').length;
  w.ai.buildAt = 0; step(w);
  assert.equal(fleet(w, 'enemy').length, before + 1);
  assert.ok(w.metal.enemy < 160);
});
