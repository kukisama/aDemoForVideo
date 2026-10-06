/**
 * THE UNDERSTANDING KEY / 知识之塔 — original instrumental battle chiptune.
 * node <absolute path>/feynman/score.mjs [--verify]
 * Offline Node DSP. No speech, samples, network, API keys or new dependencies.
 * Only writes audio/ beside this file. Publication follows full staged QA.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BPM, BEAT, DURATION, TOTAL_BEATS, CHAPTERS, CUTS } from './story.mjs';

const require = createRequire(new URL('../web/package.json', import.meta.url));
export const AUDIO_DIR = fileURLToPath(new URL('./audio/', import.meta.url));
const SELF = fileURLToPath(import.meta.url), STORY = fileURLToPath(new URL('./story.mjs', import.meta.url));
const SR = 48000, FRAMES = 2764800, SPB = 19200, BAR = 76800, TAU = Math.PI * 2, SEED = 0x4645594e;
const TITLE = 'The Understanding Key / Original Instrumental Battle Chiptune';
const COMMENT = 'Original deterministic Node DSP composition; no voice, no TTS, no samples, no borrowed music; 150 BPM.';
const assert = (ok, text) => { if (!ok) throw new Error(text); };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const hz = m => 440 * 2 ** ((m - 69) / 12);
const db = x => 20 * Math.log10(Math.max(1e-12, x));
const round = x => Math.round(x * 1e6) / 1e6;
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const json = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
const stereo = () => ({ l: new Float32Array(FRAMES), r: new Float32Array(FRAMES) });

function contract() {
  assert(BPM === 150 && BEAT === .4 && DURATION === 57.6 && TOTAL_BEATS === 144, 'Story timing changed; score requires 150 BPM / 144 beats / 57.6 seconds.');
  assert(CHAPTERS.length === 9 && CHAPTERS.every((c, i) => Math.round(c.start * SR) === i * BAR * 4 && Math.round(c.end * SR) === (i + 1) * BAR * 4), 'Nine exact four-bar acts required.');
  assert(CUTS.length === 36 && CUTS.every((t, i) => Math.round(t * SR) === i * BAR), 'Every visual cut must be on the 1.6-second bar grid.');
}
function run(exe, args, binary = false) {
  const r = spawnSync(exe, args, { encoding: binary ? null : 'utf8', windowsHide: true, timeout: 240000, maxBuffer: 128 * 1024 * 1024 });
  assert(!r.error && r.status === 0, `${r.error?.message ?? `Exit ${r.status}`}: ${String(r.stderr).slice(-4000)}`);
  return r;
}
export function getTools() {
  const ffmpeg = execFileSync('python', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8', windowsHide: true }).trim();
  const ffprobe = require('ffprobe-static').path;
  assert(existsSync(ffmpeg) && existsSync(ffprobe), 'Installed FFmpeg/ffprobe not found.');
  return { ffmpeg, ffprobe };
}
const ff = (tools, args) => run(tools.ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-y', ...args]);
function probe(tools, path) {
  return JSON.parse(run(tools.ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]).stdout);
}
function decode(tools, path) {
  // Do not force sample rate/channel count: QA must see the actual decoder output.
  const data = run(tools.ffmpeg, ['-v', 'error', '-nostdin', '-i', path, '-map', '0:a:0', '-f', 'f32le', '-c:a', 'pcm_f32le', '-'], true).stdout;
  return new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}
function wave(path, l, r) {
  const channels = r ? 2 : 1, align = channels * 4, data = Buffer.alloc(44 + l.length * align);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(3, 20); data.writeUInt16LE(channels, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * align, 28); data.writeUInt16LE(align, 32);
  data.writeUInt16LE(32, 34); data.write('data', 36); data.writeUInt32LE(l.length * align, 40);
  for (let i = 0; i < l.length; i++) { data.writeFloatLE(l[i], 44 + i * align); if (r) data.writeFloatLE(r[i], 48 + i * align); }
  writeFileSync(path, data);
}
function stats(data, channels = 2, start = 0, end = data.length / channels / SR) {
  let peak = 0, sum = 0, clipped = 0, nonfinite = 0, cross = 0, el = 0, er = 0, side = 0;
  const a = Math.max(0, Math.round(start * SR) * channels), b = Math.min(data.length, Math.round(end * SR) * channels);
  for (let i = a; i < b; i++) {
    const x = data[i]; peak = Math.max(peak, Math.abs(x)); sum += x * x;
    if (!Number.isFinite(x)) nonfinite++;
    if (Math.abs(x) >= 1) clipped++;
    if (channels === 2 && i % 2 === 0) { const y = data[i + 1]; el += x * x; er += y * y; cross += x * y; side += (x - y) ** 2; }
  }
  return { peakDbFS: round(db(peak)), rmsDbFS: round(db(Math.sqrt(sum / Math.max(1, b - a)))), clipping: clipped, nonfinite,
    ...(channels === 2 ? { correlation: round(cross / Math.max(1e-20, Math.sqrt(el * er))), sideRmsDbFS: round(db(Math.sqrt(side / Math.max(1, (b - a) / 2)) / 2)) } : {}) };
}
function loudness(tools, path, target = -11.5, ceiling = -2.0) {
  const r = run(tools.ffmpeg, ['-hide_banner', '-nostdin', '-i', path, '-af', `loudnorm=I=${target}:TP=${ceiling}:LRA=8:print_format=json`, '-f', 'null', '-']);
  const match = r.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  assert(match, 'EBU R128 / oversampled true-peak measurement missing.');
  const m = JSON.parse(match[0]); assert(Number.isFinite(Number(m.input_i)), 'Silent/nonfinite loudness.'); return m;
}

function blep(p, d) {
  if (p < d) { const x = p / d; return x + x - x * x - 1; }
  if (p > 1 - d) { const x = (p - 1) / d; return x * x + x + x + 1; }
  return 0;
}
const saw = (p, d) => 2 * p - 1 - blep(p, d);
// DC-free NES-style 25% pulse, both edges polyBLEP bandlimited (not master bit reduction).
const pulse25 = (p, d) => ((p < .25 ? .75 : -.25) + .5 * blep(p, d) - .5 * blep((p + .75) % 1, d)) * 1.55;
function envelope(t, hold, attack, release) { return smooth(t / attack) * (1 - smooth((t - hold) / release)); }

// Eight bars: rising E–B–E–G hook, dotted answer, falling sigh, dominant pickup.
// Each tuple is [beat within bar, MIDI pitch, gate in beats]. Authored here, not sampled/transcribed.
const THEME = [
  [[0,76,.65],[.75,71,.2],[1,76,.4],[1.5,79,.65],[2.25,78,.2],[2.5,76,.4],[3,71,.4],[3.5,74,.4]],
  [[0,76,.9],[1,79,.4],[1.5,83,.65],[2.25,81,.2],[2.5,79,.4],[3,76,.8]],
  [[0,79,.65],[.75,74,.2],[1,79,.4],[1.5,83,.65],[2.25,81,.2],[2.5,79,.4],[3,78,.4],[3.5,74,.4]],
  [[0,78,.9],[1,76,.4],[1.5,74,.4],[2,71,.65],[2.75,74,.2],[3,78,.4],[3.5,74,.4]],
  [[0,76,.65],[.75,71,.2],[1,76,.4],[1.5,79,.65],[2.25,83,.2],[2.5,81,.4],[3,79,.4],[3.5,76,.4]],
  [[0,81,.65],[.75,79,.2],[1,76,.4],[1.5,72,.65],[2.25,74,.2],[2.5,76,.4],[3,79,.8]],
  [[0,78,.65],[.75,74,.2],[1,71,.4],[1.5,74,.65],[2.25,78,.2],[2.5,81,.4],[3,78,.4],[3.5,75,.4]],
  [[0,76,1.4],[1.5,71,.4],[2,74,.4],[2.5,75,.4],[3,78,.4],[3.5,83,.4]],
];
const HARMONY = {
  Em: { root: 40, tones: [64,67,71], arp: [76,79,83,88] },
  C: { root: 36, tones: [60,64,67], arp: [72,76,79,84] },
  G: { root: 43, tones: [62,67,71], arp: [74,79,83,86] },
  D: { root: 38, tones: [62,66,69], arp: [74,78,81,86] },
  Am: { root: 33, tones: [60,64,69], arp: [72,76,81,84] },
  B: { root: 35, tones: [63,66,71], arp: [75,78,83,87] },
  E: { root: 40, tones: [64,68,71], arp: [76,80,83,88] },
  A: { root: 33, tones: [61,64,69], arp: [73,76,81,85] },
};
const PROGRESSION = [
  'Em','C','G','D', 'Em','C','B','B', 'Em','C','Am','B',
  'Em','C','G','D', 'Em','C','D','B', 'Am','C','B','B',
  'Em','C','G','D', 'Em','Am','B','B', 'E','A','B','E',
];
const ACT_INTENT = [
  'Immediate timpani + brass fanfare; introduce the hook, open the tower',
  'Busy sixteenth arpeggios / confident pulse answers: memorization overload',
  'Exact 12.8s tape/bit stop, short digital void, then low suspense ostinato',
  'Huge heroic reset: first four bars of the eight-bar main theme',
  'Theme bars five to eight; lower call / two-octave upper answer',
  'Increasing density, dominant pedal and rising inversions; BPM stays 150',
  'Largest minor-key drop, octave lead doubling, double-time snare feel',
  'Four-step retry staircase; quarter/eighth/sixteenth/32nd snare build',
  'Parallel E-major victory; restate hook, tonic cadence, final 0.4s fade',
];

export function compose(work) {
  contract();
  let seed = SEED;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const noise = () => random() * 2 - 1;
  const tonal = stereo(), percussion = stereo(), fx = stereo(), room = stereo(), echo = stereo();
  // This exact mono bus is added to the mix, and also preserved for independent timing QA.
  const lowDrums = new Float32Array(FRAMES), lowEvents = [], events = [], downbeats = [], progression = [];
  function note(target, beat, seconds, pan, gain, reverb, delay, render, kind, detail = {}) {
    const sample = Math.round(beat * SPB), count = Math.min(Math.round(seconds * SR), FRAMES - sample);
    assert(sample >= 0 && count > 0, `Invalid event ${kind} at ${beat}`);
    events.push({ kind, beat, sample, seconds: round(sample / SR), ...detail });
    const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
    for (let n = 0; n < count; n++) {
      const i = sample + n, v = render(n / SR, n) * gain;
      if (target === lowDrums) lowDrums[i] += v;
      else { target.l[i] += v * l; target.r[i] += v * r; }
      room.l[i] += v * l * reverb; room.r[i] += v * r * reverb;
      echo.l[i] += v * l * delay; echo.r[i] += v * r * delay;
    }
  }
  function kick(beat, gain = 1, downbeat = false, type = 'kick', midi = 40) {
    let phase = 0, previous = 0;
    const pitched = type === 'timpani', stop = type === 'stop';
    note(lowDrums, beat, .185, 0, gain, pitched ? .13 : .015, 0, (t, n) => {
      const fundamental = pitched ? hz(midi) : stop ? 44 : 48;
      phase += TAU * (fundamental + (pitched ? 88 : 135) * Math.exp(-t * 45)) / SR;
      const w = noise(), hp = w - previous; previous = w;
      const body = Math.tanh(1.4 * Math.sin(phase)) * .77 * Math.exp(-t * (pitched ? 13 : 16));
      const skin = pitched ? Math.sin(phase * 1.505) * .25 * Math.exp(-t * 26) : Math.sin(TAU * 1700 * t) * .11 * Math.exp(-t * 350);
      return envelope(t, .15, .0004, .035) * (body + skin + hp * .18 * Math.exp(-t * 280));
    }, type, { downbeat, midi: pitched ? midi : null });
    const e = { kind: type, beat, sample: Math.round(beat * SPB), lengthSamples: 8880, downbeat };
    lowEvents.push(e); if (downbeat) downbeats.push(e);
  }
  function snare(beat, gain = 1, pan = 0, short = false) {
    let low = 0, top = 0;
    note(percussion, beat, short ? .095 : .22, pan, gain, .16, .025, t => {
      const w = noise(); low += .24 * (w - low); top += .7 * (w - top);
      const clap = [0,.009,.021].reduce((v, at) => v + (t >= at ? Math.exp(-(t - at) * 95) : 0), 0);
      const shell = .4 * Math.sin(TAU * 186 * t) * Math.exp(-t * 25) + .19 * Math.sin(TAU * 332 * t) * Math.exp(-t * 40);
      const tail = Math.exp(-t * (short ? 53 : 24));
      return envelope(t, short ? .06 : .16, .0006, short ? .035 : .06) * (shell + (top - low) * (.72 * tail + .24 * clap));
    }, 'snare');
  }
  function hat(beat, gain, open = false, pan = .5) {
    let low = 0;
    note(percussion, beat, open ? .15 : .055, pan, gain, .035, 0, t => {
      const w = noise(); low += .7 * (w - low);
      return envelope(t, open ? .09 : .035, .0005, .02) * ((w - low) * .7 + Math.sin(TAU * 7253 * t) * Math.sin(TAU * 10037 * t) * .11) * Math.exp(-t * (open ? 20 : 78));
    }, open ? 'open-hat' : 'hat');
  }
  function tom(beat, midi, gain, pan) {
    let phase = 0, low = 0;
    note(percussion, beat, .24, pan, gain, .18, 0, t => {
      phase += TAU * hz(midi) * (1 + .5 * Math.exp(-t * 36)) / SR;
      low += .08 * (noise() - low);
      return envelope(t, .17, .0007, .07) * (Math.sin(phase) * Math.exp(-t * 16) + .24 * low * Math.exp(-t * 36));
    }, 'tom', { midi });
  }
  function pulse(beat, midi, beats, gain, pan = 0, counter = false) {
    let p = 0, low = 0; const f = hz(midi), hold = beats * BEAT;
    note(tonal, beat, hold + .032, pan, gain, .13, counter ? .16 : .095, t => {
      const vibrato = 1 + .0027 * Math.sin(TAU * 5.7 * t) * smooth((t - .10) / .12), d = f * vibrato / SR;
      p = (p + d) % 1;
      low += .58 * (pulse25(p, d) - low);
      return low * envelope(t, hold, .002, .032) * (.94 + .06 * Math.exp(-t * 20));
    }, counter ? 'pulse-counterpoint' : 'pulse-lead', { midi, gateBeats: beats, duty: .25 });
  }
  function bass(beat, midi, beats, gain) {
    const f = hz(midi), hold = beats * BEAT;
    // Additive triangle avoids aliasing while preserving NES-like rounded edges.
    note(tonal, beat, hold + .025, 0, gain, .01, 0, t => {
      let tri = 0;
      for (let h = 1; h <= 9; h += 2) tri += (h % 4 === 1 ? 1 : -1) * Math.sin(TAU * f * h * t) / (h * h);
      return envelope(t, hold, .0025, .025) * (tri * .68 + Math.sin(TAU * f * .5 * t) * .28);
    }, 'triangle-sub-bass', { midi });
  }
  function brass(beat, tones, beats, gain, stab = false) {
    const hold = beats * BEAT;
    tones.forEach((midi, ix) => {
      const f = hz(midi), detunes = [.994,1,1.006], phases = [random(),random(),random()]; let low = 0;
      note(tonal, beat, hold + (stab ? .07 : .16), -.83 + ix / Math.max(1, tones.length - 1) * 1.66, gain, .21, .035, t => {
        let s = 0;
        for (let k = 0; k < 3; k++) { const d = f * detunes[k] / SR; phases[k] = (phases[k] + d) % 1; s += saw(phases[k], d) / 3; }
        const cutoff = 1300 + 3400 * Math.exp(-t * (stab ? 14 : 5));
        low += (1 - Math.exp(-TAU * cutoff / SR)) * (s - low);
        return Math.tanh(low * 1.65) * .72 * envelope(t, hold, stab ? .004 : .012, stab ? .07 : .16);
      }, stab ? 'brass-stab' : 'supersaw-brass-strings', { midi });
    });
  }
  function power(beat, root, beats, gain) {
    for (const pan of [-.75,.75]) {
      const freqs = [root + 12,root + 19,root + 24].map(m => hz(m) * (pan < 0 ? .998 : 1.002));
      const phases = [0,.14,.28]; let lo = 0;
      note(tonal, beat, beats * BEAT + .05, pan, gain, .06, 0, t => {
        let s = 0;
        for (let k = 0; k < 3; k++) { const d = freqs[k] / SR; phases[k] = (phases[k] + d) % 1; s += saw(phases[k], d) / 3; }
        lo += .24 * (Math.tanh(s * 2.3) - lo);
        return lo * envelope(t, beats * BEAT, .002, .05) * (.73 + .27 * Math.exp(-t * 17));
      }, 'distorted-power-chord', { root });
    }
  }
  function bell(beat, midi, gain, pan = 0) {
    const f = hz(midi);
    note(tonal, beat, 1.5, pan, gain, .3, .17, t => envelope(t, 1.2, .0015, .3) *
      (Math.sin(TAU * f * t + .7 * Math.sin(TAU * 2 * f * t) * Math.exp(-t * 9)) * Math.exp(-t * 4.8) +
        .3 * Math.sin(TAU * f * 2.003 * t) * Math.exp(-t * 9) + .13 * Math.sin(TAU * f * 3.99 * t) * Math.exp(-t * 17)), 'glass-bell', { midi });
  }
  function impact(beat, gain, bright = true) {
    let phase = 0, lo = 0, lp = 0;
    note(fx, beat, .9, 0, gain, .3, .025, t => {
      phase += TAU * (37 + 92 * Math.exp(-t * 26)) / SR;
      const n = noise(); lo += .09 * (n - lo); lp += .55 * (n - lp);
      return envelope(t, .65, .001, .25) * (.48 * Math.sin(phase) * Math.exp(-t * 11) + (lp - lo) * (bright ? .52 : .2) * Math.exp(-t * 6.5));
    }, 'act-impact');
    if (bright) { bell(beat, 88, gain * .17, -.4); bell(beat + .25, 95, gain * .1, .4); }
  }
  function riser(beat, beats, gain, staircase = false) {
    let lo = 0, high = 0, phase = 0;
    const duration = beats * BEAT;
    note(fx, beat, duration, 0, gain, .09, .02, t => {
      const u = t / duration, w = noise(), sweep = staircase ? Math.floor(u * 8) / 8 : u;
      lo += (1 - Math.exp(-TAU * (350 + 9500 * u * u) / SR)) * (w - lo); high += .022 * (lo - high);
      phase = (phase + 150 * 2 ** (sweep * 4) / SR) % 1;
      const arp = pulse25(phase, 150 * 2 ** (sweep * 4) / SR);
      return envelope(t, duration - .014, .04, .014) * u ** 1.5 * ((lo - high) * .48 + arp * .085) * (.72 + .28 * Math.cos(TAU * t / .1));
    }, staircase ? 'staircase-riser' : 'noise-pitch-riser');
  }

  for (let bar = 0; bar < 36; bar++) {
    const beat = bar * 4, act = Math.floor(bar / 4), local = bar % 4, name = PROGRESSION[bar], chord = HARMONY[name];
    progression.push({ bar, sample: bar * BAR, seconds: round(bar * 1.6), chord: name });
    // Every 1.6s cut gets a literal, sample-aligned low percussion onset.
    const type = act === 2 ? (local === 0 ? 'stop' : 'timpani') : bar < 2 ? 'timpani' : 'kick';
    const strength = act === 2 ? (local === 0 ? 1.25 : .65 + local * .08) : act === 6 ? 1.48 : act >= 3 ? 1.32 : 1.18;
    kick(beat, strength, true, type, chord.root + 12);

    if (act === 2) {
      // First .6s belongs only to the record-stop; suspense resumes at beat 33.5.
      const from = local === 0 ? 1.5 : .5;
      for (let k = from; k < 4; k += .5) {
        bass(beat + k, chord.root, .27, .20 + local * .025);
        if (k % 1 === .5) pulse(beat + k, chord.tones[1] + 12, .12, .075, k % 2 < 1 ? -.5 : .5, true);
      }
      if (local > 0) { kick(beat + 2, .48, false, 'timpani', chord.root + 12); bell(beat, chord.arp[0], .14, .3); }
      if (local === 3) { snare(beat + 2, .5); snare(beat + 3, .65); snare(beat + 3.5, .8, .2, true); }
      continue;
    }

    // Four-to-the-floor battle foundation, plus offbeat kicks in high-energy passages.
    const kicks = bar === 0 ? [2] : bar === 1 ? [1.5,2,3] : act === 7 && local < 2 ? [2,3] : [1,2,3];
    for (const k of kicks) kick(beat + k, strength * (k === 2 ? .9 : .81), false, bar < 2 ? 'timpani' : 'kick', chord.root + 12);
    if ((act === 3 || act === 4 || act === 6) && local % 2 === 1) kick(beat + 2.5, strength * .7);
    if (act === 6) kick(beat + 3.5, strength * .75);
    if (act !== 7) {
      const hits = act === 6 ? [.5,1.5,2.5,3.5] : bar === 0 ? [3] : [1,3];
      for (const k of hits) snare(beat + k, act === 6 ? 1.08 : act >= 3 ? 1.05 : .88, k < 2 ? -.06 : .06);
      if (local === 3 && act !== 8) for (const k of [3.25,3.5,3.75]) snare(beat + k, .38 + (k - 3) * .45, k % .5 ? -.2 : .2, true);
    } else {
      // Density increases, never the musical clock. Final roll is 32nds, not tempo automation.
      const step = [1,.5,.25,.125][local];
      for (let k = 0; k < 4; k += step) snare(beat + k, .32 + local * .14 + k * .035, k % .5 ? -.18 : .18, true);
    }
    const hatStep = act === 1 || act === 5 || act === 6 || (act === 7 && local > 1) ? .25 : .5;
    for (let k = 0; k < 4; k += hatStep) {
      if (bar === 0 && k < 2) continue;
      const strong = k % 1 === .5;
      hat(beat + k, (strong ? .36 : k % 1 === 0 ? .24 : .16) * (.92 + random() * .16), strong && k === 3.5, k % .5 ? -.62 : .62);
    }
    for (let k = 0; k < 4; k += .5) {
      const octave = (act === 1 || act === 6) && k % 1 === .5 ? 12 : 0;
      bass(beat + k, chord.root + octave, .38, act === 6 ? .52 : act >= 3 ? .46 : .38);
    }
    const chordGain = act === 6 ? .145 : act === 7 ? .08 + local * .018 : act === 0 ? .16 : act === 1 ? .1 : .135;
    brass(beat, chord.tones, bar === 35 ? 3.4 : 1.6, chordGain);
    if (bar !== 35) brass(beat + 2, chord.tones, 1.5, chordGain * .83);
    for (const k of (act === 0 ? [0,2,3] : act === 7 ? [0,1.5,2.5,3] : [0,.75,1.5,2,2.75,3.5])) {
      power(beat + k, chord.root, k % 1 === 0 ? .46 : .32, act === 6 ? .22 : act >= 3 ? .165 : .105);
    }

    if (act === 1 || act === 5 || act === 7 || act === 6) {
      const order = [0,1,2,3,2,1,3,2,0,2,1,3,1,2,3,2];
      const step = act === 6 ? .5 : .25;
      for (let k = 0; k < 4; k += step) {
        const ix = Math.round(k / step), octave = act === 7 && local >= 2 ? 12 : 0;
        pulse(beat + k, chord.arp[order[ix]] + octave, step * .6, act === 1 ? .13 : act === 6 ? .074 : .095, ix % 2 ? .55 : -.55, true);
      }
    }
    if (local === 3 && act !== 8) [0,.25,.5,.75].forEach((off, i) => tom(beat + 3 + off, [57,52,47,40][i], .48 + i * .07, -.6 + i * .4));
    if (local === 0 || local === 2) bell(beat, chord.arp[0] + 12, act === 6 ? .26 : .2, local ? .4 : -.4);
  }

  // Intro sketches the first phrase; the next four bars reveal its full 8-bar identity.
  // Reprise at 19.2..32, fragmented during the repair, octave-doubled at the final drop.
  for (let bar = 0; bar < 36; bar++) {
    const act = Math.floor(bar / 4), local = bar % 4, origin = bar * 4;
    if (act === 2) continue;
    if (act === 5 || act === 7) {
      const chord = HARMONY[PROGRESSION[bar]], offsets = act === 7 ? [0,1,2,3] : [0,1.5,2.5,3.5];
      offsets.forEach((at, i) => pulse(origin + at, chord.arp[(i + local) % 4] + (act === 7 && local === 3 ? 12 : 0), .35, .26, -.12 + i * .08));
      continue;
    }
    if (bar === 35) {
      [[0,83,.4],[.5,80,.4],[1,78,.4],[1.5,76,1.75]].forEach(([at,m,d]) => pulse(origin + at, m, d, .34));
      brass(origin + 1.5, [52,59,64,68,71], 1.9, .12);
      bell(origin + 1.5, 88, .3, -.3); bell(origin + 2, 95, .18, .3);
      continue;
    }
    const phrase = act === 3 || act === 4 ? bar - 12 : act === 6 ? local : act === 8 ? local : bar % 8;
    for (const [at, m, duration] of THEME[phrase]) {
      let midi = m;
      if (act === 8) { if (m % 12 === 7) midi++; if (m % 12 === 0) midi++; if (m % 12 === 2) midi++; }
      // Distinct call/answer: bar 16/18 call lower, bar 17/19 answer high.
      const lowerCall = act === 4 && local % 2 === 0;
      const main = lowerCall ? midi - 12 : midi;
      pulse(origin + at, main, duration, act === 6 ? .34 : act === 8 ? .34 : .30, lowerCall ? -.17 : -.04);
      if (act === 6) pulse(origin + at, midi + 12, duration * .82, .078, .25, true);
      if (act === 4 && at >= 2) pulse(origin + at + .25, main + 24, Math.min(.22, duration * .6), .078, .46, true);
      if (act === 0 && at === 0) brass(origin, [midi - 24,midi - 12], .65, .13, true);
    }
  }

  // Original record-stop: decelerating pulse + filtered crackle, bit reduction ONLY here.
  let stopPhase = 0, held = 0;
  note(fx, 32, .16, 0, .7, 0, 0, (t, n) => {
    const u = t / .16, f = 659.255 * (1 - u) ** 2 + 22, d = f / SR;
    stopPhase = (stopPhase + d) % 1;
    if (n % (4 + Math.floor(u * 24)) === 0) held = Math.round(pulse25(stopPhase, d) * 24) / 24;
    return envelope(t, .10, .0003, .06) * (held * .55 + noise() * .13 * (1 - u));
  }, 'vinyl-bitcrush-stop');
  CHAPTERS.forEach((c, i) => {
    if (i !== 2) impact(i * 16, i === 6 ? 1.12 : i === 3 || i === 8 ? 1.0 : .72);
    if (i > 0) riser(i * 16 - (i === 3 || i === 6 || i === 8 ? 4 : 2), i === 3 || i === 6 || i === 8 ? 4 : 2, i === 6 ? .95 : .62, i === 8);
  });
  // Resolving low E at 56.8s, before the 57.2s terminal fade.
  bass(142, 40, .8, .38);

  const echoL = new Float32Array(14400), echoR = new Float32Array(9600); // dotted eighth / eighth
  const combs = [.0297,.0371,.0439,.0533].map((t, ix) => ({ l: new Float32Array(Math.round(t * SR)), r: new Float32Array(Math.round((t + .0031) * SR)), il:0,ir:0,ll:0,lr:0,g:.59 - ix * .025 }));
  let eiL = 0, eiR = 0, dl = 0, dr = 0, previousL = 0, previousR = 0, dcL = 0, dcR = 0, peak = 0, kickIndex = -1;
  const out = stereo(); lowEvents.sort((a,b) => a.sample - b.sample);
  const hardCuts = [19.2,38.4,51.2].map(t => Math.round(t * SR));
  const fxResets = new Set([614400,643200,...hardCuts]);
  for (let i = 0; i < FRAMES; i++) {
    if (fxResets.has(i)) {
      echoL.fill(0); echoR.fill(0); dl = dr = 0;
      for (const c of combs) { c.l.fill(0); c.r.fill(0); c.ll = c.lr = 0; }
    }
    while (kickIndex + 1 < lowEvents.length && lowEvents[kickIndex + 1].sample <= i) kickIndex++;
    const elapsed = (i - (lowEvents[kickIndex]?.sample ?? -SR)) / SR;
    // Short drum-keyed breathing only. There is no narration track or narration ducking.
    const pump = 1 - .32 * Math.exp(-elapsed / .045);
    dl += .22 * (echoL[eiL] - dl); dr += .22 * (echoR[eiR] - dr);
    echoL[eiL] = echo.l[i] + dr * .24; echoR[eiR] = echo.r[i] + dl * .24;
    eiL = (eiL + 1) % echoL.length; eiR = (eiR + 1) % echoR.length;
    let wetL = 0, wetR = 0;
    for (const c of combs) {
      const l = c.l[c.il], r = c.r[c.ir]; c.ll += .25 * (l - c.ll); c.lr += .25 * (r - c.lr);
      c.l[c.il] = room.l[i] + c.ll * c.g; c.r[c.ir] = room.r[i] + c.lr * c.g;
      c.il = (c.il + 1) % c.l.length; c.ir = (c.ir + 1) % c.r.length;
      wetL += l * .25; wetR += r * .25;
    }
    let arrangement = 1;
    // Stop + silence totals exactly .6s. Direct old notes/returns cannot leak through.
    if (i >= 614400 && i < 643200) arrangement = i < 622080 ? 1 - smooth((i - 619200) / 2880) : 0;
    for (const cut of hardCuts) if (i >= cut - 2880 && i < cut) arrangement *= 1 - .90 * smooth((i - cut + 2880) / 2880);
    const time = i / SR, fade = 1 - smooth((time - 57.2) / .4);
    const stopWindow = i >= 614400 && i < 643200;
    // Widen authored stereo instruments, never mono sub/kick. Mono fold-down
    // retains the same mid component; no Haas offset or master phase trick.
    const toneMid = (tonal.l[i] + tonal.r[i]) * .5, toneSide = (tonal.l[i] - tonal.r[i]) * .95;
    const wetMid = (wetL + wetR) * .25, wetSide = (wetL - wetR) * .40;
    const musicL = stopWindow ? 0 : (toneMid + toneSide) * pump + percussion.l[i] + wetMid + wetSide + dl * .48;
    const musicR = stopWindow ? 0 : (toneMid - toneSide) * pump + percussion.r[i] + wetMid - wetSide + dr * .48;
    const l = (musicL + lowDrums[i] * .70710678 + fx.l[i]) * arrangement * fade;
    const r = (musicR + lowDrums[i] * .70710678 + fx.r[i]) * arrangement * fade;
    // DC blocker before final emergency-silence clamp.
    dcL = l - previousL + .9975 * dcL; dcR = r - previousR + .9975 * dcR; previousL = l; previousR = r;
    const silence = i >= 622080 && i < 643200;
    out.l[i] = silence ? 0 : dcL; out.r[i] = silence ? 0 : dcR;
    peak = Math.max(peak, Math.abs(out.l[i]), Math.abs(out.r[i]));
  }
  const gain = .86 / peak;
  for (let i = 0; i < FRAMES; i++) { out.l[i] *= gain; out.r[i] *= gain; }
  wave(join(work, 'premaster.wav'), out.l, out.r);
  wave(join(work, 'percussion-timing.wav'), lowDrums);
  const counts = {}; for (const e of events) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  console.log(`Rendered ${FRAMES} frames: ${JSON.stringify(counts)}`);
  return { title: TITLE, original: true, noVoice: true, seed: SEED, bpm: BPM, beatSeconds: BEAT, beats: 144, bars: 36,
    theme: { lengthBars: 8, key: 'E minor; parallel E major from 51.2s', notes: THEME, lead: '25% duty polyBLEP pulse', counterpointOctaves: 2 },
    palette: ['bandlimited 25% NES-style pulse','additive triangle + sine sub','wide supersaw brass/strings','distorted power chords','pitch-sweep punch kick','tuned timpani','layered shell/clap/noise snare','8th/16th metallic hats','tom fills','FM glass bells','rising arps','noise/pitch risers','act impacts'],
    narrative: CHAPTERS.map((c,i) => ({ ...c, intent: ACT_INTENT[i], sample: i * 307200 })),
    progression, counts, downbeats, lowEvents, events, rawPeakBeforeGain: round(peak), premasterGain: round(gain),
    silenceWindow: { start: 12.8, end: 13.4, startSample: 614400, stopEnd: 12.96, digitalSilenceStartSample: 622080, resumeSample: 643200, totalSeconds: .6 },
    drops: [19.2,38.4,51.2].map(at => ({ at, sample: Math.round(at * SR), preCutSeconds: .06 })),
    fade: { start: 57.2, end: 57.6 }, narrationDucking: false, masterBitReduction: false,
    synthesis: 'Deterministic original Node oscillators, filtered seeded noise, additive triangle, polyBLEP pulse/saw; Float64 oscillator/filter math and Float32 stereo buses. No samples, third-party tunes, TTS, or network.' };
}

function normalize(tools, source, dest, target, peak) {
  const m = loudness(tools, source, target, peak);
  // loudnorm's "linear=true" can silently fall back to dynamic gain and lift
  // the suspense scene. Use its R128 measurement ONLY, then fixed gain and
  // a stereo-linked 4x oversampled limiter, with compensated lookahead latency.
  const gain = target - Number(m.input_i), limit = 10 ** (peak / 20);
  ff(tools, ['-i', source, '-af', `aresample=${SR * 4},volume=${gain}dB,` +
    `alimiter=limit=${limit}:attack=3:release=65:level=false:latency=true,aresample=${SR},` +
    `apad=whole_len=${FRAMES},atrim=end_sample=${FRAMES}`, '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_s24le', dest]);
}

function timingEvidence(data, composition, master) {
  assert(data.length === FRAMES, 'Timing witness must contain exactly 2,764,800 mono samples.');
  const ordered = [...composition.lowEvents].sort((a,b) => a.sample - b.sample);
  // Detect actual leading edges from the entire raw bus, not from scheduled timestamps.
  const detected = []; let silentRun = 256;
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) <= 1e-10) silentRun++;
    else { if (silentRun >= 96) detected.push(i); silentRun = 0; }
  }
  assert(detected.length === ordered.length, `Raw onset count ${detected.length} != scheduled ${ordered.length}.`);
  const comparisons = ordered.map((e,i) => {
    const offset = detected[i] - e.sample;
    assert(e.sample === Math.round(e.beat * SPB) && Number.isInteger(e.beat * 4), 'Low-drum event off fixed sixteenth grid.');
    assert(offset >= 0 && offset <= 2, `Percussive onset ${i} drifted ${offset} samples.`);
    const rms = stats(master, 2, e.sample / SR, Math.min(DURATION, e.sample / SR + .08)).rmsDbFS;
    assert(rms > -35, `Raw event ${i} is absent from mastered energy.`);
    return { ...e, detectedSample: detected[i], errorSamples: offset, masterFirst80msRmsDbFS: rms };
  });
  const bars = comparisons.filter(e => e.downbeat);
  assert(bars.length === 36 && bars.every((e,i) => e.sample === i * BAR), 'Missing/off-grid bar downbeat.');
  for (const e of composition.events) assert(e.sample === Math.round(e.beat * SPB), `Synth event ${e.kind} has clock drift.`);
  return { method: 'Full-scan leading-edge detector on actual pre-mix mono kick/timpani/stop bus (>96 silent samples, |x|>1e-10), one-to-one against scheduled beats; decoded-master 80ms RMS at each detected event.',
    rawBus: 'percussion-timing.wav', samplesPerBeat: SPB, samplesPerSixteenth: SPB / 4, samplesPerBar: BAR,
    sampleGrain: true, detectedCount: detected.length, scheduledCount: ordered.length, maxErrorSamples: Math.max(...comparisons.map(e => e.errorSamples)),
    toleranceSamples: 2, errorInterpretation: 'Envelopes start at exactly beat sample with zero amplitude; first nonzero normally follows by one sample.',
    allSynthesisEvents: composition.events.length, bars, comparisons };
}

export function verify(tools, report, directory = AUDIO_DIR) {
  contract();
  assert(report.noVoice === true && report.music.original === true && report.music.narrationDucking === false && report.music.masterBitReduction === false, 'Instrumental/original/clean-master contract failed.');
  assert(report.storysha256 === sha(STORY), 'Story SHA-256 mismatch: regenerate against current script.');
  assert(report.generatorSha256 === sha(SELF), 'Generator SHA-256 mismatch: regenerate.');
  const mp3 = join(directory, 'master.mp3'), wav = join(directory, 'master.wav'), witness = join(directory, 'percussion-timing.wav');
  assert(report.mastersha256 === sha(mp3) && report.archiveSha256 === sha(wav) && report.percussionSha256 === sha(witness), 'Audio integrity mismatch.');
  const info = probe(tools, mp3), stream = info.streams[0], samples = decode(tools, mp3), metrics = stats(samples), measure = loudness(tools, mp3);
  assert(info.streams.length === 1 && stream.codec_name === 'mp3' && stream.channels === 2 && Number(stream.sample_rate) === SR && Number(stream.bit_rate) === 256000, 'Expected 48kHz, stereo, 256kbps MP3.');
  assert(samples.length === FRAMES * 2, `Decoded MP3 not exactly 57.600s: ${samples.length / 2} frames.`);
  const containerDuration = Number(info.format.duration), padding = containerDuration - DURATION;
  assert(Math.abs(padding) < .035, `MP3 metadata padding ${padding}s exceeds tolerance.`);
  const tags = info.format.tags;
  assert(tags.title === TITLE && tags.comment === COMMENT && tags.story_sha256 === report.storysha256 && tags.generator_sha256 === report.generatorSha256 && tags.no_voice === 'true', 'MP3 provenance tags mismatch.');
  const LUFS = Number(measure.input_i), truePeak = Number(measure.input_tp);
  assert(LUFS >= -12.5 && LUFS <= -10.8 && truePeak <= -1.3, `Master outside limits: ${LUFS} LUFS / ${truePeak} dBTP.`);
  assert(metrics.clipping === 0 && metrics.nonfinite === 0, 'Decoded MP3 clipping/nonfinite values.');
  assert(metrics.correlation > -.1 && metrics.correlation < .985 && metrics.sideRmsDbFS > -31,
    `Invalid/effectively mono stereo image: correlation=${metrics.correlation}, side=${metrics.sideRmsDbFS}dBFS.`);
  const waveInfo = probe(tools, wav).streams[0], waveData = decode(tools, wav), waveMetrics = stats(waveData), waveMeasure = loudness(tools, wav);
  assert(waveInfo.codec_name === 'pcm_s24le' && waveInfo.bits_per_raw_sample === '24' && waveInfo.channels === 2 && Number(waveInfo.sample_rate) === SR && waveData.length === FRAMES * 2, 'Archive must be exact-duration 24-bit stereo PCM.');
  assert(waveMetrics.clipping === 0 && waveMetrics.nonfinite === 0 && Number(waveMeasure.input_tp) <= -1.3, 'Archive clipping/peak failure.');
  const rawInfo = probe(tools, witness).streams[0];
  assert(rawInfo.codec_name === 'pcm_f32le' && rawInfo.channels === 1 && Number(rawInfo.sample_rate) === SR, 'Timing witness encoding invalid.');
  const timing = timingEvidence(decode(tools, witness), report.music, samples);
  const silence = stats(samples, 2, 13.01, 13.35), resume = stats(samples, 2, 13.4, 13.6), opening = stats(samples, 2, 0, .2), fade = stats(samples, 2, 57.595, 57.6);
  assert(silence.rmsDbFS < -65, `Failure void has unwanted audio: ${silence.rmsDbFS}dBFS.`);
  assert(resume.rmsDbFS > -34 && opening.rmsDbFS > -22 && fade.rmsDbFS < -70,
    `Envelope check: resume=${resume.rmsDbFS}, opening=${opening.rmsDbFS}, fade=${fade.rmsDbFS} dBFS.`);
  const scenes = CHAPTERS.map((c,i) => {
    const energy = stats(samples, 2, c.start, c.end);
    assert(energy.rmsDbFS > -31, `Scene ${c.id} empty.`);
    return { id:c.id, start:c.start, end:c.end, startSample:Math.round(c.start * SR), intent:ACT_INTENT[i], ...energy,
      opening160msRmsDbFS:stats(samples,2,c.start,c.start + .16).rmsDbFS,
      scheduledPercussion:report.music.events.filter(e => ['kick','timpani','stop','snare','hat','open-hat','tom'].includes(e.kind) && e.seconds >= c.start && e.seconds < c.end).length,
      drop: report.music.drops.some(d => d.at === c.start), silenceWindow: i === 2 ? { ...report.music.silenceWindow, measuredCore:silence, measuredResume:resume } : null };
  });
  assert(scenes[6].rmsDbFS > scenes[2].rmsDbFS + 4,
    `Climax/suspense contrast too small: ${scenes[6].rmsDbFS} / ${scenes[2].rmsDbFS} dBFS.`);
  const drops = report.music.drops.map(d => {
    const before = stats(samples,2,d.at - .018,d.at).rmsDbFS, after = stats(samples,2,d.at,d.at + .12).rmsDbFS;
    assert(after > before + 2, `Drop at ${d.at}s lacks audible contrast.`);
    return { ...d, before18msRmsDbFS:before, after120msRmsDbFS:after, riseDb:round(after - before) };
  });
  // Scan the whole delivered signal for unintended long empty stretches.
  const quietRuns = []; let start = null;
  for (let frame = 0; frame < FRAMES; frame += 480) {
    const quiet = stats(samples,2,frame / SR,Math.min(DURATION,(frame + 480) / SR)).rmsDbFS < -55;
    if (quiet && start === null) start = frame;
    if ((!quiet || frame + 480 >= FRAMES) && start !== null) {
      const end = quiet ? frame + 480 : frame;
      if (end - start >= SR * .1) quietRuns.push({ start:start / SR, end:end / SR, duration:(end - start) / SR });
      start = null;
    }
  }
  assert(quietRuns.every(q => q.start >= 12.93 && q.end <= 13.42 || q.start >= 57.2), 'Unexpected silent passage.');
  return { noVoice:true, musicOriginal:true, duration:DURATION, decodedDuration:samples.length / SR / 2, decodedFrames:samples.length / 2,
    sampleRate:SR, channels:2, bitrate:256000, metadataDuration:containerDuration, metadataPaddingSeconds:round(padding),
    LUFS, truePeakDbTP:truePeak, loudnessRangeLU:Number(measure.input_lra), ...metrics,
    archive:{ file:'master.wav', bits:24, LUFS:Number(waveMeasure.input_i), truePeakDbTP:Number(waveMeasure.input_tp), ...waveMetrics },
    sceneEnergy:scenes, drops, silenceWindow:{ ...report.music.silenceWindow, measuredCore:silence, measuredResume:resume }, quietRuns,
    opening, fade, timing, mastersha256:sha(mp3), storysha256:sha(STORY) };
}

// Rename the validated files with backups. A failure restores an existing published set.
function publish(work, names) {
  const committed = [], backups = [];
  try {
    for (const name of names) {
      const dest = join(AUDIO_DIR,name), backup = join(work,`previous-${name}`);
      if (existsSync(dest)) { renameSync(dest,backup); backups.push({ dest,backup }); }
      renameSync(join(work,name),dest); committed.push(dest);
    }
  } catch (error) {
    for (const dest of committed.reverse()) rmSync(dest,{ force:true });
    for (const { dest,backup } of backups.reverse()) renameSync(backup,dest);
    throw error;
  }
}
function summary(report) {
  return { passed:report.validation.passed, master:join(AUDIO_DIR,'master.mp3'), report:join(AUDIO_DIR,'report.json'),
    noVoice:report.noVoice, original:report.music.original, duration:report.duration, decodedFrames:report.master.decodedFrames,
    sampleRate:report.sampleRate, LUFS:report.LUFS, truePeakDbTP:report.truePeakDbTP, clipping:report.clipping,
    metadataPaddingSeconds:report.master.metadataPaddingSeconds, beatOnsets:report.master.timing.detectedCount,
    bars:report.master.timing.bars.length, maxOnsetErrorSamples:report.master.timing.maxErrorSamples,
    sceneRmsDbFS:report.master.sceneEnergy.map(s => ({ id:s.id, rms:s.rmsDbFS })),
    verifyCommand:`node "${SELF}" --verify` };
}
export async function main() {
  contract(); const tools = getTools();
  if (process.argv.includes('--verify')) {
    const report = JSON.parse(readFileSync(join(AUDIO_DIR,'report.json'),'utf8'));
    const verified = verify(tools,report);
    assert(report.LUFS === verified.LUFS && report.truePeakDbTP === verified.truePeakDbTP && report.clipping === verified.clipping, 'Reported metrics stale.');
    assert(JSON.stringify(report.master) === JSON.stringify(verified), 'Detailed verification report stale.');
    console.log(JSON.stringify(summary(report),null,2)); return report;
  }
  mkdirSync(AUDIO_DIR,{ recursive:true });
  const storyHash = sha(STORY), generatorHash = sha(SELF), work = mkdtempSync(join(AUDIO_DIR,'.stage-'));
  try {
    const music = compose(work), premaster = join(work,'premaster.wav'), prepared = join(work,'prepared.wav');
    ff(tools,['-i',premaster,'-af','highpass=f=25,lowpass=f=17000,acompressor=threshold=0.20:ratio=1.65:attack=18:release=85:makeup=1.05',
      '-ar',String(SR),'-ac','2','-c:a','pcm_f32le',prepared]);
    let target = -11.5, ceiling = -2.4, encodeMeasurement;
    for (let attempt = 0; attempt < 3; attempt++) {
      normalize(tools,prepared,join(work,'master.wav'),target,ceiling);
      ff(tools,['-i',join(work,'master.wav'),'-map_metadata','-1','-c:a','libmp3lame','-b:a','256k','-ar',String(SR),'-ac','2','-write_xing','1','-id3v2_version','3',
        '-metadata',`title=${TITLE}`,'-metadata',`comment=${COMMENT}`,'-metadata',`story_sha256=${storyHash}`,'-metadata',`generator_sha256=${generatorHash}`,
        '-metadata','no_voice=true','-metadata','bpm=150',join(work,'master.mp3')]);
      encodeMeasurement = loudness(tools,join(work,'master.mp3'));
      const measured = Number(encodeMeasurement.input_i), peak = Number(encodeMeasurement.input_tp);
      console.log(`Staged master attempt ${attempt + 1}: ${measured} LUFS / ${peak} dBTP`);
      if (measured >= -12.5 && measured <= -10.8 && peak <= -1.3 && (Math.abs(measured + 11.5) <= .12 || attempt === 2)) break;
      target += clamp(-11.5 - measured,-1.5,1.5); if (peak > -1.3) ceiling -= peak + 1.55;
    }
    const report = { title:TITLE, noVoice:true, duration:DURATION, sampleRate:SR, bpm:BPM, beats:144, bars:36,
      storysha256:storyHash, generatorSha256:generatorHash, mastersha256:sha(join(work,'master.mp3')),
      archiveSha256:sha(join(work,'master.wav')), percussionSha256:sha(join(work,'percussion-timing.wav')), music,
      processing:{ originalNodeDSP:true, externalSamples:false, TTS:false, narrationDucking:false, masterBitReduction:false,
        masterTargetLUFS:-11.5, encodedTruePeakLimitDbTP:-1.3, normalizationTarget:target, preEncodeCeiling:ceiling,
        signalChain:'Float32 mix -> 25Hz highpass / 17kHz lowpass -> gentle 1.65:1 glue -> R128-measured fixed gain -> stereo-linked 192kHz lookahead limiter (latency compensated) -> 48kHz 24-bit PCM -> 256kbps gapless MP3',
        adaptiveLoudnessGain:false, limiter:{ oversampling:4, attackMs:3, releaseMs:65, latencyCompensated:true },
        stereo:'1.9x side gain on tonal bus / 1.6x room width; unchanged mid and centered low end; no master phase delay',
        drumSidechain:'32% depth / 45ms decay on tonal bus only; no narration ducking', fade:{ start:57.2,end:57.6 } },
      provenance:{ music:'Original locally composed and synthesized music, no samples or existing recordings.', speech:'None; subtitle-only film.', createdAt:new Date().toISOString() },
      delivery:{ file:'master.mp3', playback:'Native HTMLAudioElement, local relative audio/master.mp3; no WebAudio/fetch required.', archive:'master.wav', timingWitness:'percussion-timing.wav' } };
    report.master = verify(tools,report,work);
    report.LUFS = report.master.LUFS; report.truePeakDbTP = report.master.truePeakDbTP; report.clipping = report.master.clipping;
    report.sceneEnergy = report.master.sceneEnergy; report.drops = report.master.drops; report.silenceWindow = report.master.silenceWindow;
    report.validation = { passed:true, checkedAt:new Date().toISOString(), stagedBeforePublication:true,
      scope:'Full PCM decode, EBU R128 / oversampled true peak, gapless duration, raw-bus onset detection at sample grain, scene/drop/silence/stereo/fade checks. No claim of human listening or a full browser playback test.' };
    assert(storyHash === sha(STORY) && generatorHash === sha(SELF), 'Story/generator changed during render; not publishing stale audio.');
    json(join(work,'report.json'),report);
    publish(work,['master.wav','percussion-timing.wav','master.mp3','report.json']);
    console.log(JSON.stringify(summary(report),null,2)); return report;
  } finally { rmSync(work,{ recursive:true,force:true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) main().catch(error => { console.error(error.stack); process.exitCode = 1; });