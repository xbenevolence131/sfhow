import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createScenario } from '../src/scenarios.js';
import { spawn, launchRock, step, CAP, COST, fleet, orbitalRate, BELT_INNER, BELT_WIDTH, advanceMotion, distance } from '../src/simulation.js';

test('skirmish seeds vary fixed orbital radii and angles, keep safe fleets, and add 23 belt plus two inner rocks',()=>{
  const base=createScenario('neighbors'),layouts=new Set();
  for(let seed=0;seed<32;seed++){
    const w=createGame({mode:'skirmish',system:seed%2?'two':'three',layoutSeed:seed,visitorSeed:12});
    assert.deepEqual(createGame(w.setup),w);
    layouts.add(JSON.stringify(w.planets.map(p=>[p.orbit,p.phase])));
    for(const p of w.planets){
      const reference=base.planets.find(b=>b.id===p.id);
      assert.ok(p.orbit>=reference.orbit*.92 && p.orbit<=reference.orbit*1.08);
      assert.equal(p.omega,orbitalRate(p.orbit,w.gravity));
      assert.ok(Math.abs(Math.hypot(p.x,p.y)-p.orbit)<1e-9);
      assert.ok(p.orbit+p.radius<BELT_INNER-100);
      for(const u of w.units.filter(u=>u.hostId===p.id)){
        assert.ok(distance(u,p)>p.radius+u.radius);
        assert.ok(distance(u,p)<110);
        const old=base.units.find(b=>b.id===u.id);
        assert.ok(Math.abs((u.vx-p.vx)-(old.vx-reference.vx))<1e-9);
        assert.ok(Math.abs((u.vy-p.vy)-(old.vy-reference.vy))<1e-9);
      }
    }
    const rocks=w.units.filter(u=>u.type==='rock' && !u.innerRock);assert.equal(rocks.length,23);
    for(const rock of rocks){assert.ok(rock.beltOrbit>=BELT_INNER && rock.beltOrbit<=BELT_INNER+BELT_WIDTH);
      for(const other of rocks)if(other!==rock)assert.ok(distance(rock,other)>rock.radius+other.radius+20);
    }
    const inner=w.units.filter(u=>u.innerRock);assert.equal(inner.length,2);
    for(const rock of inner){
      assert.equal(rock.size,'large');assert.equal(rock.launched,false);
      assert.ok(rock.beltOrbit<BELT_INNER);
      for(const p of w.planets)assert.ok(Math.abs(p.orbit-rock.beltOrbit)>p.radius+rock.radius+60);
    }
    for(let n=0;n<20;n++)advanceMotion(w);
    for(const p of w.planets)assert.ok(Math.abs(Math.hypot(p.x,p.y)-p.orbit)<1e-9);
  }
  assert.equal(layouts.size,32);
});

test('skirmish configuration is repeatable, balanced in budget, and keeps victory/defeat', () => {
  for (const system of ['two', 'three']) {
    const w = createGame({ mode: 'skirmish', system, budget: 400, enemies: false, unlimited: true });
    assert.equal(w.planets.length, system === 'two' ? 2 : 3);
    assert.deepEqual(w.metal, { player: 400, enemy: 400 });
    assert.equal(w.unlimitedMetal, false);
    assert.ok(w.planets.filter(p=>p.team!=='neutral').every(p=>p.hp===300 && p.maxHp===300));
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
