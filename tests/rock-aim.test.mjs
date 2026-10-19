import test from 'node:test';
import assert from 'node:assert/strict';
import {createScenario} from '../src/scenarios.js';
import {planRockTarget,predict,launchRock,advanceMotion,DT,MAX_IMPULSE,aimedContact,distance} from '../src/simulation.js';
import {contextualOrder} from '../src/orders.js';

test('equipped rocks target other rocks and their attached boosters with matching hints',()=>{
  const w=createScenario('playground'),rocks=w.units.filter(u=>u.type==='rock');
  for(const target of [rocks[1],w.units.find(u=>u.id===rocks[1].boosterId)]){
    const order=contextualOrder(w,rocks[0].id,target,target);
    assert.equal(order.rockTargetId,rocks[1].id);assert.match(order.label,/Intercept/);
  }
});

test('centre and edge intercepts produce real smash/deflection with both forecasts matching live motion',()=>{
  for(const offset of [0,-.9,.9]){
    const w=createScenario('playground'),rocks=w.units.filter(u=>u.type==='rock'),[source,target]=rocks;
    const before=structuredClone(w),pending=planRockTarget(w,source,target,offset);
    assert.deepEqual(w,before,'aiming is reversible and does not spend resources or move units');
    assert.equal(pending.aim.verified,true);assert.ok(Math.hypot(pending.impulse.x,pending.impulse.y)<=MAX_IMPULSE+1e-9);
    const forecasts=predict(w,[source.id],pending),flight=forecasts.get(source.id),contact=aimedContact(flight,target.id);
    assert.equal(contact.kind,offset===0?'smash':'deflect');assert.ok(forecasts.has(target.id));assert.ok(flight.ghost);
    launchRock(w,source.id,pending.impulse);
    let actual;
    for(let n=0;n<90/DT;n++){
      advanceMotion(w);actual||=w.rockContacts.find(c=>[c.a,c.b].includes(source.id)&&[c.a,c.b].includes(target.id));
      for(const object of [source,target]){
        const sample=forecasts.get(object.id).points.find(p=>Math.abs(p.t-w.time)<1e-8);
        if(sample && object.hp>0)assert.ok(distance(sample,object)<1e-7);
      }
    }
    assert.ok(actual);assert.equal(actual.kind,contact.kind);assert.ok(Math.abs(actual.time-contact.time)<1e-8);
    if(offset){assert.equal(target.launched,true);assert.equal(target.deflected,true);}
  }
});

test('free-flight target prediction accounts for motion; unreachable rocks remain unconfirmed',()=>{
  const w=createScenario('playground'),[source,target]=w.units.filter(u=>u.type==='rock');
  target.launched=true;target.vx+=1;target.vy-=1;
  const pending=planRockTarget(w,source,target,.9);assert.equal(pending.aim.verified,true);
  assert.ok(aimedContact(predict(w,[source.id],pending).get(source.id),target.id));
  Object.assign(target,{x:2500,y:2300,vx:80,vy:50});
  const no=planRockTarget(w,source,target);assert.equal(no.aim.verified,false);assert.ok(no.aim.reason);
  assert.ok(Math.hypot(no.impulse.x,no.impulse.y)<=MAX_IMPULSE+1e-9);
});
