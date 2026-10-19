import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/scenarios.js';
import {addRock,advanceMotion,scanRockThreats,predict,setGravity,DT} from '../src/simulation.js';

function compareThreats(w){
  w.threatScanAt=0;scanRockThreats(w);
  const isolated={...w,units:w.units.filter(u=>u.type==='rock'||u.attachedRockId)};
  const fresh=predict(isolated,isolated.units.filter(u=>u.type==='rock'&&u.hp>0&&u.launched).map(u=>u.id));
  const expected=new Map([...fresh].filter(([,f])=>f.impact&&f.impact.targetId!=='star').map(([id,f])=>[id,f.impact]));
  assert.deepEqual(Object.keys(w.rockThreats).sort(),[...expected.keys()].sort());
  for(const [id,impact] of expected){
    assert.equal(w.rockThreats[id].targetId,impact.targetId);
    assert.ok(Math.abs(w.rockThreats[id].time-w.time-impact.time)<1e-6);
  }
}

test('reused threat forecasts match fresh forecasts as threats enter the horizon and motion changes',()=>{
  const w=createGame({mode:'skirmish',layoutSeed:17,visitorSeed:42});setGravity(w,{g:0});
  w.units=w.units.filter(u=>u.type==='rock');
  const home=w.planets.find(p=>p.team==='player');
  const rock=addRock(w,0,600,'CACHE TEST');
  Object.assign(rock,{x:home.x+550,y:home.y,vx:-5,vy:0,launched:true,beltOrbit:null});
  for(let second=0;second<35;second++){
    compareThreats(w);
    for(let i=0;i<20;i++)advanceMotion(w,DT,true);
  }
  assert.equal(w.rockThreats[rock.id]?.targetId,home.id);
  rock.vy=20;compareThreats(w);assert.equal(w.rockThreats[rock.id],undefined);
  rock.vy=0;rock.hp-=12;compareThreats(w);assert.ok(w.rockThreats[rock.id]);
  setGravity(w,{g:.2});compareThreats(w);
  rock.hp=0;compareThreats(w);assert.equal(w.rockThreats[rock.id],undefined);
});

test('empty and missing-object forecasts preserve the live world',()=>{
  const w=createGame({mode:'skirmish',layoutSeed:17,visitorSeed:42}),before=structuredClone(w);
  assert.equal(predict(w,[]).size,0);assert.equal(predict(w,['missing']).size,0);
  assert.deepEqual(w,before);
});
