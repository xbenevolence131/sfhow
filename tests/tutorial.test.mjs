import test from 'node:test';
import assert from 'node:assert/strict';
import {createScenario} from '../src/scenarios.js';
import {DT,step,spawn,setOrder,entity,enemyLaunch} from '../src/simulation.js';
import {beginTutorial,advanceTutorial,prepareTutorialAttack,launchTutorialAttack,skipTutorial} from '../src/tutorial.js';
const tick=(w,seconds)=>{for(let i=0;i<seconds/DT;i++){step(w);advanceTutorial(w);}};
function defenseFixture(delay=0){
  const w=createScenario('garden');tick(w,delay);beginTutorial(w);
  w.progress.launched=true;w.progress.intercepted=true;w.lesson.phase='fortify';
  prepareTutorialAttack(w);
  for(const type of ['platform','drone','drone'])w.lesson.builtIds.push(spawn(w,type,'player',w.planets[0],true).id);
  return w;
}
test('guided completion waits for combat, grants once, and stages a fresh rock',()=>{
  const w=createScenario('garden');beginTutorial(w);w.progress.launched=true;w.progress.intercepted=true;
  tick(w,DT);assert.equal(w.outcome,null);assert.equal(w.lesson.phase,'combat');
  const enemy=entity(w,w.lesson.targetId),ship=w.units.find(u=>u.type==='ship');
  Object.assign(ship,{x:enemy.x+40,y:enemy.y,vx:enemy.vx,vy:enemy.vy});
  setOrder(w,ship.id,{kind:'attack',targetId:enemy.id});
  const initial=w.metal.player;
  for(let i=0;i<2400 && w.lesson.phase==='combat';i++)tick(w,DT);
  assert.equal(w.lesson.phase,'fortify');assert.equal(enemy.hp,0);assert.equal(w.lesson.attackHit,true);
  assert.ok(w.metal.player>=initial+130);assert.equal(w.lesson.grant,true);
  assert.equal(entity(w,w.lesson.rockId).boosterTeam,'enemy');
  assert.equal(enemyLaunch(w,true),false,'AI must wait for the player to launch the staged shot');
  const granted=w.metal.player;advanceTutorial(w);assert.equal(w.metal.player,granted);
  assert.ok(launchTutorialAttack(w).error,'Existing starting defenses do not count as new deployments');
});
test('reinforcements stop the same shot that gets through starting defenses',()=>{
  const reinforced=defenseFixture();assert.equal(launchTutorialAttack(reinforced).error,undefined);
  const baseline=structuredClone(reinforced);baseline.units=baseline.units.filter(u=>!baseline.lesson.builtIds.includes(u.id));
  tick(baseline,60);tick(reinforced,60);
  assert.equal(baseline.lesson.phase,'retry');assert.ok(baseline.planets[0].hp<240);
  assert.equal(reinforced.lesson.phase,'complete');assert.equal(reinforced.planets[0].hp,240);assert.equal(reinforced.outcome,'victory');
});
test('defense exercise works at later orbital positions and supports retry',()=>{
  for(const delay of [120,240,400]){
    const w=defenseFixture(delay);assert.equal(launchTutorialAttack(w).error,undefined);
    tick(w,60);assert.equal(w.lesson.phase,'complete',`delay ${delay}`);
  }
  const w=defenseFixture();entity(w,w.lesson.rockId).hp=0;
  assert.ok(launchTutorialAttack(w).error);prepareTutorialAttack(w);
  assert.equal(launchTutorialAttack(w).error,undefined);
});
test('skipping removes unfired exercise props and restores ordinary Garden completion',()=>{
  const w=defenseFixture(),rock=entity(w,w.lesson.rockId),boosterId=rock.boosterId;
  skipTutorial(w);assert.equal(w.lesson,undefined);assert.equal(entity(w,rock.id),null);assert.equal(entity(w,boosterId),null);
  step(w);assert.equal(w.outcome,'victory');
});
