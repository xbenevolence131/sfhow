import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/scenarios.js';
import {addRock,advanceMotion,predict,setGravity,scanRockThreats} from '../src/simulation.js';

function fixture(size='medium',team='enemy'){
  const w=createGame({mode:'skirmish',layoutSeed:17,visitorSeed:42});setGravity(w,{g:0});w.ai.disabled=true;w.visitors.nextAt=Infinity;
  const p=w.units.find(u=>u.type==='platform'&&u.team===team),home=w.planets.find(h=>h.id===p.hostId);
  Object.assign(home,{x:700,y:0,orbit:700,phase:0,omega:0,vx:0,vy:0});w.planets=[home];
  Object.assign(p,{x:600,y:0,orbit:100,phase:Math.PI,omega:0,vx:0,vy:0});w.units=[p];
  const r=addRock(w,0,500,'IMPACT',size);Object.assign(r,{x:500,y:0,vx:100,vy:0,launched:true,beltOrbit:null,team:'player'});
  return {w,p,home,r};
}

test('size-based platform damage consumes rocks before the colony, including friendly impacts',()=>{
  for(const team of ['player','enemy'])for(const size of ['small','medium','large']){
    const {w,p,home,r}=fixture(size,team),hp=p.hp,colonyHp=home.hp;
    advanceMotion(w,2);
    assert.equal(r.hp,0);assert.equal(r.impact.targetId,p.id);
    assert.equal(p.hp,hp-r.damage);assert.equal(home.hp,colonyHp);
    const after=p.hp;advanceMotion(w,1);assert.equal(p.hp,after,'consumed rock cannot hit again');
  }
});

test('a destroyed platform stops shielding subsequent rocks in the same step',()=>{
  const {w,p,home,r}=fixture('large');p.hp=80;
  const second=addRock(w,0,450,'SECOND','small');Object.assign(second,{x:450,y:0,vx:100,vy:0,launched:true,beltOrbit:null});
  const hp=home.hp;advanceMotion(w,3);
  assert.equal(p.hp,0);assert.equal(r.impact.targetId,p.id);
  assert.equal(second.impact.targetId,home.id);assert.equal(home.hp,hp-second.damage);
});

test('moving platform sweeps catch a crossing rock and forecasts match without mutating live health',()=>{
  const {w,p,r}=fixture();p.phase=Math.PI-.1;p.omega=.2;
  p.x=700+Math.cos(p.phase)*100;p.y=Math.sin(p.phase)*100;
  r.x=600;r.vx=0;
  const before=structuredClone(w),f=predict(w,[r.id],null,1).get(r.id);
  assert.deepEqual(w,before);assert.equal(f.impact.targetId,p.id);
  for(let i=0;i<20;i++)advanceMotion(w);
  assert.equal(r.impact.targetId,p.id);assert.ok(Math.abs(r.impact.time-f.impact.time)<1e-8);
  assert.equal(p.hp,230-r.damage);
});

test('planet targeting can plan through defenses while displayed previews show the platform impact',()=>{
  const {w,p,home,r}=fixture();
  assert.equal(predict(w,[r.id],null,3,false).get(r.id).impact.targetId,home.id);
  assert.equal(predict(w,[r.id],null,3).get(r.id).impact.targetId,p.id);
});

test('threat forecasts follow platform protection and invalidate when it is destroyed',()=>{
  const {w,p,home,r}=fixture();scanRockThreats(w);assert.equal(w.rockThreats[r.id].targetId,p.id);
  p.hp=0;w.threatScanAt=0;scanRockThreats(w);assert.equal(w.rockThreats[r.id].targetId,home.id);
});

test('a near miss does not hit the platform, and untouched belt rocks stay safe on rails',()=>{
  const {w,p,r}=fixture();r.y=30;advanceMotion(w,1);assert.equal(p.hp,230);assert.equal(r.hp,50);
  const idle=fixture();idle.r.launched=false;idle.r.beltOrbit=600;idle.r.beltPhase=0;idle.r.beltOmega=0;
  advanceMotion(idle.w,1);assert.equal(idle.p.hp,230);assert.equal(idle.r.hp,50);
});
