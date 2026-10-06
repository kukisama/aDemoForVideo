/* Isolated, read-only-to-project visual contract checks. No player, audio, or
 * generated HTML needed. Browser profile is managed by Playwright. No QA files
 * are emitted; every frame and diagnostic remains in memory. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {CHAPTERS,SHOTS,ACTION_CUES,HOLDS,BEAT,BPM,DURATION,WIDTH,HEIGHT} from './story.mjs';
const require=createRequire(new URL('../web/package.json',import.meta.url));
const {chromium}=require('playwright');
const scripts=await Promise.all(['art-characters.js','world.js'].map(name=>readFile(new URL(name,import.meta.url),'utf8')));
const lockedBefore=await Promise.all(['story.mjs','facts.md'].map(async name=>createHash('sha256').update(await readFile(new URL(name,import.meta.url))).digest('hex')));
for(const source of scripts){assert.doesNotMatch(source,/Math\.random\s*\(|requestAnimationFrame\s*\(|setInterval\s*\(|Date\.now\s*\(|performance\.now\s*\(/);assert.doesNotMatch(source,/^\s*(?:import|export)\s/m);}
assert.equal(SHOTS.length,54);
const browser=await chromium.launch({channel:process.argv.includes('--edge')?'msedge':'chrome',headless:!process.argv.includes('--headed')});
const errors=[],requests=[];
let report;
try{
  const context=await browser.newContext({viewport:{width:1280,height:720},offline:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.setContent('<!doctype html><style>html,body{margin:0;background:#09121d}canvas{width:1280px;height:720px;image-rendering:pixelated}</style><canvas id="film"></canvas>');
  for(const source of scripts)await page.addScriptTag({content:source});
  await page.evaluate(data=>{window.filmData=data;window.world=createOdysseyWorld(document.querySelector('canvas'),data);}, {chapters:CHAPTERS,shots:SHOTS,actionCues:ACTION_CUES,holds:HOLDS,beat:BEAT,bpm:BPM,duration:DURATION,width:WIDTH,height:HEIGHT});
  report=await page.evaluate(()=>{
    const checks=[],frames=[],world=window.world,cv=document.querySelector('canvas'),ctx=cv.getContext('2d');
    const check=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};
    const hash=bytes=>{let h=2166136261;for(let i=0;i<bytes.length;i++)h=Math.imul(h^bytes[i],16777619);return h>>>0;};
    const pixels=()=>ctx.getImageData(0,0,640,360).data;
    let draws=0;const render=(t,o={})=>{world.draw(t,o);draws++;const tr=ctx.getTransform();check(tr.isIdentity&&ctx.globalAlpha===1,'balanced context '+t);return hash(pixels());};
    const colors=()=>{const set=new Set(),bytes=pixels();let light=0;for(let i=0;i<bytes.length;i+=16){set.add((bytes[i]<<16)|(bytes[i+1]<<8)|bytes[i+2]);if(bytes[i]+bytes[i+1]+bytes[i+2]>105)light++;}return {count:set.size,lit:light/(bytes.length/16)};};
    for(const shot of filmData.shots){
      const t=(shot.start+shot.end)/2,h=render(t),info=world.inspect(t),stats=colors();
      check(info.shot===shot.id,'shot '+shot.id);check(stats.count>20&&stats.lit>.08,'nonblank '+shot.id+' '+JSON.stringify(stats));
      render(180);check(render(t)===h,'reverse seek '+shot.id);
      const reduced=render(t,{reduced:true});render(0,{poster:true});check(render(t,{reduced:true})===reduced,'reduced seek '+shot.id);
      for(const boundary of [shot.start,shot.end-.000001])check(world.inspect(boundary).shot===shot.id,'boundary '+shot.id+' '+boundary);
      frames.push({shot:shot.id,t,hash:h,colors:stats.count,lit:stats.lit});
    }
    check(new Set(frames.map(f=>f.hash)).size===54,'54 distinct shot images');
    for(const cue of filmData.actionCues){
      const images=[-.35,0,.18,.7].map(dt=>render(cue.time+dt));
      check(new Set(images).size>=3,'cue anticipation/contact/recovery '+cue.id);
      check(world.inspect(cue.time).action===cue.id,'exact cue '+cue.id);
    }
    const shotSet=new Set();for(let t=0;t<=180;t+=.5){render(t);shotSet.add(world.inspect(t).shot);}
    check(shotSet.size===54,'all shots in 361-frame scan');
    const arrow=filmData.actionCues.find(q=>q.id==='arrow-release'),arrival=filmData.actionCues.find(q=>q.id==='twelve-axes');
    check(arrow.time===147.5,'locked release 147.5 seconds');check(!world.inspect(arrow.time-.000001).arrow.released,'no premature arrow');check(world.inspect(arrow.time).arrow.released,'arrow begins exactly at release');
    const stations=world.inspect(147.5).axeStations;check(stations.length===12&&new Set(stations.map(q=>q.x)).size===12,'twelve separate targets');
    for(const s of stations){const t=arrow.time+(arrival.time-arrow.time)*(s.x-242)/(559-242),a=world.inspect(t).arrow;
      check(Math.abs(a.x-s.x)<1e-7&&a.y>s.y-14*s.s&&a.y<s.y,'actual path through axe '+s.x);render(t);}
    check(Math.abs(world.inspect(arrival.time).arrow.x-stations.at(-1).x)<1e-7,'twelfth rim matches arrival cue');
    const reveal=filmData.shots.find(q=>q.id==='root-bed').start;
    for(const t of [0,44,85,147.5,163.5,reveal-.000001])check(!world.inspect(t).bedVisible,'bed hidden '+t);
    check(world.inspect(reveal).bedVisible,'bed appears at locked reveal');
    const end=render(180);check(world.inspect(180).chapter==='home'&&world.inspect(180).shot==='home-coast','endpoint stays home');check(render(999)===end,'time beyond 180 clamped');check(end!==render(0),'ending never wraps');
    const cover=render(0,{poster:true});check(render(180,{poster:true})===cover,'time independent spoiler-free poster');check(world.snapshot().startsWith('data:image/png;base64,'),'snapshot PNG');
    const actorCanvas=document.createElement('canvas');actorCanvas.width=400;actorCanvas.height=300;const ac=actorCanvas.getContext('2d'),actors=world.actors;
    const actorHashes=[];const actions=['idle','walk','run','guard','slash','thrust','bow','roll','climb','bound','kneel','reach','embrace','raise','row'];
    for(const action of actions){ac.clearRect(0,0,400,300);const p=actors.person(ac,170,260,.17,{action,phase:.5,scale:3});actorHashes.push(hash(ac.getImageData(0,0,400,300).data));check(p.pose.handNear.every(Number.isFinite),'finite joints '+action);check(ac.getTransform().isIdentity,'actor context '+action);}
    check(new Set(actorHashes).size===actions.length,'15 distinct articulated actions');
    ac.clearRect(0,0,400,300);actors.person(ac,170,260,1,{scale:1.63,action:'guard'});
    const raw=ac.getImageData(0,0,400,300).data,actorColors=new Set();let partial=0;
    for(let i=0;i<raw.length;i+=4){if(raw[i+3]>0)actorColors.add((raw[i]<<16)|(raw[i+1]<<8)|raw[i+2]);if(raw[i+3]>0&&raw[i+3]<255)partial++;}
    check(actorColors.size<=32&&partial===0,'fractional actor scale retains crisp palette '+actorColors.size+' colors; '+partial+' partial pixels');
    const idHashes=[];for(const identity of ['odysseus','telemachus','penelope','sailor','guard']){ac.clearRect(0,0,400,300);actors.person(ac,170,260,0,{identity,scale:3});idHashes.push(hash(ac.getImageData(0,0,400,300).data));}check(new Set(idHashes).size===5,'five identity silhouettes/palettes');
    const target=[30,-52],held=actors.person(ac,170,260,1,{scale:2,action:'raise',handNear:target});check(held.handNear[0]===230&&held.handNear[1]===156,'IK grip target exact');
    const heads=actors.scylla(ac,270,270,1,{scale:1,extension:1});check(heads.length===6&&new Set(heads.map(q=>q.join(','))).size===6,'six separately articulated heads');
    const ships=[];for(const t of [0,.17,.33]){ac.clearRect(0,0,400,300);actors.ship(ac,200,220,t,{scale:1.2});ships.push(hash(ac.getImageData(0,0,400,300).data));}check(new Set(ships).size===3,'ship sail and oars animate');
    // Constructor-level cue retiming catches secretly hardcoded release values.
    const moved={...filmData,actionCues:filmData.actionCues.map(q=>q.id==='arrow-release'||q.id==='twelve-axes'?{...q,time:q.time+.2}:q)};
    const alternate=createOdysseyWorld(actorCanvas,moved);check(!alternate.inspect(147.5).arrow.released&&alternate.inspect(147.7).arrow.released,'renderer obeys supplied cue times');
    const timings=[];for(const shot of filmData.shots){const begin=performance.now();world.draw((shot.start+shot.end)/2);timings.push(performance.now()-begin);}
    timings.sort((a,b)=>a-b);render(180);
    return {checks:checks.length,draws,shots:frames.length,actions:actions.length,identities:5,frames,drawSubmissionMs:{median:timings[Math.floor(timings.length/2)],max:timings.at(-1)},note:'Submission times are not playback FPS; no audio/player or manual visual review is claimed.'};
  });
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  const lockedAfter=await Promise.all(['story.mjs','facts.md'].map(async name=>createHash('sha256').update(await readFile(new URL(name,import.meta.url))).digest('hex')));
  assert.deepEqual(lockedAfter,lockedBefore,'locked source files unchanged during test');
  const output=process.argv.includes('--summary')?{...report,frames:undefined}:report;
  console.log(JSON.stringify({result:'PASS',browser:await browser.version(),...output,errors,networkRequests:requests.length,lockedFilesUnchanged:true},null,2));
}finally{await browser.close();}