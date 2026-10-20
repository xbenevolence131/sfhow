import { entity, TYPES, ATTACH_TIME, REARM_TIME, BELT_INNER, BELT_WIDTH, SYSTEM_DIAMETER, MINING_RATE, MAX_IMPULSE } from './simulation.js';
const COLORS = { player: '#80d6cf', enemy: '#ee9184', neutral: '#a3acb1', star: '#f2ce87' };
const objectColor = u => u.color || COLORS[u.team] || COLORS.neutral;
export class Renderer {
  constructor(canvas, compact = false) {
    this.compact=compact;
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0, zoom: 1 }; this.width = 0; this.height = 0;
    let seed = 13579;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    this.stars = Array.from({ length: 220 }, () => ({ x: random(), y: random(), r: random() > .92 ? 1.1 : .55, alpha: .15 + random() * .45 }));
    this.belt = Array.from({ length: 105 }, () => ({ angle: random() * Math.PI * 2, orbit: BELT_INNER - 9 + random() * (BELT_WIDTH + 20), size: .8 + random() * 1.7 }));
    this.resize(); this.fit();
  }
  resize() {
    this.width = this.compact?this.canvas.clientWidth:innerWidth; this.height = this.compact?this.canvas.clientHeight:innerHeight; this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = this.width * this.dpr; this.canvas.height = this.height * this.dpr;
    if(!this.compact){this.canvas.style.width = `${this.width}px`; this.canvas.style.height = `${this.height}px`;}
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  mapCenter(){return this.compact?{x:this.width/2,y:this.height/2}:{x:(this.width-(this.width>720?270:0))/2,y:70+(this.height-70-(this.footerHeight||164))/2};}
  fit() { if(!this.compact)this.footerHeight=document.getElementById('command-panel')?.offsetHeight||164; this.camera = { x: 0, y: 0, zoom: Math.max(.08,Math.min((this.width - (this.compact?0:this.width>720?300:30)) / SYSTEM_DIAMETER, (this.height - (this.compact?0:this.footerHeight+90)) / SYSTEM_DIAMETER)) }; }
  screen(p) { const center=this.mapCenter();return { x: (p.x - this.camera.x) * this.camera.zoom + center.x, y: (p.y - this.camera.y) * this.camera.zoom + center.y }; }
  world(p) { const center=this.mapCenter();return { x: (p.x - center.x) / this.camera.zoom + this.camera.x, y: (p.y - center.y) / this.camera.zoom + this.camera.y }; }
  zoomAt(point, factor) {
    const before = this.world(point); this.camera.zoom = Math.max(.08, Math.min(2.8, this.camera.zoom * factor));
    const after = this.world(point); this.camera.x += before.x - after.x; this.camera.y += before.y - after.y;
  }
  circle(x, y, r, stroke, fill, dash = []) {
    const c = this.ctx; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.setLineDash(dash);
    if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.stroke(); } c.setLineDash([]);
  }
  text(text, x, y, color = '#8196a6', size = 10, align = 'left') {
    const c = this.ctx; c.font = `${size}px ui-monospace, Consolas, monospace`; c.fillStyle = color; c.textAlign = align; c.fillText(text, x, y);
  }
  path(forecast, color, faint = false) {
    if (!forecast?.points.length) return;
    const c = this.ctx; c.save(); c.strokeStyle = color; c.lineWidth = faint ? .8 : 1.2; c.globalAlpha = faint ? .28 : .8;
    c.setLineDash(faint ? [2, 6] : [2, 5]); c.beginPath();
    forecast.points.forEach((p, i) => { const s = this.screen(p); if (i) c.lineTo(s.x, s.y); else c.moveTo(s.x, s.y); }); c.stroke(); c.setLineDash([]);
    if (forecast.powered) {
      const powered = forecast.points.filter(p => !forecast.burnEnd || p.t <= forecast.burnEnd.time);
      c.strokeStyle = color; c.lineWidth = 2;
      c.beginPath(); powered.forEach((p, i) => { const s = this.screen(p); if (i) c.lineTo(s.x, s.y); else c.moveTo(s.x, s.y); }); c.stroke();
      if (forecast.burnEnd && !faint) {
        const p = this.screen(forecast.burnEnd); this.circle(p.x, p.y, 5, c.strokeStyle);
        this.text(`COAST ${Math.ceil(forecast.burnEnd.time)}s`, p.x + 9, p.y - 8, c.strokeStyle, 8);
      }
      c.strokeStyle = color; c.lineWidth = 1.2;
    }
    if (forecast.attachment) {
      const p = this.screen(forecast.attachment);
      this.circle(p.x, p.y, 7, color);
      if (!faint) this.text(`ATTACH ${Math.ceil(forecast.attachment.time)}s`, p.x + 12, p.y - 9, color, 9);
    } else if (forecast.impact) {
      const p = this.screen(forecast.impact); c.globalAlpha = .9; this.circle(p.x, p.y, 10, color);
      c.beginPath(); c.moveTo(p.x - 4, p.y - 4); c.lineTo(p.x + 4, p.y + 4); c.moveTo(p.x + 4, p.y - 4); c.lineTo(p.x - 4, p.y + 4); c.stroke();
      if (!faint) this.text(`IMPACT ${Math.ceil(forecast.impact.time)}s`, p.x + 15, p.y - 9, color, 9);
    } else if (!faint) {
      const end = this.screen(forecast.points.at(-1)); this.circle(end.x, end.y, 3, color);
    }
    if (forecast.ghost && !faint) {
      const g = this.screen(forecast.ghost); c.globalAlpha = .5; this.circle(g.x, g.y, forecast.ghost.radius * this.camera.zoom, color, null, [3, 4]);
      this.text('FUTURE POSITION', g.x, g.y - forecast.ghost.radius * this.camera.zoom - 9, color, 8, 'center');
    }
    if(!faint)for(const hit of forecast.collisions||[]){
      const key=`${hit.time}:${hit.x}:${hit.y}`;
      if(this.contactMarkers?.has(key))continue;
      this.contactMarkers?.add(key);
      const p=this.screen(hit);this.circle(p.x,p.y,8,hit.kind==='smash'?'#ee9184':'#f2ce87');
      this.text(`${hit.kind==='smash'?'SMASH':'DEFLECT'} ${hit.time.toFixed(1)}s`,p.x+12,p.y+14,color,8);
    }
    c.restore();
  }
  draw(w, ui) {
    if(!this.compact)this.footerHeight=document.querySelector('footer')?.offsetHeight||240;
    this.contactMarkers=new Set();
    const c = this.ctx, z = this.camera.zoom; c.clearRect(0, 0, this.width, this.height); c.fillStyle = '#091622'; c.fillRect(0, 0, this.width, this.height);
    for (const s of this.stars) { c.globalAlpha = s.alpha; c.fillStyle = '#b9ccd8'; c.fillRect(s.x * this.width, s.y * this.height, s.r, s.r); } c.globalAlpha = 1;
    const center = this.screen({ x: 0, y: 0 });
    for (const p of w.planets) this.circle(center.x, center.y, p.orbit * z, '#304351');
    for (const r of this.belt) {
      const a = r.angle + w.time * .0058, p = this.screen({ x: Math.cos(a) * r.orbit, y: Math.sin(a) * r.orbit });
      c.fillStyle = '#67727b'; c.globalAlpha = .5; c.fillRect(p.x, p.y, r.size, r.size);
    } c.globalAlpha = 1;
    const starRadius = Math.max(15, 25 * z);
    const glow = c.createRadialGradient(center.x, center.y, starRadius / 2, center.x, center.y, starRadius * 3.2);
    glow.addColorStop(0, '#eec77220'); glow.addColorStop(1, '#eec77200'); this.circle(center.x, center.y, starRadius * 3.2, null, glow);
    this.circle(center.x, center.y, starRadius, '#ffe0a0', '#efc775');
    this.text('SOL', center.x, center.y + starRadius + 20, '#8c846d', 9, 'center');
    const selected = entity(w, ui.selectedId);
    if (ui.ranges) {
      const droneHosts=new Set();
      for(const u of w.units)if(u.hp>0 && u.type==='drone' && (u.team==='player' || u.id===ui.selectedId)) {
        const host=entity(w,u.order?.targetId)||entity(w,u.hostId);
        const radius=u.defenseRadius||180,key=host?.id+':'+radius;
        if(!host || droneHosts.has(key))continue;
        droneHosts.add(key);const p=this.screen(host);
        this.circle(p.x,p.y,radius*z,objectColor(u)+'44',null,[2,7]);
      }
      for (const u of w.units) if (u.hp > 0 && u.range && (u.team === 'player' || u.id === ui.selectedId)) {
        const s = this.screen(u); this.circle(s.x, s.y, u.range * z, objectColor(u) + '22', null, [3, 5]);
      }
    }
    for (const [id, forecast] of ui.predictions) {
      const u = entity(w, id); if (!u) continue;
      const struck=forecast.secondary || (ui.pending?.aim?.targetType==='rock' && ui.pending.aim.targetId===id);
      const color = struck ? '#a7b9df' : u.type === 'rock' && u.team !== 'enemy' ? '#d6c398' : objectColor(u);
      this.path(forecast, color, !struck && id !== ui.selectedId && !(u.type === 'rock' && u.team === 'enemy'));
      if(forecast.secondary&&forecast.points.length){const p=this.screen(forecast.points.at(-1));this.text(u.name+' / AFTER CONTACT',p.x+8,p.y-8,color,8);}
    }
    if (ui.baseline) this.path(ui.baseline, '#92a4ae', true);
    for (const p of w.planets) {
      const s = this.screen(p), r = p.radius * z;
      this.circle(s.x, s.y, r, null, p.hp <= 0 ? '#48515a' : p.color);
      // A restrained flat crescent, not a texture.
      c.save(); c.beginPath(); c.arc(s.x, s.y, r, 0, Math.PI * 2); c.clip(); this.circle(s.x - r * .27, s.y - r * .25, r * .92, null, '#ffffff0c'); c.restore();
      if (p.team !== 'neutral') {
        this.circle(s.x, s.y, r + 7, p.color + '66', null, p.team === 'enemy' ? [2, 4] : []);
        c.fillStyle = '#2a3a43'; c.fillRect(s.x - 20, s.y + r + 24, 40, 2); c.fillStyle = p.color; c.fillRect(s.x - 20, s.y + r + 24, 40 * p.hp / p.maxHp, 2);
      }
      if(!this.compact)this.text(p.name + (p.team === 'enemy' ? ' / ENEMY' : p.team === 'player' ? ' / HOME' : ''), s.x, s.y + r + 16, p.color, 9, 'center');
    }
    for (const u of w.units) {
      if (u.hp <= 0) continue;
      const s = this.screen(u);
      if (s.x < -30 || s.x > this.width + 30 || s.y < -30 || s.y > this.height + 30) {
        if(u.visitor&&!this.compact){
          const x=Math.max(18,Math.min(this.width-18,s.x)),y=Math.max(65,Math.min(this.height-175,s.y));
          this.circle(x,y,5,'#a3acb1');
          this.text(u.name,x+(x>this.width/2?-12:12),y+4,'#a3acb1',8,x>this.width/2?'right':'left');
        }
        continue;
      }
      if(u.visitor)this.text(u.name,s.x+13,s.y-10,'#a3acb1',8);
      const color = objectColor(u); c.save(); c.translate(s.x, s.y); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 1.3;
      const size = Math.max((u.type === 'rock' ? u.size==='small'?4:u.size==='large'?8:5.5 : u.type === 'drone' ? 3.2 : 5.5)*(this.compact?1.5:1), u.radius * z);
      if (u.type === 'ship') {
        c.rotate(Math.atan2(u.vy, u.vx) + Math.PI / 2); c.beginPath(); c.moveTo(0, -size * 1.35); c.lineTo(size * .75, size); c.lineTo(0, size * .5); c.lineTo(-size * .75, size); c.closePath(); c.fill();
      } else if (u.type === 'miner') {
        c.rotate(Math.atan2(u.vy,u.vx)+Math.PI/2);
        c.strokeRect(-size*.7,-size*.7,size*1.4,size*1.4);
        c.beginPath();c.moveTo(-size*1.3,-size*.5);c.lineTo(-size*.7,-size*.5);c.moveTo(size*.7,-size*.5);c.lineTo(size*1.3,-size*.5);c.moveTo(-size*.3,-size*.7);c.lineTo(0,-size*1.3);c.lineTo(size*.3,-size*.7);c.stroke();
        if(u.miningRockId && entity(w,u.miningRockId)?.metalRemaining>0){c.fillRect(-2,-2,4,4);}
      } else if (u.type === 'booster') {
        c.rotate(Math.atan2(u.vy, u.vx) + Math.PI / 2);
        c.strokeRect(-size * .5, -size, size, size * 2);
        c.beginPath(); c.moveTo(-size * .5, -size); c.lineTo(0, -size * 1.5); c.lineTo(size * .5, -size); c.stroke();
        c.strokeRect(-size, -size * .2, size * .5, size); c.strokeRect(size * .5, -size * .2, size * .5, size);
        if (u.loaded) { c.fillStyle = '#f2ce87'; c.fillRect(-2, -3, 4, 6); }
      } else if (u.type === 'platform') {
        this.circle(0, 0, size, color); this.circle(0, 0, 2, null, color);
        c.beginPath(); c.moveTo(-size - 4, 0); c.lineTo(-size + 3, 0); c.moveTo(size - 3, 0); c.lineTo(size + 4, 0); c.moveTo(0, -size - 4); c.lineTo(0, -size + 3); c.moveTo(0, size - 3); c.lineTo(0, size + 4); c.stroke();
      } else if (u.type === 'drone') {
        c.rotate(u.ramTargetId?Math.atan2(u.vy,u.vx)+Math.PI/2:w.time*.2+u.phase); c.beginPath(); c.moveTo(0, -size); c.lineTo(size, 0); c.lineTo(0, size); c.lineTo(-size, 0); c.closePath();
        if(u.ramTargetId){c.fill();c.beginPath();c.moveTo(0,size+3);c.lineTo(0,size+10);c.stroke();}else c.stroke();
      } else {
        c.fillStyle = u.launched ? (u.team === 'enemy' ? '#956e68' : '#8c8a78') : '#666f78'; c.beginPath();
        for (let i = 0; i < 7; i++) { const angle = i / 7 * Math.PI * 2, r = size * (i % 2 ? .85 : 1.1); i ? c.lineTo(Math.cos(angle) * r, Math.sin(angle) * r) : c.moveTo(Math.cos(angle) * r, Math.sin(angle) * r); } c.closePath(); c.fill(); c.stroke();
        if (u.launched) this.circle(0, 0, size + 5, color + '80', null, [2, 3]);
        else if (u.boosterTeam) { c.fillStyle = color; c.fillRect(size + 2, -3, 5, 6); this.circle(0, 0, size + 7, color + '88'); }
      } c.restore();
      if(u.tier===2){
        c.save();c.strokeStyle=u.baseColor||'#c0e6e2';c.lineWidth=1.5;
        c.beginPath();
        for(const dy of [0,4]){c.moveTo(s.x+size+3,s.y-3+dy);c.lineTo(s.x+size+6,s.y-6+dy);c.lineTo(s.x+size+9,s.y-3+dy);}
        c.stroke();c.restore();
      }
      if(u.type==='miner' && (u.miningRockId || u.miningProgress>0)){
        this.text(u.miningRockId?(entity(w,u.miningRockId)?.metalRemaining>0?`+${MINING_RATE} / s`:'DEPLETED'):`DOCK ${Math.ceil(4-u.miningProgress)}s`,s.x-12,s.y-14,color,9,'right');
        const rock=entity(w,u.miningRockId);if(rock){const p=this.screen(rock);c.save();c.strokeStyle=color+'88';c.setLineDash([2,3]);c.beginPath();c.moveTo(s.x,s.y);c.lineTo(p.x,p.y);c.stroke();c.restore();}
      }
      if (u.type === 'booster' && u.attachedRockId && entity(w, u.attachedRockId)?.burn?.remaining > 0) {
        const rock = entity(w, u.attachedRockId), burn = rock.burn;
        const angle = Math.atan2(burn.ay, burn.ax), length = 10 + 3 * Math.sin(w.time * 16);
        c.strokeStyle = '#f2ce87'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - Math.cos(angle) * length, s.y - Math.sin(angle) * length); c.stroke(); c.lineWidth = 1;
        this.circle(s.x, s.y, 15, '#f2ce8766');
        this.text(`BURN ${Math.ceil(burn.remaining)}s`, s.x + 20, s.y + 14, '#f2ce87', 8);
      } else if (u.type === 'booster' && (u.attachProgress > 0 || u.rearmProgress > 0)) {
        const attaching = u.attachProgress > 0, progress = attaching ? u.attachProgress / ATTACH_TIME : u.rearmProgress / REARM_TIME;
        c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); c.arc(s.x, s.y, 15, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); c.stroke(); c.lineWidth = 1;
        this.text(`${attaching ? 'ATTACH' : 'REARM'} ${Math.ceil((attaching ? ATTACH_TIME : REARM_TIME) * (1 - progress))}s`, s.x + 20, s.y + 14, color, 8);
        if (attaching) { const rock = entity(w, u.order.targetId); if (rock) { const p = this.screen(rock); c.setLineDash([2, 3]); c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(p.x, p.y); c.stroke(); c.setLineDash([]); } }
      }
      if (u.hp < u.maxHp) { c.fillStyle = '#33404a'; c.fillRect(s.x - 9, s.y + size + 7, 18, 2); c.fillStyle = color; c.fillRect(s.x - 9, s.y + size + 7, 18 * u.hp / u.maxHp, 2); }
    }
    for (const e of w.effects) {
      const age = (w.time - e.born) / e.life, s = this.screen(e); c.save(); c.globalAlpha = 1 - age;
      if (e.type === 'shot') { const t = this.screen({ x: e.tx, y: e.ty }); c.strokeStyle = objectColor(e); c.lineWidth = e.tier===2?2:1; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(t.x, t.y); c.stroke(); }
      else {
        const color = COLORS[e.team] || '#f2ce87'; this.circle(s.x, s.y, (8 + 23 * age) * z, color);
        if(e.type==='ram')this.text('RAM / -45',s.x+10,s.y-12,e.color||color,8);
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; this.circle(s.x + Math.cos(a) * age * 32 * z, s.y + Math.sin(a) * age * 32 * z, 1.5, null, color); }
      } c.restore();
    }
    const tutorialTarget = entity(w, ui.tutorialId);
    if (tutorialTarget) {
      const s = this.screen(tutorialTarget), radius = Math.max(21, tutorialTarget.radius * z + 18);
      c.save(); c.lineWidth=2;
      this.circle(s.x, s.y, radius, '#ff72ed');
      c.restore();
      this.text(ui.tutorialAction || 'TUTORIAL', s.x + radius + 7, s.y + 16, '#ff72ed', 9);
    }
    for (const id of [ui.hoverId, ui.selectedId]) {
      const u = entity(w, id); if (!u) continue; const s = this.screen(u), r = Math.max(13, u.radius * z + 11);
      this.circle(s.x, s.y, r, id === ui.selectedId ? (u.team === 'neutral' ? '#d9d2b9' : objectColor(u)) : '#768b9b66', null, id === ui.selectedId ? [6, 4] : []);
      if (id === ui.selectedId && u.type !== 'planet') this.text(u.name, s.x + r + 8, s.y - 6, objectColor(u), 9);
    }
    if (ui.pending?.impulse && selected) {
      const a = this.screen(selected), b = this.screen({ x: selected.x + ui.pending.impulse.x * 10, y: selected.y + ui.pending.impulse.y * 10 });
      c.strokeStyle = '#f2ce87'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      const angle = Math.atan2(b.y - a.y, b.x - a.x); c.beginPath(); c.moveTo(b.x - Math.cos(angle - .5) * 9, b.y - Math.sin(angle - .5) * 9); c.lineTo(b.x, b.y); c.lineTo(b.x - Math.cos(angle + .5) * 9, b.y - Math.sin(angle + .5) * 9); c.stroke();
      this.text(`Δv ${Math.hypot(ui.pending.impulse.x, ui.pending.impulse.y).toFixed(1)} / ${MAX_IMPULSE}`, b.x + 10, b.y - 8, '#f2ce87', 9);
    }
    if (ui.pending?.order && !ui.pending.order.targetId) {
      const p = this.screen(ui.pending.order); this.circle(p.x, p.y, 6, COLORS.player); this.circle(p.x, p.y, 11, COLORS.player + '66');
    }
    if (ui.pending) { this.text(ui.pending.impulse ? 'DOTTED GOLD / BALLISTIC' : 'DOTTED PATH / ASSISTED FLIGHT', 28, this.height - 168, '#8babb6', 8); }
  }
}
