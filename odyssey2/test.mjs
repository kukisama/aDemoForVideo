/** Actual exported, network-offline HD2D acceptance. No renderer replacement.
 * --capture: representative cinematic frames only. --full: visible real 30s playback.
 * --edge: installed Edge. Default includes input/portable/local-audio checks.
 * User 2026-10-06: assume target hardware is adequate. Local FPS/wall time are
 * diagnostic observations only, not pass/fail gates. Rendering is not downgraded.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,mkdtemp,copyFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {DURATION,STAGES,EVENTS} from './timeline.mjs';
import './verify-old.mjs';
const require=createRequire(new URL('../web/package.json',import.meta.url));
const {chromium}=require('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const qa=resolve(root,'odyssey2/output/qa'),entry=resolve(root,'export/奥德赛2/开始观看.html');
await mkdir(qa,{recursive:true});
const full=process.argv.includes('--full'),capture=process.argv.includes('--capture'),channel=process.argv.includes('--edge')?'msedge':'chrome';
const browser=await chromium.launch({channel,headless:!full});
const context=await browser.newContext({offline:true,viewport:{width:1280,height:720},deviceScaleFactor:1,reducedMotion:'no-preference'});
const page=await context.newPage(),checks=[],errors=[],network=[],frames=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const state=()=>page.evaluate(()=>window.__ODYSSEY2__.state);
const clean={animations:'disabled',style:'#controls,#status,#end-replay{visibility:hidden!important}'};
const hardwarePerformance={status:'SKIPPED_BY_USER',reason:'Target playback hardware is assumed adequate per user; local FPS, wall time and frame gaps are not acceptance gates.'};
let portable=null,playback=null;
try{
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__ODYSSEY2__?.ready||document.querySelector('#status')?.classList.contains('error'),null,{timeout:180000});
  check((await state()).ready,`Scene initialized: ${await page.locator('#status').textContent()}`);
  const initial=await page.evaluate(()=>window.__ODYSSEY2__.inspect());
  console.log('READY',JSON.stringify({renderer:initial.render.renderer,render:initial.render,objects:initial.objectCounts}));
  check(initial.render.webgl&&initial.render.version===2,'Actual WebGL2, not 2D substitution');
  check(initial.architecture.columns===14&&initial.architecture.real3D,'Fourteen columns and real three-dimensional depth');
  check(initial.camera.focus.totalTextureFetches===12&&initial.camera.focus.depthSource.includes('DepthTexture'),'Depth-based focus pipeline present');
  check(initial.render.width===1280&&initial.render.height===720&&initial.render.quality==='cinematic','No automatic quality downgrade');
  check(initial.integrationWarnings.length===0,'No unresolved renderer/sprite contract warnings');
  check((await state()).mode==='demo'&&(await state()).themeAdaptation===false,'Original demonstration sound is not falsely called movie theme');
  check(!(await state()).playing&&(await state()).time===0,'Click required before audio, cover paused');
  await page.screenshot({path:resolve(qa,`${channel}-poster.png`)});
  const moments=capture?
    [[0,'bow-macro'],[5.66,'first-parry'],[8.94,'counter'],[12.70,'low-evade'],[16.95,'air-cross'],[20.20,'spin'],[25.40,'release'],[28.4,'hall-wide']]:
    STAGES.map(stage=>[(stage.start+stage.end)/2,stage.id]);
  for(const [t,name]of moments){
    const info=await page.evaluate(t=>window.__ODYSSEY2__.render(t),t);
    check(info.render.shaderErrors.length===0,`No shader error ${name}`);check(info.effects.screenFlashAlpha<=.09,`Bounded non-strobing flash ${name}`);
    check(info.integrationWarnings.length===0,`Held and dropped weapon consistent ${name}`);
    const file=resolve(qa,`${channel}-${name}.png`),png=await page.locator('#stage').screenshot({...clean,path:file});
    frames.push({time:t,name,file,sha256:sha(png),camera:info.camera,hero:info.hero,rival:info.rival,effects:info.effects,drawCalls:info.render.drawCalls});
    console.log('FRAME',t,name,info.hero.displayedPose,info.rival.displayedPose,info.effects.particleCount);
  }
  check(new Set(frames.map(f=>f.sha256)).size===moments.length,'Distinct photographed compositions');
  if(!capture){
    await page.evaluate(()=>window.__ODYSSEY2__.render(8.94));
    const first=await page.evaluate(()=>window.__ODYSSEY2__.snapshot());
    await page.evaluate(()=>window.__ODYSSEY2__.render(21.9));
    check((await page.evaluate(()=>window.__ODYSSEY2__.inspect())).effects.disarm.heldWeaponHidden,'Disarmed sentinel no longer retains the spear');
    await page.evaluate(()=>window.__ODYSSEY2__.render(8.94));
    check(first===await page.evaluate(()=>window.__ODYSSEY2__.snapshot()),'Framebuffer identical after arbitrary reverse seek');
    await page.evaluate(()=>window.__ODYSSEY2__.render(30));check((await state()).ended&&(await state()).displayedTime===30,'End frame held at exactly 30 seconds');
    await page.evaluate(()=>window.__ODYSSEY2__.seek(0));
    await page.locator('#toggle').click();await page.waitForFunction(()=>window.__ODYSSEY2__.state.time>.55,null,{timeout:30000});
    await page.keyboard.press('Space');const stopped=(await state()).time;
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    check((await state()).time===stopped&&!(await state()).playing,'Pause holds native audio time');
    await page.keyboard.press('ArrowRight');check(Math.abs((await state()).time-stopped-1)<.003,'Arrow key seeks one second');
    await page.locator('#mute').click();check((await state()).muted,'Mute applies to all sound paths');await page.locator('#mute').click();
    await page.locator('#settings').click();check(await page.locator('#settings-dialog').isVisible(),'Settings visible and playback paused');
    await page.locator('#gentle').check();check((await state()).reduced,'Gentle mode enabled');
    const gentle=await page.evaluate(()=>window.__ODYSSEY2__.inspect());check(gentle.effects.screenFlashAlpha===0&&gentle.effects.afterimages===0,'Gentle mode removes flash and afterimages');
    await page.locator('#gentle').uncheck();
    await page.locator('#quality').selectOption('balanced');await page.waitForFunction(()=>window.__ODYSSEY2__.ready&&window.__ODYSSEY2__.inspect().render.width===960);
    check((await state()).quality==='balanced','Explicit user quality selection works');
    await page.locator('#quality').selectOption('cinematic');await page.waitForFunction(()=>window.__ODYSSEY2__.ready&&window.__ODYSSEY2__.inspect().render.width===1280);
    await page.locator('#music-file').setInputFiles(resolve(root,'odyssey2/audio/demo.mp3'));
    await page.waitForFunction(()=>window.__ODYSSEY2__.state.localLoaded&&window.__ODYSSEY2__.state.mode==='local');
    check((await state()).localDuration>=30,'User-owned local audio accepted without upload');
    await page.locator('#music-treatment').selectOption('space');await page.locator('#close-settings').click();
    await page.locator('#toggle').click();await page.waitForFunction(()=>window.__ODYSSEY2__.state.time>.8);
    let s=await state();check(s.audioGraph&&s.mode==='local','Local audio spatial mixing graph active');
    check(s.clockType==='AudioContext shared sample clock'&&s.audioContextState==='running','Local music and SFX use one running sample clock');
    check(s.scheduledMusic.at===s.scheduledEffects.at&&s.scheduledMusic.duration===s.scheduledEffects.duration,'Both actual AudioBufferSources scheduled at identical context time and duration');
    check(Math.abs(s.localTime-s.offset-s.time)<.10,`Local music and effects synchronized: ${s.localTime-s.offset-s.time}`);
    await page.keyboard.press('Space');await page.locator('#settings').click();await page.locator('#sound-mode').selectOption('sfx');
    check((await state()).mode==='sfx','Effects-only audition supported');await page.locator('#sound-mode').selectOption('demo');await page.locator('#close-settings').click();
  }
  if(full){
    await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.__ODYSSEY2__?.ready,null,{timeout:180000});
    await page.locator('#start-full').click();await page.waitForFunction(()=>document.fullscreenElement?.id==='cinema');
    await page.waitForFunction(()=>window.__ODYSSEY2__.state.time>2&&document.querySelector('#cinema').classList.contains('controls-hidden'));
    check(await page.locator('#controls').evaluate(e=>getComputedStyle(e).visibility==='hidden'),'Recording controls actually hide');
    for(const stage of STAGES.slice(1)){
      await page.waitForFunction(t=>window.__ODYSSEY2__.state.time>=t,stage.start+.35,{timeout:30000});
      const s=await state();check(s.playing||s.ended,`Uninterrupted playback ${stage.id}`);
      console.log('PLAYBACK',s.time.toFixed(2),s.stage,s.frames);
    }
    await page.waitForFunction(()=>window.__ODYSSEY2__.state.ended,null,{timeout:30000});playback=await state();
    check(playback.time===DURATION&&playback.displayedTime===DURATION,'Uninterrupted 30s reaches final frame');
    // Deliberately excluded by the user's hardware-scope instruction, not a
    // relaxed threshold: keep the original observations without a speed verdict.
    console.log('HARDWARE SKIPPED',JSON.stringify({frames:playback.frames,elapsedMs:playback.elapsedMs,maxFrameGap:playback.maxFrameGap}));
    await page.locator('#end-replay').click();await page.waitForFunction(()=>window.__ODYSSEY2__.state.playing&&window.__ODYSSEY2__.state.time>.3&&window.__ODYSSEY2__.state.time<4);
    check(true,'Replay works after full end');await page.keyboard.press('Space');await page.evaluate(()=>document.exitFullscreen());
  }
  if(!capture){
    portable=await mkdtemp(resolve(tmpdir(),'odyssey2-standalone-'));await copyFile(entry,resolve(portable,'watch.html'));
    await page.goto(pathToFileURL(resolve(portable,'watch.html')).href,{waitUntil:'load'});await page.waitForFunction(()=>window.__ODYSSEY2__?.ready,null,{timeout:180000});
    check((await state()).audioDuration===DURATION,'Single generated HTML works outside repository with embedded default audio');
    await page.locator('#start').click();await page.waitForFunction(()=>window.__ODYSSEY2__.state.time>.3);await page.keyboard.press('Space');
    check((await state()).time>.3,'Portable standalone actually starts');
  }
  check(errors.length===0,`No browser errors: ${errors.join('; ')}`);check(network.length===0,'Zero network resource dependencies');
  const report={result:'PASS',full,capture,channel,browser:await browser.version(),htmlsha256:sha(await readFile(entry)),checks,frames,playback,
    initialGPU:initial.render,errors,network,themeAdaptation:false,hardwarePerformance,scope:'Actual WebGL2, framebuffer and functional checks. Hardware performance skipped per user; local timing is not a claim about the target machine.'};
  await writeFile(resolve(qa,`${channel}-${capture?'capture-':full?'full-':''}report.json`),JSON.stringify(report,null,2));
  console.log(JSON.stringify({result:'PASS',channel,full,capture,checks:checks.length,playback,hardwarePerformance,renderer:initial.render.renderer,errors,network},null,2));
}catch(error){await page.screenshot({path:resolve(qa,`${channel}-failure.png`)}).catch(()=>{});throw error;}
finally{await browser.close();if(portable)await rm(portable,{recursive:true,force:true});}