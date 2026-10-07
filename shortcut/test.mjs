import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,copyFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {CHAPTERS,SHOTS,CAPTIONS,DURATION,BAR} from './story.mjs';
import {trafficAt} from './traffic.mjs';
import {verifyPrevious} from './protect.mjs';
const require=createRequire(new URL('../web/package.json',import.meta.url)),{chromium}=require('playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),qa=resolve(root,'shortcut/output/qa'),entry=resolve(root,'export/赶路的人/开始观看.html');
const full=process.argv.includes('--full'),channel=process.argv.includes('--edge')?'msedge':'chrome';
await mkdir(qa,{recursive:true});
const before=verifyPrevious(),browser=await chromium.launch({channel,headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},offline:true,reducedMotion:'no-preference'}),page=await context.newPage();
const errors=[],network=[],checks=[],captures=[];let temp;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/i.test(r.url()))network.push(r.url());});
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);},sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function ready(){await page.waitForFunction(()=>window.__SHORTCUT__?.ready,null,{timeout:30000});}
async function shot(name,t){if(t!==null)await page.evaluate(time=>window.__SHORTCUT__.render(time),t);const file=resolve(qa,`${channel}-${name}.png`);await page.locator('#stage').screenshot({path:file});captures.push({name,time:t,file});}
try{
  const html=await readFile(entry,'utf8');check(!/<(?:img|video)\b/i.test(html),'Programmatic original art, not a video/image slideshow');
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});await ready();
  check(await page.locator('#poster').isVisible(),'Readable start cover');check(Math.abs(await page.evaluate(()=>window.__SHORTCUT__.state.audioDuration)-60)<.065,'Browser decodes native local music to 60 seconds');
  await shot('poster',null);
  const hashes=[];
  for(let i=0;i<SHOTS.length;i++){const s=SHOTS[i],t=(s.start+s.end)/2,png=await page.evaluate(time=>window.__SHORTCUT__.render(time),t);const state=await page.evaluate(()=>window.__SHORTCUT__.state);check(state.shot===s.id&&state.chapter===s.chapter,`Actual render ${s.id}`);const expected=trafficAt(t);check(Math.abs(state.traffic.average-expected.average)<.001,`Rendered model matches ${s.id}`);hashes.push(sha(Buffer.from(png.split(',')[1],'base64')));await shot(`${String(i).padStart(2,'0')}-${s.id}`,t);}
  check(new Set(hashes).size===SHOTS.length,'Sixteen distinct story compositions');
  for(const s of SHOTS.slice(1)){await page.evaluate(t=>window.__SHORTCUT__.seek(t),s.start);check(await page.evaluate(()=>window.__SHORTCUT__.state.shot)===s.id,`Exact cut ${s.start}`);}
  for(const cue of CAPTIONS){await page.evaluate(t=>window.__SHORTCUT__.render(t),cue.start+.125);check(await page.locator('#caption').textContent()===cue.text,`Complete caption ${cue.start}`);check(await page.locator('#speaker').textContent()===cue.speaker,`Correct speaker ${cue.start}`);check(await page.locator('#caption').evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1),'No subtitle clipping');}
  const first=await page.evaluate(()=>window.__SHORTCUT__.render(25.125));await page.evaluate(()=>window.__SHORTCUT__.render(42));const second=await page.evaluate(()=>window.__SHORTCUT__.render(25.125));check(first===second,'Seeking restores identical pixels');
  await page.evaluate(()=>{window.__SHORTCUT__.seek(60);window.__SHORTCUT__.seek(0);});await page.waitForFunction(()=>!document.querySelector('audio').seeking);check(!(await page.evaluate(()=>window.__SHORTCUT__.state.ended)),'Stale end event cannot override a return to start');
  const actor=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=300;canvas.height=220;const ctx=canvas.getContext('2d'),art=createShortcutActors(),poses=[],faces=[],cycles=[];
    for(const action of ['idle','walk','run','point','unfold','think','signal','study','ride']){ctx.clearRect(0,0,300,220);art.person(ctx,125,195,.21,{scale:3,action});poses.push(canvas.toDataURL());}
    for(const expression of ['hope','worry','thought','resolve']){ctx.clearRect(0,0,300,220);art.person(ctx,125,195,0,{scale:4,expression});faces.push(canvas.toDataURL());}
    for(const time of [0,.17,.39]){ctx.clearRect(0,0,300,220);art.bicycle(ctx,150,195,time,{scale:3,moving:true});cycles.push(canvas.toDataURL());}
    ctx.clearRect(0,0,300,220);art.person(ctx,125,195,1,{scale:3,action:'unfold',phase:1});const held=canvas.toDataURL();ctx.clearRect(0,0,300,220);art.person(ctx,125,195,17,{scale:3,action:'unfold',phase:1});const stable=held===canvas.toDataURL();
    const m=ctx.getTransform();return {poses:new Set(poses).size,faces:new Set(faces).size,bicycleFrames:new Set(cycles).size,heldActionStable:stable,contextRestored:m.a===1&&m.d===1&&m.e===0&&m.f===0};});
  check(actor.poses===9,'Nine concrete person poses');check(actor.faces===4,'Four visible expressions');check(actor.bicycleFrames===3,'Bicycle pedals and wheel phases animate');check(actor.heldActionStable,'Opened map stays open instead of looping');check(actor.contextRestored,'Actors preserve parent canvas transform');
  await page.reload({waitUntil:'load'});await ready();await page.locator('#start').click();await page.waitForFunction(()=>window.__SHORTCUT__.state.time>.8);await page.keyboard.press('Space');const paused=await page.evaluate(()=>window.__SHORTCUT__.state.time);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));check(await page.evaluate(()=>window.__SHORTCUT__.state.time)===paused,'Pause freezes the soundtrack');await page.keyboard.press('ArrowRight');check(Math.abs((await page.evaluate(()=>window.__SHORTCUT__.state.time))-paused-BAR)<.001,'Arrow key seeks one musical bar');
  await page.locator('#mute').click();check(await page.locator('#mute').getAttribute('aria-pressed')==='true','Mute works');await page.locator('#mute').click();await page.locator('#about').click();check(await page.locator('#about-dialog').isVisible(),'Scientific model and life-analogy boundaries accessible');await page.locator('#gentle').check();check(await page.evaluate(()=>window.__SHORTCUT__.state.reduced),'Gentle transitions available');await page.locator('#gentle').uncheck();await page.locator('#close-about').click();
  let playback=null;
  if(full){await page.reload({waitUntil:'load'});await ready();await page.locator('#start-fullscreen').click();await page.waitForFunction(()=>document.fullscreenElement?.id==='cinema'&&window.__SHORTCUT__.state.time>2);check(true,'User fullscreen-start button activates both picture and music');await page.waitForFunction(()=>document.querySelector('#cinema').classList.contains('controls-hidden'));check(await page.locator('#controls').evaluate(e=>getComputedStyle(e).visibility)==='hidden','Controls hide during playback');
    const bounds=await page.locator('#stage').boundingBox();check(Math.abs(bounds.width/bounds.height-16/9)<.001,'Fullscreen preserves 16:9 framing');
    for(const act of CHAPTERS.slice(1)){await page.waitForFunction(t=>window.__SHORTCUT__.state.time>=t,act.start+.5,{timeout:15000});const state=await page.evaluate(()=>window.__SHORTCUT__.state);check(state.chapter===act.id,`Real-time chapter ${act.id}`);console.log('PLAYBACK',state.time.toFixed(2),state.chapter);}
    await page.waitForFunction(()=>window.__SHORTCUT__.state.ended,null,{timeout:10000});playback=await page.evaluate(()=>window.__SHORTCUT__.state);check(playback.time===60,'Ends at 60 seconds');check(Math.abs(playback.elapsedMs-60000)<1500,'Actual one-minute playback, no fast-forward');await page.locator('#end-replay').click();await page.waitForFunction(()=>window.__SHORTCUT__.state.playing&&window.__SHORTCUT__.state.time>.2&&window.__SHORTCUT__.state.time<3);check(true,'Replay after true ending');await page.keyboard.press('Space');await page.evaluate(()=>document.exitFullscreen());
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__SHORTCUT__.render(31.5));check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Portrait viewport does not overflow');await page.screenshot({path:resolve(qa,`${channel}-mobile.png`)});
  temp=await mkdtemp(resolve(tmpdir(),'shortcut-offline-'));await mkdir(resolve(temp,'audio'));await copyFile(entry,resolve(temp,'index.html'));await copyFile(resolve(root,'export/赶路的人/audio/master.mp3'),resolve(temp,'audio/master.mp3'));await page.goto(pathToFileURL(resolve(temp,'index.html')).href,{waitUntil:'load'});await ready();await page.locator('#start').click();await page.waitForFunction(()=>window.__SHORTCUT__.state.time>.3);await page.keyboard.press('Space');check((await page.evaluate(()=>window.__SHORTCUT__.state.source)).endsWith('/audio/master.mp3'),'Copied directory plays outside the repository');
  check(network.length===0,'No network requests');check(errors.length===0,'No browser or console errors');check(verifyPrevious()===before,'All captured old-film files preserved');
  const report={result:'PASS',channel,browser:await browser.version(),full,headless:true,checks,captures,actor,playback,network,errors,protectedFiles:before,hardwarePerformance:'SKIPPED_BY_USER: function and timing only; no target-machine FPS claim',entrySHA256:sha(Buffer.from(html))};await writeFile(resolve(qa,`${channel}-${full?'full-':''}report.json`),JSON.stringify(report,null,2));console.log(JSON.stringify({result:'PASS',checks:checks.length,channel,full,actor,playback,protectedFiles:before},null,2));
}catch(error){await writeFile(resolve(qa,`${channel}-failure.json`),JSON.stringify({error:error.message,checks,errors,network},null,2));throw error;}
finally{await browser.close();if(temp)await rm(temp,{recursive:true,force:true});}