import { entity, spawn, addRock, announce, aimRock, predict, launchRock, MAX_IMPULSE } from './simulation.js';

export function beginTutorial(w) {
  w.lesson = { phase: 'basics', builtIds: [], grant: false };
}
export function skipTutorial(w) {
  // Unfired range props belong to this exercise; actual attacks keep flying.
  const rock=entity(w,w.lesson?.rockId);
  if(rock && !rock.launched) w.units=w.units.filter(u=>u.id!==rock.id && u.id!==rock.boosterId);
  delete w.lesson;
}
function tutorialCombatTarget(w) {
  let booster=w.units.find(u=>u.hp>0 && u.practice && u.type==='booster' && !u.attachedRockId);
  if(!booster) booster=spawn(w,'booster','enemy',w.practiceDock,true);
  if(booster.error)return;
  booster.practice=true;
  w.lesson.targetId=booster.id; w.lesson.attackerId=null; w.lesson.attackHit=false;
  announce(w,'Combat lesson','Select a ship and attack the marked enemy booster.');
}
export function tutorialDefenses(w) {
  const units=w.units.filter(u=>u.hp>0 && u.team==='player' && w.lesson?.builtIds.includes(u.id));
  return { platforms:units.filter(u=>u.type==='platform').length, drones:units.filter(u=>u.type==='drone').length };
}
export function prepareTutorialAttack(w) {
  const home=w.planets.find(p=>p.team==='player');
  const old=entity(w,w.lesson.rockId);
  if(old && !old.launched)w.units=w.units.filter(u=>u.id!==old.id && u.id!==old.boosterId);
  const angle=Math.atan2(home.y,home.x);
  const rock=addRock(w,angle,home.orbit+320,'DEFENSE TEST ROCK','large');
  Object.assign(rock,{x:home.x+Math.cos(angle)*320,y:home.y+Math.sin(angle)*320,vx:home.vx,vy:home.vy,
    hp:140,maxHp:140,team:'enemy',practice:true,tutorialStaged:true});
  rock.beltOmega=Math.hypot(home.vx,home.vy)/rock.beltOrbit;
  rock.beltPhase=angle-w.time*rock.beltOmega;
  const booster=spawn(w,'booster','enemy',w.practiceDock,true);
  if(booster.error){rock.hp=0;return {error:booster.error};}
  Object.assign(booster,{x:rock.x+16,y:rock.y,vx:rock.vx,vy:rock.vy,attachedRockId:rock.id,
    attachOffset:{x:16,y:0},order:{kind:'attached',targetId:rock.id},practice:true});
  Object.assign(rock,{boosterId:booster.id,boosterTeam:'enemy'});
  w.lesson.rockId=rock.id; w.lesson.finalIntercepted=false; w.lesson.phase='fortify';
  announce(w,'Defense exercise ready','A reinforced asteroid and attached enemy booster are staged outside Verdant. Launch it when your defenses are ready.');
  return rock;
}
export function launchTutorialAttack(w) {
  if(!w.lesson || w.lesson.phase!=='fortify')return {error:'Prepare the defense exercise first.'};
  const defenses=tutorialDefenses(w);
  if(defenses.platforms<1 || defenses.drones<2)return {error:'Build one new platform and two new drones at Verdant first.'};
  const rock=entity(w,w.lesson.rockId), home=w.planets.find(p=>p.team==='player');
  if(!rock)return {error:'The staged rock was lost. Prepare another attack.'};
  // Use the same burn, impulse cap, gravity, and moving-body collision forecast.
  for(const duration of [35,45,25,55,65]) {
    const impulse=aimRock(w,rock,home,duration);
    if(Math.hypot(impulse.x,impulse.y)>MAX_IMPULSE)continue;
    const forecast=predict(w,[rock.id],{id:rock.id,impulse,team:'enemy'},90).get(rock.id);
    if(forecast?.impact?.targetId!==home.id)continue;
    const result=launchRock(w,rock.id,impulse,'enemy',true);
    if(result.error)return result;
    w.lesson.phase='defense'; w.lesson.impactTime=w.time+forecast.impact.time;
    return result;
  }
  return {error:'No clear shot at this alignment. Prepare another attack to reset the staging position.'};
}
export function advanceTutorial(w) {
  const lesson=w.lesson;
  if(!lesson || w.outcome)return;
  if(lesson.phase==='basics' && w.progress.launched && w.progress.intercepted) {
    lesson.phase='combat'; tutorialCombatTarget(w);
  } else if(lesson.phase==='combat' && !entity(w,lesson.targetId)) {
    if(lesson.attackHit) {
      if(!lesson.grant){w.metal.player+=130;lesson.grant=true;}
      prepareTutorialAttack(w);
      announce(w,'Reinforcement grant: +130 metal','Select Verdant. Deploy one platform and two drones, then launch the prepared attack.');
    } else tutorialCombatTarget(w);
  } else if(lesson.phase==='defense' && !entity(w,lesson.rockId)) {
    lesson.phase=lesson.finalIntercepted?'complete':'retry';
    if(lesson.phase==='complete')w.outcome='victory';
    announce(w,lesson.finalIntercepted?'Reinforced defenses held':'Try the defense exercise again',lesson.finalIntercepted?'Your new defenses destroyed the incoming rock.':'The test rock was not intercepted. Keep your defenders near Verdant, then prepare another attack.');
  }
}
