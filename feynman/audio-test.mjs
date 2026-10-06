/** node <absolute path>/feynman/audio-test.mjs [--browser]
 * Signal/provenance regressions; optional short offline native HTMLAudio smoke.
 * Does not open/edit the film or change any story/visual/legacy project files.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { AUDIO_DIR, getTools, verify } from './score.mjs';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const report = JSON.parse(readFileSync(join(AUDIO_DIR,'report.json'),'utf8'));
const tools = getTools(), results = [];
function test(name, fn) { fn(); results.push({ name, passed:true }); }
function rejectMutation(name, mutate, reason) {
  test(name, () => { const candidate = structuredClone(report); mutate(candidate); assert.throws(() => verify(tools,candidate),reason); });
}

const actual = verify(tools,report);
test('Published MP3 / 24-bit WAV / timing-bus full signal verification', () => assert.deepEqual(actual,report.master));
test('Nine scene starts / 36 downbeats stay on fixed 150 BPM clock', () => {
  assert.deepEqual(actual.sceneEnergy.map(s => s.startSample),Array.from({length:9},(_,i) => i * 307200));
  assert.deepEqual(actual.timing.bars.map(b => b.sample),Array.from({length:36},(_,i) => i * 76800));
  assert.equal(actual.decodedFrames,2764800);
});
test('Original eight-bar hook is fully replayed at the heroic reset', () => {
  assert.equal(report.music.theme.notes.length,8);
  report.music.theme.notes.forEach((bar,b) => {
    for (const [offset,midi,gate] of bar) {
      const beat = 48 + b * 4 + offset, expected = b >= 4 && b % 2 === 0 ? midi - 12 : midi;
      assert.ok(report.music.events.some(e => e.kind === 'pulse-lead' && e.beat === beat && e.midi === expected && e.gateBeats === gate));
    }
  });
});
test('Two-octave pulse answers and E-major victory are present', () => {
  const calls = report.music.events.filter(e => e.kind === 'pulse-lead' && e.beat >= 64 && e.beat < 80);
  assert.ok(calls.some(call => report.music.events.some(e => e.kind === 'pulse-counterpoint' && e.beat === call.beat + .25 && e.midi === call.midi + 24)));
  assert.deepEqual(report.music.progression.slice(32).map(c => c.chord),['E','A','B','E']);
});
test('Only intended 0.6s failure interruption; finale remains substantially bigger', () => {
  assert.equal(actual.silenceWindow.totalSeconds,.6);
  assert.ok(actual.silenceWindow.measuredCore.rmsDbFS < -65);
  assert.ok(actual.sceneEnergy[6].rmsDbFS - actual.sceneEnergy[2].rmsDbFS > 8);
  assert.ok(actual.drops.every(d => d.riseDb > 2));
});
rejectMutation('Reject voice-enabled report', r => { r.noVoice = false; }, /Instrumental/);
rejectMutation('Reject stale story hash', r => { r.storysha256 = '0'.repeat(64); }, /Story SHA-256/);
rejectMutation('Reject stale generator hash', r => { r.generatorSha256 = '0'.repeat(64); }, /Generator SHA-256/);
rejectMutation('Reject mismatched master hash', r => { r.mastersha256 = '0'.repeat(64); }, /Audio integrity/);
rejectMutation('Reject narration ducking', r => { r.music.narrationDucking = true; }, /Instrumental/);
rejectMutation('Reject whole-master bit reduction', r => { r.music.masterBitReduction = true; }, /Instrumental/);
rejectMutation('Reject a fake on-grid event that disagrees with actual raw-bus onset', r => {
  r.music.lowEvents[0].beat += .25; r.music.lowEvents[0].sample += 4800;
}, /Percussive onset/);

let browserResult = { performed:false, note:'Pass --browser for short offline native HTMLAudio playback/seek, not a complete film test.' };
if (process.argv.includes('--browser')) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    await page.route(/^https?:\/\//,route => route.abort());
    // Local directory origin, then a relative audio filename, matching offline playback.
    await page.goto(pathToFileURL(AUDIO_DIR.endsWith(sep) ? AUDIO_DIR : AUDIO_DIR + sep).href);
    const metadata = await page.evaluate(async () => {
      const audio = new Audio(); audio.preload = 'auto'; audio.volume = .2; window.testAudio = audio;
      await new Promise((resolve,reject) => {
        const timer = setTimeout(() => reject(new Error('Local MP3 metadata timeout')),10000);
        audio.addEventListener('loadedmetadata',() => { clearTimeout(timer); resolve(); },{once:true});
        audio.addEventListener('error',() => { clearTimeout(timer); reject(new Error(`HTMLAudio error ${audio.error?.code}`)); },{once:true});
        audio.src = 'master.mp3'; audio.load();
      });
      return { native:audio instanceof HTMLAudioElement,duration:audio.duration,source:audio.currentSrc,readyState:audio.readyState };
    });
    assert.ok(metadata.native); assert.ok(Math.abs(metadata.duration - 57.6) < .035); assert.ok(metadata.source.startsWith('file:'));
    const segments = [];
    for (const at of [0,12.8,19.2,38.4,51.2,57.2]) {
      const result = await page.evaluate(async at => {
        const audio = window.testAudio; audio.pause(); audio.currentTime = at;
        if (audio.seeking) await new Promise(resolve => audio.addEventListener('seeked',resolve,{once:true}));
        const start = audio.currentTime;
        await audio.play();
        await new Promise((resolve,reject) => {
          const timer = setTimeout(() => { audio.removeEventListener('timeupdate',update); reject(new Error('Native playback clock stalled')); },6000);
          function update() { if (audio.currentTime > start + .08) { clearTimeout(timer); audio.removeEventListener('timeupdate',update); resolve(); } }
          audio.addEventListener('timeupdate',update);
        });
        audio.pause();
        return { requested:at,seeked:start,advancedTo:audio.currentTime,error:audio.error?.code ?? null };
      },at);
      assert.equal(result.error,null); assert.ok(Math.abs(result.seeked - at) < .035); assert.ok(result.advancedTo > at + .08);
      segments.push(result);
    }
    browserResult = { performed:true,passed:true,channel:'Chrome',headless:true,offline:true,fullPlayback:false,humanListening:false,...metadata,segments };
    results.push({ name:'Offline file:// native HTMLAudio loading, playback and six landmark seeks',passed:true });
  } finally { await browser.close(); }
}
const output = { passed:true,checkedAt:new Date().toISOString(),mastersha256:report.mastersha256,storysha256:report.storysha256,
  tests:results,browser:browserResult,signal:{ duration:actual.decodedDuration,frames:actual.decodedFrames,LUFS:actual.LUFS,truePeakDbTP:actual.truePeakDbTP,clipping:actual.clipping } };
writeFileSync(join(AUDIO_DIR,'test-report.json'),JSON.stringify(output,null,2) + '\n');
console.log(JSON.stringify(output,null,2));