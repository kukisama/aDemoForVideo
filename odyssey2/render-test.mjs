/** Standalone, read-only browser QA. No HTML/build/asset files are written.
 * node odyssey2/render-test.mjs [--balanced] [--full-size] [--software-gpu]
 * A missing parallel sprites module permits import-only verification, not a
 * substitute character implementation and NOT a claim of GPU scene validation.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '../web/node_modules/playwright/index.mjs';
import { EVENTS, STAGES, DURATION, sample } from './timeline.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const threeRoot = path.resolve(root, '../web/node_modules/three');
const balanced = process.argv.includes('--balanced');
const fullSize = process.argv.includes('--full-size');
const softwareGPU = process.argv.includes('--software-gpu');
const width = fullSize ? 1280 : 640, height = fullSize ? 720 : 360;
const timelineBefore = await readFile(path.join(root, 'timeline.mjs'));
let hasSprites = true;
try { await access(path.join(root, 'sprites.mjs')); } catch { hasSprites = false; }

const pageHTML = `<!doctype html><meta charset="utf-8"><title>HD2D isolated GPU QA</title>
<script type="importmap">${JSON.stringify({ imports: {
  three: '/three/build/three.module.js', 'three/addons/': '/three/examples/jsm/',
} })}</script><canvas id="film" width="${width}" height="${height}"></canvas>
<script type="module">
  try {window.sceneModule=await import('/scene.mjs');window.moduleReady=true;}
  catch(error){window.moduleError=error.stack||error.message;}
</script>`;
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(pageHTML); return;
    }
    if (url.pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    if (!hasSprites && url.pathname === '/sprites.mjs') {
      // Only make the dependency export resolvable. It cannot draw a sprite or
      // run the scene, and does not create/modify the other agent's file.
      response.writeHead(200, { 'content-type': 'text/javascript' });
      response.end('export function createFighterSprite(){throw new Error("Parallel sprites.mjs not yet present; import-only QA");}');
      return;
    }
    let file;
    if (['/scene.mjs', '/sprites.mjs', '/timeline.mjs'].includes(url.pathname)) file = path.join(root, url.pathname.slice(1));
    else if (url.pathname.startsWith('/three/')) {
      file = path.resolve(threeRoot, decodeURIComponent(url.pathname.slice(7)));
      if (!file.startsWith(threeRoot + path.sep)) throw new Error('Invalid module path');
    } else { response.writeHead(404); response.end(); return; }
    const bytes = await readFile(file);
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }); response.end(bytes);
  } catch (error) { response.writeHead(500); response.end(error.message); }
});
let browser;
const errors = [], rows = [];
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = `http://127.0.0.1:${server.address().port}`;
  const args = ['--no-sandbox'];
  if (softwareGPU) args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  console.error(`[HD2D QA] Starting isolated Chrome, ${width}x${height}, ${balanced ? 'balanced' : 'cinematic'}`);
  browser = await chromium.launch({ channel: 'chrome', headless: true, args });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', route => route.request().url().startsWith(address) || route.request().url().startsWith('data:') ? route.continue() : route.abort());
  await page.goto(address, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.moduleReady || window.moduleError, null, { timeout: 60000 });
  const imported = await page.evaluate(() => ({ ok: window.moduleReady, error: window.moduleError, factory: typeof window.sceneModule?.createHD2DScene }));
  assert.equal(imported.error, undefined, imported.error);
  assert.equal(imported.factory, 'function');
  console.error('[HD2D QA] ES modules imported');
  if (!hasSprites) {
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ status: 'IMPORT_ONLY_PASS', modules: 'scene + timeline + installed Three addons', gpuSceneTest: 'NOT RUN: parallel sprites.mjs absent', noReplacementSpritesCreated: true, serverCleanup: 'finally' }, null, 2));
  } else {
    await page.evaluate(async options => {
      window.hd2d = await window.sceneModule.createHD2DScene(document.querySelector('canvas'), options);
      window.pixelSignature = () => {
        const film = document.querySelector('canvas'), c = document.createElement('canvas');
        c.width = film.width; c.height = film.height;
        const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(film, 0, 0);
        const bytes = ctx.getImageData(0, 0, c.width, c.height).data;
        let hash = 2166136261, luminance = 0, nonBlack = 0, clipped = 0, edge = 0;
        for (let i = 0; i < bytes.length; i += 4) {
          hash = Math.imul(hash ^ bytes[i], 16777619); hash = Math.imul(hash ^ bytes[i + 1], 16777619); hash = Math.imul(hash ^ bytes[i + 2], 16777619);
          const l = .2126 * bytes[i] + .7152 * bytes[i + 1] + .0722 * bytes[i + 2];
          luminance += l; if (l > 8) nonBlack++; if (bytes[i] > 250 && bytes[i + 1] > 250 && bytes[i + 2] > 250) clipped++;
          if (i % (c.width * 4) > 0) edge += Math.abs(bytes[i] - bytes[i - 4]);
        }
        const count = bytes.length / 4;
        return { hash: (hash >>> 0).toString(16), mean: luminance / count, nonBlack: nonBlack / count, clipped: clipped / count, edge: edge / count };
      };
    }, { width, height, quality: balanced ? 'balanced' : 'cinematic' });
    console.error('[HD2D QA] Scene created; beginning real framebuffer checks');
    async function frame(t, flags = {}) {
      console.error(`[HD2D QA] draw(${t})${flags.poster ? ' poster' : flags.reduced ? ' reduced' : ''}`);
      const result = await page.evaluate(({ t, flags }) => {
        const info = window.hd2d.draw(t, flags);
        return { info, pixels: window.pixelSignature() };
      }, { t, flags });
      assert.equal(result.info.render.webgl, true);
      assert.equal(result.info.render.shaderErrors.length, 0);
      assert.ok(result.info.render.drawCalls > 0);
      assert.ok(result.info.render.triangles > 10000, `Not a 3D hall: ${result.info.render.triangles}`);
      assert.ok(result.info.camera.focus.distance > 0);
      assert.ok(Math.abs(result.info.camera.yaw) <= Math.PI / 10 + 1e-7);
      assert.ok(result.info.effects.screenFlashAlpha <= .09);
      assert.ok(result.info.effects.particleCount <= 1500);
      assert.ok(result.pixels.nonBlack > .45, `Unexpected black frame: ${JSON.stringify(result.pixels)}`);
      assert.ok(result.pixels.clipped < .1, `Overexposed frame: ${JSON.stringify(result.pixels)}`);
      rows.push({ t, stage: result.info.stage.id, renderer: result.info.render.renderer, calls: result.info.render.drawCalls, triangles: result.info.render.triangles,
        focus: result.info.camera.focus.distance, particles: result.info.effects.particleCount, afterimages: result.info.effects.afterimages, pixels: result.pixels });
      return result;
    }
    const first = await frame(0);
    assert.deepEqual(first.info.camera.position, [-2, 1.65, 5]);
    for (const stage of STAGES) {
      const t = (stage.start + stage.end) / 2;
      const result = await frame(t), expected = sample(t);
      assert.equal(result.info.stage.id, stage.id);
      assert.ok(Math.abs(result.info.hero.x - expected.hero.x) < 1e-7);
      assert.ok(Math.abs(result.info.hero.y - expected.hero.y) < 1e-7);
      assert.equal(result.info.hero.frame, Math.floor(t * 24 + 1e-7));
    }
    for (const event of EVENTS) {
      const result = await frame(event.time + .07);
      assert.ok(result.info.effects.active.includes(event.id), `Missing event ${event.id}`);
    }
    const last = await frame(DURATION);
    assert.ok(last.pixels.mean > 15, `Ending disappeared: ${last.pixels.mean}`);
    const replayA = await frame(16.91);
    await frame(3.14); await frame(29.81);
    const replayB = await frame(16.91);
    assert.equal(replayA.pixels.hash, replayB.pixels.hash, 'Random access rendering is not deterministic');
    assert.deepEqual(replayA.info.hero, replayB.info.hero);
    assert.deepEqual(replayA.info.objectCounts, replayB.info.objectCounts, 'GPU/object counts grew after seek');
    const reduced = await frame(16.91, { reduced: true });
    assert.equal(reduced.info.effects.afterimages, 0);
    assert.equal(reduced.info.effects.screenFlashAlpha, 0);
    assert.ok(reduced.info.effects.particleCount < replayA.info.effects.particleCount);
    const poster = await frame(0, { poster: true });
    assert.equal(poster.info.t, 15.9);
    const poster2 = await frame(30, { poster: true });
    assert.equal(poster.pixels.hash, poster2.pixels.hash);
    const inspectOnly = await page.evaluate(() => {
      const before = window.pixelSignature().hash;
      const inspected = window.hd2d.inspect(7.5);
      return { before, after: window.pixelSignature().hash, inspected };
    });
    assert.equal(inspectOnly.before, inspectOnly.after, 'inspect() rendered/mutated visible scene');
    assert.equal(inspectOnly.inspected.stage.id, 'counter');
    await page.evaluate(() => window.hd2d.resize(800, 450));
    const resized = await frame(8.93);
    assert.equal(resized.info.render.width, 800); assert.equal(resized.info.render.height, 450);
    const snapshot = await page.evaluate(() => window.hd2d.snapshot().slice(0, 30));
    assert.ok(snapshot.startsWith('data:image/png;base64,'));
    const lifecycle = await page.evaluate(() => {
      window.hd2d.dispose(); window.hd2d.dispose();
      try { window.hd2d.draw(0); return false; } catch (error) { return /dispose/.test(error.message); }
    });
    assert.equal(lifecycle, true);
    console.error('[HD2D QA] Frames passed; checking missing WebGL and context loss');
    const failurePaths = await page.evaluate(async () => {
      let missingWebGL = false;
      try { await window.sceneModule.createHD2DScene({ getContext: () => null }); }
      catch (error) { missingWebGL = /WebGL2/.test(error.message); }
      const canvas = document.createElement('canvas');
      let callback;
      const loss = new Promise(resolve => { callback = resolve; });
      const instance = await window.sceneModule.createHD2DScene(canvas, { width: 320, height: 180, onContextLost: callback });
      const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
      if (!extension) { instance.dispose(); return { missingWebGL, contextLost: 'extension unavailable' }; }
      let timeout;
      try {
        extension.loseContext();
        await Promise.race([loss, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('contextlost handler did not fire')), 5000); })]);
        const inspected = instance.inspect(0);
        let rejected = false;
        try { instance.draw(0); } catch (error) { rejected = /上下文已丢失/.test(error.message); }
        return { missingWebGL, contextLost: rejected && inspected.render.disposed && inspected.render.contextLost };
      } finally { clearTimeout(timeout); instance.dispose(); }
    });
    assert.equal(failurePaths.missingWebGL, true);
    assert.equal(failurePaths.contextLost, true);
    assert.deepEqual(errors, [], JSON.stringify(errors));
    console.log(JSON.stringify({ status: 'GPU_RENDER_PASS', frames: rows.length, stages: STAGES.length, events: EVENTS.length, width, height,
      quality: balanced ? 'balanced' : 'cinematic', deterministicSeek: true, stableObjects: true, reducedMotion: true, poster: true, resize: true, disposal: true,
      failurePaths, integrationWarnings: last.info.integrationWarnings, performanceClaim: 'NONE: draw submission time is not GPU FPS', rows }, null, 2));
  }
} catch (error) {
  console.error('[HD2D QA] Failure before cleanup:', error.stack ?? error.message);
  throw error;
} finally {
  console.error('[HD2D QA] Closing owned browser and ephemeral HTTP server');
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  assert.deepEqual(await readFile(path.join(root, 'timeline.mjs')), timelineBefore, 'Timeline changed during read-only render QA');
  console.error('[HD2D QA] Cleanup complete; timeline unchanged');
}