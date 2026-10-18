// All distances and masses are game units. Both forecasts and live flight use DT.
export const DT = 1 / 20;
export const STAR_MU = 5400;
export const STAR_RADIUS = 25;
export const MAX_IMPULSE = 26;
export const BELT_INNER = 820;
export const BELT_WIDTH = 36;
export const SYSTEM_DIAMETER = 1840;
export const CAP = 12;
export const ATTACH_TIME = 6;
export const REARM_TIME = 8;
export const BURN_TIME = 4;
export const COST = { ship: 60, platform: 80, drone: 25, booster: 50, rock: 35 };
export const TYPES = {
  ship: { hp: 110, radius: 6, speed: 21, thrust: 6.5, range: 105, damage: 8, cooldown: 2.3 },
  platform: { hp: 230, radius: 9, speed: 0, thrust: 0, range: 135, damage: 12, cooldown: 2.1 },
  drone: { hp: 38, radius: 4, speed: 27, thrust: 8, range: 65, damage: 6, cooldown: 1.5 },
  booster: { hp: 65, radius: 6, speed: 19, thrust: 6, range: 0, damage: 0, cooldown: 0 },
  rock: { hp: 50, radius: 8, speed: 0, thrust: 0, range: 0, damage: 65, cooldown: 0 },
};
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function planetAt(p, time) {
  const a = p.phase + time * p.omega;
  return { x: Math.cos(a) * p.orbit, y: Math.sin(a) * p.orbit, vx: -Math.sin(a) * p.orbit * p.omega, vy: Math.cos(a) * p.orbit * p.omega };
}
export function entity(world, id) { return world.planets.find(p => p.id === id) || world.units.find(u => u.id === id && u.hp > 0) || (id && world.practiceDock?.id === id ? world.practiceDock : null); }
export function gravity(x, y, planets) {
  const d = Math.max(38, Math.hypot(x, y));
  let ax = -STAR_MU * x / d ** 3, ay = -STAR_MU * y / d ** 3;
  for (const p of planets) {
    const dx = p.x - x, dy = p.y - y, r = Math.max(p.radius + 12, Math.hypot(dx, dy));
    ax += p.mu * dx / r ** 3; ay += p.mu * dy / r ** 3;
  }
  return { x: ax, y: ay };
}
export function announce(w, text, detail = '', major = false) {
  w.events.push({ id: ++w.eventId, time: w.time, text, detail, major });
  if (w.events.length > 16) w.events.shift();
}
export function fleet(w, team) { return w.units.filter(u => u.team === team && u.type !== 'rock' && u.hp > 0); }
export function spawn(w, type, team, host, free = false) {
  if (!host || host.team !== team || host.hp <= 0) return { error: 'Select a friendly colony to deploy.' };
  if (fleet(w, team).length >= CAP) return { error: 'Fleet limit reached: 12 units.' };
  if (!free && w.metal[team] < COST[type]) return { error: `You need ${COST[type]} metal.` };
  if (!free) w.metal[team] -= COST[type];
  const serial = ++w.serial;
  const phase = serial * 2.39996;
  const orbit = host.radius + (type === 'platform' ? 48 : 32) + (serial % 3) * 9;
  const omega = type === 'platform' ? 0.025 : 0;
  const x = host.x + Math.cos(phase) * orbit, y = host.y + Math.sin(phase) * orbit;
  const unit = { id: `u${serial}`, name: `${type.toUpperCase()} ${String(serial).padStart(2, '0')}`, type, team,
    ...TYPES[type], maxHp: TYPES[type].hp, x, y,
    vx: host.vx - Math.sin(phase) * orbit * omega, vy: host.vy + Math.cos(phase) * orbit * omega,
    hostId: host.id, phase: phase - w.time * omega, orbit, omega,
    order: { kind: 'defend', targetId: host.id }, fireTimer: 0.4 + (serial % 4) * 0.3, launched: true,
    loaded: type === 'booster', attachProgress: 0, rearmProgress: 0 };
  w.units.push(unit);
  return unit;
}
export function addRock(w, angle, orbit = BELT_INNER + BELT_WIDTH / 2, name) {
  // Account for the planets' stronger radial pull when seeding belt velocities.
  const radial = { x: Math.cos(angle), y: Math.sin(angle) };
  const g = gravity(radial.x * orbit, radial.y * orbit, w.planets);
  const speed = Math.sqrt(Math.max(STAR_MU / orbit, -(g.x * radial.x + g.y * radial.y) * orbit));
  const serial = ++w.serial;
  const rock = { id: `r${serial}`, name: name || `ROCK ${String(serial).padStart(2, '0')}`, type: 'rock', team: 'neutral',
    ...TYPES.rock, maxHp: TYPES.rock.hp, x: Math.cos(angle) * orbit, y: Math.sin(angle) * orbit,
    vx: -Math.sin(angle) * speed, vy: Math.cos(angle) * speed, launched: false, order: { kind: 'ballistic' } };
  w.units.push(rock); return rock;
}
export function setOrder(w, id, order, team = 'player') {
  const u = entity(w, id);
  if (!u || !['ship', 'drone', 'booster'].includes(u.type) || u.team !== team) return false;
  const target = entity(w, order.targetId);
  if (u.attachedRockId) {
    if (order.kind !== 'detach') return false;
    const rock = entity(w, u.attachedRockId);
    if (rock?.burn?.remaining > 0) return false;
    if (rock) {
      rock.boosterId = null; rock.boosterTeam = null;
      if (!rock.launched) { rock.team = 'neutral'; rock.practice = false; }
    }
    u.attachedRockId = null; u.attachOffset = null;
    order = { kind: 'stop', x: u.x, y: u.y };
  } else if (order.kind === 'detach') return false;
  if (order.kind === 'fit') {
    if (u.type !== 'booster' || !u.loaded || !target || target.type !== 'rock' || target.launched || target.boosterTeam) return false;
  }
  if (u.type === 'booster' && order.kind === 'attack') return false;
  if (order.kind === 'rearm' && (u.type !== 'booster' || !target || target.team !== team || !['planet', 'dock'].includes(target.type))) return false;
  if (order.kind === 'stop') order = { kind: 'stop', x: u.x, y: u.y };
  if (u.type === 'drone' && order.kind !== 'defend' && order.kind !== 'stop') return false;
  u.order = { ...order };
  u.attachProgress = 0; u.rearmProgress = 0;
  if (order.kind === 'defend' && target?.type === 'planet') u.hostId = order.targetId;
  if (u.type === 'drone' && order.kind === 'defend' && order.targetId) u.hostId = order.targetId;
  return true;
}
export function launchRock(w, id, impulse, team = 'player', free = false) {
  const r = entity(w, id);
  if (!r || r.type !== 'rock' || r.launched) return { error: 'Choose an unlaunched asteroid in the belt.' };
  const booster = entity(w, r.boosterId);
  if (r.boosterTeam !== team || !booster?.loaded || booster.attachedRockId !== r.id) return { error: 'Send a booster ship to attach a booster before launching this rock.' };
  if (!free && w.metal[team] < COST.rock) return { error: `A launch costs ${COST.rock} metal.` };
  const mag = Math.hypot(impulse.x, impulse.y), scale = mag > MAX_IMPULSE ? MAX_IMPULSE / mag : 1;
  // The chosen velocity change is delivered over a short, real powered burn.
  // Gravity continues throughout; the same acceleration is used in forecasts.
  r.burn = { remaining: BURN_TIME, ax: impulse.x * scale / BURN_TIME, ay: impulse.y * scale / BURN_TIME };
  r.team = team; r.launched = true;
  w.threatScanAt = 0;
  r.boosterTeam = null;
  booster.loaded = false; booster.vx = r.vx; booster.vy = r.vy;
  if (!free) w.metal[team] -= COST.rock;
  if (team === 'player') w.progress.launched = true;
  announce(w, team === 'player' ? 'Booster firing' : 'Incoming asteroid', `${BURN_TIME}s powered burn, then automatic separation. The rock will coast.`, team === 'enemy');
  return r;
}
function hostile(a, b) { return a.team !== b.team && a.team !== 'neutral' && b.team !== 'neutral'; }
function combatTarget(u, target, w) {
  if (hostile(u, target)) return true;
  const impact = w.rockThreats?.[target.id];
  return target.type === 'rock' && target.launched && impact && entity(w, impact.targetId)?.team === u.team;
}
// Forecast only projectiles and their attached engines, avoiding combat steering
// and recursive threat queries. Sample at fixed simulation intervals, not frames.
export function scanRockThreats(w) {
  if (w.time < (w.threatScanAt || 0)) return;
  w.threatScanAt = w.time + 1;
  const rocks = w.units.filter(u => u.hp > 0 && u.type === 'rock' && u.launched);
  w.rockThreats = {};
  if (!rocks.length) return;
  const ids = new Set(rocks.map(r => r.id));
  const isolated = { ...w, units: w.units.filter(u => ids.has(u.id) || ids.has(u.attachedRockId)) };
  const forecasts = predict(isolated, [...ids]);
  w.threatWarnings ||= {};
  for (const rock of rocks) {
    const impact = forecasts.get(rock.id)?.impact;
    if (!impact || impact.targetId === 'star') continue;
    w.rockThreats[rock.id] = { ...impact, time: w.time + impact.time };
    const planet = entity(w, impact.targetId);
    if (planet?.team === 'player' && w.threatWarnings[rock.id] !== planet.id) {
      w.threatWarnings[rock.id] = planet.id;
      announce(w, `${rock.team === 'player' ? 'Your asteroid' : 'Asteroid'} threatens ${planet.name}`,
        `Impact in ~${Math.ceil(impact.time)}s. Defenses will intercept in range.`, true);
    }
  }
}
function defenseTarget(u, w, anchor) {
  let best, score = Infinity;
  for (const target of w.units) {
    if (target.hp <= 0 || !combatTarget(u, target, w) || distance(target, anchor) > (u.type === 'drone' ? 180 : 210)) continue;
    if (u.type === 'drone' && !['rock', 'drone'].includes(target.type)) continue;
    const s = distance(u, target) - (target.type === 'rock' ? 100 : 0);
    if (s < score) { score = s; best = target; }
  }
  return best;
}
function steering(u, w, g) {
  let target = u.order?.targetId ? entity(w, u.order.targetId) : null;
  let standoff = 0;
  let kind = u.order?.kind || 'stop';
  if (kind === 'defend') {
    const anchor = target || entity(w, u.hostId);
    if (anchor && anchor.hp > 0) {
      target = u.type === 'booster' ? null : defenseTarget(u, w, anchor);
      if (target) standoff = u.range * 0.55;
      else {
        // Keep a distinct berth around a moving colony or platform.
        const angle = u.phase + w.time * 0.012;
        const radius = anchor.type === 'planet' ? anchor.radius + 48 : 28;
        target = { x: anchor.x + Math.cos(angle) * radius, y: anchor.y + Math.sin(angle) * radius,
          vx: (anchor.vx || 0) - Math.sin(angle) * radius * 0.012, vy: (anchor.vy || 0) + Math.cos(angle) * radius * 0.012 };
      }
    }
  } else if (target) {
    standoff = kind === 'fit' ? target.radius + u.radius + 2 : ['planet', 'dock'].includes(target.type) ? target.radius + (hostile(u, target) ? 52 : 45) : u.order.kind === 'attack' ? u.range * .6 : 25;
  }
  if (!target || target.hp <= 0) target = { x: u.order?.x ?? u.x, y: u.order?.y ?? u.y, vx: 0, vy: 0 };
  const rawDist = distance(u, target);
  const lead = clamp((rawDist - standoff) / u.speed, 0, 24);
  let tx = target.x + (target.vx || 0) * lead, ty = target.y + (target.vy || 0) * lead;
  if (target.type === 'planet') { const future = planetAt(target, w.time + lead); tx = future.x; ty = future.y; }
  // A gentle tangent waypoint avoids steering through the star.
  const lx = tx - u.x, ly = ty - u.y, len2 = lx * lx + ly * ly;
  const t = clamp(-(u.x * lx + u.y * ly) / (len2 || 1), 0, 1);
  if (Math.hypot(u.x + lx * t, u.y + ly * t) < 68 && rawDist > 70) {
    const side = u.x * ty - u.y * tx >= 0 ? 1 : -1;
    const angle = Math.atan2(u.y, u.x) + side * .7;
    tx = Math.cos(angle) * 100; ty = Math.sin(angle) * 100; standoff = 0;
  }
  let dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy) || 1;
  const gap = d - standoff;
  const desired = clamp(gap * .65, -u.speed * .4, u.speed);
  const follow = clamp(1 - Math.max(0, gap) / 70, 0, 1);
  let vx = dx / d * desired + (target.vx || 0) * follow;
  let vy = dy / d * desired + (target.vy || 0) * follow;
  // Local avoidance keeps assistance forgiving around planets en route.
  for (const p of w.planets) {
    const px = u.x - p.x, py = u.y - p.y, pd = Math.hypot(px, py) || 1;
    if (pd < p.radius + 27) { const push = (p.radius + 27 - pd) * 1.5; vx += px / pd * push; vy += py / pd * push; }
  }
  let ax = (vx - u.vx) * 1.4 - g.x * .9, ay = (vy - u.vy) * 1.4 - g.y * .9;
  const force = Math.hypot(ax, ay);
  if (force > u.thrust) { ax *= u.thrust / force; ay *= u.thrust / force; }
  return { x: ax, y: ay };
}
// Relative swept segment collision: moving planets cannot be tunneled through.
export function sweptHit(a, b, c, d, radius) {
  const x = a.x - c.x, y = a.y - c.y;
  const vx = b.x - a.x - (d.x - c.x), vy = b.y - a.y - (d.y - c.y);
  const t = clamp(-(x * vx + y * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return Math.hypot(x + vx * t, y + vy * t) <= radius;
}
export function advanceMotion(w, dt = DT, forecast = false) {
  const oldPlanets = w.planets.map(p => ({ x: p.x, y: p.y }));
  const previous = new Map(w.units.filter(u => u.hp > 0).map(u => [u.id, { x: u.x, y: u.y }]));
  // Evaluate all accelerations from the same instant, independent of array order.
  const accelerations = new Map();
  for (const u of w.units) {
    if (u.hp <= 0 || u.type === 'platform' || u.attachedRockId) continue;
    const g = gravity(u.x, u.y, w.planets);
    let a;
    if (u.type === 'rock') {
      const booster = entity(w, u.boosterId);
      if (u.burn?.remaining > 0 && (!booster || booster.attachedRockId !== u.id)) {
        u.burn.remaining = 0; u.burn.interrupted = true;
      }
      const fraction = Math.min(u.burn?.remaining || 0, dt) / dt;
      a = { x: (u.burn?.ax || 0) * fraction, y: (u.burn?.ay || 0) * fraction };
    } else a = steering(u, w, g);
    accelerations.set(u.id, { x: g.x + a.x, y: g.y + a.y });
  }
  w.time += dt;
  for (const p of w.planets) Object.assign(p, planetAt(p, w.time));
  for (const u of w.units) {
    if (u.hp <= 0 || u.attachedRockId) continue;
    if (u.type === 'platform') {
      const host = entity(w, u.hostId);
      if (host) {
        const a = u.phase + w.time * u.omega;
        u.x = host.x + Math.cos(a) * u.orbit; u.y = host.y + Math.sin(a) * u.orbit;
        u.vx = host.vx - Math.sin(a) * u.orbit * u.omega; u.vy = host.vy + Math.cos(a) * u.orbit * u.omega;
      }
    } else {
      const a = accelerations.get(u.id);
      u.vx += a.x * dt; u.vy += a.y * dt; u.x += u.vx * dt; u.y += u.vy * dt;
      if (u.burn?.remaining > 0) {
        u.burn.remaining = Math.max(0, u.burn.remaining - dt);
        if (u.burn.remaining < 1e-9) u.burn.remaining = 0;
      }
    }
    const old = previous.get(u.id);
    if (sweptHit(old, u, { x: 0, y: 0 }, { x: 0, y: 0 }, STAR_RADIUS + u.radius)) {
      u.hp = 0; u.impact = { x: u.x, y: u.y, targetId: 'star', name: 'SOL', time: w.time };
      if (!forecast) burst(w, u.x, u.y, 'star');
      continue;
    }
    for (let i = 0; i < w.planets.length; i++) {
      const p = w.planets[i];
      if (u.type !== 'rock' || !u.launched) continue;
      if (sweptHit(old, u, oldPlanets[i], p, p.radius + u.radius)) {
        u.hp = 0; u.impact = { x: u.x, y: u.y, targetId: p.id, name: p.name, time: w.time };
        if (!forecast) {
          p.hp = Math.max(0, p.hp - u.damage); burst(w, u.x, u.y, u.team);
          announce(w, `${p.name} impact`, `${u.damage} colony damage.`, p.team === 'player');
          if (u.team === 'player' && p.team !== 'player') w.progress.impact = true;
        }
        break;
      }
    }
    if (Math.hypot(u.x, u.y) > 2800) u.hp = 0;
  }
  updateBoosters(w, dt, forecast);
}
function updateBoosters(w, dt, forecast) {
  for (const u of w.units) {
    if (u.type !== 'booster') continue;
    if (u.attachedRockId) {
      const rock = w.units.find(r => r.id === u.attachedRockId);
      if (u.hp <= 0 || !rock || rock.hp <= 0) {
        if (rock) {
          rock.boosterId = null; rock.boosterTeam = null;
          if (rock.burn?.remaining > 0) { rock.burn.remaining = 0; rock.burn.interrupted = true; }
          if (!rock.launched) { rock.team = 'neutral'; rock.practice = false; }
        }
        if (!rock || rock.hp <= 0) u.hp = 0;
        u.attachedRockId = null; u.attachOffset = null;
      } else {
        u.x = rock.x + u.attachOffset.x; u.y = rock.y + u.attachOffset.y;
        u.vx = rock.vx; u.vy = rock.vy;
        if (rock.launched && rock.burn?.remaining === 0) {
          setOrder(w, u.id, { kind: 'detach' }, u.team);
          if (!forecast && u.team === 'player') announce(w, `${u.name} detached`, 'Burn complete. Booster awaiting orders; the rock is coasting.');
        }
      }
      continue;
    }
    if (u.hp <= 0) continue;
    const target = entity(w, u.order?.targetId);
    if (u.order.kind === 'fit') {
      if (!u.loaded || !target || target.type !== 'rock' || target.launched || target.boosterTeam) {
        u.attachProgress = 0;
        u.order = { kind: 'stop', x: u.x, y: u.y };
        continue;
      }
      const settled = distance(u, target) <= target.radius + u.radius + 12 && Math.hypot(u.vx - target.vx, u.vy - target.vy) < 2.5;
      u.attachProgress = settled ? u.attachProgress + dt : 0;
      if (u.attachProgress >= ATTACH_TIME) {
        target.boosterTeam = u.team; target.team = u.team; target.practice = !!u.practice; target.boosterId = u.id;
        u.attachedRockId = target.id; u.attachOffset = { x: u.x - target.x, y: u.y - target.y };
        u.vx = target.vx; u.vy = target.vy; u.attachProgress = 0;
        u.order = { kind: 'attached', targetId: target.id };
        if (u.team === 'player') w.progress.prepared = true;
        if (!forecast) announce(w, u.team === 'player' ? `${target.name} ready to launch` : 'Enemy asteroid armed', u.team === 'player' ? 'Booster attached and waiting. Drag the rock to launch, or choose Detach.' : 'A booster has attached. Destroy it or the rock before launch.', u.team === 'enemy');
      }
    } else if (u.order.kind === 'rearm') {
      if (!target || target.hp <= 0 || target.team !== u.team) { u.rearmProgress = 0; continue; }
      const docked = distance(u, target) < target.radius + 65 && Math.hypot(u.vx - target.vx, u.vy - target.vy) < 3;
      u.rearmProgress = docked ? u.rearmProgress + dt : 0;
      if (u.rearmProgress >= REARM_TIME) {
        u.loaded = true; u.rearmProgress = 0; u.order = { kind: 'defend', targetId: target.id };
        if (!forecast && u.team === 'player') announce(w, `${u.name} rearmed`, 'One booster loaded. Ready for another asteroid.');
      }
    } else { u.attachProgress = 0; u.rearmProgress = 0; }
  }
}
function burst(w, x, y, team) { w.effects.push({ type: 'burst', x, y, team, born: w.time, life: 2 }); }
function combat(w, dt) {
  for (const u of w.units) {
    if (u.hp <= 0 || !u.range) continue;
    u.fireTimer -= dt;
    if (u.fireTimer > 0) continue;
    const anchor = entity(w, u.hostId);
    const options = w.units.filter(t => t.hp > 0 && combatTarget(u, t, w) && distance(u, t) <= u.range &&
      (u.type !== 'drone' || (['rock', 'drone'].includes(t.type) && anchor && distance(anchor, t) < 180)));
    if (u.type === 'ship') options.push(...w.planets.filter(p => p.hp > 0 && hostile(u, p) && distance(u, p) <= u.range + p.radius));
    options.sort((a, b) => {
      const rank = t => (t.id === u.order?.targetId && u.order.kind === 'attack' ? -500 : 0) + (t.type === 'rock' ? -250 : 0) + distance(u, t);
      return rank(a) - rank(b);
    });
    const target = options[0];
    if (!target) continue;
    target.hp = Math.max(0, target.hp - u.damage);
    u.fireTimer = u.cooldown;
    w.effects.push({ type: 'shot', x: u.x, y: u.y, tx: target.x, ty: target.y, team: u.team, born: w.time, life: .45 });
    if (target.hp <= 0) {
      burst(w, target.x, target.y, target.team);
      if (target.type === 'rock') {
        if (u.team === 'player' && target.team !== 'player') w.progress.intercepted = true;
        announce(w, 'Asteroid intercepted', 'The debris is harmless.');
      }
    }
  }
}
// Numerical shooting uses the same gravity integrator as live rocks.
export function aimRock(w, rock, target, flightTime = 55) {
  const future = planetAt(target, w.time + flightTime);
  let vx = (future.x - rock.x) / flightTime, vy = (future.y - rock.y) / flightTime;
  const endpoint = (ivx, ivy) => {
    let x = rock.x, y = rock.y;
    const ax = (ivx - rock.vx) / BURN_TIME, ay = (ivy - rock.vy) / BURN_TIME;
    ivx = rock.vx; ivy = rock.vy;
    const planets = w.planets.map(p => ({ ...p }));
    for (let t = 0; t < flightTime - DT / 2; t += DT) {
      for (const p of planets) Object.assign(p, planetAt(p, w.time + t));
      const g = gravity(x, y, planets), fraction = Math.max(0, Math.min(DT, BURN_TIME - t)) / DT;
      ivx += (g.x + ax * fraction) * DT; ivy += (g.y + ay * fraction) * DT; x += ivx * DT; y += ivy * DT;
    }
    return { x, y };
  };
  for (let i = 0; i < 8; i++) {
    const q = endpoint(vx, vy), ex = future.x - q.x, ey = future.y - q.y;
    if (Math.hypot(ex, ey) < .4) break;
    const qx = endpoint(vx + .05, vy), qy = endpoint(vx, vy + .05);
    const a = (qx.x - q.x) / .05, b = (qy.x - q.x) / .05, c = (qx.y - q.y) / .05, d = (qy.y - q.y) / .05;
    const det = a * d - b * c;
    if (Math.abs(det) < .01) break;
    vx += clamp((ex * d - b * ey) / det, -6, 6); vy += clamp((a * ey - ex * c) / det, -6, 6);
  }
  return { x: vx - rock.vx, y: vy - rock.vy };
}
export function enemyLaunch(w, practice = false) {
  const home = w.planets.find(p => p.team === 'player');
  if (!home || home.hp <= 0 || (!practice && w.metal.enemy < COST.rock)) return false;
  const future = planetAt(home, w.time + 60);
  const candidates = w.units.filter(u => u.type === 'rock' && !u.launched && u.hp > 0 && u.boosterTeam === 'enemy' && (!practice || u.practice)).sort((a, b) => distance(a, future) - distance(b, future));
  for (const r of candidates.slice(0, 4)) {
    const impulse = aimRock(w, r, home, 60);
    if (Math.hypot(impulse.x, impulse.y) > MAX_IMPULSE) continue;
    const test = predict(w, [r.id], { id: r.id, impulse, team: 'enemy' }, 70);
    // Reject a shot that would hit another planet before reaching its target.
    const flight = test.get(r.id);
    if (flight?.impact && flight.impact.targetId !== home.id) continue;
    if (launchRock(w, r.id, impulse, 'enemy', practice).error) continue;
    r.practice = practice;
    return true;
  }
  return false;
}
export function dispatchBooster(w, booster, practice = false) {
  if (!booster?.loaded || booster.hp <= 0 || booster.attachedRockId || booster.order.kind === 'fit') return false;
  const home = w.planets.find(p => p.team === 'player');
  const future = planetAt(home, w.time + 100);
  const reserved = new Set(w.units.filter(u => u.hp > 0 && u.order?.kind === 'fit').map(u => u.order.targetId));
  const rocks = w.units.filter(u => u.type === 'rock' && u.hp > 0 && !u.launched && !u.boosterTeam && !reserved.has(u.id))
    .sort((a, b) => (distance(a, future) + distance(a, booster) * .5) - (distance(b, future) + distance(b, booster) * .5));
  if (!rocks.length || !setOrder(w, booster.id, { kind: 'fit', targetId: rocks[0].id }, booster.team)) return false;
  booster.practice = practice;
  announce(w, practice ? 'Practice booster departing' : 'Enemy booster departing', `${rocks[0].name} is its destination. Intercept it before attachment to prevent the launch.`, true);
  return true;
}
export function sendPracticeRock(w) {
  if (w.scenario !== 'garden') return { error: 'Practice attacks are available in Rock Garden.' };
  if (w.units.some(u => u.hp > 0 && u.practice && ((u.type === 'rock') || u.order?.kind === 'fit'))) return { error: 'A practice launch is already in progress.' };
  let booster = w.units.find(u => u.type === 'booster' && u.practice && u.hp > 0);
  if (!booster) { booster = spawn(w, 'booster', 'enemy', w.practiceDock, true); booster.practice = true; }
  if (!booster.loaded) return { error: 'The practice booster is returning to rearm. Try again when it is loaded.' };
  return dispatchBooster(w, booster, true) ? booster : { error: 'No free practice asteroid remains.' };
}
function ai(w) {
  // Both factions separate only after the burn. The opponent then chooses to
  // return; player ships remain waiting for the player's next order.
  for (const booster of fleet(w, 'enemy').filter(u => u.type === 'booster' && !u.loaded && !u.attachedRockId && u.order.kind === 'stop')) {
    setOrder(w, booster.id, { kind: 'rearm', targetId: booster.hostId }, 'enemy');
  }
  if (w.time >= (w.ai.launchAt || 0)) {
    w.ai.launchAt = w.time + 8;
    enemyLaunch(w, w.scenario === 'garden');
  }
  if (w.scenario === 'garden') return;
  const home = w.planets.find(p => p.team === 'enemy' && p.hp > 0);
  const target = w.planets.find(p => p.team === 'player' && p.hp > 0);
  if (!home || !target) return;
  if (w.time >= w.ai.buildAt) {
    w.ai.buildAt += 58;
    const counts = fleet(w, 'enemy');
    const type = !counts.some(u => u.type === 'booster') ? 'booster' : counts.filter(u => u.type === 'ship').length < 3 ? 'ship' : counts.filter(u => u.type === 'drone').length < 2 ? 'drone' : 'platform';
    spawn(w, type, 'enemy', home);
  }
  if (w.time >= w.ai.attackAt) {
    w.ai.attackAt += 110;
    const ships = fleet(w, 'enemy').filter(u => u.type === 'ship' && u.order.kind !== 'attack' && entity(w, u.order.targetId)?.type !== 'booster').slice(0, 2);
    for (const s of ships) s.order = { kind: 'attack', targetId: target.id };
    if (ships.length) announce(w, 'Enemy ships departing', `${ships.length} ship${ships.length > 1 ? 's' : ''} on a course toward ${target.name}.`, true);
  }
  if (w.time >= w.ai.rockAt) {
    const booster = fleet(w, 'enemy').find(u => u.type === 'booster' && u.loaded && !u.attachedRockId && u.order.kind !== 'fit');
    const allowed = w.scenario !== 'hold' || ((w.ai.sorties || 0) < 3 && w.time < w.duration - 60);
    if (allowed && dispatchBooster(w, booster)) {
      w.ai.sorties = (w.ai.sorties || 0) + 1;
      w.ai.rockAt = w.time + (w.scenario === 'hold' ? 60 : 95);
      const escort = fleet(w, 'enemy').find(u => u.type === 'ship' && u.order.kind === 'defend');
      if (escort) escort.order = { kind: 'defend', targetId: booster.id };
    } else w.ai.rockAt = w.time + 5;
  }
}
export function step(w, dt = DT) {
  if (w.outcome && !w.continueSandbox) return;
  scanRockThreats(w);
  advanceMotion(w, dt);
  for (const p of w.planets) if (p.hp > 0 && p.team !== 'neutral') w.metal[p.team] = Math.min(999, w.metal[p.team] + .4 * dt);
  combat(w, dt); updateBoosters(w, 0, true); ai(w);
  w.effects = w.effects.filter(e => w.time - e.born < e.life);
  const home = w.planets.find(p => p.team === 'player');
  if (home.hp <= 0) w.outcome = 'defeat';
  else if (w.scenario === 'neighbors' && w.planets.find(p => p.team === 'enemy').hp <= 0) w.outcome = 'victory';
  else if (w.scenario === 'hold' && w.time >= w.duration) w.outcome = 'victory';
  else if (w.scenario === 'garden' && w.progress.launched && w.progress.intercepted && !w.continueSandbox) w.outcome = 'victory';
}
export function predict(world, ids, pending = null, horizon = 90) {
  const w = structuredClone(world);
  const start = w.time;
  if (pending) {
    const u = entity(w, pending.id);
    if (u) {
      if (pending.impulse) launchRock(w, u.id, pending.impulse, pending.team || 'player', true);
      if (pending.order) setOrder(w, u.id, pending.order, u.team);
    }
  }
  const results = new Map();
  for (const id of ids) {
    const u = entity(w, id);
    const burningRock = u?.type === 'booster' && u.attachedRockId ? entity(w, u.attachedRockId) : null;
    if (u) results.set(id, { points: [{ x: u.x, y: u.y, t: 0 }], eta: null, closest: Infinity, impact: null, ghost: null,
      ballistic: u.type === 'rock' && !u.burn?.remaining, powered: !!u.burn?.remaining, ended: !!u.attachedRockId && !burningRock?.burn?.remaining });
  }
  const iterations = Math.round(horizon / DT);
  for (let n = 1; n <= iterations; n++) {
    advanceMotion(w, DT, true);
    for (const [id, result] of results) {
      const u = w.units.find(e => e.id === id);
      if (!u || result.impact || result.ended) continue;
      if (u.impact) { result.impact = { ...u.impact, time: u.impact.time - start }; result.points.push({ x: u.x, y: u.y, t: w.time - start }); }
      if (u.hp <= 0) { result.ended = true; continue; }
      if (u.attachedRockId && !entity(w, u.attachedRockId)?.burn?.remaining) {
        result.attachment = { x: u.x, y: u.y, time: w.time - start };
        result.points.push({ x: u.x, y: u.y, t: w.time - start });
        result.ended = true; continue;
      }
      if (result.powered && !result.burnEnd && !u.burn?.remaining) {
        result.burnEnd = { x: u.x, y: u.y, time: w.time - start };
        result.points.push({ x: u.x, y: u.y, t: w.time - start });
      }
      if (n % 12 === 0) result.points.push({ x: u.x, y: u.y, t: w.time - start });
      let target = u.order?.targetId ? entity(w, u.order.targetId) : u.order?.x !== undefined ? u.order : null;
      if (u.type === 'rock') {
        const targets = [...w.planets];
        target = targets.sort((a, b) => distance(a, u) - distance(b, u))[0];
      }
      if (target) {
        const d = distance(u, target) - (target.radius || 0);
        if (d < result.closest) {
          result.closest = d; result.closestTime = w.time - start;
          if (target.type === 'planet' && (u.type === 'rock' || ['move', 'attack'].includes(u.order?.kind))) result.ghost = { x: target.x, y: target.y, radius: target.radius, name: target.name };
        }
        const threshold = u.type === 'rock' ? u.radius : target.type === 'planet' ? 60 : u.order.kind === 'attack' ? u.range * .7 : 12;
        if (result.eta === null && d <= threshold) result.eta = w.time - start;
      }
    }
  }
  return results;
}
