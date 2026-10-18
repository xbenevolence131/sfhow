// Opt-in, game-only instrumentation. Normal and offline play do not record anything.
export function attachPlaytestRecorder(game) {
  if (new URLSearchParams(location.search).get('playtest') !== '1') return null;
  const retention = 120000, startedAt = Date.now();
  const events = [];
  let sequence = 0, recording = true, lastMove = 0, lastGameEvent = 0, scenarioRun = 1;
  let cursor = { x: null, y: null, inside: false, buttons: 0 };
  const clone = value => value === undefined ? null : structuredClone(value);
  const selected = () => game.world.units.find(u => u.id === game.ui.selectedId && u.hp > 0) || game.world.planets.find(p => p.id === game.ui.selectedId) || null;
  const controls = () => ({
    scenario: game.world.scenario, mode: game.world.mode, setup: clone(game.world.setup), scenarioRun, time: game.world.time, paused: game.paused, speed: game.speed,
    selectedId: game.ui.selectedId, hoverId: game.ui.hoverId, pending: clone(game.ui.pending), order: clone(selected()?.order),
    metal: clone(game.world.metal), gravity: clone(game.world.gravity), units: game.world.units.filter(u => u.hp > 0).length,
    modal: game.modalOpen(), outcome: game.world.outcome,
  });
  const append = (type, data = {}) => {
    if (!recording) return;
    const now = Date.now();
    events.push({ seq: ++sequence, at: now, elapsed: now - startedAt, scenarioRun, simTime: game.world.time, type, ...data });
    while (events.length && (events[0].at < now - retention || events.length > 2400)) events.shift();
  };
  const describe = target => {
    const element = target instanceof Element ? target.closest('button,input,select,a,canvas') || target : null;
    if (!element) return null;
    return { tag: element.tagName.toLowerCase(), id: element.id || null, label: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 100),
      build: element.dataset.build || null, order: element.dataset.order || null,
      disabled: !!element.disabled, value: element.matches('select,input') ? element.value : undefined };
  };
  const onGameUI = e => !e.target.closest?.('#playtest-toolbar');
  const moveCursor = e => {
    cursor = { x: e.clientX, y: e.clientY, inside: true, buttons: e.buttons };
    cursorNode.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    cursorNode.hidden = !recording;
    cursorNode.classList.toggle('pressed', !!e.buttons);
  };
  const toolbar = document.createElement('div'); toolbar.id = 'playtest-toolbar';
  toolbar.innerHTML = '<span id="playtest-status">● SHARED PLAYTEST · RECORDING</span><button id="playtest-mark" title="Preserve this moment and its recent history (M)">Mark moment</button><button id="playtest-toggle">Pause recording</button>';
  const cursorNode = document.createElement('div'); cursorNode.id = 'playtest-cursor'; cursorNode.hidden = true;
  document.body.append(toolbar, cursorNode);
  const mark = (label = 'Player marked this moment') => {
    if (!recording) return false;
    append('bookmark', { label, state: controls() });
    game.toast('Moment marked. Tell me what happened; the recent history will be preserved.');
    return true;
  };
  const setRecording = enabled => {
    if (recording === enabled) return;
    if (!enabled) append('recording-paused');
    recording = enabled;
    if (enabled) append('recording-resumed');
    document.getElementById('playtest-status').textContent = enabled ? '● SHARED PLAYTEST · RECORDING' : '○ SHARED PLAYTEST · RECORDING PAUSED';
    document.getElementById('playtest-toggle').textContent = enabled ? 'Pause recording' : 'Resume recording';
    document.getElementById('playtest-mark').disabled = !enabled;
    cursorNode.hidden = !enabled || !cursor.inside;
  };
  document.getElementById('playtest-mark').onclick = () => mark();
  document.getElementById('playtest-toggle').onclick = () => setRecording(!recording);
  document.addEventListener('pointermove', e => {
    moveCursor(e);
    if (Date.now() - lastMove < 100 || !onGameUI(e)) return;
    lastMove = Date.now();
    append('pointermove', { cursor: clone(cursor), target: describe(e.target), worldPoint: e.target === game.canvas ? game.renderer.world(cursor) : null });
  }, true);
  for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click', 'contextmenu', 'wheel', 'change']) {
    document.addEventListener(type, e => {
      if (!onGameUI(e)) return;
      if (typeof e.clientX === 'number') moveCursor(e);
      const data = { target: describe(e.target), cursor: clone(cursor), button: e.button, deltaY: e.deltaY,
        modifiers: { shift: !!e.shiftKey, control: !!e.ctrlKey, alt: !!e.altKey, meta: !!e.metaKey },
        worldPoint: e.target === game.canvas ? game.renderer.world(cursor) : null,
        before: controls(), trusted: e.isTrusted };
      append(type, data);
      // Runs after the game's synchronous handlers, exposing accepted/ignored input.
      if (['click', 'contextmenu', 'change', 'pointerup'].includes(type)) queueMicrotask(() => append('input-result', { input: type, target: data.target, after: controls() }));
    }, true);
  }
  document.addEventListener('keydown', e => {
    if (e.target.closest?.('#playtest-toolbar')) return;
    if (e.key.toLowerCase() === 'm' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) { mark(); return; }
    // Record game shortcuts only, not arbitrary typed text.
    if ([' ', 'Enter', 'Escape', '1', '2', '3', 'f', 'F'].includes(e.key)) append('keydown', { key: e.key, target: describe(e.target), before: controls() });
  }, true);
  document.addEventListener('pointerout', e => { if (!e.relatedTarget) { cursor.inside = false; cursorNode.hidden = true; } }, true);
  document.addEventListener('visibilitychange', () => append('visibility', { hidden: document.hidden }));
  window.addEventListener('error', e => append('error', { message: e.message, source: e.filename, line: e.lineno }));
  window.addEventListener('unhandledrejection', e => append('error', { message: String(e.reason) }));
  for (const name of ['select', 'plan', 'confirm', 'cancel', 'build', 'setSpeed', 'togglePause', 'load', 'showOutcome', 'toast', 'tuneGravity']) {
    const original = game[name];
    game[name] = function (...args) {
      const before = recording ? controls() : null;
      const result = original.apply(this, args);
      if (name === 'load') { scenarioRun++; lastGameEvent = 0; }
      if (recording) {
        const after = controls();
        let accepted = null;
        if (name === 'confirm') accepted = !!before.pending && !after.pending;
        if (name === 'plan') accepted = JSON.stringify(after.pending) === JSON.stringify(args[0]);
        if (name === 'build') accepted = after.units > before.units;
        if (name === 'select') accepted = after.selectedId === args[0];
        if (name === 'togglePause') accepted = before.paused !== after.paused;
        append(name === 'toast' ? 'feedback' : 'action', name === 'toast' ? { message: args[0] } : { action: name, args: clone(args), accepted, before, after });
      }
      return result;
    };
  }
  const inspect = () => {
    if (!recording) return { recording: false, startedAt, lastSequence: sequence };
    for (const e of game.world.events) if (e.id > lastGameEvent) { append('game-event', { event: clone(e) }); lastGameEvent = e.id; }
    return {
      recording, startedAt, capturedAt: Date.now(), lastSequence: sequence,
      cursor: clone(cursor), controls: controls(), camera: clone(game.renderer.camera),
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, hidden: document.hidden },
      selected: clone(selected()), world: clone(game.world),
      ui: { selection: document.getElementById('selection').innerText,
        alerts: document.getElementById('alerts').innerText,
        toast: document.getElementById('toast').classList.contains('visible') ? document.getElementById('toast').innerText : '',
        modal: !document.getElementById('new-game-modal').classList.contains('hidden') ? document.getElementById('new-game-modal').innerText : game.modalOpen() ? document.getElementById('modal').innerText : '',
        plan: game.ui.pending ? document.getElementById('plan').innerText : '' },
    };
  };
  const recorder = { inspect, mark, setRecording, isRecording: () => recording,
    eventsSince: seq => clone(events.filter(e => e.seq > seq)) };
  window.orbitalPlaytest = recorder;
  append('session-start', { state: controls() });
  return recorder;
}
