import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario, createGame } from '../src/scenarios.js';
import { addRock, advanceMotion, predict, setCollisions, setGravity, scanRockThreats, DT } from '../src/simulation.js';

function range(bounce=1,strength=100){
  const w=createScenario('playground');w.units=[];w.planets=[];
  setGravity(w,{g:0});setCollisions(w,{bounce,strength});return w;
}
function rock(w,name,x,y,vx,vy,size='medium'){
  const r=addRock(w,0,600,name,size);Object.assign(r,{x,y,vx,vy,beltOrbit:null});return r;
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} vs ${b}`);

test('three sizes differ in mass/radius/impact damage, but share gravitational acceleration',()=>{
  const w=range();setGravity(w,{g:1});
  const results=[];
  for(const size of ['small','medium','large']){
    w.units=[];const r=rock(w,size,600,0,0,0,size);advanceMotion(w);results.push({...r});
  }
  assert.deepEqual(results.map(r=>r.mass),[1,2,4]);assert.deepEqual(results.map(r=>r.damage),[35,65,100]);
  assert.ok(results[0].radius<results[1].radius&&results[1].radius<results[2].radius);
  near(results[0].vx,results[2].vx);near(results[0].x,results[2].x);
  const fresh=createScenario('playground');assert.equal(new Set(fresh.units.filter(u=>u.type==='rock').map(u=>u.size)).size,3);
});

test('elastic contacts conserve momentum and kinetic energy for equal and unequal masses',()=>{
  for(const sizes of [['medium','medium'],['small','large']]){
    const w=range(),a=rock(w,'A',600,0,10,0,sizes[0]),b=rock(w,'B',630,0,0,0,sizes[1]);
    const momentum=a.mass*a.vx,energy=.5*a.mass*a.vx*a.vx;
    advanceMotion(w,2);
    near(a.mass*a.vx+b.mass*b.vx,momentum);near(.5*a.mass*a.vx*a.vx+.5*b.mass*b.vx*b.vx,energy);
    near(a.vx,10*(a.mass-b.mass)/(a.mass+b.mass));near(b.vx,20*a.mass/(a.mass+b.mass));
    assert.ok(a.x<b.x);assert.equal(a.hp,50);assert.equal(b.hp,50);
  }
});

test('inelastic hits reduce normal rebound, tangential motion survives, strength decides smashing',()=>{
  const w=range(.25,100),a=rock(w,'A',600,0,10,3),b=rock(w,'B',620,0,0,3);
  advanceMotion(w,1);near(b.vx-a.vx,2.5);near(a.vy,3);near(b.vy,3);
  const hit=(offset)=>{
    const w=range(.35,18),a=rock(w,'A',600,0,20,0),b=rock(w,'B',630,offset,0,0);
    advanceMotion(w,2);return {w,a,b};
  };
  const hard=hit(0);assert.equal(hard.a.hp,0);assert.equal(hard.b.hp,0);assert.equal(hard.w.units.length,2);assert.equal(hard.w.effects.length,1);
  const glance=hit(15);assert.ok(glance.a.hp>0&&glance.b.hp>0);assert.notEqual(glance.b.vy,0);
});

test('swept fast collisions do not tunnel, destroy attached boosters, and emit no simulated fragments',()=>{
  const w=range(),a=rock(w,'A',600,0,1000,0),b=rock(w,'B',630,0,-1000,0);
  const booster={id:'booster',type:'booster',hp:65,attachedRockId:a.id,attachOffset:{x:16,y:0},order:{kind:'attached'},x:a.x,y:a.y,vx:a.vx,vy:0};
  a.boosterId=booster.id;w.units.push(booster);advanceMotion(w);
  assert.equal(a.hp,0);assert.equal(b.hp,0);assert.equal(booster.hp,0);assert.equal(w.units.length,3);
  assert.ok(w.rockContacts[0].time<DT);
});

test('preview includes chained partner paths and agrees with actual contacts and motion',()=>{
  const w=range(),a=rock(w,'A',600,0,10,0),b=rock(w,'B',620,0,0,0),c=rock(w,'C',640,0,0,0);
  const f=predict(w,[a.id],null,3);
  assert.ok(f.get(b.id).secondary);assert.ok(f.get(c.id).secondary);
  assert.equal(f.get(a.id).collisions[0].kind,'deflect');assert.equal(f.get(b.id).collisions.length,2);
  for(let i=0;i<60;i++)advanceMotion(w);
  for(const r of [a,b,c]){const end=f.get(r.id).points.at(-1);near(r.x,end.x);near(r.y,end.y);}
  const smash=range(.35,1),s=rock(smash,'A',600,0,20,0),t=rock(smash,'B',630,0,0,0);
  const forecasts=predict(smash,[s.id],null,3);assert.equal(forecasts.get(s.id).collisions[0].kind,'smash');
  assert.equal(forecasts.get(t.id).ended,true);
});

test('banked idle rocks can threaten and damage planets; forecast and contact ordering agree',()=>{
  const w=range(),a=rock(w,'A',600,0,10,0),b=rock(w,'B',620,0,0,0);
  a.launched=true;
  w.planets=[{id:'target',name:'TARGET',type:'planet',team:'player',orbit:670,phase:0,omega:0,x:670,y:0,vx:0,vy:0,radius:10,hp:240,maxHp:240}];
  scanRockThreats(w);assert.equal(w.rockThreats[b.id].targetId,'target');
  const f=predict(w,[a.id],null,7);assert.equal(f.get(b.id).impact.targetId,'target');
  for(let i=0;i<140;i++)advanceMotion(w);
  assert.equal(b.hp,0);assert.equal(w.planets[0].hp,240-b.damage);assert.equal(a.hp,50);
  near(b.impact.time,f.get(b.id).impact.time);
});

test('overlaps separate without repeated energy injection; tuning preserves state and survives restart',()=>{
  const w=range(0,100),a=rock(w,'A',600,0,0,0),b=rock(w,'B',600,0,0,0);
  advanceMotion(w);assert.ok(Math.abs(a.x-b.x)>=a.radius+b.radius);near(a.vx,0);near(b.vx,0);
  const game=createScenario('playground'),units=structuredClone(game.units);
  setCollisions(game,{bounce:.8,strength:45});assert.deepEqual(game.units,units);
  assert.deepEqual(createGame(game.setup).collisions,game.collisions);
});

test('first swept obstacle wins and collision outcomes are independent of unit array order',()=>{
  const w=range(),a=rock(w,'A',600,0,1000,0),b=rock(w,'B',650,0,0,0);
  a.launched=true;
  w.planets=[{id:'target',name:'TARGET',type:'planet',team:'player',orbit:625,phase:0,omega:0,x:625,y:0,vx:0,vy:0,radius:5,hp:240,maxHp:240}];
  advanceMotion(w);assert.equal(a.impact.targetId,'target');assert.equal(b.hp,50);assert.equal(w.rockContacts.length,0);
  const one=range(),x=rock(one,'A',600,0,10,0),y=rock(one,'B',620,0,0,0),z=rock(one,'C',640,0,0,0);
  const two=structuredClone(one);two.units.reverse();
  for(let i=0;i<120;i++){advanceMotion(one);advanceMotion(two);}
  for(const a of one.units){const b=two.units.find(u=>u.id===a.id);near(a.x,b.x);near(a.y,b.y);near(a.vx,b.vx);near(a.vy,b.vy);}
});
