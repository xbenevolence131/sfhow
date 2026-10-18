import { DT, CAP, COST, ATTACH_TIME, REARM_TIME, distance, entity, fleet, spawn, setOrder, launchRock, sendPracticeRock, scanRockThreats, predict, step } from './simulation.js';
import { createScenario, SCENARIOS } from './scenarios.js';
import { Renderer } from './render.js';
import { attachInput } from './input.js';
import { attachPlaytestRecorder } from './playtest.js';
const $ = id => document.getElementById(id);
const setText = (id, value) => { const node = $(id); if (node.textContent !== value) node.textContent = value; };
const time = seconds => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`;
const titleCase = text => text[0].toUpperCase() + text.slice(1);
class Game {
  constructor() {
    this.canvas = $('space'); this.renderer = new Renderer(this.canvas);
    this.ui = { selectedId: null, hoverId: null, pending: null, predictions: new Map(), baseline: null, ranges: false, allPaths: false };
    this.paused = true; this.speed = 1; this.accumulator = 0; this.lastFrame = performance.now();
    this.lastPreview = 0; this.previewDirty = true; this.lastUI = 0; this.seenEvent = 0; this.toastUntil = 0;
    this.bindUI(); this.load('garden'); attachInput(this);
    requestAnimationFrame(t => this.frame(t));
  }
  modalOpen() { return !$('modal').classList.contains('hidden'); }
  bindUI() {
    $('pause').onclick = () => this.togglePause();
    document.querySelectorAll('[data-speed]').forEach(button => button.onclick = () => this.setSpeed(Number(button.dataset.speed)));
    $('scenario').onchange = e => this.load(e.target.value);
    $('restart').onclick = () => this.load(this.world.scenario);
    $('fit').onclick = () => this.renderer.fit();
    document.querySelector('.wordmark').onclick = e => { e.preventDefault(); this.renderer.fit(); };
    $('trajectories').onchange = e => { this.ui.allPaths = e.target.checked; this.previewDirty = true; };
    $('ranges').onchange = e => { this.ui.ranges = e.target.checked; };
    $('confirm').onclick = () => this.confirm(); $('cancel').onclick = () => this.cancel();
    $('help').onclick = () => this.help();
    document.querySelectorAll('[data-build]').forEach(b => b.onclick = () => this.build(b.dataset.build));
    $('rock-tool').onclick = () => {
      const rocks = this.world.units.filter(u => u.type === 'rock' && !u.launched && u.hp > 0 && (!u.boosterTeam || u.boosterTeam === 'player')).sort((a, b) => Number(!!b.boosterTeam) - Number(!!a.boosterTeam));
      if (!rocks.length) { this.toast('No unlaunched rocks remain. Restart to reset the belt.'); return; }
      const current = rocks.findIndex(r => r.id === this.ui.selectedId);
      const rock = rocks[(current + 1) % rocks.length]; this.select(rock.id);
      const screen = this.renderer.screen(rock);
      if (screen.x < 30 || screen.y < 65 || screen.x > innerWidth - 30 || screen.y > innerHeight - 160) this.renderer.fit();
      this.toast(rock.boosterTeam === 'player' ? 'Booster attached. Drag this rock to aim, then confirm the launch.' : 'This rock needs a booster. Choose Send booster in its panel, then confirm the order.');
    };
    $('selection').onclick = e => {
      const action = e.target.closest('[data-order]')?.dataset.order;
      if (action === 'home') { this.select(this.world.planets.find(p => p.team === 'player').id); return; }
      const selected = entity(this.world, this.ui.selectedId); if (!selected) return;
      if (action === 'detach') {
        const booster = selected.type === 'rock' ? entity(this.world, selected.boosterId) : selected;
        if (booster?.attachedRockId) this.plan({ id: booster.id, order: { kind: 'detach' } });
        return;
      }
      if (action === 'aim') {
        this.select(selected.attachedRockId);
        this.toast('Drag the attached rock to aim, then confirm the launch.');
        return;
      }
      if (action === 'fit-rock' && selected.type === 'rock') {
        const booster = fleet(this.world, 'player').filter(u => u.type === 'booster' && u.loaded && !u.attachedRockId && u.order.kind !== 'fit').sort((a, b) => distance(a, selected) - distance(b, selected))[0];
        if (!booster) { this.toast('No loaded booster is available. Deploy one at your colony, or wait for rearming.'); return; }
        this.plan({ id: booster.id, order: { kind: 'fit', targetId: selected.id } });
      }
      if (action === 'stop') this.plan({ id: selected.id, order: { kind: 'stop', x: selected.x, y: selected.y } });
      if (action === 'defend') {
        const host = entity(this.world, selected.hostId) || this.world.planets.find(p => p.team === 'player');
        this.plan({ id: selected.id, order: { kind: selected.type === 'booster' ? 'rearm' : 'defend', targetId: host.id } });
      }
    };
    $('lesson').onclick = e => {
      if (!e.target.closest('#practice')) return;
      const result = sendPracticeRock(this.world);
      if (result.error) { this.toast(result.error); return; }
      this.previewDirty = true; this.processEvents(); this.updateUI();
      this.toast(this.paused ? 'Practice booster dispatched. Press Space to unpause; it must reach a rock and attach before launch.' : 'Practice booster dispatched. It will attach a booster before launching an incoming rock.');
    };
    window.addEventListener('resize', () => this.renderer.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.paused = true; this.accumulator = 0; this.updateUI(); } });
  }
  load(key) {
    this.world = createScenario(key); this.paused = true; this.speed = 1; this.accumulator = 0;
    this.seenEvent = 0; this.outcomeShown = false; this.ui.selectedId = this.world.planets[0].id;
    this.ui.hoverId = null; this.ui.pending = null; this.ui.predictions = new Map(); this.ui.baseline = null; this.previewDirty = true;
    this.toastUntil = 0; $('toast').classList.remove('visible'); this.renderer.fit(); $('scenario').value = key;
    this.showModal(SCENARIOS[key].kicker, SCENARIOS[key].name, SCENARIOS[key].body, 'Enter the system', () => {
      this.closeModal(); this.toast('The system is paused. Plan an order, or press Space to let time flow.');
    });
    this.updateUI();
  }
  showModal(kicker, title, body, action, onAction, secondary, onSecondary) {
    this.paused = true; this.accumulator = 0;
    $('modal-kicker').textContent = kicker; $('modal-title').textContent = title; $('modal-body').innerHTML = body;
    $('modal-action').textContent = action; $('modal-action').onclick = onAction;
    $('modal-secondary').classList.toggle('hidden', !secondary); $('modal-secondary').textContent = secondary || ''; $('modal-secondary').onclick = onSecondary || null;
    $('modal').classList.remove('hidden'); $('modal-action').focus();
  }
  closeModal() { $('modal').classList.add('hidden'); this.canvas.focus(); this.updateUI(); }
  help() {
    this.showModal('FIELD GUIDE', 'Small orders. Wide orbits.',
      '<ul><li><b>Click</b> a friendly unit to inspect it. <b>Right-click</b> to plan an order; <b>Enter</b> confirms, <b>Esc</b> cancels.</li><li><b>Prepare a rock:</b> select it and choose Send booster, or select a booster ship and right-click the rock. Attachment takes 6 seconds after arrival.</li><li><b>Launch:</b> drag an equipped rock to aim, then confirm for 35 metal. The booster fires for 4 seconds, then detaches automatically and awaits orders. Choose Return home to reload in 8 seconds at no extra cost. You can detach manually before launching.</li><li><b>Escort:</b> select a combat ship and right-click a friendly booster. Right-click an enemy booster to intercept it.</li><li><b>Shift + right-click</b> a friendly planet or platform for defense. Drones protect their assigned local area.</li><li><b>Space</b> pauses. <b>1 / 2 / 3</b> select 1× / 5× / 20×. Scroll to zoom; drag empty space to pan; <b>F</b> fits the system.</li></ul><p>Booster ships cost 50 metal and are unarmed. Select your colony to deploy. Income is 0.4 metal / second; fleet limit 12. Launched rocks damage any planet, including your own. Defenses intercept your rocks when they threaten home. Ship weapons do not fire on friendly ships or colonies.</p><p class="note">Teal launch segments show powered flight; gold shows coasting. Ship paths end when attachment completes. Predictions cover 90 seconds. Weapons and future enemy decisions can change the outcome.</p>',
      'Back to the system', () => this.closeModal());
  }
  toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); this.toastUntil = performance.now() + 6000; }
  select(id) {
    if (id !== this.ui.selectedId) { this.ui.pending = null; this.ui.baseline = null; }
    this.ui.selectedId = id; this.previewDirty = true; this.updateUI();
  }
  plan(pending, dragging = false) {
    if (this.world.outcome && !this.world.continueSandbox) return;
    if (pending.impulse && entity(this.world, pending.id)?.boosterTeam !== 'player') { this.toast('Attach a booster to this rock before aiming a launch.'); return; }
    this.paused = true; this.accumulator = 0; this.ui.pending = pending; this.ui.selectedId = pending.id; this.previewDirty = true;
    if (!dragging) this.refreshPredictions(); this.updateUI();
  }
  confirm() {
    const pending = this.ui.pending; if (!pending) return;
    if (pending.impulse) {
      const result = launchRock(this.world, pending.id, pending.impulse);
      if (result.error) { this.toast(result.error); return; }
      scanRockThreats(this.world); this.processEvents();
      this.toast('Launch committed. Unpause for a 4-second burn, then automatic separation.');
    } else {
      if (!setOrder(this.world, pending.id, pending.order)) return;
      this.toast(pending.order.kind === 'fit' ? 'Booster dispatched. Press Space to fly; attachment is automatic on arrival.' : 'Order committed. Press Space to let time flow.');
    }
    this.ui.pending = null; this.ui.baseline = null; this.previewDirty = true; this.updateUI();
  }
  cancel() { this.ui.pending = null; this.ui.baseline = null; this.previewDirty = true; this.updateUI(); }
  togglePause() {
    if (this.modalOpen() || (this.world.outcome && !this.world.continueSandbox)) return;
    if (this.ui.pending) { this.toast('Confirm or cancel the preview before resuming.'); return; }
    this.paused = !this.paused; this.accumulator = 0; this.updateUI();
  }
  setSpeed(speed) {
    this.speed = speed;
    if (!this.modalOpen() && !this.ui.pending && (!this.world.outcome || this.world.continueSandbox)) this.paused = false;
    this.updateUI();
  }
  build(type) {
    if (this.world.outcome && !this.world.continueSandbox) return;
    const host = entity(this.world, this.ui.selectedId);
    if (host?.type !== 'planet') { this.toast('Select Verdant to deploy near its colony.'); return; }
    const result = spawn(this.world, type, 'player', host);
    if (result.error) this.toast(result.error);
    else { this.toast(`${titleCase(type)} deployed at ${host.name}. Defending its local orbit.`); this.previewDirty = true; }
    this.updateUI();
  }
  refreshPredictions() {
    const w = this.world, ids = new Set();
    const selected = entity(w, this.ui.selectedId);
    if (selected && selected.type !== 'planet') ids.add(selected.id);
    for (const u of w.units) if (u.hp > 0 && ((u.team === 'enemy' && (u.type === 'rock' || u.order?.kind === 'attack')) || entity(w, w.rockThreats?.[u.id]?.targetId)?.team === 'player' || (this.ui.allPaths && (u.type !== 'rock' || u.launched)))) ids.add(u.id);
    this.ui.predictions = predict(w, [...ids], this.ui.pending);
    this.ui.baseline = this.ui.pending?.impulse ? predict(w, [this.ui.pending.id]).get(this.ui.pending.id) : null;
    this.previewDirty = false; this.lastPreview = performance.now();
  }
  processEvents() {
    for (const e of this.world.events) {
      if (e.id <= this.seenEvent) continue;
      this.seenEvent = e.id;
      // Real-time visibility survives fast-forward and pauses.
      e.visibleUntil = performance.now() + 15000;
      if (e.major && this.speed > 1 && $('autopause').checked) {
        this.paused = true; this.accumulator = 0;
        this.toast(`${e.text} — fast-forward paused. Assess the incoming threat, then resume.`);
      }
      this.previewDirty = true;
    }
  }
  updateUI() {
    const w = this.world, u = entity(w, this.ui.selectedId);
    setText('pause', this.paused ? '▶' : 'Ⅱ'); $('pause').setAttribute('aria-label', this.paused ? 'Resume simulation' : 'Pause simulation');
    document.querySelectorAll('[data-speed]').forEach(b => { b.classList.toggle('active', Number(b.dataset.speed) === this.speed); b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === this.speed)); });
    $('clock').textContent = time(w.time); $('metal').textContent = Math.floor(w.metal.player);
    $('objective').textContent = w.scenario === 'hold' ? `Keep Verdant alive · ${time(w.duration - w.time)} remaining` : SCENARIOS[w.scenario].objective;
    $('colonies').innerHTML = w.planets.filter(p => p.team !== 'neutral').map(p => `<div class="colony ${p.team === 'enemy' ? 'enemy' : ''}"><div><span>${p.name}${p.team === 'player' ? ' / HOME' : ' / RIVAL'}</span><span>${Math.ceil(p.hp / p.maxHp * 100)}%</span></div><span class="bar"><i style="width:${p.hp / p.maxHp * 100}%"></i></span></div>`).join('');
    const count = fleet(w, 'player').length;
    $('fleet-count').textContent = `${count} / ${CAP}`;
    const canDeploy = u?.type === 'planet' && u.team === 'player' && u.hp > 0;
    $('deploy-location').textContent = canDeploy ? `DEPLOY AT ${u.name}` : 'SELECT YOUR COLONY TO DEPLOY';
    document.querySelectorAll('[data-build]').forEach(b => { b.disabled = !canDeploy || w.metal.player < COST[b.dataset.build] || count >= CAP || (!!w.outcome && !w.continueSandbox); b.title = !canDeploy ? 'Select your colony first' : `${COST[b.dataset.build]} metal · deploy defending ${u.name}`; });
    $('rock-tool').disabled = !!w.outcome && !w.continueSandbox;
    $('paused-label').classList.toggle('hidden', !this.paused || !!this.ui.pending || this.modalOpen());
    // Interactive elements live in index.html; refresh only text/state around them.
    $('garden-lesson').classList.toggle('hidden', w.scenario !== 'garden');
    $('income-hint').classList.toggle('hidden', w.scenario === 'garden');
    if (w.scenario === 'garden') {
      for (const [id, done, label] of [
        ['lesson-prepare', w.progress.prepared, 'Attach a booster to a rock'],
        ['lesson-launch', w.progress.launched, 'Launch a belt rock'],
        ['lesson-intercept', w.progress.intercepted, 'Intercept a practice attack'],
      ]) {
        const row = $(id), text = `${done ? '✓' : '○'} ${label}`;
        row.classList.toggle('done', done);
        if (row.textContent !== text) row.textContent = text;
      }
    }
    let status = 'Click a planet, ship, or belt rock.<br>Give time a moment to unfold.';
    if (u) {
      const forecast = this.ui.predictions.get(u.id);
      if (u.type === 'planet') status = u.team === 'player' ? 'Your colony · +0.4 metal / s<br>Select a tool below to deploy in orbit.' : u.team === 'enemy' ? 'Rival colony · ships can bombard it.' : 'Uninhabited · a safe target for practice.';
      else if (u.type === 'rock') {
        const fitter = w.units.find(b => b.hp > 0 && b.order?.kind === 'fit' && b.order.targetId === u.id);
        status = u.burn?.remaining > 0 ? `Powered burn · ${Math.ceil(u.burn.remaining)}s left<br>Booster detaches automatically · then coasting` : u.launched ? `Ballistic flight · ${u.team === 'enemy' ? 'incoming threat' : 'launch committed'}<br>${forecast?.impact ? `Impact: ${forecast.impact.name} in ${Math.ceil(forecast.impact.time)}s` : forecast && Number.isFinite(forecast.closest) ? `Closest approach: ${Math.max(0, forecast.closest).toFixed(0)} u in ${Math.ceil(forecast.closestTime)}s` : 'Forecast horizon: 90 seconds'}` : u.boosterTeam ? `${u.boosterTeam === 'player' ? 'Your booster attached · ready to launch' : 'Enemy booster attached · destroy this rock'}<br>${u.boosterTeam === 'player' ? 'Drag to aim · confirm launch for 35 metal' : 'An enemy launch is being prepared'}` : fitter ? `${fitter.team === 'enemy' ? 'Enemy' : 'Your'} booster ${fitter.attachProgress > 0 ? `attaching · ${Math.ceil(ATTACH_TIME - fitter.attachProgress)}s left` : 'en route'}<br>${fitter.team === 'player' ? 'Escort it with a combat ship' : 'Intercept the booster before it finishes'}` : 'No booster attached · launch unavailable<br>Send a booster ship to prepare this rock.';
      }
      else if (u.type === 'booster') {
        const target = entity(w, u.order?.targetId);
        status = target?.burn?.remaining > 0 && u.attachedRockId ? `Firing · ${Math.ceil(target.burn.remaining)}s left<br>Automatic detach after burn · then await orders` : u.attachedRockId ? `Attached to ${target?.name || 'rock'} · ${u.loaded ? 'ready to launch' : 'charge spent'}<br>${u.loaded ? 'Aim rock to launch · Detach to leave' : 'Detach manually · Return home to rearm'}` : u.order.kind === 'fit' ? `${u.attachProgress > 0 ? `Attaching · ${Math.ceil(ATTACH_TIME - u.attachProgress)}s left` : `En route → ${target?.name || 'rock'}`}<br>Unarmed · one booster loaded` : u.order.kind === 'rearm' ? `${u.rearmProgress > 0 ? `Rearming · ${Math.ceil(REARM_TIME - u.rearmProgress)}s left` : 'Returning home to rearm'}<br>Unarmed · automatic reload at colony` : `${u.loaded ? 'One booster loaded · ready' : 'Charge spent · awaiting orders'}<br>${u.loaded ? 'Right-click a free rock to attach' : 'Choose Return home to reload'}`;
      }
      else {
        const target = entity(w, u.order?.targetId);
        status = u.type === 'platform' ? `Local defense · ${u.range} u weapon range` : `${titleCase(u.order?.kind || 'idle')}${target ? ` → ${target.name}` : ''}<br>${u.type === 'drone' ? 'Intercepts rocks & drones · returns to host' : forecast?.eta ? `Arrival / weapons range in ~${Math.ceil(forecast.eta)}s` : 'Right-click to plan a new order'}`;
      }
    }
    setText('selected-name', u?.name || 'THE SYSTEM IS YOURS');
    setText('selected-health', u ? `${Math.ceil(u.hp)} / ${u.maxHp}` : '');
    // Cache source text rather than comparing browser-normalized HTML (& -> &amp;).
    if (this.selectedStatus !== status) { $('selected-meta').innerHTML = status; this.selectedStatus = status; }
    const attachedBooster = u?.type === 'booster' && u.attachedRockId ? u : u?.type === 'rock' ? entity(w, u.boosterId) : null;
    const mobileFriendly = u?.team === 'player' && ['ship', 'drone', 'booster'].includes(u.type) && !u.attachedRockId;
    const burning = !!entity(w, attachedBooster?.attachedRockId)?.burn?.remaining;
    $('order-detach').classList.toggle('hidden', !(attachedBooster?.team === 'player' && attachedBooster.attachedRockId) || burning);
    $('order-aim').classList.toggle('hidden', !(u?.type === 'booster' && u.team === 'player' && u.attachedRockId && u.loaded));
    $('order-fit').classList.toggle('hidden', !(u?.type === 'rock' && !u.launched && !u.boosterTeam));
    $('order-fit').disabled = !fleet(w, 'player').some(b => b.type === 'booster' && b.loaded && !b.attachedRockId && b.order.kind !== 'fit');
    $('order-defend').classList.toggle('hidden', !mobileFriendly);
    setText('order-defend', u?.type === 'booster' ? 'Return home' : 'Defend home');
    $('order-stop').classList.toggle('hidden', !mobileFriendly);
    $('selected-actions').classList.toggle('hidden', u?.team === 'player' && u.type === 'planet');
    setText('order-home', mobileFriendly ? 'Colony' : 'Select home colony');
    $('plan').classList.toggle('hidden', !this.ui.pending);
    if (this.ui.pending) {
      const pending = this.ui.pending, f = this.ui.predictions.get(pending.id);
      const target = entity(w, pending.order?.targetId);
      $('plan-kind').textContent = pending.impulse ? 'PLANNED LAUNCH / 35 METAL' : `PLANNED ${pending.order.kind.toUpperCase()} / ASSISTED FLIGHT`;
      let detail = f?.attachment ? `Attached and waiting in ~${Math.ceil(f.attachment.time)}s` : f?.impact ? `Impact: ${f.impact.name} in ${Math.ceil(f.impact.time)}s` : f?.eta ? `Arrival / range in ~${Math.ceil(f.eta)}s` : '90-second flight preview';
      if (pending.impulse && f && !f.impact && Number.isFinite(f.closest)) detail = `Closest approach: ${Math.max(0, f.closest).toFixed(0)} u in ${Math.ceil(f.closestTime)}s`;
      if (pending.impulse && entity(w, f?.impact?.targetId)?.team === 'player') detail = `WARNING: YOUR COLONY — ${detail}`;
      $('plan-summary').textContent = `${target ? `${target.name} · ` : ''}${detail}`;
      $('plan-note').textContent = pending.impulse ? '4s powered burn, then coast · booster detaches automatically' : pending.order.kind === 'fit' ? 'Attach for 6s after arrival · stay attached until you launch or detach' : 'Moving targets are pursued · weapons can change the outcome';
      $('confirm').disabled = !!pending.impulse && w.metal.player < COST.rock;
    }
    const threats = w.units.filter(u => u.hp > 0 && ((u.team === 'enemy' && (u.type === 'rock' || ['attack', 'fit'].includes(u.order?.kind))) || (u.type === 'rock' && u.launched && entity(w, w.rockThreats?.[u.id]?.targetId)?.team === 'player')));
    threats.sort((a, b) => (w.rockThreats?.[a.id]?.time ?? Infinity) - (w.rockThreats?.[b.id]?.time ?? Infinity));
    let alerts = threats.filter(u => u.type === 'rock').slice(0, 3).map(r => {
      const f = this.ui.predictions.get(r.id);
      const impact = f?.impact || (w.rockThreats?.[r.id] ? { ...w.rockThreats[r.id], time: w.rockThreats[r.id].time - w.time } : null);
      return `<div class="alert">↘ ${r.name} / ${r.team === 'player' ? 'FRIENDLY ROCK — DANGER' : r.launched ? 'INCOMING' : 'ARMED'}<small>${!r.launched ? 'Booster attached · destroy it before launch' : impact ? `Predicted ${impact.name} impact in ${Math.ceil(Math.max(0, impact.time))}s` : r.burn?.remaining > 0 ? `Powered burn · ${Math.ceil(r.burn.remaining)}s left` : 'Ballistic approach · defenses engaging in range'}</small></div>`;
    });
    for (const b of threats.filter(u => u.type === 'booster').slice(0, 2)) alerts.push(`<div class="alert">▣ ENEMY BOOSTER<small>${b.attachProgress > 0 ? `Attaching · ${Math.ceil(ATTACH_TIME - b.attachProgress)}s left` : `Heading to ${entity(w, b.order.targetId)?.name || 'the belt'}`} · intercept to stop launch</small></div>`);
    const attackingShips = threats.filter(u => u.type === 'ship');
    if (attackingShips.length) {
      const etas = attackingShips.map(s => this.ui.predictions.get(s.id)?.eta).filter(n => n !== null && n !== undefined);
      alerts.push(`<div class="alert">△ ${attackingShips.length} HOSTILE SHIP${attackingShips.length > 1 ? 'S' : ''}<small>${etas.length ? `Colony approach in ~${Math.ceil(Math.min(...etas))}s` : 'Approaching your colony'}</small></div>`);
    }
    for (const e of w.events.slice(-2)) if (e.visibleUntil > performance.now()) alerts.push(`<div class="alert ${e.major ? '' : 'neutral'}">${e.text}<small>${e.detail}</small></div>`);
    $('alerts').innerHTML = alerts.slice(0, 4).join('');
    $('hint').innerHTML = this.ui.pending ? 'Enter to commit · Esc to cancel<br><span>Time is paused while you plan</span>' : u?.type === 'rock' && !u.launched ? u.boosterTeam === 'player' ? 'Drag this equipped rock to aim<br><span>Preview freely · Confirm for 35 metal</span>' : 'Send a booster to earn your shot<br><span>Escort it · Attach · Aim · Launch</span>' : u?.type === 'booster' ? u.attachedRockId ? burning ? 'Booster firing · automatic separation after burn<br><span>The ship will await your next order</span>' : 'Attached and waiting for your order<br><span>Aim rock to launch · Detach to leave</span>' : 'Right-click a rock to fit a booster<br><span>Stays attached · Detach manually</span>' : 'Select a unit · Right-click to plan<br><span>Combat ship → friendly booster = escort</span>';
  }
  showOutcome() {
    this.outcomeShown = true; const win = this.world.outcome === 'victory';
    const training = this.world.scenario === 'garden';
    const body = win ? training ? '<p>A launch of your own, an incoming rock turned to harmless dust. You have the essentials.</p><p>Keep experimenting, or try a colony under siege.</p>' : this.world.scenario === 'hold' ? '<p>Four minutes in the gravity well. Your colony is still here.</p><p>Your defenses held the orbit.</p>' : '<p>Cinder has fallen silent. Verdant has a future among these little worlds.</p>' : '<p>Your colony has lost its integrity. Try holding your defenses closer to home, or intercept the incoming rocks earlier.</p>';
    this.showModal(win ? 'ENCOUNTER COMPLETE' : 'COLONY LOST', win ? training ? 'A little orbital intuition.' : 'The orbit is yours.' : 'Every orbit is another try.', body,
      'Restart scenario', () => this.load(this.world.scenario), training && win ? 'Keep exploring' : win ? 'Next scenario' : 'Review system', () => {
        if (training && win) { this.world.continueSandbox = true; this.world.outcome = null; this.closeModal(); }
        else if (win) this.load(this.world.scenario === 'hold' ? 'neighbors' : 'garden');
        else this.closeModal();
      });
  }
  frame(now) {
    const elapsed = Math.min(.15, (now - this.lastFrame) / 1000); this.lastFrame = now;
    if (!this.paused && !this.modalOpen()) {
      this.accumulator += elapsed * this.speed;
      while (this.accumulator >= DT) {
        step(this.world); this.accumulator -= DT; this.processEvents();
        if (this.paused || (this.world.outcome && !this.world.continueSandbox)) { this.accumulator = 0; break; }
      }
    }
    if (this.world.outcome && !this.outcomeShown) this.showOutcome();
    if ((this.previewDirty && now - this.lastPreview > 80) || (!this.paused && now - this.lastPreview > 650)) this.refreshPredictions();
    if (now - this.lastUI > 150) { this.updateUI(); this.lastUI = now; }
    if (this.toastUntil && now > this.toastUntil) { $('toast').classList.remove('visible'); this.toastUntil = 0; }
    this.renderer.draw(this.world, this.ui);
    requestAnimationFrame(t => this.frame(t));
  }
}
const game = new Game();
// A small inspection seam for browser tests and future scenario tooling.
window.orbital = game;
attachPlaytestRecorder(game);
