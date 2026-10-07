/**
 * 赶路的人 — original four-bar theme and its narrative transformations.
 * Offline, deterministic oscillator/noise DSP; no voice, samples or network.
 * node shortcut/score.mjs          compose, master, verify, then publish
 * node shortcut/score.mjs --verify  read-only verification of published files
 * Only the installed FFmpeg and ffprobe are used; no new dependencies.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TITLE, DURATION, BPM, BEAT, TOTAL_BEATS, CHAPTERS, AUDIO_CUES } from './story.mjs';

const ROOT = fileURLToPath(new URL('./', import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const STORY = join(ROOT, 'story.mjs');
export const AUDIO_DIR = join(ROOT, 'audio');
export const QA_DIR = join(ROOT, 'output', 'audio-qa');
export const SR = 48000, FRAMES = 2880000, SPB = 22500;
const TAU = 2 * Math.PI, SEED = 0x524f5554;
const COMMENT = 'Original local oscillator/noise composition; no voice, TTS, samples, downloaded or borrowed music; 128 BPM.';
const require = createRequire(new URL('../web/package.json', import.meta.url));
const must = (ok, message) => { if (!ok) throw new Error(message); };
const clamp = x => Math.min(1, Math.max(0, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const db = x => 20 * Math.log10(Math.max(1e-12, x));
const round = x => Math.round(x * 1e6) / 1e6;
export const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const stereo = () => ({ l: new Float32Array(FRAMES), r: new Float32Array(FRAMES) });

// New melody: two little steps, a suspended second, then a fourth-sized reach.
// G–Bb–A–D–C–Bb–G is NOT the E–B–E–G theme of the older film.
// Tuple = [beat within bar, MIDI note, gate in beats]. Four-bar question/answer.
export const THEME = [
  [[0,79,.28],[.5,82,.28],[1,81,.65],[2,86,.58],[2.75,84,.18],[3,82,.28],[3.5,79,.32]],
  [[0,77,.28],[.5,81,.28],[1,79,.68],[2,82,.6],[2.75,81,.18],[3,77,.28],[3.5,74,.32]],
  [[0,79,.28],[.5,82,.28],[1,81,.68],[2,86,.3],[2.5,89,.32],[3,86,.68]],
  [[0,84,.6],[.75,82,.18],[1,81,.6],[2,78,.65],[3,81,.25],[3.5,79,.32]],
];
export const majorNote = midi => [3,5,10].includes(midi % 12) ? midi + 1 : midi;
const CHORDS = {
  Gm: [43,[55,58,62,69]], Eb: [39,[55,58,63,67]], Bb: [46,[53,58,62,65]],
  F: [41,[53,57,60,67]], Cm: [36,[55,60,63,67]], D: [38,[54,57,62,69]],
  Gsus: [43,[55,57,60,62]], Gclog: [43,[55,56,58,62]], Dtense: [38,[54,57,60,63]],
  G: [43,[55,59,62,69]], C: [36,[55,60,64,67]], Em: [40,[55,59,64,66]],
  G6: [43,[55,59,62,64]],
};
const PROGRESSION = [
  'Gm','F','Eb','D', 'Gm','Bb','Cm','D', 'Bb','F','Eb','D', 'Gm','Gm','Cm','Dtense',
  'Gclog','Gclog','Dtense','Dtense', 'Gsus','Cm','D','D', 'G','D','C','D',
  'G6','C','Em','G6',
];
const INTENTS = [
  '愿望：首秒以两次短音、悬停的A、向D跃进提出四小节主题；留出想象，不用音效抢开场。',
  '均衡：主题低八度在左右声部轮答，八分音符低音维持两条路的稳定流动。',
  '近路：转向Bb大调色彩，高音区回答与较轻的分解和弦制造诱惑；还不是结尾的G大调。',
  '蜂拥：主题缩短、同一碎片轮流加入，十六分音符不断挤占间隙，速度始终128BPM。',
  '堵塞：30秒强拍、低鼓与收窄的G–Ab摩擦；主题被挤成重复短音，强度与密度达到峰值。',
  '重想：37.5–38.4375秒两拍全静音，随后稀疏的主题音回归；重新连接而非继续加速。',
  '分流：45秒主题原节奏再现，Bb→B、F→F#、Eb→E真正改音，G大调打开空间。',
  '意义：48.75秒延续大调回答，52.5秒旋律降八度、时值舒展、鼓点减半，加入六度和弦。',
  '远方：E小调九度色彩回到温暖G6；D–B–G收束，保留向前的脉搏，59.15秒起平滑淡出。',
];

export function assertContract() {
  must(TITLE === '赶路的人' && DURATION === 60 && BPM === 128 && BEAT === .46875 && TOTAL_BEATS === 128,
    'Story contract requires 赶路的人 / 60s / 128BPM / 128 beats.');
  const boundaries = [0,7.5,15,22.5,30,37.5,45,48.75,56.25,60];
  const ids = ['wish','balance','shortcut','rush','gridlock','rethink','release','meaning','horizon'];
  must(CHAPTERS.length === 9 && CHAPTERS.every((c,i) => c.id === ids[i] && c.start === boundaries[i] &&
    c.end === boundaries[i + 1] && c.bars === (c.end - c.start) / (4 * BEAT)), 'Chapter boundaries/bars changed.');
  must(AUDIO_CUES.silenceStart === 37.5 && AUDIO_CUES.silenceEnd === 38.4375 && AUDIO_CUES.gridlock === 30 &&
    AUDIO_CUES.release === 45 && AUDIO_CUES.reflection === 52.5 && AUDIO_CUES.fadeStart === 59.15 && AUDIO_CUES.end === 60,
    'Narrative music cue mismatch.');
}
function writableDirectory(path) {
  const full = resolve(path), rel = relative(ROOT, full);
  must(!isAbsolute(rel) && !rel.startsWith('..') && (rel === 'audio' || rel.startsWith(`audio${sep}`) ||
    rel === join('output','audio-qa') || rel.startsWith(join('output','audio-qa') + sep) ||
    /^\.score-work-[^\\/]+(?:[\\/]|$)/.test(rel)), `Refusing write outside audio scope: ${full}`);
  mkdirSync(full, { recursive: true }); return full;
}

// Score generation is separate from synthesis, so timing and real tonal changes
// can be independently checked, not inferred from narrative labels.
export function buildScore() {
  assertContract();
  const events = [];
  function add(kind, beat, midi, gate, gain, pan = 0, role = kind) {
    const sample = Math.round(beat * SPB);
    must(sample >= 0 && sample < FRAMES && gate > 0, `Invalid ${kind} event at beat ${beat}`);
    must(beat < 80 || beat >= 82, `Event scheduled inside the two-beat rest: ${beat}`);
    events.push({ kind, beat, sample, midi, gate, gain: round(gain), pan, role });
  }
  const lead = (beat,midi,gate,gain=.25,pan=-.06,role='theme') => add('pulse',beat,midi,gate,gain,pan,role);
  for (let bar = 0; bar < 32; bar++) {
    const origin = bar * 4, time = origin * BEAT;
    const act = CHAPTERS.findIndex(c => time >= c.start && time < c.end);
    const local = bar - Math.round(CHAPTERS[act].start / (4 * BEAT));
    const [root, tones] = CHORDS[PROGRESSION[bar]];
    const quiet = act === 5, crowded = act === 3 || act === 4, closing = bar >= 28;
    const from = bar === 20 ? 2 : 0;
    const energy = [0.82,0.86,0.94,1.03,1.4,.40,1.08,.96,.78][act];
    // No four-to-the-floor boilerplate throughout: each route has its own gait.
    const kickBeats = quiet ? (bar === 20 ? [] : [0]) : closing ? [0,2.5] :
      act === 4 ? [0,1,2,2.75,3.5] : act === 3 ? [0,1.5,2,3.5] : [0,2];
    for (const at of kickBeats) add('kick',origin+at,root, .32, .54*energy*(at===0?1:.83));
    if (!quiet && bar < 31) for (const at of closing ? [3] : [1,3])
      add('snare',origin+at,0,.28,.30*energy,at===1?-.08:.08);
    if (act === 3 && local === 3) for (const at of [2.5,2.75,3.25,3.5,3.75])
      add('snare',origin+at,0,.12,.18+(at-2.5)*.12,(at%1<.5?-.3:.3),'convergence-roll');
    if (act === 4 && local === 0) {
      add('tom',origin,31,.8,.7,0,'climax-low-drum');
      add('snare',origin,0,.5,.42,0,'climax-accent');
    }
    const hatStep = crowded ? .25 : closing ? 1 : .5;
    if (!quiet) for (let at=bar===0?1:0; at<4; at+=hatStep)
      add('hat',origin+at,0,.085,(at%1===.5?.115:.075)*energy,at%.5===0?.66:-.66);
    const bassStep = quiet ? 2 : closing ? 1 : .5;
    for (let at=from; at<4; at+=bassStep)
      add('bass',origin+at,root+(crowded && at%1===.5?12:0),quiet?.7:closing?.7:.34,.31*energy);
    for (let ix=0; ix<tones.length; ix++) {
      const p = [-.86,.65,-.5,.88][ix];
      add('pad',origin+from,tones[ix],quiet?1.25:closing?3.55:3.45,.085*energy,p);
    }
    if (act === 4) for (const at of [0,1.5,2,3])
      for (const [ix,m] of [root+12,root+19].entries())
        add('pulse',origin+at,m,.22,.085,-.7+ix*1.4,'bottleneck-chord');
    if (!quiet && !closing) {
      const step = crowded?.25:.5;
      const order = crowded ? [0,1,0,2,0,3,1,0] : [0,2,1,3,2,1,3,2];
      for (let at=.25; at<4; at+=step) {
        const ix=Math.round((at-.25)/step), midi=tones[order[ix%8]]+12;
        add('pluck',origin+at,midi,step*.66,(crowded?.08:.065)*energy,ix%2?.75:-.75,'route-arpeggio');
      }
    }

    if (act === 5) {
      // The first lead note AFTER the exact rest is a questioning G4.
      const question = [
        [[2,67,.72],[3.25,69,.38]], [[0,70,.65],[1.5,67,.7],[3,62,.6]],
        [[0,66,.65],[1,69,.65],[2.5,74,.9]], [[0,69,.6],[1.5,74,.6],[3,78,.55]],
      ];
      for (const [at,m,g] of question[local]) lead(origin+at,m,g,.135,at<2?-.24:.24,'reconnection');
      continue;
    }
    if (closing) {
      const warm = [
        [[0,67,.72],[1,71,.72],[2,69,.60],[3,74,.72]],
        [[0,72,.72],[1,71,.65],[2,69,.60],[3,67,.72]],
        [[0,71,.65],[1,74,.65],[2,76,1.35]],
        [[0,74,.65],[1,71,.65],[2,67,1.45]],
      ];
      for (const [at,m,g] of warm[bar-28]) {
        lead(origin+at,m,g,.24,-.08,'warm-augmentation');
        add('pluck',origin+at,m+12,g,.075,.5,'warm-answer');
      }
      continue;
    }
    if (act === 3) {
      // One idea becomes everybody's idea: a motif fragment, not a new tune.
      for (let ix=0; ix<8; ix++) {
        const m=[79,82,81,86][ix%4];
        lead(origin+ix*.5,m,local>=2?.16:.29,.25,-.1,'crowded-motif');
        if (local>0) lead(origin+ix*.5+.25,m-12,.12,.055+local*.012,.5,'following-voice');
      }
      continue;
    }
    if (act === 4) {
      // Repeated destinations do not advance: semitone friction and a pedal.
      const fragment = local%2===0 ? [79,82,80,79,86,80,82,80] : [81,78,75,78,81,80,78,75];
      fragment.forEach((m,ix) => {
        lead(origin+ix*.5,m,.24,.34,-.08,'gridlock-fragment');
        if (ix%2===0) lead(origin+ix*.5,m-12,.18,.10,.36,'gridlock-octave');
      });
      continue;
    }
    for (const [at, original, gate] of THEME[bar%4]) {
      let m=original;
      if (bar>=24) m=majorNote(m);
      if (act===1) m-=12;
      const pan=act===1?(local%2? .32:-.32):-.06;
      lead(origin+at,m,gate,act===2?.28:bar>=24?.29:.25,pan,bar>=24?'major-reprise':'theme');
      if (act===2 && at>=2) add('pluck',origin+at+.25,m+12,.16,.07,.62,'shortcut-glint');
    }
  }
  events.sort((a,b) => a.sample-b.sample);
  return { events, eventSha256:digest(events), bars:PROGRESSION.map((chord,bar) => ({bar,start:bar*4*BEAT,chord})),
    chapters:CHAPTERS.map((c,i) => ({id:c.id,start:c.start,end:c.end,bars:c.bars,intent:INTENTS[i],
      chords:PROGRESSION.slice(c.start/(4*BEAT),c.end/(4*BEAT)),
      noteOnsets:events.filter(e => e.sample>=c.start*SR && e.sample<c.end*SR).length})) };
}

function blep(p,d) {
  if (p<d) { const x=p/d; return 2*x-x*x-1; }
  if (p>1-d) { const x=(p-1)/d; return x*x+2*x+1; }
  return 0;
}
function pulse(p,d) { return (p<.25?.75:-.25)+.5*blep(p,d)-.5*blep((p+.75)%1,d); }
function floatWave(path,l,r) {
  const buffer=Buffer.alloc(44+l.length*8);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length-8,4); buffer.write('WAVEfmt ',8);
  buffer.writeUInt32LE(16,16); buffer.writeUInt16LE(3,20); buffer.writeUInt16LE(2,22);
  buffer.writeUInt32LE(SR,24); buffer.writeUInt32LE(SR*8,28); buffer.writeUInt16LE(8,32);
  buffer.writeUInt16LE(32,34); buffer.write('data',36); buffer.writeUInt32LE(l.length*8,40);
  for (let i=0;i<l.length;i++) { buffer.writeFloatLE(l[i],44+i*8); buffer.writeFloatLE(r[i],48+i*8); }
  writeFileSync(path,buffer);
}

export function compose(directory) {
  const work=writableDirectory(directory), score=buildScore();
  const dry=stereo(), sends=stereo();
  let seed=SEED;
  const noise=() => { seed^=seed<<13; seed^=seed>>>17; seed^=seed<<5; return (seed>>>0)/2147483648-1; };
  for (const e of score.events) {
    const hold=e.gate*BEAT, release={pulse:.025,pluck:.06,pad:.13,bass:.022,kick:.035,snare:.045,hat:.012,tom:.08}[e.kind];
    const count=Math.min(Math.ceil((hold+release)*SR),FRAMES-e.sample);
    const left=Math.cos((e.pan+1)*Math.PI/4), right=Math.sin((e.pan+1)*Math.PI/4);
    const frequency=hz(e.midi); let phase=0, low=0, high=0;
    for (let n=0;n<count;n++) {
      const t=n/SR;
      const attack=e.kind==='pad'?.025:e.kind==='kick'?.0005:.002;
      const envelope=smooth(t/attack)*(1-smooth((t-hold)/release));
      let v=0;
      if (e.kind==='pulse') {
        const d=frequency*(1+.0017*Math.sin(TAU*5.1*t)*smooth((t-.13)/.12))/SR;
        phase=(phase+d)%1; low+=.56*(pulse(phase,d)-low); v=low*1.75;
      } else if (e.kind==='bass') {
        const p=TAU*frequency*t;
        v=.82*(Math.sin(p)-Math.sin(3*p)/9+Math.sin(5*p)/25)+.12*Math.sin(p*.5);
      } else if (e.kind==='pad') {
        const p=TAU*frequency*t;
        v=(Math.sin(p)+.24*Math.sin(p*2)+.1*Math.sin(p*3))*.65;
      } else if (e.kind==='pluck') {
        const p=TAU*frequency*t;
        v=(Math.sin(p)+.35*Math.sin(p*2)+.15*Math.sin(p*3))*Math.exp(-t*11);
      } else if (e.kind==='kick' || e.kind==='tom') {
        const base=e.kind==='kick'?48:hz(e.midi);
        phase+=TAU*(base+110*Math.exp(-t*52))/SR;
        v=Math.sin(phase)*Math.exp(-t*18)+.12*noise()*Math.exp(-t*220);
      } else if (e.kind==='snare') {
        const w=noise(); low+=.16*(w-low); high+=.74*(w-high);
        v=(high-low)*.95*Math.exp(-t*24)+.38*Math.sin(TAU*193*t)*Math.exp(-t*28);
      } else if (e.kind==='hat') {
        const w=noise(); low+=.72*(w-low); v=(w-low)*Math.exp(-t*90);
      }
      v*=envelope*e.gain;
      const i=e.sample+n;
      dry.l[i]+=v*left; dry.r[i]+=v*right;
      const send=e.kind==='bass'||e.kind==='kick'?0:e.kind==='hat'?.025:e.kind==='pad'?.12:.17;
      sends.l[i]+=v*left*send; sends.r[i]+=v*right*send;
    }
  }
  // Authored panning, small filtered echo/room; centered bass is never widened.
  const delayL=new Float32Array(SPB/2), delayR=new Float32Array(SPB*3/4);
  const roomL=new Float32Array(1733), roomR=new Float32Array(1999);
  let dl=0,dr=0,rl=0,rr=0,prevL=0,prevR=0,dcL=0,dcR=0,peak=0;
  for (let i=0;i<FRAMES;i++) {
    const t=i/SR, silent=i>=1800000 && i<1845000;
    if (i===1800000 || i===1845000) {
      delayL.fill(0); delayR.fill(0); roomL.fill(0); roomR.fill(0);
      dl=dr=rl=rr=prevL=prevR=dcL=dcR=0;
    }
    dl+=.3*(delayL[i%delayL.length]-dl); dr+=.3*(delayR[i%delayR.length]-dr);
    rl+=.2*(roomL[i%roomL.length]-rl); rr+=.2*(roomR[i%roomR.length]-rr);
    delayL[i%delayL.length]=silent?0:sends.l[i]+dr*.20;
    delayR[i%delayR.length]=silent?0:sends.r[i]+dl*.20;
    roomL[i%roomL.length]=silent?0:sends.l[i]+rl*.48;
    roomR[i%roomR.length]=silent?0:sends.r[i]+rr*.48;
    let gain=1;
    // Cut reflections before the rest as well as direct notes, with 15ms safety ramps.
    if (t>=37.485 && t<37.5) gain*=1-smooth((t-37.485)/.015);
    if (t>=38.4375 && t<38.4525) gain*=smooth((t-38.4375)/.015);
    // Musical anticipation of 30s: short breath, not an added sound effect.
    if (t>=29.965 && t<30) gain*=1-.96*smooth((t-29.965)/.035);
    gain*=1-smooth((t-59.15)/.81);
    const l=(dry.l[i]+dl*.62+rl*.55)*gain, r=(dry.r[i]+dr*.62+rr*.55)*gain;
    dcL=l-prevL+.998*dcL; dcR=r-prevR+.998*dcR; prevL=l; prevR=r;
    dry.l[i]=silent||t>=59.96?0:dcL; dry.r[i]=silent||t>=59.96?0:dcR;
    peak=Math.max(peak,Math.abs(dry.l[i]),Math.abs(dry.r[i]));
  }
  const headroom=.86/peak;
  for (let i=0;i<FRAMES;i++) { dry.l[i]*=headroom; dry.r[i]*=headroom; }
  const path=join(work,'premaster.wav'); floatWave(path,dry.l,dry.r);
  return { path, premastersha256:sha256(path), eventSha256:score.eventSha256, eventCount:score.events.length,
    rawPeak:round(peak), premasterGain:round(headroom), seed:SEED };
}

export function getTools() {
  const ffmpeg=execFileSync('python',['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],
    {encoding:'utf8',windowsHide:true}).trim();
  const ffprobe=require('ffprobe-static').path;
  must(existsSync(ffmpeg)&&existsSync(ffprobe),'Installed FFmpeg/ffprobe unavailable.');
  return {ffmpeg,ffprobe};
}
function exec(exe,args,binary=false) {
  // No shell, npm.cmd, pipelines, temporary Python scripts or shell quoting.
  return execFileSync(exe,args,{encoding:binary?null:'utf8',windowsHide:true,maxBuffer:128*1024*1024,stdio:['ignore','pipe','pipe']});
}
const ff=(tools,args) => exec(tools.ffmpeg,['-hide_banner','-nostdin','-v','error','-y',...args]);
function probe(tools,path) { return JSON.parse(exec(tools.ffprobe,['-v','error','-show_streams','-show_format','-of','json',path])); }
export function decode(tools,path) {
  // Intentionally no -ar/-ac/-t/apad: missing frames or incorrect streams cannot be hidden by QA.
  const data=exec(tools.ffmpeg,['-v','error','-nostdin','-i',path,'-map','0:a:0','-c:a','pcm_f32le','-f','f32le','-'],true);
  must(data.byteLength%4===0,'Decoder returned a partial float.');
  return new Float32Array(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
}
// spawnSync is used solely where stderr contains the measurement JSON. Encoding
// and all binary transport above use execFileSync (safe on Windows).
function measureProcess(tools,path) {
  const r=spawnSync(tools.ffmpeg,['-hide_banner','-nostdin','-i',path,'-af',
    'loudnorm=I=-12:TP=-2.6:LRA=11:print_format=json','-f','null','-'],
    {encoding:'utf8',windowsHide:true,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
  must(!r.error && r.status===0,`Measurement failed: ${r.error?.message??String(r.stderr).slice(-1500)}`);
  const match=r.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  must(match,'Missing EBU R128 measurement.');
  const m=JSON.parse(match[0]);
  must(Number.isFinite(Number(m.input_i))&&Number.isFinite(Number(m.input_tp)),'Nonfinite loudness/peak.');
  return {LUFS:Number(m.input_i),truePeakDbTP:Number(m.input_tp),loudnessRangeLU:Number(m.input_lra)};
}

export function pcmStats(data,start=0,end=data.length/2/SR) {
  let peak=0,sum=0,left=0,right=0,cross=0,side=0,mid=0,clipping=0,nonfinite=0,dc=0;
  const a=Math.round(start*SR), b=Math.min(data.length/2,Math.round(end*SR));
  for (let f=a;f<b;f++) {
    const l=data[f*2], r=data[f*2+1];
    for (const v of [l,r]) { if (!Number.isFinite(v)) nonfinite++; if (Math.abs(v)>=1) clipping++; }
    peak=Math.max(peak,Math.abs(l),Math.abs(r)); sum+=l*l+r*r;
    left+=l*l; right+=r*r; cross+=l*r; side+=((l-r)/2)**2; mid+=((l+r)/2)**2; dc+=l+r;
  }
  const n=Math.max(1,b-a), rms=Math.sqrt(sum/(2*n));
  return {peakDbFS:round(db(peak)),rmsDbFS:round(db(rms)),clipping,nonfinite,
    correlation:round(cross/Math.max(1e-30,Math.sqrt(left*right))),sideRmsDbFS:round(db(Math.sqrt(side/n))),
    monoFoldLossDb:round(db(Math.sqrt(mid/n))-db(rms)),dcOffset:round(dc/(2*n))};
}
export function validateDecodedPCM(data,label) {
  must(data.length===FRAMES*2,`${label} decodedFrames=${data.length/2}, expected ${FRAMES}.`);
  const s=pcmStats(data);
  must(s.clipping===0&&s.nonfinite===0,`${label}: clipping=${s.clipping}, nonfinite=${s.nonfinite}`);
  must(s.correlation>.05&&s.correlation<.985&&s.sideRmsDbFS>-32&&s.monoFoldLossDb>-3,
    `${label} stereo/phase: correlation=${s.correlation}, side=${s.sideRmsDbFS}dBFS, mono=${s.monoFoldLossDb}dB.`);
  must(Math.abs(s.dcOffset)<.001,`${label} excessive DC: ${s.dcOffset}`);
  return s;
}
function zeroRun(data,start,end,threshold=0) {
  let current=0,best=0,bestEnd=0;
  const a=Math.round(start*SR),b=Math.round(end*SR);
  for (let f=a;f<b;f++) {
    if (Math.max(Math.abs(data[2*f]),Math.abs(data[2*f+1]))<=threshold) {
      current++; if (current>best) { best=current; bestEnd=f+1; }
    } else current=0;
  }
  return {startSample:bestEnd-best,endSampleExclusive:bestEnd,frames:best,
    start:round((bestEnd-best)/SR),end:round(bestEnd/SR),duration:round(best/SR),threshold};
}
function spectralLevel(data,midi,start,duration=.08) {
  const count=Math.round(duration*SR),a=Math.round(start*SR),omega=TAU*hz(midi)/SR;
  let re=0,im=0;
  for (let n=0;n<count;n++) {
    const w=.5-.5*Math.cos(TAU*n/(count-1)),v=(data[2*(a+n)]+data[2*(a+n)+1])*.5*w;
    re+=v*Math.cos(omega*n); im-=v*Math.sin(omega*n);
  }
  return db(Math.hypot(re,im)*4/count);
}
function tonalEvidence(data) {
  return [[.5,82,83],[4,77,78]].map(([beat,minor,major]) => {
    const first=beat*BEAT+.025,reprise=45+beat*BEAT+.025;
    const before=spectralLevel(data,minor,first)-spectralLevel(data,major,first);
    const after=spectralLevel(data,major,reprise)-spectralLevel(data,minor,reprise);
    must(before>6&&after>6,`Actual pitch change ${minor}->${major} missing: before=${before.toFixed(2)}, after=${after.toFixed(2)} dB.`);
    return {minorMidi:minor,majorMidi:major,firstWindowStart:first,repriseWindowStart:reprise,windowSeconds:.08,
      minorDominanceDb:round(before),majorDominanceDb:round(after)};
  });
}
function gaplessEvidence(tools,path,data) {
  const result=JSON.parse(exec(tools.ffprobe,['-v','error','-select_streams','a:0','-show_packets',
    '-show_entries','packet=duration_time,side_data_list','-of','json',path]));
  let skip=0,padding=0,encoded=0;
  for (const p of result.packets) {
    encoded+=Math.round(Number(p.duration_time)*SR);
    for (const s of p.side_data_list??[]) { skip+=Number(s.skip_samples??0); padding+=Number(s.discard_padding??0); }
  }
  must(skip>0&&encoded-skip-padding===data.length/2,
    `Gapless accounting: encoded=${encoded}, skip=${skip}, padding=${padding}, decoded=${data.length/2}.`);
  return {packetCount:result.packets.length,encodedFrames:encoded,skipSamples:skip,discardPadding:padding,
    decodedFrames:data.length/2,decoderRemovesPadding:true,decodedTimelineOriginSeconds:0};
}

export function verifyProvenance(report,directory=AUDIO_DIR) {
  assertContract();
  must(report.title===TITLE&&report.duration===60&&report.bpm===128&&report.beats===128&&report.bars===32&&
    report.sampleRate===SR&&report.channels===2,'Report timing/format contract mismatch.');
  must(report.noVoice===true&&report.provenance.originalLocalDSP===true&&report.provenance.externalSamples===false&&
    report.provenance.networkUsed===false&&report.provenance.TTS===false&&report.provenance.borrowedMelody===false,
    'Instrumental/local-original provenance contract failed.');
  must(report.storysha256===sha256(STORY),'Story SHA-256 mismatch; regenerate against current script.');
  must(report.generatorSha256===sha256(SELF),'Generator SHA-256 mismatch; regenerate with current score.');
  must(report.mastersha256===sha256(join(directory,'master.mp3')),'MP3 SHA-256 mismatch.');
  must(report.archiveSha256===sha256(join(directory,'master.wav')),'WAV SHA-256 mismatch.');
  const score=buildScore();
  must(report.composition.eventSha256===score.eventSha256&&report.composition.eventCount===score.events.length,
    'Event schedule provenance mismatch.');
  must(digest(report.composition.theme)===digest(THEME)&&digest(report.composition.chapters)===digest(score.chapters),
    'Theme/chapter intent report does not match authored score.');
}

export function verify(tools=getTools(),report=JSON.parse(readFileSync(join(AUDIO_DIR,'report.json'),'utf8')),directory=AUDIO_DIR) {
  // Read-only: no creation, normalization, repair, audio encoding or report write.
  verifyProvenance(report,directory);
  const paths={mp3:join(directory,'master.mp3'),wav:join(directory,'master.wav')};
  const mp3Info=probe(tools,paths.mp3),wavInfo=probe(tools,paths.wav);
  const ms=mp3Info.streams[0],ws=wavInfo.streams[0];
  must(mp3Info.streams.length===1&&ms.codec_name==='mp3'&&Number(ms.sample_rate)===SR&&ms.channels===2&&Number(ms.bit_rate)===256000,
    'MP3 must have one 48kHz stereo / 256kbps audio stream.');
  must(wavInfo.streams.length===1&&ws.codec_name==='pcm_s24le'&&Number(ws.bits_per_raw_sample)===24&&
    Number(ws.sample_rate)===SR&&ws.channels===2,'WAV must be 24-bit / 48kHz / stereo.');
  const tags=mp3Info.format.tags;
  must(tags.title===TITLE&&tags.comment===COMMENT&&tags.no_voice==='true'&&tags.bpm==='128'&&
    tags.story_sha256===report.storysha256&&tags.generator_sha256===report.generatorSha256,
    'MP3 embedded provenance tags mismatch.');
  const mp3=decode(tools,paths.mp3),wav=decode(tools,paths.wav);
  const metrics={};
  for (const [kind,data] of Object.entries({mp3,wav})) {
    metrics[kind]={decodedFrames:data.length/2,decodedDuration:data.length/2/SR,...validateDecodedPCM(data,kind),...measureProcess(tools,paths[kind])};
    const m=metrics[kind];
    must(m.LUFS>=-13&&m.LUFS<=-10.5&&m.truePeakDbTP<=-1.5,
      `${kind} mastering limits: LUFS=${m.LUFS}, truePeak=${m.truePeakDbTP}dBTP.`);
  }
  const gapless=gaplessEvidence(tools,paths.mp3,mp3);
  const wavRest=zeroRun(wav,37.5,38.4375),mp3Rest=zeroRun(mp3,37.5,38.4375);
  const interior={start:37.56,end:38.375};
  const silence=pcmStats(mp3,interior.start,interior.end);
  must(wavRest.frames===45000,`Archive does not contain exactly two zero-PCM beats: ${wavRest.frames}/45000.`);
  must(mp3Rest.frames>=SR*.78&&silence.peakDbFS<=-100,
    `Decoded MP3 rest: exact-zero run=${mp3Rest.duration}s, interior peak=${silence.peakDbFS}dBFS.`);
  const opening=pcmStats(mp3,0,1),resume=pcmStats(mp3,38.4375,38.6875),ending=pcmStats(mp3,59.985,60);
  must(opening.rmsDbFS>-25&&resume.rmsDbFS>-38&&ending.peakDbFS<-70,
    `Opening/resume/end: ${opening.rmsDbFS}/${resume.rmsDbFS}/${ending.peakDbFS}dBFS.`);
  const chapters=CHAPTERS.map(c => ({id:c.id,start:c.start,end:c.end,...pcmStats(mp3,c.start,c.end)}));
  for (const c of chapters) must(c.rmsDbFS>-36&&c.correlation>0,`Empty/phase-inverted chapter ${c.id}: ${JSON.stringify(c)}`);
  const before=pcmStats(mp3,29.98,30).rmsDbFS,after=pcmStats(mp3,30,30.16).rmsDbFS;
  const contrast={climaxVsRethinkDb:round(chapters[4].rmsDbFS-chapters[5].rmsDbFS),
    climaxVsRushDb:round(chapters[4].rmsDbFS-chapters[3].rmsDbFS),climaxOnsetRiseDb:round(after-before),
    climaxBefore20msRmsDbFS:before,climaxAfter160msRmsDbFS:after};
  must(contrast.climaxVsRethinkDb>=7&&contrast.climaxVsRushDb>=.8&&contrast.climaxOnsetRiseDb>=4,
    `Insufficient narrative contrast: ${JSON.stringify(contrast)}`);
  const quietRuns=[]; let runStart=null;
  for (let frame=0;frame<FRAMES;frame+=480) {
    const quiet=pcmStats(mp3,frame/SR,(frame+480)/SR).rmsDbFS<-65;
    if (quiet&&runStart===null) runStart=frame;
    if ((!quiet||frame+480===FRAMES)&&runStart!==null) {
      const end=quiet?frame+480:frame;
      if (end-runStart>=4800) quietRuns.push({start:runStart/SR,end:end/SR});
      runStart=null;
    }
  }
  must(quietRuns.every(q => (q.start>=37.48&&q.end<=38.47)||q.start>=59.15),
    `Unexpected long silent passage: ${JSON.stringify(quietRuns)}`);
  return {...metrics,gapless,metadataDuration:Number(mp3Info.format.duration),chapters,contrast,
    silence:{requested:{start:37.5,end:38.4375,beats:2,frames:45000},wavExactZero:wavRest,mp3ExactZero:mp3Rest,
      measuredInterior:{...interior,...silence},
      encodedTimelineZeroStartSample:mp3Rest.startSample+gapless.skipSamples,
      encodedTimelineZeroEndSampleExclusive:mp3Rest.endSampleExclusive+gapless.skipSamples,
      explanation:'All reported seconds use gapless decoded PCM; encoded positions add measured encoder skip samples, not container duration padding.'},
    tonalChanges:tonalEvidence(mp3),opening,resume,ending,quietRuns};
}

// Remove only resampler residue in already-silent windows of the staged 24-bit
// archive. Actual audible fades are authored in DSP before limiting.
function clearSilentPCM(path) {
  const b=readFileSync(path); let offset=12;
  must(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WAVE','Invalid WAV header.');
  while (offset+8<=b.length) {
    const size=b.readUInt32LE(offset+4);
    if (b.toString('ascii',offset,offset+4)==='data') {
      must(size===FRAMES*6,`Unexpected 24-bit data length ${size}.`);
      for (const [a,z] of [[1800000,1845000],[2878080,FRAMES]]) b.fill(0,offset+8+a*6,offset+8+z*6);
      writeFileSync(path,b); return;
    }
    offset+=8+size+(size%2);
  }
  throw new Error('WAV data chunk missing.');
}
function publish(work) {
  const names=['master.wav','master.mp3','report.json'],backups=[],committed=[];
  try {
    for (const name of names) {
      const dest=join(AUDIO_DIR,name),backup=join(work,`previous-${name}`);
      if (existsSync(dest)) { renameSync(dest,backup); backups.push([dest,backup]); }
      renameSync(join(work,name),dest); committed.push(dest);
    }
  } catch (error) {
    for (const dest of committed.reverse()) rmSync(dest,{force:true});
    for (const [dest,backup] of backups.reverse()) renameSync(backup,dest);
    throw error;
  }
}
function summary(report) {
  return {title:report.title,passed:report.validation.passed,duration:report.duration,bpm:report.bpm,
    files:['shortcut/score.mjs','shortcut/audio-test.mjs','shortcut/audio/master.mp3','shortcut/audio/master.wav','shortcut/audio/report.json'],
    measurements:report.measurements,storysha256:report.storysha256,mastersha256:report.mastersha256,
    archiveSha256:report.archiveSha256,listeningTestPerformed:false};
}
export function main(args=process.argv.slice(2)) {
  must(args.length===0 || (args.length===1&&args[0]==='--verify'),'Usage: node shortcut/score.mjs [--verify]');
  const tools=getTools();
  if (args[0]==='--verify') {
    const report=JSON.parse(readFileSync(join(AUDIO_DIR,'report.json'),'utf8'));
    const measured=verify(tools,report);
    must(digest(measured)===digest(report.measurements),'Stored measurements are stale or modified.');
    must(report.validation.passed===true&&report.validation.listeningTestPerformed===false,'Validation claim mismatch.');
    must(report.LUFS===measured.mp3.LUFS&&report.truePeakDbTP===measured.mp3.truePeakDbTP&&
      report.clipping===measured.mp3.clipping&&report.decodedFrames===measured.mp3.decodedFrames,'Top-level measurements stale.');
    console.log(JSON.stringify(summary(report),null,2)); return report;
  }
  assertContract(); writableDirectory(AUDIO_DIR);
  const storysha256=sha256(STORY),generatorSha256=sha256(SELF),work=mkdtempSync(join(ROOT,'.score-work-'));
  try {
    const composition=compose(work),score=buildScore(),input=measureProcess(tools,composition.path);
    let target=-12,ceiling=-2.6,output,appliedGain;
    for (let attempt=0;attempt<3;attempt++) {
      appliedGain=target-input.LUFS;
      ff(tools,['-i',composition.path,'-af',`aresample=192000,volume=${appliedGain}dB,`+
        `alimiter=limit=${10**(ceiling/20)}:attack=3:release=65:level=false:latency=true,aresample=48000`,
        '-c:a','pcm_s24le',join(work,'master.wav')]);
      clearSilentPCM(join(work,'master.wav'));
      ff(tools,['-i',join(work,'master.wav'),'-map_metadata','-1','-c:a','libmp3lame','-b:a','256k',
        '-write_xing','1','-id3v2_version','3','-metadata',`title=${TITLE}`,'-metadata',`comment=${COMMENT}`,
        '-metadata',`story_sha256=${storysha256}`,'-metadata',`generator_sha256=${generatorSha256}`,
        '-metadata','no_voice=true','-metadata','bpm=128',join(work,'master.mp3')]);
      output=measureProcess(tools,join(work,'master.mp3'));
      console.log(`Staged attempt ${attempt+1}: ${output.LUFS} LUFS / ${output.truePeakDbTP} dBTP`);
      if (Math.abs(output.LUFS+12)<=.15&&output.truePeakDbTP<=-1.5) break;
      if (attempt<2) { target+=Math.max(-1,Math.min(1,-12-output.LUFS)); if(output.truePeakDbTP>-1.5) ceiling-=output.truePeakDbTP+1.8; }
    }
    const report={schemaVersion:1,title:TITLE,duration:60,bpm:128,beats:128,bars:32,sampleRate:SR,channels:2,noVoice:true,
      storysha256,generatorSha256,mastersha256:sha256(join(work,'master.mp3')),archiveSha256:sha256(join(work,'master.wav')),
      composition:{seed:SEED,eventSha256:composition.eventSha256,eventCount:composition.eventCount,
        premastersha256:composition.premastersha256,themeBars:4,theme:THEME,
        themeIdentity:'G–Bb–A–D–C–Bb–G; short-short-held / reach / falling answer; four-bar question-and-answer.',
        reprise:'45s: same rhythmic identity; pitch classes Bb→B, F→F#, Eb→E. 52.5s: lower octave and augmented note lengths.',
        chapters:score.chapters},
      processing:{targetLUFS:-12,allowedLUFS:[-13,-10.5],truePeakLimitDbTP:-1.5,preEncodeCeilingDb:ceiling,
        measuredPremasterLUFS:input.LUFS,fixedGainDb:round(appliedGain),adaptiveNormalization:false,
        limiter:{oversampling:4,attackMs:3,releaseMs:65,stereoLinked:true,latencyCompensated:true,autoLevel:false},
        archive:'pcm_s24le',delivery:'libmp3lame 256kbps CBR with Xing gapless metadata',
        stereo:'Equal-power instrument panning and low-level filtered room/echo; mono bass; no master polarity/Haas widening.',
        silenceFadesMs:15,finalFade:{start:59.15,end:59.96},sampleRate:SR},
      provenance:{originalLocalDSP:true,externalSamples:false,networkUsed:false,TTS:false,borrowedMelody:false,
        method:'Locally authored note score; polyBLEP pulse, additive sine/triangle, deterministic filtered noise. No media inputs.',
        techniqueReferenceOnly:'feynman/score.mjs: offline synthesis, safe encoding and measured fixed-gain mastering; no melody/audio reused.',
        limits:'Local provenance and reproducibility checks, not a global copyright-similarity search or a listening judgement.'}};
    report.measurements=verify(tools,report,work);
    Object.assign(report,{LUFS:report.measurements.mp3.LUFS,truePeakDbTP:report.measurements.mp3.truePeakDbTP,
      clipping:report.measurements.mp3.clipping,decodedFrames:report.measurements.mp3.decodedFrames,
      validation:{passed:true,fullDecode:true,stagedBeforePublication:true,listeningTestPerformed:false,browserTestPerformed:false,
        scope:'Both complete decodes, R128, true peak, phase/stereo, gapless accounting, exact PCM rest, narrative contrast, spectral Bb/B and F/F# evidence, hashes and embedded provenance.'}});
    must(storysha256===sha256(STORY)&&generatorSha256===sha256(SELF),'Inputs changed during synthesis; not publishing.');
    json(join(work,'report.json'),report); publish(work);
    console.log(JSON.stringify(summary(report),null,2)); return report;
  } finally { rmSync(work,{recursive:true,force:true}); }
}
if (process.argv[1]&&resolve(process.argv[1])===SELF) {
  try { main(); } catch (error) { console.error(error.stack); if(error.stderr) console.error(String(error.stderr).slice(-2500)); process.exitCode=1; }
}
