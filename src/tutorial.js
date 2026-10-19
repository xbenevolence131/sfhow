import { entity, spawn, addRock, announce, aimRock, predict, launchRock, step, DT, MAX_IMPULSE } from './simulation.js';

export function beginTutorial(w) {
  // The opening impact teaches why defenses matter. Keep the launch booster.
  w.units=w.units.filter(u=>u.team!=='player' || !['ship','platform','drone'].includes(u.type));
  w.lesson = { phase: 'basics', builtIds: [], grant: false };
}
export function skipTutorial(w) {
  // Unfired range props belong to this exercise; actual attacks keep flying.
  const rock=entity(w,w.lesson?.rockId);
  if(rock && !rock.launched) w.units=w.units.filter(u=>u.id!==rock.id && u.id!==rock.boosterId);
  if(w.lesson?.phase==='assault') {
    w.mode='sandbox';w.continueSandbox=true;
    w.setup={...w.setup,mode:'sandbox',system:'two',enemies:true,budget:240,unlimited:false};
  }
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
export function beginTutorialAssault(w) {
  const lesson=w.lesson, target=w.planets.find(p=>p.id==='ochre');
  if(!lesson || !target || lesson.assaultGrant)return;
  // Start a fresh, explicit live-fire challenge after the earlier target practice.
  target.team='enemy';target.hp=target.maxHp=240;
  lesson.assaultTargetId=target.id;lesson.assaultLaunches=0;
  lesson.assaultGrant=true;lesson.phase='assault';
  w.metal.player=Math.min(999,w.metal.player+500);
  for(const type of ['platform','platform','drone','drone','drone'])spawn(w,type,'enemy',target,true);
  announce(w,'Final lesson / overwhelm Ochre','Ochre is restored to 240 integrity and defended by two platforms and three ramming drones. +500 metal: add a booster and two ships, then combine rock volleys with a fleet attack.',true);
}
export function tutorialDefenses(w) {
  const units=w.units.filter(u=>u.hp>0 && u.team==='player' && w.lesson?.builtIds.includes(u.id));
  return { platforms:units.filter(u=>u.type==='platform').length, drones:units.filter(u=>u.type==='drone').length, ships:units.filter(u=>u.type==='ship').length };
}
export function prepareTutorialAttack(w, initial=false) {
  const home=w.planets.find(p=>p.team==='player');
  const old=entity(w,w.lesson.rockId);
  if(old && !old.launched)w.units=w.units.filter(u=>u.id!==old.id && u.id!==old.boosterId);
  const angle=Math.atan2(home.y,home.x);
  const rock=addRock(w,angle,home.orbit+320,initial?'FIRST PRACTICE ROCK':'DEFENSE TEST ROCK','medium');
  Object.assign(rock,{x:home.x+Math.cos(angle)*320,y:home.y+Math.sin(angle)*320,vx:home.vx,vy:home.vy,
    team:'enemy',practice:true,tutorialStaged:true});
  rock.beltOmega=Math.hypot(home.vx,home.vy)/rock.beltOrbit;
  rock.beltPhase=angle-w.time*rock.beltOmega;
  const booster=spawn(w,'booster','enemy',w.practiceDock,true);
  if(booster.error){rock.hp=0;return {error:booster.error};}
  Object.assign(booster,{x:rock.x+16,y:rock.y,vx:rock.vx,vy:rock.vy,attachedRockId:rock.id,
    attachOffset:{x:16,y:0},order:{kind:'attached',targetId:rock.id},practice:true});
  Object.assign(rock,{boosterId:booster.id,boosterTeam:'enemy'});
  w.lesson.rockId=rock.id; w.lesson.finalIntercepted=false; w.lesson.phase=initial?'basics':'fortify';
  if(!initial)announce(w,'Defense exercise ready','A matching asteroid and attached enemy booster are staged outside Verdant. Launch it when your defenses are ready.');
  return rock;
}
export function sendTutorialPractice(w) {
  if(w.lesson?.phase!=='basics')return {error:'Follow the current tutorial step.'};
  if(!w.lesson.refuelled)return {error:'Return your booster to Verdant and wait for its eight-second refuel first.'};
  if(entity(w,w.lesson.firstRockId))return {error:'The first practice rock is already incoming.'};
  const rock=prepareTutorialAttack(w,true);
  if(rock.error)return rock;
  const result=launchTutorialAttack(w,true);
  if(!result.error)w.lesson.firstRockId=rock.id;
  else {
    w.units=w.units.filter(u=>u.id!==rock.id && u.id!==rock.boosterId);
    w.lesson.rockId=null;
  }
  return result;
}
export function launchTutorialAttack(w, initial=false) {
  if(!w.lesson || w.lesson.phase!==(initial?'basics':'fortify'))return {error:'Prepare the defense exercise first.'};
  const defenses=tutorialDefenses(w);
  if(!initial && (defenses.platforms<1 || defenses.drones<2 || defenses.ships<1))return {error:'Build one platform, two drones, and one ship at Verdant first.'};
  const rock=entity(w,w.lesson.rockId), home=w.planets.find(p=>p.team==='player');
  if(!rock)return {error:'The staged rock was lost. Prepare another attack.'};
  // Use the same burn, impulse cap, gravity, and moving-body collision forecast.
  for(const duration of [35,45,25,55,65]) {
    const impulse=aimRock(w,rock,home,duration);
    if(Math.hypot(impulse.x,impulse.y)>MAX_IMPULSE)continue;
    const forecast=predict(w,[rock.id],{id:rock.id,impulse,team:'enemy'},90,false).get(rock.id);
    if(forecast?.impact?.targetId!==home.id)continue;
    if(!initial) {
      // Choose a teaching shot the purchased defenses can actually intercept.
      // Validate with real combat as well as gravity; never script the outcome.
      const trial=structuredClone(w);
      launchRock(trial,rock.id,impulse,'enemy',true);trial.lesson.phase='defense';
      for(let n=0;n<90/DT && entity(trial,rock.id) && !trial.outcome;n++)step(trial);
      if(!trial.lesson.finalIntercepted)continue;
    }
    const result=launchRock(w,rock.id,impulse,'enemy',true);
    if(result.error)return result;
    w.lesson.phase=initial?'basics':'defense'; w.lesson.impactTime=w.time+forecast.impact.time;
    return result;
  }
  return {error:'No clear shot at this alignment. Prepare another attack to reset the staging position.'};
}
export function advanceTutorial(w) {
  const lesson=w.lesson;
  if(!lesson || w.outcome)return;
  if(lesson.phase==='basics' && lesson.firstRockId && !entity(w,lesson.firstRockId)) {
    const first=w.units.find(u=>u.id===lesson.firstRockId), home=w.planets.find(p=>p.team==='player');
    if(first?.impact?.targetId===home.id) {
      lesson.firstImpact=true;
      if(!lesson.grant){w.metal.player+=210;lesson.grant=true;}
      prepareTutorialAttack(w);
      announce(w,'Colony hit / build defenses','Your colony took real damage. +210 metal: build a platform, two drones, and a combat ship before testing another attack.');
    } else {
      lesson.firstRockId=null;
      announce(w,'Try the first attack again','The rock did not reach Verdant. Send another practice rock to continue.');
    }
  } else if(lesson.phase==='combat' && !entity(w,lesson.targetId)) {
    if(lesson.attackHit) {
      beginTutorialAssault(w);
    } else tutorialCombatTarget(w);
  } else if(lesson.phase==='defense' && !entity(w,lesson.rockId)) {
    lesson.phase=lesson.finalIntercepted?'combat':'retry';
    if(lesson.finalIntercepted)tutorialCombatTarget(w);
    announce(w,lesson.finalIntercepted?'Your defenses held':'Try the defense exercise again',lesson.finalIntercepted?'Your new defenses stopped the same kind of rock that hit before. Now send your ship after its launcher.':'The test rock was not intercepted. Keep your defenders near Verdant, then prepare another attack.');
  } else if(lesson.phase==='assault' && entity(w,lesson.assaultTargetId)?.hp<=0) {
    lesson.phase='complete';w.outcome='victory';
    announce(w,'Tutorial complete','Ochre has fallen. You learned launching, reloading, defense, interception, and a combined assault.');
  }
}
