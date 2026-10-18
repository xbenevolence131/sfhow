import test from 'node:test';
import assert from 'node:assert/strict';
import { DT, COST, CAP, MAX_IMPULSE, ATTACH_TIME, BURN_TIME, gravity, spawn, launchRock, setOrder, predict, advanceMotion, step, entity, enemyLaunch, sendPracticeRock, dispatchBooster, aimRock, distance, planetAt, sweptHit, scanRockThreats } from '../src/simulation.js';
import { createScenario } from '../src/scenarios.js';

const advance = (w, seconds) => { for (let i = 0; i < Math.round(seconds / DT); i++) step(w); };
const equip = (w, rock, team = 'player') => {
  const booster = w.units.find(u => u.type === 'booster' && u.team === team && !u.attachedRockId) || spawn(w, 'booster', team, w.planets.find(p => p.team === team), true);
  assert.ok(!booster.error);
  Object.assign(booster, { x: rock.x + 18, y: rock.y, vx: rock.vx, vy: rock.vy, loaded: true,
    attachedRockId: rock.id, attachOffset: { x: 18, y: 0 }, order: { kind: 'attached', targetId: rock.id } });
  Object.assign(rock, { boosterId: booster.id, boosterTeam: team, team });
  return booster;
};

test('a clear planetary flyby bends visibly, matches its preview and remains stable at finer steps', () => {
  const fly = (weak = false, dt = DT, verifyPreview = false) => {
    const w = createScenario('neighbors'), planet = w.planets[0], rock = w.units.find(u => u.type === 'rock');
    if (weak) w.gravity.planetMass = 180;
    w.units = [rock];
    Object.assign(rock, { x: planet.x - 180, y: planet.y + 75, vx: planet.vx + 18, vy: planet.vy, launched: true });
    const forecast = verifyPreview ? predict(w, [rock.id], null, 40).get(rock.id) : null;
    let closest = Infinity;
    for (let n = 1; n <= Math.round(40 / dt); n++) {
      advanceMotion(w, dt); closest = Math.min(closest, distance(rock, planet));
      if (forecast && n % 12 === 0) assert.ok(distance(rock, forecast.points[n / 12]) < 1e-8);
    }
    assert.ok(rock.hp > 0);
    assert.ok(closest > planet.radius + rock.radius + 20, 'a useful hook should not require a near-collision');
    return { x: rock.x, y: rock.y, turn: Math.abs(Math.atan2(rock.vy - planet.vy, rock.vx - planet.vx) * 180 / Math.PI) };
  };
  const tuned = fly(false, DT, true), weak = fly(true), finer = fly(false, DT / 2);
  assert.ok(tuned.turn > 25 && tuned.turn - weak.turn > 20);
  assert.ok(distance(tuned, finer) < 1, 'close-pass integration should converge with a smaller step');
});
test('every scenario starts with a safe fleet and clean state', () => {
  for (const key of ['garden', 'hold', 'neighbors']) {
    const w = createScenario(key);
    assert.equal(w.time, 0); assert.equal(w.outcome, null);
    assert.equal(w.units.filter(u => u.team === 'player').length, 5);
    for (const u of w.units.filter(u => u.type !== 'rock')) {
      const p = entity(w, u.hostId); assert.ok(distance(u, p) > p.radius + u.radius);
    }
    assert.ok(w.planets.length <= 3);
  }
});
test('deployment enforces colony ownership, costs and cap', () => {
  const w = createScenario('neighbors'), home = w.planets[0], budget = w.metal.player;
  assert.ok(spawn(w, 'ship', 'player', w.planets[1]).error);
  const ship = spawn(w, 'ship', 'player', home);
  assert.equal(w.metal.player, budget - COST.ship); assert.equal(ship.order.kind, 'defend');
  w.metal.player = 0; assert.ok(spawn(w, 'drone', 'player', home).error);
  w.metal.player = 9999;
  while (w.units.filter(u => u.team === 'player').length < CAP) spawn(w, 'drone', 'player', home);
  assert.ok(spawn(w, 'ship', 'player', home).error);
});
test('planned powered flight exactly matches live motion at fixed samples', () => {
  const w = createScenario('neighbors'), ship = w.units.find(u => u.type === 'ship' && u.team === 'player');
  const order = { kind: 'attack', targetId: 'cinder' };
  const f = predict(w, [ship.id], { id: ship.id, order }, 60).get(ship.id);
  assert.equal(ship.order.kind, 'defend', 'preview must not mutate live state');
  setOrder(w, ship.id, order);
  for (let i = 1; i <= 1200; i++) {
    advanceMotion(w);
    if (i % 12 === 0) {
      const predicted = f.points[i / 12];
      assert.ok(predicted); assert.ok(distance(ship, predicted) < 1e-8);
    }
  }
  assert.ok(f.eta > 5 && f.eta < 90); assert.ok(f.ghost);
  assert.ok(distance(ship, entity(w, 'cinder')) < ship.range + 25);
});
test('rock burn delivers a clamped velocity change over time, charges once, and matches its forecast', () => {
  const w = createScenario(), rock = w.units.find(u => u.type === 'rock'), vx = rock.vx, vy = rock.vy;
  const impulse = { x: -8, y: 2 }, before = w.metal.player;
  equip(w, rock);
  const f = predict(w, [rock.id], { id: rock.id, impulse }, 12).get(rock.id);
  launchRock(w, rock.id, impulse);
  assert.equal(rock.vx, vx); assert.equal(rock.vy, vy, 'launch cannot instantly change velocity');
  assert.equal(rock.burn.ax * BURN_TIME, -8); assert.equal(rock.burn.ay * BURN_TIME, 2);
  assert.equal(w.metal.player, before - COST.rock);
  assert.ok(launchRock(w, rock.id, impulse).error);
  for (let i = 0; i < 240; i++) {
    const g = gravity(rock.x, rock.y, w.planets), burning = rock.burn.remaining > 0;
    const oldvx = rock.vx, oldvy = rock.vy;
    advanceMotion(w);
    assert.ok(Math.abs(rock.vx - oldvx - (g.x + (burning ? impulse.x / BURN_TIME : 0)) * DT) < 1e-9);
    assert.ok(Math.abs(rock.vy - oldvy - (g.y + (burning ? impulse.y / BURN_TIME : 0)) * DT) < 1e-9);
    const point = f.points.find(p => Math.abs(p.t - w.time) < 1e-8);
    if (point) assert.ok(distance(rock, point) < 1e-8);
  }
  assert.ok(Math.abs(f.burnEnd.time - BURN_TIME) < 1e-8);
  assert.ok(distance(rock, f.points.at(-1)) < 1e-8);
  const other = w.units.find(u => u.type === 'rock' && !u.launched), old = { x: other.vx, y: other.vy };
  equip(w, other);
  launchRock(w, other.id, { x: 100, y: 0 }); assert.equal(other.vx, old.x); assert.equal(other.burn.ax * BURN_TIME, MAX_IMPULSE);
});
test('swept collisions catch high speed and moving targets', () => {
  assert.ok(sweptHit({ x: -100, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 }, 10));
  const w = createScenario(), home = w.planets[0], rock = w.units.find(u => u.type === 'rock');
  rock.x = home.x - 100; rock.y = home.y; rock.vx = 4000; rock.vy = 0; rock.team = 'enemy'; rock.launched = true;
  const hp = home.hp; advanceMotion(w); assert.equal(rock.hp, 0); assert.equal(home.hp, hp - rock.damage);
});
test('friendly rocks damage their own colony and destroyed rocks create harmless effects', () => {
  const w = createScenario(), home = w.planets[0], rock = w.units.find(u => u.type === 'rock');
  rock.x = home.x; rock.y = home.y; rock.vx = 0; rock.vy = 0; rock.team = 'player'; rock.launched = true;
  advanceMotion(w); assert.equal(home.hp, home.maxHp - rock.damage); assert.equal(rock.hp, 0);
  rock.team = 'enemy'; rock.x = home.x + 70; rock.y = home.y; rock.hp = 1; rock.impact = null;
  const platform = w.units.find(u => u.type === 'platform'); platform.fireTimer = 0;
  const count = w.units.length; advance(w, 5);
  assert.equal(rock.hp, 0); assert.equal(w.units.length, count); assert.ok(w.progress.intercepted);
});

test('friendly powered launch previews predict damage to home and actual impact agrees', () => {
  const w = createScenario(), home = w.planets[0], rock = w.units.find(u => u.type === 'rock');
  const booster = equip(w, rock), impulse = aimRock(w, rock, home, 55);
  const forecast = predict(w, [rock.id], { id: rock.id, impulse }, 70).get(rock.id);
  assert.equal(forecast.impact?.targetId, home.id);
  assert.equal(home.hp, home.maxHp, 'preview cannot damage the real colony');
  launchRock(w, rock.id, impulse); scanRockThreats(w);
  assert.equal(w.rockThreats[rock.id].targetId, home.id);
  assert.ok(w.events.some(e => e.major && e.text.includes('Your asteroid threatens')));
  const warningCount = w.events.filter(e => e.text.includes('threatens')).length;
  for (let i = 0; i < 1400 && rock.hp > 0; i++) { advanceMotion(w); scanRockThreats(w); }
  assert.equal(home.hp, home.maxHp - rock.damage); assert.equal(rock.hp, 0);
  assert.ok(Math.abs(rock.impact.time - forecast.impact.time) < DT);
  assert.equal(w.events.filter(e => e.text.includes('threatens')).length, warningCount);
  assert.equal(w.progress.impact, false, 'self damage is not a practice target hit');
  assert.ok(booster.hp > 0);
});

test('both factions intercept their own incoming rocks but preserve safe outgoing and unlaunched rocks', () => {
  for (const team of ['player', 'enemy']) for (const mode of ['incoming', 'outgoing', 'unlaunched']) {
    const w = createScenario('neighbors'), home = w.planets.find(p => p.team === team);
    w.ai = { buildAt: Infinity, attackAt: Infinity, rockAt: Infinity, launchAt: Infinity };
    w.units = w.units.filter(u => u.team === team || u.type === 'rock');
    const rock = w.units.find(u => u.type === 'rock'), platform = w.units.find(u => u.type === 'platform');
    Object.assign(rock, { x: home.x + 110, y: home.y, vx: home.vx + (mode === 'outgoing' ? 12 : -6), vy: home.vy, team, launched: mode !== 'unlaunched', hp: 12 });
    platform.phase = -w.time * platform.omega; platform.fireTimer = 0;
    scanRockThreats(w);
    assert.equal(!!w.rockThreats[rock.id], mode === 'incoming', `${team} / ${mode}`);
    advance(w, 1);
    assert.equal(rock.hp <= 0, mode === 'incoming', `${team} / ${mode}`);
    assert.equal(home.hp, home.maxHp);
    assert.equal(w.progress.intercepted, false, 'own-rock interception must not complete the practice-attack objective');
  }
});
test('announced practice attack is interceptable with the starting defenses', () => {
  const w = createScenario(); assert.ok(!sendPracticeRock(w).error);
  assert.ok(w.events.some(e => e.major && e.text === 'Practice booster departing'));
  for(let attempt=0;attempt<3&&!w.progress.intercepted;attempt++) {
    advance(w,150);
    // The new orbital timing may expose the unarmed booster to defenders.
    if(!w.progress.intercepted&&!w.units.some(u=>u.practice&&u.hp>0))assert.ok(!sendPracticeRock(w).error);
  }
  assert.ok(w.progress.intercepted); assert.ok(w.planets[0].hp > 0);
});
test('undefended aimed rocks hit a moving colony', () => {
  const w = createScenario('hold'); w.units = w.units.filter(u => u.type === 'rock');
  w.ai = { buildAt: Infinity, attackAt: Infinity, rockAt: Infinity };
  equip(w, w.units[0], 'enemy');
  assert.ok(enemyLaunch(w)); const rock = w.units.find(u => u.launched);
  const forecast = predict(w, [rock.id], null, 80).get(rock.id);
  assert.equal(forecast.impact?.targetId, 'verdant');
  const hp = w.planets[0].hp; advance(w, 80); assert.equal(w.planets[0].hp, hp - 65);
});
test('drones return to their bounded defense area after intercepting', () => {
  const w = createScenario(); sendPracticeRock(w); advance(w, 170);
  for (const drone of w.units.filter(u => u.type === 'drone' && u.hp > 0)) assert.ok(distance(drone, entity(w, drone.hostId)) < 120);
});
test('Hold the Orbit can be won and loss/restart are clean', () => {
  const w = createScenario('hold');
  spawn(w, 'platform', 'player', w.planets[0]); spawn(w, 'ship', 'player', w.planets[0]);
  advance(w, 242); assert.equal(w.outcome, 'victory');
  const lost = createScenario('neighbors'); lost.planets[0].hp = 0; step(lost); assert.equal(lost.outcome, 'defeat');
  const restarted = createScenario('neighbors'); assert.equal(restarted.time, 0); assert.equal(restarted.events.length, 0); assert.equal(restarted.outcome, null);
});
test('Neighbors is winnable by defending early and then committing a fleet', () => {
  const w = createScenario('neighbors');
  const home = w.planets[0]; spawn(w, 'ship', 'player', home); spawn(w, 'ship', 'player', home);
  advance(w, 55);
  for (const u of w.units.filter(u => u.type === 'ship' && u.team === 'player')) setOrder(w, u.id, { kind: 'attack', targetId: 'cinder' });
  advance(w, 300); assert.equal(w.outcome, 'victory');
});
test('simulation steps are independent of frame grouping and stay finite', () => {
  const a = createScenario(), b = createScenario();
  for (let frame = 0; frame < 100; frame++) for (let tick = 0; tick < 20; tick++) step(a);
  for (let tick = 0; tick < 2000; tick++) step(b);
  assert.deepEqual(a, b);
  advance(a, 600);
  for (const u of a.units) assert.ok(Number.isFinite(u.x) && Number.isFinite(u.y) && Number.isFinite(u.vx));
});

test('unprepared or enemy-equipped rocks cannot be launched, even for free', () => {
  const w = createScenario(), rock = w.units.find(u => u.type === 'rock'), budget = w.metal.player;
  assert.ok(launchRock(w, rock.id, { x: -8, y: 0 }).error);
  assert.ok(launchRock(w, rock.id, { x: -8, y: 0 }, 'player', true).error);
  rock.boosterTeam = 'enemy';
  assert.ok(launchRock(w, rock.id, { x: -8, y: 0 }).error);
  assert.equal(w.metal.player, budget); assert.equal(rock.launched, false);
});
test('booster waits attached, burns for four seconds, separates automatically and awaits orders', () => {
  const w = createScenario(), booster = w.units.find(u => u.type === 'booster'), rock = w.units.find(u => u.type === 'rock');
  assert.ok(setOrder(w, booster.id, { kind: 'fit', targetId: rock.id }));
  advance(w, 5); assert.equal(rock.boosterTeam, undefined, 'cannot prepare remotely');
  let attachingAt;
  for (let n = 0; n < 1800 && !rock.boosterTeam; n++) {
    step(w); if (booster.attachProgress > 0 && attachingAt === undefined) attachingAt = w.time;
  }
  assert.equal(rock.boosterTeam, 'player'); assert.equal(booster.loaded, true);
  assert.ok(w.time - attachingAt >= ATTACH_TIME - DT * 2);
  assert.equal(booster.order.kind, 'attached'); assert.equal(w.progress.prepared, true);
  advance(w, 30);
  assert.equal(booster.order.kind, 'attached'); assert.equal(booster.attachedRockId, rock.id);
  assert.equal(booster.vx, rock.vx); assert.equal(booster.vy, rock.vy);
  assert.ok(Math.abs(booster.x - rock.x - booster.attachOffset.x) < 1e-8);
  assert.equal(setOrder(w, booster.id, { kind: 'rearm', targetId: 'verdant' }), false);
  const budget = w.metal.player;
  assert.ok(!launchRock(w, rock.id, { x: -5, y: 2 }).error);
  assert.equal(w.metal.player, budget - COST.rock); assert.equal(rock.boosterTeam, null);
  assert.equal(booster.loaded, false); assert.equal(booster.attachedRockId, rock.id);
  advance(w, BURN_TIME - DT); assert.equal(booster.order.kind, 'attached');
  assert.equal(setOrder(w, booster.id, { kind: 'detach' }), false, 'burn finishes before automatic separation');
  advance(w, DT);
  assert.equal(rock.boosterId, null); assert.equal(booster.order.kind, 'stop');
  assert.equal(booster.attachedRockId, null); assert.equal(booster.vx, rock.vx); assert.equal(booster.vy, rock.vy);
  advance(w, 10); assert.equal(booster.order.kind, 'stop'); assert.equal(booster.loaded, false);
  assert.ok(setOrder(w, booster.id, { kind: 'rearm', targetId: 'verdant' }));
  advance(w, 100); assert.equal(booster.loaded, true); assert.equal(booster.order.kind, 'defend');
  const next = w.units.find(u => u.type === 'rock' && !u.launched);
  assert.ok(setOrder(w, booster.id, { kind: 'fit', targetId: next.id }));
});
test('booster forecasts match flight and end exactly at attachment', () => {
  const w = createScenario(), booster = w.units.find(u => u.type === 'booster'), rock = w.units.find(u => u.type === 'rock');
  const order = { kind: 'fit', targetId: rock.id };
  const f = predict(w, [booster.id], { id: booster.id, order }, 80).get(booster.id);
  setOrder(w, booster.id, order);
  assert.ok(f.attachment && f.attachment.time < 80);
  for (const point of f.points.slice(1)) {
    while (w.time < point.t - DT / 2) advanceMotion(w);
    assert.ok(distance(booster, point) < 1e-8);
  }
  assert.equal(f.points.at(-1).t, f.attachment.time);
  assert.equal(rock.boosterTeam, 'player'); assert.equal(booster.order.kind, 'attached');
  const still = predict(w, [booster.id]).get(booster.id);
  assert.equal(still.points.length, 1);
  const detach = predict(w, [booster.id], { id: booster.id, order: { kind: 'detach' } }, 5).get(booster.id);
  assert.ok(detach.points.length > 1); assert.equal(booster.order.kind, 'attached', 'preview cannot detach the real ship');
});

test('detaching before launch disarms the rock and retains the booster charge', () => {
  const w = createScenario(), rock = w.units.find(u => u.type === 'rock'), booster = equip(w, rock);
  assert.ok(setOrder(w, booster.id, { kind: 'detach' }));
  assert.equal(rock.team, 'neutral'); assert.equal(rock.boosterTeam, null); assert.equal(booster.loaded, true);
  assert.ok(launchRock(w, rock.id, { x: -5, y: 2 }).error);
  assert.ok(setOrder(w, booster.id, { kind: 'fit', targetId: rock.id }));
  advance(w, 20); assert.equal(booster.attachedRockId, rock.id);
});

test('destroying an attached booster disarms its rock; destroying the rock kills its passenger', () => {
  const w = createScenario(), rock = w.units.find(u => u.type === 'rock'), booster = equip(w, rock);
  booster.hp = 0;
  assert.ok(launchRock(w, rock.id, { x: -5, y: 0 }).error);
  advanceMotion(w); assert.equal(rock.boosterId, null); assert.equal(rock.team, 'neutral');
  const other = equip(w, rock); rock.hp = 0;
  advanceMotion(w); assert.equal(other.hp, 0); assert.equal(other.attachedRockId, null);
});

test('destroying the booster during a burn cuts thrust and the rock continues ballistically', () => {
  const w = createScenario(), rock = w.units.find(u => u.type === 'rock'), booster = equip(w, rock);
  launchRock(w, rock.id, { x: -12, y: 4 });
  advanceMotion(w); assert.ok(rock.burn.remaining > 0);
  booster.hp = 0;
  const g = gravity(rock.x, rock.y, w.planets), vx = rock.vx, vy = rock.vy;
  advanceMotion(w);
  assert.equal(rock.burn.remaining, 0); assert.equal(rock.burn.interrupted, true);
  assert.ok(Math.abs(rock.vx - vx - g.x * DT) < 1e-9);
  assert.ok(Math.abs(rock.vy - vy - g.y * DT) < 1e-9);
  assert.ok(rock.hp > 0); assert.equal(rock.boosterId, null);
});

test('a powered rock collision is swept and removes the still-attached booster', () => {
  const w = createScenario('neighbors'), rock = w.units.find(u => u.type === 'rock'), home = w.planets[0];
  rock.x = home.x - 100; rock.y = home.y; rock.vx = 4000; rock.vy = 0;
  const booster = equip(w, rock, 'enemy');
  launchRock(w, rock.id, { x: 1, y: 0 }, 'enemy', true);
  advanceMotion(w); assert.equal(rock.hp, 0); assert.equal(booster.hp, 0);
  assert.equal(home.hp, home.maxHp - rock.damage);
});
test('combat ships can escort boosters and intercept an enemy before attachment', () => {
  const w = createScenario('neighbors');
  const booster = w.units.find(u => u.type === 'booster' && u.team === 'enemy');
  const ship = w.units.find(u => u.type === 'ship' && u.team === 'player');
  const friendly = w.units.find(u => u.type === 'booster' && u.team === 'player');
  assert.ok(setOrder(w, ship.id, { kind: 'defend', targetId: friendly.id }));
  assert.ok(dispatchBooster(w, booster));
  w.ai = { buildAt: Infinity, attackAt: Infinity, rockAt: Infinity };
  booster.hp = 8; ship.x = booster.x - 45; ship.y = booster.y; ship.fireTimer = 0;
  setOrder(w, ship.id, { kind: 'attack', targetId: booster.id });
  step(w); assert.equal(booster.hp, 0);
  advance(w, 80);
  assert.equal(w.units.some(u => u.type === 'rock' && (u.boosterTeam === 'enemy' || u.launched)), false);
});
test('enemy launches require a real booster expedition and paid launch', () => {
  const w = createScenario('hold');
  w.units = w.units.filter(u => u.team !== 'player');
  w.ai.buildAt = Infinity; w.ai.attackAt = Infinity;
  assert.equal(enemyLaunch(w), false);
  advance(w, 13);
  assert.ok(w.units.some(u => u.type === 'booster' && u.order.kind === 'fit'));
  assert.equal(w.units.some(u => u.type === 'rock' && u.launched), false);
  // Stronger gravity changes rendezvous and launch windows; allow two minutes.
  advance(w, 110);
  assert.ok(w.events.some(e => e.text === 'Enemy asteroid armed'));
  assert.ok(w.events.some(e => e.text === 'Incoming asteroid'));
  assert.ok(w.metal.enemy < 180 + w.time * .4 - 34);
});
