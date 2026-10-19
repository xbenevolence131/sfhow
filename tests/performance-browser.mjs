// Repeatable six-second headless Skirmish stress sample; timings are informational.
﻿import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{for(const name of ['current']){
 const page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('../dist/index.html',import.meta.url).href);
 await page.locator('#modal-secondary').click();
 await page.evaluate(()=>{const g=orbital;g.load('neighbors',{mode:'skirmish',system:'three',layoutSeed:17,visitorSeed:42});g.closeModal();g.world.ai.disabled=true;g.world.visitors.nextAt=Infinity;g.world.continueSandbox=true;g.ui.selectedId=null;g.autoPause=false;document.getElementById('autopause').checked=false;
 for(const r of g.world.units.filter(u=>u.type==='rock').slice(0,3)){const a=Math.atan2(r.y,r.x);Object.assign(r,{launched:true,visitor:true,vx:12*Math.cos(a)-8*Math.sin(a),vy:12*Math.sin(a)+8*Math.cos(a)});}
 g.setSpeed(20);});
 const stats=await page.evaluate(()=>new Promise(resolve=>{const start=performance.now(),startSim=orbital.world.time,frames=[];let previous=start;const sample=now=>{frames.push(now-previous);previous=now;if(now-start<6000){requestAnimationFrame(sample);return;}orbital.paused=true;frames.sort((a,b)=>a-b);resolve({wallMs:now-start,simSeconds:orbital.world.time-startSim,frames:frames.length,p95FrameMs:frames[Math.floor(frames.length*.95)],maxFrameMs:frames.at(-1)});};requestAnimationFrame(sample);}));
 console.log(JSON.stringify({name,...stats,errors}));await page.close();
}}finally{await browser.close();}
