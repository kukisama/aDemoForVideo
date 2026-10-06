/** Tests the actual exported file in installed Chrome/Edge, with networking disabled.
 * --full: visible native-fullscreen uninterrupted 180-second playback, plus regressions.
 * --edge: use Microsoft Edge. --full --edge is also supported. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,copyFile,rm,mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {DURATION,BPM,BEAT,BAR,TOTAL_BEATS,CHAPTERS,SHOTS,CAPTIONS,ACTION_CUES,SOURCES} from './story.mjs';

const require = createRequire(new URL('../web/package.json',import.meta.url));
const {chromium} = require('playwright');
const root = fileURLToPath(new URL('../',import.meta.url));
const qa = resolve(root,'odyssey/output/qa'), entry = resolve(root,'export/奥德赛/开始观看.html');
await mkdir(qa,{recursive:true});
const full = process.argv.includes('--full'), edge = process.argv.includes('--edge'), channel = edge ? 'msedge' : 'chrome';
const browser = await chromium.launch({channel,headless:!full});
const context = await browser.newContext({viewport:{width:1280,height:720},offline:true,reducedMotion:'no-preference'});
const page = await context.newPage(), errors = [], network = [], checks = [], frames = [];
const ownedTemps = [];
page.on('pageerror',e => errors.push(e.message));
page.on('console',m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request',r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
const check = (ok,label) => { assert.ok(ok,label); checks.push(label); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const render = t => page.evaluate(time => window.__ODYSSEY__.render(time),t);
const state = () => page.evaluate(() => window.__ODYSSEY__.state);
const cleanCapture = {animations:'disabled',style:'#controls,#status,#end-replay{visibility:hidden!important}'};
let playback = null;
try {
  const html = await readFile(entry,'utf8');
  check(DURATION === 180 && BPM === 144 && TOTAL_BEATS === 432,'180 seconds / 144 BPM / 432 beats');
  check(CHAPTERS.length === 15 && SHOTS.length === 54 && ACTION_CUES.length === 30,'15 acts / 54 separately authored shots / 30 action cues');
  check(!/speechSynthesis|SpeechSynthesisUtterance|rotate[XY]\(|perspective\(/.test(html),'No TTS or 3D transform dependency');
  check(Object.values(SOURCES).every(s => s.url.startsWith('https://')),'External factual citations present');
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});
  await page.waitForFunction(() => window.__ODYSSEY__?.ready,null,{timeout:35000});
  const initial = await state();
  check(initial.audioDuration === 180,'Native decoder recognizes exactly 180 seconds');
  check(!initial.playing && initial.time === 0,'No audio autoplay before user gesture');
  check(await page.locator('audio').count() === 1 && await page.locator('img,video').count() === 0,'One original audio track and programmatic canvas art');
  check(await page.locator('#poster').isVisible(),'Spoiler-safe poster visible');
  check(await page.title() === '奥德赛 · 无人之名','No ending disclosed in page title');
  await page.locator('#poster-about').click();
  check(await page.locator('#about-dialog').isVisible(),'Viewing settings available before starting the film');
  await page.locator('#gentle').check(); check((await state()).reduced,'Gentle mode selectable from poster');
  await page.locator('#gentle').uncheck(); await page.locator('#close-about').click();
  check((await state()).time === 0 && !initial.playing,'Preflight settings do not start the story');
  await page.screenshot({path:resolve(qa,`${channel}-poster.png`)});
  const stills = [];
  for (let i = 0; i < SHOTS.length; i++) {
    const shot = SHOTS[i], t = (shot.start + shot.end) / 2;
    const png = await render(t), info = await state();
    const expected = CAPTIONS.find(c => t >= c.start && t < c.end);
    check(info.shot === shot.id,`Actual player shot ${shot.id}`);
    check(info.caption === (expected?.text || ''),`Synchronized subtitle in ${shot.id}`);
    check(info.chapter === shot.chapter,`Chapter contract ${shot.id}`);
    const shotPath = resolve(qa,`${channel}-${String(i + 1).padStart(2,'0')}-${shot.id}.png`);
    const bytes = await page.locator('#stage').screenshot({...cleanCapture,path:shotPath});
    stills.push({shot:shot.id,time:t,png:bytes.toString('base64')});
    frames.push({shot:shot.id,time:t,canvasSha256:sha(Buffer.from(png.split(',')[1],'base64')),screenshot:shotPath});
  }
  check(new Set(frames.map(f => f.canvasSha256)).size === 54,'All 54 actual shot images differ');
  console.log('SHOTS',frames.length,'captured from exported HTML');
  for (const shot of SHOTS.slice(1)) {
    await render(shot.start - .001);
    check((await state()).shot !== shot.id,`Previous shot before ${shot.start}s`);
    await render(shot.start);
    check((await state()).shot === shot.id,`Exact shot cut ${shot.id}`);
  }
  for (const cue of CAPTIONS) {
    await render(cue.start + .1);
    check(await page.locator('#caption').textContent() === cue.text,`Full caption at ${cue.start}s`);
    check(await page.locator('#speaker').textContent() === cue.speaker,`Correct speaker at ${cue.start}s`);
    const fit = await page.locator('#caption-box').evaluate(box => {
      const caption = document.getElementById('caption'), s = document.getElementById('stage');
      const b = box.getBoundingClientRect(), r = caption.getBoundingClientRect(), stage = s.getBoundingClientRect();
      return caption.scrollWidth <= caption.clientWidth + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1
        && b.left >= stage.left && b.right <= stage.right && b.bottom < stage.bottom - 20;
    });
    check(fit,`Caption ${cue.start}s fully inside stable reading region`);
  }
  for (const cue of ACTION_CUES) {
    await render(cue.time);
    const inspect = await page.evaluate(t => window.__ODYSSEY__.inspect(t),cue.time);
    check(inspect.action === cue.id,`Visual contact obeys shared ${cue.id}`);
    check(Math.abs(inspect.actionTime - cue.time) < 1e-9,`Exact audio/visual cue ${cue.id}`);
  }
  const original = await render(99.0833333333); await render(27);
  check(original === await render(99.0833333333),'Identical pixels after arbitrary reverse seeking');
  await render(180);
  const final = await state();
  check(final.ended && final.shot === 'home-coast' && final.chapter === 'home','180-second endpoint remains final coast');
  check(final.caption === CAPTIONS.at(-1).text,'Final thought held on end frame');
  check(await page.locator('#end-title').isVisible(),'Final title only appears in coast epilogue');
  await page.screenshot({...cleanCapture,path:resolve(qa,`${channel}-ending.png`)});
  await render(165);
  check(!await page.locator('#end-title').isVisible(),'Final title not prematurely exposed');
  const endingPixels = await render(180), pastEnd = await render(999);
  check(endingPixels === pastEnd,'Out-of-range seek clamps without opening-scene wrap');
  await render(-10); check((await state()).time === 0,'Negative seek clamps to beginning');
  const beforeNaN = await state(); await page.evaluate(() => window.__ODYSSEY__.seek(NaN));
  check((await state()).time === beforeNaN.time,'Invalid seek is ignored');

  await page.locator('#toggle').click();
  await page.waitForFunction(() => window.__ODYSSEY__.state.time > .8);
  await page.keyboard.press('Space'); const paused = (await state()).time;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  check((await state()).time === paused && !(await state()).playing,'Space pauses the native audio clock');
  await page.keyboard.press('ArrowRight');
  check(Math.abs((await state()).time - paused - BAR) < .025,'Arrow key advances one 144 BPM bar');
  await page.keyboard.press('ArrowLeft');
  check(Math.abs((await state()).time - paused) < .025,'Arrow key reverses one bar');
  await page.locator('#timeline').focus();
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  check(Math.abs((await state()).time - .01) < .001,'Native range keyboard input seeks the soundtrack');
  await page.locator('#mute').click(); check((await state()).muted,'Mute button silences native audio');
  await page.locator('#mute').click(); check(!(await state()).muted,'Mute toggles back');
  await page.locator('#volume').focus(); await page.keyboard.press('Home');
  for (let step = 0; step < 8; step++) await page.keyboard.press('ArrowRight');
  check(Math.abs((await state()).volume - .4) < .001,'Volume slider changes actual output gain');
  for (let step = 0; step < 6; step++) await page.keyboard.press('ArrowRight');
  await page.locator('#about').click(); check(await page.locator('#about-dialog').isVisible(),'Sources and viewing controls accessible');
  check(!(await state()).playing,'Opening sources pauses playback');
  check(!await page.locator('#story-notes').evaluate(el => el.open),'Spoiler details closed by default');
  await page.locator('#gentle').check(); check((await state()).reduced,'Gentle motion switches renderer mode');
  await render(112); const gentle = await render(112); await render(40);
  check(gentle === await render(112),'Gentle mode remains pixel-deterministic');
  await page.locator('#gentle').uncheck(); await page.locator('#close-about').click();
  check(!await page.locator('#about-dialog').isVisible(),'Settings dialog closes');

  if (full) {
    await page.reload({waitUntil:'load'}); await page.waitForFunction(() => window.__ODYSSEY__?.ready);
    await page.locator('#start-fullscreen').click();
    await page.waitForFunction(() => document.fullscreenElement?.id === 'cinema');
    await page.waitForFunction(() => window.__ODYSSEY__.state.time > 2 && document.querySelector('#cinema').classList.contains('controls-hidden'));
    const bounds = await page.locator('#stage').boundingBox();
    check(Math.abs(bounds.width / bounds.height - 16/9) < .001,'Native fullscreen preserves 16:9 composition');
    check(await page.locator('#controls').evaluate(el => getComputedStyle(el).visibility === 'hidden'),'Controls actually disappear during uninterrupted viewing');
    console.log('FULL PLAYBACK START',channel);
    for (const chapter of CHAPTERS.slice(1)) {
      await page.waitForFunction(t => window.__ODYSSEY__.state.time >= t,chapter.start + .75,{timeout:30000});
      const current = await state();
      check(current.chapter === chapter.id,`Uninterrupted realtime ${chapter.id}`);
      check(Math.abs(current.displayedTime - current.time) < 1,`Frame follows soundtrack at ${chapter.id}`);
      console.log('PLAYBACK',current.time.toFixed(2),current.chapter,current.frames);
    }
    await page.waitForFunction(() => window.__ODYSSEY__.state.ended,null,{timeout:15000});
    playback = await state();
    check(playback.time === 180 && playback.displayedTime === 180,'Full film ends at exactly 180 seconds');
    check(Math.abs(playback.elapsedMs - 180000) < 2200,`Wall-clock drift <2.2s: actual ${playback.elapsedMs.toFixed(0)}ms`);
    check(playback.frames > 180,'Real frames rendered throughout playback, not static end-state test');
    await page.screenshot({path:resolve(qa,`${channel}-full-ended.png`)});
    await page.locator('#end-replay').click();
    await page.waitForFunction(() => window.__ODYSSEY__.state.playing && window.__ODYSSEY__.state.time > .3 && window.__ODYSSEY__.state.time < 4);
    check(true,'Replay works after the complete 180-second film');
    await page.keyboard.press('Space'); await page.evaluate(() => document.exitFullscreen());
  }
  await page.setViewportSize({width:390,height:844}); await render(97.4);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),'Mobile viewport has no horizontal overflow');
  await page.screenshot({path:resolve(qa,`${channel}-mobile.png`)});
  await page.setViewportSize({width:1920,height:1080}); await render(26);
  const big = await page.locator('#stage').boundingBox();
  check(big.width === 1920 && big.height === 1080,'1920x1080 fills a full HD viewport exactly');
  await page.screenshot({...cleanCapture,path:resolve(qa,`${channel}-fleet-fullhd.png`)});
  await page.setViewportSize({width:1280,height:720});

  const portable = await mkdtemp(resolve(tmpdir(),'odyssey-offline-')); ownedTemps.push(portable);
  await mkdir(resolve(portable,'audio'));
  await copyFile(entry,resolve(portable,'watch.html'));
  await copyFile(resolve(root,'export/奥德赛/audio/master.mp3'),resolve(portable,'audio/master.mp3'));
  await page.goto(pathToFileURL(resolve(portable,'watch.html')).href,{waitUntil:'load'});
  await page.waitForFunction(() => window.__ODYSSEY__?.ready,null,{timeout:35000});
  check((await state()).audioDuration === 180,'Copied folder works independently outside project');
  await page.locator('#start').click(); await page.waitForFunction(() => window.__ODYSSEY__.state.time > .4);
  check((await state()).playing,'Portable offline copy plays after real user click'); await page.keyboard.press('Space');
  check(sha(await readFile(resolve(portable,'audio/master.mp3'))) === sha(await readFile(resolve(root,'odyssey/audio/master.mp3'))),'Portable audio is verified master, not another version');
  check(network.length === 0,'Zero HTTP/HTTPS playback dependencies');
  check(errors.length === 0,`No resource or script errors: ${errors.join('; ')}`);

  const reducedPage = await context.newPage();
  await reducedPage.emulateMedia({reducedMotion:'reduce'});
  await reducedPage.goto(pathToFileURL(entry).href,{waitUntil:'load'});
  await reducedPage.waitForFunction(() => window.__ODYSSEY__?.ready);
  check(await reducedPage.evaluate(() => window.__ODYSSEY__.state.reduced),'System reduced-motion preference respected on first load');
  await reducedPage.close();
  const missing = await mkdtemp(resolve(tmpdir(),'odyssey-missing-')); ownedTemps.push(missing);
  await copyFile(entry,resolve(missing,'watch.html')); const broken = await context.newPage();
  await broken.goto(pathToFileURL(resolve(missing,'watch.html')).href,{waitUntil:'load'});
  await broken.waitForFunction(() => document.querySelector('#status').classList.contains('error') && document.querySelector('#start-label').textContent === '重新加载');
  check(await broken.locator('#status').isVisible(),'Missing audio shows visible actionable error, not silent blank');
  check(!await broken.locator('#start').isDisabled(),'Missing audio offers reload');
  check(await broken.locator('#start-fullscreen').isDisabled(),'Missing audio cannot start incomplete film');
  await broken.close();

  // Contact sheets are QA artifacts only; not imported by the film.
  const sheetPage = await context.newPage(); await sheetPage.setViewportSize({width:1280,height:1240});
  for (let group = 0; group < 3; group++) {
    const subset = stills.slice(group*18,group*18+18);
    await sheetPage.setContent('<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#091623;color:#d0bd89;font:12px monospace;padding:14px}h1{font-size:17px;margin:4px 0 13px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}figure{margin:0}img{display:block;width:100%;height:auto}figcaption{height:25px;padding:5px 0;font-size:10px}</style><h1>ODYSSEY — SHOT REVIEW ' + (group+1) + '/3</h1><main>' + subset.map(item => `<figure><img src="data:image/png;base64,${item.png}"><figcaption>${item.time.toFixed(2)}s · ${item.shot}</figcaption></figure>`).join('') + '</main>');
    await sheetPage.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
    await sheetPage.screenshot({path:resolve(qa,`${channel}-contact-${group+1}.png`),fullPage:true});
  }
  await sheetPage.close();
  const report = {result:'PASS',channel,browser:await browser.version(),full,htmlsha256:sha(await readFile(entry)),
    mastersha256:sha(await readFile(resolve(root,'export/奥德赛/audio/master.mp3'))),checks,frames,playback,errors,network,
    scope:'Exported HTML in installed browser, offline file protocol; FPS is local-machine evidence only, not the target playback device. Signal QA separate from aesthetic judgement.'};
  await writeFile(resolve(qa,`${channel}-${full?'full-':''}report.json`),JSON.stringify(report,null,2));
  console.log(JSON.stringify({result:'PASS',channel,full,checks:checks.length,shots:frames.length,playback,errors,network},null,2));
} catch (error) {
  await page.screenshot({path:resolve(qa,`${channel}-failure.png`)}).catch(() => {});
  console.error('FAILED AFTER',checks.length,'checks',JSON.stringify({errors,network})); throw error;
} finally {
  await browser.close(); for (const folder of ownedTemps) await rm(folder,{recursive:true,force:true});
}