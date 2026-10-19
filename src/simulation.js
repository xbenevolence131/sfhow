// All distances and masses are game units. Both forecasts and live flight use DT.
export const DT = 1 / 20;
// The displayed G is a normalized multiplier; 1.0 uses this tuned baseline.
export const GRAVITY_BASE = 12;
export const GRAVITY_DEFAULTS = Object.freeze({ g: 1, planetMass: 2800, sunMass: 5400 });
export const GRAVITY_LIMITS = Object.freeze({ g: 3, planetMass: 8400, sunMass: 16200 });
export const COLLISION_DEFAULTS = Object.freeze({ bounce: .35, strength: 18 });
export const ROCK_SIZES = Object.freeze({ small: { radius: 5.5, mass: 1, damage: 35, metalCapacity: 40 }, medium: { radius: 8, mass: 2, damage: 65, metalCapacity: 80 }, large: { radius: 12, mass: 4, damage: 100, metalCapacity: 160 } });
export function normalizeCollisions(settings = {}) {
  return { bounce: Number.isFinite(settings.bounce) ? clamp(settings.bounce, 0, 1) : COLLISION_DEFAULTS.bounce,
    strength: Number.isFinite(settings.strength) ? clamp(settings.strength, 1, 100) : COLLISION_DEFAULTS.strength };
}
export function setCollisions(w, settings) {
  w.collisions = normalizeCollisions({ ...w.collisions, ...settings });
  w.setup.collisions = { ...w.collisions };
  w.threatScanAt = 0; w.rockThreats = {}; w.threatWarnings = {};
}
export const STAR_RADIUS = 25;
export const MAX_IMPULSE = 26;
export const BELT_INNER = 1025;
export const BELT_WIDTH = 45;
export const SYSTEM_DIAMETER = 2300;
export const CAP = 12;
export const ATTACH_TIME = 6;
export const REARM_TIME = 8;
export const BURN_TIME = 4;
export const COST = { ship: 60, platform: 80, drone: 25, booster: 50, miner: 25, rock: 35 };
export const MINING_RATE = .4;
export const MINING_DOCK_TIME = 4;
export const REPAIR_RATE = 1;
export const REPAIR_DELAY = 10;
export const REPAIR_DISTANCE = 100; // From the home planet's surface.
export function shipRepairStatus(w, u) {
  if(u?.type!=='ship' || u.hp<=0 || u.hp>=u.maxHp)return null;
  const home=entity(w,u.hostId);
  if(!home || home.hp<=0 || home.type!=='planet' || home.team!==u.team)return {kind:'unavailable'};
  if(distance(u,home)>home.radius+REPAIR_DISTANCE)return {kind:'away'};
  const remaining=Math.max(0,REPAIR_DELAY-(w.time-(u.lastDamageAt??0)));
  return remaining>1e-8?{kind:'waiting',remaining}:{kind:'repairing'};
}
function repairShips(w, dt) {
  for(const u of w.units) {
    if(shipRepairStatus(w,u)?.kind!=='repairing')continue;
    const elapsed=Math.min(dt,Math.max(0,w.time-(u.lastDamageAt??0)-REPAIR_DELAY));
    u.hp=Math.min(u.maxHp,u.hp+REPAIR_RATE*elapsed);
  }
}
export const UPGRADES = Object.freeze({
  ship: { cost: 25, maxHp: 145, speed: 26, thrust: 8, range: 130, damage: 12, cooldown: 1.8 },
  platform: { cost: 32.5, maxHp: 300, range: 170, damage: 16, cooldown: 1.5 },
  drone: { cost: 10, speed: 42, thrust: 13, damage: 70, defenseRadius: 240 },
});
export function superColor(color = '#80d6cf') {
  const rgb=(color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)||['','80','d6','cf']).slice(1).map(c=>parseInt(c,16));
  const low=Math.min(...rgb);
  return '#'+rgb.map(c=>Math.max(0,Math.round(c*.9-low*.3)).toString(16).padStart(2,'0')).join('');
}
export function upgradeUnit(w, id, team = 'player') {
  const u=entity(w,id),spec=UPGRADES[u?.type];
  if(!u || u.team!==team || !spec)return {error:'Select your ship, platform or drone.'};
  if(u.tier===2)return {error:'This unit is already Super.'};
  if(w.outcome && !w.continueSandbox)return {error:'This encounter has ended.'};
  const cost=w.unlimitedMetal && team==='player'?0:spec.cost;
  if(w.metal[team]<cost)return {error:`You need ${cost} metal to upgrade.`};
  const health=u.hp/u.maxHp,oldCooldown=u.cooldown;
  w.metal[team]-=cost;
  const {cost:unused,...stats}=spec;Object.assign(u,stats);
  u.hp=health*u.maxHp;
  if(oldCooldown>0)u.fireTimer*=u.cooldown/oldCooldown;
  u.tier=2;u.baseColor=u.color;u.color=superColor(u.color);
  announce(w,`${u.name} upgraded`, 'Super unit ready.');
  return u;
}
export const TYPES = {
  ship: { hp: 110, radius: 6, speed: 21, thrust: 6.5, range: 105, damage: 8, cooldown: 2.3 },
  platform: { hp: 230, radius: 9, speed: 0, thrust: 0, range: 135, damage: 12, cooldown: 2.1 },
  drone: { hp: 38, radius: 4, speed: 32, thrust: 10, range: 0, damage: 45, cooldown: 0 },
  booster: { hp: 65, radius: 6, speed: 19, thrust: 6, range: 0, damage: 0, cooldown: 0 },
  miner: { hp: 65, radius: 7, speed: 18, thrust: 6, range: 0, damage: 0, cooldown: 0 },
  rock: { hp: 50, radius: 8, speed: 0, thrust: 0, range: 0, damage: 65, cooldown: 0 },
};
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function orbitalRate(radius, settings = GRAVITY_DEFAULTS) {
  return Math.sqrt(GRAVITY_BASE * settings.g * settings.sunMass / radius ** 3);
}
export function planetAt(p, time) {
  const a = p.phase + time * p.omega;
  return { x: Math.cos(a) * p.orbit, y: Math.sin(a) * p.orbit, vx: -Math.sin(a) * p.orbit * p.omega, vy: Math.cos(a) * p.orbit * p.omega };
}
export function entity(world, id) { return world.planets.find(p => p.id === id) || world.units.find(u => u.id === id && u.hp > 0) || (id && world.practiceDock?.id === id ? world.practiceDock : null); }
export function isBeltRock(u) { return u.type === 'rock' && !u.launched && u.beltOrbit > 0; }
function beltSpeed(x, y, radius, planets, settings) {
  const g = gravity(x, y, planets, settings);
  return Math.sqrt(Math.max(GRAVITY_BASE * settings.g * settings.sunMass / radius, -(g.x*x + g.y*y)));
}
function beltPosition(u, time) {
  const a=u.beltPhase+time*u.beltOmega;
  return {x:Math.cos(a)*u.beltOrbit,y:Math.sin(a)*u.beltOrbit,
    vx:-Math.sin(a)*u.beltOrbit*u.beltOmega,vy:Math.cos(a)*u.beltOrbit*u.beltOmega};
}
export function normalizeGravity(settings = {}) {
  return Object.fromEntries(Object.entries(GRAVITY_DEFAULTS).map(([key, fallback]) =>
    [key, Number.isFinite(settings[key]) ? clamp(settings[key], 0, GRAVITY_LIMITS[key]) : fallback]));
}
export function setGravity(w, settings) {
  w.gravity = normalizeGravity({ ...w.gravity, ...settings });
  for (const p of w.planets) {
    const omega = orbitalRate(p.orbit, w.gravity);
    if (omega === p.omega) continue;
    const oldVx = p.vx, oldVy = p.vy;
    // Re-anchor the phase at the current position, even after a zero-G stop.
    p.phase = Math.atan2(p.y, p.x) - w.time * omega;
    p.omega = omega; p.vx = -p.y * omega; p.vy = p.x * omega;
    // Prescribed platforms follow their host; free-flying units retain momentum.
    for (const u of w.units) if (u.type === 'platform' && u.hostId === p.id) {
      u.vx += p.vx - oldVx; u.vy += p.vy - oldVy;
    }
  }
  for(const rock of w.units.filter(isBeltRock)) {
    const angle=Math.atan2(rock.y,rock.x);
    rock.beltOmega=beltSpeed(rock.x,rock.y,rock.beltOrbit,w.planets,w.gravity)/rock.beltOrbit;
    rock.beltPhase=angle-w.time*rock.beltOmega;
    rock.vx=-Math.sin(angle)*rock.beltOrbit*rock.beltOmega;
    rock.vy=Math.cos(angle)*rock.beltOrbit*rock.beltOmega;
    const booster=entity(w,rock.boosterId);
    if(booster?.attachedRockId===rock.id){booster.vx=rock.vx;booster.vy=rock.vy;}
  }
  w.setup.gravity = { ...w.gravity };
  w.threatScanAt = 0; w.rockThreats = {}; w.threatWarnings = {};
}
export function gravity(x, y, planets, settings = GRAVITY_DEFAULTS) {
  const d = Math.max(38, Math.hypot(x, y));
  const starMu = GRAVITY_BASE * settings.g * settings.sunMass, planetMu = GRAVITY_BASE * settings.g * settings.planetMass;
  let ax = -starMu * x / d ** 3, ay = -starMu * y / d ** 3;
  for (const p of planets) {
    const dx = p.x - x, dy = p.y - y, r = Math.max(p.radius + 12, Math.hypot(dx, dy));
    ax += planetMu * dx / r ** 3; ay += planetMu * dy / r ** 3;
  }
  return { x: ax, y: ay };
}
export function announce(w, text, detail = '', major = false) {
  w.events.push({ id: ++w.eventId, time: w.time, text, detail, major });
  if (w.events.length > 16) w.events.shift();
}
export function fleet(w, team) { return w.units.filter(u => u.team === team && u.type !== 'rock' && u.hp > 0); }
export function spawn(w, type, team, host, free = false) {
  free ||= !!w.unlimitedMetal && team === 'player';
  if (!host || host.team !== team || host.hp <= 0) return { error: 'Select a friendly colony to deploy.' };
  if (fleet(w, team).length >= (w.fleetCap || CAP)) return { error: `Fleet limit reached: ${w.fleetCap || CAP} units.` };
  if (!free && w.metal[team] < COST[type]) return { error: `You need ${COST[type]} metal.` };
  if (!free) w.metal[team] -= COST[type];
  const serial = ++w.serial;
  const phase = serial * 2.39996;
  const orbit = host.radius + (type === 'platform' ? 48 : 32) + (serial % 3) * 9;
  // A visible, leisurely 90-second local orbit around the moving host.
  const omega = type === 'platform' ? 2 * Math.PI / 90 : 0;
  const x = host.x + Math.cos(phase) * orbit, y = host.y + Math.sin(phase) * orbit;
  const unit = { id: `u${serial}`, name: `${type.toUpperCase()} ${String(serial).padStart(2, '0')}`, type, team,
    ...TYPES[type], maxHp: TYPES[type].hp, x, y,
    vx: host.vx - Math.sin(phase) * orbit * omega, vy: host.vy + Math.cos(phase) * orbit * omega,
    hostId: host.id, color: host.color, tier: 1, lastDamageAt: w.time, phase: phase - w.time * omega, orbit, omega,
    order: { kind: 'defend', targetId: host.id }, fireTimer: 0.4 + (serial % 4) * 0.3, launched: true,
    loaded: type === 'booster', attachProgress: 0, rearmProgress: 0 };
  w.units.push(unit);
  return unit;
}
export function addRock(w, angle, orbit = BELT_INNER + BELT_WIDTH / 2, name, size = 'medium') {
  // Account for the planets' stronger radial pull when seeding belt velocities.
  const radial = { x: Math.cos(angle), y: Math.sin(angle) };
  const settings = w.gravity || GRAVITY_DEFAULTS;
  const speed = beltSpeed(radial.x*orbit,radial.y*orbit,orbit,w.planets,settings);
  const serial = ++w.serial;
  const rock = { id: `r${serial}`, name: name || `ROCK ${String(serial).padStart(2, '0')}`, type: 'rock', team: 'neutral',
    ...TYPES.rock, ...ROCK_SIZES[size], metalRemaining: ROCK_SIZES[size].metalCapacity, size, maxHp: TYPES.rock.hp, x: Math.cos(angle) * orbit, y: Math.sin(angle) * orbit,
    vx: -Math.sin(angle) * speed, vy: Math.cos(angle) * speed, launched: false,
    beltOrbit:orbit,beltOmega:speed/orbit,beltPhase:angle-w.time*speed/orbit,order: { kind: 'ballistic' } };
  w.units.push(rock); return rock;
}
export function setOrder(w, id, order, team = 'player') {
  const u = entity(w, id);
  if (!u || !['ship', 'drone', 'booster', 'miner'].includes(u.type) || u.team !== team) return false;
  const target = entity(w, order.targetId);
  if(u.type==='miner'){
    if(!['mine','move','defend','stop'].includes(order.kind))return false;
    if(order.kind==='mine' && (!target || target.type!=='rock' || target.launched || !(target.metalRemaining>0) || (target.boosterTeam && target.boosterTeam!==team) || (target.minerId && target.minerId!==u.id && entity(w,target.minerId))))return false;
    if(order.kind==='move' && (order.targetId?!target:!Number.isFinite(order.x)||!Number.isFinite(order.y)))return false;
    if(order.kind==='defend' && (!target || target.team!==team))return false;
    if(u.miningRockId)releaseMiner(w,u);
    u.miningProgress=0;
  }else if(order.kind==='mine')return false;
  if (u.attachedRockId) {
    if (!['detach', 'move', 'rearm', 'fit'].includes(order.kind)) return false;
    // Validate before disarming the rock or queuing a departure.
    if (order.kind === 'rearm' && (!target || target.team !== team || !['planet', 'dock'].includes(target.type))) return false;
    if (order.kind === 'fit' && (!u.loaded || !target || target.type !== 'rock' || target.launched || target.boosterTeam)) return false;
    if (order.kind === 'move' && (order.targetId ? !target : !Number.isFinite(order.x) || !Number.isFinite(order.y))) return false;
    const rock = entity(w, u.attachedRockId);
    if (rock?.burn?.remaining > 0) {
      if (order.kind === 'detach') return false;
      u.departureOrder = { ...order };
      return true;
    }
    if (rock) {
      rock.boosterId = null; rock.boosterTeam = null;
      if (!rock.launched) { rock.team = 'neutral'; rock.color = null; rock.practice = false; }
    }
    u.attachedRockId = null; u.attachOffset = null;
    u.departureOrder = null;
    if (order.kind === 'detach') order = { kind: 'stop', x: u.x, y: u.y };
  } else if (order.kind === 'detach') return false;
  if (order.kind === 'fit') {
    if (u.type !== 'booster' || !u.loaded || !target || target.type !== 'rock' || target.launched || target.boosterTeam) return false;
  }
  if (u.type === 'booster' && order.kind === 'attack') return false;
  if (order.kind === 'rearm' && (u.type !== 'booster' || !target || target.team !== team || !['planet', 'dock'].includes(target.type))) return false;
  if (order.kind === 'stop') order = { kind: 'stop', x: u.x, y: u.y };
  if (u.type === 'drone' && order.kind !== 'defend' && order.kind !== 'stop') return false;
  u.order = { ...order };
  if (w.lesson?.phase === 'combat' && u.type === 'ship' && team === 'player' && order.kind === 'attack' && target?.id === w.lesson.targetId) w.lesson.attackerId = u.id;
  u.attachProgress = 0; u.rearmProgress = 0;
  if (order.kind === 'defend' && target?.type === 'planet') u.hostId = order.targetId;
  if (u.type === 'drone' && order.kind === 'defend' && order.targetId) u.hostId = order.targetId;
  return true;
}
export function launchRock(w, id, impulse, team = 'player', free = false) {
  free ||= !!w.unlimitedMetal && team === 'player';
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
  const miner=entity(w,r.minerId);if(miner)releaseMiner(w,miner);
  w.threatScanAt = 0;
  r.boosterTeam = null;
  booster.loaded = false; booster.vx = r.vx; booster.vy = r.vy;
  if(team==='player' && w.lesson?.phase==='basics' && !w.lesson.returnBoosterId)w.lesson.returnBoosterId=booster.id;
  if(team==='player' && w.lesson?.phase==='assault')w.lesson.assaultLaunches++;
  if (!free) w.metal[team] -= COST.rock;
  if (team === 'player') w.progress.launched = true;
  announce(w, team === 'player' ? 'Booster firing' : 'Incoming asteroid', `${BURN_TIME}s powered burn, then automatic separation. The rock will coast.`, team === 'enemy');
  return r;
}
function hostile(a, b) { return a.team !== b.team && a.team !== 'neutral' && b.team !== 'neutral'; }
function combatTarget(u, target, w) {
  // Range equipment waits safely in the belt; the exercise starts at launch.
  if (w.scenario === 'playground' && u.team === 'enemy' && target.team === 'player') return target.type === 'rock' && target.launched;
  if (hostile(u, target)) return true;
  const impact = w.rockThreats?.[target.id];
  return target.type === 'rock' && target.launched && impact && entity(w, impact.targetId)?.team === u.team;
}
// Forecast only projectiles and their attached engines, avoiding combat steering
// and recursive threat queries. Sample at fixed simulation intervals, not frames.
const threatForecastCache = new WeakMap();
function threatGeometry(w) {
  return JSON.stringify([w.gravity,w.collisions,w.planets.map(p=>[p.id,p.orbit,p.phase,p.omega,p.radius])]);
}
function matchingThreatMotion(w, expected) {
  const actual=w.units.filter(u=>u.type==='rock'), predicted=expected.units.filter(u=>u.type==='rock');
  if(actual.length!==predicted.length)return false;
  const lookup=new Map(predicted.map(u=>[u.id,u]));
  for(const rock of actual){
    const p=lookup.get(rock.id);if(!p)return false;
    for(const key of ['hp','launched','boosterId','boosterTeam','radius','mass','damage','beltOrbit','beltOmega','beltPhase'])if(rock[key]!==p[key])return false;
    for(const key of ['x','y','vx','vy'])if(Math.abs(rock[key]-p[key])>1e-7)return false;
    for(const key of ['remaining','ax','ay'])if(Math.abs((rock.burn?.[key]||0)-(p.burn?.[key]||0))>1e-7)return false;
    const engine=entity(w,rock.boosterId), anticipated=entity(expected,p.boosterId);
    if((engine?.attachedRockId||null)!==(anticipated?.attachedRockId||null))return false;
  }
  return true;
}
export function scanRockThreats(w) {
  if (w.time < (w.threatScanAt || 0)) return;
  w.threatScanAt = w.time + 1;
  const rocks = w.units.filter(u => u.hp > 0 && u.type === 'rock' && u.launched);
  w.rockThreats = {};
  if (!rocks.length) { threatForecastCache.delete(w); return; }
  // Include the whole belt: a bank shot can activate a previously idle rock.
  const isolated = { ...w, units: w.units.filter(u => u.type === 'rock' || u.attachedRockId) };
  const geometry=threatGeometry(w);
  let cache=threatForecastCache.get(w);
  if(cache && cache.geometry===geometry && w.time>=cache.expected.time-1e-7 && w.time-cache.start<30){
    const steps=Math.round((w.time-cache.expected.time)/DT);
    for(let i=0;i<steps;i++)advanceMotion(cache.expected,DT,true);
    if(Math.abs(w.time-cache.expected.time)>1e-7 || !matchingThreatMotion(w,cache.expected))cache=null;
  }else cache=null;
  if(!cache){
    // Extra horizon keeps the next 90 seconds available during cache reuse.
    cache={geometry,start:w.time,expected:structuredClone(isolated),forecasts:predict(isolated,rocks.map(r=>r.id),null,120)};
    threatForecastCache.set(w,cache);
  }
  const forecasts=cache.forecasts;
  w.threatWarnings ||= {};
  for (const [id, flight] of forecasts) {
    const rock = entity(w, id); if (!rock || rock.type !== 'rock') continue;
    const impact = flight.impact && {...flight.impact,time:flight.impact.time-(w.time-cache.start)};
    if (!impact || impact.time<0 || impact.time>90 || impact.targetId === 'star') continue;
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
    if (target.hp <= 0 || !combatTarget(u, target, w) || distance(target, anchor) > (u.type === 'drone' ? u.defenseRadius || 180 : 210)) continue;
    if (u.type === 'drone' && !droneCanRam(u, target, w)) continue;
    const s = distance(u, target) - (target.type === 'rock' ? 100 : 0);
    if (s < score) { score = s; best = target; }
  }
  return best;
}
function firingLead(u, target, range) {
  // Earliest entry into weapon reach, not contact with the target's centre.
  // Short constant-velocity lookahead is cheap and refreshed each physics step.
  const dx=target.x-u.x,dy=target.y-u.y,vx=target.vx||0,vy=target.vy||0;
  const a=vx*vx+vy*vy-u.speed*u.speed;
  const b=2*(dx*vx+dy*vy-range*u.speed),c=dx*dx+dy*dy-range*range;
  if(c<=0)return 0;
  let time=Infinity;
  if(Math.abs(a)<1e-8){if(b<0)time=-c/b;}
  else {
    const discriminant=b*b-4*a*c;
    if(discriminant>=0)for(const root of [(-b-Math.sqrt(discriminant))/(2*a),(-b+Math.sqrt(discriminant))/(2*a)])if(root>=0)time=Math.min(time,root);
  }
  return Math.min(12,Number.isFinite(time)?time:Math.max(0,-(dx*vx+dy*vy)/(vx*vx+vy*vy||1)));
}
function steering(u, w, g) {
  u.ramTargetId = null;
  let target = u.order?.targetId ? entity(w, u.order.targetId) : null;
  let standoff = 0;
  let kind = u.order?.kind || 'stop';
  if (kind === 'defend') {
    const anchor = target || entity(w, u.hostId);
    if (anchor && anchor.hp > 0) {
      target = ['booster','miner'].includes(u.type) ? null : defenseTarget(u, w, anchor);
      if (target) {
        standoff = u.range * 0.55;
        if(u.type==='drone')u.ramTargetId=target.id;
      }
      else {
        // Keep a distinct berth around a moving colony or platform.
        const angle = u.phase + w.time * 0.012;
        const radius = anchor.type === 'planet' ? anchor.radius + 48 : 28;
        target = { x: anchor.x + Math.cos(angle) * radius, y: anchor.y + Math.sin(angle) * radius,
          vx: (anchor.vx || 0) - Math.sin(angle) * radius * 0.012, vy: (anchor.vy || 0) + Math.cos(angle) * radius * 0.012 };
      }
    }
  } else if (target) {
    standoff = ['fit','mine'].includes(kind) ? target.radius + u.radius + 2 : ['planet', 'dock'].includes(target.type) ? target.radius + (hostile(u, target) ? 52 : 45) : u.order.kind === 'attack' ? u.range * .6 : 25;
  }
  if (!target || target.hp <= 0) target = { x: u.order?.x ?? u.x, y: u.order?.y ?? u.y, vx: 0, vy: 0 };
  const circleTarget = u.type === 'ship' && kind === 'attack' && hostile(u, target) && ['ship', 'booster', 'miner', 'drone', 'platform'].includes(target.type);
  const rawDist = distance(u, target);
  const interceptRock=u.type==='ship' && target.type==='rock' && ['attack','defend'].includes(kind) && combatTarget(u,target,w);
  if(interceptRock)standoff=u.range*.85;
  const holdFirePosition=interceptRock && rawDist<=u.range*.95;
  const lead = interceptRock?firingLead(u,target,standoff):clamp((rawDist - standoff) / u.speed, 0, 24);
  let tx = target.x + (target.vx || 0) * lead, ty = target.y + (target.vy || 0) * lead;
  if (target.type === 'planet') { const future = planetAt(target, w.time + lead); tx = future.x; ty = future.y; }
  if(holdFirePosition){tx=u.x;ty=u.y;standoff=0;}
  // A gentle tangent waypoint avoids steering through the star.
  const lx = tx - u.x, ly = ty - u.y, len2 = lx * lx + ly * ly;
  const t = clamp(-(u.x * lx + u.y * ly) / (len2 || 1), 0, 1);
  let avoidingStar = false;
  if (Math.hypot(u.x + lx * t, u.y + ly * t) < 68 && rawDist > 70) {
    avoidingStar = true;
    const side = u.x * ty - u.y * tx >= 0 ? 1 : -1;
    const angle = Math.atan2(u.y, u.x) + side * .7;
    tx = Math.cos(angle) * 100; ty = Math.sin(angle) * 100; standoff = 0;
  }
  let dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy) || 1;
  const gap = d - standoff;
  const desired = u.ramTargetId && !avoidingStar ? u.speed : clamp(gap * .65, interceptRock?0:-u.speed * .4, u.speed);
  // Combat ships brake to fire; they must not inherit a fast rock's velocity.
  const follow = interceptRock?0:clamp(1 - Math.max(0, gap) / 70, 0, 1);
  let vx = dx / d * desired + (target.vx || 0) * follow;
  let vy = dy / d * desired + (target.vy || 0) * follow;
  if (circleTarget && !avoidingStar) {
    // Intercept at distance, then blend into a moving circle inside weapon range.
    // This is actual thrust-assisted flight, shared with previews, not a drawn orbit.
    const blend = clamp((u.range * 1.5 - rawDist) / (u.range * .65), 0, 1);
    const minimumRadius = target.radius + u.radius + 8;
    let radius = Math.max(minimumRadius, u.range * .55);
    // Platforms sit close to a planet. Tighten the circle to fit that space
    // instead of letting planet avoidance pin the attacker on one side.
    for (const p of w.planets) radius = Math.max(minimumRadius, Math.min(radius, distance(target, p) - p.radius - u.radius - 14));
    const angle = rawDist > .001 ? Math.atan2(u.y - target.y, u.x - target.x) : u.phase;
    const nx = Math.cos(angle), ny = Math.sin(angle);
    const radial = clamp((radius - rawDist) * .65, -u.speed, u.speed * .6);
    const direction = Math.sin(u.phase) >= 0 ? 1 : -1;
    const tangent = Math.min(u.speed * .48, Math.sqrt(u.thrust * radius) * .65) * direction;
    vx = vx * (1 - blend) + ((target.vx || 0) + nx * radial - ny * tangent) * blend;
    vy = vy * (1 - blend) + ((target.vy || 0) + ny * radial + nx * tangent) * blend;
  }
  // Local avoidance keeps assistance forgiving around planets en route.
  for (const p of w.planets) {
    const px = u.x - p.x, py = u.y - p.y, pd = Math.hypot(px, py) || 1;
    const clearance = circleTarget && rawDist < u.range ? u.radius + 10 : 27;
    if (pd < p.radius + clearance) { const push = (p.radius + clearance - pd) * 1.5; vx += px / pd * push; vy += py / pd * push; }
  }
  let ax = (vx - u.vx) * 1.4, ay = (vy - u.vy) * 1.4;
  const force = Math.hypot(ax, ay);
  if (force > u.thrust) { ax *= u.thrust / force; ay *= u.thrust / force; }
  // Gravity assistance has its own budget so stronger tuning does not consume
  // all maneuvering thrust near planets. Both teams and previews share it.
  return { x: ax - g.x * .9, y: ay - g.y * .9 };
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
    if (u.hp <= 0 || u.type === 'platform' || u.attachedRockId || u.miningRockId || isBeltRock(u)) continue;
    if (u.order?.kind === 'attack' && u.order.targetId) {
      const target = entity(w, u.order.targetId);
      if (!target || target.hp <= 0) u.order = { kind: 'stop', x: u.x, y: u.y };
    }
    const g = gravity(u.x, u.y, w.planets, w.gravity);
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
    if (u.hp <= 0 || u.attachedRockId || u.miningRockId) continue;
    if (isBeltRock(u)) {
      Object.assign(u,beltPosition(u,w.time));
    } else if (u.type === 'platform') {
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
    if (u.type === 'rock') continue; // Rocks resolve swept contacts in time order below.
    const old = previous.get(u.id);
    if (sweptHit(old, u, { x: 0, y: 0 }, { x: 0, y: 0 }, STAR_RADIUS + u.radius)) {
      u.hp = 0; u.impact = { x: u.x, y: u.y, targetId: 'star', name: 'SOL', time: w.time };
      if (!forecast) burst(w, u.x, u.y, 'star');
      continue;
    }
    if (Math.hypot(u.x, u.y) > 2800) u.hp = 0;
  }
  resolveRockContacts(w, previous, oldPlanets, dt, forecast);
  resolveDroneContacts(w, previous, dt, forecast);
  updateBoosters(w, dt, forecast);
  updateMiners(w, dt, forecast);
}
function releaseMiner(w, miner) {
  const rock=w.units.find(r=>r.id===miner.miningRockId);
  if(rock?.minerId===miner.id)rock.minerId=null;
  miner.miningRockId=null;miner.miningOffset=null;miner.miningProgress=0;
  miner.order={kind:'stop',x:miner.x,y:miner.y};
}
function updateMiners(w,dt,forecast){
  for(const miner of w.units.filter(u=>u.type==='miner')){
    if(miner.hp<=0){if(miner.miningRockId)releaseMiner(w,miner);continue;}
    if(miner.miningRockId){
      const rock=entity(w,miner.miningRockId);
      if(!rock){miner.hp=0;releaseMiner(w,miner);if(!forecast)burst(w,miner.x,miner.y,miner.team);continue;}
      if(rock.launched){releaseMiner(w,miner);continue;}
      miner.x=rock.x+miner.miningOffset.x;miner.y=rock.y+miner.miningOffset.y;miner.vx=rock.vx;miner.vy=rock.vy;
      if(!forecast && rock.metalRemaining>0){
        const mined=Math.min(MINING_RATE*dt,rock.metalRemaining,Math.max(0,999-w.metal[miner.team]));
        w.metal[miner.team]+=mined;rock.metalRemaining=Math.max(0,rock.metalRemaining-mined);
        if(rock.metalRemaining<1e-9){rock.metalRemaining=0;announce(w,`${rock.name} depleted`,`${miner.name} needs another asteroid. The empty rock can still be launched.`);}
      }
    }else if(miner.order?.kind==='mine'){
      const rock=entity(w,miner.order.targetId);
      if(!rock || rock.type!=='rock' || rock.launched || !(rock.metalRemaining>0) || (rock.boosterTeam && rock.boosterTeam!==miner.team) || (rock.minerId && entity(w,rock.minerId))){miner.order={kind:'defend',targetId:miner.hostId};miner.miningProgress=0;continue;}
      if(distance(miner,rock)<=rock.radius+miner.radius+12 && Math.hypot(miner.vx-rock.vx,miner.vy-rock.vy)<5){
        miner.miningProgress=(miner.miningProgress||0)+dt;
        if(miner.miningProgress>=MINING_DOCK_TIME){
          miner.miningRockId=rock.id;rock.minerId=miner.id;miner.miningOffset={x:-(rock.radius+miner.radius+8),y:8};
          miner.x=rock.x+miner.miningOffset.x;miner.y=rock.y+miner.miningOffset.y;miner.vx=rock.vx;miner.vy=rock.vy;
          if(!forecast)announce(w,`${miner.name} mining`, `+${MINING_RATE} metal / second from ${rock.name}.`);
        }
      }else miner.miningProgress=0;
    }
  }
}
function droneCanRam(drone, target, w) {
  if(drone.order?.kind!=='defend' || !['rock','ship','drone','booster','miner'].includes(target.type))return false;
  if(target.type==='rock' && !target.launched)return false;
  const anchor=entity(w,drone.order.targetId)||entity(w,drone.hostId);
  return !!anchor && anchor.hp>0 && distance(anchor,target)<=(drone.defenseRadius||180) && combatTarget(drone,target,w);
}
function ramContact(w, drone, target, x, y, when, forecast) {
  drone.hp=0;drone.x=x;drone.y=y;
  drone.impact={x,y,time:when,targetId:target.id,name:target.name,kind:'ram'};
  target.hp=Math.max(0,target.hp-drone.damage);
  target.lastDamageAt=when;
  if(target.hp<=0)target.impact={x:target.x,y:target.y,time:when,targetId:drone.id,name:'Drone interception',kind:'intercept'};
  if(forecast)return;
  w.effects.push({type:'ram',x,y,team:drone.team,color:drone.color,born:w.time,life:2});
  announce(w,'Drone impact',`${drone.name} sacrificed / ${drone.damage} damage to ${target.name}.`);
  if(target.hp<=0 && target.type==='rock') {
    if(w.lesson?.phase==='defense' && target.id===w.lesson.rockId && drone.team==='player')w.lesson.finalIntercepted=true;
    if(drone.team==='player' && target.team!=='player')w.progress.intercepted=true;
    announce(w,'Asteroid intercepted','The debris is harmless.');
  }
}
function resolveDroneContacts(w, previous, dt, forecast) {
  if(w.ignoreDroneContacts)return;
  const contacts=[];
  for(const drone of w.units) {
    if(drone.type!=='drone' || drone.hp<=0)continue;
    const start=previous.get(drone.id);
    for(const target of w.units) {
      if(target.hp<=0 || target.type==='rock' || !droneCanRam(drone,target,w))continue;
      const other=previous.get(target.id);if(!start || !other)continue;
      const a={...start,vx:(drone.x-start.x)/dt,vy:(drone.y-start.y)/dt};
      const b={...other,vx:(target.x-other.x)/dt,vy:(target.y-other.y)/dt};
      const time=contactTime(a,b,drone.radius+target.radius,dt);
      if(Number.isFinite(time))contacts.push({drone,target,time,x:a.x+a.vx*time,y:a.y+a.vy*time});
    }
  }
  contacts.sort((a,b)=>a.time-b.time || a.drone.id.localeCompare(b.drone.id));
  for(const hit of contacts)if(hit.drone.hp>0 && hit.target.hp>0)ramContact(w,hit.drone,hit.target,hit.x,hit.y,w.time-dt+hit.time,forecast);
}
// Exact time of first contact for circles moving at constant step velocities.
function contactTime(a, b, radius, limit) {
  const x=b.x-a.x, y=b.y-a.y, vx=b.vx-a.vx, vy=b.vy-a.vy;
  if(Math.abs(x)>radius+Math.abs(vx)*limit || Math.abs(y)>radius+Math.abs(vy)*limit)return Infinity;
  const c=x*x+y*y-radius*radius, dot=x*vx+y*vy, speed=vx*vx+vy*vy;
  if(c < -1e-7 || (c <= 1e-7 && dot < -1e-9)) return 0;
  if(dot >= 0 || speed < 1e-12) return Infinity;
  const disc=dot*dot-speed*c; if(disc<0) return Infinity;
  const t=(-dot-Math.sqrt(disc))/speed;
  return t>=0 && t<=limit ? t : Infinity;
}
function resolveRockContacts(w, previous, oldPlanets, dt, forecast) {
  w.rockContacts=[];
  const rocks=w.units.filter(u=>u.type==='rock'&&u.hp>0).sort((a,b)=>a.id.localeCompare(b.id));
  // Untouched belt rocks cannot hit bodies, drones or one another.
  if (!rocks.some(r=>!isBeltRock(r))) return;
  const railEnds=new Map();
  for(const r of rocks) {
    const old=previous.get(r.id);
    if(isBeltRock(r)) {
      railEnds.set(r.id,{x:r.x,y:r.y,vx:r.vx,vy:r.vy});
      // Sweep the tiny orbital arc by its chord. A struck rock keeps the
      // resulting physical velocity; untouched rocks end on their exact rail.
      r.vx=(r.x-old.x)/dt;r.vy=(r.y-old.y)/dt;
    }
    Object.assign(r,old);
  }
  const bodies=[{id:'star',name:'SOL',radius:STAR_RADIUS,x:0,y:0,vx:0,vy:0},
    ...w.planets.map((p,i)=>({id:p.id,name:p.name,radius:p.radius,x:oldPlanets[i].x,y:oldPlanets[i].y,vx:(p.x-oldPlanets[i].x)/dt,vy:(p.y-oldPlanets[i].y)/dt,planet:p}))];
  const settings=w.collisions||COLLISION_DEFAULTS;
  const drones=w.units.filter(u=>!w.ignoreDroneContacts&&u.type==='drone'&&u.hp>0).map(u=>{
    const old=previous.get(u.id);return {unit:u,...old,vx:(u.x-old.x)/dt,vy:(u.y-old.y)/dt};
  });
  let elapsed=0;
  // The cap bounds pathological piles. Unresolved remainder is held in place,
  // never advanced through an unchecked obstacle.
  for(let iteration=0;iteration<128 && elapsed<dt;iteration++) {
    let hit=null, earliest=Infinity;
    const remain=dt-elapsed;
    const movingIndices=[];
    for(let i=0;i<rocks.length;i++)if(rocks[i].hp>0&&!isBeltRock(rocks[i]))movingIndices.push(i);
    for(let i=0;i<rocks.length;i++) {
      const a=rocks[i];if(a.hp<=0)continue;
      const onRail=isBeltRock(a);
      if(!onRail)for(const drone of drones) {
        if(drone.unit.hp<=0 || !droneCanRam(drone.unit,a,w))continue;
        const t=contactTime(a,{...drone,x:drone.x+drone.vx*elapsed,y:drone.y+drone.vy*elapsed},a.radius+drone.unit.radius,remain);
        if(t<earliest){earliest=t;hit={a,drone};}
      }
      if(!onRail)for(const body of bodies) {
        const t=contactTime(a,{...body,x:body.x+body.vx*elapsed,y:body.y+body.vy*elapsed},a.radius+body.radius,remain);
        if(t<earliest){earliest=t;hit={a,body};}
      }
      // Retain the original lexicographic contact tie-break, but skip idle pairs.
      const candidates=onRail?movingIndices:null;
      for(let k=0,j=i+1; candidates?k<candidates.length:j<rocks.length; candidates?k++:j++) {
        if(candidates){j=candidates[k];if(j<=i)continue;}
        const b=rocks[j];if(b.hp<=0)continue;
        const t=contactTime(a,b,a.radius+b.radius,remain);
        if(t<earliest){earliest=t;hit={a,b};}
      }
    }
    const travel=hit?earliest:remain;
    for(const r of rocks)if(r.hp>0){r.x+=r.vx*travel;r.y+=r.vy*travel;}
    elapsed+=travel;
    if(!hit)break;
    const {a,b,body,drone}=hit, when=w.time-dt+elapsed;
    if(drone) {
      ramContact(w,drone.unit,a,drone.x+drone.vx*elapsed,drone.y+drone.vy*elapsed,when,forecast);
      continue;
    }
    if(body) {
      a.hp=0;a.impact={x:a.x,y:a.y,targetId:body.id,name:body.name,time:when};
      if(!forecast){
        burst(w,a.x,a.y,body.planet?a.team:'star');
        if(body.planet){
          const p=body.planet;p.hp=Math.max(0,p.hp-a.damage);
          announce(w,`${p.name} impact`,`${a.damage} colony damage.`,p.team==='player');
          if(a.team==='player'&&p.team!=='player')w.progress.impact=true;
        }
      }
      continue;
    }
    let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    if(d<1e-9){dx=1;dy=0;d=1;}
    const nx=dx/d,ny=dy/d,ma=a.mass||2,mb=b.mass||2,invA=1/ma,invB=1/mb;
    const penetration=Math.max(0,a.radius+b.radius-Math.hypot(b.x-a.x,b.y-a.y))+.00001;
    a.x-=nx*penetration*invA/(invA+invB);a.y-=ny*penetration*invA/(invA+invB);
    b.x+=nx*penetration*invB/(invA+invB);b.y+=ny*penetration*invB/(invA+invB);
    const closing=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
    if(closing<=1e-9)continue;
    // Normal collision energy per combined mass: tangential motion glances off.
    const energy=.5*(ma*mb/(ma+mb))*closing*closing/(ma+mb);
    const smashed=energy>=settings.strength;
    const contact={a:a.id,b:b.id,time:when,kind:smashed?'smash':'deflect',
      x:(a.x*mb+b.x*ma)/(ma+mb),y:(a.y*mb+b.y*ma)/(ma+mb),
      positions:{[a.id]:{x:a.x,y:a.y},[b.id]:{x:b.x,y:b.y}}};
    w.rockContacts.push(contact);
    if(smashed){a.hp=0;b.hp=0;}
    else {
      const impulse=(1+settings.bounce)*closing/(invA+invB);
      a.vx-=impulse*invA*nx;a.vy-=impulse*invA*ny;
      b.vx+=impulse*invB*nx;b.vy+=impulse*invB*ny;
      a.launched=true;b.launched=true;a.deflected=true;b.deflected=true;
      a.boosterTeam=null;b.boosterTeam=null;
    }
    if(!forecast){
      if(smashed)burst(w,contact.x,contact.y,'neutral');
      announce(w,smashed?'Rocks shattered':'Rock deflection',`${a.name} / ${b.name}${smashed?' / harmless debris':''}`);
    }
  }
  for(const r of rocks) {
    if(r.hp>0 && isBeltRock(r) && railEnds.has(r.id))Object.assign(r,railEnds.get(r.id));
    if(Math.hypot(r.x,r.y)>2800)r.hp=0;
  }
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
          if (!rock.launched) { rock.team = 'neutral'; rock.color = null; rock.practice = false; }
        }
        if (!rock || rock.hp <= 0) u.hp = 0;
        u.attachedRockId = null; u.attachOffset = null;
      } else {
        u.x = rock.x + u.attachOffset.x; u.y = rock.y + u.attachOffset.y;
        u.vx = rock.vx; u.vy = rock.vy;
        if (rock.launched && rock.burn?.remaining === 0) {
          const departure = u.departureOrder;
          if (!setOrder(w, u.id, departure || { kind: 'detach' }, u.team)) setOrder(w, u.id, { kind: 'detach' }, u.team);
          if (!forecast && u.team === 'player') announce(w, `${u.name} detached`, departure ? 'Burn complete. Following departure order; the rock is coasting.' : 'Burn complete. Booster awaiting orders; the rock is coasting.');
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
        target.boosterTeam = u.team; target.team = u.team; target.color = u.color; target.practice = !!u.practice; target.boosterId = u.id;
        u.attachedRockId = target.id; u.attachOffset = { x: u.x - target.x, y: u.y - target.y };
        u.vx = target.vx; u.vy = target.vy; u.attachProgress = 0;
        u.order = { kind: 'attached', targetId: target.id };
        if (u.team === 'player') w.progress.prepared = true;
        if (!forecast) announce(w, u.team === 'player' ? `${target.name} ready to launch` : 'Enemy asteroid armed', u.team === 'player' ? 'Booster attached and waiting. Select the rock and right-click to aim, or choose Detach.' : 'A booster has attached. Destroy it or the rock before launch.', u.team === 'enemy');
      }
    } else if (u.order.kind === 'rearm') {
      if (!target || target.hp <= 0 || target.team !== u.team) { u.rearmProgress = 0; continue; }
      const docked = distance(u, target) < target.radius + 65 && Math.hypot(u.vx - target.vx, u.vy - target.vy) < 3;
      u.rearmProgress = docked ? u.rearmProgress + dt : 0;
      if (u.rearmProgress >= REARM_TIME) {
        u.loaded = true; u.rearmProgress = 0; u.order = { kind: 'defend', targetId: target.id };
        if(!forecast && w.lesson?.returnBoosterId===u.id)w.lesson.refuelled=true;
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
    target.lastDamageAt=w.time;
    if (w.lesson?.phase === 'combat' && w.lesson.attackerId === u.id && w.lesson.targetId === target.id && u.order.kind === 'attack') w.lesson.attackHit = true;
    u.fireTimer = u.cooldown;
    w.effects.push({ type: 'shot', x: u.x, y: u.y, tx: target.x, ty: target.y, team: u.team, color: u.color, tier: u.tier, born: w.time, life: .45 });
    if (target.hp <= 0) {
      burst(w, target.x, target.y, target.team);
      if (target.type === 'rock') {
        if (w.lesson?.phase === 'defense' && target.id === w.lesson.rockId && u.team === 'player') w.lesson.finalIntercepted = true;
        if (u.team === 'player' && target.team !== 'player') w.progress.intercepted = true;
        announce(w, 'Asteroid intercepted', 'The debris is harmless.');
      }
    }
  }
}
// Numerical shooting uses the same gravity integrator as live rocks.
export function aimRock(w, rock, target, flightTime = 55, interceptPoint = null) {
  const future = interceptPoint || planetAt(target, w.time + flightTime);
  let vx = (future.x - rock.x) / flightTime, vy = (future.y - rock.y) / flightTime;
  const endpoint = (ivx, ivy) => {
    let x = rock.x, y = rock.y;
    const ax = (ivx - rock.vx) / BURN_TIME, ay = (ivy - rock.vy) / BURN_TIME;
    ivx = rock.vx; ivy = rock.vy;
    const planets = w.planets.map(p => ({ ...p }));
    for (let t = 0; t < flightTime - DT / 2; t += DT) {
      for (const p of planets) Object.assign(p, planetAt(p, w.time + t));
      const g = gravity(x, y, planets, w.gravity), fraction = Math.max(0, Math.min(DT, BURN_TIME - t)) / DT;
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
export function aimedContact(forecast, targetId) {
  return forecast?.collisions?.find(c=>c.otherId===targetId) || (forecast?.impact?.targetId===targetId ? forecast.impact : null);
}
export function planRockIntercept(w, rock, target, offset = 0) {
  offset=clamp(offset,-.9,.9);
  const fallback={id:rock.id,impulse:{x:0,y:0},aim:{targetId:target?.id,targetType:'rock',offset,verified:false,horizon:120,reason:'No verified rock intercept found within 120 seconds and the boost limit.'}};
  if(!target || target.type!=='rock' || target.id===rock.id || target.hp<=0)return fallback;
  // Predict the target's actual rail/free flight once, without the launch rock
  // waiting on its old rail. Planetary gravity and other collisions still apply.
  const track=structuredClone(w);track.units=track.units.filter(u=>u.id!==rock.id && u.id!==rock.boosterId);
  let best=fallback,closest=Infinity;
  let predictedSteps=0;
  for(const time of [15,25,35,45,60,75,90,105,120]) {
    const steps=Math.round(time/DT);
    while(predictedSteps<steps){advanceMotion(track,DT,true);predictedSteps++;}
    const moving=entity(track,target.id);if(!moving)break;
    const future={time,x:moving.x,y:moving.y,vx:moving.vx,vy:moving.vy};
    // Offset perpendicular to relative approach, expressed in combined radii.
    const dx=(future.x-rock.x)/future.time-future.vx,dy=(future.y-rock.y)/future.time-future.vy;
    const length=Math.hypot(dx,dy)||1,side=offset*(rock.radius+target.radius);
    const point={x:future.x-dy/length*side,y:future.y+dx/length*side};
    const impulse=aimRock(w,rock,target,future.time,point),magnitude=Math.hypot(impulse.x,impulse.y);
    if(!Number.isFinite(magnitude))continue;
    const scale=Math.min(1,MAX_IMPULSE/(magnitude||1));
    const horizon=time>90?120:90;
    const pending={id:rock.id,impulse:{x:impulse.x*scale,y:impulse.y*scale},aim:{...fallback.aim,flightTime:future.time,horizon}};
    const flight=predict(w,[rock.id],pending,horizon,false).get(rock.id),contact=aimedContact(flight,target.id);
    if(contact){pending.aim.verified=true;pending.aim.flightTime=contact.time;pending.aim.kind=contact.kind;delete pending.aim.reason;return pending;}
    if(flight?.closest<closest){closest=flight.closest;best=pending;}
  }
  best.aim.horizon=120;
  return best;
}
export function planRockTarget(w, rock, target, offset = 0) {
  if(target?.type==='rock')return planRockIntercept(w,rock,target,offset);
  // Search a small set of arrival windows, then verify with the actual preview
  // integrator, including the burn, impulse cap, moving bodies and collisions.
  let best = null, closest = Infinity;
  for (const flightTime of [30, 45, 60, 75, 90, 105, 120]) {
    const requested = aimRock(w, rock, target, flightTime);
    const magnitude = Math.hypot(requested.x, requested.y);
    if (!Number.isFinite(magnitude)) continue;
    const scale = Math.min(1, MAX_IMPULSE / (magnitude || 1));
    const pending = { id: rock.id, impulse: { x: requested.x * scale, y: requested.y * scale },
      aim: { targetId: target.id, flightTime, verified: false, horizon: flightTime>90?120:90 } };
    const f = predict(w, [rock.id], pending, pending.aim.horizon, false).get(rock.id);
    if (f?.impact?.targetId === target.id) {
      pending.aim.verified = true; pending.aim.flightTime = f.impact.time;
      return pending;
    }
    if (f && f.closest < closest) {
      closest = f.closest; best = pending;
      pending.aim.reason = f.impact ? `Trajectory hits ${f.impact.name} first.` : 'No verified impact found within 120 seconds and the boost limit.';
    }
  }
  if(best)best.aim.horizon=120;
  return best || { id: rock.id, impulse: { x: 0, y: 0 }, aim: { targetId: target.id, flightTime: 120, horizon:120, verified: false, reason: 'No verified launch solution within 120 seconds.' } };
}
export function enemyLaunch(w, practice = false) {
  const home = w.planets.find(p => p.team === 'player');
  if (!home || home.hp <= 0 || (!practice && w.metal.enemy < COST.rock)) return false;
  const future = planetAt(home, w.time + 60);
  const candidates = w.units.filter(u => u.type === 'rock' && !u.tutorialStaged && !u.launched && u.hp > 0 && u.boosterTeam === 'enemy' && (!practice || u.practice)).sort((a, b) => distance(a, future) - distance(b, future));
  for (const r of candidates.slice(0, 4)) {
    const impulse = aimRock(w, r, home, 60);
    if (Math.hypot(impulse.x, impulse.y) > MAX_IMPULSE) continue;
    const test = predict(w, [r.id], { id: r.id, impulse, team: 'enemy' }, 70, false);
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
  if (w.ai.disabled) return;
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
  if(w.mode==='skirmish' && w.time>=(w.ai.upgradeAt||150)){
    w.ai.upgradeAt=w.time+70;
    const candidate=fleet(w,'enemy').find(u=>UPGRADES[u.type] && u.tier!==2 && w.metal.enemy>=UPGRADES[u.type].cost+35);
    if(candidate)upgradeUnit(w,candidate.id,'enemy');
  }
  if (w.time >= w.ai.buildAt) {
    w.ai.buildAt += 58;
    const counts = fleet(w, 'enemy');
    const type = !counts.some(u => u.type === 'booster') ? 'booster' : w.mode==='skirmish' && w.time>=100 && !counts.some(u=>u.type==='miner') ? 'miner' : counts.filter(u => u.type === 'ship').length < 3 ? 'ship' : counts.filter(u => u.type === 'drone').length < 2 ? 'drone' : 'platform';
    spawn(w, type, 'enemy', home);
  }
  if(w.mode==='skirmish')for(const miner of fleet(w,'enemy').filter(u=>u.type==='miner'&&((u.miningRockId && !(entity(w,u.miningRockId)?.metalRemaining>0))||(!u.miningRockId&&u.order.kind!=='mine')))){
    const rock=w.units.filter(u=>u.type==='rock'&&u.hp>0&&u.metalRemaining>0&&!u.launched&&!u.minerId&&(!u.boosterTeam||u.boosterTeam==='enemy')&&!w.units.some(m=>m.hp>0&&m.type==='miner'&&m.order.kind==='mine'&&m.order.targetId===u.id)).sort((a,b)=>distance(miner,a)-distance(miner,b))[0];
    if(rock)setOrder(w,miner.id,{kind:'mine',targetId:rock.id},'enemy');
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
// Sparse natural visitors, independent of faction budgets and camera position.
export function updateVisitors(w) {
  if(w.mode!=='skirmish' || !w.visitors || w.outcome)return;
  w.units=w.units.filter(u=>!u.visitor || u.hp>0 || w.time-u.arrivedAt<300);
  const event=w.visitors;
  if(w.time<event.nextAt)return;
  const random=()=>{event.seed=(Math.imul(event.seed,1664525)+1013904223)>>>0;return event.seed/4294967296;};
  event.nextAt=w.time+100+random()*60;
  if(w.units.filter(u=>u.visitor && u.hp>0).length>=2)return;
  for(let attempt=0;attempt<8;attempt++) {
    const angle=random()*Math.PI*2, offset=(240+random()*460)*(random()<.5?-1:1), speed=18+random()*8;
    const radius=BELT_INNER+BELT_WIDTH+430, along=Math.sqrt(radius*radius-offset*offset);
    const radial={x:Math.cos(angle),y:Math.sin(angle)};
    const draft=structuredClone(w);draft.units=[];
    const rock=addRock(draft,angle,radius,`VISITOR ${String(event.count+1).padStart(2,'0')}`,random()<.7?'small':'medium');
    Object.assign(rock,{x:radial.x*along-radial.y*offset,y:radial.y*along+radial.x*offset,
      vx:-radial.x*speed,vy:-radial.y*speed,launched:true,visitor:true,arrivedAt:w.time});
    delete rock.beltOrbit;delete rock.beltOmega;delete rock.beltPhase;
    // Screen the complete gravity-driven crossing, not just a straight chord.
    // Belt collisions and player interventions can still change the actual route.
    const flight=predict(draft,[rock.id],null,200,false).get(rock.id);
    const minRadius=Math.min(...flight.points.map(p=>Math.hypot(p.x,p.y)));
    const last=flight.points.at(-1), enters=flight.points.find(p=>Math.hypot(p.x,p.y)<=BELT_INNER);
    if(!enters || minRadius<100 || flight.impact?.targetId==='star' || (!flight.impact && Math.hypot(last.x,last.y)<radius))continue;
    rock.beltArrivalAt=w.time+enters.t;
    w.serial=draft.serial;w.units.push(rock);event.count++;
    w.threatScanAt=0;
    announce(w,'Natural asteroid approaching',`${rock.name}: oblique crossing, reaches the belt in ~${Math.ceil(enters.t)}s. Neutral rock; either colony may be threatened.`,true);
    return rock;
  }
  // Extreme gravity may leave no suitable crossing. Try again later, never force a sun shot.
  event.nextAt=w.time+30;
}
export function step(w, dt = DT) {
  if (w.outcome && !w.continueSandbox) return;
  updateVisitors(w);
  scanRockThreats(w);
  advanceMotion(w, dt);
  for (const p of w.planets) if (p.hp > 0 && p.team !== 'neutral') w.metal[p.team] = Math.min(999, w.metal[p.team] + .4 * dt);
  combat(w, dt); repairShips(w,dt); updateBoosters(w, 0, true); updateMiners(w,0,true); ai(w);
  w.effects = w.effects.filter(e => w.time - e.born < e.life);
  // Sandbox keeps simulating after colony loss; destruction and costs still apply.
  if (w.mode === 'sandbox' || w.scenario === 'playground') return;
  const home = w.planets.find(p => p.team === 'player');
  if (home.hp <= 0) w.outcome = 'defeat';
  else if (w.scenario === 'neighbors' && w.planets.find(p => p.team === 'enemy').hp <= 0) w.outcome = 'victory';
  else if (w.scenario === 'hold' && w.time >= w.duration) w.outcome = 'victory';
  // Guided completion belongs to advanceTutorial after the final assault.
  // Free Garden also requires colony destruction, never just launch/intercept flags.
  else if (w.scenario === 'garden' && !w.lesson && !w.continueSandbox && w.planets.find(p => p.id === 'ochre')?.hp <= 0) w.outcome = 'victory';
}
export function predict(world, ids, pending = null, horizon = pending?.aim?.horizon || 90, interceptors = true) {
  if (!ids.length || !ids.some(id=>entity(world,id))) return new Map();
  const w = structuredClone(world);
  // Aiming must allow a defended target. Displayed previews still include rams.
  w.ignoreDroneContacts=!interceptors;
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
      ballistic: u.type === 'rock' && !u.burn?.remaining, powered: !!u.burn?.remaining, ended: !!u.miningRockId || (!!u.attachedRockId && !burningRock?.burn?.remaining) });
  }
  const iterations = Math.round(horizon / DT);
  for (let n = 1; n <= iterations; n++) {
    if ([...results.values()].every(result=>result.ended || result.impact)) break;
    advanceMotion(w, DT, true);
    for(const contact of w.rockContacts||[]) {
      if(!results.has(contact.a)&&!results.has(contact.b))continue;
      for(const id of [contact.a,contact.b]) {
        if(!results.has(id))results.set(id,{points:[],eta:null,closest:Infinity,impact:null,ghost:null,ballistic:true,secondary:true});
        const result=results.get(id),pos=contact.positions[id];
        result.points.push({...pos,t:contact.time-start});
        result.collisions||=[];
        result.collisions.push({x:contact.x,y:contact.y,time:contact.time-start,kind:contact.kind,otherId:id===contact.a?contact.b:contact.a});
        if(pending?.aim?.targetType==='rock' && id===pending.id && [contact.a,contact.b].includes(pending.aim.targetId)){
          const target=w.units.find(u=>u.id===pending.aim.targetId);
          result.ghost={...contact.positions[target.id],radius:target.radius,name:target.name};
        }
        if(contact.kind==='smash')result.ended=true;
      }
    }
    for (const [id, result] of results) {
      const u = w.units.find(e => e.id === id);
      if (!u || result.impact || result.ended) continue;
      if (u.impact) { result.impact = { ...u.impact, time: u.impact.time - start }; result.points.push({ x: u.x, y: u.y, t: w.time - start }); }
      if (u.hp <= 0) { result.ended = true; continue; }
      if (u.miningRockId || (u.attachedRockId && !entity(w, u.attachedRockId)?.burn?.remaining)) {
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
        target = pending?.id === u.id && pending.aim?.targetId ? entity(w, pending.aim.targetId) : targets.sort((a, b) => distance(a, u) - distance(b, u))[0];
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
