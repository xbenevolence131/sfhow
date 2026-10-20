import {Renderer} from './render.js';
import {entity,distance} from './simulation.js';

export function arrangeHUD(){
  const byId=id=>document.getElementById(id),footer=document.querySelector('footer');
  footer.id='command-panel';footer.setAttribute('aria-label','Your fleet controls');
  const actions=document.createElement('section');actions.id='action-panel';actions.className='command-section';
  actions.setAttribute('aria-label','Context actions');actions.innerHTML='<div class="panel-heading"><span id="action-heading">ACTIONS</span></div><p id="action-empty">Select your planet to build, or a unit to command.</p>';
  footer.prepend(actions);
  footer.insertAdjacentHTML('afterbegin','<div id="faction-label"><span id="player-world-name"></span> — PLAYER FACTION</div>');
  actions.append(document.querySelector('.dock'),byId('unit-upgrade'),byId('selected-actions'));
  document.body.append(byId('plan'));
  const plan=byId('plan'),planDetails=document.createElement('div');planDetails.id='plan-details';
  planDetails.append(plan.firstElementChild,byId('rock-contact-controls'));plan.prepend(planDetails);
  const inspector=byId('selection');inspector.classList.add('command-section');
  inspector.insertAdjacentHTML('afterbegin','<div class="panel-heading">UNIT INSPECTOR <span id="selected-owner"></span></div>');
  byId('selected-health').insertAdjacentHTML('afterend','<progress id="unit-health-bar" aria-label="Unit health" max="1" value="1"></progress>');
  const controls=document.createElement('section');controls.id='game-control-panel';controls.className='command-section';controls.setAttribute('aria-label','Time and recording controls');
  controls.innerHTML='<div class="panel-heading">GAME CONTROLS</div>';
  controls.querySelector('.panel-heading').append(document.querySelector('.top-right'));
  controls.append(document.querySelector('.time-controls'),document.querySelector('.map-tools'));
  footer.append(controls);
  const mission=document.querySelector('.mission'),tutorial=byId('tutorial');
  const details=document.createElement('details');details.id='system-details';details.innerHTML='<summary>Scenario &amp; tuning</summary>';
  mission.before(tutorial,details);details.append(mission);
  byId('hint').classList.add('hidden');
  const closeups=document.createElement('aside');closeups.id='planet-views';closeups.setAttribute('aria-label','Planet close-ups');
  closeups.innerHTML=['player','enemy'].map(team=>`<details class="planet-view" id="${team}-view" open><summary><span>${team==='player'?'YOUR PLANET':'ENEMY PLANET'}</span><strong id="${team}-view-name"></strong></summary><canvas id="${team}-view-canvas" tabindex="0" aria-label="${team==='player'?'Friendly':'Enemy'} planet close-up. Click a unit to select it."></canvas><span class="view-empty hidden">No enemy planet</span><div class="view-integrity hidden" id="${team}-view-integrity"><span class="integrity-label"></span><strong class="integrity-value"></strong></div></details>`).join('');
  document.body.append(closeups);
}

export class PlanetViews{
  constructor(game){
    this.game=game;this.lastDraw=-Infinity;
    this.views=['player','enemy'].map(team=>{
      const canvas=document.getElementById(`${team}-view-canvas`),panel=document.getElementById(`${team}-view`);
      const renderer=new Renderer(canvas,true),view={team,canvas,panel,renderer,planet:null};
      canvas.addEventListener('click',e=>{
        if(game.modalOpen()||!view.planet)return;
        const rect=canvas.getBoundingClientRect(),point={x:e.clientX-rect.left,y:e.clientY-rect.top};
        const target=[...game.world.units.filter(u=>u.hp>0),...game.world.planets]
          .map(u=>({u,d:distance(renderer.screen(u),point),r:Math.max(12,u.radius*renderer.camera.zoom+4)}))
          .filter(o=>o.d<=o.r).sort((a,b)=>a.d-b.d)[0]?.u;
        const selected=entity(game.world,target?.attachedRockId)||target;
        game.select(selected?.id===game.ui.selectedId?null:selected?.id||null);
      });
      canvas.addEventListener('contextmenu',e=>e.preventDefault());
      canvas.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&view.planet&&!game.modalOpen()){e.preventDefault();e.stopPropagation();game.select(view.planet.id);}});
      panel.addEventListener('toggle',()=>{this.lastDraw=-Infinity;});
      return view;
    });
  }
  draw(now){
    if(now-this.lastDraw<66)return;this.lastDraw=now;
    const {world:w,ui}=this.game;
    for(const view of this.views){
      // Follow the selected enemy's colony in systems with multiple rivals.
      const selected=entity(w,ui.selectedId),host=entity(w,selected?.hostId);
      const preferred=selected?.type==='planet'?selected:host;
      const planet=preferred?.team===view.team?preferred:w.planets.find(p=>p.team===view.team&&p.hp>0)||w.planets.find(p=>p.team===view.team);
      view.planet=planet;
      view.panel.style.borderColor=planet?.color||'#56636d';
      document.getElementById(`${view.team}-view-name`).textContent=planet?`${planet.name}${planet.hp<=0?' / LOST':''}`:'None';
      view.canvas.classList.toggle('hidden',!planet);view.panel.querySelector('.view-empty').classList.toggle('hidden',!!planet);
      const integrity=document.getElementById(`${view.team}-view-integrity`);
      integrity.classList.toggle('hidden',!planet);
      if(planet){
        integrity.querySelector('.integrity-label').textContent=`${planet.name} INTEGRITY`;
        integrity.querySelector('.integrity-value').textContent=`${Math.round(Math.max(0,Math.min(1,planet.hp/planet.maxHp))*100)}%`;
        integrity.style.color=planet.color;
      }
      if(!planet||!view.panel.open)continue;
      const r=view.renderer;
      if(r.width!==view.canvas.clientWidth||r.height!==view.canvas.clientHeight)r.resize();
      r.camera={x:planet.x,y:planet.y,zoom:Math.min(r.width,r.height)/260};
      r.draw(w,{...ui,predictions:new Map(),baseline:null,pending:null,allPaths:false,ranges:false,hoverId:null});
    }
  }
}
