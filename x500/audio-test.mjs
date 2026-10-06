// Independent source-to-delivery checks plus REAL-TIME native offline playback.
// node <absolute path>/x500/audio-test.mjs [--signal-only]
// Writes only audio/signal-report.json, audio/playback-report.json and augments audio/report.json.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { join, basename } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { AUDIO_DIR, getTools, verify } from './score.mjs';
import { DURATION, BPM, VOICE_CUES, SOURCES, FACTS } from './story.mjs';

const SR = 48000, tools = getTools(), require = createRequire(new URL('../web/package.json', import.meta.url));
const readJson = name => JSON.parse(readFileSync(join(AUDIO_DIR, name), 'utf8'));
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const report = readJson('report.json'), captions = readJson('captions.json');
const save = (name, value) => writeFileSync(join(AUDIO_DIR, name), JSON.stringify(value, null, 2) + '\n');
function decode(path, channels) {
  const b = execFileSync(tools.ffmpeg, ['-nostdin', '-v', 'error', '-i', path, '-ar', String(SR), '-ac', String(channels),
    '-f', 'f32le', '-'], { maxBuffer: 128 * 1024 * 1024, windowsHide: true });
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
function rawWords(name) {
  const seconds = t => t.replace(',', '.').split(':').reduce((s, x) => s * 60 + Number(x), 0);
  return [...readFileSync(join(AUDIO_DIR, name), 'utf8').matchAll(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\r?\n([^\r\n]+)/g)]
    .map(m => ({ start: seconds(m[1]), end: seconds(m[2]), text: m[3] }));
}

assert.equal(DURATION, 60); assert.equal(BPM, 120);
assert.equal(report.provenance.storySha256, hash(fileURLToPath(new URL('./story.mjs', import.meta.url))));
assert.equal(report.provenance.generatorSha256, hash(fileURLToPath(new URL('./score.mjs', import.meta.url))));
assert.equal(report.master.sha256, hash(join(AUDIO_DIR, 'master.mp3')));
assert.deepEqual(report.provenance.sources, SOURCES);
assert.deepEqual(report.provenance.facts, FACTS);
assert.equal(FACTS.price, '¥5499');
assert.match(VOICE_CUES.at(-1).text, /十二加二百五十六G，官方建议价，五千四百九十九元/);
assert.doesNotMatch(VOICE_CUES.map(c => c.text).join(''), /3999|三千九百九十九|概念旗舰/);
assert.doesNotMatch(JSON.stringify([report.title, report.provenance.productClaims, report.master.tags]), /fictional|unofficial concept/i);
for (const key of ['storySha256', 'generatorSha256', 'captionsSha256']) {
  const stale = structuredClone(report); stale.provenance[key] = 'stale';
  assert.throws(() => verify(tools, stale, captions), /hash mismatch/i);
}
const staleMaster = structuredClone(report); staleMaster.master.sha256 = 'stale';
assert.throws(() => verify(tools, staleMaster, captions), /Master hash mismatch/);
const staleCaptions = structuredClone(captions); staleCaptions.voices[7].text = 'stale';
assert.throws(() => verify(tools, report, staleCaptions), /Caption voice records are stale/);
assert.equal(report.composition.beats, 120);
assert.deepEqual(report.composition.cuts.map(c => c.at), [0, 6, 13, 20, 29, 37, 45, 52, 55.5, 58]);
assert.deepEqual(report.composition.motifMidi, [78, 81, 85, 80, 78]);
assert.ok(report.composition.events.bass >= 100 && report.composition.events.glass >= 200);
const verification = verify(tools, report, captions);
const master = decode(join(AUDIO_DIR, 'master.mp3'), 2);
const sourceChecks = report.voices.map((voice, index) => {
  for (const key of ['file', 'source', 'srt']) assert.equal(voice[key], basename(voice[key]), 'Audio paths must be basenames.');
  const words = rawWords(voice.srt), raw = decode(join(AUDIO_DIR, voice.source), 1);
  let maximumRemovedAmplitude = 0;
  for (const cut of voice.cuts) for (let i = Math.round(cut.start * SR); i < Math.round(cut.end * SR); i++)
    maximumRemovedAmplitude = Math.max(maximumRemovedAmplitude, Math.abs(raw[i]));
  assert.ok(maximumRemovedAmplitude < 10 ** (-47 / 20), `Removed non-silent source audio in ${voice.file}`);
  const transform = time => voice.at + (time - voice.cuts.reduce((s, cut) => s + Math.max(0, Math.min(cut.removed, time - cut.start)), 0)) / voice.tempo;
  const cc = captions.cues.filter(c => c.start >= voice.at - 0.001 && c.end <= voice.end + 0.001);
  for (const c of cc) {
    assert.ok(words.some(w => Math.abs(transform(w.start) - c.start) < 0.00002), 'Caption start is not a transformed service word boundary.');
    assert.ok(words.some(w => Math.abs(transform(w.end) - c.end) < 0.00002), 'Caption end is not a transformed service word boundary.');
  }
  // Test ACTUAL voice inclusion, not just nonempty files next to a music master.
  // Full-decoder gapless metadata aligns both independent MP3 encodes to PCM.
  const voicePcm = decode(join(AUDIO_DIR, voice.file), 1), offset = Math.round(VOICE_CUES[index].at * SR);
  let dot = 0, vv = 0, mm = 0;
  for (let i = 0; i < voicePcm.length; i++) {
    const mid = (master[(offset + i) * 2] + master[(offset + i) * 2 + 1]) / 2, v = voicePcm[i];
    dot += mid * v; vv += v * v; mm += mid * mid;
  }
  const correlation = dot / Math.sqrt(vv * mm);
  assert.ok(correlation > 0.85, `Actual voice not sufficiently present in master: ${voice.file} (${correlation})`);
  return { file: voice.file, serviceWordCount: words.length, captionCount: cc.length,
    maximumRemovedAmplitude, trueBoundaryAlignment: true, masterVoiceCorrelation: correlation,
    ...(index === 7 ? { wordBoundaries: words.map(w => ({ text: w.text, start: transform(w.start), end: transform(w.end) })) } : {}) };
});
save('signal-report.json', { passed: true, checkedAt: new Date().toISOString(),
  storySha256: report.provenance.storySha256, generatorSha256: report.provenance.generatorSha256,
  audioSha256: report.master.sha256, captionsSha256: report.provenance.captionsSha256,
  master: verification.master, sourceChecks, staleArtifactRegressionChecks: 5,
  limit: 'Objective source-to-master signal, provenance, metadata and word-boundary checks only; no playback or human listening claimed.' });
report.signalValidation = { passed: true, file: 'signal-report.json', audioSha256: report.master.sha256,
  allEightVoicesDetectedInMaster: true, allCaptionsMatchStoryAndServiceBoundaries: true, staleArtifactRegressionChecks: 5 };
save('report.json', report);
console.log(JSON.stringify({ signal: 'PASS', master: verification.master, sourceChecks }, null, 2));

if (!process.argv.includes('--signal-only')) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  try {
    const context = await browser.newContext({ offline: true, viewport: { width: 1100, height: 700 } });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => requests.push(r.url()));
    // A file:// document in the audio directory provides the SAME local-relative
    // origin/path behavior as the parent film, with no server or Web Audio.
    await page.goto(pathToFileURL(join(AUDIO_DIR, 'captions.json')).href);
    await page.evaluate(({ cues, windows }) => {
      document.title = 'X500 · 原生音频实播验证';
      document.body.innerHTML = '<main><p>vivo X500 标准版 / 非官方创意演绎</p><h1>让日常，自带电影感</h1>' +
        '<p>真实本地文件 · 断网 · 原生 HTMLAudioElement · 60 秒</p><button id="play">播放完整音轨</button>' +
        '<h2 id="caption"></h2><p id="clock">00.00 / 60.00</p></main>';
      document.body.style.cssText = 'margin:0;background:#070b14;color:#e7f2ff;font:18px system-ui;text-align:center;padding:100px 36px;';
      document.querySelector('h1').style.cssText = 'font-size:54px;font-weight:600;letter-spacing:4px;';
      document.querySelector('h2').style.cssText = 'height:65px;margin-top:64px;font-weight:400;';
      document.querySelector('button').style.cssText = 'padding:16px 30px;background:#b9ddff;border:0;border-radius:14px;font-size:18px;cursor:pointer;';
      const audio = new Audio('./master.mp3'); audio.id = 'master'; audio.controls = true; audio.preload = 'auto'; audio.volume = 1;
      document.querySelector('main').append(audio);
      const data = { nativeAudioElement: audio instanceof HTMLAudioElement, source: audio.src, seenCaptions: [], seenVoices: [],
        samples: [], events: [], failures: [], playbackRate: audio.playbackRate, muted: audio.muted, volume: audio.volume };
      window.audioQA = data;
      const seen = new Set(), seenVoices = new Set(); let bucket = -1;
      audio.addEventListener('timeupdate', () => {
        const t = audio.currentTime, c = cues.find(c => t >= c.start && t <= c.end);
        document.querySelector('#caption').textContent = c?.text ?? '';
        document.querySelector('#clock').textContent = `${t.toFixed(2)} / 60.00`;
        if (c) seen.add(c.text);
        windows.forEach((w, i) => { if (t >= w.at && t <= w.end) seenVoices.add(i); });
        if (Math.floor(t / 5) > bucket) { bucket = Math.floor(t / 5); data.samples.push({ t, wallMs: performance.now() }); }
      });
      for (const event of ['loadedmetadata', 'canplay', 'play', 'playing', 'waiting', 'stalled', 'pause', 'ended'])
        audio.addEventListener(event, () => data.events.push({ event, t: audio.currentTime }));
      window.audioDone = new Promise(resolve => {
        const finish = reason => {
          clearTimeout(timer); data.reason = reason; data.duration = audio.duration; data.currentTime = audio.currentTime;
          data.ended = audio.ended; data.readyState = audio.readyState; data.seenCaptions = [...seen]; data.seenVoices = [...seenVoices];
          data.wallSeconds = (performance.now() - data.startedAt) / 1000; resolve(data);
        };
        const timer = setTimeout(() => finish('timeout'), 78000);
        audio.addEventListener('ended', () => finish('ended'), { once: true });
        audio.addEventListener('error', () => { data.failures.push(audio.error?.message ?? 'Media error'); finish('error'); }, { once: true });
        document.querySelector('#play').addEventListener('click', async () => {
          data.startedAt = performance.now();
          try { await audio.play(); } catch (e) { data.failures.push(e.message); finish('play rejected'); }
        }, { once: true });
      });
    }, { cues: captions.cues, windows: VOICE_CUES });
    await page.click('#play');
    console.log('Playing complete 60-second MP3 in visible Chrome, offline file://, native Audio, playbackRate=1…');
    const wallStart = performance.now();
    const result = await page.evaluate(() => window.audioDone);
    result.controllerWallSeconds = (performance.now() - wallStart) / 1000;
    result.browser = await browser.version(); result.offline = true; result.pageErrors = errors;
    result.networkRequests = requests.filter(url => /^https?:/i.test(url)); result.audioSha256 = hash(join(AUDIO_DIR, 'master.mp3'));
    assert.equal(result.reason, 'ended'); assert.equal(result.ended, true); assert.equal(result.nativeAudioElement, true);
    assert.equal(result.playbackRate, 1); assert.equal(result.muted, false); assert.equal(result.volume, 1);
    assert.equal(result.failures.length, 0); assert.equal(errors.length, 0); assert.equal(result.networkRequests.length, 0);
    assert.ok(Math.abs(result.duration - 60) <= 0.03 && result.currentTime >= 60);
    assert.ok(result.wallSeconds >= 59 && result.wallSeconds < 75, 'Not complete real-time playback.');
    assert.equal(result.seenVoices.length, 8); assert.equal(result.seenCaptions.length, captions.cues.length);
    assert.ok(result.samples.length >= 12);
    result.passed = true; result.checkedAt = new Date().toISOString(); result.sourceChecks = sourceChecks;
    result.limit = 'Browser playback and decoded signal verified; physical speaker output and subjective human listening not claimed.';
    save('playback-report.json', result);
    report.nativePlayback = { passed: true, file: 'playback-report.json', browser: result.browser, offline: true,
      nativeAudioElement: true, duration: result.duration, realTimeSeconds: result.wallSeconds, heardByHuman: false,
      allEightVoicesDetectedInMaster: true, allCaptionsDisplayed: true, audioSha256: result.audioSha256 };
    save('report.json', report);
    console.log(JSON.stringify({ playback: 'PASS', duration: result.duration, realTimeSeconds: result.wallSeconds,
      voiceWindows: result.seenVoices.length, captionsDisplayed: result.seenCaptions.length, browser: result.browser,
      offline: true, nativeHTMLAudio: true, errors, networkRequests: result.networkRequests }, null, 2));
  } finally { await browser.close(); }
}