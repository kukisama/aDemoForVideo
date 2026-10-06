import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { DURATION,BPM,BEAT,TOTAL_BEATS,CHAPTERS,CAPTIONS,CUTS } from './story.mjs';
const require=createRequire(new URL('../web/package.json',import.meta.url));
const {chromium}=require('playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),qa=resolve(root,'feynman/output/feynman-qa');
const entry=resolve(root,'export/知识之塔/开始观看.html');
await mkdir(qa,{recursive:true});
const channel=process.argv.includes('--edge')?'msedge':'chrome',full=process.argv.includes('--full');
const browser=await chromium.launch({channel,headless:!full});
const context=await browser.newContext({viewport:{width:1440,height:900},offline:true,reducedMotion:'no-preference'});
const page=await context.newPage(),errors=[],requests=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
const check=(condition,label)=>{assert.ok(condition,label);checks.push(label);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
  const html=await readFile(entry,'utf8');
  check(DURATION<60&&Math.round(DURATION/BEAT)===TOTAL_BEATS,'Under one minute and exactly 144 beats');
  check(BPM===150&&CUTS.length===36,'150 BPM, 36 bar cuts');
  check(!/speechSynthesis|SpeechSynthesisUtterance|rotate[XY]\(|perspective\(/.test(html),'No voice synthesizer or 3D transformations');
  for(const cut of CUTS)check(Math.abs(cut/BEAT-Math.round(cut/BEAT))<1e-7,`Cut ${cut.toFixed(1)} falls on a beat`);
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__FEYNMAN__?.ready,null,{timeout:30000});
  const initial=await page.evaluate(()=>window.__FEYNMAN__.state);console.log('READY',JSON.stringify(initial));
  check(Math.abs(initial.audioDuration-DURATION)<.065,'Local soundtrack duration matches story');
  check(await page.locator('audio').count()===1&&await page.locator('video,img').count()===0,'Only one music track, no videos or image assets');
  await page.screenshot({path:resolve(qa,`${channel}-poster.png`)});
  const frames=[];
  for(const chapter of CHAPTERS){
    const time=chapter.start+4.1;
    const png=await page.evaluate(t=>window.__FEYNMAN__.render(t),time);
    const state=await page.evaluate(()=>window.__FEYNMAN__.state);
    const expected=CAPTIONS.find(cue=>time>=cue.start&&time<cue.end)?.text||'';
    check(state.chapter===chapter.id,`${chapter.id}: correct chapter`);
    check(state.caption===expected,`${chapter.id}: matching story subtitle`);
    const textFits=await page.locator('#caption').evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.getBoundingClientRect().height<=document.querySelector('#caption-area').getBoundingClientRect().height+1);
    check(textFits,`${chapter.id}: subtitle fits safely`);
    await page.screenshot({path:resolve(qa,`${channel}-${chapter.id}.png`)});
    frames.push({time,chapter:chapter.id,caption:expected,pngSha256:sha(Buffer.from(png.split(',')[1],'base64'))});
  }
  check(new Set(frames.map(f=>f.pngSha256)).size===9,'Nine visually distinct story acts');
  for(const cue of CAPTIONS){
    await page.evaluate(t=>window.__FEYNMAN__.render(t),cue.start+.15);
    check(await page.locator('#caption').textContent()===cue.text,`Caption at ${cue.start}s appears intact`);
  }
  const first=await page.evaluate(()=>window.__FEYNMAN__.render(41.8));
  await page.evaluate(()=>window.__FEYNMAN__.render(14.2));
  const second=await page.evaluate(()=>window.__FEYNMAN__.render(41.8));
  check(first===second,'Same time renders identical pixels after arbitrary seeking');
  await page.evaluate(()=>window.__FEYNMAN__.seek(0));await page.locator('#toggle').click();
  await page.waitForFunction(()=>window.__FEYNMAN__.state.time>.7);await page.keyboard.press('Space');
  const paused=await page.evaluate(()=>window.__FEYNMAN__.state.time);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  check(await page.evaluate(()=>window.__FEYNMAN__.state.time)===paused,'Pausing freezes the music clock');
  await page.keyboard.press('ArrowRight');check(Math.abs(await page.evaluate(()=>window.__FEYNMAN__.state.time)-paused-1.6)<.03,'Keyboard jumps exactly one bar');
  await page.locator('#mute').click();check(await page.locator('#mute').getAttribute('aria-pressed')==='true','Music mute control');await page.locator('#mute').click();
  await page.locator('#about').click();check(await page.locator('#about-dialog').isVisible(),'Learning-method source and fiction distinction accessible');
  await page.locator('#gentle').check();check(await page.evaluate(()=>window.__FEYNMAN__.state.reduced),'Reduced-motion mode enables');await page.locator('#gentle').uncheck();await page.locator('#close-about').click();
  let fullPlayback=null;
  if(full){
    await page.evaluate(()=>window.__FEYNMAN__.seek(0));await page.locator('#fullscreen').click();
    await page.waitForFunction(()=>document.fullscreenElement?.id==='cinema');await page.locator('#toggle').click();
    await page.waitForFunction(()=>window.__FEYNMAN__.state.time>=2&&document.querySelector('#cinema').classList.contains('controls-hidden'));
    check(await page.locator('#controls').evaluate(el=>getComputedStyle(el).visibility)==='hidden','Native fullscreen hides recording controls');
    const bounds=await page.locator('#stage').boundingBox();check(Math.abs(bounds.width/bounds.height-16/9)<.002,'Fullscreen retains 16:9 pixel composition');
    for(const chapter of CHAPTERS.slice(1)){await page.waitForFunction(t=>window.__FEYNMAN__.state.time>=t,chapter.start+.7,{timeout:15000});check((await page.evaluate(()=>window.__FEYNMAN__.state)).chapter===chapter.id,`Real music playback reaches ${chapter.id}`);}
    await page.waitForFunction(()=>window.__FEYNMAN__.state.ended,null,{timeout:12000});fullPlayback=await page.evaluate(()=>window.__FEYNMAN__.state);
    check(fullPlayback.time===DURATION,'Entire film stops at 57.6 seconds');check(Math.abs(fullPlayback.elapsedMs-DURATION*1000)<1800,'Story does not drift from the musical clock');
    await page.locator('#end-replay').click();await page.waitForFunction(()=>window.__FEYNMAN__.state.playing&&window.__FEYNMAN__.state.time>.3&&window.__FEYNMAN__.state.time<4);check(true,'Full-film replay works');await page.keyboard.press('Space');await page.evaluate(()=>document.exitFullscreen());
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__FEYNMAN__.render(41.8));
  await page.screenshot({path:resolve(qa,`${channel}-mobile.png`)});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No mobile horizontal overflow');
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});await page.waitForFunction(()=>window.__FEYNMAN__?.ready,null,{timeout:30000});
  check((await page.evaluate(()=>window.__FEYNMAN__.state.source)).endsWith('/audio/master.mp3'),'Portable folder finds relative audio');
  check(requests.length===0,'No network access required');check(errors.length===0,'No browser or resource errors');
  const result={result:'PASS',entry,browser:await browser.version(),channel,full,checks,frames,fullPlayback,errors,requests};
  await writeFile(resolve(qa,`${channel}-${full?'full-':''}report.json`),JSON.stringify(result,null,2));
  console.log('PASS',JSON.stringify({checks:checks.length,channel,full,fullPlayback}));
}finally{await browser.close();}