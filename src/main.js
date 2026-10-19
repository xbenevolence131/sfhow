import { DT, CAP, COST, UPGRADES, upgradeUnit, shipRepairStatus, REPAIR_RATE, MINING_RATE, MINING_DOCK_TIME, ATTACH_TIME, REARM_TIME, GRAVITY_DEFAULTS, COLLISION_DEFAULTS, setCollisions, setGravity, distance, entity, fleet, spawn, setOrder, launchRock, sendPracticeRock, scanRockThreats, predict, step, planRockTarget, aimedContact } from './simulation.js';
import { createGame, SCENARIOS } from './scenarios.js';
import { Renderer } from './render.js';
import { attachInput } from './input.js';
import { attachPlaytestRecorder } from './playtest.js';
import { beginTutorial, skipTutorial, advanceTutorial, tutorialDefenses, prepareTutorialAttack, launchTutorialAttack, sendTutorialPractice } from './tutorial.js';
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
    const positionMapTools=()=>document.documentElement.style.setProperty('--map-tools-bottom',`${innerHeight-$('selection').getBoundingClientRect().top+12}px`);
    this.selectionObserver=new ResizeObserver(positionMapTools);
    this.selectionObserver.observe($('selection'));
    window.addEventListener('resize',positionMapTools);
    requestAnimationFrame(t => this.frame(t));
  }
  modalOpen() { return !$('modal').classList.contains('hidden') || !$('new-game-modal').classList.contains('hidden'); }
  bindUI() {
    $('tutorial-start').onclick = () => {
      if (!this.tutorial || !this.world.lesson) return;
      this.world.lesson.controlsComplete = true;
      this.paused = true; this.accumulator = 0;
      this.cancel(); this.select(null); this.updateUI();
    };
    $('tutorial-skip').onclick = () => { this.tutorial = null; skipTutorial(this.world); this.updateUI(); };
    $('tutorial-attack').onclick = () => {
      const result=launchTutorialAttack(this.world);
      this.paused=true; this.accumulator=0;
      this.toast(result.error || 'Practice attack launched. Unpause to watch your reinforced defenses.');
      this.previewDirty=true; this.processEvents(); this.updateUI();
    };
    $('tutorial-reset').onclick = () => {
      this.paused=true; this.accumulator=0;
      const result=prepareTutorialAttack(this.world);
      if(result.error)this.toast(result.error);
      this.previewDirty=true; this.updateUI();
    };
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
    $('rock-contact').oninput = () => {
      const pending=this.ui.pending;if(pending?.aim?.targetType!=='rock')return;
      const offset=Number($('rock-contact').value)/100;
      pending.aim.offset=offset;pending.aim.verified=false;pending.aim.reason='Recalculating contact point...';
      this.updateUI();clearTimeout(this.contactTimer);
      this.contactTimer=setTimeout(()=>{
        if(this.ui.pending!==pending)return;
        const rock=entity(this.world,pending.id),target=entity(this.world,pending.aim.targetId);
        if(rock && target)this.plan(planRockTarget(this.world,rock,target,offset));
      },100);
    };
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
      this.toast(rock.boosterTeam === 'player' ? 'Booster attached. Right-click a planet or rock to target it, or empty space to aim manually. Then confirm.' : 'This rock needs a booster. Choose Send booster in its panel, then confirm the order.');
    };
    $('selection').onclick = e => {
      const action = e.target.closest('[data-order]')?.dataset.order;
      if (action === 'home') { const home = this.world.planets.find(p => p.team === 'player'); if (home) this.select(home.id); return; }
      const selected = entity(this.world, this.ui.selectedId); if (!selected) return;
      if(action==='upgrade') {
        if(this.ui.pending){this.toast('Confirm or cancel your planned order first.');return;}
        const result=upgradeUnit(this.world,selected.id);
        this.toast(result.error || `${selected.name} upgraded to Super.`);
        this.previewDirty=true;this.updateUI();return;
      }
      if (action === 'detach') {
        const booster = selected.type === 'rock' ? entity(this.world, selected.boosterId) : selected;
        if (booster?.attachedRockId) this.plan({ id: booster.id, order: { kind: 'detach' } });
        return;
      }
      if (action === 'aim') {
        this.select(selected.type === 'rock' ? selected.boosterId : selected.attachedRockId);
        this.toast(selected.type === 'rock' ? 'Controlling booster. Right-click home or a destination to detach and travel. Confirm the order.' : 'Controlling rock. Right-click a planet or rock to target it, or empty space to aim manually. Then confirm.');
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
      const result = this.world.lesson ? sendTutorialPractice(this.world) : sendPracticeRock(this.world);
      if (result.error) { this.toast(result.error); return; }
      this.previewDirty = true; this.processEvents(); this.updateUI();
      if(this.world.lesson) { this.toast('Practice rock launched. Unpause to watch the impact on your undefended colony.'); return; }
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
      pending.aim.verified = !!aimedContact(this.ui.predictions.get(pending.id),pending.aim.targetId);
      if (!pending.aim.verified) pending.aim.reason = 'Gravity changed the shot. Right-click the target to recalculate.';
    }
    this.gravityAdjusted = true; this.updateUI();
  }
  tuneCollisions(settings) {
    this.paused = true; this.accumulator = 0;
    setCollisions(this.world, settings);
    scanRockThreats(this.world); this.processEvents(); this.refreshPredictions();
    const pending=this.ui.pending;
    if(pending?.aim){
      pending.aim.verified=!!aimedContact(this.ui.predictions.get(pending.id),pending.aim.targetId);
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
    if(this.tutorial)beginTutorial(this.world);
    this.seenEvent = 0; this.outcomeShown = false; this.ui.selectedId = key === 'playground' ? this.world.units.find(u => u.type === 'rock').id : this.world.planets[0].id;
    this.ui.hoverId = null; this.ui.pending = null; this.ui.predictions = new Map(); this.ui.baseline = null; this.previewDirty = true;
    this.toastUntil = 0; $('toast').classList.remove('visible'); this.renderer.fit(); $('scenario').value = key;
    const open = this.world.mode !== 'scenario', sandbox = this.world.mode === 'sandbox';
    const briefing = open ? `<p>${sandbox ? 'An open playground. Explore trajectories, deploy fleets, and take your time. There are no victory or defeat screens.' : 'Protect Verdant and destroy Cinder. Both sides pay the same prices and earn metal from their colony. Occasional natural asteroids cross the system; watch for warnings. There is no time limit.'}</p><p>${this.world.planets.length} planets. ${this.world.setup.enemies ? 'An AI rival occupies Cinder.' : 'No enemy fleet; the other worlds are uninhabited targets.'} ${this.world.unlimitedMetal ? 'Your deployments and launches are free.' : `Starting budget: ${this.world.setup.budget} metal.`}</p><p>Rocks still need booster ships. Prepare, preview, and launch. New game lets you choose another mode at any time.</p>` : SCENARIOS[key].body;
    if(welcome)this.showWelcome();
    else this.showModal(open ? 'OPEN SYSTEM' : SCENARIOS[key].kicker, open ? titleCase(this.world.mode) : SCENARIOS[key].name, briefing, 'Enter the system', () => {
      this.closeModal(); this.toast('The system is paused. Plan an order, or press Space to let time flow.');
    });
    this.updateUI();
  }
  showWelcome() {
    this.showModal('ORBITAL WARFARE', 'Welcome to Stones from Heaven',
      '<p>Prepare asteroids, bend trajectories around moving worlds, and protect your colony. Make a small decision, preview its path, and watch the consequences unfold.</p><ul class="welcome-directions"><li><b>Scenario</b><br>Use the dropdown at the upper left to choose a ready-made challenge or playground.</li><li><b>New game</b><br>Explore Scenarios, Skirmish, and Sandbox with different starting options.</li></ul><p class="note">Rock Garden is ready behind this welcome. Take your time: the system starts paused.</p>',
      'Start tutorial',()=>{ this.tutorial = { stage: '' }; beginTutorial(this.world); this.ui.selectedId = null; this.closeModal(); },
      'Explore freely',()=>{this.closeModal();$('scenario').focus();});
  }
  updateTutorial() {
    const w = this.world, active = !!this.tutorial && w.scenario === 'garden' && w.mode === 'scenario';
    $('tutorial').classList.toggle('hidden', !active);
    document.querySelectorAll('.tutorial-focus').forEach(el => el.classList.remove('tutorial-focus'));
    this.ui.tutorialId = null;
    this.ui.tutorialAction = '';
    $('tutorial-start').classList.add('hidden');
    $('tutorial-attack').classList.add('hidden'); $('tutorial-reset').classList.add('hidden');
    if (!active) return;
    const selected = entity(w, this.ui.selectedId), pending = this.ui.pending;
    const booster = w.units.find(u => u.type === 'booster' && u.team === 'player' && u.hp > 0 && u.loaded);
    const attached = w.units.find(u => u.type === 'rock' && u.hp > 0 && u.boosterTeam === 'player' && !u.launched);
    const fitting = w.units.find(u => u.type === 'booster' && u.team === 'player' && u.hp > 0 && u.order?.kind === 'fit');
    const practice = w.units.some(u => u.hp > 0 && u.practice && (u.type === 'rock' || u.order?.kind === 'fit'));
    const burning = w.units.find(u => u.hp > 0 && u.type === 'rock' && u.team === 'player' && u.burn?.remaining > 0);
    let stage, title, copy, highlight, target, action='WATCH';
    const lesson=w.lesson;
    if (!lesson?.controlsComplete) {
      stage=-1; title='Select, then act'; highlight='selection';
      copy='Left-click an object to select it; click it again or click empty space to clear selection. Right-click a target or empty space to preview the selected object\'s default action, then Confirm to give the order. The magenta-outlined panel at the bottom right shows details and extra actions for the selected unit. Try selecting a few objects while paused, then click Start flying.';
      $('tutorial-start').classList.remove('hidden');
    } else if (lesson?.phase==='complete') {
      stage=15; title='You know the essentials'; copy='You launched and reloaded, built defenses, intercepted an attack, destroyed a launcher, and overcame a defended colony. Keep exploring, or choose another scenario.'; highlight='scenario';
    } else if(lesson?.phase==='assault') {
      const enemy=entity(w,lesson.assaultTargetId);
      const units=fleet(w,'player'), boosters=units.filter(u=>u.type==='booster'), ships=units.filter(u=>u.type==='ship');
      const equipped=w.units.filter(u=>u.hp>0 && u.type==='rock' && !u.launched && u.boosterTeam==='player');
      const launched=lesson.assaultLaunches || 0;
      if(!launched && (boosters.length<2 || ships.length<3)) {
        stage=12;title='Build your assault fleet';
        copy=`Ochre now has two platforms and three ramming drones. You received 500 metal. Build up to two boosters and three ships: ${boosters.length}/2 boosters, ${ships.length}/3 ships. Save metal for 35-metal launches.`;
        if(selected?.id!=='verdant'){target='verdant';action='LEFT-CLICK';copy+=' Select Verdant to build.';}
        else {
          const type=boosters.length<2?'booster':'ship';
          document.querySelector(`[data-build="${type}"]`).classList.add('tutorial-focus');
          copy+=type==='booster'?' Build another Booster (50 metal).':' Build another Ship (60 metal).';
          if(w.metal.player<COST[type]){copy+=' Unpause to earn more metal.';highlight=this.paused?'pause':null;}
        }
      } else if(!launched && equipped.length<2) {
        stage=13;title='Prepare two rocks';
        copy=`Ready: ${equipped.length}/2 rocks. Send your two loaded boosters to different free asteroids. Preparing both before firing lets you launch a volley while paused.`;
        if(pending?.order){highlight='confirm';copy+=' Confirm the order, then unpause to travel.';}
        else if(selected?.type==='booster' && selected.team==='player' && !selected.attachedRockId && !['fit','rearm'].includes(selected.order.kind)) {
          if(!selected.loaded){target='verdant';action='RIGHT-CLICK';copy+=' This booster is spent: right-click Verdant to return and refuel.';}
          else {
            const reserved=new Set(boosters.filter(u=>u.order.kind==='fit').map(u=>u.order.targetId));
            const rock=w.units.filter(u=>u.hp>0 && u.type==='rock' && !u.launched && !u.boosterTeam && !reserved.has(u.id)).sort((a,b)=>distance(selected,a)-distance(selected,b))[0];
            target=rock?.id;action='RIGHT-CLICK';copy+=' Right-click the marked free rock.';
          }
        } else {
          const available=boosters.find(u=>!u.attachedRockId && !['fit','rearm'].includes(u.order.kind));
          const traveling=boosters.find(u=>['fit','rearm'].includes(u.order.kind));
          target=(available||traveling)?.id;action=available?'LEFT-CLICK':'WATCH';
          if(available)copy+=' Select the marked booster.';
          else {copy+=' Unpause while the boosters travel, attach, or reload.';highlight=this.paused?'pause':null;}
        }
      } else {
        stage=14;title='Overwhelm Ochre';
        const attacking=ships.filter(u=>u.order.kind==='attack').length;
        copy=`Ochre: ${Math.ceil(enemy?.hp || 0)}/240 integrity. Rocks launched: ${launched}. Ships attacking: ${attacking}. Launch several rocks close together and send ships alongside them. Drones are consumed; platforms need time between shots.`;
        if(pending?.aim && !pending.aim.verified){highlight='cancel';copy+=' This shot has no verified route. Cancel, let the system move for a few seconds, then try Ochre again or aim manually.';}
        else if(pending){highlight='confirm';copy+=' Confirm this order, then plan the next while paused.';}
        else if(selected?.type==='rock' && equipped.some(r=>r.id===selected.id)) {
          target=enemy?.id;action='RIGHT-CLICK';copy+=' Right-click Ochre to aim. Check the arrival time; confirm, then aim the second rock before resuming.';
        } else if(selected?.type==='ship' && selected.team==='player') {
          const next=selected.order.kind==='attack'?ships.find(u=>u.order.kind!=='attack'):null;
          if(next){target=next.id;action='LEFT-CLICK';copy+=' This ship has its attack order. Select the next marked ship and give it an attack order too.';}
          else {target=enemy?.id;action=selected.order.kind==='attack'?'WATCH':'RIGHT-CLICK';copy+=' Right-click Ochre to bombard it, or target a defense platform to clear the way. Unpause once your fleet has its orders.';if(this.paused && selected.order.kind==='attack')highlight='pause';}
        } else if(equipped.length) {
          target=equipped[0].id;action='LEFT-CLICK';copy+=' Select the marked equipped rock to aim your next shot.';
        } else {
          const idle=ships.find(u=>u.order.kind!=='attack');target=idle?.id||enemy?.id;action=idle?'LEFT-CLICK':'WATCH';
          copy+=' Return spent boosters home, reload, and prepare more rocks if needed. Keep building ships or boosters at Verdant if you lose them.';
          if(this.paused)highlight='pause';
        }
      }
    } else if(lesson?.phase==='combat') {
      stage=11;
      const enemy=entity(w,lesson.targetId), attacker=entity(w,lesson.attackerId);
      if(attacker?.order?.kind==='attack' && attacker.order.targetId===enemy?.id) {
        title='Destroy the enemy booster'; target=enemy?.id; highlight=this.paused?'pause':null;
        copy='Attack confirmed. Unpause to watch your ship approach, track, and fire automatically. Destroy this booster to continue. Your surviving defenses keep guarding home.';
      } else if(pending?.order?.kind==='attack' && pending.order.targetId===enemy?.id) {
        title='Confirm the attack'; highlight='confirm'; copy='Review the pursuit path, then Confirm or press Enter. Your ship will stay on this target until it is destroyed or you change its order.';
      } else if(selected?.type==='ship' && selected.team==='player') {
        title='Target the enemy booster'; target=enemy?.id; action='RIGHT-CLICK'; copy='Right-click the magenta-ringed enemy booster to preview an attack order.';
      } else {
        const ship=w.units.find(u=>u.hp>0 && u.type==='ship' && u.team==='player');
        title=ship?'Select a combat ship':'Deploy a combat ship'; target=ship?.id || 'verdant'; action='LEFT-CLICK';
        copy=ship?'Your new defenses stopped the second rock. Left-click your combat ship, then attack the marked enemy booster. A replacement is provided if the original launcher was lost.':'Select Verdant, then build a Ship in the bottom dock to continue the attack lesson.';
      }
    } else if(lesson?.phase==='fortify') {
      const defenses=tutorialDefenses(w), ready=defenses.platforms>=1 && defenses.drones>=2 && defenses.ships>=1;
      stage=ready?9:8; title=ready?'Test your new defenses':'Build defenses at Verdant';
      $('tutorial-reset').classList.remove('hidden');
      if(ready) {
        $('tutorial-attack').classList.remove('hidden'); highlight='tutorial-attack';
        copy='Your platform, two drones, and ship are ready. Click Launch practice attack, then unpause. This is the same kind of rock that hit before: watch your new defenses stop it.';
        target=lesson.rockId;
      } else if(selected?.id!=='verdant') {
        target='verdant'; action='LEFT-CLICK'; copy='The first rock damaged your undefended colony. You received 210 metal. Left-click Verdant to build defenses and a combat ship before trying another attack.';
      } else {
        const type=defenses.platforms<1?'platform':defenses.drones<2?'drone':'ship';
        document.querySelector(`[data-build="${type}"]`).classList.add('tutorial-focus');
        copy=`Build one Platform (100 metal), two Drones (25 each), and one Ship (60). Built: ${Math.min(1,defenses.platforms)}/1 platform, ${Math.min(2,defenses.drones)}/2 drones, ${Math.min(1,defenses.ships)}/1 ship. Platforms fire reusable guns; drones ram and sacrifice themselves. Keep the ship home for this test.`;
        if(w.metal.player<COST[type]) {copy+=' Unpause to earn the missing metal.';highlight=this.paused?'pause':null;}
      }
    } else if(lesson?.phase==='defense' || lesson?.phase==='retry') {
      stage=10; title=lesson.phase==='retry'?'Try the defense test again':'Watch the interception';
      target=entity(w,lesson.rockId)?.id; highlight=this.paused?'pause':'ranges';
      copy='Unpause and watch your platform and drones engage. Platforms shoot; drones fly out and sacrifice themselves on contact. Watch the rock lose integrity.';
      if(lesson.phase==='retry') {
        $('tutorial-reset').classList.remove('hidden');highlight='tutorial-reset';
        copy='That rock was not intercepted. Keep your defenders at Verdant and prepare another attack. Your surviving reinforcements still count.';
      }
    } else if (w.progress.launched) {
      if (burning) {
        stage=4; title='Let your rock fly'; target=burning.id; highlight=this.paused ? 'pause' : null;
        copy=this.paused ? 'Launch confirmed. Press Space or Play to fire the booster. Watch the four-second burn and automatic separation before returning your booster home to refuel.' : 'Your booster is accelerating the rock. After four seconds it detaches, leaving the rock to coast under gravity.';
      } else if (!lesson.refuelled) {
        stage=5;
        const returning=entity(w,lesson.returnBoosterId);
        if(!returning) {
          title='Replace your lost booster'; target='verdant'; action='LEFT-CLICK';
          copy='The launch booster was lost. Select Verdant and build a replacement Booster, then send it home to complete refuelling.';
          if(selected?.id==='verdant')document.querySelector('[data-build="booster"]').classList.add('tutorial-focus');
        } else if(returning.order.kind==='rearm' || returning.departureOrder?.kind==='rearm') {
          title=returning.rearmProgress>0?'Refuelling at Verdant':'Return to refuel'; target=returning.id; highlight=this.paused?'pause':null;
          copy=returning.rearmProgress>0?`Refuelling: ${Math.ceil(REARM_TIME-returning.rearmProgress)} seconds remaining. Keep time running. Reloading is free; the next lesson opens when the booster is ready.`:'Order confirmed. Unpause to fly home. The booster automatically refuels for eight seconds after arriving at Verdant.';
        } else if(pending?.id===returning.id && pending.order?.kind==='rearm') {
          title='Confirm the return home'; highlight='confirm'; copy='Confirm or press Enter, then unpause. Your booster will return to Verdant and refuel automatically. Escape cancels the preview.';
        } else if(selected?.id===returning.id) {
          title='Send your booster home'; target='verdant'; action='RIGHT-CLICK'; copy='Right-click Verdant inside the magenta circle to preview Return and reload. Then confirm the order.';
        } else {
          title='Select your spent booster'; target=returning.id; action='LEFT-CLICK'; copy='The burn is finished and your booster has detached. Left-click the marked booster, then right-click Verdant to send it home for refuelling.';
        }
      } else if (practice) {
        stage=7; title='Watch the colony impact'; copy='Your colony has no defenses yet. Watch this incoming rock hit Verdant and reduce its integrity. Next you will build defenses and repeat the test.'; highlight=this.paused ? 'pause' : 'ranges';
        target=w.units.find(u=>u.hp>0 && u.practice && u.type==='rock')?.id || w.units.find(u=>u.hp>0 && u.practice && u.order?.kind==='fit')?.id;
        if(this.paused) copy+=' Press Space to let time flow. Threat pause may pause fast-forward again.';
      } else {
        stage=6; title='Try an incoming attack'; copy='Click Send practice rock below. An enemy booster will fire a real incoming shot. Your colony is undefended: this first hit shows why defenses matter.'; highlight='practice';
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
    setText('tutorial-step', stage===-1 ? 'TUTORIAL / STEP 0' : stage===15 ? 'TUTORIAL COMPLETE' : `TUTORIAL / ${stage+1} OF 15`);
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
      '<ul><li><b>Left-click</b> to select. Click it again or empty space to clear selection. <b>Right-click</b> to plan an order; <b>Enter</b> confirms, <b>Esc</b> cancels.</li><li><b>Prepare a rock:</b> untouched rocks follow stable belt orbits until launched or struck. Select it and choose Send booster, or select a booster ship and right-click the rock. Attachment takes 6 seconds after arrival.</li><li><b>Launch:</b> select an equipped rock and right-click a planet to calculate a shot toward its future position. Right-click empty space for manual aim; confirm for 35 metal (free with unlimited metal). Drag aiming also works. The booster fires for 4 seconds, then detaches automatically and awaits orders. Choose Return home to reload in 8 seconds at no extra cost. You can detach manually before launching.</li><li><b>Context orders:</b> a combat ship attacks enemies, escorts friendly mobile units, and defends friendly planets or platforms. A booster attaches to free rocks and returns to a friendly colony to reload. Hover for the action hint.</li><li><b>Right-click</b> a friendly planet or platform with a ship or drone to defend it. Drones ram rocks and hostile units in their assigned local area, sacrificing themselves for 45 damage. Platforms keep firing reusable guns.</li><li><b>Space</b> pauses. <b>1 / 2 / 3</b> select 1× / 5× / 20×. Scroll to zoom; drag empty space to pan; <b>F</b> fits the system.</li></ul><p>Booster ships cost 50 metal and are unarmed. Select your colony to deploy. Income is 0.8 metal / second; fleet limit 12. Launched rocks damage any planet, including your own. Defenses intercept your rocks when they threaten home. Ship weapons do not fire on friendly ships or colonies.</p><p><b>Repairs:</b> combat ships recover 1 health per second for free within 100 units of their own home planet surface, after 10 seconds without taking damage. Both sides can repair; leaving home pauses recovery. Destroyed ships cannot recover.</p><p><b>Mining:</b> miners cost 25 metal, are unarmed, and share the fleet limit. Right-click an idle asteroid, confirm, and dock for 4 seconds. Each miner earns 0.8 metal per second directly into your treasury. One miner per asteroid. Right-click to leave; launching the asteroid releases the miner. A destroyed asteroid destroys its docked miner. Select a warship and right-click the miner to escort it.</p><p><b>Upgrades:</b> each ship, platform or drone can become Super once, using the selected-unit panel. Review the stats and price before buying: ship 25, platform 32.5, drone 10 metal. Super units and shots use a darker faction color and units carry a double-chevron marker. Existing damage is preserved proportionally. No research tree.</p><p><b>Rock collisions:</b> small, medium, and large rocks have masses 1, 2, and 4 and colony damage 35, 65, and 100. All fall equally under gravity. Glancing hits deflect; hard hits shatter both rocks and any attached boosters, leaving harmless debris. Collision tuning adjusts rebound and rock strength, pauses time, and redraws both paths. Violet paths show other rocks after contact. Restart keeps tuning.</p><p><b>Gravity:</b> adjust G, shared planet mass, or sun mass in the left-hand controls. Changes pause time and redraw paths. G and sun mass set planetary orbital speed; radii and current positions stay fixed. Planet mass changes its pull on units, not its own orbital speed. Free-flying units keep their velocities. Reset restores defaults; restarting retains tuning, while New game starts at defaults.</p><p class="note">Teal launch segments show powered flight; gold shows coasting. Ship paths end when attachment completes. Predictions normally cover 90 seconds; difficult targeted rock shots try up to 120 seconds. Weapons and future enemy decisions can change the outcome.</p>',
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
    if (pending.aim && !pending.aim.verified) { this.toast('No verified impact. Right-click empty space to aim manually, choose another target, or cancel and wait.'); return; }
    if (pending.impulse) {
      const result = launchRock(this.world, pending.id, pending.impulse);
      if (result.error) { this.toast(result.error); return; }
      if(pending.aim?.horizon>90)entity(this.world,pending.id).previewUntil=this.world.time+pending.aim.horizon;
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
    else { if(type==='booster' && this.world.lesson && !entity(this.world,this.world.lesson.returnBoosterId) && this.world.progress.launched)this.world.lesson.returnBoosterId=result.id; if(this.world.lesson?.phase==='fortify')this.world.lesson.builtIds.push(result.id); this.toast(`${titleCase(type)} deployed at ${host.name}. Defending its local orbit.`); this.previewDirty = true; }
    this.updateUI();
  }
  refreshPredictions() {
    const w = this.world, ids = new Set();
    const selected = entity(w, this.ui.selectedId);
    if (selected && selected.type !== 'planet') ids.add(selected.id);
    for (const u of w.units) if (u.hp > 0 && (u.visitor || (u.team === 'enemy' && (u.type === 'rock' || u.order?.kind === 'attack')) || entity(w, w.rockThreats?.[u.id]?.targetId)?.team === 'player' || (this.ui.allPaths && (u.type !== 'rock' || u.launched)))) ids.add(u.id);
    const horizon=Math.min(120,Math.max(90,this.ui.pending?.aim?.horizon||0,(selected?.previewUntil||0)-w.time));
    this.ui.predictions = predict(w, [...ids], this.ui.pending,horizon);
    this.ui.baseline = this.ui.pending?.impulse ? predict(w, [this.ui.pending.id],null,horizon).get(this.ui.pending.id) : null;
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
    if(w.lesson?.phase==='assault')setText('objective','Overwhelm Ochre: coordinate rocks and ships. Destroy its colony.');
    const miningIncome=w.units.filter(m=>m.type==='miner'&&m.team==='player'&&m.hp>0&&m.miningRockId&&entity(w,m.miningRockId)?.metalRemaining>0&&!entity(w,m.miningRockId).launched).length*MINING_RATE;
    setText('income-hint', playground ? 'Free launches / defenders only engage fired rocks' : w.unlimitedMetal ? 'Unlimited metal / fleet limit 12' : `+0.8 metal / second from your colony${miningIncome?` / +${miningIncome.toFixed(1)} from miners`:''}`);
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
    $('practice').classList.toggle('hidden', !!w.lesson && (w.lesson.phase!=='basics' || !w.lesson.refuelled));
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
      if (u.type === 'planet') status = u.team === 'player' ? playground ? 'Your colony / friendly defenders<br>Ship, platform, and two drones guard home.' : 'Your colony · +0.8 metal / s<br>Select a unit below to deploy in orbit.' : u.team === 'enemy' ? playground ? 'Defended target / ship, platform, two drones<br>Launch a rock to test their interception.' : 'Rival colony · ships can bombard it.' : 'Uninhabited · a safe target for practice.';
      else if (u.type === 'rock') {
        const fitter = w.units.find(b => b.hp > 0 && b.order?.kind === 'fit' && b.order.targetId === u.id);
        status = u.burn?.remaining > 0 ? `Powered burn · ${Math.ceil(u.burn.remaining)}s left<br>Booster detaches automatically · then coasting` : u.launched ? `Ballistic flight · ${u.deflected ? 'redirected by collision' : u.team === 'enemy' ? 'incoming threat' : 'launch committed'}<br>${forecast?.impact ? `Impact: ${forecast.impact.name} in ${Math.ceil(forecast.impact.time)}s` : forecast && Number.isFinite(forecast.closest) ? `Closest approach: ${Math.max(0, forecast.closest).toFixed(0)} u in ${Math.ceil(forecast.closestTime)}s` : 'Forecast horizon: 90 seconds'}` : u.boosterTeam ? `${u.boosterTeam === 'player' ? 'Your booster attached · ready to launch' : 'Enemy booster attached · destroy this rock'}<br>${u.boosterTeam === 'player' ? (w.unlimitedMetal ? 'Right-click to aim / free launch' : 'Right-click to aim / launch for 35 metal') : 'An enemy launch is being prepared'}` : fitter ? `${fitter.team === 'enemy' ? 'Enemy' : 'Your'} booster ${fitter.attachProgress > 0 ? `attaching · ${Math.ceil(ATTACH_TIME - fitter.attachProgress)}s left` : 'en route'}<br>${fitter.team === 'player' ? 'Escort it with a combat ship' : 'Intercept the booster before it finishes'}` : 'No booster attached · launch unavailable<br>Send a booster ship to prepare this rock.';
      }
      else if(u.type==='miner'){
        const rock=entity(w,u.miningRockId||u.order?.targetId);
        status=u.miningRockId && !(rock?.metalRemaining>0)?'Asteroid depleted / income stopped<br>Right-click another asteroid to resume mining':u.miningRockId?`Mining ${rock?.name||'asteroid'} / +${MINING_RATE} metal per second<br>Direct to treasury / right-click to leave`:u.order.kind==='mine'?`En route to ${rock?.name||'asteroid'}${u.miningProgress?` / docking ${Math.ceil(MINING_DOCK_TIME-u.miningProgress)}s`:''}<br>Unarmed / escort with a warship`:'Unarmed asteroid miner<br>Right-click an idle rock to dock and mine';
      }
      else if (u.type === 'booster') {
        const target = entity(w, u.order?.targetId);
        status = target?.burn?.remaining > 0 && u.attachedRockId ? `Firing · ${Math.ceil(target.burn.remaining)}s left<br>${u.departureOrder ? 'Departure queued after burn' : 'Right-click a destination to queue departure'}` : u.attachedRockId ? `Attached to ${target?.name || 'rock'} · ${u.loaded ? 'ready to launch' : 'charge spent'}<br>${u.loaded ? 'Select rock to aim / Right-click to detach and travel' : 'Right-click home to detach and rearm'}` : u.order.kind === 'fit' ? `${u.attachProgress > 0 ? `Attaching · ${Math.ceil(ATTACH_TIME - u.attachProgress)}s left` : `En route → ${target?.name || 'rock'}`}<br>Unarmed · one booster loaded` : u.order.kind === 'rearm' ? `${u.rearmProgress > 0 ? `Rearming · ${Math.ceil(REARM_TIME - u.rearmProgress)}s left` : 'Returning home to rearm'}<br>Unarmed · automatic reload at colony` : `${u.loaded ? 'One booster loaded · ready' : (playground ? 'Charge spent / reset range for more' : 'Charge spent · awaiting orders')}<br>${u.loaded ? 'Right-click a free rock to attach' : (playground ? 'Reset restores rocks and attached boosters' : 'Choose Return home to reload')}`;
      }
      else {
        const target = entity(w, u.order?.targetId);
        status = u.type === 'platform' ? `Local defense · ${u.range} u weapon range` : `${titleCase(u.order?.kind || 'idle')}${target ? ` → ${target.name}` : ''}<br>${u.type === 'drone' ? `Rams rocks and hostile ships / ${u.damage} damage<br>Consumed on contact / defends within ${u.defenseRadius||180} u` : forecast?.eta ? `Arrival / weapons range in ~${Math.ceil(forecast.eta)}s` : 'Right-click to plan a new order'}`;
        if(u.type==='ship' && u.order?.kind==='defend' && target && target.type!=='planet')status=`Escort / ${target.name}<br>Following unit / engaging nearby threats`;
        if (u.type === 'ship' && u.order?.kind === 'attack' && target && ['ship', 'booster', 'miner', 'drone', 'platform'].includes(target.type)) status = `Attack / ${target.name}<br>${distance(u, target) <= u.range ? 'Tracking target / firing whenever ready' : 'Closing into weapon range'}`;
        if (u.type === 'ship' && u.order?.kind === 'attack' && target?.type === 'rock') status = `Attack / ${target.name}<br>${distance(u,target)<=u.range*.95?'Braking to fire / holding weapon range':'Intercepting / seeking firing range'}`;
      }
    }
    if(u?.type==='miner'){const rock=entity(w,u.miningRockId||u.order?.targetId);if(rock?.type==='rock')status+=`<br>Metal remaining: ${Math.max(0,rock.metalRemaining||0).toFixed(1)} / ${rock.metalCapacity||0}`;}
    if(u?.type==='rock'){
      status=`${titleCase(u.size||'medium')} / mass ${u.mass||2} / impact ${u.damage}<br>`+status;
      const miner=entity(w,u.minerId);if(miner)status+=`<br>${miner.team==='player'?'Your':'Enemy'} miner / ${u.metalRemaining>0?`+${MINING_RATE} metal per second`:'depleted'}`;
      status+=`<br>Metal remaining: ${Math.max(0,u.metalRemaining||0).toFixed(1)} / ${u.metalCapacity||0}${u.metalRemaining>0?'':' / DEPLETED'}`;
      if(!u.launched && u.beltOrbit)status+=' <br>Stable orbit / launch or impact releases it.';
      const contact=this.ui.predictions.get(u.id)?.collisions?.[0];
      if(contact)status+=`<br>${contact.kind==='smash'?'Shatters':'Deflects'} in ${contact.time.toFixed(1)}s / both paths shown`;
    }
    const repair=shipRepairStatus(w,u);
    if(repair)status+=`<br>${repair.kind==='repairing'?`Repairing at home / +${REPAIR_RATE} health per second`:repair.kind==='waiting'?`Home repairs in ${Math.ceil(repair.remaining)}s without damage`:repair.kind==='away'?'Return home for free repairs':'Home repairs unavailable'}`;
    const upgrade=UPGRADES[u?.type];
    if(upgrade && u)status+=`<br>${u.tier===2?'SUPER':'BASIC'} / ${u.damage} damage / ${u.type==='drone'?`${u.speed} speed`:`${u.range} range / shot every ${u.cooldown}s`}`;
    setText('selected-name', u?.name || 'THE SYSTEM IS YOURS');
    const canUpgrade=u?.team==='player' && upgrade && u.tier!==2 && !(w.outcome && !w.continueSandbox);
    $('unit-upgrade').classList.toggle('hidden',!canUpgrade);
    if(canUpgrade){
      const price=w.unlimitedMetal?0:upgrade.cost;
      setText('order-upgrade',`Upgrade to Super / ${price} metal`);
      $('order-upgrade').disabled=w.metal.player<price || !!this.ui.pending;
      $('order-upgrade').title=this.ui.pending?'Confirm or cancel your planned order first.':w.metal.player<price?'Not enough metal.':'Upgrade this unit. Existing damage is preserved proportionally.';
      setText('upgrade-details',u.type==='drone'?`Speed ${u.speed} ? ${upgrade.speed} ? Defense area ${u.defenseRadius||180} ? ${upgrade.defenseRadius} ? Ram ${u.damage} ? ${upgrade.damage}`:`Range ${u.range} ? ${upgrade.range} ? Damage ${u.damage} ? ${upgrade.damage} ? Shot ${u.cooldown}s ? ${upgrade.cooldown}s ? Armor ${u.maxHp} ? ${upgrade.maxHp}${u.type==='ship'?` ? Speed ${u.speed} ? ${upgrade.speed}`:''}`);
    }
    setText('selected-health', u ? `${Math.ceil(u.hp)} / ${u.maxHp}` : '');
    // Cache source text rather than comparing browser-normalized HTML (& -> &amp;).
    if (this.selectedStatus !== status) { $('selected-meta').innerHTML = status; this.selectedStatus = status; }
    const attachedBooster = u?.type === 'booster' && u.attachedRockId ? u : u?.type === 'rock' ? entity(w, u.boosterId) : null;
    const mobileFriendly = u?.team === 'player' && ['ship', 'drone', 'booster', 'miner'].includes(u.type) && !u.attachedRockId;
    const burning = !!entity(w, attachedBooster?.attachedRockId)?.burn?.remaining;
    $('order-detach').classList.toggle('hidden', !(attachedBooster?.team === 'player' && attachedBooster.attachedRockId) || burning);
    $('order-aim').classList.toggle('hidden', !attachedBooster?.attachedRockId);
    setText('order-aim', u?.type === 'rock' ? 'Select booster' : 'Select rock');
    $('order-fit').classList.toggle('hidden', !(u?.type === 'rock' && !u.launched && !u.boosterTeam));
    $('order-fit').disabled = !fleet(w, 'player').some(b => b.type === 'booster' && b.loaded && !b.attachedRockId && b.order.kind !== 'fit');
    $('order-defend').classList.toggle('hidden', !mobileFriendly);
    setText('order-defend', ['booster','miner'].includes(u?.type) ? 'Return home' : 'Defend home');
    $('order-stop').classList.toggle('hidden', !mobileFriendly);
    if (!hasHome) $('order-defend').classList.add('hidden');
    $('order-home').classList.toggle('hidden', !hasHome);
    $('selected-actions').classList.toggle('hidden', u?.team === 'player' && u.type === 'planet');
    setText('order-home', mobileFriendly ? 'Colony' : 'Select home colony');
    $('plan').classList.toggle('hidden', !this.ui.pending);
    $('rock-contact-controls').classList.toggle('hidden',this.ui.pending?.aim?.targetType!=='rock');
    if (this.ui.pending) {
      const pending = this.ui.pending, f = this.ui.predictions.get(pending.id);
      const target = entity(w, pending.aim?.targetId || pending.order?.targetId);
      $('plan-kind').textContent = pending.impulse ? (w.unlimitedMetal ? 'PLANNED LAUNCH / FREE' : 'PLANNED LAUNCH / 35 METAL') : `PLANNED ${pending.order.kind.toUpperCase()} / ASSISTED FLIGHT`;
      let detail = f?.attachment ? `Attached and waiting in ~${Math.ceil(f.attachment.time)}s` : f?.impact ? `Impact: ${f.impact.name} in ${Math.ceil(f.impact.time)}s` : f?.eta ? `Arrival / range in ~${Math.ceil(f.eta)}s` : `${pending.aim?.horizon||90}-second flight preview`;
      if(pending.order?.kind==='mine' && f?.attachment)detail=`Dock and start mining in ~${Math.ceil(f.attachment.time)}s`;
      if (pending.impulse && f && !f.impact && Number.isFinite(f.closest)) detail = `Closest approach: ${Math.max(0, f.closest).toFixed(0)} u in ${Math.ceil(f.closestTime)}s`;
      if (pending.impulse && entity(w, f?.impact?.targetId)?.team === 'player') detail = `WARNING: YOUR ${entity(w,f.impact.targetId).type==='platform'?'PLATFORM':'COLONY'} — ${detail}`;
      if (pending.aim && !pending.aim.verified) detail = `NO VERIFIED SHOT / ${pending.aim.reason} ${detail}`;
      $('plan-summary').textContent = `${target ? `${target.name} · ` : ''}${detail}`;
      $('plan-note').textContent = pending.impulse ? '4s powered burn, then coast · booster detaches automatically' : pending.order.kind === 'fit' ? 'Attach for 6s after arrival · stay attached until you launch or detach' : pending.order.kind === 'attack' && target && ['ship', 'booster', 'miner', 'drone', 'platform'].includes(target.type) ? 'Close into weapon range, then track and fire at this target' : 'Moving targets are pursued · weapons can change the outcome';
      if(pending.order?.kind==='mine')$('plan-note').textContent=`Dock for ${MINING_DOCK_TIME}s, then +${MINING_RATE} metal per second directly to your treasury`;
      const departing = entity(w, pending.id);
      if (pending.order && departing?.attachedRockId) $('plan-note').textContent = entity(w, departing.attachedRockId)?.burn?.remaining > 0 ? 'Finish the burn, then detach and follow this order / Escape cancels' : 'Detach from the rock, then follow this order / Escape cancels';
      if (pending.aim) $('plan-note').textContent = pending.aim.verified ? 'Targeting its future position / confirm to launch, or right-click to revise' : 'Choose another target, aim manually in empty space, or cancel and wait';
      if(pending.aim?.targetType==='rock') {
        const offset=pending.aim.offset||0,contact=aimedContact(f,pending.aim.targetId);
        $('rock-contact').value=Math.round(offset*100);
        setText('rock-contact-value',offset===0?'Centre':`${Math.round(Math.abs(offset)*100)}% ${offset<0?'left':'right'}`);
        if(contact){
          $('plan-summary').textContent=`${target?.name || 'Rock'} / ${contact.kind==='smash'?'SMASH: both rocks shatter':'DEFLECT: both paths shown'} in ${contact.time.toFixed(1)}s`;
          $('plan-note').textContent='Drag contact point for a glancing hit. Gold: launched rock / violet: struck rock. Confirm to launch.';
        } else if(pending.aim.verified) {
          $('plan-note').textContent='Intercept solution found; defenses or another collision may stop it. Preview shows the current outcome.';
        }
      }
      $('confirm').disabled = (!!pending.impulse && !w.unlimitedMetal && w.metal.player < COST.rock) || !!(pending.aim && !pending.aim.verified);
    }
    const threats = w.units.filter(u => u.hp > 0 && (u.visitor || (u.team === 'enemy' && (u.type === 'rock' || ['attack', 'fit'].includes(u.order?.kind))) || (u.type === 'rock' && u.launched && entity(w, w.rockThreats?.[u.id]?.targetId)?.team === 'player')));
    threats.sort((a, b) => (w.rockThreats?.[a.id]?.time ?? Infinity) - (w.rockThreats?.[b.id]?.time ?? Infinity));
    let alerts = threats.filter(u => u.type === 'rock').slice(0, 3).map(r => {
      const f = this.ui.predictions.get(r.id);
      const impact = f?.impact || (w.rockThreats?.[r.id] ? { ...w.rockThreats[r.id], time: w.rockThreats[r.id].time - w.time } : null);
      return `<div class="alert">↘ ${r.name} / ${r.visitor ? 'NATURAL ASTEROID' : r.team === 'player' ? 'FRIENDLY ROCK — DANGER' : r.launched ? 'INCOMING' : 'ARMED'}<small>${!r.launched ? 'Booster attached · destroy it before launch' : impact ? `Predicted ${impact.name} impact in ${Math.ceil(Math.max(0, impact.time))}s` : r.burn?.remaining > 0 ? `Powered burn · ${Math.ceil(r.burn.remaining)}s left` : r.visitor ? (r.beltArrivalAt>w.time ? `Reaches belt in ~${Math.ceil(r.beltArrivalAt-w.time)}s` : 'Crossing the system / no colony impact predicted') : 'Ballistic approach · defenses engaging in range'}</small></div>`;
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
    $('hint').innerHTML = this.ui.pending ? 'Enter to commit · Esc to cancel<br><span>Time is paused while you plan</span>' : u?.type === 'rock' && !u.launched ? u.boosterTeam === 'player' ? `Right-click a planet or rock to target it<br><span>Empty space: manual aim / ${w.unlimitedMetal ? 'Free launch' : '35 metal'}</span>` : 'Send a booster to earn your shot<br><span>Escort it · Attach · Aim · Launch</span>' : u?.type === 'booster' ? u.attachedRockId ? burning ? 'Booster firing · automatic separation after burn<br><span>Right-click to queue travel after the burn</span>' : 'Attached and waiting for your order<br><span>Select rock to aim / Right-click to detach and travel</span>' : 'Right-click a rock to fit a booster<br><span>Stays attached · Detach manually</span>' : 'Select a unit · Right-click for an order<br><span>Enemy: attack / friendly unit: escort or defend</span>';
    if(!this.ui.pending && u?.type==='miner')$('hint').innerHTML='Right-click an idle asteroid to mine<br><span>Right-click home or empty space to leave / escort with a warship</span>';
    this.updateContextHint?.();
    this.updateTutorial();
  }
  showOutcome() {
    this.outcomeShown = true; const win = this.world.outcome === 'victory';
    const training = this.world.scenario === 'garden';
    const body = win ? training ? this.world.lesson ? '<p>Ochre colony destroyed: 0 integrity. Tutorial complete.</p><p>You learned to launch and reload, protect Verdant, hunt enemy boosters, and overcome a fortified colony. Keep experimenting, or try another scenario.</p>' : '<p>Ochre colony destroyed: 0 integrity.</p><p>Keep experimenting, or try a colony under siege.</p>' : this.world.scenario === 'hold' ? '<p>Four minutes in the gravity well. Your colony is still here.</p><p>Your defenses held the orbit.</p>' : '<p>Cinder has fallen silent. Verdant has a future among these little worlds.</p>' : '<p>Your colony has lost its integrity. Try holding your defenses closer to home, or intercept the incoming rocks earlier.</p>';
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
        const lessonPhase=this.world.lesson?.phase;
        step(this.world); advanceTutorial(this.world); this.accumulator -= DT; this.processEvents();
        if(this.world.lesson?.phase!==lessonPhase) { this.paused=true; this.accumulator=0; this.updateUI(); }
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
