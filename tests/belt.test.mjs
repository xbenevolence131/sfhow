import test from 'node:test';
import assert from 'node:assert/strict';
import {createScenario} from '../src/scenarios.js';
import {DT,BELT_INNER,BELT_WIDTH,advanceMotion,addRock,isBeltRock,launchRock,predict,setGravity,setCollisions,distance} from '../src/simulation.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} vs ${b}`);
test('untouched widened belt survives thirty simulated minutes at exact radii',()=>{
  const w=createScenario('garden');w.units=w.units.filter(u=>u.type==='rock');
  assert.equal(BELT_INNER,820*1.25);assert.equal(BELT_WIDTH,36*1.25);
  for(let i=0;i<1800/DT;i++)advanceMotion(w);
  assert.equal(w.units.length,15);
  for(const r of w.units){assert.equal(r.hp,r.maxHp);assert.equal(isBeltRock(r),true);near(Math.hypot(r.x,r.y),r.beltOrbit);}
});
test('booster follows the rail, and launch preserves tangent velocity with exact preview agreement',()=>{
  const w=createScenario('playground'),rock=w.units.find(u=>u.type==='rock'),booster=w.units.find(u=>u.id===rock.boosterId);
  w.units=[rock,booster];for(let i=0;i<20/DT;i++)advanceMotion(w);
  near(booster.x-rock.x,booster.attachOffset.x);near(booster.vx,rock.vx);near(booster.vy,rock.vy);
  const velocity={x:rock.vx,y:rock.vy},pending={id:rock.id,impulse:{x:3,y:4}};
  const forecast=predict(w,[rock.id],pending,20).get(rock.id);
  launchRock(w,rock.id,pending.impulse);assert.equal(isBeltRock(rock),false);
  near(rock.vx,velocity.x);near(rock.vy,velocity.y);
  for(let i=1;i<=20/DT;i++){
    advanceMotion(w);
    const point=forecast.points.find(p=>Math.abs(p.t-i*DT)<1e-8);
    if(point)assert.ok(distance(rock,point)<1e-7);
  }
  assert.ok(Math.abs(Math.hypot(rock.x,rock.y)-rock.beltOrbit)>1);
});
test('a projectile knocks a waiting rock off its rail, with matching collision preview',()=>{
  const w=createScenario('garden');w.units=[];w.planets=[];setGravity(w,{g:0});setCollisions(w,{bounce:1,strength:100});
  const waiting=addRock(w,0,600),projectile=addRock(w,0,560);
  Object.assign(projectile,{launched:true,vx:20,vy:0});
  const forecast=predict(w,[projectile.id],null,4.2);
  assert.ok(forecast.get(waiting.id).secondary);
  for(let i=0;i<4.2/DT;i++)advanceMotion(w);
  assert.equal(waiting.deflected,true);assert.equal(isBeltRock(waiting),false);assert.ok(waiting.x>600);
  assert.ok(distance(waiting,forecast.get(waiting.id).points.at(-1))<1e-7);
});
test('retuning rails preserves positions and attached velocity; launched rocks keep free motion',()=>{
  const w=createScenario('playground'),r=w.units.find(u=>u.type==='rock'),b=w.units.find(u=>u.id===r.boosterId);
  for(let i=0;i<123;i++)advanceMotion(w);
  const point={x:r.x,y:r.y};setGravity(w,{g:0});near(r.x,point.x);near(r.y,point.y);
  for(let i=0;i<40;i++)advanceMotion(w);near(r.x,point.x);near(r.y,point.y);
  setGravity(w,{g:1.5});near(r.x,point.x);near(r.y,point.y);near(b.vx,r.vx);near(b.vy,r.vy);
  advanceMotion(w);assert.ok(distance(r,point)>0);
  launchRock(w,r.id,{x:1,y:1});const free={x:r.x,y:r.y,vx:r.vx,vy:r.vy};setGravity(w,{g:2});
  for(const key of Object.keys(free))assert.equal(r[key],free[key]);
});
