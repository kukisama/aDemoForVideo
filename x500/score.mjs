/**
 * X500 / CLOSE TO POSSIBILITY — original, unofficial editorial soundtrack
 * for the real, released standard vivo X500; official sources live in story.mjs.
 * node <absolute path>/x500/score.mjs [--force-voice | --verify | --voices-only]
 * Writes ONLY beside this file in audio/. Requires installed edge-tts, FFmpeg,
 * and ../web/node_modules/ffprobe-static; no imported legacy score/timeline.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, mkdtempSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DURATION, BPM, BEAT, CHAPTERS, VOICE_CUES, DISCLAIMER, SOURCES, FACTS } from './story.mjs';

export const AUDIO_DIR = fileURLToPath(new URL('./audio/', import.meta.url));
const require = createRequire(new URL('../web/package.json', import.meta.url));
const SR = 48_000, FRAMES = SR * DURATION, TAU = Math.PI * 2;
const VOICE = 'zh-CN-YunxiNeural', PITCH = '-2Hz', SEED = 0x58353030;
const TITLE = 'vivo X500 Standard - Close to Possibility (Unofficial Editorial)';
const PRODUCT_CLAIMS = 'Unofficial editorial presentation of the real, released standard vivo X500. ' +
  'Product specifications and suggested retail price are sourced from official vivo URLs in story.mjs SOURCES and FACTS. ' +
  'Not an official vivo advertisement or endorsement.';
const PROXY_KEYS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy'];
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const db = x => 20 * Math.log10(Math.max(1e-12, x));
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const round = x => Math.round(x * 1e6) / 1e6;
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const canonical = text => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const chineseChars = text => [...text.matchAll(/\p{Script=Han}/gu)].length;
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
function redact(message) {
  let text = String(message);
  for (const key of PROXY_KEYS) if (process.env[key]) text = text.split(process.env[key]).join('[proxy]');
  return text.replace(/(?:https?|socks\w*):\/\/[^\s"'<>]+/gi, '[network endpoint]');
}
function run(exe, args, { binary = false, timeout = 180_000 } = {}) {
  const r = spawnSync(exe, args, { encoding: binary ? null : 'utf8', windowsHide: true,
    maxBuffer: 128 * 1024 * 1024, timeout, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (r.error || r.status !== 0) throw new Error(redact(`${r.error?.message ?? `Exit ${r.status}`}: ${String(r.stderr).slice(-2200)}`));
  return r;
}
export function getTools() {
  const ffmpeg = execFileSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],
    { encoding: 'utf8', windowsHide: true }).trim();
  const ffprobe = require('ffprobe-static').path;
  assert(existsSync(ffmpeg) && existsSync(ffprobe), 'Installed FFmpeg/ffprobe missing.');
  return { ffmpeg, ffprobe };
}
const ff = (tools, args) => run(tools.ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-y', ...args]);
export function probe(tools, path) {
  const p = JSON.parse(run(tools.ffprobe, ['-v', 'error', '-select_streams', 'a:0', '-show_entries',
    'stream=codec_name,sample_rate,channels,bit_rate,duration:format=duration,size', '-of', 'json', path]).stdout);
  assert(p.streams?.length === 1, `Missing audio: ${basename(path)}`);
  return { ...p.streams[0], duration: Number(p.format.duration), bytes: Number(p.format.size) };
}
function pcm(tools, path, channels = 1) {
  const data = run(tools.ffmpeg, ['-v', 'error', '-nostdin', '-i', path, '-ac', String(channels), '-ar', String(SR),
    '-f', 'f32le', '-c:a', 'pcm_f32le', '-'], { binary: true }).stdout;
  return new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}
function wave(path, left, right) {
  const channels = right ? 2 : 1, frames = left.length, align = channels * 4;
  const data = Buffer.alloc(44 + frames * align);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(3, 20); data.writeUInt16LE(channels, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * align, 28); data.writeUInt16LE(align, 32);
  data.writeUInt16LE(32, 34); data.write('data', 36); data.writeUInt32LE(frames * align, 40);
  for (let i = 0; i < frames; i++) {
    data.writeFloatLE(left[i], 44 + i * align);
    if (right) data.writeFloatLE(right[i], 48 + i * align);
  }
  writeFileSync(path, data);
}
function stats(samples, channels = 1, start = 0, end = samples.length / channels / SR) {
  let peak = 0, energy = 0, clipped = 0, nonfinite = 0, cross = 0, el = 0, er = 0, side = 0;
  const begin = Math.max(0, Math.round(start * SR) * channels), finish = Math.min(samples.length, Math.round(end * SR) * channels);
  for (let i = begin; i < finish; i++) {
    const v = samples[i]; peak = Math.max(peak, Math.abs(v)); energy += v * v;
    if (Math.abs(v) >= 1) clipped++;
    if (!Number.isFinite(v)) nonfinite++;
    if (channels === 2 && i % 2 === 0) { const r = samples[i + 1]; cross += v * r; el += v * v; er += r * r; side += (v - r) ** 2; }
  }
  return { peakDbFS: db(peak), rmsDbFS: db(Math.sqrt(energy / Math.max(1, finish - begin))), clipped, nonfinite,
    ...(channels === 2 ? { correlation: cross / Math.sqrt(el * er), sideRmsDbFS: db(Math.sqrt(side / ((finish - begin) / 2)) / 2) } : {}) };
}
function loudness(tools, path, target = -15.5, peak = -2.0) {
  const r = run(tools.ffmpeg, ['-hide_banner', '-nostdin', '-i', path, '-af',
    `loudnorm=I=${target}:TP=${peak}:LRA=9:print_format=json`, '-f', 'null', '-']);
  const match = r.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  assert(match, 'No EBU R128 measurement.');
  const m = JSON.parse(match[0]); assert(Number.isFinite(Number(m.input_i)), 'Silent audio.'); return m;
}
function normalize(tools, source, dest, target, peak, stereo = true) {
  const m = loudness(tools, source, target, peak);
  ff(tools, ['-i', source, '-af', `loudnorm=I=${target}:TP=${peak}:LRA=9:measured_I=${m.input_i}:` +
    `measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:` +
    `offset=${m.target_offset}:linear=true,aresample=${SR}`, '-ac', stereo ? '2' : '1', '-ar', String(SR), '-c:a', 'pcm_f32le', dest]);
}

function parseSrt(text) {
  const timestamp = value => { const [h, m, s] = value.replace(',', '.').split(':').map(Number); return h * 3600 + m * 60 + s; };
  return text.trim().split(/\r?\n\s*\r?\n/).map(block => {
    const lines = block.split(/\r?\n/), timing = lines.findIndex(line => line.includes(' --> '));
    assert(timing >= 0, 'Invalid service SRT.');
    const [start, end] = lines[timing].split(' --> ').map(timestamp);
    return { start, end, text: lines.slice(timing + 1).join(' ').replaceAll('&amp;', '&').replaceAll('&quot;', '"') };
  });
}
// The installed CLI has no --boundary switch. Use its ACTUAL module/argument
// parser and --write-subtitles implementation, supplying WordBoundary to the
// original Communicate constructor. No fabricated/aligned-by-length timings.
const WORD_BOUNDARY_CLI = `import functools, runpy, edge_tts.util
edge_tts.util.Communicate = functools.partial(edge_tts.util.Communicate, boundary='WordBoundary')
runpy.run_module('edge_tts', run_name='__main__')`;
function synthesize(cue, rate, force) {
  const stem = `${cue.file.replace('.mp3', '')}-raw-r${rate}`;
  const source = join(AUDIO_DIR, stem + '.mp3'), srt = join(AUDIO_DIR, stem + '.srt'), meta = join(AUDIO_DIR, stem + '.json');
  if (!force && existsSync(source) && existsSync(srt) && existsSync(meta)) {
    const old = JSON.parse(readFileSync(meta, 'utf8'));
    if (old.text === cue.text && old.voice === VOICE && old.rate === rate && old.pitch === PITCH && old.sha256 === sha(source) && old.srtSha256 === sha(srt))
      return { source, srt, rate, reused: true };
  }
  const proxy = PROXY_KEYS.map(key => process.env[key]).find(Boolean);
  const routes = proxy ? [undefined, proxy] : [undefined, undefined];
  let last;
  for (const [attempt, route] of routes.entries()) {
    try {
      console.log(`TTS ${cue.file}: ${VOICE}, +${rate}%, ${PITCH}; attempt ${attempt + 1}/${routes.length}`);
      run('python', ['-c', WORD_BOUNDARY_CLI, '--voice', VOICE, `--rate=+${rate}%`, `--pitch=${PITCH}`, '--text', cue.text,
        '--write-media', source, '--write-subtitles', srt, ...(route ? ['--proxy', route] : [])], { timeout: 85_000 });
      const boundaries = parseSrt(readFileSync(srt, 'utf8'));
      assert(boundaries.length > 0 && readFileSync(source).length > 1000, 'Empty TTS audio/subtitles.');
      assert(canonical(boundaries.map(w => w.text).join('')) === canonical(cue.text), `Incomplete service transcript: ${cue.file}`);
      json(meta, { text: cue.text, voice: VOICE, generic: true, impersonation: false, rate, pitch: PITCH,
        boundary: 'WordBoundary', sha256: sha(source), srtSha256: sha(srt) });
      return { source, srt, rate, reused: false };
    } catch (e) { last = e; console.warn(redact(e.message)); }
  }
  throw new Error(`TTS unavailable for ${cue.file}; no invented/offline substitute. ${redact(last?.message)}`);
}

function trimSilence(tools, source, words, dest) {
  const samples = pcm(tools, source), duration = samples.length / SR;
  const r = run(tools.ffmpeg, ['-hide_banner', '-nostdin', '-i', source, '-af', 'silencedetect=noise=-48dB:d=0.10', '-f', 'null', '-']);
  const detected = [];
  let begin = null;
  for (const match of r.stderr.matchAll(/silence_(start|end):\s*([\d.]+)/g)) {
    if (match[1] === 'start') begin = Number(match[2]);
    else if (begin !== null) { detected.push([begin, Number(match[2])]); begin = null; }
  }
  if (begin !== null) detected.push([begin, duration]);
  // Remove ONLY measured silence, never a protected service word or its 30ms guard.
  const protectedWords = words.map(w => [Math.max(0, w.start - 0.03), Math.min(duration, w.end + 0.03)]);
  const cuts = [];
  for (const [a, b] of detected) {
    let intervals = [[Math.max(0, a), Math.min(duration, b)]];
    for (const [ws, we] of protectedWords) intervals = intervals.flatMap(([s, e]) => {
      if (we <= s || ws >= e) return [[s, e]];
      return [...(ws > s ? [[s, ws]] : []), ...(we < e ? [[we, e]] : [])];
    });
    for (const [s, e] of intervals) {
      const head = s < 0.005, tail = e > duration - 0.005;
      if (head && e - s > 0.035) cuts.push([s, e - 0.03]);
      else if (tail && e - s > 0.055) cuts.push([s + 0.05, e]);
      else if (e - s > 0.15) cuts.push([s + 0.06, e - 0.06]);
    }
  }
  const sampleCuts = cuts.map(([a, b]) => [Math.ceil(a * SR), Math.floor(b * SR)]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  const count = sampleCuts.reduce((n, [a, b]) => n + b - a, 0), trimmed = new Float32Array(samples.length - count);
  let pos = 0, src = 0;
  for (const [a, b] of sampleCuts) { trimmed.set(samples.subarray(src, a), pos); pos += a - src; src = b; }
  trimmed.set(samples.subarray(src), pos); wave(dest, trimmed);
  const edits = sampleCuts.map(([a, b]) => ({ start: a / SR, end: b / SR, removed: (b - a) / SR }));
  const mapTime = t => t - edits.reduce((n, cut) => n + clamp(t - cut.start, 0, cut.removed), 0);
  return { duration: trimmed.length / SR, sourceDecodedDuration: duration, removedSilence: count / SR, cuts: edits,
    words: words.map(w => ({ ...w, start: mapTime(w.start), end: mapTime(w.end) })) };
}

function captionsFor(cue, words, tempo) {
  // Map the service tokens to exact characters of the authored script. Attach
  // original punctuation to its preceding token; then DP-group whole words.
  let cursor = 0;
  const tokens = words.map(word => {
    const start = cursor, wanted = canonical(word.text); let consumed = '';
    while (cursor < cue.text.length && consumed.length < wanted.length) consumed = canonical(cue.text.slice(start, ++cursor));
    assert(consumed === wanted, `Service word/text mismatch at ${word.text}`);
    while (cursor < cue.text.length && !/[\p{L}\p{N}]/u.test(cue.text[cursor])) cursor++;
    return { ...word, text: cue.text.slice(start, cursor) };
  });
  assert(cursor === cue.text.length, 'Caption text not fully covered.');
  const costs = Array(tokens.length + 1).fill(Infinity), next = Array(tokens.length).fill(-1); costs[tokens.length] = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    let text = '';
    for (let j = i; j < tokens.length; j++) {
      text += tokens[j].text; const length = chineseChars(text);
      if (length > 18) break;
      const boundary = /[。？！]$/.test(text) ? -2 : /[，、；：]$/.test(text) ? 0 : 5;
      const cost = (length < 8 ? 150 + (8 - length) * 20 : (length - 12) ** 2 * 0.18) + boundary + costs[j + 1];
      if (cost < costs[i]) { costs[i] = cost; next[i] = j + 1; }
    }
  }
  const captions = [];
  for (let i = 0; i < tokens.length;) {
    const j = next[i]; assert(j > i, 'Cannot group service subtitles.');
    const group = tokens.slice(i, j), text = group.map(w => w.text).join('');
    captions.push({ start: round(cue.at + group[0].start / tempo), end: round(cue.at + group.at(-1).end / tempo), text }); i = j;
  }
  assert(captions.map(c => c.text).join('') === cue.text, 'Caption script was changed.');
  return captions;
}

function narration(tools, work, force) {
  const voices = [], allCaptions = [], processing = [];
  for (const cue of VOICE_CUES) {
    let fitted;
    const span = cue.end - cue.at, target = span - 0.07;
    // Start within the requested +16..+22% range; prefer native regeneration
    // to excessive offline acceleration. Never exceed 1.18x atempo.
    for (const rate of [20, 24, 28, 32]) {
      const raw = synthesize(cue, rate, force), words = parseSrt(readFileSync(raw.srt, 'utf8'));
      const trimmed = join(work, cue.file + '.trim.wav'), trim = trimSilence(tools, raw.source, words, trimmed);
      const tempo = Math.max(1, trim.duration / (target - 0.025));
      console.log(`  ${cue.file}: native ${trim.sourceDecodedDuration.toFixed(3)}s, silence -${trim.removedSilence.toFixed(3)}s; needed ${tempo.toFixed(4)}x`);
      if (tempo > 1.18) continue;
      const processed = join(work, cue.file + '.voice.wav'), output = join(AUDIO_DIR, cue.file);
      ff(tools, ['-i', trimmed, '-af', `atempo=${tempo.toFixed(9)},highpass=f=75,lowpass=f=11000,` +
        'acompressor=threshold=0.1:ratio=2.5:attack=6:release=85:makeup=1.2,loudnorm=I=-18:TP=-3.5:LRA=7,aresample=48000',
        '-ac', '1', '-ar', String(SR), '-c:a', 'pcm_f32le', processed]);
      ff(tools, ['-i', processed, '-c:a', 'libmp3lame', '-b:a', '160k', '-ar', String(SR), '-ac', '1', output]);
      const decoded = pcm(tools, output), duration = decoded.length / SR, metrics = stats(decoded);
      assert(duration > 0.5 && duration <= span - 0.025, `Voice does not fit without chopping: ${cue.file}`);
      assert(metrics.rmsDbFS > -32 && metrics.clipped === 0 && metrics.nonfinite === 0, `Empty/invalid voice: ${cue.file}`);
      const captions = captionsFor(cue, trim.words, tempo);
      assert(captions.at(-1).end <= cue.at + duration + 0.04 && captions.at(-1).end <= cue.end, 'Caption exceeds spoken audio/window.');
      const record = { ...cue, file: basename(output), voice: VOICE, generic: true, impersonation: false, rate: `+${rate}%`, pitch: PITCH,
        tempo: round(tempo), chineseCharacters: chineseChars(cue.text), textCharacters: [...cue.text].length,
        decodedDuration: round(duration), audibleEnd: round(cue.at + duration), endMargin: round(span - duration),
        chineseCharactersPerSecond: round(chineseChars(cue.text) / duration), source: basename(raw.source), srt: basename(raw.srt),
        sourceDecodedDuration: round(trim.sourceDecodedDuration), removedSilence: round(trim.removedSilence), cuts: trim.cuts,
        timingSource: 'edge-tts WordBoundary SRT; exact silence-deletion map, then divide by atempo; no equal interpolation',
        sha256: sha(output), sourceSha256: sha(raw.source), srtSha256: sha(raw.srt), ...metrics };
      voices.push(record); allCaptions.push(...captions); processing.push(processed); fitted = true; break;
    }
    assert(fitted, `Cannot fit ${cue.file} with reasonable delivery and atempo <=1.18. No words were truncated.`);
  }
  const captions = { cues: allCaptions, voices, duration: DURATION };
  json(join(AUDIO_DIR, 'captions.json'), captions);
  return { voices, captions, processing };
}

function bus() { return { l: new Float32Array(FRAMES), r: new Float32Array(FRAMES) }; }
function blep(p, d) {
  if (p < d) { const x = p / d; return x + x - x * x - 1; }
  if (p > 1 - d) { const x = (p - 1) / d; return x * x + x + x + 1; }
  return 0;
}
const saw = (p, d) => 2 * p - 1 - blep(p, d);
function compose(path, voices) {
  assert(DURATION === 60 && BPM === 120 && BEAT === 0.5, 'Fixed story timing changed.');
  let seed = SEED;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const noise = () => random() * 2 - 1;
  const tonal = bus(), drums = bus(), fx = bus(), room = bus(), echoes = bus();
  const kicks = [], events = { kick: 0, clap: 0, hat: 0, bass: 0, pad: 0, glass: 0, effect: 0 };
  const cuts = [];
  function note(target, time, duration, pan, gain, reverb, delay, render) {
    const begin = Math.round(time * SR), length = Math.min(Math.ceil(duration * SR), FRAMES - begin);
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    // JS oscillator/filter accumulators use 64-bit Number; floating PCM buses
    // retain full headroom, never converted to integer until final encoding.
    for (let n = 0; n < length; n++) {
      const i = begin + n; if (i < 0) continue;
      const v = render(n / SR, n) * gain;
      target.l[i] += v * gl; target.r[i] += v * gr;
      room.l[i] += v * gl * reverb; room.r[i] += v * gr * reverb;
      echoes.l[i] += v * gl * delay; echoes.r[i] += v * gr * delay;
    }
  }
  function kick(time, gain = 1, soft = false) {
    events.kick++; kicks.push(time); let phase = 0, prev = 0;
    note(drums, time, 0.5, 0, gain, 0.012, 0, t => {
      phase += TAU * (49 + 100 * Math.exp(-t * 45)) / SR;
      const n = noise(), click = n - prev; prev = n;
      return smooth(t / 0.002) * (Math.sin(phase) * Math.exp(-t * 11) * 0.73 + (soft ? 0 : click * Math.exp(-t * 200) * 0.065));
    });
  }
  function clap(time, gain, pan = 0) {
    events.clap++; let low = 0;
    note(drums, time, 0.21, pan, gain, 0.15, 0.02, t => {
      const n = noise(); low += 0.24 * (n - low);
      const bursts = [0, 0.008, 0.019].reduce((e, s) => e + (t >= s ? Math.exp(-(t - s) * 80) : 0), 0);
      return smooth(t / 0.0008) * ((n - low) * (0.14 * bursts + 0.10 * Math.exp(-t * 24)) + Math.sin(TAU * 430 * t) * Math.exp(-t * 80) * 0.05);
    });
  }
  function hat(time, gain, open, pan) {
    events.hat++; let low = 0;
    note(drums, time, open ? 0.18 : 0.064, pan, gain, 0.06, 0, t => {
      const n = noise(); low += 0.64 * (n - low);
      return smooth(t / 0.001) * ((n - low) * 0.6 + Math.sin(TAU * 7919 * t) * Math.sin(TAU * 11003 * t) * 0.08) * Math.exp(-t * (open ? 28 : 95));
    });
  }
  function bass(time, midi, duration, gain) {
    events.bass++; const f = hz(midi), da = f * 0.999 / SR, dbb = f * 1.001 / SR;
    let a = 0, b = 0.13, phase = 0, low = 0;
    note(tonal, time, duration + 0.055, 0, gain, 0.01, 0, t => {
      a = (a + da) % 1; b = (b + dbb) % 1; phase += TAU * f / SR;
      const raw = (saw(a, da) + saw(b, dbb)) * 0.25 + Math.sin(phase) * 0.48;
      low += (1 - Math.exp(-TAU * (260 + 1450 * Math.exp(-t * 21)) / SR)) * (raw - low);
      return Math.tanh(low * 1.45) * 0.7 * smooth(t / 0.004) * (1 - smooth((t - duration) / 0.055));
    });
  }
  function pad(time, notes, duration, gain, stab = false) {
    events.pad++;
    notes.forEach((midi, index) => {
      const f = hz(midi), da = f * 0.997 / SR, dbb = f * 1.003 / SR;
      let a = random(), b = random(), phase = random() * TAU, low = 0;
      note(tonal, time, duration + (stab ? 0.12 : 0.65), -0.84 + index / (notes.length - 1) * 1.68, gain, 0.38, stab ? 0.2 : 0.03, t => {
        a = (a + da) % 1; b = (b + dbb) % 1; phase += TAU * f / SR;
        const raw = (saw(a, da) + saw(b, dbb)) * 0.24 + Math.sin(phase) * 0.36;
        low += (1 - Math.exp(-TAU * (stab ? 600 + 3000 * Math.exp(-t * 20) : 1550 + 350 * Math.sin(t + index)) / SR)) * (raw - low);
        return low * smooth(t / (stab ? 0.007 : 0.12)) * (1 - smooth((t - duration) / (stab ? 0.12 : 0.65))) * (0.93 + 0.07 * Math.sin(t * 1.7 + index));
      });
    });
  }
  function glass(time, midi, gain, pan = 0, lead = false) {
    events.glass++; const f = hz(midi);
    note(tonal, time, lead ? 1.0 : 0.54, pan, gain, 0.26, lead ? 0.36 : 0.21, t =>
      smooth(t / 0.003) * (Math.sin(TAU * f * t + 0.32 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 12)) * Math.exp(-t * (lead ? 5 : 11)) +
        0.23 * Math.sin(TAU * f * 2.002 * t) * Math.exp(-t * 18) + 0.09 * Math.sin(TAU * f * 3.998 * t) * Math.exp(-t * 28)));
  }
  function impact(time, gain, deep = false) {
    events.effect++; let phase = 0, low = 0;
    note(fx, time, 1.15, 0, gain, 0.3, 0.035, t => {
      phase += TAU * ((deep ? 38 : 55) + 100 * Math.exp(-t * 25)) / SR;
      const n = noise(); low += 0.19 * (n - low);
      return smooth(t / 0.002) * (Math.sin(phase) * Math.exp(-t * 7) * 0.66 + (n - low) * Math.exp(-t * 14) * 0.15);
    });
    glass(time + 0.015, 90, gain * 0.09, -0.4, true);
    glass(time + 0.055, 85, gain * 0.08, 0.4, true);
  }
  function whoosh(time, duration, gain, rising = true) {
    events.effect++; let low = 0, slow = 0, phase = 0;
    note(fx, time, duration, rising ? -0.32 : 0.32, gain, 0.16, 0.11, t => {
      const p = t / duration, n = noise(), sweep = rising ? p : 1 - p;
      low += (1 - Math.exp(-TAU * (300 + 6500 * sweep * sweep) / SR)) * (n - low); slow += 0.025 * (low - slow);
      phase += TAU * (180 * 2 ** (sweep * 3.5)) / SR;
      return (low - slow + Math.sin(phase) * 0.08) * 0.33 * Math.sin(Math.PI * p) ** 1.6 * (0.7 + 0.3 * Math.sin(TAU * t * 8));
    });
  }
  // 30 two-second bars, exactly 120 beats. F#m(add9)–Dmaj9–E(add9)–F#m.
  const harmony = [
    { name: 'F#m(add9)', root: 42, notes: [54, 61, 66, 69, 80], arp: [78, 81, 85, 90] },
    { name: 'Dmaj9', root: 38, notes: [50, 57, 61, 66, 76], arp: [78, 81, 85, 88] },
    { name: 'E(add9)', root: 40, notes: [52, 59, 64, 68, 78], arp: [76, 80, 83, 90] },
    { name: 'F#m(add9)', root: 42, notes: [54, 61, 66, 69, 80], arp: [78, 81, 85, 90] },
  ];
  const progression = [], arpOrder = [0, 2, 1, 3, 2, 1, 0, 2];
  const restrained = t => (t >= 51.85 && t < 55.5) || t >= 58;
  for (let bar = 0; bar < 30; bar++) {
    const start = bar * 2, chord = harmony[bar % 4], intro = start < 6, full = start >= 20 && start < 51.85;
    progression.push({ start, chord: chord.name });
    pad(start, chord.notes, 1.85, intro ? 0.034 : start >= 52 && start < 56 ? 0.041 : 0.065);
    if (intro) {
      kick(start, 0.25, true); glass(start + 0.75, chord.arp[0], 0.09, -0.35, true);
      if (bar === 2) whoosh(5.15, 0.85, 0.45);
      continue;
    }
    if (!restrained(start)) {
      for (const beat of full ? [0, 1, 1.75, 2.5, 3.5] : [0, 1.5, 2, 3.25]) {
        const t = start + beat * BEAT; if (!restrained(t)) kick(t, beat % 1 ? 0.57 : 0.79);
      }
      for (const beat of [1, 3]) if (!restrained(start + beat * BEAT)) clap(start + beat * BEAT, 0.55, beat === 1 ? -0.12 : 0.12);
      for (let n = 0; n < 8; n++) {
        const t = start + n * 0.25 + (n % 2 ? 0.013 : 0);
        if (!restrained(t)) hat(t, (n % 2 ? 0.16 : 0.12) * (0.92 + random() * 0.16), n % 4 === 3, n % 2 ? 0.63 : -0.63);
      }
      for (const [i, beat] of [0.5, 1.25, 1.875, 2.75, 3.5].entries()) {
        const t = start + beat * BEAT;
        if (!restrained(t)) bass(t, chord.root + (i === 4 && bar % 2 ? 12 : 0), i % 2 ? 0.145 : 0.23, 0.39);
      }
      for (const beat of [0.5, 2.75]) if (!restrained(start + beat * BEAT)) pad(start + beat * BEAT, chord.notes.slice(1), 0.13, 0.043, true);
    }
    for (let n = 0; n < 8; n++) {
      const t = start + n * 0.25;
      if ((restrained(t) && n % 4 !== 0) || (!full && n % 3 === 2)) continue;
      glass(t, chord.arp[arpOrder[n]], n % 4 === 0 ? 0.112 : 0.072, n % 2 ? 0.68 : -0.68);
    }
  }
  // Memorable 1–b3–5–2–1 glass hook; restated at every principal reveal.
  const motif = [[0, 78], [0.375, 81], [0.75, 85], [1.375, 80], [1.75, 78]];
  for (const origin of [6, 14, 22, 30, 38, 46, 56]) for (const [t, note] of motif) glass(origin + t, note, 0.14, t % 0.5 ? 0.18 : -0.18, true);
  // Every visual editorial landmark gets an explicit, distinct event in seconds.
  cuts.push({ at: 0, event: 'soft question pulse' });
  impact(6, 1.0); cuts.push({ at: 6, event: 'hero impact + glass signature' });
  whoosh(12.68, 0.64, 0.7); cuts.push({ at: 13, event: 'chassis stereo air whoosh', starts: 12.68 });
  impact(20, 0.86); clap(20.018, 0.45); cuts.push({ at: 20, event: 'lens impact / shutter click' });
  whoosh(28.3, 0.9, 0.68); glass(29, 92, 0.18, 0.4, true); cuts.push({ at: 29, event: 'display electronic rise', starts: 28.3 });
  impact(37, 1.03, true); cuts.push({ at: 37, event: 'chip tuned deep drop' });
  whoosh(44.75, 0.6, 0.4); [78, 81, 85, 90].forEach((n, i) => glass(45 + i * 0.09, n, 0.17, -0.6 + i * 0.4, true));
  cuts.push({ at: 45, event: 'battery ascending charge' });
  // Sudden arrangement negative space under the question, then anticipatory rise.
  kick(52, 0.18, true); whoosh(54.75, 0.75, 0.53); cuts.push({ at: 52, event: 'price anticipation cut', riser: 54.75 });
  impact(55.5, 1.1); kick(55.5, 0.8); pad(55.5, harmony[0].notes, 1.85, 0.09);
  cuts.push({ at: 55.5, event: 'price hit / F#m signature' });
  pad(58, harmony[0].notes, 1.4, 0.07); [78, 85, 90].forEach((n, i) => glass(58 + i * 0.16, n, 0.16, -0.35 + i * 0.35, true));
  cuts.push({ at: 58, event: 'F#m(add9) resolve' });

  // Tempo-locked stereo echo and short diffuse room. Narration is dry/centered;
  // only the music return is widened, leaving Mandarin consonants unobscured.
  const delayL = new Float32Array(SR * 0.375), delayR = new Float32Array(SR * 0.25);
  const combs = [0.0311, 0.0417, 0.0533, 0.0671].map((t, i) => ({ l: new Float32Array(Math.round(t * SR)),
    r: new Float32Array(Math.round((t * 1.071 + i * 0.0003) * SR)), il: 0, ir: 0, lowL: 0, lowR: 0, feedback: 0.69 - i * 0.03 }));
  const out = bus(); let dl = 0, dr = 0, lowL = 0, lowR = 0, ki = -1, peak = 0, dcL = 0, dcR = 0, prevL = 0, prevR = 0;
  kicks.sort((a, b) => a - b);
  for (let i = 0; i < FRAMES; i++) {
    const t = i / SR;
    while (ki + 1 < kicks.length && kicks[ki + 1] <= t) ki++;
    const pump = t >= 6 && t < 52 ? 1 - 0.5 * Math.exp(-(t - (kicks[ki] ?? -10)) / 0.09) : 1;
    lowL += 0.18 * (delayL[dl] - lowL); lowR += 0.18 * (delayR[dr] - lowR);
    delayL[dl] = echoes.l[i] + lowR * 0.31; delayR[dr] = echoes.r[i] + lowL * 0.31;
    dl = (dl + 1) % delayL.length; dr = (dr + 1) % delayR.length;
    let wetL = 0, wetR = 0;
    for (const c of combs) {
      const l = c.l[c.il], r = c.r[c.ir]; c.lowL += 0.22 * (l - c.lowL); c.lowR += 0.22 * (r - c.lowR);
      c.l[c.il] = room.l[i] + lowL * 0.15 + c.lowL * c.feedback;
      c.r[c.ir] = room.r[i] + lowR * 0.15 + c.lowR * c.feedback;
      c.il = (c.il + 1) % c.l.length; c.ir = (c.ir + 1) % c.r.length; wetL += l / 4; wetR += r / 4;
    }
    let duck = 1;
    for (const cue of voices) {
      const attack = smooth((t - cue.at + 0.07) / 0.085), release = 1 - smooth((t - cue.audibleEnd) / 0.13);
      duck = Math.min(duck, 1 - 0.58 * attack * release);
    }
    const anticipation = t >= 51.85 && t < 55.5 ? 0.45 : 1;
    const fade = smooth(t / 0.025) * (1 - smooth((t - 59.65) / 0.35));
    const l = ((tonal.l[i] * pump + drums.l[i] + wetL * 0.60 + lowL * 0.50) * anticipation + fx.l[i]) * duck * fade;
    const r = ((tonal.r[i] * pump + drums.r[i] + wetR * 0.60 + lowR * 0.50) * anticipation + fx.r[i]) * duck * fade;
    dcL = l - prevL + 0.99843 * dcL; dcR = r - prevR + 0.99843 * dcR; prevL = l; prevR = r;
    out.l[i] = dcL; out.r[i] = dcR; peak = Math.max(peak, Math.abs(dcL), Math.abs(dcR));
  }
  const gain = 0.80 / Math.max(peak, 0.01);
  for (let i = 0; i < FRAMES; i++) { out.l[i] *= gain; out.r[i] *= gain; }
  wave(path, out.l, out.r);
  console.log(`Original DSP composition: ${JSON.stringify(events)}`);
  return { title: 'Close to Possibility / 把想象带到身边', seed: SEED, bpm: BPM, beats: DURATION / BEAT,
    harmony: 'F#m(add9) / Dmaj9 / E(add9) / F#m(add9)', motifMidi: motif.map(v => v[1]), progression,
    synthesis: 'Original deterministic Node DSP; mono floating oscillator voices into stereo Float32 buses; JS Number/64-bit phase/filter math. No samples, loops, existing music, or legacy timeline imports.',
    events, cuts, duckingDb: round(db(0.42)), fade: { start: 59.65, end: 60 }, peakBeforeGain: peak, synthesisGain: gain };
}

export function verify(tools, report, captions) {
  assert(report.provenance.storySha256 === sha(fileURLToPath(new URL('./story.mjs', import.meta.url))), 'Story hash mismatch; regenerate audio.');
  assert(report.provenance.generatorSha256 === sha(fileURLToPath(import.meta.url)), 'Generator hash mismatch; regenerate audio.');
  assert(report.master?.sha256 === sha(join(AUDIO_DIR, 'master.mp3')), 'Master hash mismatch.');
  assert(report.provenance.captionsSha256 === sha(join(AUDIO_DIR, 'captions.json')), 'Caption file hash mismatch.');
  assert(report.title === TITLE && report.disclaimer === DISCLAIMER && report.provenance.productClaims === PRODUCT_CLAIMS, 'Wrong editorial provenance.');
  assert(JSON.stringify(report.provenance.sources) === JSON.stringify(SOURCES) &&
    JSON.stringify(report.provenance.facts) === JSON.stringify(FACTS), 'Official source/fact provenance mismatch.');
  assert(JSON.stringify(captions.voices) === JSON.stringify(report.voices), 'Caption voice records are stale.');
  assert(captions.duration === 60 && captions.voices.length === 8, 'Caption document contract invalid.');
  // Granularity is the requested 8–18 Han characters per caption, not an
  // invented minimum caption count; complete coverage is checked below.
  assert(captions.cues.length > captions.voices.length, 'Missing fine-grained captions.');
  const voices = VOICE_CUES.map((cue, index) => {
    const voice = report.voices[index], file = join(AUDIO_DIR, cue.file), data = pcm(tools, file), duration = data.length / SR;
    const metrics = stats(data), info = probe(tools, file);
    assert(voice.text === cue.text && voice.at === cue.at && voice.end === cue.end && voice.sha256 === sha(file), 'Voice provenance mismatch.');
    assert(duration > 0.5 && cue.at + duration <= cue.end && metrics.rmsDbFS > -32, `Voice empty/outside window: ${cue.file}`);
    assert(metrics.clipped === 0 && metrics.nonfinite === 0 && voice.tempo <= 1.18, 'Invalid voice PCM or excessive tempo.');
    assert(voice.voice === VOICE && voice.generic && !voice.impersonation, 'Wrong generic voice identity.');
    assert(voice.sourceSha256 === sha(join(AUDIO_DIR, voice.source)) && voice.srtSha256 === sha(join(AUDIO_DIR, voice.srt)), 'Service audio/SRT provenance mismatch.');
    const serviceWords = parseSrt(readFileSync(join(AUDIO_DIR, voice.srt), 'utf8'));
    assert(canonical(serviceWords.map(w => w.text).join('')) === canonical(cue.text), 'Service did not return the entire script.');
    for (const cut of voice.cuts) for (const word of serviceWords)
      assert(cut.end <= word.start - 0.0299 || cut.start >= word.end + 0.0299, 'Silence cut touches a protected spoken word.');
    const cc = captions.cues.filter(c => c.start >= cue.at - 0.001 && c.end <= cue.end + 0.001);
    assert(cc.map(c => c.text).join('') === cue.text, `Captions do not reproduce entire voice: ${cue.file}`);
    for (const c of cc) assert(c.end > c.start && chineseChars(c.text) >= 8 && chineseChars(c.text) <= 18, 'Caption size/timing invalid.');
    return { file: cue.file, decodedDuration: duration, endMargin: round(cue.end - cue.at - duration), info, ...metrics };
  });
  for (let i = 1; i < captions.cues.length; i++) assert(captions.cues[i].start >= captions.cues[i - 1].end - 0.002, 'Overlapping captions.');
  const masterPath = join(AUDIO_DIR, 'master.mp3'), info = probe(tools, masterPath), data = pcm(tools, masterPath, 2), metrics = stats(data, 2);
  const tags = JSON.parse(run(tools.ffprobe, ['-v', 'error', '-show_entries', 'format_tags', '-of', 'json', masterPath]).stdout).format.tags;
  assert(tags.title === TITLE && tags.comment === PRODUCT_CLAIMS && !/fictional|unofficial concept/i.test(JSON.stringify(tags)), 'Stale product metadata in MP3.');
  assert(tags.story_sha256 === report.provenance.storySha256 && tags.generator_sha256 === report.provenance.generatorSha256, 'MP3 script/generator hash mismatch.');
  assert(tags.official_sources === JSON.stringify(SOURCES) && tags.product_facts === JSON.stringify(FACTS), 'MP3 official sources/facts mismatch.');
  const measurement = loudness(tools, masterPath), decodedDuration = data.length / SR / 2;
  assert(info.codec_name === 'mp3' && info.sample_rate === '48000' && info.channels === 2 && Number(info.bit_rate) === 192000, 'Master encoding must be MP3, 48kHz stereo, 192kbps.');
  assert(Math.abs(info.duration - DURATION) <= 0.031 && Math.abs(decodedDuration - DURATION) <= 1 / SR, 'Master duration/padding out of bounds.');
  assert(metrics.clipped === 0 && metrics.nonfinite === 0, 'Decoded master clipped/invalid.');
  const lufs = Number(measurement.input_i), tp = Number(measurement.input_tp);
  assert(lufs >= -16 && lufs <= -15 && tp <= -1.5, `Master loudness not met: ${lufs} LUFS / ${tp} dBTP`);
  assert(metrics.correlation < 0.999 && metrics.sideRmsDbFS > -45, 'Master is effectively mono.');
  const fade = stats(data, 2, 59.995, 60); assert(fade.rmsDbFS < -70, 'Final fade does not reach silence.');
  const chapters = CHAPTERS.map(chapter => ({ id: chapter.id, ...stats(data, 2, chapter.start, chapter.end) }));
  assert(chapters.every(c => c.rmsDbFS > -35), 'An empty chapter exists.');
  return { voices, master: { file: 'master.mp3', ...info, decodedDuration, decodedFrames: data.length / 2,
    integratedLUFS: lufs, truePeakDbTP: tp, loudnessRangeLU: Number(measurement.input_lra), ...metrics, fade, chapters, tags, sha256: sha(masterPath) } };
}

async function main() {
  mkdirSync(AUDIO_DIR, { recursive: true }); const tools = getTools();
  if (process.argv.includes('--verify')) {
    const report = JSON.parse(readFileSync(join(AUDIO_DIR, 'report.json'), 'utf8'));
    console.log(JSON.stringify(verify(tools, report, JSON.parse(readFileSync(join(AUDIO_DIR, 'captions.json'), 'utf8'))), null, 2)); return;
  }
  // No playable old master or old PASS evidence may survive a rebuild failure.
  // Keep raw caches; synthesize() reuses only exact text/voice/rate/pitch + hashes.
  for (const name of ['master.mp3', 'master.wav', 'captions.json', 'report.json', 'playback-report.json', 'signal-report.json'])
    rmSync(join(AUDIO_DIR, name), { force: true });
  const storyHash = sha(fileURLToPath(new URL('./story.mjs', import.meta.url))), work = mkdtempSync(join(AUDIO_DIR, '.work-'));
  try {
    const narrationResult = narration(tools, work, process.argv.includes('--force-voice'));
    const { voices, captions, processing } = narrationResult;
    if (process.argv.includes('--voices-only')) { console.log(JSON.stringify(voices.map(v => ({ file: v.file, duration: v.decodedDuration, tempo: v.tempo, margin: v.endMargin })), null, 2)); return; }
    const raw = join(work, 'music-raw.wav'), music = join(work, 'music.wav');
    const composition = compose(raw, voices);
    normalize(tools, raw, music, -24.0, -6.0);
    const inputs = ['-i', music]; processing.forEach(p => inputs.push('-i', p));
    const graph = voices.map((v, i) => `[${i + 1}:a]pan=stereo|c0=c0|c1=c0,adelay=${Math.round(v.at * SR)}S:all=1[v${i}]`);
    graph.push(`[0:a]${voices.map((_, i) => `[v${i}]`).join('')}amix=inputs=9:duration=first:normalize=0:dropout_transition=0,` +
      `apad=whole_dur=60,atrim=duration=60,afade=t=out:st=59.65:d=0.35[m]`);
    const premaster = join(work, 'premaster.wav'), normalized = join(work, 'normalized.wav'), masterWave = join(AUDIO_DIR, 'master.wav');
    ff(tools, [...inputs, '-filter_complex', graph.join(';'), '-map', '[m]', '-ac', '2', '-ar', String(SR), '-c:a', 'pcm_f32le', premaster]);
    normalize(tools, premaster, normalized, -15.5, -2.0);
    // Preserve gapless MP3 metadata: 60.000 decoded seconds; container may add
    // a single 24ms MPEG frame. No -t applied to any spoken source.
    ff(tools, ['-i', normalized, '-af', 'apad=whole_dur=60,atrim=duration=60', '-ac', '2', '-ar', String(SR), '-c:a', 'pcm_s24le', masterWave]);
    const staged = join(work, 'master.mp3');
    ff(tools, ['-i', masterWave, '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', String(SR), '-ac', '2',
      '-write_xing', '1', '-id3v2_version', '3', '-metadata', `title=${TITLE}`, '-metadata', `comment=${PRODUCT_CLAIMS}`,
      '-metadata', `official_sources=${JSON.stringify(SOURCES)}`, '-metadata', `product_facts=${JSON.stringify(FACTS)}`,
      '-metadata', `story_sha256=${storyHash}`, '-metadata', `generator_sha256=${sha(fileURLToPath(import.meta.url))}`, staged]);
    renameSync(staged, join(AUDIO_DIR, 'master.mp3'));
    const report = { title: TITLE, disclaimer: DISCLAIMER, duration: 60, bpm: BPM, beats: 120,
      sampleRate: SR, voiceIdentity: { provider: 'Microsoft Edge TTS through installed edge-tts', voice: VOICE,
        generic: true, voiceCloning: false, impersonation: false, pitch: PITCH, initialRate: '+20%', maximumAtempo: 1.18 },
      voices, composition, master: { sha256: sha(join(AUDIO_DIR, 'master.mp3')) },
      captions: { file: 'captions.json', count: captions.cues.length, format: '{ cues: [{ start, end, text }], voices: [...], duration: 60 }',
        alignment: 'Service WordBoundary timestamps transformed through exact silence edits and atempo; exact story text including punctuation.' },
      processing: { musicTargetLUFS: -24, voiceTargetLUFS: -18, masterTargetLUFS: -15.5, encodeHeadroomTargetDbTP: -2,
        voice: '75Hz high-pass; 11kHz low-pass; gentle 2.5:1 compression; centered dry narration. No word chopping or narration reverb.',
        duck: 'Music-only 7.54dB narration-window duck with 85ms attack/130ms release, plus kick sidechain.',
        pcm: '64-bit JS oscillator/filter arithmetic -> float32 mono voices/stereo buses -> float32 mix -> 24-bit PCM archival master -> MP3.',
        fade: { start: 59.65, end: 60 } },
      provenance: { script: 'story.mjs', storySha256: storyHash, generator: 'score.mjs', generatorSha256: sha(fileURLToPath(import.meta.url)),
        captionsSha256: sha(join(AUDIO_DIR, 'captions.json')), sources: SOURCES, facts: FACTS,
        music: 'Original synthesis generated locally by this script, no external music or samples.',
        speech: 'Generic zh-CN-YunxiNeural, not Lei Jun and not any cloned or impersonated person.',
        subtitles: 'Actual service WordBoundary SRT via installed python edge_tts module/CLI with --write-subtitles; constructor option enables word granularity.',
        productClaims: PRODUCT_CLAIMS,
        createdAt: new Date().toISOString() },
      delivery: { audio: 'master.mp3', captions: 'captions.json', archive: 'master.wav', runtime: 'Native HTMLAudioElement local relative audio/master.mp3; clip playback at 60 seconds.' } };
    const verification = verify(tools, report, captions);
    report.master = verification.master; report.voiceVerification = verification.voices;
    report.validation = { passed: true, checkedAt: new Date().toISOString(), tools: 'ffprobe plus full FFmpeg decode and EBU R128/true-peak measurement',
      scope: 'Objective signal/timing/caption checks; does not claim human listening review.' };
    assert(sha(fileURLToPath(new URL('./story.mjs', import.meta.url))) === storyHash, 'Parent changed story during synthesis; regenerate.');
    json(join(AUDIO_DIR, 'report.json'), report);
    console.log(JSON.stringify({ output: join(AUDIO_DIR, 'master.mp3'), captions: join(AUDIO_DIR, 'captions.json'),
      report: join(AUDIO_DIR, 'report.json'), master: report.master, voices: voices.map(v => ({ file: v.file, rate: v.rate,
        tempo: v.tempo, duration: v.decodedDuration, margin: v.endMargin, chars: v.chineseCharacters, charsPerSecond: v.chineseCharactersPerSecond })) }, null, 2));
  } catch (error) {
    for (const name of ['master.mp3', 'master.wav', 'report.json']) rmSync(join(AUDIO_DIR, name), { force: true });
    throw error;
  } finally { rmSync(work, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(redact(error.stack)); process.exitCode = 1; });