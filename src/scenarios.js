import { planetAt, orbitalRate, setGravity, spawn, addRock, BELT_INNER, BELT_WIDTH, normalizeGravity, normalizeCollisions } from './simulation.js';
export const SCENARIOS = {
  playground: { name: 'Slingshot Playground', kicker: '04 / A LIVE-FIRE PLAYGROUND', objective: 'Test trajectories and planetary defenses. Every rock is ready to launch.',
    body: '<p>Twelve belt rocks already have <b>friendly boosters attached</b>. Launches are free. <b>Verdant is your home</b>; Cinder and Ochre are enemy targets.</p><ul><li><b>Aim:</b> select a rock and right-click a planet, or empty space for manual aim. Review and confirm.</li><li><b>Observe:</b> every planet has a ship, a platform, and two drones. Verdant\'s defenders are yours; enemy defenders match their planet\'s color.</li><li><b>Experiment:</b> try different approaches, coordinate several launches, or adjust the gravity sliders.</li><li><b>Reset range:</b> instantly restore rocks and defenses while keeping your gravity settings.</li></ul><p>The defenders intercept nearby threats but never build units or launch attacks. No victory screen or time limit. Spent boosters detach after firing; reset when you want fresh ammunition.</p>' },
  garden: { name: 'Rock Garden', kicker: '01 / AN ORBITAL PLAYGROUND', objective: 'Learn to launch and defend. Finish by reducing Ochre to zero integrity.',
    body: '<p>Your colony, <b>Verdant</b>, has a booster ship ready to go. Earn your shot by reaching an asteroid.</p><ul><li><b>1.</b> Select a belt rock and choose <b>Send booster</b>. Confirm and unpause.</li><li><b>2.</b> The ship matches velocity and attaches a booster over <b>6 seconds</b>.</li><li><b>3.</b> Select the equipped rock, right-click a planet to target it or empty space to aim, then review and confirm your launch.</li><li><b>4.</b> Send a practice rock to watch an enemy booster prepare an attack.</li></ul><p>Booster ships wait attached. Launch starts a 4-second burn, followed by automatic detachment. Then choose Return home to reload. Ochre is an uninhabited target. Launched rocks can damage Verdant too; check the preview before firing.</p>' },
  hold: { name: 'Hold the Orbit', kicker: '02 / A SMALL SIEGE', objective: 'Keep Verdant alive for 4 minutes. Incoming launches are announced.',
    body: '<p>Hold your colony for <b>four simulation minutes</b>. A platform, a ship, two drones, and a booster ship are ready.</p><ul><li><b>Watch.</b> Enemy booster expeditions prepare incoming rocks.</li><li><b>Disrupt.</b> Hunt the booster before it attaches, or destroy its equipped rock.</li><li><b>Defend.</b> Keep enough forces home to intercept launched rocks and enemy ships.</li></ul><p>New threats pause fast-forward. Both sides must fly a booster to an asteroid before launching it.</p>' },
  neighbors: { name: 'Neighbors', kicker: '03 / ACROSS THE GRAVITY WELL', objective: 'Protect Verdant. Reduce the colony on Cinder to zero integrity.',
    body: '<p>Protect <b>Verdant</b> and destroy the rival colony on <b>Cinder</b>. The asteroid belt is contested territory.</p><ul><li><b>Booster ships</b> fly to rocks, attach, and wait for your launch or detach order.</li><li><b>Combat ships</b> escort your boosters, intercept enemy expeditions, or bombard Cinder.</li><li><b>Platforms & drones</b> defend against attacks that get through.</li><li><b>Equipped rocks</b> can be aimed and launched for 35 metal.</li></ul><p>Select a combat ship and right-click a friendly booster to escort it. Your neighbor uses the same preparation, flight, and resource rules.</p>' },
};
function planet(id, name, orbit, phase, radius, team, color, hp = 240) {
  // Spread all planetary lanes proportionally; outer lane is 80% of the belt.
  orbit *= BELT_INNER * .8 / 690;
  const p = { id, name, type: 'planet', orbit, phase, radius, team, color, omega: orbitalRate(orbit),
    hp, maxHp: hp };
  return Object.assign(p, planetAt(p, 0));
}
export function createScenario(key = 'garden', gravitySettings, collisionSettings) {
  const settings = normalizeGravity(gravitySettings), collisions = normalizeCollisions(collisionSettings);
  const w = { scenario: key, mode: 'scenario', gravity: settings, collisions, setup: { mode: 'scenario', scenario: key, gravity: { ...settings }, collisions: { ...collisions } }, time: 0, serial: 0, eventId: 0, units: [], planets: [], effects: [], events: [],
    metal: { player: key === 'garden' ? 240 : 160, enemy: key === 'hold' ? 180 : 160 },
    progress: { prepared: false, launched: false, intercepted: false, impact: false }, outcome: null, continueSandbox: false, duration: 240,
    ai: { buildAt: key === 'hold' ? 120 : 48, attackAt: key === 'hold' ? 100 : 65, rockAt: key === 'hold' ? 12 : 95 } };
  if (key === 'playground') {
    w.unlimitedMetal = true; w.ai.disabled = true; w.fleetCap = 16;
    w.planets = [planet('verdant', 'VERDANT', 390, -.2, 18, 'player', '#65b6b3'),
      planet('cinder', 'CINDER', 690, -1.05, 21, 'enemy', '#c6bfa4'),
      planet('ochre', 'OCHRE', 170, .75, 13, 'enemy', '#bd7968')];
    setGravity(w, settings);
    for (const host of w.planets) for (const type of ['platform', 'ship', 'drone', 'drone']) spawn(w, type, host.team, host, true);
    for (let i = 0; i < 12; i++) {
      const rock = addRock(w, i / 12 * Math.PI * 2 + .04, BELT_INNER + (i % 3) * BELT_WIDTH / 2, `ROCK ${String(i + 1).padStart(2, '0')}`, ['medium', 'small', 'large'][i % 3]);
      // Twelve prepared boosters plus the four home defenders fit this range.
      const booster = spawn(w, 'booster', 'player', w.planets[0], true);
      Object.assign(booster, { x: rock.x + 16, y: rock.y, vx: rock.vx, vy: rock.vy,
        attachedRockId: rock.id, attachOffset: { x: 16, y: 0 }, order: { kind: 'attached', targetId: rock.id } });
      Object.assign(rock, { team: 'player', color: booster.color, boosterTeam: 'player', boosterId: booster.id });
    }
    return w;
  }
  w.planets = key === 'garden' ? [planet('verdant', 'VERDANT', 390, -.25, 18, 'player', '#65b6b3'), planet('ochre', 'OCHRE', 170, .65, 13, 'neutral', '#bd7968', 500)] :
    [planet('verdant', 'VERDANT', 390, -.2, 18, 'player', '#65b6b3'), planet('cinder', 'CINDER', 690, -1.05, 21, 'enemy', '#c6bfa4'),
      ...(key === 'neighbors' ? [planet('ochre', 'OCHRE', 170, .75, 13, 'neutral', '#bd7968', 500)] : [])];
  setGravity(w, settings);
  const home = w.planets[0];
  spawn(w, 'platform', 'player', home, true); spawn(w, 'ship', 'player', home, true);
  spawn(w, 'drone', 'player', home, true); spawn(w, 'drone', 'player', home, true);
  spawn(w, 'booster', 'player', home, true);
  if (key === 'garden') w.practiceDock = { id: 'practice-dock', name: 'PRACTICE DOCK', type: 'dock', team: 'enemy', hp: 1, radius: 10, x: 700, y: -520, vx: 0, vy: 0 };
  if (key !== 'garden') {
    const enemy = w.planets[1];
    spawn(w, 'platform', 'enemy', enemy, true); spawn(w, 'ship', 'enemy', enemy, true);
    spawn(w, 'booster', 'enemy', enemy, true);
    if (key === 'neighbors') { spawn(w, 'ship', 'enemy', enemy, true); spawn(w, 'drone', 'enemy', enemy, true); }
  }
  for (let i = 0; i < 15; i++) addRock(w, i / 15 * Math.PI * 2 + .04, BELT_INNER + (i % 3) * BELT_WIDTH / 2, `ROCK ${String(i + 1).padStart(2, '0')}`, ['medium', 'small', 'large'][i % 3]);
  return w;
}

// Open games reuse the proven system and flight rules, with their own objectives.
export function createGame(options = {}) {
  const mode = ['skirmish', 'sandbox'].includes(options.mode) ? options.mode : 'scenario';
  if (mode === 'scenario') return createScenario(SCENARIOS[options.scenario] ? options.scenario : 'garden', options.gravity, options.collisions);
  const setup = { mode, system: options.system === 'two' ? 'two' : 'three',
    budget: [160, 240, 400].includes(Number(options.budget)) ? Number(options.budget) : 160,
    enemies: mode === 'skirmish' || options.enemies === true,
    unlimited: mode === 'sandbox' && options.unlimited === true, gravity: normalizeGravity(options.gravity), collisions: normalizeCollisions(options.collisions),
    visitorSeed: Number.isInteger(options.visitorSeed) ? options.visitorSeed >>> 0 : Math.floor(Math.random()*4294967296) };
  const w = createScenario('neighbors', setup.gravity, setup.collisions);
  w.mode = mode; w.setup = setup; w.unlimitedMetal = setup.unlimited;
  if(mode==='skirmish')w.visitors={seed:setup.visitorSeed,nextAt:40,count:0};
  w.metal = { player: setup.budget, enemy: setup.budget };
  if (setup.system === 'two') w.planets = w.planets.filter(p => p.id !== 'ochre');
  if (!setup.enemies) {
    w.units = w.units.filter(u => u.team !== 'enemy');
    const rival = w.planets.find(p => p.team === 'enemy');
    rival.team = 'neutral'; rival.hp = rival.maxHp = 500;
  }
  // Seed belt velocities against the actual chosen planets.
  w.units = w.units.filter(u => u.type !== 'rock');
  for (let i = 0; i < 15; i++) addRock(w, i / 15 * Math.PI * 2 + .04, BELT_INNER + (i % 3) * BELT_WIDTH / 2, `ROCK ${String(i + 1).padStart(2, '0')}`, ['medium', 'small', 'large'][i % 3]);
  return w;
}
