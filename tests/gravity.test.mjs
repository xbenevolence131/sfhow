import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createScenario } from '../src/scenarios.js';
import { DT, GRAVITY_BASE, GRAVITY_DEFAULTS, GRAVITY_LIMITS, gravity, setGravity, normalizeGravity, predict, advanceMotion, planRockTarget, distance } from '../src/simulation.js';

test('G scales both attractors; masses scale their own pull with equal planetary masses', () => {
  const planets=[{x:400,y:200,radius:13},{x:-200,y:300,radius:21}];
  const base=gravity(600,100,planets,GRAVITY_DEFAULTS);
  const twice=gravity(600,100,planets,{...GRAVITY_DEFAULTS,g:2});
  assert.ok(Math.abs(twice.x-base.x*2)<1e-12);assert.ok(Math.abs(twice.y-base.y*2)<1e-12);
  const sun=gravity(100,0,[],{g:2,sunMass:5000,planetMass:0});
  assert.equal(sun.x,-12);assert.equal(Math.abs(sun.y),0);
  assert.equal(gravity(200,0,[],{g:2,sunMass:5000,planetMass:0}).x,-3);
  const a=gravity(100,0,[{x:0,y:0,radius:13}],{g:1,sunMass:0,planetMass:2800});
  const b=gravity(100,0,[{x:0,y:0,radius:21}],{g:1,sunMass:0,planetMass:2800});
  assert.deepEqual(a,b,'different visible radii must not imply different planet masses');
  const zero=gravity(600,100,planets,{...GRAVITY_DEFAULTS,g:0});assert.equal(Math.hypot(zero.x,zero.y),0);
  const noPlanets=gravity(600,100,planets,{...GRAVITY_DEFAULTS,planetMass:0});
  assert.deepEqual(noPlanets,gravity(600,100,[],GRAVITY_DEFAULTS));
});

test('runtime tuning preserves free-flight motion and orders, clears threat caches, and restarts with chosen settings', () => {
  const w=createGame({mode:'skirmish'});
  w.units.find(u=>u.type==='rock').launched=true;
  const units=structuredClone(w.units),planets=structuredClone(w.planets),metal=structuredClone(w.metal);
  w.rockThreats={stale:{time:20}};w.threatWarnings={stale:'verdant'};
  setGravity(w,{g:2,planetMass:4200,sunMass:8200});
  const free=u=>u.type!=='platform' && (u.type!=='rock' || u.launched);
  assert.deepEqual(w.units.filter(free),units.filter(free));
  for(const rock of w.units.filter(u=>u.type==='rock' && !u.launched)) {
    const before=units.find(u=>u.id===rock.id);assert.equal(rock.x,before.x);assert.equal(rock.y,before.y);
  }
  w.planets.forEach((p,i)=>{assert.equal(p.x,planets[i].x);assert.equal(p.y,planets[i].y);});assert.deepEqual(w.metal,metal);assert.equal(w.time,0);
  assert.deepEqual(w.rockThreats,{});assert.deepEqual(w.threatWarnings,{});
  assert.deepEqual(createGame(w.setup).gravity,w.gravity);
  const old=w.gravity;setGravity(w,GRAVITY_DEFAULTS);assert.notEqual(old,w.gravity);
  assert.deepEqual(w.gravity,GRAVITY_DEFAULTS);
  assert.deepEqual(normalizeGravity({g:-1,planetMass:1e9,sunMass:NaN}),{g:0,planetMass:GRAVITY_LIMITS.planetMass,sunMass:GRAVITY_DEFAULTS.sunMass});
});

test('zero gravity coasts at existing velocity; a fresh zero-gravity belt starts stationary', () => {
  const w=createScenario('garden'),r=w.units.find(u=>u.type==='rock');w.units=[r];
  r.launched=true;
  setGravity(w,{g:0});const before={...r};
  for(let i=0;i<10/DT;i++)advanceMotion(w);
  assert.ok(Math.abs(r.x-before.x-before.vx*10)<1e-8);assert.ok(Math.abs(r.y-before.y-before.vy*10)<1e-8);
  assert.equal(r.vx,before.vx);assert.equal(r.vy,before.vy);
  const fresh=createGame({mode:'sandbox',gravity:{g:0}});
  for(const rock of fresh.units.filter(u=>u.type==='rock'))assert.equal(Math.hypot(rock.vx,rock.vy),0);
});

test('planet speeds balance centripetal acceleration, scale with G and sun mass, and ignore planet mass', () => {
  const w=createScenario('neighbors');
  const speeds=()=>w.planets.map(p=>Math.hypot(p.vx,p.vy));
  const base=speeds();
  for(const p of w.planets)assert.ok(Math.abs((p.vx*p.vx+p.vy*p.vy)/p.orbit-GRAVITY_BASE*w.gravity.g*w.gravity.sunMass/p.orbit**2)<1e-12);
  setGravity(w,{g:2});speeds().forEach((v,i)=>assert.ok(Math.abs(v/base[i]-Math.sqrt(2))<1e-12));
  setGravity(w,{sunMass:10800});speeds().forEach((v,i)=>assert.ok(Math.abs(v/base[i]-2)<1e-12));
  const planets=structuredClone(w.planets);setGravity(w,{planetMass:0});assert.deepEqual(w.planets,planets);
  const fresh=createGame(w.setup);
  fresh.planets.forEach((p,i)=>assert.equal(p.omega,w.planets[i].omega));
});

test('retuning moving planets preserves position and phase through stop and resume, including host platforms', () => {
  const w=createScenario('neighbors');
  for(let i=0;i<347;i++)advanceMotion(w);
  const before=structuredClone(w.planets),platforms=structuredClone(w.units.filter(u=>u.type==='platform'));
  setGravity(w,{g:3});
  w.planets.forEach((p,i)=>{assert.equal(p.x,before[i].x);assert.equal(p.y,before[i].y);});
  for(const u of w.units.filter(u=>u.type==='platform')){
    const prev=platforms.find(p=>p.id===u.id),host=w.planets.find(p=>p.id===u.hostId),old=before.find(p=>p.id===u.hostId);
    assert.equal(u.x,prev.x);assert.equal(u.y,prev.y);
    assert.ok(Math.abs((u.vx-host.vx)-(prev.vx-old.vx))<1e-12);
  }
  const phase=w.planets.map(p=>Math.atan2(p.y,p.x));advanceMotion(w);
  w.planets.forEach((p,i)=>{
    assert.ok(Math.abs(p.x-Math.cos(phase[i]+p.omega*DT)*p.orbit)<1e-9);
    assert.ok(Math.abs(p.y-Math.sin(phase[i]+p.omega*DT)*p.orbit)<1e-9);
  });
  setGravity(w,{sunMass:0});const stopped=structuredClone(w.planets);
  for(let i=0;i<200;i++)advanceMotion(w);
  w.planets.forEach((p,i)=>{assert.equal(Math.hypot(p.vx,p.vy),0);assert.ok(distance(p,stopped[i])<1e-9);});
  setGravity(w,{sunMass:5400});const resumed=structuredClone(w.planets);advanceMotion(w);
  w.planets.forEach((p,i)=>{assert.ok(distance(p,resumed[i])>0);assert.ok(distance(p,resumed[i])<=Math.hypot(p.vx,p.vy)*DT+1e-9);});
});

test('custom gravity is shared by forecasts and moving-planet launch aiming', () => {
  const w=createGame({mode:'sandbox',gravity:{g:1.7,planetMass:3800,sunMass:7900}});
  const r=w.units.find(u=>u.type==='rock'),b=w.units.find(u=>u.type==='booster'),p=w.planets[0];
  w.units=[r,b];
  Object.assign(r,{x:p.x+250,y:p.y+90,vx:0,vy:0,team:'player',boosterTeam:'player',boosterId:b.id});
  Object.assign(b,{attachedRockId:r.id,attachOffset:{x:18,y:0},order:{kind:'attached',targetId:r.id}});
  const pending=planRockTarget(w,r,p);
  assert.ok(pending.aim.verified);assert.equal(predict(w,[r.id],pending).get(r.id).impact.targetId,p.id);
  b.attachedRockId=null;r.boosterId=null;r.boosterTeam=null;
  Object.assign(r,{x:700,y:-400,vx:6,vy:8,launched:true});w.units=[r];
  const f=predict(w,[r.id],null,30).get(r.id);
  for(let n=1;n<=30/DT&&r.hp>0;n++){
    advanceMotion(w);
    if(n%12===0&&r.hp>0)assert.ok(distance(r,f.points[n/12])<1e-8);
  }
});

test('slider extrema stay finite and fixed-step grouping remains deterministic', () => {
  for(const settings of [{g:0,planetMass:0,sunMass:0},GRAVITY_LIMITS]){
    const a=createGame({mode:'sandbox',gravity:settings}),b=structuredClone(a);
    for(let n=0;n<1200;n++)advanceMotion(a);
    for(let frame=0;frame<60;frame++)for(let sub=0;sub<20;sub++)advanceMotion(b);
    for(let i=0;i<a.units.length;i++){
      assert.ok([a.units[i].x,a.units[i].y,a.units[i].vx,a.units[i].vy].every(Number.isFinite));
      assert.equal(a.units[i].x,b.units[i].x);assert.equal(a.units[i].y,b.units[i].y);
    }
  }
});


test('default gravity doubles the preceding baseline, with matching initial speeds and unchanged scale', () => {
  assert.equal(GRAVITY_DEFAULTS.g,1);
  assert.equal(GRAVITY_BASE,12);
  const p={x:400,y:0,radius:18};
  assert.equal(gravity(100,0,[],GRAVITY_DEFAULTS).x,-6.48);
  assert.equal(gravity(300,0,[p],{...GRAVITY_DEFAULTS,sunMass:0}).x,3.36);
  const current=createGame({mode:'scenario',scenario:'garden'});
  const previous=createGame({mode:'scenario',scenario:'garden',gravity:{g:.5}});
  for(const [i,rock] of current.units.entries()) {
    if(rock.type!=='rock')continue;
    const old=previous.units[i];
    assert.equal(rock.beltOrbit,old.beltOrbit);
    assert.ok(Math.abs(Math.hypot(rock.vx,rock.vy)/Math.hypot(old.vx,old.vy)-Math.sqrt(2))<1e-12);
  }
  for(const [i,planet] of current.planets.entries()) {
    assert.equal(planet.orbit,previous.planets[i].orbit);
    assert.ok(Math.abs(planet.omega/previous.planets[i].omega-Math.sqrt(2))<1e-12);
  }
});
