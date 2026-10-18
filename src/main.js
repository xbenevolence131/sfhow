import { DT, CAP, COST, ATTACH_TIME, REARM_TIME, GRAVITY_DEFAULTS, COLLISION_DEFAULTS, setCollisions, setGravity, distance, entity, fleet, spawn, setOrder, launchRock, sendPracticeRock, scanRockThreats, predict, step } from './simulation.js';
import { createGame, SCENARIOS } from './scenarios.js';
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
    this.bindUI(); this.load('garden', undefined, true); attachInput(this);
    this.headerObserver = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--header-bottom', `${document.querySelector('header').getBoundingClientRect().bottom + 12}px`);
    });
    this.headerObserver.observe(document.querySelector('header'));
    requestAnimationFrame(t => this.frame(t));
  }
  modalOpen() { return !$('modal').classList.contains('hidden') || !$('new-game-modal').classList.contains('hidden'); }
  bindUI() {
    $('tutorial-skip').onclick = () => { this.tutorial = null; this.updateUI(); };
    $('pause').onclick = () => this.togglePause();
    document.querySelectorAll('[data-speed]').forEach(button => button.onclick = () => this.setSpeed(Number(button.dataset.speed)));
    $('scenario').onchange = e => this.load(e.target.value);
    $('restart').onclick = () => { if (this.world.scenario === 'playground') this.resetRange(); else this.load(this.world.scenario, this.world.setup); };
    $('range-reset').onclick = () => this.resetRange();
    $('new-game').onclick = () => this.openNewGame();
    $('cancel-new-game').onclick = () => this.cancelNewGame();
    document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { this.setupMode = b.dataset.mode; this.updateSetup(); });
    $('setup-scenario').onchange = () => this.updateSetup();
    $('setup-unlimited').onchange = () => this.updateSetup();
    $('setup-enemies').onchange = () => this.updateSetup();
    $('start-game').onclick = () => this.load($('setup-scenario').value, {
      mode: this.setupMode, scenario: $('setup-scenario').value, system: $('setup-system').value,
      budget: Number($('setup-budget').value), enemies: $('setup-enemies').checked, unlimited: $('setup-unlimited').checked,
    });
    $('new-game-modal').addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.cancelNewGame(); }
      if (e.key === 'Tab') {
        const items = [...$('new-game-modal').querySelectorAll('button,select,input')].filter(n => !n.disabled && n.getClientRects().length);
        const next = items[(items.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + items.length) % items.length];
        e.preventDefault(); next?.focus();
      }
    });
    $('fit').onclick = () => this.renderer.fit();
    document.querySelector('.wordmark').onclick = e => { e.preventDefault(); this.renderer.fit(); };
    $('trajectories').onchange = e => { this.ui.allPaths = e.target.checked; this.previewDirty = true; };
    $('ranges').onchange = e => { this.ui.ranges = e.target.checked; };
    document.querySelectorAll('[data-gravity]').forEach(input => input.oninput = () => this.tuneGravity({ [input.dataset.gravity]: Number(input.value) }));
    $('gravity-reset').onclick = () => this.tuneGravity(GRAVITY_DEFAULTS);
    document.querySelectorAll('[data-collision]').forEach(input => input.oninput = () => this.tuneCollisions({ [input.dataset.collision]: Number(input.value) }));
    $('collision-reset').onclick = () => this.tuneCollisions(COLLISION_DEFAULTS);
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
      this.toast(rock.boosterTeam === 'player' ? 'Booster attached. Right-click a planet to target it, or empty space to aim manually. Then confirm.' : 'This rock needs a booster. Choose Send booster in its panel, then confirm the order.');
    };
    $('selection').onclick = e => {
      const action = e.target.closest('[data-order]')?.dataset.order;
      if (action === 'home') { const home = this.world.planets.find(p => p.team === 'player'); if (home) this.select(home.id); return; }
      const selected = entity(this.world, this.ui.selectedId); if (!selected) return;
      if (action === 'detach') {
        const booster = selected.type === 'rock' ? entity(this.world, selected.boosterId) : selected;
        if (booster?.attachedRockId) this.plan({ id: booster.id, order: { kind: 'detach' } });
        return;
      }
      if (action === 'aim') {
        this.select(selected.attachedRockId);
        this.toast('Right-click a planet to target it, or empty space to aim manually. Then confirm.');
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
        if (!host) { this.toast('No friendly colony in this range. Reset for fresh boosters.'); return; }
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
  openNewGame() {
    this.beforeSetupPaused = this.paused; this.paused = true; this.accumulator = 0;
    const setup = this.world.setup;
    this.setupMode = this.world.mode || 'scenario';
    $('setup-scenario').value = this.world.scenario;
    $('setup-system').value = setup.system || 'three'; $('setup-budget').value = setup.budget || 160;
    $('setup-enemies').checked = setup.enemies ?? false; $('setup-unlimited').checked = setup.unlimited ?? true;
    this.updateSetup(); $('new-game-modal').classList.remove('hidden');
    document.querySelector(`[data-mode="${this.setupMode}"]`).focus(); this.updateUI();
  }
  resetRange() {
    this.load('playground', this.world.setup);
    this.closeModal();
    this.toast('Range reset. Fresh rocks and defenses; gravity and collision settings kept.');
  }
  tuneGravity(settings) {
    this.paused = true; this.accumulator = 0;
    setGravity(this.world, settings);
    scanRockThreats(this.world); this.processEvents(); this.refreshPredictions();
    // Keep the planned impulse unchanged. A formerly verified automatic shot
    // must be checked again against the new physics before it can be committed.
    const pending = this.ui.pending;
    if (pending?.aim) {
      pending.aim.verified = this.ui.predictions.get(pending.id)?.impact?.targetId === pending.aim.targetId;
      if (!pending.aim.verified) pending.aim.reason = 'Gravity changed the shot. Right-click the planet to recalculate.';
    }
    this.gravityAdjusted = true; this.updateUI();
  }
  tuneCollisions(settings) {
    this.paused = true; this.accumulator = 0;
    setCollisions(this.world, settings);
    scanRockThreats(this.world); this.processEvents(); this.refreshPredictions();
    const pending=this.ui.pending;
    if(pending?.aim){
      pending.aim.verified=this.ui.predictions.get(pending.id)?.impact?.targetId===pending.aim.targetId;
      if(!pending.aim.verified)pending.aim.reason='Collision tuning changed the shot. Re-aim or choose a new target.';
    }
    this.updateUI();
  }
  cancelNewGame() {
    $('new-game-modal').classList.add('hidden');
    this.paused = this.beforeSetupPaused; this.accumulator = 0; $('new-game').focus(); this.updateUI();
  }
  updateSetup() {
    const mode = this.setupMode;
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('setup-scenarios').classList.toggle('hidden', mode !== 'scenario');
    $('setup-open').classList.toggle('hidden', mode === 'scenario');
    $('setup-sandbox').classList.toggle('hidden', mode !== 'sandbox');
    $('setup-budget').disabled = mode === 'sandbox' && $('setup-unlimited').checked && !$('setup-enemies').checked;
    setText('setup-description', mode === 'scenario' ? SCENARIOS[$('setup-scenario').value].objective : mode === 'skirmish' ? 'Protect your colony and destroy your rival. Both sides start with the same metal budget. No time limit.' : 'Experiment with trajectories and fleets. No victory or defeat screens; colonies can still be destroyed.');
    setText('start-game', mode === 'scenario' ? 'Start scenario' : mode === 'skirmish' ? 'Start skirmish' : 'Enter sandbox');
  }
  load(key, options = { mode: 'scenario', scenario: key }, welcome = false) {
    this.tutorial = this.tutorial && key === 'garden' && options.mode === 'scenario' ? { stage: '' } : null;
    $('new-game-modal').classList.add('hidden');
    this.world = createGame(options); key = this.world.scenario; this.paused = true; this.speed = 1; this.accumulator = 0; this.gravityAdjusted = false;
    this.seenEvent = 0; this.outcomeShown = false; this.ui.selectedId = key === 'playground' ? this.world.units.find(u => u.type === 'rock').id : this.world.planets[0].id;
    this.ui.hoverId = null; this.ui.pending = null; this.ui.predictions = new Map(); this.ui.baseline = null; this.previewDirty = true;
    this.toastUntil = 0; $('toast').classList.remove('visible'); this.renderer.fit(); $('scenario').value = key;
    const open = this.world.mode !== 'scenario', sandbox = this.world.mode === 'sandbox';
    const briefing = open ? `<p>${sandbox ? 'An open playground. Explore trajectories, deploy fleets, and take your time. There are no victory or defeat screens.' : 'Protect Verdant and destroy Cinder. Both sides pay the same prices and earn metal from their colony. There is no time limit.'}</p><p>${this.world.planets.length} planets. ${this.world.setup.enemies ? 'An AI rival occupies Cinder.' : 'No enemy fleet; the other worlds are uninhabited targets.'} ${this.world.unlimitedMetal ? 'Your deployments and launches are free.' : `Starting budget: ${this.world.setup.budget} metal.`}</p><p>Rocks still need booster ships. Prepare, preview, and launch. New game lets you choose another mode at any time.</p>` : SCENARIOS[key].body;
    if(welcome)this.showWelcome();
    else this.showModal(open ? 'OPEN SYSTEM' : SCENARIOS[key].kicker, open ? titleCase(this.world.mode) : SCENARIOS[key].name, briefing, 'Enter the system', () => {
      this.closeModal(); this.toast('The system is paused. Plan an order, or press Space to let time flow.');
    });
    this.updateUI();
  }
  showWelcome() {
    this.showModal('A LITTLE PLANETARY WARFARE', 'Welcome to ORBITAL',
      '<p>Prepare asteroids, bend trajectories around moving worlds, and protect your colony. Make a small decision, preview its path, and watch the consequences unfold.</p><ul class="welcome-directions"><li><b>Scenario</b><br>Use the dropdown at the upper left to choose a ready-made challenge or playground.</li><li><b>New game</b><br>Explore Scenarios, Skirmish, and Sandbox with different starting options.</li></ul><p class="note">Rock Garden is ready behind this welcome. Take your time: the system starts paused.</p>',
      'Start tutorial',()=>{ this.tutorial = { stage: '' }; this.ui.selectedId = null; this.closeModal(); },
      'Explore freely',()=>{this.closeModal();$('scenario').focus();});
  }
  updateTutorial() {
    const w = this.world, active = !!this.tutorial && w.scenario === 'garden' && w.mode === 'scenario';
    $('tutorial').classList.toggle('hidden', !active);
    document.querySelectorAll('.tutorial-focus').forEach(el => el.classList.remove('tutorial-focus'));
    this.ui.tutorialId = null;
    this.ui.tutorialAction = '';
    if (!active) return;
    const selected = entity(w, this.ui.selectedId), pending = this.ui.pending;
    const booster = w.units.find(u => u.type === 'booster' && u.team === 'player' && u.hp > 0 && u.loaded);
    const attached = w.units.find(u => u.type === 'rock' && u.hp > 0 && u.boosterTeam === 'player' && !u.launched);
    const fitting = w.units.find(u => u.type === 'booster' && u.team === 'player' && u.hp > 0 && u.order?.kind === 'fit');
    const practice = w.units.some(u => u.hp > 0 && u.practice && (u.type === 'rock' || u.order?.kind === 'fit'));
    const burning = w.units.find(u => u.hp > 0 && u.type === 'rock' && u.team === 'player' && u.burn?.remaining > 0);
    let stage, title, copy, highlight, target, action='WATCH';
    if (w.progress.launched && w.progress.intercepted) {
      stage=7; title='You know the essentials'; copy='You prepared a rock, launched it, and intercepted an attack. Keep experimenting, or choose another scenario using the menu above.'; highlight='scenario';
    } else if (w.progress.launched) {
      if (burning) {
        stage=4; title='Let your rock fly'; target=burning.id; highlight=this.paused ? 'pause' : null;
        copy=this.paused ? 'Launch confirmed. Press Space or Play to fire the booster. Watch the four-second burn and automatic separation before trying an incoming attack.' : 'Your booster is accelerating the rock. After four seconds it detaches, leaving the rock to coast under gravity.';
      } else if (practice) {
        stage=6; title='Watch your defenses'; copy='The practice booster must attach before it launches. Your platform and drones fire automatically. If it is stopped before launching, send another practice rock.'; highlight=this.paused ? 'pause' : 'ranges';
        target=w.units.find(u=>u.hp>0 && u.practice && u.type==='rock')?.id || w.units.find(u=>u.hp>0 && u.practice && u.order?.kind==='fit')?.id;
        if(this.paused) copy+=' Press Space to let time flow. Threat pause may pause fast-forward again.';
      } else {
        stage=5; title='Try an incoming attack'; copy='Click Send practice rock below. An enemy booster will prepare a real incoming shot. Your defenders are already guarding Verdant.'; highlight='practice';
      }
    } else if (attached) {
      if (pending?.impulse) {
        stage=4; title='Review and launch'; copy='The dotted route predicts your shot. Drag to revise it, or cancel and aim again. Confirm when ready, then unpause for the four-second burn. Your own planet can be hit too.'; highlight='confirm';
        if(pending.aim && !pending.aim.verified) { copy='This shot has no verified impact. Right-click empty space to aim manually, choose another target, or cancel and wait for a better alignment.'; highlight='cancel'; }
      } else {
        stage=3;
        if(selected?.id===attached.id) {
          title='Target Ochre'; target='ochre'; action='RIGHT-CLICK';
          copy='Right-click the magenta-ringed planet, Ochre. The preview calculates an intercept with its future position. Nothing launches until you confirm. Empty space is also available for manual aiming.';
        } else {
          title='Select your equipped rock'; target=attached.id; action='LEFT-CLICK';
          copy='Your booster is attached. Left-click the rock inside the magenta circle. Next, you will choose a planet to aim at.';
        }
      }
    } else if (fitting) {
      stage=2; title='Rendezvous and attach'; copy='Your booster follows the moving rock and attaches automatically after a six-second countdown. Journeys take time; try 5× to watch it sooner.'; target=fitting.id; highlight=this.paused ? 'pause' : null;
      if(this.paused)copy='Press Space or Play to fly your confirmed route. '+copy;
    } else if (pending?.order?.kind === 'fit' || selected?.type === 'booster' && selected.team === 'player' && selected.loaded) {
      stage=1; title='Send it to a rock'; copy=pending?.order?.kind==='fit' ? 'The dotted path shows the rendezvous. Click Confirm or press Enter to accept it. Escape cancels; orders work while paused.' : 'Right-click the rock inside the magenta circle to preview an attachment order. The booster will meet it as it moves. You can choose another rock instead.'; highlight=pending?.order?.kind==='fit' ? 'confirm' : null;
      if(!pending) {
        let rock=entity(w,this.tutorial.rockId);
        if(!rock || rock.launched || rock.boosterTeam) {
          rock=w.units.filter(u=>u.hp>0 && u.type==='rock' && !u.launched && !u.boosterTeam).sort((a,b)=>distance(a,selected)-distance(b,selected))[0];
          this.tutorial.rockId=rock?.id;
        }
        target=rock?.id; action='RIGHT-CLICK';
      }
    } else {
      stage=0; title=booster ? 'Select your booster' : 'Prepare a booster'; copy=booster ? 'Welcome to the Rock Garden tutorial. Left-click the booster ship inside the magenta circle near Verdant. Left-click selects; right-click gives an order. Time starts paused.' : 'Select Verdant and deploy a booster, or select your spent booster and right-click Verdant to reload. You can also restart for a fresh tutorial.'; target=booster?.id; action='LEFT-CLICK';
    }
    setText('tutorial-step', stage===7 ? 'TUTORIAL COMPLETE' : `TUTORIAL / ${stage+1} OF 7`);
    setText('tutorial-title',title); setText('tutorial-copy',copy);
    if(highlight)$(highlight)?.classList.add('tutorial-focus');
    this.ui.tutorialId=target || null;
    this.ui.tutorialAction=action;
    if(this.tutorial.stage!==stage) { this.tutorial.stage=stage; document.querySelector('.mission').scrollTop=0; }
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
      '<ul><li><b>Left-click</b> to select. Click it again or empty space to clear selection. <b>Right-click</b> to plan an order; <b>Enter</b> confirms, <b>Esc</b> cancels.</li><li><b>Prepare a rock:</b> select it and choose Send booster, or select a booster ship and right-click the rock. Attachment takes 6 seconds after arrival.</li><li><b>Launch:</b> select an equipped rock and right-click a planet to calculate a shot toward its future position. Right-click empty space for manual aim; confirm for 35 metal (free with unlimited metal). Drag aiming also works. The booster fires for 4 seconds, then detaches automatically and awaits orders. Choose Return home to reload in 8 seconds at no extra cost. You can detach manually before launching.</li><li><b>Context orders:</b> a combat ship attacks enemies, escorts friendly mobile units, and defends friendly planets or platforms. A booster attaches to free rocks and returns to a friendly colony to reload. Hover for the action hint.</li><li><b>Right-click</b> a friendly planet or platform with a ship or drone to defend it. Drones protect their assigned local area.</li><li><b>Space</b> pauses. <b>1 / 2 / 3</b> select 1× / 5× / 20×. Scroll to zoom; drag empty space to pan; <b>F</b> fits the system.</li></ul><p>Booster ships cost 50 metal and are unarmed. Select your colony to deploy. Income is 0.4 metal / second; fleet limit 12. Launched rocks damage any planet, including your own. Defenses intercept your rocks when they threaten home. Ship weapons do not fire on friendly ships or colonies.</p><p><b>Rock collisions:</b> small, medium, and large rocks have masses 1, 2, and 4 and colony damage 35, 65, and 100. All fall equally under gravity. Glancing hits deflect; hard hits shatter both rocks and any attached boosters, leaving harmless debris. Collision tuning adjusts rebound and rock strength, pauses time, and redraws both paths. Violet paths show other rocks after contact. Restart keeps tuning.</p><p><b>Gravity:</b> adjust G, shared planet mass, or sun mass in the left-hand controls. Changes pause time and redraw paths. G and sun mass set planetary orbital speed; radii and current positions stay fixed. Planet mass changes its pull on units, not its own orbital speed. Free-flying units keep their velocities. Reset restores defaults; restarting retains tuning, while New game starts at defaults.</p><p class="note">Teal launch segments show powered flight; gold shows coasting. Ship paths end when attachment completes. Predictions cover 90 seconds. Weapons and future enemy decisions can change the outcome.</p>',
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
    if (pending.aim && !pending.aim.verified) { this.toast('No verified impact. Right-click empty space to aim manually, choose another planet, or cancel and wait.'); return; }
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
    const playground = w.scenario === 'playground', hasHome = w.planets.some(p => p.team === 'player');
    document.querySelectorAll('[data-gravity]').forEach(input => {
      const value = w.gravity[input.dataset.gravity];
      if (Number(input.value) !== value) input.value = value;
      setText(`${input.id}-value`, input.dataset.gravity === 'g' ? value.toFixed(2) : String(value));
    });
    setText('gravity-status', this.gravityAdjusted && this.paused ? 'Paused / paths updated.' : 'Adjust to pause and preview.');
    document.querySelectorAll('[data-collision]').forEach(input=>{
      const value=w.collisions[input.dataset.collision];
      if(Number(input.value)!==value)input.value=value;
      setText(`${input.id}-value`,input.dataset.collision==='bounce'?value.toFixed(2):String(value));
    });
    setText('pause', this.paused ? '▶' : 'Ⅱ'); $('pause').setAttribute('aria-label', this.paused ? 'Resume simulation' : 'Pause simulation');
    document.querySelectorAll('[data-speed]').forEach(b => { b.classList.toggle('active', Number(b.dataset.speed) === this.speed); b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === this.speed)); });
    $('clock').textContent = time(w.time); setText('metal', w.unlimitedMetal ? '\u221e' : String(Math.floor(w.metal.player)));
    setText('current-mode', w.mode === 'scenario' ? '' : w.mode.toUpperCase());
    $('scenario-picker').classList.toggle('hidden', w.mode !== 'scenario');
    $('open-game-name').classList.toggle('hidden', w.mode === 'scenario');
    setText('open-game-name', `${w.planets.length} planets / ${w.planets.some(p => p.team === 'enemy') ? 'AI opponent' : 'quiet system'}`);
    setText('objective-label', w.mode === 'sandbox' ? 'YOUR PLAYGROUND' : 'YOUR OBJECTIVE');
    setText('objective', w.mode === 'sandbox' ? 'Explore trajectories. Build a fleet. Make your own experiments.' : w.scenario === 'hold' ? `Keep Verdant alive / ${time(w.duration - w.time)} remaining` : SCENARIOS[w.scenario].objective);
    setText('income-hint', playground ? 'Free launches / defenders only engage fired rocks' : w.unlimitedMetal ? 'Unlimited metal / fleet limit 12' : '+0.4 metal / second from your colony');
    $('colonies').innerHTML = w.planets.filter(p => p.team !== 'neutral').map(p => `<div style="--colony-color:${p.color}" class="colony ${p.team === 'enemy' ? 'enemy' : ''}"><div><span>${p.name}${p.team === 'player' ? ' / HOME' : playground ? ' / TARGET' : ' / RIVAL'}</span><span>${Math.ceil(p.hp / p.maxHp * 100)}%</span></div><span class="bar"><i style="width:${p.hp / p.maxHp * 100}%"></i></span></div>`).join('');
    const count = fleet(w, 'player').length;
    $('fleet-count').textContent = playground ? `${w.units.filter(r => r.type === 'rock' && r.hp > 0 && r.boosterTeam === 'player').length} / 12 ready` : `${count} / ${CAP}`;
    const canDeploy = u?.type === 'planet' && u.team === 'player' && u.hp > 0;
    $('deploy-location').textContent = playground ? 'SLINGSHOT PLAYGROUND' : canDeploy ? `DEPLOY AT ${u.name}` : 'SELECT YOUR COLONY TO DEPLOY';
    document.querySelectorAll('[data-build]').forEach(b => { b.classList.toggle('hidden', playground); b.disabled = !canDeploy || (!w.unlimitedMetal && w.metal.player < COST[b.dataset.build]) || count >= CAP || (!!w.outcome && !w.continueSandbox); b.querySelector('span').textContent = w.unlimitedMetal ? 'Free' : `${COST[b.dataset.build]} \u25c7`; b.title = !canDeploy ? 'Select your colony first' : `${w.unlimitedMetal ? 'Free' : COST[b.dataset.build] + ' metal'} · deploy defending ${u.name}`; });
    $('range-reset').classList.toggle('hidden', !playground);
    document.querySelector('#rock-tool b').textContent = playground ? 'NEXT ROCK' : 'ROCK';
    document.querySelector('.dock').classList.toggle('range-dock', playground);
    document.querySelector('#rock-tool span').textContent = w.unlimitedMetal ? 'Free launch' : '35 \u25c7 / launch';
    $('rock-tool').disabled = !!w.outcome && !w.continueSandbox;
    $('paused-label').classList.toggle('hidden', !this.paused || !!this.ui.pending || this.modalOpen());
    // Interactive elements live in index.html; refresh only text/state around them.
    $('garden-lesson').classList.toggle('hidden', w.scenario !== 'garden' || w.mode !== 'scenario');
    $('income-hint').classList.toggle('hidden', w.scenario === 'garden' && w.mode === 'scenario');
    if (w.scenario === 'garden' && w.mode === 'scenario') {
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
      if (u.type === 'planet') status = u.team === 'player' ? playground ? 'Your colony / friendly defenders<br>Ship, platform, and two drones guard home.' : 'Your colony · +0.4 metal / s<br>Select a unit below to deploy in orbit.' : u.team === 'enemy' ? playground ? 'Defended target / ship, platform, two drones<br>Launch a rock to test their interception.' : 'Rival colony · ships can bombard it.' : 'Uninhabited · a safe target for practice.';
      else if (u.type === 'rock') {
        const fitter = w.units.find(b => b.hp > 0 && b.order?.kind === 'fit' && b.order.targetId === u.id);
        status = u.burn?.remaining > 0 ? `Powered burn · ${Math.ceil(u.burn.remaining)}s left<br>Booster detaches automatically · then coasting` : u.launched ? `Ballistic flight · ${u.deflected ? 'redirected by collision' : u.team === 'enemy' ? 'incoming threat' : 'launch committed'}<br>${forecast?.impact ? `Impact: ${forecast.impact.name} in ${Math.ceil(forecast.impact.time)}s` : forecast && Number.isFinite(forecast.closest) ? `Closest approach: ${Math.max(0, forecast.closest).toFixed(0)} u in ${Math.ceil(forecast.closestTime)}s` : 'Forecast horizon: 90 seconds'}` : u.boosterTeam ? `${u.boosterTeam === 'player' ? 'Your booster attached · ready to launch' : 'Enemy booster attached · destroy this rock'}<br>${u.boosterTeam === 'player' ? (w.unlimitedMetal ? 'Right-click to aim / free launch' : 'Right-click to aim / launch for 35 metal') : 'An enemy launch is being prepared'}` : fitter ? `${fitter.team === 'enemy' ? 'Enemy' : 'Your'} booster ${fitter.attachProgress > 0 ? `attaching · ${Math.ceil(ATTACH_TIME - fitter.attachProgress)}s left` : 'en route'}<br>${fitter.team === 'player' ? 'Escort it with a combat ship' : 'Intercept the booster before it finishes'}` : 'No booster attached · launch unavailable<br>Send a booster ship to prepare this rock.';
      }
      else if (u.type === 'booster') {
        const target = entity(w, u.order?.targetId);
        status = target?.burn?.remaining > 0 && u.attachedRockId ? `Firing · ${Math.ceil(target.burn.remaining)}s left<br>Automatic detach after burn · then await orders` : u.attachedRockId ? `Attached to ${target?.name || 'rock'} · ${u.loaded ? 'ready to launch' : 'charge spent'}<br>${u.loaded ? 'Aim rock to launch · Detach to leave' : 'Detach manually · Return home to rearm'}` : u.order.kind === 'fit' ? `${u.attachProgress > 0 ? `Attaching · ${Math.ceil(ATTACH_TIME - u.attachProgress)}s left` : `En route → ${target?.name || 'rock'}`}<br>Unarmed · one booster loaded` : u.order.kind === 'rearm' ? `${u.rearmProgress > 0 ? `Rearming · ${Math.ceil(REARM_TIME - u.rearmProgress)}s left` : 'Returning home to rearm'}<br>Unarmed · automatic reload at colony` : `${u.loaded ? 'One booster loaded · ready' : (playground ? 'Charge spent / reset range for more' : 'Charge spent · awaiting orders')}<br>${u.loaded ? 'Right-click a free rock to attach' : (playground ? 'Reset restores rocks and attached boosters' : 'Choose Return home to reload')}`;
      }
      else {
        const target = entity(w, u.order?.targetId);
        status = u.type === 'platform' ? `Local defense · ${u.range} u weapon range` : `${titleCase(u.order?.kind || 'idle')}${target ? ` → ${target.name}` : ''}<br>${u.type === 'drone' ? 'Intercepts rocks & drones · returns to host' : forecast?.eta ? `Arrival / weapons range in ~${Math.ceil(forecast.eta)}s` : 'Right-click to plan a new order'}`;
        if (u.type === 'ship' && u.order?.kind === 'attack' && target && ['ship', 'booster', 'drone', 'platform'].includes(target.type)) status = `Attack / ${target.name}<br>${distance(u, target) <= u.range ? 'Circling target / firing whenever ready' : 'Intercepting / circle and fire on arrival'}`;
      }
    }
    if(u?.type==='rock'){
      status=`${titleCase(u.size||'medium')} / mass ${u.mass||2} / impact ${u.damage}<br>`+status;
      const contact=this.ui.predictions.get(u.id)?.collisions?.[0];
      if(contact)status+=`<br>${contact.kind==='smash'?'Shatters':'Deflects'} in ${contact.time.toFixed(1)}s / both paths shown`;
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
    if (!hasHome) $('order-defend').classList.add('hidden');
    $('order-home').classList.toggle('hidden', !hasHome);
    $('selected-actions').classList.toggle('hidden', u?.team === 'player' && u.type === 'planet');
    setText('order-home', mobileFriendly ? 'Colony' : 'Select home colony');
    $('plan').classList.toggle('hidden', !this.ui.pending);
    if (this.ui.pending) {
      const pending = this.ui.pending, f = this.ui.predictions.get(pending.id);
      const target = entity(w, pending.aim?.targetId || pending.order?.targetId);
      $('plan-kind').textContent = pending.impulse ? (w.unlimitedMetal ? 'PLANNED LAUNCH / FREE' : 'PLANNED LAUNCH / 35 METAL') : `PLANNED ${pending.order.kind.toUpperCase()} / ASSISTED FLIGHT`;
      let detail = f?.attachment ? `Attached and waiting in ~${Math.ceil(f.attachment.time)}s` : f?.impact ? `Impact: ${f.impact.name} in ${Math.ceil(f.impact.time)}s` : f?.eta ? `Arrival / range in ~${Math.ceil(f.eta)}s` : '90-second flight preview';
      if (pending.impulse && f && !f.impact && Number.isFinite(f.closest)) detail = `Closest approach: ${Math.max(0, f.closest).toFixed(0)} u in ${Math.ceil(f.closestTime)}s`;
      if (pending.impulse && entity(w, f?.impact?.targetId)?.team === 'player') detail = `WARNING: YOUR COLONY — ${detail}`;
      if (pending.aim && !pending.aim.verified) detail = `NO VERIFIED SHOT / ${pending.aim.reason} ${detail}`;
      $('plan-summary').textContent = `${target ? `${target.name} · ` : ''}${detail}`;
      $('plan-note').textContent = pending.impulse ? '4s powered burn, then coast · booster detaches automatically' : pending.order.kind === 'fit' ? 'Attach for 6s after arrival · stay attached until you launch or detach' : pending.order.kind === 'attack' && target && ['ship', 'booster', 'drone', 'platform'].includes(target.type) ? 'Intercept, then circle in weapon range / keep firing at this target' : 'Moving targets are pursued · weapons can change the outcome';
      if (pending.aim) $('plan-note').textContent = pending.aim.verified ? 'Targeting its future position / confirm to launch, or right-click to revise' : 'Choose another target, aim manually in empty space, or cancel and wait';
      $('confirm').disabled = (!!pending.impulse && !w.unlimitedMetal && w.metal.player < COST.rock) || !!(pending.aim && !pending.aim.verified);
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
    const incoming = Object.values(w.rockThreats || {}).filter(t => entity(w, t.targetId)?.team === 'player' && t.time >= w.time).sort((a, b) => a.time - b.time)[0];
    const major = w.events.filter(e => e.major && e.visibleUntil > performance.now()).at(-1);
    const topThreat = incoming ? `INCOMING ROCK / ${Math.ceil(incoming.time - w.time)}s to ${incoming.name}` : major?.text || '';
    setText('top-threat', topThreat); $('top-threat').classList.toggle('hidden', !topThreat);
    $('alerts').innerHTML = alerts.slice(0, 4).join('');
    $('hint').innerHTML = this.ui.pending ? 'Enter to commit · Esc to cancel<br><span>Time is paused while you plan</span>' : u?.type === 'rock' && !u.launched ? u.boosterTeam === 'player' ? `Right-click a planet to target it<br><span>Empty space: manual aim / ${w.unlimitedMetal ? 'Free launch' : '35 metal'}</span>` : 'Send a booster to earn your shot<br><span>Escort it · Attach · Aim · Launch</span>' : u?.type === 'booster' ? u.attachedRockId ? burning ? 'Booster firing · automatic separation after burn<br><span>The ship will await your next order</span>' : 'Attached and waiting for your order<br><span>Aim rock, then right-click a target / Detach to leave</span>' : 'Right-click a rock to fit a booster<br><span>Stays attached · Detach manually</span>' : 'Select a unit · Right-click for an order<br><span>Enemy: attack / friendly unit: escort or defend</span>';
    this.updateContextHint?.();
    this.updateTutorial();
  }
  showOutcome() {
    this.outcomeShown = true; const win = this.world.outcome === 'victory';
    const training = this.world.scenario === 'garden';
    const body = win ? training ? '<p>A launch of your own, an incoming rock turned to harmless dust. You have the essentials.</p><p>Keep experimenting, or try a colony under siege.</p>' : this.world.scenario === 'hold' ? '<p>Four minutes in the gravity well. Your colony is still here.</p><p>Your defenses held the orbit.</p>' : '<p>Cinder has fallen silent. Verdant has a future among these little worlds.</p>' : '<p>Your colony has lost its integrity. Try holding your defenses closer to home, or intercept the incoming rocks earlier.</p>';
    this.showModal(win ? 'ENCOUNTER COMPLETE' : 'COLONY LOST', win ? training ? 'A little orbital intuition.' : 'The orbit is yours.' : 'Every orbit is another try.', body,
      'Restart game', () => this.load(this.world.scenario, this.world.setup), win ? 'Keep exploring' : 'Review system', () => {
        if (win) { this.world.continueSandbox = true; this.world.mode = 'sandbox'; this.world.outcome = null; this.world.setup = { mode: 'sandbox', system: this.world.planets.length === 3 ? 'three' : 'two', enemies: this.world.planets.some(p => p.team === 'enemy'), budget: 160, unlimited: false, gravity: { ...this.world.gravity }, collisions: { ...this.world.collisions } }; this.closeModal(); }
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
