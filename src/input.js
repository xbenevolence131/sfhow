import { entity, distance, MAX_IMPULSE } from './simulation.js';
export function attachInput(game) {
  const { renderer: r, canvas } = game;
  let drag = null;
  const point = e => ({ x: e.clientX, y: e.clientY });
  const pick = p => {
    const w = game.world;
    return [...w.units.filter(u => u.hp > 0), ...w.planets].map(u => ({ u, d: distance(r.screen(u), p), radius: Math.max(15, u.radius * r.camera.zoom + 6) }))
      .filter(o => o.d <= o.radius).sort((a, b) => a.d - b.d)[0]?.u;
  };
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (game.modalOpen()) return;
    const u = entity(game.world, game.ui.selectedId);
    if (!u || u.team !== 'player' || !['ship', 'drone', 'booster'].includes(u.type)) { game.toast('Select a friendly ship, booster, or drone first.'); return; }
    if (u.attachedRockId) { game.toast(entity(game.world, u.attachedRockId)?.burn?.remaining > 0 ? 'Booster firing. It will detach automatically when the burn ends.' : 'This booster is attached. Choose Detach before giving it a new destination.'); return; }
    const target = pick(point(e));
    const friendlyAnchor = target?.team === 'player' && ['planet', 'platform'].includes(target.type);
    if (u.type === 'drone' && !friendlyAnchor) { game.toast('Drones defend a friendly planet or platform. Right-click one to assign it.'); return; }
    let order;
    if (u.type === 'booster' && target?.type === 'rock') {
      if (!u.loaded) { game.toast('This booster ship is empty. Let it return home to rearm.'); return; }
      if (target.launched || target.boosterTeam) { game.toast('Choose an unlaunched rock with no booster attached.'); return; }
      order = { kind: 'fit', targetId: target.id };
    } else if (u.type === 'booster' && target?.team === 'enemy') { game.toast('Booster ships are unarmed. Use a combat ship to intercept enemies.'); return; }
    else if (u.type === 'booster' && friendlyAnchor && target.type === 'planet') order = { kind: 'rearm', targetId: target.id };
    else if (u.type === 'ship' && target?.team === 'player' && target.type === 'booster') order = { kind: 'defend', targetId: target.id };
    else if ((e.shiftKey || u.type === 'drone') && friendlyAnchor) order = { kind: 'defend', targetId: target.id };
    else if (target && target.id !== u.id) order = { kind: target.team === 'enemy' ? 'attack' : 'move', targetId: target.id };
    else order = { kind: 'move', ...r.world(point(e)) };
    game.plan({ id: u.id, order });
  });
  canvas.addEventListener('pointerdown', e => {
    if (game.modalOpen() || e.button === 2) return;
    const p = point(e), target = pick(p);
    canvas.setPointerCapture(e.pointerId);
    if (e.button === 1 || !target) { drag = { kind: 'pan', start: p, last: p, moved: false }; canvas.style.cursor = 'grabbing'; return; }
    game.select(target.id);
    if (target.type === 'rock' && !target.launched && target.boosterTeam === 'player') drag = { kind: 'rock', id: target.id, start: p, moved: false };
  });
  canvas.addEventListener('pointermove', e => {
    const p = point(e);
    if (drag) {
      if (distance(p, drag.start) > 4) drag.moved = true;
      if (drag.kind === 'pan') {
        r.camera.x -= (p.x - drag.last.x) / r.camera.zoom; r.camera.y -= (p.y - drag.last.y) / r.camera.zoom; drag.last = p;
      } else if (drag.moved) {
        const rock = entity(game.world, drag.id); if (!rock) return;
        const worldPoint = r.world(p);
        let x = (worldPoint.x - rock.x) / 10, y = (worldPoint.y - rock.y) / 10;
        const mag = Math.hypot(x, y); if (mag > MAX_IMPULSE) { x *= MAX_IMPULSE / mag; y *= MAX_IMPULSE / mag; }
        game.plan({ id: rock.id, impulse: { x, y } }, true);
      }
      return;
    }
    const target = pick(p); game.ui.hoverId = target?.id || null; canvas.style.cursor = target ? target.type === 'rock' && !target.launched && target.boosterTeam === 'player' ? 'grab' : 'pointer' : 'default';
  });
  const endDrag = e => { if (drag?.kind === 'rock' && drag.moved) game.refreshPredictions(); drag = null; canvas.style.cursor = 'default'; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', e => { e.preventDefault(); if (!game.modalOpen()) r.zoomAt(point(e), Math.exp(-e.deltaY * .001)); }, { passive: false });
  window.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName) && !['Escape', ' '].includes(e.key)) return;
    if (game.modalOpen()) return;
    if (e.key === ' ') { e.preventDefault(); game.togglePause(); }
    if (e.key === 'Enter') game.confirm();
    if (e.key === 'Escape') game.cancel();
    if (e.key.toLowerCase() === 'f') r.fit();
    if (['1', '2', '3'].includes(e.key)) game.setSpeed({ 1: 1, 2: 5, 3: 20 }[e.key]);
  });
}
