import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,copyFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {CHAPTERS,SHOTS,VOICE_CUES,DURATION,validateStory} from './story.mjs';
import {verifyPrevious} from './protect.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../web/package.json',import.meta.url)),{chromium}=require('playwright');
const qa=resolve(root,'qin/output/qa'),entry=resolve(root,'export/秦始皇/开始观看.html');
const full=process.argv.includes('--full'),captureOnly=process.argv.includes('--shots'),headed=process.argv.includes('--headed');
const channel=process.argv.includes('--edge')?'msedge':'chrome',hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(qa,{recursive:true});const protectedFiles=verifyPrevious();validateStory();
const browser=await chromium.launch({channel,headless:!headed});
const context=await browser.newContext({viewport:{width:1536,height:960},offline:true,reducedMotion:'no-preference'});
const page=await context.newPage(),errors=[],network=[],checks=[],captures=[];
let copied,playback=null,nativeVisibility=null;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{if(/^https?:/i.test(r.url()))network.push(r.url());});
const check=(v,label)=>{assert.ok(v,label);checks.push(label);};
const ready=()=>page.waitForFunction(()=>window.__QIN__?.ready,null,{timeout:45000});
const state=()=>page.evaluate(()=>window.__QIN__.state);
async function render(t){await page.evaluate(t=>window.__QIN__.render(t),t);await page.waitForFunction(()=>[...document.querySelectorAll('audio')].every(a=>!a.seeking));}
async function capture(name,t=null){if(t!==null)await render(t);const file=resolve(qa,`${channel}-${name}.png`);await page.locator('#stage').screenshot({path:file});captures.push({name,time:t,file});}
try{
  const html=await readFile(entry,'utf8'),data=JSON.parse(html.match(/<script id="film-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  check(!/<(?:video|img|iframe)\b/i.test(html),'Original canvas animation; no video or photo slideshow');
  check((html.match(/data:audio\/mpeg;base64,/g)||[]).length===3,'Two embedded tracks plus player source check');
  check(data.duration===180&&SHOTS.length===30,'Three-minute / thirty-shot contract');
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});await ready();
  check(await page.locator('#poster').isVisible(),'Cover starts without autoplay');check(!(await state()).playing,'No audio before user gesture');
  check((await state()).embedded,'Both audio sources are embedded');
  check(await page.evaluate(()=>[...document.querySelectorAll('audio')].every(a=>Math.abs(a.duration-180)<.065)),'Both native audio elements decode to 180 seconds');
  check(await page.evaluate(()=>document.fonts.check('700 155px "Qin Serif"','门外秦始皇')),'Embedded Chinese font available');
  check(await page.evaluate(()=>document.fonts.size===3&&[...document.fonts].every(f=>f.status==='loaded')),'All three font weights loaded offline');
  await capture('poster');
  const coverText=await page.locator('#poster').textContent();
  check(!coverText.includes('时间')&&!coverText.includes('不朽'),'Cover does not disclose the final answer');

  const hashes=[];
  for(const [i,shot] of SHOTS.entries()){
    const t=shot.start+(shot.end-shot.start)*.56;await render(t);
    const s=await state();check(s.shot===shot.id&&s.chapter===shot.chapter,`Rendered correct composition: ${shot.id}`);
    check(s.world.width===768&&s.world.height===432&&s.world.pov,'768x432 first-person visual contract');
    hashes.push(hash(await page.locator('#world').screenshot()));
    await capture(`${String(i+1).padStart(2,'0')}-${shot.id}`);
  }
  check(new Set(hashes).size===30,'Thirty distinct actual rendered frames');

  // The art contact sheet contains full canvas frames and timestamp labels.
  // Separate stage screenshots include the actual DOM captions and framing.
  // It is made from rendered canvas pixels, never from scene metadata alone.
  const contact=await page.evaluate(async shots=>{
    const sheet=document.createElement('canvas');sheet.width=1920;sheet.height=1452;
    const ctx=sheet.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#080d14';ctx.fillRect(0,0,sheet.width,sheet.height);
    for(let i=0;i<shots.length;i++){
      const s=shots[i],t=s.start+(s.end-s.start)*.56,uri=window.__QIN__.render(t),img=new Image();img.src=uri;await img.decode();
      const x=(i%5)*384,y=Math.floor(i/5)*242;ctx.drawImage(img,x,y,384,216);
      ctx.font='12px sans-serif';ctx.fillStyle='#d5bc88';ctx.fillText(`${String(i+1).padStart(2,'0')}  ${t.toFixed(1)}s  ${s.id}`,x+8,y+233);
    }
    return sheet.toDataURL('image/png');
  },SHOTS);
  await writeFile(resolve(qa,`${channel}-contact-sheet.png`),Buffer.from(contact.split(',')[1],'base64'));
  if(!captureOnly){
    for(const shot of SHOTS.slice(1)){
      await render(shot.start);check((await state()).shot===shot.id,`Exact boundary ${shot.start}s`);
      await render(shot.start-.01);check((await state()).shot===SHOTS[SHOTS.indexOf(shot)-1].id,`Before boundary ${shot.start}s`);
    }
    for(const [i,c] of data.captions.entries()){
      await render(c.start+.1);check(await page.locator('#caption').textContent()===VOICE_CUES[i].text,`Complete synchronized caption ${i+1}`);
      const layout=await page.locator('#caption').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight,opacity:getComputedStyle(e.parentElement).opacity}));
      check(layout.width>=layout.scroll&&layout.height>=layout.scrollHeight&&layout.opacity==='1',`Readable caption ${i+1}`);
      check(c.end-c.start>=3.19||i===21,'Caption has readable duration');
      await render(c.end);check((await state()).caption==='',`Caption clears at end ${i+1}`);
    }
    check(data.captions.reduce((n,c)=>n+c.end-c.start,0)<110,'Instrumental breathing room, no subtitle wall');
    await render(149.25);check((await state()).caption==='是时间。','Suspense answer appears at authored reveal');
    check(!(await page.locator('#fiction-note').isVisible()),'Historical-time viewpoint before 150s');
    await render(150.5);check(await page.locator('#fiction-note').isVisible(),'Imagined-afterward marked explicitly');
    const one=await page.evaluate(()=>window.__QIN__.render(133.75));await render(45.2);
    const two=await page.evaluate(()=>window.__QIN__.render(133.75));check(one===two,'Reverse seeking exactly reproduces pixels');
    const actions=await page.evaluate(()=>{
      const pairs=[[.4,2.95],[12.1,14.1],[25,27.3],[28.3,29.6],[34.1,40.8],[47,48.3],[54.3,58.4],[59.1,64.8],[66.2,70.8],[71.1,74.2],[78.3,80.6],[83.2,86.3],[97.1,98.1],[102.4,106.3],[114.2,117.4],[119.6,124.7],[126.2,130.6],[132.4,137.4],[144.3,148.8],[153.3,160.5],[167.2,173.2],[174.2,179.4]];
      return pairs.map(([a,b])=>({a,b,changes:window.__QIN__.render(a)!==window.__QIN__.render(b)}));
    });
    for(const p of actions)check(p.changes,`Concrete action changes pixels ${p.a}–${p.b}`);
    await page.evaluate(()=>{window.__QIN__.seek(180);window.__QIN__.seek(0);});
    await page.waitForFunction(()=>!document.querySelector('#music').seeking);
    check(!(await state()).ended&&(await state()).time===0,'Stale ended event cannot overwrite seek-to-start');

    await page.reload({waitUntil:'load'});await ready();await page.locator('#start-fullscreen').click();
    await page.waitForFunction(()=>document.fullscreenElement?.id==='cinema'&&window.__QIN__.state.time>.7);
    check((await state()).playing,'Real full-screen-start gesture starts picture and audio');
    await page.waitForFunction(()=>document.querySelector('#cinema').classList.contains('controls-hidden'));
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#controls')).visibility==='hidden');
    check(await page.locator('#controls').evaluate(e=>getComputedStyle(e).visibility==='hidden'),'Controls hide during playback');
    await page.keyboard.press('Space');const paused=(await state()).time;
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    check((await state()).time===paused&&!(await state()).playing,'Pause freezes the audio clock');
    await page.keyboard.press('ArrowRight');check(Math.abs((await state()).time-paused-5)<.00001,'Right arrow seeks five seconds');
    await page.keyboard.press('ArrowLeft');check(Math.abs((await state()).time-paused)<.00001,'Left arrow seeks five seconds');
    const beforeSwitch=(await state()).time;await page.keyboard.press('KeyV');
    check((await state()).track==='music'&&Math.abs((await state()).time-beforeSwitch)<.00001,'Paused narration-to-music switch preserves position');
    await page.keyboard.press('Space');await page.waitForFunction(()=>window.__QIN__.state.time>2);
    const playingSwitch=(await state()).time;await page.keyboard.press('KeyV');
    await page.waitForFunction(()=>window.__QIN__.state.playing&&window.__QIN__.state.track==='narration');
    check(Math.abs((await state()).time-playingSwitch)<.6&&(await state()).audibleTrackCount===1,'Playing switch resumes at same position with only one audible track');
    await page.keyboard.press('Space');await page.keyboard.press('KeyM');check((await state()).muted,'Mute shortcut');
    await page.keyboard.press('KeyV');check((await state()).muted,'Mute persists across tracks');
    await page.keyboard.press('KeyM');await page.keyboard.press('KeyV');
    await page.locator('#volume').focus();await page.locator('#volume').press('End');await page.locator('#volume').press('ArrowLeft');
    check(Math.abs((await state()).volume-.99)<.00001,'Keyboard-operated volume slider affects audio');
    await page.locator('#timeline').focus();await page.locator('#timeline').press('End');await page.locator('#timeline').press('ArrowLeft');
    check(Math.abs((await state()).time-179.99)<.00001,'Actual timeline range control seeks');
    await page.locator('#about').click();check(await page.locator('#about-dialog').isVisible()&&!(await state()).playing,'About pauses playback');
    await page.locator('#gentle').check();check((await state()).reduced,'Gentle action setting');
    await page.locator('#subtitles').uncheck();check(!(await page.locator('#captions').isVisible()),'Subtitles can be hidden');
    await page.locator('#subtitles').check();await page.locator('#gentle').uncheck();
    await page.locator('#close-about').click();check(!(await page.locator('#about-dialog').isVisible()),'About closes without jumping in time');
    await render(91.5);await page.locator('#cinema').focus();
    await page.keyboard.press('Space');await page.waitForFunction(()=>window.__QIN__.state.playing);
    const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();
    const nativeState=await page.evaluate(()=>({hidden:document.hidden,visibility:document.visibilityState,focus:document.hasFocus(),playing:window.__QIN__.state.playing}));
    nativeVisibility={status:nativeState.hidden?'OBSERVED':'NOT_OBSERVABLE_IN_TEST_BROWSER',nativeState,handlerTest:'pending',
      limitation:'This test browser can report two foreground pages as visible, including in headed mode. Native hiding is not claimed when hidden=false.'};
    if(nativeState.hidden){check(!nativeState.playing,'Observed native hidden page pauses');nativeVisibility.handlerTest='native PASS';}
    else {
      // Separate handler regression only; deliberately NOT labelled a real tab test.
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});try{document.dispatchEvent(new Event('visibilitychange'));}finally{delete document.hidden;}});
      check(!(await state()).playing,'Synthetic visibilitychange handler pauses; native event not observed');nativeVisibility.handlerTest='synthetic PASS';
    }
    await other.close();await page.bringToFront();
    if(await page.evaluate(()=>!!document.fullscreenElement))await page.evaluate(()=>document.exitFullscreen());

    // Exercise cancellation races with real native play promises, not mocks.
    await page.evaluate(()=>{window.__QIN__.seek(3);void window.__QIN__.play();window.__QIN__.pause();void window.__QIN__.play();});
    await page.waitForFunction(()=>window.__QIN__.state.playing&&window.__QIN__.state.time>3.2);
    check((await state()).audibleTrackCount===1,'Rapid play/pause/play ends in the latest requested state');await page.evaluate(()=>window.__QIN__.pause());
    if(full){
      await page.reload({waitUntil:'load'});await ready();await page.locator('#start-fullscreen').click();
      await page.waitForFunction(()=>window.__QIN__.state.playing&&document.fullscreenElement?.id==='cinema');
      const size=await page.locator('#stage').boundingBox();check(Math.abs(size.width/size.height-16/9)<.001,'Fullscreen preserves original framing');
      for(const ch of CHAPTERS.slice(1)){
        await page.waitForFunction(t=>window.__QIN__.state.time>=t,ch.start+.4,{timeout:25000});
        const s=await state();check(s.chapter===ch.id,`Normal-speed playback reaches ${ch.id}`);console.log('PLAYBACK',s.time.toFixed(2),ch.id);
      }
      await page.waitForFunction(()=>window.__QIN__.state.ended,null,{timeout:25000});playback=await state();
      check(playback.time===DURATION&&Math.abs(playback.elapsedMs-180000)<1500,'Normal-speed full playback completes at three minutes');
      await capture('ending');await page.locator('#end-replay').click();
      await page.waitForFunction(()=>window.__QIN__.state.playing&&window.__QIN__.state.time>.2&&window.__QIN__.state.time<3);
      check((await state()).audibleTrackCount===1,'Replay after actual ending');await page.keyboard.press('Space');
      await page.evaluate(()=>document.exitFullscreen());
    }
    for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1920,height:1080}]){
      await page.setViewportSize(viewport);await render(33.8);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow at '+viewport.width);
      const b=await page.locator('#stage').boundingBox();check(b.width<=viewport.width+1&&b.height<=viewport.height+1,'Stage fits '+viewport.width);
      await page.screenshot({path:resolve(qa,`${channel}-viewport-${viewport.width}.png`)});
    }
    // Only one file is copied: font/audio fetches are impossible in this offline context.
    copied=await mkdtemp(resolve(tmpdir(),'qin-single-html-'));await copyFile(entry,resolve(copied,'门外.html'));
    await page.goto(pathToFileURL(resolve(copied,'门外.html')).href,{waitUntil:'load'});await ready();
    await page.locator('#start').click();await page.waitForFunction(()=>window.__QIN__.state.time>.6);
    check((await state()).embedded&&(await state()).playing,'Single copied HTML plays outside repository while offline');
    await page.keyboard.press('KeyV');await page.waitForFunction(()=>window.__QIN__.state.playing&&window.__QIN__.state.track==='music');
    check((await state()).audibleTrackCount===1,'Copied HTML includes functional instrumental mode');await page.keyboard.press('Space');
  }
  check(network.length===0,'No runtime network requests');check(errors.length===0,`No browser errors: ${errors.join(' | ')}`);
  check(verifyPrevious()===protectedFiles,'243 prior-film files unchanged');
  const report={result:'PASS',channel,browser:await browser.version(),full,captureOnly,headed,checks,captures,playback,nativeVisibility,network,errors,protectedFiles,entry,entrySha256:hash(Buffer.from(html)),hardwarePerformance:'SKIPPED_BY_USER: no FPS threshold and no claim about target hardware',humanListeningPerformed:false};
  await writeFile(resolve(qa,`${channel}${full?'-full':''}${captureOnly?'-shots':''}${headed?'-headed':''}-report.json`),JSON.stringify(report,null,2));
  console.log(JSON.stringify({result:'PASS',checks:checks.length,channel,full,captureOnly,headed,playback,protectedFiles,contactSheet:resolve(qa,`${channel}-contact-sheet.png`)},null,2));
}catch(error){await writeFile(resolve(qa,`${channel}-failure.json`),JSON.stringify({error:error.message,stack:error.stack,checks,errors,network},null,2));throw error;}
finally{await browser.close();if(copied)await rm(copied,{recursive:true,force:true});}