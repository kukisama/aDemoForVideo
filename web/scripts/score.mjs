/**
 * ONE THOUGHT / original procedural score. Node >= 24; no sample libraries.
 * Run from any directory: node <absolute path>/scripts/score.mjs
 * Installed prerequisites only: Python edge_tts + imageio_ffmpeg, ffprobe-static.
 * Existing nonempty narration clips are reused; --force-voice regenerates them.
 * The only persistent outputs are public/audio/score.wav, voice-*.mp3, and a report.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, statSync, mkdirSync, mkdtempSync, rmSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffprobeStatic from 'ffprobe-static';
import { BPM, BEAT, DURATION, VOICE_CUES, seededRandom } from '../src/timeline.ts';

export const AUDIO_DIR = fileURLToPath(new URL('../public/audio/', import.meta.url));
const REPORT = join(AUDIO_DIR, 'score-report.json');
const SR = 48_000;
const FRAMES = Math.round(SR * DURATION);
const TAU = 2 * Math.PI;
const SEED = 0x474f4c44;
const VOICE = 'zh-CN-YunxiNeural';
const ROOM_TAIL = 0.113;
const PROXY_KEYS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy'];
const db = amplitude => 20 * Math.log10(Math.max(amplitude, 1e-12));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

// Never echo command arguments or proxy values, including in network exceptions.
function redact(text) {
  let safe = String(text);
  for (const key of PROXY_KEYS) if (process.env[key]) safe = safe.split(process.env[key]).join('[proxy]');
  return safe.replace(/(?:https?|socks\w*):\/\/[^\s"'<>]+/gi, '[network endpoint]');
}

function run(exe, args, { binary = false, timeout = 180_000 } = {}) {
  const result = spawnSync(exe, args, {
    encoding: binary ? null : 'utf8', windowsHide: true,
    timeout, maxBuffer: 96 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (result.error || result.status !== 0) {
    throw new Error(redact(`${result.error?.message ?? `Exit ${result.status}`}: ${String(result.stderr ?? '').slice(-3500)}`));
  }
  return result.stdout;
}

export function getTools() {
  const python = 'python';
  const ffmpeg = run(python, ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())']).trim();
  requireThat(existsSync(ffmpeg) && existsSync(ffprobeStatic.path), 'Installed FFmpeg/ffprobe not found.');
  return { python, ffmpeg, ffprobe: ffprobeStatic.path };
}

function ff(tools, args) {
  return run(tools.ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-y', ...args]);
}

export function probe(tools, file) {
  const result = JSON.parse(run(tools.ffprobe, [
    '-v', 'error', '-select_streams', 'a:0', '-show_entries',
    'stream=codec_name,sample_rate,channels,bits_per_sample,duration:format=duration,size', '-of', 'json', file,
  ]));
  requireThat(result.streams?.length === 1, `Missing audio stream: ${file}`);
  return { ...result.streams[0], duration: Number(result.format.duration), bytes: Number(result.format.size) };
}

function loudness(tools, file, target = -15, peak = -1.6) {
  const result = spawnSync(tools.ffmpeg, [
    '-hide_banner', '-nostdin', '-i', file, '-af',
    `loudnorm=I=${target}:TP=${peak}:LRA=11:print_format=json`, '-f', 'null', '-',
  ], { encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
  requireThat(result.status === 0, `Loudness analysis failed: ${redact(result.stderr)}`);
  const match = result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  requireThat(match, 'FFmpeg did not produce EBU R128 measurements.');
  const stats = JSON.parse(match[0]);
  requireThat(Number.isFinite(Number(stats.input_i)), `Silent or invalid audio: ${file}`);
  return stats;
}

function normalize(tools, input, output, target, peak) {
  const m = loudness(tools, input, target, peak);
  ff(tools, ['-i', input, '-af',
    `loudnorm=I=${target}:TP=${peak}:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:` +
    `measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,` +
    `aresample=${SR},afade=t=out:st=29.6:d=0.4,apad=whole_dur=${DURATION},atrim=duration=${DURATION}`,
    '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_s24le', '-t', String(DURATION), output]);
}

function sapi(tools, text, output) {
  const text64 = Buffer.from(text, 'utf16le').toString('base64');
  const output64 = Buffer.from(output, 'utf16le').toString('base64');
  const script = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Speech
    $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
      $v = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'zh-CN' } | Select-Object -First 1
      if (-not $v) { throw 'No installed Mandarin SAPI voice; refusing an unrelated language.' }
      $s.SelectVoice($v.VoiceInfo.Name)
      $s.Rate = -1
      $s.SetOutputToWaveFile([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${output64}')))
      $s.Speak([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${text64}')))
      Write-Output ('SAPI:' + $v.VoiceInfo.Name)
    } finally { $s.Dispose() }
  `;
  const shell = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return run(shell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')]).trim();
}

async function narration(tools, work, force) {
  let previous = [];
  if (existsSync(REPORT)) {
    try { previous = JSON.parse(readFileSync(REPORT, 'utf8')).voices ?? []; } catch { /* A report is not required for reuse. */ }
  }
  const voices = [];
  for (const [index, cue] of VOICE_CUES.entries()) {
    const output = join(AUDIO_DIR, cue.file);
    const span = cue.end - cue.at;
    const target = span - ROOM_TAIL - 0.09; // Includes MP3 frame padding and a clean release.
    const reusable = !force && existsSync(output) && statSync(output).size > 512;
    let source = output;
    let engine = 'Existing clip (voice identity unverified)';
    let tempo = 1;
    if (reusable) {
      const old = previous.find(v => v.file === cue.file && v.sha256 === hash(output) && v.text === cue.text);
      if (old) engine = old.voice;
      probe(tools, source); // Corrupt nonzero files must not silently count as narration.
      console.log(`Reuse ${cue.file}`);
    } else {
      source = join(work, `tts-${index}.mp3`);
      const proxy = PROXY_KEYS.map(key => process.env[key]).find(Boolean);
      const routes = [undefined, proxy].filter((v, i) => i === 0 || v);
      let generated = false;
      for (const route of routes) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.log(`Synthesize ${cue.file}: ${VOICE}, ${route ? 'environment proxy' : 'direct'}, attempt ${attempt}`);
            run(tools.python, ['-m', 'edge_tts', '--voice', VOICE, '--rate=-12%', '--pitch=-12Hz',
              '--text', cue.text, '--write-media', source, ...(route ? ['--proxy', route] : [])], { timeout: 90_000 });
            requireThat(existsSync(source) && statSync(source).size > 512, 'TTS returned an empty file.');
            probe(tools, source);
            engine = `${VOICE} (edge-tts; rate=-12%; pitch=-12Hz)`;
            generated = true;
            break;
          } catch (error) { console.warn(`TTS attempt failed: ${redact(error.message)}`); }
        }
        if (generated) break;
      }
      if (!generated) {
        source = join(work, `sapi-${index}.wav`);
        engine = sapi(tools, cue.text, source);
        console.log(`Fallback voice: ${engine}`);
      }
    }
    if (!reusable || probe(tools, source).duration > target) {
      const trimmed = join(work, `trimmed-${index}.wav`);
      ff(tools, ['-i', source, '-af',
        'silenceremove=start_periods=1:start_duration=0.01:start_threshold=-50dB:start_silence=0.025,' +
        'areverse,silenceremove=start_periods=1:start_duration=0.01:start_threshold=-50dB:start_silence=0.055,areverse',
        '-ar', String(SR), '-ac', '1', '-c:a', 'pcm_f32le', trimmed]);
      const rawDuration = probe(tools, trimmed).duration;
      tempo = Math.max(1, rawDuration / (target - 0.055));
      requireThat(tempo <= 1.65, `Narration would need excessive acceleration: ${cue.file} (${tempo.toFixed(3)}x).`);
      const staged = join(work, cue.file);
      ff(tools, ['-i', trimmed, '-af',
        `atempo=${tempo.toFixed(7)},highpass=f=75,lowpass=f=8500,` +
        'acompressor=threshold=0.10:ratio=2.7:attack=8:release=90:makeup=1.3,' +
        'loudnorm=I=-18:TP=-3:LRA=7,afade=t=in:d=0.009',
        '-ar', String(SR), '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '160k', staged]);
      const info = probe(tools, staged);
      requireThat(info.duration + ROOM_TAIL <= span - 0.025, `Voice/reverb exceeds subtitle window: ${cue.file}`);
      renameSync(staged, output);
    }
    const info = probe(tools, output);
    requireThat(info.duration > 0.25 && info.duration + ROOM_TAIL <= span - 0.025, `Invalid voice duration: ${cue.file}`);
    voices.push({ ...cue, voice: engine, tempo, duration: info.duration,
      audibleEndUpperBound: cue.at + info.duration + ROOM_TAIL,
      offsetSamples: Math.round(cue.at * SR), bytes: info.bytes, sha256: hash(output) });
    console.log(`  ${cue.file}: ${info.duration.toFixed(3)}s / ${span.toFixed(3)}s, tempo ${tempo.toFixed(3)}x`);
  }
  return voices;
}

function bus() { return { l: new Float32Array(FRAMES), r: new Float32Array(FRAMES) }; }
function panGains(pan) { return [Math.cos((pan + 1) * Math.PI / 4), Math.sin((pan + 1) * Math.PI / 4)]; }
function blep(phase, step) {
  if (phase < step) { const x = phase / step; return 2 * x - x * x - 1; }
  if (phase > 1 - step) { const x = (phase - 1) / step; return x * x + 2 * x + 1; }
  return 0;
}
function saw(phase, step) { return 2 * phase - 1 - blep(phase, step); }
function wave(file, l, r) {
  const data = Buffer.alloc(44 + FRAMES * 8);
  data.write('RIFF', 0); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(3, 20); data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 8, 28); data.writeUInt16LE(8, 32);
  data.writeUInt16LE(32, 34); data.write('data', 36); data.writeUInt32LE(FRAMES * 8, 40);
  for (let i = 0; i < FRAMES; i++) { data.writeFloatLE(l[i], 44 + i * 8); data.writeFloatLE(r[i], 48 + i * 8); }
  writeFileSync(file, data);
}

function compose(file) {
  requireThat(BPM === 128 && BEAT === 0.46875 && DURATION === 30, 'Shared timeline changed; revise arrangement first.');
  const rng = seededRandom(SEED);
  const noise = () => 2 * rng() - 1;
  const tonal = bus(), drums = bus(), atmosphere = bus(), room = bus(), echo = bus();
  const kickTimes = [];
  const events = { kick: 0, snare: 0, hat: 0, bass: 0, pad: 0, pluck: 0, impact: 0 };
  function voice(target, beat, seconds, pan, level, reverb, delay, render) {
    const start = Math.round(beat * BEAT * SR);
    const length = Math.min(Math.ceil(seconds * SR), FRAMES - start);
    const [gl, gr] = panGains(pan);
    for (let n = 0; n < length; n++) {
      const i = start + n;
      if (i < 0) continue;
      const v = render(n / SR, n) * level;
      target.l[i] += v * gl; target.r[i] += v * gr;
      room.l[i] += v * gl * reverb; room.r[i] += v * gr * reverb;
      echo.l[i] += v * gl * delay; echo.r[i] += v * gr * delay;
    }
  }
  function kick(beat, level = 1) {
    events.kick++; kickTimes.push(beat * BEAT);
    let phase = 0, previous = 0;
    voice(drums, beat, 0.65, 0, level, 0.012, 0, t => {
      phase += TAU * (46 + 118 * Math.exp(-t * 43)) / SR;
      const n = noise(), click = n - previous; previous = n;
      return (Math.sin(phase) * Math.exp(-t * 8.8) * 0.85 +
        Math.sin(phase * 2) * Math.exp(-t * 19) * 0.055 + click * Math.exp(-t * 240) * 0.085) * smooth(t / 0.0015);
    });
  }
  function snare(beat, level = 1, pan = 0) {
    events.snare++;
    let low = 0;
    voice(drums, beat, 0.34, pan, level, 0.18, 0.015, t => {
      const n = noise(); low += 0.16 * (n - low);
      let clap = 0;
      for (const offset of [0, 0.011, 0.026]) if (t >= offset) clap += Math.exp(-(t - offset) * 65) * 0.085;
      return ((n - low) * (0.42 * Math.exp(-t * 22) + clap) +
        (Math.sin(TAU * 185 * t) * 0.21 + Math.sin(TAU * 333 * t) * 0.055) * Math.exp(-t * 34)) * smooth(t / 0.001);
    });
  }
  function hat(beat, level, open = false, pan = 0) {
    events.hat++;
    let low = 0;
    const duration = open ? 0.26 : 0.085;
    voice(drums, beat, duration, pan, level, open ? 0.13 : 0.045, 0, t => {
      const n = noise(); low += 0.61 * (n - low);
      const metal = Math.sin(TAU * 7319 * t) * Math.sin(TAU * 10483 * t);
      return ((n - low) * 0.70 + metal * 0.12) * Math.exp(-t * (open ? 19 : 78)) * smooth(t / 0.0007);
    });
  }
  function tom(beat, midi, level, pan) {
    let phase = 0;
    voice(drums, beat, 0.36, pan, level, 0.16, 0.06, t => {
      phase += TAU * hz(midi) * (1 + 0.6 * Math.exp(-t * 35)) / SR;
      return (Math.sin(phase) + noise() * 0.07 * Math.exp(-t * 60)) * Math.exp(-t * 13) * smooth(t / 0.001);
    });
  }
  function bass(beat, midi, beats, level) {
    events.bass++;
    let a = 0, b = 0.2, low = 0, sub = 0;
    const duration = beats * BEAT, f = hz(midi), da = f * 0.998 / SR, dbb = f * 1.002 / SR;
    voice(tonal, beat, duration + 0.055, 0, level, 0.014, 0, t => {
      a = (a + da) % 1; b = (b + dbb) % 1; sub += TAU * f * 0.5 / SR;
      const raw = 0.43 * (saw(a, da) + saw(b, dbb)) + 0.25 * Math.sin(sub * 2);
      const cutoff = 220 + 1850 * Math.exp(-t * 17);
      low += (1 - Math.exp(-TAU * cutoff / SR)) * (raw - low);
      const envelope = smooth(t / 0.004) * (t <= duration ? 1 : 1 - smooth((t - duration) / 0.055));
      return (Math.tanh(low * 1.8) * 0.62 + Math.sin(sub) * 0.25) * envelope;
    });
  }
  function pad(beat, notes, beats, level, bright = false, stab = false) {
    events.pad++;
    const duration = beats * BEAT, release = stab ? 0.13 : 0.55;
    notes.forEach((note, index) => {
      const pan = -0.78 + index / Math.max(1, notes.length - 1) * 1.56;
      const f = hz(note), da = f * 0.996 / SR, dbb = f * 1.004 / SR, dc = f / SR;
      let a = rng(), b = rng(), c = rng(), low = 0;
      voice(tonal, beat, duration + release, pan, level, stab ? 0.20 : 0.43, stab ? 0.12 : 0.045, t => {
        a = (a + da) % 1; b = (b + dbb) % 1; c = (c + dc) % 1;
        const raw = (saw(a, da) + saw(b, dbb)) * 0.32 + Math.sin(c * TAU) * 0.36;
        const cutoff = stab ? 700 + 3300 * Math.exp(-t * 13) : (bright ? 2400 : 720) + 350 * Math.sin(t * 1.3 + index);
        low += (1 - Math.exp(-TAU * cutoff / SR)) * (raw - low);
        const envelope = smooth(t / (stab ? 0.008 : 0.18)) *
          (t < duration ? 1 : 1 - smooth((t - duration) / release));
        const shimmer = 0.89 + 0.11 * Math.sin(TAU * 0.21 * t + index);
        return low * envelope * shimmer;
      });
    });
  }
  function pluck(beat, midi, level, pan = 0, lead = false) {
    events.pluck++;
    const f = hz(midi);
    voice(tonal, beat, lead ? 1.15 : 0.58, pan, level, 0.30, lead ? 0.48 : 0.34, t => {
      const attack = smooth(t / 0.003);
      return attack * (Math.sin(TAU * f * t) * Math.exp(-t * (lead ? 4 : 10)) +
        0.34 * Math.sin(TAU * f * 2.003 * t) * Math.exp(-t * 16) +
        0.16 * Math.sin(TAU * f * 3.997 * t) * Math.exp(-t * 26));
    });
  }
  function impact(beat, level) {
    events.impact++;
    let phase = 0, low = 0;
    voice(atmosphere, beat, 2.0, -0.10, level, 0.42, 0.04, t => {
      const n = noise(); low += 0.16 * (n - low);
      phase += TAU * (34 + 80 * Math.exp(-t * 12)) / SR;
      return smooth(t / 0.002) * (Math.sin(phase) * Math.exp(-t * 3.7) * 0.6 +
        (n - low) * Math.exp(-t * 5) * 0.17 + low * Math.exp(-t * 3) * 0.32);
    });
    // Independent airy stereo debris, not a reused crash sample.
    voice(atmosphere, beat, 1.6, 0.7, level * 0.13, 0.5, 0.1,
      t => noise() * Math.exp(-t * 5.5) * smooth(t / 0.004));
  }
  function riser(beat, beats, level) {
    const duration = beats * BEAT;
    let low = 0, previous = 0, phase = 0;
    voice(atmosphere, beat, duration, 0.28, level, 0.20, 0.15, t => {
      const p = t / duration, n = noise();
      low += (1 - Math.exp(-TAU * (400 + 8000 * p * p) / SR)) * (n - low);
      const high = low - previous; previous += 0.025 * (low - previous);
      phase += TAU * (90 * 2 ** (p * 4.4)) / SR;
      const gate = 0.68 + 0.32 * Math.sin(TAU * (t / BEAT * 2 + p * p * 7));
      return p ** 1.8 * gate * (high * 0.40 + Math.sin(phase) * 0.065) * (1 - smooth((p - 0.985) / 0.015));
    });
  }

  // 0–8: almost empty D-minor genesis, with a quiet, evolving analog sub bed.
  voice(atmosphere, 0, 16 * BEAT, 0, 0.23, 0.21, 0, t => {
    const fade = smooth(t / 0.9) * (1 - smooth((t - 6.7) / 0.8));
    return fade * (Math.sin(TAU * hz(26) * t) * 0.58 + Math.sin(TAU * hz(38) * t + 0.1 * Math.sin(t)) * 0.26 +
      Math.sin(TAU * hz(45) * t) * 0.12) * (0.85 + 0.15 * Math.sin(t * 0.55));
  });
  pad(0, [50, 57, 65, 76], 15.5, 0.052);
  kick(0, 0.26); kick(4, 0.17);
  pluck(2.75, 86, 0.043, -0.7); pluck(6.5, 81, 0.055, 0.62);
  // 8–16: increasing subdivisions, a tuned pulse, and a continuous noise/pitch ascent.
  riser(8, 8, 0.8);
  for (let b = 8; b < 16;) {
    const step = b < 12 ? 0.5 : b < 14 ? 0.25 : 0.125;
    hat(b, 0.07 + (b - 8) * 0.01, false, b % 1 < 0.5 ? -0.35 : 0.4);
    if (b % 1 === 0) pluck(b, b % 2 === 0 ? 74 : 81, 0.048, b % 2 ? 0.35 : -0.35);
    b += step;
  }
  for (const b of [14, 14.5, 15, 15.25, 15.5, 15.75]) snare(b, 0.12 + (b - 14) * 0.14, 0.05);

  const harmony = [
    { name: 'Dm(add9)', root: 38, notes: [50, 57, 65, 69, 76], arp: [74, 77, 81, 84, 88] },
    { name: 'Bbmaj7', root: 34, notes: [46, 53, 57, 62, 65], arp: [70, 74, 77, 81, 86] },
    { name: 'Fmaj9', root: 41, notes: [48, 53, 57, 64, 67], arp: [69, 72, 77, 79, 84] },
    { name: 'C/D', root: 38, notes: [50, 55, 60, 64, 67], arp: [72, 76, 79, 81, 86] },
  ];
  const arpOrder = [0, 2, 1, 3, 2, 4, 1, 2, 0, 3, 2, 4, 1, 3, 2, 1];
  for (let bar = 0; bar < 8; bar++) {
    const start = 16 + bar * 4, second = bar >= 4, chord = harmony[bar % 4];
    const kicks = second ? [0, 0.75, 1.5, 2, 2.75, 3.5] : [0, 1.5, 2, 2.75];
    for (const offset of kicks) kick(start + offset, offset % 1 ? 0.79 : 0.98);
    // Backbeats 1 and 3, with occasional quiet ghost notes rather than identical loops.
    snare(start + 1, second ? 1.03 : 0.94); snare(start + 3, second ? 1.10 : 1.0);
    if (bar % 2) snare(start + 2.75, 0.23, -0.16);
    for (let step = 0; step < 16; step++) {
      if (!second && step % 2 && step % 4 !== 3) continue;
      const swing = step % 2 ? 0.028 : 0;
      const velocity = (step % 4 === 2 ? 0.17 : step % 2 ? 0.079 : 0.12) * (0.87 + rng() * 0.26);
      hat(start + step / 4 + swing, velocity, step % 8 === 6, step % 2 ? 0.48 : -0.38);
    }
    for (const [n, offset] of [0.25, 0.875, 1.75, 2.375, 3, 3.625].entries()) {
      const note = chord.root + (n === 5 && bar % 2 ? 12 : n === 3 && second ? 7 : 0);
      bass(start + offset, note, n % 2 ? 0.30 : 0.48, second ? 0.39 : 0.34);
    }
    pad(start, chord.notes, 3.85, second ? 0.073 : 0.059, second);
    for (const offset of [0, 1.5, 2.5, 3.25]) pad(start + offset, chord.notes.slice(1), 0.34, second ? 0.095 : 0.070, true, true);
    const steps = second ? 16 : 8;
    for (let n = 0; n < steps; n++) {
      if (second && [3, 7, 14].includes(n)) continue;
      pluck(start + n * (second ? 0.25 : 0.5) + (n % 2 ? 0.018 : 0),
        chord.arp[arpOrder[n]], (n % 4 === 0 ? 0.088 : 0.057) * (second ? 1.12 : 1), n % 2 ? 0.56 : -0.56);
    }
    if (bar === 0 || bar === 4) impact(start, second ? 0.95 : 0.80);
    if (bar === 3 || bar === 7) {
      for (let n = 0; n < 4; n++) tom(start + 3 + n / 4, 50 - n * 3, 0.19 + n * 0.04, -0.6 + n * 0.4);
    }
  }
  riser(30, 2, 0.63);
  // A composed upper-register motif, answered and expanded in the second drop.
  for (const [beat, note, level] of [
    [17.5, 74, 0.12], [18.75, 77, 0.11], [20.5, 74, 0.10], [22.5, 70, 0.10],
    [24, 69, 0.11], [25.5, 72, 0.10], [28, 76, 0.12], [30, 74, 0.095],
    [33.5, 86, 0.12], [34.75, 89, 0.105], [36.5, 86, 0.11], [38.5, 82, 0.10],
    [40, 81, 0.12], [41.5, 84, 0.10], [44, 88, 0.11], [46, 86, 0.12],
  ]) pluck(beat, note, level, beat % 2 ? -0.18 : 0.18, true);

  // 48–50: no new notes. The return stage below permits only a short cinematic tail.
  // 50: the largest impact; broad half-time cadence resolves C/D back to D minor.
  impact(50, 1.40); kick(50, 1.15);
  for (const [beat, chordIndex, beats] of [[50, 0, 4], [54, 1, 4], [58, 2, 2], [60, 3, 2], [62, 0, 2]]) {
    const chord = harmony[chordIndex];
    pad(beat, chord.notes, beats - 0.03, beat === 62 ? 0.15 : 0.145, true);
    pad(beat, chord.notes.slice(1).map(n => n + 12), beats - 0.05, 0.042, true);
    bass(beat, chord.root, beats - 0.25, 0.30);
    pluck(beat, chord.arp[0], 0.17, -0.24, true);
    pluck(beat + 0.75, chord.arp[2], 0.095, 0.38, true);
  }
  for (const b of [54, 58, 60]) kick(b, b === 54 ? 0.82 : 0.52);
  for (const b of [52, 56, 60]) { snare(b, 0.46); tom(b, 38, 0.26, -0.15); }
  for (let b = 50.5; b < 62; b += 0.5) hat(b, b < 56 ? 0.10 : 0.065, b % 2 === 0.5, b % 1 ? 0.4 : -0.4);
  pluck(62, 86, 0.13, 0.12, true); pluck(62.5, 81, 0.06, -0.4, true);

  console.log(`DSP voices: ${JSON.stringify(events)}`);
  // Damped ping-pong delay into a six-comb stereo room with all-pass diffusion.
  const delayL = new Float32Array(Math.round(SR * BEAT * 0.75));
  const delayR = new Float32Array(Math.round(SR * BEAT * 1.25));
  const combs = [0.0297, 0.0371, 0.0411, 0.0437, 0.0531, 0.0617].map((t, n) => ({
    l: new Float32Array(Math.round(t * SR)), r: new Float32Array(Math.round((t * 1.037 + n * 0.00013) * SR)),
    il: 0, ir: 0, lowL: 0, lowR: 0, feedback: 0.77 - n * 0.014,
  }));
  const allpasses = [0.005, 0.0017].map(t => ({
    l: new Float32Array(Math.round(t * SR)), r: new Float32Array(Math.round(t * SR * 1.07)), il: 0, ir: 0,
  }));
  let dl = 0, dr = 0, delayLowL = 0, delayLowR = 0, kickIndex = -1;
  let dcL = 0, dcR = 0, priorL = 0, priorR = 0, peak = 0;
  const out = bus();
  kickTimes.sort((a, b) => a - b);
  for (let i = 0; i < FRAMES; i++) {
    const t = i / SR;
    if (i === Math.round(50 * BEAT * SR)) {
      delayL.fill(0); delayR.fill(0); delayLowL = delayLowR = 0;
      for (const c of combs) { c.l.fill(0); c.r.fill(0); c.lowL = c.lowR = 0; }
      for (const a of allpasses) { a.l.fill(0); a.r.fill(0); }
    }
    while (kickIndex + 1 < kickTimes.length && kickTimes[kickIndex + 1] <= t) kickIndex++;
    const sinceKick = kickIndex >= 0 ? t - kickTimes[kickIndex] : 10;
    const pump = t >= 16 * BEAT && t < 48 * BEAT ? 1 - 0.68 * Math.exp(-sinceKick / 0.115) : 1;
    delayLowL += 0.17 * (delayL[dl] - delayLowL); delayLowR += 0.17 * (delayR[dr] - delayLowR);
    delayL[dl] = echo.l[i] * pump + delayLowR * 0.36;
    delayR[dr] = echo.r[i] * pump + delayLowL * 0.36;
    dl = (dl + 1) % delayL.length; dr = (dr + 1) % delayR.length;
    let wetL = 0, wetR = 0;
    for (const c of combs) {
      const l = c.l[c.il], r = c.r[c.ir];
      c.lowL += 0.24 * (l - c.lowL); c.lowR += 0.24 * (r - c.lowR);
      c.l[c.il] = room.l[i] * pump + delayLowL * 0.2 + c.lowL * c.feedback;
      c.r[c.ir] = room.r[i] * pump + delayLowR * 0.2 + c.lowR * c.feedback;
      c.il = (c.il + 1) % c.l.length; c.ir = (c.ir + 1) % c.r.length;
      wetL += l / combs.length; wetR += r / combs.length;
    }
    for (const a of allpasses) {
      const l = a.l[a.il], r = a.r[a.ir];
      a.l[a.il] = wetL + l * 0.5; a.r[a.ir] = wetR + r * 0.5;
      wetL = l - wetL * 0.5; wetR = r - wetR * 0.5;
      a.il = (a.il + 1) % a.l.length; a.ir = (a.ir + 1) % a.r.length;
    }
    let duck = 1;
    for (const cue of VOICE_CUES) {
      const depth = cue.at < 7.5 ? 0.46 : 0.34;
      const ingress = smooth((t - cue.at + 0.14) / 0.14);
      const egress = 1 - smooth((t - cue.end - 0.03) / 0.20);
      duck = Math.min(duck, 1 - (1 - depth) * ingress * egress);
    }
    let gate = 1;
    if (t >= 48 * BEAT && t < 50 * BEAT) {
      const gap = t - 48 * BEAT;
      gate = gap >= 0.48 ? 0 : Math.exp(-gap * 23) * (1 - smooth((gap - 0.32) / 0.16));
    }
    const endFade = 1 - smooth((t - 29.6) / 0.4);
    const l = (tonal.l[i] * pump + drums.l[i] + atmosphere.l[i] + wetL * 0.7 + delayLowL * 0.62) * duck * gate * endFade;
    const r = (tonal.r[i] * pump + drums.r[i] + atmosphere.r[i] + wetR * 0.7 + delayLowR * 0.62) * duck * gate * endFade;
    // 12 Hz DC rejection before normalization, with no hard limiting/clipping.
    dcL = l - priorL + 0.99843 * dcL; dcR = r - priorR + 0.99843 * dcR; priorL = l; priorR = r;
    out.l[i] = dcL; out.r[i] = dcR;
    peak = Math.max(peak, Math.abs(dcL), Math.abs(dcR));
  }
  const gain = 0.86 / Math.max(peak, 0.01);
  for (let i = 0; i < FRAMES; i++) { out.l[i] *= gain; out.r[i] *= gain; }
  wave(file, out.l, out.r);
  return { seed: SEED, events, preGainPeak: peak, synthesisGain: gain,
    source: 'All instruments, percussion, impacts, and ambience synthesized in Node DSP; no samples.',
    arrangement: [
      { beats: [0, 8], role: 'D-minor drone, sparse glass motif' },
      { beats: [8, 16], role: 'Accelerating hats, snare roll, noise/pitch riser' },
      { beats: [16, 32], role: 'Syncopated drop: Dm(add9), Bbmaj7, Fmaj9, C/D' },
      { beats: [32, 48], role: 'Second drop: denser sixteenth arp, upper motif, fuller chords' },
      { beats: [48, 50], role: 'Short cinematic decay, then silence; no new notes' },
      { beats: [50, 64], role: 'Final impact, Dm–Bb–F–C/D–Dm cadence; fade 29.6–30s' },
    ] };
}

export function audioMetrics(tools, file, channels = 2) {
  const data = run(tools.ffmpeg, ['-v', 'error', '-nostdin', '-i', file, '-ar', String(SR),
    '-ac', String(channels), '-f', 'f32le', '-c:a', 'pcm_f32le', '-'], { binary: true });
  const samples = new Float32Array(data.buffer, data.byteOffset, data.length / 4);
  const frames = samples.length / channels;
  let peak = 0, energy = 0, clipped = 0, nonfinite = 0, sum = 0, cross = 0, left = 0, right = 0, side = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    if (!Number.isFinite(v)) nonfinite++;
    peak = Math.max(peak, Math.abs(v)); energy += v * v; sum += v;
    if (Math.abs(v) >= 1) clipped++;
    if (channels === 2 && i % 2 === 0) {
      const r = samples[i + 1]; left += v * v; right += r * r; cross += v * r; side += (v - r) ** 2;
    }
  }
  function window(start, end) {
    let e = 0, p = 0, count = 0;
    for (let i = Math.round(start * SR) * channels; i < Math.min(samples.length, Math.round(end * SR) * channels); i++) {
      e += samples[i] ** 2; p = Math.max(p, Math.abs(samples[i])); count++;
    }
    return { rmsDb: db(Math.sqrt(e / Math.max(1, count))), peakDb: db(p) };
  }
  return { frames, peakDb: db(peak), rmsDb: db(Math.sqrt(energy / samples.length)), clipped, nonfinite,
    dc: sum / samples.length, correlation: channels === 2 ? cross / Math.sqrt(left * right) : 1,
    sideRmsDb: channels === 2 ? db(Math.sqrt(side / frames) / 2) : null,
    gap: window(23.05, 23.40), firstDrop: window(7.5, 8.0), secondDrop: window(15, 15.5),
    finalImpact: window(23.4375, 23.90), finalFade: window(29.995, 30),
    intro: window(0.05, 0.45) };
}

export function verifyMaster(tools, file) {
  const info = probe(tools, file), measured = loudness(tools, file), metrics = audioMetrics(tools, file);
  requireThat(info.sample_rate === String(SR) && info.channels === 2, 'Master must be 48 kHz stereo.');
  requireThat(info.codec_name === 'pcm_s24le', 'Master must be 24-bit PCM WAV.');
  requireThat(Math.abs(info.duration - DURATION) < 1 / SR && metrics.frames === FRAMES, 'Master is not exactly 1,440,000 frames / 30 seconds.');
  requireThat(metrics.clipped === 0 && metrics.nonfinite === 0, 'Clipping or nonfinite PCM detected.');
  requireThat(Number(measured.input_tp) <= -1.5, `Master exceeds -1.5 dBTP: ${measured.input_tp}`);
  requireThat(Math.abs(Number(measured.input_i) + 15) <= 1, `Master is not near -15 LUFS: ${measured.input_i}`);
  requireThat(metrics.gap.rmsDb < -65, `Beat 48–50 silence missing: ${metrics.gap.rmsDb.toFixed(1)} dBFS`);
  requireThat(metrics.correlation < 0.995 && metrics.sideRmsDb > -45, 'Master is effectively mono.');
  requireThat(metrics.finalFade.rmsDb < -65, 'End fade does not reach silence.');
  requireThat(metrics.firstDrop.rmsDb > metrics.intro.rmsDb + 3, 'First drop lacks contrast with the intro.');
  requireThat(metrics.secondDrop.peakDb > -12 && metrics.finalImpact.peakDb > -8, 'Drop/final impact missing.');
  return { ...info, integratedLUFS: Number(measured.input_i), truePeakDbTP: Number(measured.input_tp),
    loudnessRangeLU: Number(measured.input_lra), ...metrics };
}

export function verifyVoices(tools, voices) {
  return VOICE_CUES.map(cue => {
    const file = join(AUDIO_DIR, cue.file), info = probe(tools, file), metrics = audioMetrics(tools, file, 1);
    requireThat(info.bytes > 512 && info.duration > 0.25 && metrics.rmsDb > -40, `Empty/silent narration: ${cue.file}`);
    requireThat(metrics.nonfinite === 0 && metrics.clipped === 0, `Clipped narration: ${cue.file}`);
    requireThat(info.duration + ROOM_TAIL <= cue.end - cue.at - 0.025, `Narration/reverb overlaps cue end: ${cue.file}`);
    const record = voices.find(v => v.file === cue.file);
    requireThat(record && record.sha256 === hash(file) && record.text === cue.text &&
      record.at === cue.at && record.end === cue.end && record.offsetSamples === Math.round(cue.at * SR), `Narration provenance/timing mismatch: ${cue.file}`);
    return { file: cue.file, duration: info.duration, peakDb: metrics.peakDb, rmsDb: metrics.rmsDb,
      endMargin: cue.end - cue.at - info.duration - ROOM_TAIL };
  });
}

async function main() {
  mkdirSync(AUDIO_DIR, { recursive: true });
  const tools = getTools();
  const work = mkdtempSync(join(AUDIO_DIR, '.score-work-'));
  try {
    const voices = await narration(tools, work, process.argv.includes('--force-voice'));
    console.log('Compose original 64-beat stereo score at 48 kHz…');
    const raw = join(work, 'synthesis.wav'), music = join(work, 'music.wav');
    const composition = compose(raw);
    normalize(tools, raw, music, -17.5, -3.5);
    const inputs = ['-i', music];
    for (const cue of VOICE_CUES) inputs.push('-i', join(AUDIO_DIR, cue.file));
    const filters = VOICE_CUES.map((cue, index) => {
      const span = cue.end - cue.at;
      return `[${index + 1}:a]aresample=${SR},aecho=0.95:1:37|71|113:0.08|0.045|0.025,` +
        `apad=whole_dur=${span},atrim=duration=${span},afade=t=out:st=${span - 0.035}:d=0.035,` +
        `pan=stereo|c0=c0|c1=c0,adelay=${Math.round(cue.at * SR)}S:all=1[v${index}]`;
    });
    filters.push(`[0:a]${VOICE_CUES.map((_, i) => `[v${i}]`).join('')}amix=inputs=6:duration=first:normalize=0:dropout_transition=0,` +
      'acompressor=threshold=0.63:ratio=1.5:attack=18:release=140:makeup=1:mix=0.65,' +
      `apad=whole_dur=${DURATION},atrim=duration=${DURATION}[master]`);
    const premaster = join(work, 'premaster.wav'), final = join(work, 'score.wav');
    ff(tools, [...inputs, '-filter_complex', filters.join(';'), '-map', '[master]',
      '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_f32le', premaster]);
    normalize(tools, premaster, final, -15, -1.6);
    const verification = verifyMaster(tools, final);
    const voiceVerification = verifyVoices(tools, voices);
    // Publish only after all audio checks pass; never expose a partial master.
    renameSync(final, join(AUDIO_DIR, 'score.wav'));
    const report = {
      title: '一念 / Genesis', bpm: BPM, beatSeconds: BEAT, duration: DURATION, sampleRate: SR,
      composition, voices, voiceVerification, master: verification,
      masterSha256: hash(join(AUDIO_DIR, 'score.wav')),
      narrationProcessing: '75 Hz high-pass, 8.5 kHz low-pass, 2.7:1 compression, -18 LUFS clips; subtle 37/71/113 ms room in master.',
      musicProcessing: 'Kick sidechain, stereo damped delay/reverb; speech-window duck -6.7 to -9.4 dB; two-pass loudness normalization.',
      masterProcessing: 'Gentle parallel bus compression; two-pass -15 LUFS / -1.6 dBTP target; 24-bit stereo PCM, final fade.',
    };
    writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ output: join(AUDIO_DIR, 'score.wav'), master: verification,
      voices: voices.map(v => ({ file: v.file, voice: v.voice, duration: v.duration, bytes: v.bytes })) }, null, 2));
  } finally { rmSync(work, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(redact(error.stack ?? error)); process.exitCode = 1; });
}