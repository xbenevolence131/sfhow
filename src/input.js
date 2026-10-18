import { entity, distance, MAX_IMPULSE, planRockTarget } from './simulation.js';
import { contextualOrder } from './orders.js';
export function attachInput(game) {
  const { renderer: r, canvas } = game;
  let drag = null, pointer = null;
  const point = e => ({ x: e.clientX, y: e.clientY });
  const pick = p => {
    const w = game.world;
    return [...w.units.filter(u => u.hp > 0), ...w.planets].map(u => ({ u, d: distance(r.screen(u), p), radius: Math.max(15, u.radius * r.camera.zoom + 6) }))
      .filter(o => o.d <= o.radius).sort((a, b) => a.d - b.d)[0]?.u;
  };
  const hint = document.getElementById('cursor-action');
  game.updateContextHint = () => {
    const visible = pointer && !drag && !game.modalOpen() && game.ui.selectedId;
    hint.classList.toggle('hidden', !visible);
    if (!visible) return;
    const action = contextualOrder(game.world, game.ui.selectedId, pick(pointer), r.world(pointer));
    const text = `${action.error ? '' : 'Right-click / '}${action.label}`;
    if (hint.textContent !== text) hint.textContent = text;
    hint.classList.toggle('unavailable', !!action.error);
    hint.style.left = `${Math.max(8, Math.min(pointer.x + 17, innerWidth - hint.offsetWidth - 8))}px`;
    hint.style.top = `${Math.max(8, Math.min(pointer.y + 20, innerHeight - hint.offsetHeight - 8))}px`;
  };
  canvas.addEventListener('pointerleave', () => { pointer = null; game.ui.hoverId = null; game.updateContextHint(); });
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (game.modalOpen()) return;
    const p = point(e), target = pick(p);
    const action = contextualOrder(game.world, game.ui.selectedId, target, r.world(p));
    if (action.error) { game.toast(action.error); return; }
    if (action.rockTargetId) {
      game.paused = true; game.accumulator = 0;
      const rock = entity(game.world, action.id);
      game.plan(planRockTarget(game.world, rock, target));
    } else game.plan(action.pending);
  });
  canvas.addEventListener('pointerdown', e => {
    if (game.modalOpen() || e.button === 2) return;
    const p = point(e), target = pick(p);
    canvas.setPointerCapture(e.pointerId);
    if (e.button === 1 || !target) { drag = { kind: 'pan', start: p, last: p, moved: false, clear: e.button === 0 && !target }; canvas.style.cursor = 'grabbing'; return; }
    const wasSelected = game.ui.selectedId === target.id;
    game.select(target.id);
    drag = { kind: target.type === 'rock' && !target.launched && target.boosterTeam === 'player' ? 'rock' : 'select', id: target.id, start: p, moved: false, clear: wasSelected };
  });
  canvas.addEventListener('pointermove', e => {
    const p = point(e); pointer = p;
    if (drag) {
      if (distance(p, drag.start) > 4) drag.moved = true;
      if (drag.kind === 'pan') {
        r.camera.x -= (p.x - drag.last.x) / r.camera.zoom; r.camera.y -= (p.y - drag.last.y) / r.camera.zoom; drag.last = p;
      } else if (drag.kind === 'rock' && drag.moved) {
        const rock = entity(game.world, drag.id); if (!rock) return;
        const worldPoint = r.world(p);
        let x = (worldPoint.x - rock.x) / 10, y = (worldPoint.y - rock.y) / 10;
        const mag = Math.hypot(x, y); if (mag > MAX_IMPULSE) { x *= MAX_IMPULSE / mag; y *= MAX_IMPULSE / mag; }
        game.plan({ id: rock.id, impulse: { x, y } }, true);
      }
      return;
    }
    game.updateContextHint();
    const target = pick(p); game.ui.hoverId = target?.id || null; canvas.style.cursor = target ? target.type === 'rock' && !target.launched && target.boosterTeam === 'player' ? 'grab' : 'pointer' : 'default';
  });
  const endDrag = e => {
    if (drag?.kind === 'rock' && drag.moved) game.refreshPredictions();
    else if (drag?.clear && !drag.moved && e.type !== 'pointercancel') game.select(null);
    drag = null; canvas.style.cursor = 'default';
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    game.updateContextHint();
  };
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
