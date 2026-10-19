import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/scenarios.js';
import {DT,setGravity,setOrder,step,advanceMotion,predict,distance} from '../src/simulation.js';
function fixture(kind='attack',team='player'){
  const w=createGame({mode:'skirmish',layoutSeed:17,visitorSeed:42});w.mode='sandbox';w.ai.disabled=true;w.visitors.nextAt=Infinity;setGravity(w,{g:0});
  const ship=w.units.find(u=>u.type==='ship'&&u.team===team),rock=w.units.find(u=>u.type==='rock'),home=w.planets.find(p=>p.id===ship.hostId);
  Object.assign(home,{x:600,y:530,orbit:Math.hypot(600,530),phase:Math.atan2(530,600),omega:0,vx:0,vy:0});
  Object.assign(ship,{x:600,y:600,vx:0,vy:0,fireTimer:0});
  Object.assign(rock,{x:kind==='defend'?770:880,y:600,vx:-40,vy:0,launched:true,team:team==='player'?'enemy':'player',hp:1000});
  w.units=[ship,rock];setOrder(w,ship.id,{kind,targetId:kind==='defend'?home.id:rock.id},team);return {w,ship,rock};
}
test('attack and home defense meet approaching rocks in firing range without chasing past them',()=>{
  for(const kind of ['attack','defend'])for(const team of ['player','enemy']){
    const {w,ship,rock}=fixture(kind,team);let firstShot,furthest=ship.x,minX=ship.x;
    for(let i=0;i<4/DT;i++){
      step(w);furthest=Math.max(furthest,ship.x);minX=Math.min(minX,ship.x);
      if(rock.hp<1000 && !firstShot)firstShot=w.time;
    }
    assert.ok(firstShot<4,`${kind}/${team} first shot ${firstShot}`);
    assert.ok(minX>=600-1e-6,'must not detour away from the incoming threat');
    assert.ok(furthest<660,'close into gun range rather than rendezvous at the rock');
    assert.ok(Math.abs(ship.y-600)<1e-7,'clear incoming route stays direct');
  }
});
test('a ship already in weapon range brakes instead of matching a fast incoming rock',()=>{
  const {w,ship,rock}=fixture();rock.x=680;rock.vx=-30;ship.vx=8;
  step(w);assert.ok(ship.vx<8);assert.equal(rock.hp,992);
  for(let i=0;i<20;i++)step(w);
  assert.ok(ship.vx>=0,'does not adopt the rock velocity and run backwards');
});
test('an escaping reachable rock is pursued rather than waiting forever',()=>{
  const {w,ship,rock}=fixture();rock.x=800;rock.vx=8;
  for(let i=0;i<20/DT && rock.hp===1000;i++)step(w);
  assert.ok(rock.hp<1000);assert.ok(ship.x>650);
});
test('rock interception preview matches actual steering step for step',()=>{
  const {w,ship,rock}=fixture();const order={kind:'attack',targetId:rock.id};
  const forecast=predict(w,[ship.id],{id:ship.id,order},6).get(ship.id);
  for(let i=1;i<=6/DT;i++){
    advanceMotion(w);
    if(i%12===0)assert.ok(distance(ship,forecast.points[i/12])<1e-8);
  }
});
