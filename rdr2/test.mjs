import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,copyFile,rm,mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {DURATION,BPM,BEAT,TOTAL_BEATS,BAR,CHAPTERS,CAPTIONS,SOURCES} from './story.mjs';
const require=createRequire(new URL('../web/package.json',import.meta.url)),{chromium}=require('playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),qa=resolve(root,'rdr2/output/qa'),entry=resolve(root,'export/西部余烬/开始观看.html');
await mkdir(qa,{recursive:true});
const full=process.argv.includes('--full'),headed=process.argv.includes('--headed'),channel=process.argv.includes('--edge')?'msedge':'chrome';
const browser=await chromium.launch({channel,headless:!headed});
const context=await browser.newContext({viewport:{width:1440,height:900},offline:true,reducedMotion:'no-preference'}),page=await context.newPage();
const errors=[],network=[],checks=[],lifecycle=[];
let cleaningUp=false;
for(const [emitter,event] of [[page,'close'],[page,'crash'],[browser,'disconnected']])emitter.on(event,()=>{if(!cleaningUp)lifecycle.push({event,time:new Date().toISOString()});});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);},sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let temp=null;
try{
  const html=await readFile(entry,'utf8');check(DURATION===180&&TOTAL_BEATS===384&&BPM===128,'Exactly three minutes on a 384-beat timeline');
  check(!/speechSynthesis|SpeechSynthesisUtterance|rotate[XY]\(|perspective\(/.test(html),'No speech generation or 3D transformation');
  check(CHAPTERS.reduce((sum,ch)=>sum+ch.bars,0)===96,'Thirteen unequal acts span 96 bars');
  for(const ch of CHAPTERS)check(Math.abs(ch.start/BEAT-Math.round(ch.start/BEAT))<1e-7,`${ch.id} starts on the music grid`);
  for(const cue of CAPTIONS){check(cue.start>=0&&cue.end<=180&&cue.end>cue.start,`Valid caption window ${cue.start}`);if(cue.kind==='dialogue')check(cue.speaker.includes('创意改写'),`Dialogue ${cue.start} is explicitly original interpretation`);if(cue.kind==='fact')check(!!SOURCES[cue.source],`Fact ${cue.start} has an official source`);}
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});await page.waitForFunction(()=>window.__WESTERN__?.ready,null,{timeout:35000});
  const initial=await page.evaluate(()=>window.__WESTERN__.state);console.log('READY',JSON.stringify(initial));
  check(Math.abs(initial.audioDuration-180)<.065,'Native local audio duration matches the film');check(await page.locator('audio').count()===1&&await page.locator('img,video').count()===0,'Single original score; no prerecorded footage or images');
  await page.screenshot({path:resolve(qa,`${channel}-poster.png`)});
  const frames=[];
  for(const ch of CHAPTERS){const t=ch.start+Math.min(6,(ch.end-ch.start)*.55);const png=await page.evaluate(time=>window.__WESTERN__.render(time),t);const state=await page.evaluate(()=>window.__WESTERN__.state);const cue=CAPTIONS.find(item=>t>=item.start&&t<item.end);check(state.chapter===ch.id,`Rendered chapter ${ch.id}`);check(state.caption===(cue?.text||''),`Correct subtitle in ${ch.id}`);await page.screenshot({path:resolve(qa,`${channel}-${ch.id}.png`)});frames.push({time:t,chapter:ch.id,pixels:sha(Buffer.from(png.split(',')[1],'base64'))});}
  await page.evaluate(()=>window.__WESTERN__.render(175.8));await page.screenshot({path:resolve(qa,`${channel}-title.png`)});
  check(new Set(frames.map(frame=>frame.pixels)).size===13,'Thirteen visually distinct compositions');
  for(const [label,t] of [['year',10.8],['journal',50.2],['silence',103.3],['answer',135.4],['dawn',160.5]]){await page.evaluate(time=>window.__WESTERN__.render(time),t);await page.screenshot({path:resolve(qa,`${channel}-detail-${label}.png`)});}
  for(let index=1;index<CHAPTERS.length;index++){const chapter=CHAPTERS[index];await page.evaluate(t=>window.__WESTERN__.seek(t),chapter.start-.001);check((await page.evaluate(()=>window.__WESTERN__.state.chapter))===CHAPTERS[index-1].id,`Previous act holds until ${chapter.start}s`);await page.evaluate(t=>window.__WESTERN__.seek(t),chapter.start);check((await page.evaluate(()=>window.__WESTERN__.state.chapter))===chapter.id,`Exact cut at ${chapter.start}s`);}
  for(const cue of CAPTIONS){await page.evaluate(t=>window.__WESTERN__.render(t),cue.start+.15);check(await page.locator('#caption').textContent()===cue.text,`Caption ${cue.start}s intact`);check(await page.locator('#speaker').textContent()===cue.speaker,`Caption ${cue.start}s names the correct speaker`);const fits=await page.locator('#caption').evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().height<document.querySelector('#caption-box').getBoundingClientRect().height);check(fits,`Caption ${cue.start}s readable and inside its box`);}
  const one=await page.evaluate(()=>window.__WESTERN__.render(113.2));await page.evaluate(()=>window.__WESTERN__.render(24));const two=await page.evaluate(()=>window.__WESTERN__.render(113.2));check(one===two,'Exact pixel determinism after arbitrary seeking');
  const finalDifference=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const renderer=createWesternWorld(canvas,window.__WESTERN__.chapters),ctx=canvas.getContext('2d');renderer.draw(180-1e-9,{reduced:true});const before=ctx.getImageData(0,0,640,360).data;renderer.draw(180,{reduced:true});const after=ctx.getImageData(0,0,640,360).data;let sum=0;for(let i=0;i<before.length;i++)sum+=Math.abs(before[i]-after[i]);return sum/before.length;});
  check(finalDifference<.1,'Subnanosecond endpoint remains on the final title, never wraps to the opening');
  const actorStats=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=240;canvas.height=180;const ctx=canvas.getContext('2d'),actors=createWesternActors();const snapshots=[];
    for(const action of ['idle','walk','point','lantern','journal','sit','reach']){ctx.clearRect(0,0,240,180);actors.person(ctx,120,170,1,{scale:4,identity:'arthur',action});snapshots.push(canvas.toDataURL());}
    const horse=[];for(const time of [0,.13,.3]){ctx.clearRect(0,0,240,180);actors.horse(ctx,120,170,time,{scale:2.5,rider:'arthur',gait:'gallop'});horse.push(canvas.toDataURL());}
    const wagon=[];for(const time of [0,.4]){ctx.clearRect(0,0,240,180);actors.wagon(ctx,110,165,time,{scale:1.8,moving:true});wagon.push(canvas.toDataURL());}
    return {poses:new Set(snapshots).size,horseFrames:new Set(horse).size,wagonFrames:new Set(wagon).size};
  });
  check(actorStats.poses===7,'Seven concrete person actions differ');check(actorStats.horseFrames===3,'Horse gait changes articulated body and legs');check(actorStats.wagonFrames===2,'Wagon wheels and motion animate');
  await page.evaluate(()=>window.__WESTERN__.seek(0));await page.locator('#toggle').click();await page.waitForFunction(()=>window.__WESTERN__.state.time>.8);await page.keyboard.press('Space');const paused=await page.evaluate(()=>window.__WESTERN__.state.time);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));check(await page.evaluate(()=>window.__WESTERN__.state.time)===paused,'Pause freezes soundtrack clock');
  await page.keyboard.press('ArrowRight');check(Math.abs((await page.evaluate(()=>window.__WESTERN__.state.time))-paused-BAR)<.03,'Keyboard skips one exact musical bar');
  await page.locator('#mute').click();check(await page.locator('#mute').getAttribute('aria-pressed')==='true','Mute toggles');await page.locator('#mute').click();
  await page.locator('#about').click();check(await page.locator('#about-dialog').isVisible(),'Fact sources and dialogue disclaimer accessible');await page.locator('#gentle').check();check(await page.evaluate(()=>window.__WESTERN__.state.reduced),'Gentle motion mode activates');await page.locator('#gentle').uncheck();await page.locator('#close-about').click();
  let playback=null;
  if(full){await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.__WESTERN__?.ready);await page.locator('#start-fullscreen').click();await page.waitForFunction(()=>document.fullscreenElement?.id==='cinema');await page.waitForFunction(()=>window.__WESTERN__.state.time>=2&&document.querySelector('#cinema').classList.contains('controls-hidden'));
    const bounds=await page.locator('#stage').boundingBox();check(Math.abs(bounds.width/bounds.height-16/9)<.002,'Native fullscreen retains original composition');check(await page.locator('#controls').evaluate(e=>getComputedStyle(e).visibility)==='hidden','Recording controls auto-hide');
    for(const ch of CHAPTERS.slice(1)){await page.waitForFunction(t=>window.__WESTERN__.state.time>=t,ch.start+.8,{timeout:30000});const state=await page.evaluate(()=>window.__WESTERN__.state);check(state.chapter===ch.id,`Real-time playback reaches ${ch.id}`);console.log('PLAYBACK',state.time.toFixed(1),state.chapter);}
    await page.waitForFunction(()=>window.__WESTERN__.state.ended,null,{timeout:25000});playback=await page.evaluate(()=>window.__WESTERN__.state);check(playback.time===180,'Film ends at exactly 180 seconds');check(Math.abs(playback.elapsedMs-180000)<2200,'No accumulated drift over three actual minutes');await page.locator('#end-replay').click();await page.waitForFunction(()=>window.__WESTERN__.state.playing&&window.__WESTERN__.state.time>.3&&window.__WESTERN__.state.time<4);check(true,'Replay works after complete three-minute film');await page.keyboard.press('Space');await page.evaluate(()=>document.exitFullscreen());
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__WESTERN__.render(116));await page.screenshot({path:resolve(qa,`${channel}-mobile.png`)});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No mobile horizontal overflow');
  temp=await mkdtemp(resolve(tmpdir(),'western-offline-'));await mkdir(resolve(temp,'audio'));await copyFile(entry,resolve(temp,'index.html'));await copyFile(resolve(root,'export/西部余烬/audio/master.mp3'),resolve(temp,'audio/master.mp3'));await page.goto(pathToFileURL(resolve(temp,'index.html')).href,{waitUntil:'load'});await page.waitForFunction(()=>window.__WESTERN__?.ready,null,{timeout:35000});check((await page.evaluate(()=>window.__WESTERN__.state.source)).endsWith('/audio/master.mp3'),'Copied standalone folder works outside project');
  check(network.length===0,'Zero network dependencies');check(errors.length===0,'No browser or resource errors');const report={result:'PASS',browser:await browser.version(),channel,full,headed,checks,frames,actorStats,playback,errors,network,lifecycle};await writeFile(resolve(qa,`${channel}-${full?'full-':''}report.json`),JSON.stringify(report,null,2));console.log('PASS',JSON.stringify({checks:checks.length,channel,full,headed,actorStats,playback}));
}catch(error){await writeFile(resolve(qa,`${channel}-last-failure.json`),JSON.stringify({result:'FAIL',error:error.message,channel,full,headed,checks,errors,network,lifecycle},null,2));throw error;}
finally{cleaningUp=true;await browser.close();if(temp)await rm(temp,{recursive:true,force:true});}