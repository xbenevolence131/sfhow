import test from 'node:test';
import assert from 'node:assert/strict';
import {createScenario} from '../src/scenarios.js';
import {DT,step,spawn,setOrder,entity,enemyLaunch,launchRock} from '../src/simulation.js';
import {beginTutorial,advanceTutorial,prepareTutorialAttack,launchTutorialAttack,sendTutorialPractice,skipTutorial,beginTutorialAssault} from '../src/tutorial.js';
const tick=(w,seconds)=>{for(let i=0;i<seconds/DT;i++){step(w);advanceTutorial(w);}};
function defenseFixture(delay=0){
  const w=createScenario('garden');tick(w,delay);beginTutorial(w);
  w.progress.launched=true;w.progress.intercepted=true;w.lesson.phase='fortify';
  prepareTutorialAttack(w);
  for(const type of ['platform','drone','drone','ship'])w.lesson.builtIds.push(spawn(w,type,'player',w.planets[0],true).id);
  return w;
}
test('tutorial starts undefended; the first real impact grants a single build budget',()=>{
  const w=createScenario('garden');beginTutorial(w);w.progress.launched=true;w.lesson.refuelled=true;
  assert.deepEqual(w.units.filter(u=>u.team==='player').map(u=>u.type),['booster']);
  const initial=w.metal.player;
  assert.equal(sendTutorialPractice(w).error,undefined);
  assert.ok(sendTutorialPractice(w).error,'cannot duplicate the incoming attack');
  tick(w,60);
  assert.equal(w.lesson.phase,'fortify');assert.equal(w.lesson.firstImpact,true);
  assert.equal(w.planets[0].hp,175);assert.equal(w.outcome,null);
  assert.ok(w.metal.player>=initial+210);assert.equal(w.lesson.grant,true);
  assert.equal(entity(w,w.lesson.rockId).boosterTeam,'enemy');
  assert.equal(enemyLaunch(w,true),false,'AI waits for the explicit second launch');
  const granted=w.metal.player;advanceTutorial(w);assert.equal(w.metal.player,granted);
  assert.ok(launchTutorialAttack(w).error,'must build the required units first');
});

test('interception leads to a ship attack lesson; destroying the booster opens the final assault',()=>{
  const w=defenseFixture();assert.equal(launchTutorialAttack(w).error,undefined);
  tick(w,60);assert.equal(w.lesson.phase,'combat');assert.equal(w.outcome,null);
  const enemy=entity(w,w.lesson.targetId),ship=w.units.find(u=>u.type==='ship');
  Object.assign(ship,{x:enemy.x+40,y:enemy.y,vx:enemy.vx,vy:enemy.vy});
  setOrder(w,ship.id,{kind:'attack',targetId:enemy.id});
  for(let i=0;i<2400 && w.lesson.phase==='combat';i++)tick(w,DT);
  assert.equal(w.lesson.phase,'assault');assert.equal(enemy.hp,0);
  assert.equal(w.lesson.attackHit,true);assert.equal(w.outcome,null);
});

test('new defenses stop the same shot that hits an undefended colony',()=>{
  const reinforced=defenseFixture();assert.equal(launchTutorialAttack(reinforced).error,undefined);
  const baseline=structuredClone(reinforced);baseline.units=baseline.units.filter(u=>!baseline.lesson.builtIds.includes(u.id));
  tick(baseline,60);tick(reinforced,60);
  assert.equal(baseline.lesson.phase,'retry');assert.ok(baseline.planets[0].hp<240);
  assert.equal(reinforced.lesson.phase,'combat');assert.equal(reinforced.planets[0].hp,240);assert.equal(reinforced.outcome,null);
});
test('defense exercise works at later orbital positions and supports retry',()=>{
  for(const delay of [120,240,400]){
    const w=defenseFixture(delay);assert.equal(launchTutorialAttack(w).error,undefined);
    // The exercise verifies up to 90 seconds; changed gravity can select a later arrival.
    tick(w,90);assert.equal(w.lesson.phase,'combat',`delay ${delay}`);
  }
  const w=defenseFixture();entity(w,w.lesson.rockId).hp=0;
  assert.ok(launchTutorialAttack(w).error);prepareTutorialAttack(w);
  assert.equal(launchTutorialAttack(w).error,undefined);
});
test('skipping removes unfired exercise props but cannot win before colony destruction',()=>{
  const w=defenseFixture(),rock=entity(w,w.lesson.rockId),boosterId=rock.boosterId;
  skipTutorial(w);assert.equal(w.lesson,undefined);assert.equal(entity(w,rock.id),null);assert.equal(entity(w,boosterId),null);
  step(w);assert.equal(w.outcome,null);
  entity(w,'ochre').hp=1;step(w);assert.equal(w.outcome,null);
  entity(w,'ochre').hp=0;step(w);assert.equal(w.outcome,'victory');
});


test('practice attack waits for the launch booster to return and finish refuelling',()=>{
  const w=createScenario('garden');beginTutorial(w);
  const booster=w.units.find(u=>u.type==='booster' && u.team==='player'),rock=w.units.find(u=>u.type==='rock');
  Object.assign(booster,{x:rock.x+16,y:rock.y,vx:rock.vx,vy:rock.vy,attachedRockId:rock.id,attachOffset:{x:16,y:0},order:{kind:'attached',targetId:rock.id}});
  Object.assign(rock,{boosterId:booster.id,boosterTeam:'player',team:'player'});
  assert.equal(launchRock(w,rock.id,{x:0,y:0}).error,undefined);
  assert.equal(w.lesson.returnBoosterId,booster.id);
  assert.ok(sendTutorialPractice(w).error);
  tick(w,5);assert.equal(booster.attachedRockId,null);
  assert.equal(w.lesson.refuelled,undefined);
  assert.ok(setOrder(w,booster.id,{kind:'rearm',targetId:'verdant'}));
  tick(w,1);assert.ok(sendTutorialPractice(w).error,'issuing a return order alone does not complete the lesson');
  for(let n=0;n<180/DT && !w.lesson.refuelled;n++)tick(w,DT);
  assert.equal(w.lesson.refuelled,true);assert.equal(booster.loaded,true);
  assert.equal(booster.order.kind,'defend');
  assert.equal(sendTutorialPractice(w).error,undefined);
});


test('final assault restores a defended colony, grants once, and waits for its destruction',()=>{
  const w=createScenario('garden');beginTutorial(w);w.progress.launched=true;w.progress.intercepted=true;
  const target=entity(w,'ochre');target.hp=0;const budget=w.metal.player;
  beginTutorialAssault(w);
  assert.equal(w.lesson.phase,'assault');assert.equal(target.team,'enemy');assert.equal(target.hp,240);
  assert.equal(w.metal.player,budget+500);
  const guards=w.units.filter(u=>u.team==='enemy' && u.hostId===target.id);
  assert.equal(guards.filter(u=>u.type==='platform').length,2);
  assert.equal(guards.filter(u=>u.type==='drone').length,3);
  assert.ok(guards.every(u=>u.color===target.color));
  beginTutorialAssault(w);assert.equal(w.metal.player,budget+500);
  tick(w,1);assert.equal(w.outcome,null,'earlier tutorial success must not finish the assault');
  target.hp=1;advanceTutorial(w);assert.equal(w.lesson.phase,'assault');assert.equal(w.outcome,null);
  target.hp=0;advanceTutorial(w);assert.equal(w.lesson.phase,'complete');assert.equal(w.outcome,'victory');
});

test('skipping the final assault keeps the defended system open without a false victory',()=>{
  const w=createScenario('garden');beginTutorial(w);w.progress.launched=true;w.progress.intercepted=true;
  beginTutorialAssault(w);skipTutorial(w);step(w);
  assert.equal(w.lesson,undefined);assert.equal(w.mode,'sandbox');assert.equal(w.outcome,null);
  assert.equal(entity(w,'ochre').team,'enemy');assert.equal(entity(w,'ochre').hp,240);
});
