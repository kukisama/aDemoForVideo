/**
 * Standalone delivery QA; never builds, installs, serves HTTP or runs the old film.
 * node rdr2-v2/test.mjs --quick          poster + eight shots; one atlas build
 * node rdr2-v2/test.mjs                  complete deterministic/interaction QA
 * node rdr2-v2/test.mjs --full           also REAL 180-second audio-clock playback
 * Append --edge and/or --headed to select Edge and/or an owned visible browser.
 * Default: installed Chrome, headless, isolated contexts, file://, network offline.
 * No CDP/shared-browser attachment, clock mocking, playbackRate changes or GPU fallback.
 * PASS concerns measured contracts, NOT art direction, resemblance or listening quality.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync,
  readdirSync, existsSync, rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {resolve, join, relative} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import * as story from './story.mjs';

const dir = fileURLToPath(new URL('./', import.meta.url));
const root = fileURLToPath(new URL('../', import.meta.url));
const delivery = resolve(root, 'export/西部2');
const entry = resolve(delivery, '开始观看.html');
const soundtrack = resolve(delivery, 'audio/master.mp3');
const qaRoot = resolve(dir, 'output/qa');
const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(['--quick', '--full', '--edge', '--headed']);
const quick = args.has('--quick'), full = args.has('--full');
const channel = args.has('--edge') ? 'msedge' : 'chrome';
const mode = quick ? 'quick' : full ? 'full' : 'standard';
const runId = `${channel}-${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
const out = resolve(qaRoot, runId);
// A render/screenshot may be very slow on a software GPU. Only startup has a 60s limit.
const READY_MS = 60_000, ACTION_MS = 120_000, RENDER_MS = 180_000;
const runStarted = performance.now();
const sha = value => createHash('sha256').update(value).digest('hex');
const hashFile = file => sha(readFileSync(file));
const pathKey = path => process.platform==='win32'?resolve(path).toLowerCase():resolve(path);
const rel = file => relative(root, file).replaceAll('\\', '/');
const closeTo = (actual, expected, tolerance, label) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
  `${label}: actual=${actual}, expected=${expected}, tolerance=${tolerance}`);
const finiteVector = (v, label) => assert.ok(Array.isArray(v) && v.length === 3 && v.every(Number.isFinite), `${label}: ${JSON.stringify(v)}`);
const chapterAt = t => story.CHAPTERS.find(c => t >= c.start && t < c.end) ?? story.CHAPTERS.at(-1);
const shotAt = t => story.SHOTS.find(s => t >= s.start && t < s.end) ?? story.SHOTS.at(-1);
const cueAt = t => story.CAPTIONS.find(c => t >= c.start && t < c.end);
const report = {
  schema: 1, result: 'RUNNING', runId, mode, browser: channel, headless: !args.has('--headed'),
  startedAt: new Date().toISOString(), entry: rel(entry), output: rel(out),
  scope: {
    engineeringOnly: true, aestheticApproval: false, humanListeningPerformed: false,
    externalFactsRevalidatedOnline: false,
    sourceCheck: 'Fact cues must match the authored source keys/official URLs; creative dialogue must be marked. This does not independently certify the source statements.',
    clock: 'Native HTMLAudioElement at playbackRate=1; no virtual time or accelerated clock.',
    performance: 'Frame count/gaps are evidence for this environment, not a 60fps target-machine verdict.',
    quickBudget: 'Aim 5–20s on a capable GPU; startup <=60s, slow WebGL screenshots are not failed after 20s.',
  },
  checks: [], screenshots: [], frames: [], diagnostics: [], sessions: [], skipped: [],
};
let browser, page, verifyOriginal, tempRoot, latestFrame, latestImage;
const contexts = new Set();

function errorInfo(error) {
  return {name: error?.name ?? 'Error', message: String(error?.message ?? error),
    stack: error?.stack, actual: error?.actual, expected: error?.expected, operator: error?.operator};
}
function flush() {
  report.elapsedMs = Math.round(performance.now() - runStarted);
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
}
async function check(name, fn, fatal = false) {
  const start = performance.now();
  try {
    const value = await fn();
    report.checks.push({name, result: 'PASS', elapsedMs: Math.round(performance.now() - start)});
    console.log(`PASS ${name}`);
    return value;
  } catch (error) {
    report.checks.push({name, result: 'FAIL', elapsedMs: Math.round(performance.now() - start),
      error: errorInfo(error), frame: latestFrame, screenshot: latestImage});
    console.error(`FAIL ${name}: ${error.message}`);
    flush();
    if (fatal) { error.qaRecorded = true; throw error; }
    return undefined;
  }
}
async function deadline(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}: exceeded ${ms}ms`)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

// Observation only: forward every native call unchanged. Canvas2D atlases are legal;
// a Canvas2D MAIN renderer is not. No module import / second atlas generation here.
function installProbe() {
  const uploads = [], seen = new WeakSet(), painters = new WeakMap(), uniforms = new Map();
  const lighting = {}, errors = [], shader = {alphaTest: false, alphaDepth: false, depthDOF: false};
  let depthAttachments = 0;
  function painting(canvas) {
    if (!painters.has(canvas)) painters.set(canvas, {putImageData: 0, imageDerived: false});
    return painters.get(canvas);
  }
  const put = CanvasRenderingContext2D.prototype.putImageData;
  CanvasRenderingContext2D.prototype.putImageData = function (...a) {
    const result = Reflect.apply(put, this, a);
    painting(this.canvas).putImageData++;
    return result;
  };
  const draw = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (...a) {
    const result = Reflect.apply(draw, this, a);
    const source = a[0];
    if (!(source instanceof HTMLCanvasElement) || painting(source).imageDerived) painting(this.canvas).imageDerived = true;
    return result;
  };
  function upload(a) {
    for (const source of a) {
      if (!source || typeof source !== 'object' || ArrayBuffer.isView(source) || seen.has(source)) continue;
      const canvas = source instanceof HTMLCanvasElement;
      const image = source instanceof HTMLImageElement || source instanceof HTMLVideoElement ||
        (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap);
      if (!canvas && !image) continue;
      seen.add(source);
      uploads.push({source, kind: canvas ? 'canvas' : 'image-or-video', width: source.width, height: source.height});
    }
  }
  const proto = WebGL2RenderingContext.prototype;
  for (const name of ['texImage2D', 'texSubImage2D']) {
    const native = proto[name];
    proto[name] = function (...a) { const value = Reflect.apply(native, this, a); upload(a); return value; };
  }
  const sourceNative = proto.shaderSource;
  proto.shaderSource = function (object, source) {
    if (/#define\s+USE_ALPHATEST\b/.test(source) && /\bdiscard\b/.test(source)) {
      shader.alphaTest = true;
      if (/#define\s+DEPTH_PACKING\b/.test(source)) shader.alphaDepth = true;
    }
    if (/uniform\s+sampler2D\s+image,\s*depthImage/.test(source) && /linearDepth\(/.test(source) && /coc\(/.test(source)) shader.depthDOF = true;
    return Reflect.apply(sourceNative, this, [object, source]);
  };
  const attachmentNative = proto.framebufferTexture2D;
  proto.framebufferTexture2D = function (...a) {
    const result = Reflect.apply(attachmentNative, this, a);
    if ((a[1] === this.DEPTH_ATTACHMENT || a[1] === this.DEPTH_STENCIL_ATTACHMENT) && a[3]) depthAttachments++;
    return result;
  };
  const locationNative = proto.getUniformLocation;
  proto.getUniformLocation = function (program, name) {
    const loc = Reflect.apply(locationNative, this, [program, name]);
    if (loc && /^(zenith|horizon|exposure|fogColor|fogNear|fogFar|directionalLights\[0\]\.color|hemisphereLights\[0\]\.(skyColor|groundColor))$/.test(name)) uniforms.set(loc, name);
    return loc;
  };
  for (const name of ['uniform1f', 'uniform3f', 'uniform3fv']) {
    const native = proto[name];
    proto[name] = function (...a) {
      const value = Reflect.apply(native, this, a), key = uniforms.get(a[0]);
      if (key) lighting[key] = name === 'uniform3fv' ? Array.from(a[1]).slice(a[2] ?? 0, (a[2] ?? 0) + 3) : a.slice(1);
      return value;
    };
  }
  window.addEventListener('error', e => errors.push(e.message || 'window error'));
  window.addEventListener('unhandledrejection', e => errors.push(String(e.reason?.stack || e.reason)));
  window.__WESTERN2_QA_PROBE__ = {
    errors,
    summary() {
      return {shader: {...shader}, depthAttachments, lighting: JSON.parse(JSON.stringify(lighting)),
        textures: uploads.map(({source, ...v}) => ({...v, ...(painters.get(source) ?? {})}))};
    },
    async atlasEvidence() {
      const results = [];
      for (const {source, width, height, kind} of uploads) {
        if (kind !== 'canvas' || ![[768, 1408], [1536, 2464], [1280, 432]].some(([w, h]) => width === w && height === h)) continue;
        const rgba = source.getContext('2d').getImageData(0, 0, width, height).data;
        let opaque = 0, translucent = 0;
        for (let i = 3; i < rgba.length; i += 4) { if (rgba[i] === 255) opaque++; else if (rgba[i] !== 0) translucent++; }
        const digest = await crypto.subtle.digest('SHA-256', rgba);
        results.push({width, height, opaque, translucent, ...(painters.get(source) ?? {}),
          pixelSha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')});
      }
      return results;
    },
  };
}

function inspectFrame() {
  const api = window.__WESTERN2__, byId = id => document.getElementById(id);
  const rect = element => {
    const b = element.getBoundingClientRect();
    return {x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height};
  };
  const layout = id => {
    const el = byId(id), css = getComputedStyle(el), range = document.createRange();
    range.selectNodeContents(el);
    return {rect: rect(el), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, hidden: el.hidden,
      display: css.display, visibility: css.visibility, opacity: Number(css.opacity),
      text: el.textContent, textRects: Array.from(range.getClientRects(), b => ({x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height}))};
  };
  const a = byId('music'), canvas = byId('world'), gl = canvas.getContext('webgl2');
  const debug = gl?.getExtension('WEBGL_debug_renderer_info');
  return {state: api?.state, info: api?.info(), status: byId('status')?.textContent,
    chapterId: byId('stage').dataset.chapter,
    chapterName: byId('chapter-name').textContent, chapterMarker: byId('chapter-marker').textContent,
    caption: layout('caption'), speaker: layout('speaker'), box: layout('caption-box'), adapted: layout('adapted'),
    stage: rect(byId('stage')), viewport: {width: innerWidth, height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight},
    audio: {src: a.currentSrc, rawSrc: a.getAttribute('src'), time: a.currentTime, duration: a.duration,
      paused: a.paused, ended: a.ended, seeking: a.seeking, muted: a.muted, volume: a.volume,
      rate: a.playbackRate, defaultRate: a.defaultPlaybackRate, readyState: a.readyState, error: a.error?.message ?? null},
    webgl: {real: gl instanceof WebGL2RenderingContext, version: gl?.getParameter(gl.VERSION),
      renderer: gl?.getParameter(gl.RENDERER), lost: gl?.isContextLost(), main2D: !!canvas.getContext('2d'),
      unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      width: canvas.width, height: canvas.height},
    probe: window.__WESTERN2_QA_PROBE__?.summary()};
}

async function openFilm(file, label) {
  const context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1,
    offline: true, reducedMotion: 'no-preference', serviceWorkers: 'block'});
  contexts.add(context);
  const session = {label, url: pathToFileURL(file).href, requests: [], failures: [], errors: [], warnings: [], readiness: []};
  report.sessions.push(session);
  await context.route(/^https?:\/\//, route => route.abort('internetdisconnected'));
  context.on('request', request => session.requests.push({url: request.url(), type: request.resourceType()}));
  context.on('requestfailed', request => session.failures.push({url: request.url(), error: request.failure()?.errorText}));
  await context.addInitScript(installProbe);
  const p = await context.newPage();
  p.setDefaultTimeout(ACTION_MS); p.setDefaultNavigationTimeout(READY_MS);
  let abortStartup;
  const startupFailure = new Promise((_, reject) => { abortStartup = reject; });
  const recordError = error => {
    session.errors.push(error);
    abortStartup?.(new Error(`${label}: ${error.kind}: ${error.message}`));
  };
  p.on('pageerror', error => recordError({kind: 'pageerror', ...errorInfo(error)}));
  p.on('console', message => {
    if (message.type() === 'error') recordError({kind: 'console.error', message: message.text(), location: message.location()});
    if (message.type() === 'warning') session.warnings.push(message.text());
  });
  p.on('crash', () => recordError({kind: 'crash', message: 'Owned page crashed'}));
  p.on('close', () => { session.closed = true; });
  p.qaSession = session;
  // Keep a reference even if navigation/readiness fails, so finally can diagnose it.
  if (label === 'delivery') page = p;
  const began = performance.now();
  try {
    await deadline(Promise.race([startupFailure, (async () => {
      await p.goto(session.url, {waitUntil: 'commit', timeout: READY_MS});
      const handle = await p.waitForFunction(() => {
        const api = window.__WESTERN2__, s = document.getElementById('status');
        const probe = window.__WESTERN2_QA_PROBE__;
        const status = s?.textContent ?? '';
        const history = window.__WESTERN2_QA_READY_HISTORY__ ??= [];
        if (history.at(-1)?.status !== status) history.push({ms: performance.now(), status});
        return api?.ready || api?.state?.error || s?.classList.contains('error') || probe?.errors.length;
      }, null, {timeout: Math.max(1, READY_MS - (performance.now() - began)), polling: 100});
      await handle.dispose();
      const initial = await p.evaluate(() => ({ready: window.__WESTERN2__?.ready,
        state: window.__WESTERN2__?.state, status: document.getElementById('status')?.textContent,
        history: window.__WESTERN2_QA_READY_HISTORY__, errors: window.__WESTERN2_QA_PROBE__?.errors}));
      session.readiness = initial.history;
      session.initial = initial;
      assert.equal(initial.ready, true, `ready failed: ${JSON.stringify(initial)}`);
      assert.deepEqual(session.errors, [], 'Startup pageerror / console.error');
      assert.deepEqual(initial.errors, [], 'Startup uncaught error');
    })()]), READY_MS, `${label} waitready`);
  } catch (error) {
    session.readyElapsedMs = Math.round(performance.now() - began);
    try {
      session.readinessFailure = await deadline(p.evaluate(() => ({status: document.getElementById('status')?.textContent,
        state: window.__WESTERN2__?.state, history: window.__WESTERN2_QA_READY_HISTORY__,
        errors: window.__WESTERN2_QA_PROBE__?.errors})), 8_000, 'read failure status');
    } catch (diagnosticError) { session.readinessFailure = errorInfo(diagnosticError); }
    throw error;
  } finally {
    abortStartup = null;
    session.readyElapsedMs ??= Math.round(performance.now() - began);
  }
  return p;
}

async function health(p = page) {
  assert.deepEqual(p.qaSession.errors, [], `${p.qaSession.label}: pageerror / console.error`);
  assert.deepEqual(p.qaSession.failures, [], `${p.qaSession.label}: failed requests`);
  const errors = await deadline(p.evaluate(() => ({error: window.__WESTERN2__?.state.error, errors: window.__WESTERN2_QA_PROBE__?.errors})), RENDER_MS, 'read health');
  assert.ok(!errors.error, JSON.stringify(errors));
  assert.deepEqual(errors.errors, []);
}

async function setTime(t, p = page, useRenderAPI = false) {
  await health(p);
  await deadline(p.evaluate(async ({time, useRenderAPI}) => {
    const api = window.__WESTERN2__, audio = document.getElementById('music');
    if (!api?.ready) throw new Error('Cannot seek: film is not ready');
    if (useRenderAPI) {
      const snapshot = api.render(time);
      if (typeof snapshot !== 'string' || !snapshot.startsWith('data:image/png;base64,')) throw new Error('render() must return a real PNG snapshot');
    } else { api.pause(); api.seek(time); }
    if (audio.seeking) await new Promise((resolveSeek, reject) => {
      const controller = new AbortController();
      const done = error => { clearTimeout(timer); controller.abort(); error ? reject(error) : resolveSeek(); };
      const timer = setTimeout(() => done(new Error(`Native seek timeout at ${time}`)), 60_000);
      audio.addEventListener('seeked', () => done(), {once: true, signal: controller.signal});
      audio.addEventListener('error', () => done(new Error(audio.error?.message || 'Audio seek error')), {once: true, signal: controller.signal});
    });
    // Native seeking may trigger another render; wait for it AND two presentation frames.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, {time: t, useRenderAPI}), RENDER_MS, `render ${t}`);
  const f = await deadline(p.evaluate(inspectFrame), RENDER_MS, `inspect ${t}`);
  latestFrame = f;
  assert.equal(f.audio.paused, true, `Screenshot clock must be paused at ${t}`);
  assert.equal(f.state.playing, false);
  closeTo(f.state.renderedTime, Math.max(0, Math.min(180, t)), .000002, 'settled render time');
  return f;
}
async function screenshot(name, p = page) {
  const file = join(out, `${name}.png`);
  assert.equal(await p.locator('#music').evaluate(a => a.paused), true, 'Page screenshots must never advance the audio clock');
  const buffer = await p.screenshot({path: file, type: 'png', timeout: RENDER_MS, fullPage: false, animations: 'disabled',style:'#controls,#status{visibility:hidden!important}'});
  assert.equal(buffer.subarray(1, 4).toString(), 'PNG');
  const item = {name, file: rel(file), sha256: sha(buffer), bytes: buffer.length,
    width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)};
  report.screenshots.push(item); latestImage = item.file;
  return {item, buffer};
}

function validateFrame(f, t) {
  const ch = chapterAt(t), shot = shotAt(t), info = f.info;
  closeTo(f.state.time, t, .000002, 'state time');
  closeTo(info.time, t, .000002, 'world time');
  assert.equal(f.state.chapter, ch.id); assert.equal(f.chapterId, ch.id);
  assert.equal(f.chapterName, ch.name);
  assert.equal(f.chapterMarker, `${String(story.CHAPTERS.indexOf(ch) + 1).padStart(2, '0')} / 07`);
  assert.equal(info.scene, shot.scene);
  assert.deepEqual({...info.shot, index: undefined}, {...shot, index: undefined});
  assert.equal(info.shot.index, story.SHOTS.indexOf(shot));
  assert.deepEqual(f.state.renderInfo, info, 'state.renderInfo must describe the displayed world');
  assert.equal(info.renderer, 'webgl2'); assert.equal(info.fallback2D, false);
  assert.equal(info.absoluteTime, true); assert.equal(info.autonomousLoop, false);
  assert.equal(info.hasDrawn, true); assert.equal(info.disposed, false);
  assert.equal(f.webgl.real, true); assert.equal(f.webgl.main2D, false); assert.equal(f.webgl.lost, false);
  assert.match(f.webgl.version, /WebGL 2/);
  assert.equal(info.width, 1280); assert.equal(info.height, 720);
  assert.equal(f.webgl.width, 1280); assert.equal(f.webgl.height, 720);
  assert.ok(info.geometryCount > 1 && info.objectCount > 1 && info.drawCalls > 0 && info.triangles > 0,
    `Must submit real scene geometry: ${JSON.stringify(info)}`);
  assert.equal(info.postfxEnabled, true); assert.equal(info.postfx?.depthBasedDOF, true);
  assert.equal(info.postfx?.alphaTestDepth, true); assert.equal(info.postfx?.temporalHistory, false);
  assert.ok(f.probe.depthAttachments > 0, 'A real depth texture must be attached, not just a claimed info flag');
  assert.equal(f.probe.shader.depthDOF, true, 'Depth-sampling DOF shader must reach WebGL');
  assert.equal(f.probe.shader.alphaTest, true, 'Alpha-tested fragment shader must reach WebGL');
  assert.equal(f.probe.shader.alphaDepth, true, 'Alpha-tested depth/shadow shader must reach WebGL');
  assert.deepEqual(f.probe.textures.filter(texture => texture.kind !== 'canvas'), [], 'No old image/video textures may replace procedural pixel art');
  finiteVector(info.camera.position, 'camera position'); finiteVector(info.camera.target, 'camera target');
  assert.ok(info.camera.focusDistance > 0 && info.camera.fov > 0);
  for (const [id, actor] of Object.entries(info.actorStates)) {
    finiteVector(actor.position, `${id} position`);
    assert.ok(Number.isInteger(actor.frame) && actor.frame >= 0 && actor.frame < 8, `${id} frame=${actor.frame}`);
  }
  assert.equal(f.audio.rate, 1); assert.equal(f.audio.defaultRate, 1);
  assert.equal(f.audio.error, null); closeTo(f.audio.duration, 180, .04, 'audio duration');
}
function contained(inner, outer, label, tolerance = 1.5) {
  assert.ok(inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance &&
    inner.right <= outer.right + tolerance && inner.bottom <= outer.bottom + tolerance,
  `${label}: inner=${JSON.stringify(inner)}, outer=${JSON.stringify(outer)}`);
}
function validateCaption(f, t) {
  const cue = cueAt(t);
  assert.equal(f.caption.text, cue?.text ?? '', `Full caption at ${t}`);
  assert.equal(f.speaker.text, cue?.speaker ?? '', `Speaker at ${t}`);
  assert.equal(f.state.caption, cue?.text ?? ''); assert.equal(f.state.speaker, cue?.speaker ?? '');
  assert.equal(f.adapted.hidden, cue?.kind !== 'dialogue', `Dialogue marker at ${t}`);
  closeTo(f.box.opacity, cue ? 1 : 0, .00001, 'caption window opacity');
  if (!cue) return;
  assert.equal(f.box.hidden, false); assert.notEqual(f.box.display, 'none');
  if (cue.kind === 'dialogue') { assert.equal(f.adapted.text, '原创演绎'); assert.notEqual(f.adapted.display, 'none'); }
  contained(f.box.rect, f.stage, 'caption box inside stage');
  for (const [name, element] of [['caption', f.caption], ['speaker', f.speaker], ...(cue.kind === 'dialogue' ? [['adapted', f.adapted]] : [])]) {
    assert.ok(element.rect.width > 0 && element.rect.height > 0, `${name} has no rendered area`);
    assert.ok(element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1,
      `${name} overflows at ${t}: ${JSON.stringify(element)}`);
    for (const rect of element.textRects) if (rect.width && rect.height) {
      contained(rect, f.stage, `${name} text in stage`); contained(rect, f.box.rect, `${name} text in caption box`);
    }
  }
}
function portraitCheck(f) {
  const view = f.info.shot.view;
  if (!/-(close|medium)$/.test(view)) return;
  const actor = view.startsWith('dutch') ? 'dutch' : 'arthur';
  const close=view.endsWith('-close'),width=close?1536:768,height=close?2464:1408;
  assert.equal(f.info.actorStates[actor]?.portrait, close,
    `${view} at ${f.info.time}s must select the authored full-body or close-up art, respectively`);
  assert.ok(f.probe.textures.some(t => t.kind === 'canvas' && t.width === width && t.height === height && t.putImageData >= 88 && !t.imageDerived),
    'Medium shots use new 96x128 full-body art; close-ups use separately drawn 192x224 portraits');
}

const shotTimes = [4.8, 8, 15, 24, 35.8, 41.2, 45, 55, 62.5, 71, 79, 88, 95, 102, 110,
  118, 124.5, 133, 143.8, 149, 157, 166.7, 172.5, 178];
const quickIndices = [0, 1, 3, 9, 13, 18, 19, 22];

async function makeContactSheet(images) {
  // about:blank in a separately OWNED context: no navigation, modules, media or atlas build.
  const context = await browser.newContext({offline: true, serviceWorkers: 'block'});
  contexts.add(context);
  const collage = await context.newPage();
  try {
    await collage.setContent('<!doctype html><meta charset="utf-8"><title>Western II QA contact sheet</title>');
    const dataURL = await deadline(collage.evaluate(async tiles => {
      const columns = 4, rows = Math.ceil(tiles.length / columns), w = 320, h = 180, label = 32;
      const canvas = document.createElement('canvas'); canvas.width = columns * w; canvas.height = rows * (h + label);
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#101719'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '12px sans-serif'; ctx.textBaseline = 'middle';
      for (let i = 0; i < tiles.length; i++) {
        const image = new Image(); image.src = tiles[i].dataURL; await image.decode();
        const x = (i % columns) * w, y = Math.floor(i / columns) * (h + label);
        ctx.drawImage(image, x, y, w, h); ctx.fillStyle = '#e4d7bb'; ctx.fillText(tiles[i].label, x + 8, y + h + label / 2, w - 16);
      }
      return canvas.toDataURL('image/png');
    }, images), RENDER_MS, 'contact sheet');
    const file = join(out, 'contact-sheet.png'), bytes = Buffer.from(dataURL.split(',')[1], 'base64');
    writeFileSync(file, bytes); report.contactSheet = {file: rel(file), sha256: sha(bytes), columns: 4, rows: Math.ceil(images.length / 4), tiles: images.length};
  } finally { await context.close(); contexts.delete(context); }
}

async function screenshotShots() {
  const indices = quick ? quickIndices : story.SHOTS.map((_, i) => i), tiles = [];
  let firstPixels;
  for (const index of indices) {
    const t = shotTimes[index], shot = story.SHOTS[index];
    const f = await setTime(t);
    report.gpu ??= f.webgl;
    report.frames.push({time: t, shot: index, info: f.info, lighting: f.probe.lighting});
    const {item, buffer} = await screenshot(`shot-${String(index + 1).padStart(2, '0')}-${shot.scene}-${t}`);
    tiles.push({label: `${String(index + 1).padStart(2, '0')} | ${t}s | ${shot.scene} / ${shot.view}`, dataURL: `data:image/png;base64,${buffer.toString('base64')}`});
    await check(`shot ${index + 1}: scene, coordinates, WebGL2 and depth`, () => validateFrame(f, t));
    await check(`shot ${index + 1}: complete caption, attribution and fit`, () => validateCaption(f, t));
    if (/-(close|medium)$/.test(shot.view)) await check(`shot ${index + 1}: portrait source`, () => portraitCheck(f));
    if (index === 1) firstPixels = await page.evaluate(() => window.__WESTERN2__.snapshot());
    item.time = t; item.shot = index;
  }
  if (quick) {
    await check('same-timestamp pixels after visiting other scenes (exact)', async () => {
      await setTime(8, page, true);
      const repeat = await page.evaluate(() => window.__WESTERN2__.snapshot());
      assert.equal(sha(repeat), sha(firstPixels), 'Repeated 8s WebGL snapshot differs; no approximate tolerance is silently granted');
    });
    report.skipped.push('24-shot contact sheet (quick saves only the poster and eight shots)');
  } else await check('4x6 contact sheet contains all 24 rendered shots', async () => { assert.equal(tiles.length, 24); await makeContactSheet(tiles); });
  await check('seven scene lighting/mood configurations reach real GL uniforms', () => {
    const scenes = new Map(report.frames.map(frame => [frame.info.scene, frame.lighting]));
    assert.equal(scenes.size, 7);
    const signatures = [];
    for (const [scene, lights] of scenes) {
      finiteVector(lights.zenith, `${scene} sky uniform`); finiteVector(lights.horizon, `${scene} horizon uniform`);
      finiteVector(lights['directionalLights[0].color'], `${scene} sun uniform`);
      signatures.push(JSON.stringify([lights.zenith, lights.horizon, lights['directionalLights[0].color']]));
    }
    assert.equal(new Set(signatures).size, 7, 'Scene names alone are not distinct lighting');
    const energy = scene => scenes.get(scene)['directionalLights[0].color'].reduce((a, b) => a + b, 0);
    assert.ok(energy('camp-night') < energy('camp-warm'), 'Night must not silently reuse warm-camp sunlight');
    report.lighting = Object.fromEntries(scenes);
  });
}

async function exhaustiveTimeline() {
  // De-duplicate shared endpoints: each time is rendered only once.
  const probes = new Map();
  const add = (t, label) => { const key = Number(t.toFixed(6)); probes.set(key, [...(probes.get(key) ?? []), label]); };
  for (let i = 0; i < story.CAPTIONS.length; i++) {
    const c = story.CAPTIONS[i];
    for (const [t, kind] of [[c.start - .001, 'before'], [c.start, 'start'], [(c.start + c.end) / 2, 'middle'], [c.end - .001, 'last-visible'], [c.end, 'end-exclusive']]) add(t, `cue ${i + 1} ${kind}`);
  }
  for (const [label, values] of [['shot', story.SHOTS], ['chapter', story.CHAPTERS]]) {
    for (let i = 1; i < values.length; i++) { add(values[i].start - .001, `${label} ${i + 1} before`); add(values[i].start, `${label} ${i + 1} exact`); }
  }
  add(0, 'opening'); add(179.999, 'last millisecond'); add(180, 'exact ending');
  for (const [t, labels] of [...probes].sort((a, b) => a[0] - b[0])) {
    const f = await setTime(t);
    await check(`${t}s: ${labels.join(', ')}`, () => {
      validateFrame(f, t); validateCaption(f, t);
      assert.equal(f.state.ended, t === 180, 'Only exact end may be ended');
    });
  }
  await check('clamping and exact 180 never wrap to opening', async () => {
    for (const [requested, expected] of [[181, 180], [-1, 0], [180, 180]]) {
      const f = await setTime(requested); validateFrame(f, expected); validateCaption(f, expected);
      assert.equal(f.info.shot.index, expected === 180 ? 23 : 0);
    }
  });
}

async function interactions() {
  await check('warm map: offer -> accepted by >=41s, Arthur pose and physical hand coordinates', async () => {
    const before = await setTime(38), accepted = await setTime(41);
    assert.equal(before.info.interaction.kind, 'map'); assert.equal(before.info.interaction.accepted, false);
    assert.equal(before.info.interaction.holder, 'dutch');
    assert.equal(accepted.info.interaction.accepted, true); assert.equal(accepted.info.interaction.holder, 'arthur');
    assert.equal(accepted.info.actorStates.arthur.pose, 'accept'); assert.equal(accepted.info.actorStates.arthur.contact, 'map');
    assert.equal(accepted.info.actorStates.dutch.pose, 'offer');
    finiteVector(accepted.info.interaction.mapPosition, 'held map position');
    finiteVector(accepted.info.interaction.hands.arthur, 'Arthur map hand');
    assert.notDeepEqual(before.info.interaction.mapPosition, accepted.info.interaction.mapPosition);
  });
  await check('fraying map is NOT accepted; doubt then physically retreat', async () => {
    const offer = await setTime(95), doubt = await setTime(102), withdrawing = await setTime(110), withdrawn = await setTime(113.8);
    for (const f of [offer, doubt, withdrawing, withdrawn]) {
      assert.equal(f.info.interaction.accepted, false); assert.equal(f.info.interaction.holder, 'dutch');
      assert.notEqual(f.info.actorStates.arthur.pose, 'accept'); assert.notEqual(f.info.actorStates.arthur.contact, 'map');
    }
    assert.equal(doubt.info.actorStates.arthur.pose, 'doubt'); assert.equal(withdrawing.info.actorStates.arthur.pose, 'walk');
    assert.ok(withdrawn.info.actorStates.arthur.position[0] < doubt.info.actorStates.arthur.position[0] - 1);
  });
  await check('fold: visible progression 0 -> partial -> 1, held by Arthur with fold pose', async () => {
    const start = await setTime(163.7), middle = await setTime(165), end = await setTime(166.7);
    closeTo(start.info.interaction.folded, 0, .00001, 'fold start');
    assert.ok(middle.info.interaction.folded > 0 && middle.info.interaction.folded < 1);
    closeTo(end.info.interaction.folded, 1, .00001, 'fold end');
    for (const f of [start, middle, end]) { assert.equal(f.info.actorStates.arthur.pose, 'fold'); assert.equal(f.info.actorStates.arthur.contact, 'map'); }
    assert.equal(end.info.actorStates.arthur.frame, 7); assert.equal(end.info.interaction.holder, 'arthur');
  });
  await check('wagon wheels really sink, unload, receive push contact and move/rotate free', async () => {
    const approach = await setTime(58.9), sunk = await setTime(62), unload = await setTime(66.5), push = await setTime(72), freed = await setTime(83.999);
    const a = approach.info.interaction, s = sunk.info.interaction, p = push.info.interaction, f = freed.info.interaction;
    assert.equal(s.kind, 'wagon'); assert.ok(s.wagonPosition[1] < a.wagonPosition[1] - .15);
    assert.equal(sunk.info.actorStates.arthur.pose, 'doubt');
    assert.ok(unload.info.interaction.movingCrate >= 0); assert.equal(unload.info.actorStates.arthur.contact, 'cargo');
    assert.equal(p.unloadedCount, 3); assert.equal(p.pushContact, true);
    for (const id of ['arthur', 'camp-0']) { assert.equal(push.info.actorStates[id].pose, 'push'); assert.equal(push.info.actorStates[id].contact, 'wagon-rear'); }
    closeTo(f.wagonPosition[1], 0, .001, 'wheel clears rut');
    assert.ok(f.wagonPosition[2] < s.wagonPosition[2] - 10, `Wagon did not translate: ${JSON.stringify({s, f})}`);
    assert.ok(Math.abs(f.wheelRotation - s.wheelRotation) > 10, 'Wheel did not rotate');
    closeTo(f.wheelRotation, -f.wagonPosition[2] / .66, .0001, 'wheel rotation follows physical displacement');
    assert.equal(freed.info.actorStates.arthur.pose, 'walk');
  });
  await check('crossing: turn, return, hand contact, escort and memberJoined before 144', async () => {
    const turn = await setTime(129), returning = await setTime(132), hand = await setTime(135.4), escort = await setTime(140), joined = await setTime(143.999);
    assert.equal(turn.info.actorStates.arthur.pose, 'turn'); assert.equal(turn.info.interaction.memberJoined, false);
    assert.equal(returning.info.actorStates.arthur.pose, 'walk');
    assert.ok(returning.info.interaction.returning > 0 && returning.info.interaction.returning < 1);
    assert.ok(returning.info.actorStates.arthur.position[2] > turn.info.actorStates.arthur.position[2] + 1);
    assert.equal(hand.info.actorStates.arthur.pose, 'help'); assert.equal(hand.info.interaction.handContact, true);
    assert.equal(hand.info.actorStates.arthur.contact, 'camp-0-hand'); assert.equal(hand.info.actorStates['camp-0'].contact, 'arthur-hand');
    finiteVector(hand.info.interaction.gripPosition, 'world-space grip');
    assert.ok(escort.info.interaction.escort > 0 && escort.info.interaction.escort < 1);
    assert.equal(escort.info.actorStates.arthur.pose, 'walk'); assert.equal(escort.info.actorStates['camp-0'].pose, 'walk');
    assert.ok(joined.info.actorStates.arthur.position[2] < hand.info.actorStates.arthur.position[2] - 18);
    assert.ok(joined.info.actorStates['camp-0'].position[2] < -13.4);
    assert.equal(joined.info.interaction.memberJoined, true);
  });
}

async function deterministicPixels() {
  for (const t of [8, 41.2, 72, 102.25, 143.8, 166.7, 179.999]) await check(`pixel determinism ${t}s -> unrelated scene -> ${t}s (exact)`, async () => {
    const first = await setTime(t, page, t === 8), a = await page.evaluate(() => window.__WESTERN2__.snapshot());
    await setTime(t < 84 ? 118 : 24);
    const other = await page.evaluate(() => window.__WESTERN2__.snapshot());
    const second = await setTime(t), b = await page.evaluate(() => window.__WESTERN2__.snapshot());
    assert.notEqual(sha(a), sha(other), 'Different scenes produced identical pixel output');
    assert.deepEqual(second.info, first.info, 'Absolute-time world state must not retain previous-scene state');
    if (sha(a) !== sha(b)) {
      // Strict by default. Give actionable software-GPU deltas, not a blanket tolerance.
      const delta = await page.evaluate(async ([one, two]) => {
        const images = await Promise.all([one, two].map(async src => { const im = new Image(); im.src = src; await im.decode(); return im; }));
        const canvas = document.createElement('canvas'); canvas.width = images[0].width; canvas.height = images[0].height;
        const ctx = canvas.getContext('2d'), pixels = images.map(im => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(im, 0, 0); return ctx.getImageData(0, 0, canvas.width, canvas.height).data; });
        let maxChannelDelta = 0, changedPixels = 0, sum = 0;
        for (let i = 0; i < pixels[0].length; i += 4) {
          let changed = false;
          for (let c = 0; c < 3; c++) { const d = Math.abs(pixels[0][i + c] - pixels[1][i + c]); sum += d; maxChannelDelta = Math.max(maxChannelDelta, d); changed ||= d !== 0; }
          if (changed) changedPixels++;
        }
        return {maxChannelDelta, changedPixels, changedFraction: changedPixels / (canvas.width * canvas.height), meanAbsoluteDelta: sum / (canvas.width * canvas.height * 3)};
      }, [a, b]);
      for (const [suffix, png] of [['first', a], ['repeat', b]]) writeFileSync(join(out, `determinism-${t}-${suffix}.png`), Buffer.from(png.split(',')[1], 'base64'));
      report.diagnostics.push({kind: 'pixel-mismatch', time: t, delta, firstSHA: sha(a), repeatSHA: sha(b)});
      assert.fail(`Exact pixel mismatch at ${t}s: ${JSON.stringify(delta)}. No scene-sized tolerance is allowed.`);
    }
  });
}

async function fullscreenFromPoster() {
  await check('native fullscreen starts from the actual start-fullscreen button', async () => {
    await page.locator('#start-fullscreen').click();
    await page.waitForFunction(() => document.fullscreenElement === document.getElementById('cinema') && window.__WESTERN2__.state.playing, null, {timeout: ACTION_MS});
    const state = await page.evaluate(() => ({state: window.__WESTERN2__.state, poster: document.getElementById('poster').hidden}));
    assert.equal(state.poster, true); assert.equal(state.state.started, true);
    await page.evaluate(() => window.__WESTERN2__.pause());
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => !document.fullscreenElement, null, {timeout: ACTION_MS});
  });
  // If native fullscreen failed, leave the owned page in a known paused state.
  await page.evaluate(async () => { window.__WESTERN2__.pause(); if (document.fullscreenElement) await document.exitFullscreen(); });
}

async function controls() {
  const control = (name, fn) => check(name, async () => {
    try { return await fn(); }
    catch (error) {
      try { latestFrame = await deadline(page.evaluate(inspectFrame), RENDER_MS, 'failed control diagnostics'); }
      catch { /* Keep the original failure, not a second diagnostic failure. */ }
      throw error;
    } finally {
      // Cleanup, not an assertion shortcut: failed dialogs must not block later cases.
      await page.evaluate(() => {
        window.__WESTERN2__.pause();
        const dialog = document.getElementById('about-dialog'), gentle = document.getElementById('gentle');
        if (dialog.open) dialog.close();
        if (gentle.checked) { gentle.checked = false; gentle.dispatchEvent(new Event('change', {bubbles: true})); }
      });
    }
  });
  await control('pause button freezes audio, state and exact WebGL pixels over four rAFs', async () => {
    await setTime(20); await page.locator('#toggle').click();
    await page.waitForFunction(() => window.__WESTERN2__.state.playing && document.getElementById('music').currentTime > 20.15, null, {timeout: ACTION_MS});
    const target=await page.locator('#toggle').evaluate(button=>{const r=button.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
    // Real pointer movement wakes the auto-hidden controls before the native click.
    // Coordinate input avoids waiting for a hidden locator before moving the pointer.
    await page.mouse.move(target.x-24,target.y-8);
    await page.mouse.click(target.x,target.y);
    await page.waitForFunction(()=>document.getElementById('music').paused&&!window.__WESTERN2__.state.playing);
    const samples = await page.evaluate(async () => {
      const api = window.__WESTERN2__, audio = document.getElementById('music');
      const first = {state: api.state, time: audio.currentTime, png: api.snapshot()}, samples = [];
      for (let i = 0; i < 4; i++) { await new Promise(requestAnimationFrame); samples.push({state: api.state, time: audio.currentTime}); }
      return {first, samples, lastPNG: api.snapshot(), paused: audio.paused};
    });
    assert.equal(samples.paused, true); assert.equal(samples.first.state.playing, false);
    for (const s of samples.samples) {
      closeTo(s.time, samples.first.time, .000002, 'paused native audio');
      assert.equal(s.state.frames, samples.first.state.frames); assert.equal(s.state.renderedTime, samples.first.state.renderedTime);
    }
    assert.equal(sha(samples.first.png), sha(samples.lastPNG));
  });
  await control('keyboard ArrowRight/ArrowLeft seek exactly +/-3s while paused', async () => {
    await setTime(60); await page.locator('#cinema').focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => !document.getElementById('music').seeking);
    closeTo((await page.evaluate(() => window.__WESTERN2__.state)).time, 63, .000002, 'right arrow');
    await page.keyboard.press('ArrowLeft'); await page.waitForFunction(() => !document.getElementById('music').seeking);
    closeTo((await page.evaluate(() => window.__WESTERN2__.state)).time, 60, .000002, 'left arrow');
  });
  await control('native range keyboard input seeks, rather than only changing the range UI', async () => {
    await setTime(50); await page.locator('#timeline').focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => !document.getElementById('music').seeking);
    const state = await page.evaluate(() => ({state: window.__WESTERN2__.state, value: Number(document.getElementById('timeline').value)}));
    closeTo(state.value, 50.01, .000002, 'range value'); closeTo(state.state.time, state.value, .000002, 'range input drives audio');
  });
  await control('playing auto-hides controls AND pointer; actual pointer motion reveals them', async () => {
    await setTime(20); await page.locator('#toggle').click();
    await page.mouse.move(1000, 300);
    await page.waitForFunction(() => document.getElementById('cinema').classList.contains('controls-hidden') &&
      Number(getComputedStyle(document.getElementById('controls')).opacity) <= .01, null, {timeout: ACTION_MS});
    const hidden = await page.evaluate(() => ({playing: window.__WESTERN2__.state.playing,
      cursor: getComputedStyle(document.getElementById('world')).cursor,
      opacity: Number(getComputedStyle(document.getElementById('controls')).opacity)}));
    assert.equal(hidden.playing, true); assert.equal(hidden.cursor, 'none'); closeTo(hidden.opacity, 0, .01, 'hidden controls');
    await page.mouse.move(1050, 320);
    await page.waitForFunction(() => !document.getElementById('cinema').classList.contains('controls-hidden'));
    await page.evaluate(() => window.__WESTERN2__.pause());
  });
  await control('mute button and M restore native audio state and accessible label', async () => {
    await page.evaluate(() => window.__WESTERN2__.pause());
    const before = await page.locator('#music').evaluate(a => a.muted);
    await page.locator('#mute').click();
    assert.equal(await page.locator('#music').evaluate(a => a.muted), !before);
    assert.equal(await page.locator('#mute').getAttribute('aria-pressed'), String(!before));
    await page.locator('#cinema').focus(); await page.keyboard.press('m');
    assert.equal(await page.locator('#music').evaluate(a => a.muted), before);
    assert.equal(await page.locator('#mute').getAttribute('aria-label'), before ? '开启音乐' : '静音');
  });
  await control('volume native range updates HTMLAudioElement volume', async () => {
    await page.locator('#volume').focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
    closeTo(await page.locator('#music').evaluate(a => a.volume), .05, .00001, 'volume');
    await page.locator('#volume').evaluate(el => { el.value = '0.9'; el.dispatchEvent(new Event('input', {bubbles: true})); });
    closeTo(await page.locator('#music').evaluate(a => a.volume), .9, .00001, 'restored volume');
  });
  await control('about dialog pauses; gentle setting changes state while preserving story action', async () => {
    await setTime(71); await page.locator('#toggle').click();
    await page.waitForFunction(() => window.__WESTERN2__.state.playing);
    await page.locator('#about').click();
    assert.equal(await page.locator('#about-dialog').evaluate(d => d.open), true);
    assert.equal(await page.locator('#music').evaluate(a => a.paused), true);
    await page.locator('#gentle').check();
    assert.equal(await page.evaluate(() => window.__WESTERN2__.state.reduced), true);
    const f = await setTime(72);
    assert.equal(f.info.actorStates.arthur.pose, 'push'); assert.equal(f.info.interaction.pushContact, true);
    await page.locator('#gentle').uncheck(); await page.locator('#close-about').click();
    assert.equal(await page.locator('#about-dialog').evaluate(d => d.open), false);
    assert.equal(await page.evaluate(() => window.__WESTERN2__.state.reduced), false);
  });
  await control('replay control starts from zero with a running native audio clock', async () => {
    await setTime(180); await page.locator('#end-replay').click();
    await page.waitForFunction(() => window.__WESTERN2__.state.playing && document.getElementById('music').currentTime > .05, null, {timeout: ACTION_MS});
    const s = await page.evaluate(() => window.__WESTERN2__.state);
    assert.equal(s.ended, false); assert.ok(s.time >= 0 && s.time < 5, `Replay time=${s.time}`);
    await page.evaluate(() => window.__WESTERN2__.pause());
  });
  await control('stale native ended event after 180 -> 0 -> 0.1 must not terminate replay', async () => {
    await setTime(180);
    const immediate = await page.evaluate(() => {
      const api = window.__WESTERN2__, audio = document.getElementById('music');
      api.seek(0); audio.dispatchEvent(new Event('ended')); const atZero = api.state;
      api.seek(.1); audio.dispatchEvent(new Event('ended')); return [atZero, api.state];
    });
    for (const [i, s] of immediate.entries()) { assert.equal(s.ended, false); closeTo(s.time, i ? .1 : 0, .000002, 'stale event immediate state'); }
    await page.waitForFunction(() => !document.getElementById('music').seeking);
    const f = await page.evaluate(inspectFrame);
    assert.equal(f.state.ended, false); closeTo(f.state.time, .1, .000002, 'stale event recovery');
    assert.equal(f.info.scene, 'valley'); assert.equal(f.info.shot.index, 0);
    await page.locator('#toggle').click(); await page.waitForFunction(() => window.__WESTERN2__.state.playing && document.getElementById('music').currentTime > .2);
    assert.equal(await page.evaluate(() => window.__WESTERN2__.state.ended), false);
    await page.evaluate(() => window.__WESTERN2__.pause());
  });
}

async function smallScreens() {
  try {
    for (const [width, height] of [[390, 844], [844, 390]]) {
      await page.setViewportSize({width, height});
      await check(`small ${width}x${height}: 16:9 fit, all 21 captions and no overflow`, async () => {
        for (const c of story.CAPTIONS) {
          const t = (c.start + c.end) / 2, f = await setTime(t);
          closeTo(f.stage.width / f.stage.height, 16 / 9, .001, 'stage aspect');
          contained(f.stage, {x: 0, y: 0, right: width, bottom: height}, 'stage fits viewport');
          assert.ok(f.viewport.scrollWidth <= width && f.viewport.scrollHeight <= height,
            `Document overflow: ${JSON.stringify(f.viewport)}`);
          validateCaption(f, t);
        }
        await screenshot(`small-${width}x${height}`);
      });
    }
  } finally { await page.setViewportSize({width: 1280, height: 720}); }
}

async function portableCopy() {
  await check('portable folder: only HTML + audio + optional licenses, offline ready and render', async () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'western2-qa-'));
    const folder = join(tempRoot, '西部2 portable 空格'), copyEntry = join(folder, '开始观看.html');
    mkdirSync(join(folder, 'audio'), {recursive: true});
    copyFileSync(entry, copyEntry); copyFileSync(soundtrack, join(folder, 'audio/master.mp3'));
    const expected = ['开始观看.html', 'audio/master.mp3'];
    for (const name of ['FONT-LICENSES.txt', 'THIRD-PARTY-LICENSES.txt']) if (existsSync(join(delivery, name))) {
      copyFileSync(join(delivery, name), join(folder, name)); expected.push(name);
    }
    const tree = at => readdirSync(at, {withFileTypes: true}).flatMap(e => e.isDirectory() ? tree(join(at, e.name)) : [relative(folder, join(at, e.name)).replaceAll('\\', '/')]);
    assert.deepEqual(tree(folder).sort(), expected.sort());
    assert.equal(hashFile(copyEntry), report.artifacts.htmlsha256);
    assert.equal(hashFile(join(folder, 'audio/master.mp3')), report.artifacts.audioSHA);
    const copied = await openFilm(copyEntry, 'portable-copy');
    try {
      const f = await setTime(157, copied); validateFrame(f, 157); validateCaption(f, 157); portraitCheck(f);
      assert.equal(pathKey(fileURLToPath(f.audio.src)), pathKey(join(folder, 'audio/master.mp3')));
      await screenshot('portable-copy-157', copied); await health(copied);
      for (const request of copied.qaSession.requests) {
        assert.ok(!/^https?:/.test(request.url), `Portable folder tried HTTP: ${request.url}`);
        if (request.url.startsWith('file:')) assert.ok(pathKey(fileURLToPath(request.url)).startsWith(pathKey(folder) + '\\'), `Escaped portable folder: ${request.url}`);
      }
      report.portable = {htmlsha256: hashFile(copyEntry), audioSHA: hashFile(join(folder, 'audio/master.mp3')), files: expected, ready: true};
    } finally { const context = copied.context(); await context.close(); contexts.delete(context); }
  });
}

async function realTimePlayback() {
  await check('FULL: native audio at 1x reaches 180s in 180 +/-5s, no seek/clock acceleration', async () => {
    await setTime(0);
    await page.evaluate(() => {
      const api = window.__WESTERN2__, audio = document.getElementById('music');
      const samples = [], events = [], start = {wall: null, time: null};
      const controller = new AbortController(); let finish = null;
      const sample = () => {
        const s = api.state, wall = performance.now();
        if (start.wall !== null) samples.push({wall, time: audio.currentTime, rate: audio.playbackRate,
          paused: audio.paused, readyState: audio.readyState, frames: s.frames, renderedTime: s.renderedTime,
          chapter: s.chapter, scene: s.renderInfo?.scene, shot: s.renderInfo?.shot.index, playing: s.playing, ended: s.ended});
        if (s.ended && finish === null) finish = wall;
      };
      for (const type of ['play', 'playing', 'pause', 'seeking', 'seeked', 'ratechange', 'waiting', 'stalled', 'ended', 'error']) audio.addEventListener(type, () => {
        const wall = performance.now(); events.push({type, wall, time: audio.currentTime, rate: audio.playbackRate});
        if (type === 'playing' && start.wall === null) { start.wall = wall; start.time = audio.currentTime; }
        sample();
      }, {signal: controller.signal});
      const timer = setInterval(sample, 250);
      window.__WESTERN2_QA_CLOCK__ = {finish: () => { sample(); clearInterval(timer); controller.abort(); return {start, finish, samples, events, state: api.state}; }};
    });
    const began = performance.now();
    let trace;
    try {
      await page.locator('#toggle').click();
      // NO screenshots, extra pages, seeking or re-rendering while the soundtrack runs.
      // Wide watchdog for VM chapter rendering; measured elapsed still MUST satisfy +/-5s.
      await page.waitForFunction(() => window.__WESTERN2__.state.ended || window.__WESTERN2__.state.error || window.__WESTERN2_QA_PROBE__.errors.length,
        null, {timeout: 240_000, polling: 250});
    } finally {
      trace = await deadline(page.evaluate(() => window.__WESTERN2_QA_CLOCK__.finish()), RENDER_MS, 'collect native clock trace');
      report.fullPlayback = {...trace, hostElapsedMs: Math.round(performance.now() - began)};
      await page.evaluate(() => window.__WESTERN2__.pause());
      flush();
    }
    await health();
    assert.equal(trace.state.error, ''); assert.equal(trace.state.ended, true); assert.equal(trace.state.playing, false);
    closeTo(trace.state.time, 180, .000002, 'final state'); closeTo(trace.state.renderedTime, 180, .000002, 'final render');
    assert.equal(trace.state.renderInfo.shot.index, 23); assert.equal(trace.state.chapter, 'coda');
    assert.ok(trace.start.wall !== null && trace.finish !== null && trace.samples.length > 0, 'Missing native-clock evidence');
    closeTo(trace.start.time, 0, .1, 'full playback starts at zero');
    closeTo((trace.finish - trace.start.wall) / 1000, 180, 5, 'native wall elapsed');
    closeTo(trace.state.elapsedMs / 1000, 180, 5, 'player wall elapsed');
    assert.ok(trace.state.frames > 0, 'Real render frames must be recorded, without a hard 60fps requirement');
    assert.deepEqual(trace.events.filter(e => ['seeking', 'seeked', 'ratechange', 'error'].includes(e.type)), [], 'Unexpected clock mutation during full playback');
    assert.deepEqual(trace.events.filter(e => e.type === 'pause' && e.time < 179.95), [], 'Audio must not pause inside the full run');
    let previous = 0, maxClockDrift = 0;
    for (const s of trace.samples) {
      assert.equal(s.rate, 1); assert.ok(s.time >= previous - .000002, `Clock went backwards: ${previous} -> ${s.time}`);
      const drift = Math.abs((s.wall - trace.start.wall) / 1000 - (s.time - trace.start.time));
      maxClockDrift = Math.max(maxClockDrift, drift); previous = s.time;
    }
    assert.ok(maxClockDrift <= 5, `Audio clock stalled/accelerated relative to wall time: ${maxClockDrift}s`);
    assert.deepEqual([...new Set(trace.samples.map(s => s.chapter))], story.CHAPTERS.map(c => c.id), 'All seven chapter checkpoints must be observed');
    assert.deepEqual([...new Set(trace.samples.map(s => s.scene))], [...new Set(story.SHOTS.map(s => s.scene))], 'All seven scenes must really render during native playback');
    report.fullPlayback.maxClockDriftSeconds = maxClockDrift;
    report.fullPlayback.observedFPS = trace.state.frames / (trace.state.elapsedMs / 1000);
    await screenshot('full-native-ended-180');
  });
}

async function finalDiagnostics() {
  if (!page || page.isClosed()) return;
  try {
    report.finalState = await deadline(page.evaluate(() => ({state: window.__WESTERN2__?.state,
      status: document.getElementById('status')?.textContent, errors: window.__WESTERN2_QA_PROBE__?.errors})), 8_000, 'final state');
  } catch (error) { report.diagnostics.push({kind: 'unavailable-final-state', ...errorInfo(error)}); }
  if (!quick && report.checks.some(c => c.result === 'FAIL')) {
    try { await page.evaluate(() => window.__WESTERN2__?.pause()); await screenshot('FAIL-last-frame'); }
    catch (error) { report.diagnostics.push({kind: 'unavailable-failure-screenshot', ...errorInfo(error)}); }
  }
}

mkdirSync(out, {recursive: true});
try {
  await check('arguments (no build/capture/unknown switches)', () => {
    for (const arg of args) assert.ok(allowedArgs.has(arg), `Unknown option ${arg}; allowed: ${[...allowedArgs].join(' ')}`);
    assert.ok(!(quick && full), '--quick and --full are mutually exclusive');
  }, true);
  // Dynamic import is intentional: reject --capture BEFORE its module-level CLI handler.
  ({verifyOriginal} = await import('./protect-original.mjs'));
  await check('verifyOriginal BEFORE all delivery tests (read-only)', () => { report.originalBefore = verifyOriginal(); }, true);
  await check('built artifact, story/source windows and soundtrack identity', () => {
    assert.ok(existsSync(entry), `Build the NEW film first; missing ${entry}`);
    assert.ok(existsSync(soundtrack), `Missing ${soundtrack}`);
    const html = readFileSync(entry, 'utf8');
    report.artifacts = {htmlsha256: sha(html), audioSHA: hashFile(soundtrack), mastersha256: hashFile(soundtrack),
      storysha256: hashFile(join(dir, 'story.mjs')), htmlBytes: Buffer.byteLength(html), audioBytes: readFileSync(soundtrack).length,
      source: Object.fromEntries(['player.mjs', 'world.mjs', 'actors.mjs', 'environment.mjs', 'postfx.mjs'].map(n => [n, hashFile(join(dir, n))]))};
    assert.ok(!html.includes('/*__'), 'Unexpanded build placeholders');
    assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html), 'Runtime JS must be inline');
    assert.ok(!/<link\b(?=[^>]*\brel=["']stylesheet)[^>]*\bhref=["'](?!data:)/i.test(html), 'Styles must be local/inline');
    const match = html.match(/<script\b[^>]*\bid=["']film-data["'][^>]*>([\s\S]*?)<\/script>/i);
    assert.ok(match, 'Missing embedded film-data');
    const data = JSON.parse(match[1]);
    assert.equal(data.duration, 180); assert.equal(data.chapters.length, 7); assert.equal(data.shots.length, 24); assert.equal(data.captions.length, 21);
    for (const [key, expected] of [['chapters', story.CHAPTERS], ['shots', story.SHOTS], ['captions', story.CAPTIONS], ['sources', story.SOURCES], ['cues', story.CUES]]) assert.deepEqual(data[key], expected, `Built ${key} differs from source`);
    assert.deepEqual(story.CHAPTERS.map(c => [c.id, c.start, c.end]), [['dust', 0, 21], ['promise', 21, 51], ['burden', 51, 84], ['fraying', 84, 114], ['choice', 114, 144], ['silence', 144, 168], ['coda', 168, 180]]);
    for (const list of [story.CHAPTERS, story.SHOTS]) {
      assert.equal(list[0].start, 0); assert.equal(list.at(-1).end, 180);
      for (let i = 0; i < list.length; i++) { assert.ok(list[i].end > list[i].start); if (i) assert.equal(list[i - 1].end, list[i].start); }
    }
    assert.equal(new Set(story.SHOTS.map(s => s.scene)).size, 7);
    const official = new Set(['https://www.playstation.com/en-us/games/red-dead-redemption-2/', 'https://blog.playstation.com/2018/08/09/watch-the-red-dead-redemption-2-official-gameplay-video/']);
    for (const source of Object.values(story.SOURCES)) { assert.ok(official.has(source.url), `Unrecognized official source ${source.url}`); assert.ok(source.label.trim()); }
    for (let i = 0; i < story.CAPTIONS.length; i++) {
      const c = story.CAPTIONS[i];
      assert.ok(c.start >= 0 && c.end > c.start && c.end <= 180 && c.text.trim() && c.speaker.trim());
      assert.ok(['fact', 'creative', 'dialogue'].includes(c.kind));
      if (i) assert.ok(c.start >= story.CAPTIONS[i - 1].end, `Caption overlap ${i + 1}`);
      if (c.kind === 'fact') assert.ok(story.SOURCES[c.source], `Missing fact source for ${c.text}`);
      if (c.kind === 'dialogue') assert.equal(c.source, undefined, 'Original dialogue must not masquerade as a sourced quotation');
    }
    assert.deepEqual(story.CAPTIONS.filter(c => c.kind === 'fact').map(c => [c.source, c.text]), [
      ['overview', '1899 年。西部亡命徒的时代，正在走向终结。'], ['overview', '这个帮派，是养大亚瑟·摩根的家。'],
    ]);
    assert.match(data.notes, /全部对白/); assert.match(data.notes, /不是游戏原台词/);
    const music = JSON.parse(readFileSync(join(dir, 'audio/report.json'), 'utf8'));
    assert.equal(music.validation.passed, true); assert.equal(music.mastersha256, report.artifacts.audioSHA);
    assert.equal(music.storysha256, report.artifacts.storysha256);
    assert.equal(hashFile(join(dir, 'audio/master.mp3')), report.artifacts.audioSHA);
    report.authoredData = {duration: 180, chapters: 7, shots: 24, captions: 21, sources: story.SOURCES};
  }, true);
  await check('launch a NEW owned Chrome/Edge browser, offline isolated context', async () => {
    const require = createRequire(new URL('../web/package.json', import.meta.url));
    const {chromium} = require('playwright');
    browser = await chromium.launch({channel, headless: !args.has('--headed'), timeout: READY_MS});
    report.browserVersion = browser.version();
  }, true);
  await check('delivery ready <=60s, status/error captured', async () => { page = await openFilm(entry, 'delivery'); }, true);
  await check('runtime API contract and local audio path', async () => {
    const value = await page.evaluate(() => {
      const api = window.__WESTERN2__, audio = document.getElementById('music');
      return {ready: api.ready, data: api.data, captions: api.captions, chapters: api.chapters, shots: api.shots,
        methods: Object.fromEntries(['render', 'seek', 'play', 'pause', 'replay', 'info', 'snapshot'].map(k => [k, typeof api[k]])),
        state: api.state, rawSrc: audio.getAttribute('src'), src: audio.currentSrc,
        resourceURLs: [...document.querySelectorAll('script[src],link[rel="stylesheet"],img[src],video[src],iframe[src]')].map(e => e.src || e.href)};
    });
    assert.equal(value.ready, true);
    assert.deepEqual(value.captions, story.CAPTIONS); assert.deepEqual(value.chapters, story.CHAPTERS); assert.deepEqual(value.shots, story.SHOTS);
    assert.deepEqual(value.data.sources, story.SOURCES);
    for (const type of Object.values(value.methods)) assert.equal(type, 'function');
    assert.ok(value.state.renderInfo); assert.equal(value.state.started, false); assert.equal(value.state.playing, false);
    assert.equal(value.rawSrc, 'audio/master.mp3'); assert.equal(pathKey(fileURLToPath(value.src)), pathKey(soundtrack));
    assert.deepEqual(value.resourceURLs, [], 'No old image/video/iframe/runtime module fallback');
  });
  await check('poster screenshot (paused)', async () => { assert.equal(await page.locator('#music').evaluate(a => a.paused), true); await screenshot('poster'); });
  if (!quick) await fullscreenFromPoster();
  await screenshotShots();
  if (quick) {
    report.skipped.push('Exhaustive cue/shot/chapter boundaries', 'Full action/contact progression', 'Native fullscreen/control suite',
      'Small-screen every-cue fit', 'Portable copy/reload and second atlas build', 'Native 180-second playback (requires --full)');
  } else {
    await exhaustiveTimeline(); await interactions(); await deterministicPixels(); await controls(); await smallScreens();
    await check('actual uploaded pixel atlases are independently painted, binary-alpha and not old images', async () => {
      const evidence = await page.evaluate(() => window.__WESTERN2_QA_PROBE__.atlasEvidence());
      report.atlasEvidence = evidence;
      const portraits = evidence.filter(e => e.width === 1536 && e.height === 2464);
      const people = evidence.filter(e => e.width === 768 && e.height === 1408);
      assert.equal(portraits.length, 2, 'Both principal portrait atlases must really upload');
      assert.ok(people.length >= 2, 'Principal body atlases must really upload');
      assert.equal(new Set(portraits.map(e => e.pixelSha256)).size, 2, 'Arthur and Dutch cannot share identical portrait art');
      for (const e of [...portraits, ...people]) {
        assert.ok(e.putImageData >= 88 && e.opaque > 0, JSON.stringify(e));
        assert.equal(e.imageDerived, false, 'Atlas was derived from an image instead of original pixel data');
        assert.equal(e.translucent, 0, 'Pixel actor source should have binary alpha, not scaled image fringes');
      }
    });
    await portableCopy();
    if (full) await realTimePlayback(); else report.skipped.push('Native 180-second playback (requires --full)');
  }
  await check('offline sessions: zero HTTP attempts, zero request failures, zero page/console errors', async () => {
    await health();
    for (const session of report.sessions) {
      assert.deepEqual(session.requests.filter(r => /^https?:\/\//i.test(r.url)), [], `${session.label} attempted network`);
      assert.deepEqual(session.failures, [], `${session.label} network/file errors`);
      assert.deepEqual(session.errors, [], `${session.label} script/console errors`);
    }
  });
} catch (error) {
  if (!error.qaRecorded) report.checks.push({name: 'uncaught test/setup failure', result: 'FAIL', error: errorInfo(error), frame: latestFrame, screenshot: latestImage});
} finally {
  try { await finalDiagnostics(); } catch (error) { report.diagnostics.push(errorInfo(error)); }
  for (const context of contexts) {
    try { await context.close(); } catch (error) { report.checks.push({name: 'owned context cleanup', result: 'FAIL', error: errorInfo(error)}); }
  }
  // This browser was launched above, never borrowed from the user's shared browser.
  if (browser) { try { await browser.close(); } catch (error) { report.checks.push({name: 'owned browser cleanup', result: 'FAIL', error: errorInfo(error)}); } }
  if (tempRoot) { try { rmSync(tempRoot, {recursive: true, force: true}); } catch (error) { report.checks.push({name: 'owned portable temp cleanup', result: 'FAIL', error: errorInfo(error)}); } }
  for (const session of report.sessions) if (session.errors.length || session.failures.length || session.requests.some(r => /^https?:\/\//i.test(r.url))) {
    report.checks.push({name: `${session.label}: final asynchronous error/network audit`, result: 'FAIL',
      errors: session.errors, failures: session.failures, network: session.requests.filter(r => /^https?:\/\//i.test(r.url))});
  }
  if (report.artifacts) await check('final HTML/audio SHA and source hashes unchanged during QA', () => {
    report.finalArtifacts = {htmlsha256: hashFile(entry), audioSHA: hashFile(soundtrack)};
    assert.equal(report.finalArtifacts.htmlsha256, report.artifacts.htmlsha256, 'Build changed during QA; rerun against a stable delivery');
    assert.equal(report.finalArtifacts.audioSHA, report.artifacts.audioSHA);
    assert.equal(hashFile(join(dir, 'story.mjs')), report.artifacts.storysha256);
    for (const [name, digest] of Object.entries(report.artifacts.source)) assert.equal(hashFile(join(dir, name)), digest, `${name} changed during QA`);
  });
  if (verifyOriginal) await check('verifyOriginal AFTER all tests, including failures (read-only)', () => {
    report.originalAfter = verifyOriginal();
    if (report.originalBefore) assert.equal(report.originalAfter.protectedFiles, report.originalBefore.protectedFiles);
  });
  report.result = report.checks.some(c => c.result === 'FAIL') ? 'FAIL' : 'PASS';
  report.finishedAt = new Date().toISOString();
  report.counts = {passed: report.checks.filter(c => c.result === 'PASS').length, failed: report.checks.filter(c => c.result === 'FAIL').length};
  flush();
  writeFileSync(join(qaRoot, `report-${channel}-${mode}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({result: report.result, mode, ...report.counts, report: rel(join(out, 'report.json')),
    htmlsha256: report.finalArtifacts?.htmlsha256 ?? report.artifacts?.htmlsha256,
    audioSHA: report.finalArtifacts?.audioSHA ?? report.artifacts?.audioSHA,
    aestheticApproval: false, humanListeningPerformed: false}, null, 2));
  if (report.result === 'FAIL') process.exitCode = 1;
}