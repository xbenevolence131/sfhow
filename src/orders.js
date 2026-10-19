import { entity, MAX_IMPULSE } from './simulation.js';

// One mapping drives both cursor hints and right-click actions.
export function contextualOrder(w, selectedId, target, point) {
  const u = entity(w, selectedId);
  const unavailable = label => ({ label, error: label });
  if (!u) return unavailable('Select a unit or equipped rock first');
  if (u.team !== 'player') return unavailable('Select one of your units');
  if (u.type === 'rock') {
    if(target?.attachedRockId)target=entity(w,target.attachedRockId)||target;
    if (u.launched) return unavailable('Rock is already in flight');
    const booster = entity(w, u.boosterId);
    if (u.boosterTeam !== 'player' || !booster?.loaded || booster.attachedRockId !== u.id) return unavailable('Attach a loaded booster first');
    if (target?.type === 'planet') return { label: `Target ${target.name}`, rockTargetId: target.id, id: u.id };
    if (target?.type === 'rock' && target.id!==u.id && target.hp>0) return { label: `Intercept ${target.name}`, rockTargetId: target.id, id: u.id };
    if (target && target.id !== u.id) return unavailable('Aim at a planet, another rock, or empty space');
    let x = (point.x - u.x) / 10, y = (point.y - u.y) / 10;
    const scale = Math.min(1, MAX_IMPULSE / (Math.hypot(x, y) || 1));
    return { label: 'Aim launch', pending: { id: u.id, impulse: { x: x * scale, y: y * scale } } };
  }
  if (u.type === 'planet') return unavailable('Choose a unit to deploy at your colony');
  if (u.type === 'platform') return unavailable('Platform defends its local orbit');
  if (target?.hp <= 0) return unavailable('Target has been destroyed');
  if (target?.id === u.id) return unavailable('Choose another target or empty space');
  const order = (label, kind) => ({ label: u.attachedRockId ? `${entity(w, u.attachedRockId)?.burn?.remaining > 0 ? 'After burn' : 'Detach'} / ${label}` : label, pending: { id: u.id, order: target ? { kind, targetId: target.id } : { kind, ...point } } });
  const friendly = target?.team === u.team;
  const anchor = friendly && ['planet', 'platform'].includes(target.type);
  if (u.type === 'drone') return anchor ? order('Defend', 'defend') : unavailable('Drones defend friendly planets or platforms');
  if(u.type==='miner'){
    if(target?.type==='rock'){
      if(target.launched || (target.boosterTeam && target.boosterTeam!==u.team))return unavailable('Choose an idle asteroid without an enemy booster');
      if(!(target.metalRemaining>0))return unavailable('Asteroid depleted / choose another rock');
      if(target.minerId && target.minerId!==u.id && entity(w,target.minerId))return unavailable('This asteroid already has a miner');
      return order('Mine asteroid','mine');
    }
    if(friendly && target.type==='planet')return order('Return home','defend');
    if(target?.team==='enemy')return unavailable('Miner is unarmed / escort it with a warship');
    return order('Move','move');
  }
  if (u.type === 'booster') {
    if (target?.type === 'rock') {
      if (!u.loaded) return unavailable('Return home to reload first');
      if (target.launched || target.boosterTeam) return unavailable('Choose a free, unlaunched rock');
      return order('Attach booster', 'fit');
    }
    if (friendly && target.type === 'planet') return order('Return and reload', 'rearm');
    if (target?.team === 'enemy') return unavailable('Booster is unarmed / choose a combat ship');
    return order('Move', 'move');
  }
  if (u.type === 'ship') {
    if (target?.team === 'enemy') return order('Attack', 'attack');
    if (anchor) return order(target.type==='planet'?'Defend':'Escort', 'defend');
    if (friendly && ['ship', 'booster', 'miner', 'drone', 'rock'].includes(target.type)) return order('Escort', 'defend');
    return order('Move', 'move');
  }
  return unavailable('No movement order available');
}
