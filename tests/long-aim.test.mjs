import test from 'node:test';
import assert from 'node:assert/strict';
import {createScenario} from '../src/scenarios.js';
import {setGravity,planRockTarget,predict,advanceMotion,launchRock,aimedContact,DT,MAX_IMPULSE} from '../src/simulation.js';

function longShot(rockTarget=false){
  const w=createScenario('playground');setGravity(w,{g:0});
  const source=w.units.find(u=>u.type==='rock'),booster=w.units.find(u=>u.id===source.boosterId);
  const target=rockTarget?w.units.filter(u=>u.type==='rock')[1]:w.planets[1];
  Object.assign(source,{x:-1200,y:600,vx:0,vy:0,beltOrbit:null});
  Object.assign(booster,{x:-1184,y:600,vx:0,vy:0});
  Object.assign(target,{x:1200,y:600,vx:0,vy:0,orbit:Math.hypot(1200,600),phase:Math.atan2(600,1200),omega:0,beltOrbit:null,boosterId:null,boosterTeam:null});
  w.planets=rockTarget?[]:[target];w.units=rockTarget?[source,booster,target]:[source,booster];
  return {w,source,target};
}

test('planet and rock targets beyond the 90-second impulse reach get verified long previews matching flight',()=>{
  for(const rockTarget of [false,true]){
    const {w,source,target}=longShot(rockTarget),before=structuredClone(w);
    const pending=planRockTarget(w,source,target);assert.deepEqual(w,before);
    assert.equal(pending.aim.verified,true);assert.equal(pending.aim.horizon,120);
    assert.ok(pending.aim.flightTime>90 && pending.aim.flightTime<=120);
    assert.ok(Math.hypot(pending.impulse.x,pending.impulse.y)<=MAX_IMPULSE);
    assert.ok(!aimedContact(predict(w,[source.id],pending,90).get(source.id),target.id));
    const forecast=predict(w,[source.id],pending).get(source.id),contact=aimedContact(forecast,target.id);assert.ok(contact);
    assert.ok(!launchRock(w,source.id,pending.impulse).error);
    let actual;
    for(let i=0;i<120/DT && !actual;i++){
      advanceMotion(w);actual=source.impact || w.rockContacts?.find(c=>[c.a,c.b].includes(source.id)&&[c.a,c.b].includes(target.id));
    }
    assert.ok(actual);assert.ok(Math.abs(actual.time-contact.time)<1e-8);
  }
});

test('short successful shots keep the normal 90-second preview',()=>{
  const w=createScenario('playground'),rocks=w.units.filter(u=>u.type==='rock');
  const shot=planRockTarget(w,rocks[0],rocks[1]);assert.ok(shot.aim.verified);assert.equal(shot.aim.horizon,90);
});
