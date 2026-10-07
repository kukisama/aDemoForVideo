/**
 * 门外 — newly authored 90-bar score, not a historical quotation or borrowed tune.
 * node qin/score.mjs [--voices-only | --verify]
 * Only audio/** and output/audio-qa/** are written. No playback/network at runtime.
 * Network synthesis transmits ONLY the 26 authored utterances and TTS parameters.
 * R128 is measurement-only: mastering uses fixed gain and a linked 4x limiter.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, openSync, readSync, closeSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TITLE, DURATION, BPM, BEAT, TOTAL_BEATS, CHAPTERS, SHOTS, VOICE_CUES, AUDIO_CUES, validateStory } from './story.mjs';

const ROOT = fileURLToPath(new URL('./', import.meta.url));
const SELF = fileURLToPath(import.meta.url), STORY = join(ROOT, 'story.mjs');
export const AUDIO_DIR = join(ROOT, 'audio'), QA_DIR = join(ROOT, 'output', 'audio-qa');
export const SR = 48000, FRAMES = 8640000;
export const LOCKED_STORY = '1a6d4caf6dd6bc4346fefd47d76b90f0bd50fc3e7b92551326cd59b54e8340d0';
const require = createRequire(new URL('../web/package.json', import.meta.url));
const TAU = 2 * Math.PI, SEED = 0x51494e37;
const VOICE = 'zh-CN-YunxiNeural', PITCH = '-3Hz';
const must = (v, why) => { if (!v) throw new Error(why); };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
const hz = m => 440 * 2 ** ((m - 69) / 12);
const db = v => 20 * Math.log10(Math.max(1e-12, v));
const round = v => Math.round(v * 1e6) / 1e6;
export const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function sha256(p) {
  const fd=openSync(p,'r'),hash=createHash('sha256'),chunk=Buffer.allocUnsafe(1024*1024);
  try {let n;while((n=readSync(fd,chunk,0,chunk.length,null))>0) hash.update(chunk.subarray(0,n));return hash.digest('hex');}
  finally {closeSync(fd);}
}
const canonical = s => s.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '');
export const han = s => [...s.matchAll(/\p{Script=Han}/gu)].length;
function owned(path) {
  const p = resolve(path);
  must([AUDIO_DIR, QA_DIR].some(base => p === base || p.startsWith(base + sep)), 'Write outside authorized audio scope');
  return p;
}
function json(p, value) { writeFileSync(owned(p), JSON.stringify(value, null, 2) + '\n'); }
function dirs() { for (const p of [AUDIO_DIR, QA_DIR, join(AUDIO_DIR, 'raw'), join(AUDIO_DIR, 'voices')]) mkdirSync(owned(p), {recursive:true}); }
export function contract() {
  validateStory();
  must(sha256(STORY) === LOCKED_STORY, 'Locked story changed; refusing synthesis.');
  must(DURATION === 180 && BPM === 120 && BEAT === .5 && TOTAL_BEATS === 360, 'Timing contract changed.');
  must(VOICE_CUES.length === 26 && VOICE_CUES.reduce((n,v) => n + han(v.text), 0) === 313, '26 voices / 313 Han contract');
  must(VOICE_CUES.every(v => han(v.text) <= 21), 'Caption exceeds 21 Han characters.');
}
function redact(value) {
  let text = String(value);
  for (const [key, secret] of Object.entries(process.env)) if (/proxy|token|secret|api.?key/i.test(key) && secret) text = text.split(secret).join('[redacted]');
  return text.replace(/(?:https?|socks\w*):\/\/[^\s'"<>]+/gi, '[network endpoint]');
}
export function run(exe, args, binary = false, timeout = 180000) {
  const r = spawnSync(exe, args, { encoding:binary ? null : 'utf8', windowsHide:true, timeout,
    maxBuffer:160 * 1024 * 1024, env:{...process.env, PYTHONIOENCODING:'utf-8'}, stdio:['ignore','pipe','pipe'] });
  must(!r.error && r.status === 0, redact(`${r.error?.message ?? `exit ${r.status}`}: ${String(r.stderr).slice(-3000)}`));
  return r;
}
export function getTools() {
  const ffmpeg = 'C:\\Users\\kukisama\\AppData\\Roaming\\Python\\Python312\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
  const ffprobe = require('ffprobe-static').path;
  must(existsSync(ffmpeg) && existsSync(ffprobe), 'Installed FFmpeg/ffprobe missing');
  return {ffmpeg, ffprobe};
}
const ff = (tools,args) => run(tools.ffmpeg, ['-hide_banner','-nostdin','-v','error','-y',...args]);
export function probe(tools,path) {
  return JSON.parse(run(tools.ffprobe, ['-v','error','-show_streams','-show_format','-of','json',path]).stdout);
}
export function decode(tools,path,convertMono = false) {
  // Published-file QA never resamples, pads, trims, or changes channel count.
  const b = run(tools.ffmpeg, ['-v','error','-nostdin','-i',path,...(convertMono ? ['-ar','48000','-ac','1'] : []),
    '-map','0:a:0','-f','f32le','-c:a','pcm_f32le','-'], true).stdout;
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
}
export function measure(tools,path) {
  const r = run(tools.ffmpeg, ['-hide_banner','-nostdin','-i',path,'-af','loudnorm=I=-15:TP=-2.5:LRA=16:print_format=json','-f','null','-']);
  const match = r.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  must(match, 'Missing R128 input measurement');
  const m = JSON.parse(match[0]);
  const result = {LUFS:Number(m.input_i), truePeakDbTP:Number(m.input_tp), loudnessRangeLU:Number(m.input_lra)};
  must(Object.values(result).every(Number.isFinite), 'Nonfinite R128 measurement'); return result;
}
export function stats(data,channels = 2,start = 0,end = data.length / channels / SR) {
  let sum = 0, peak = 0, clipping = 0, nonfinite = 0, cross = 0, ll = 0, rr = 0, side = 0;
  const a = Math.round(start * SR), z = Math.min(data.length / channels, Math.round(end * SR));
  for (let f = a; f < z; f++) {
    for (let c = 0; c < channels; c++) {
      const v = data[f * channels + c];
      if (!Number.isFinite(v)) nonfinite++;
      if (Math.abs(v) >= 1) clipping++;
      peak = Math.max(peak, Math.abs(v)); sum += v * v;
    }
    if (channels === 2) {
      const l = data[2*f], r = data[2*f+1]; cross += l*r; ll += l*l; rr += r*r; side += ((l-r)/2)**2;
    }
  }
  return {rmsDbFS:round(db(Math.sqrt(sum / Math.max(1,(z-a)*channels)))), peakDbFS:round(db(peak)), clipping, nonfinite,
    ...(channels === 2 ? {correlation:round(cross / Math.max(1e-30,Math.sqrt(ll*rr))), sideRmsDbFS:round(db(Math.sqrt(side/Math.max(1,z-a))))} : {})};
}
function wave(path,l,r) {
  const channels = r ? 2 : 1, align = channels * 4, b = Buffer.alloc(44 + l.length * align);
  b.write('RIFF'); b.writeUInt32LE(b.length-8,4); b.write('WAVEfmt ',8); b.writeUInt32LE(16,16);
  b.writeUInt16LE(3,20); b.writeUInt16LE(channels,22); b.writeUInt32LE(SR,24); b.writeUInt32LE(SR*align,28);
  b.writeUInt16LE(align,32); b.writeUInt16LE(32,34); b.write('data',36); b.writeUInt32LE(l.length*align,40);
  for (let i = 0; i < l.length; i++) { b.writeFloatLE(l[i],44+i*align); if (r) b.writeFloatLE(r[i],48+i*align); }
  writeFileSync(owned(path),b);
}
const bus = () => ({l:new Float32Array(FRAMES), r:new Float32Array(FRAMES)});

// NEW five-note identity: D—A—G—C—F, an upward fifth, retreat, open fourth,
// then a falling fifth. Syncopated long-short contour; neither legacy motif.
// [beat, MIDI, hold in beats]; same exact melody/rhythm returns over F at 162s.
export const THEME = [[0,74,.48],[.75,81,.52],[1.5,79,.78],[2.5,84,.48],[3.25,77,.66]];
const ANSWER = [[0,77,.55],[1,79,.55],[1.75,81,.72],[2.75,72,.38],[3.5,74,.40]];
export const LAYERS = ['pulse-lead','pluck-answer','triangle-bass','reed-choir','bronze-bell','low-drum','march-snare','noise-tick'];
const CHORDS = {
  Dm:[38,[50,53,57]], F:[41,[53,57,60]], C:[36,[48,55,60]], Gsus:[43,[55,57,62]],
  Am:[45,[57,60,64]], Dsus:[38,[50,55,57]], F6:[41,[53,57,60,62]],
};
const INTENTS = [
  '0–12：低D、四次独立叩门；五音主题只奏前四音，F暂不回答。',
  '12–24：低八度三音碎片与孤立拨弦，空旷而非小号式宣告。',
  '24–42：完整D A G C F第一次出现；队列低鼓、后拍军鼓、八分噪声逐层加入。',
  '42–54：第一次宽阔高潮；双八度、宽声像和声、钟与完整主题。48秒独立印章。',
  '54–66：收成短脉冲、左右拨弦对答；四分书写节奏，56.2秒合成笔触。',
  '66–78：三角低音切分，金属钟取代前段脉冲主导；68秒秤响；硬币按释放与下落动作调度，在72、72.27、72.54秒落地发声。',
  '78–90：扩展主题、八分行进低音与高位拨弦，展开道路宽度。',
  '90–102：主题增值为两倍时长、鼓点半拍速密度；不是改变120BPM；低强度夯土。',
  '102–114：在102秒清掉原旋律尾音，只留D/A悬置和短促的未完动机。',
  '114–126：稀疏五音、远钟及独立低电平海风，留出问句之后的空处。',
  '126–138：主题低八度、低音D踏板，行进鼓逐渐停止，和声凝固。',
  '138–150：心跳鼓逐步抽空；148.5–150.5全部器乐/音效及反射精确为零，旁白不静音。',
  '150–162：150.5单音重生、低D与D小调和声，等待同主题的重新配和声。',
  '162–180：162起低F与F A C和弦，主题五个音不变；174敞门八层达到最大展开，178.8温暖渐隐至180。',
];
export function buildScore() {
  contract(); const events = [], bars = [];
  function add(layer,kind,at,midi,hold,gain,pan = 0,role = layer) {
    must(at >= 0 && at < DURATION && hold > 0, `Invalid event ${role} ${at}`);
    if (at >= 148.5 && at < 150.5) return;
    events.push({layer,kind,at:round(at),sample:Math.round(at*SR),midi,hold:round(hold),gain:round(gain),pan,role});
  }
  const theme = (at,gain,oct = 0,scale = 1,role = 'complete-theme',limit = 5) => {
    for (const [beat,m,g] of THEME.slice(0,limit)) add('pulse-lead','pulse',at+beat*BEAT*scale,m+oct,g*BEAT*scale,gain,-.10,role);
  };
  const notes = (at,phrase,gain,oct = 0) => phrase.forEach(([b,m,g]) => add('pluck-answer','pluck',at+b*BEAT,m+oct,g*BEAT,gain,.55,'answer'));
  const energy = [.24,.30,.85,.95,.58,.68,1.02,.35,.22,.23,.39,.21,.27,1.02];
  for (let bar = 0; bar < 90; bar++) {
    const t = bar*2, ci = CHAPTERS.findIndex(c => t >= c.start && t < c.end), c = CHAPTERS[ci], local = (t-c.start)/2;
    let chord = ['Dm','C','Gsus','Dm'][Math.floor(local)%4];
    if ([0,1,8,10,11,12].includes(ci)) chord = 'Dm';
    if (ci === 9) chord = ['Dsus','Gsus','Dsus'][Math.floor(local)%3];
    if (ci === 13) chord = ['F','C','F6','Gsus','F','C','F','F6','F'][local];
    const [root, tones] = CHORDS[chord];
    const closingPeak = t >= 174 && t < 178, closingTail = t >= 178;
    let e = closingPeak ? 1.55 : closingTail ? .85 : energy[ci];
    if (ci === 2) e *= .78 + local*.027;
    if (ci === 11) e *= Math.max(.12,1-local*.16);
    bars.push({bar:bar+1,start:t,chord,bassMidi:root,tones,energy:round(e),chapter:c.id});
    if (t >= 148 && t < 150) continue;
    const start = t === 150 ? 150.5 : t;
    // Bass/choir are separate proof stems; all instrument voices are real events.
    const bassOffsets = [2,6].includes(ci) ? [0,.5,1,1.5] : ci === 5 ? [0,.375,1.125,1.75] : [0];
    for (const off of bassOffsets) if (start+off < t+2)
      add('triangle-bass','bass',start+off,root,bassOffsets.length>1?.22:1.7,.30*e,0,'harmonic-root');
    for (const [ix,m] of tones.entries()) add('reed-choir','pad',start,m,Math.max(.25,t+1.88-start),.10*e,[-.82,.7,-.36,.87][ix],'harmony');
    const marching = [2,3,6,13].includes(ci) && !closingTail;
    if (marching) {
      for (const off of [0,1]) add('low-drum','kick',t+off,38,.23,.38*e*(off===0?1:.78));
      for (const off of [.5,1.5]) add('march-snare','snare',t+off,0,.16,.19*e,off===.5?-.23:.23);
      for (let n = 0; n < 8; n++) add('noise-tick','hat',t+n*.25,0,.04,.065*e,n%2?.65:-.65);
    } else if ([4,5].includes(ci)) {
      for (const off of ci===4 ? [0,1] : [0,.875,1.5]) add('low-drum','kick',t+off,38,.18,.25*e);
      for (const off of ci===4 ? [.5,1.5] : [.625,1.375,1.875]) add('noise-tick','hat',t+off,0,.035,.06*e,.6);
    } else if (ci===7 || (ci===10 && local<3) || (ci===11 && local<4)) {
      add('low-drum','kick',t,38,.32,.34*e,0,ci===11?'fading-heartbeat':'half-time');
      if (ci===11 && local<2) add('low-drum','kick',t+.3,38,.19,.18*e,0,'second-heartbeat');
      if (ci===7 && local%2===1) add('march-snare','snare',t,0,.2,.12*e,-.15,'half-time');
    }
    if ([2,3,6,13].includes(ci) && !closingTail) {
      const order = [0,2,1,2,0,1,2,1];
      for (let n=0;n<8;n++) add('pluck-answer','pluck',t+n*.25+.125,tones[order[n]]+12,.12,.068*e,n%2?.72:-.72,'moving-eighths');
      if (local%2===0) add('bronze-bell','bell',t,root+36,.8,.058*e,.6,'landmark-bell');
    }
    if (ci===0 && local%2===0) theme(t+.2,.09,-12,1.6,'unfinished-five-note-motif',4);
    if (ci===1 && local%2===0) { theme(t,.12,-12,1.5,'boy-fragment',3); notes(t+2,[[0,62,.4],[2,69,.7]],.09); }
    if ([2,3,6].includes(ci)) {
      if (local%2===0) theme(t,.23*e);
      else notes(t,ANSWER,.16*e);
      if (ci===3 && local%2===0) theme(t,.061,-12,1,'throne-octave');
    }
    if (ci===4) {
      for (const [n,[b,m]] of THEME.entries()) {
        add(n%2?'pluck-answer':'pulse-lead',n%2?'pluck':'pulse',t+b*.5,m-12,.08,.17*e,n%2?.55:-.55,'script-call-response');
      }
    }
    if (ci===5) {
      for (const [n,off] of [.125,.625,1.25,1.625].entries()) add('bronze-bell','bell',t+off,[74,77,81,79][n],.2,.12*e,n%2?-.45:.45,'measure-syncopation');
      if (local%2===0) notes(t,THEME,.13,-12);
    }
    if (ci===7 && local%2===0) theme(t,.10,-12,2,'fatigue-augmentation');
    if (ci===8 && [0,3].includes(local)) theme(t,.09,-12,1,'truncated-theme',2);
    if (ci===9 && local%2===0) {
      notes(t,[[0,74,1],[2.5,79,1]],.085,-12); add('bronze-bell','bell',t+.75,81,1.1,.035,-.6,'distant-bell');
    }
    if (ci===10 && local%2===0) theme(t,.13,-12,1.6,'clay-low-reprise');
    if (ci===12 && local%2===0) notes(start,[[0,62,.8],[2.5,69,1]],.09);
    if (ci===13 && !closingTail) {
      if (local%2===0) theme(t,.24*e,0,1,t===162?'F-reharmonized-same-theme':t===174?'open-door-same-theme':'bright-theme');
      else notes(t,ANSWER,.17*e);
      if (closingPeak) theme(t,.075,-12,1,'open-door-lower-octave');
    }
    if (closingTail) notes(t,[[0,72,.8],[1,69,.8],[2,65,1.7]],.15);
  }
  for (const at of AUDIO_CUES.openingKnocks) add('sfx','knock',at,38,.65,.31,at===.5?-.15:.15,'door-knock');
  add('sfx','seal',AUDIO_CUES.seal,38,.35,.24,0,'seal');
  for (const off of [0,.3,.7,1.05]) add('sfx','writing',AUDIO_CUES.writing+off,0,.16,.10,-.3,'writing');
  add('sfx','coin',AUDIO_CUES.balance,81,.42,.10,.2,'balance');
  // Mirror world.coins: release at .2 + i*.27, then .8s of flight.
  // Sound the first three visible impacts; retain their original pitches/gains.
  const coins = {shot:'coins',shotStart:SHOTS.find(s=>s.id==='coins').start,releaseDelay:.2,flightSeconds:.8,interval:.27,count:3};
  for (let i=0;i<coins.count;i++) {
    const impact=coins.shotStart+coins.releaseDelay+coins.flightSeconds+i*coins.interval;
    add('sfx','coin',impact,[84,84.68,85.6][i],.38,.10,.35,'coin');
  }
  for (const at of AUDIO_CUES.tamping) add('sfx','tamp',at,38,.45,.18,-.15,'tamping');
  for (const at of [114,120]) add('sfx','wind',at,0,3.5,.075,at===114?-.6:.6,'sea-wind');
  events.sort((a,b) => a.sample-b.sample || a.layer.localeCompare(b.layer));
  const chapters = CHAPTERS.map((c,i) => ({id:c.id,start:c.start,end:c.end,intent:INTENTS[i],
    eventCount:events.filter(e=>e.at>=c.start&&e.at<c.end).length,
    layers:[...new Set(events.filter(e=>e.at>=c.start&&e.at<c.end&&e.layer!=='sfx').map(e=>e.layer))]}));
  return {theme:THEME,themeIdentity:'D5 A5 G5 C6 F5 / beats 0 .75 1.5 2.5 3.25',layers:LAYERS,events,bars,chapters,
    eventSha256:digest(events),actionSchedule:{coins},seed:SEED,original:true,borrowedMelody:false,
    harmonicTurn:{at:162,unchangedMelody:THEME,from:{bassMidi:38,chord:[50,53,57]},to:{bassMidi:41,chord:[53,57,60]}},
    timeSignature:'4/4',instrumentLayerCount:8,beats:360,barCount:90};
}
function blep(p,d) {
  if(p<d) { const x=p/d; return 2*x-x*x-1; }
  if(p>1-d) { const x=(p-1)/d; return x*x+2*x+1; } return 0;
}
function pulse(p,d) { return (p<.25?.75:-.25)+.5*blep(p,d)-.5*blep((p+.75)%1,d); }
function musicEnvelope(t) {
  if (t>=148.5 && t<150.5) return 0;
  let g = smooth(t/.035)*(1-smooth((t-178.8)/1.16));
  if (t>=148.44 && t<148.5) g*=1-smooth((t-148.44)/.06);
  if (t>=150.5 && t<150.53) g*=smooth((t-150.5)/.03);
  if (t>=101.975 && t<102) g*=1-smooth((t-101.975)/.025);
  if (t>=102 && t<102.02) g*=smooth((t-102)/.02);
  return t>=179.96 ? 0 : g;
}
export function compose(tools,score) {
  const music=bus(), fx=bus(), layerEvidence=[];
  for (const layer of [...LAYERS,'sfx']) {
    const out=bus(), send=bus(); let seed=SEED;
    const noise=()=> { seed^=seed<<13; seed^=seed>>>17; seed^=seed<<5; return (seed>>>0)/2147483648-1; };
    for (const e of score.events.filter(e=>e.layer===layer)) {
      const release=e.kind==='pad'?.10:e.kind==='bell'?.28:e.kind==='wind'?.1:.035;
      const length=Math.min(Math.ceil((e.hold+release)*SR),FRAMES-e.sample);
      const gl=Math.cos((e.pan+1)*Math.PI/4), gr=Math.sin((e.pan+1)*Math.PI/4), freq=hz(e.midi);
      let phase=0, low=0, high=0;
      for(let n=0;n<length;n++) {
        const t=n/SR, attack=e.kind==='pad'?.035:e.kind==='wind'?.3:.0025;
        const env=smooth(t/attack)*(1-smooth((t-e.hold)/release)); let v=0;
        if(e.kind==='pulse') {
          const d=freq*(1+.0015*Math.sin(TAU*4.8*t)*smooth((t-.2)/.15))/SR;
          phase=(phase+d)%1; low+=.36*(pulse(phase,d)-low); v=low*1.6;
        } else if(e.kind==='bass') {
          const p=TAU*freq*t; v=.88*(Math.sin(p)-Math.sin(3*p)/9+Math.sin(5*p)/25);
        } else if(e.kind==='pad') {
          const p=TAU*freq*t; v=.65*(Math.sin(p)+.22*Math.sin(2*p)+.08*Math.sin(3*p));
        } else if(e.kind==='pluck') {
          const p=TAU*freq*t; v=(Math.sin(p)+.28*Math.sin(2*p)+.12*Math.sin(3*p))*Math.exp(-t*9);
        } else if(e.kind==='bell'||e.kind==='coin') {
          const f=e.kind==='coin'?freq*2:freq, p=TAU*f*t;
          v=(Math.sin(p)+.34*Math.sin(p*2.76)+.12*Math.sin(p*4.08))*Math.exp(-t*(e.kind==='coin'?15:4));
        } else if(['kick','knock','seal','tamp'].includes(e.kind)) {
          const base=e.kind==='kick'?48:e.kind==='knock'?73:e.kind==='seal'?100:42;
          phase+=TAU*(base+90*Math.exp(-t*55))/SR;
          v=Math.sin(phase)*Math.exp(-t*(e.kind==='knock'?9:15))+.13*noise()*Math.exp(-t*130);
          if(e.kind==='knock') v+=.26*Math.sin(TAU*137*t)*Math.exp(-t*19);
        } else if(e.kind==='snare') {
          const w=noise(); low+=.13*(w-low); high+=.73*(w-high);
          v=(high-low)*Math.exp(-t*25)+.3*Math.sin(TAU*183*t)*Math.exp(-t*30);
        } else if(e.kind==='hat'||e.kind==='writing') {
          const w=noise(); low+=(e.kind==='hat'?.72:.16)*(w-low);
          v=(w-low)*(e.kind==='hat'?Math.exp(-t*95):.24*(.5+.5*Math.sin(TAU*19*t)));
        } else if(e.kind==='wind') {
          const w=noise(); low+=.025*(w-low); high+=.002*(w-high);
          v=(low-high)*Math.sin(Math.PI*clamp(t/e.hold))**2*2;
        }
        v*=env*e.gain; const i=e.sample+n;
        out.l[i]+=v*gl; out.r[i]+=v*gr;
        const wet=['bass','kick','hat','writing','wind'].includes(e.kind)?0:.12;
        send.l[i]+=v*gl*wet; send.r[i]+=v*gr*wet;
      }
    }
    const dl=new Float32Array(12000),dr=new Float32Array(18000); let loL=0,loR=0,prevL=0,prevR=0,dcL=0,dcR=0;
    for(let i=0;i<FRAMES;i++) {
      const t=i/SR;
      if(i===102*SR || i===148.5*SR || i===150.5*SR) { dl.fill(0);dr.fill(0);loL=loR=prevL=prevR=dcL=dcR=0; }
      loL+=.25*(dl[i%dl.length]-loL); loR+=.25*(dr[i%dr.length]-loR);
      dl[i%dl.length]=send.l[i]+loR*.22; dr[i%dr.length]=send.r[i]+loL*.22;
      const l=out.l[i]+loL*.55, r=out.r[i]+loR*.55;
      dcL=l-prevL+.9992*dcL; dcR=r-prevR+.9992*dcR; prevL=l;prevR=r;
      const g=musicEnvelope(t); out.l[i]=dcL*g;out.r[i]=dcR*g;
      const dest=layer==='sfx'?fx:music; dest.l[i]+=out.l[i];dest.r[i]+=out.r[i];
    }
    const temp=join(QA_DIR,`${layer}.wav`),flac=join(QA_DIR,`${layer}.flac`);
    wave(temp,out.l,out.r);
    ff(tools,['-i',temp,'-c:a','flac','-sample_fmt','s32',flac]); rmSync(temp);
    layerEvidence.push({layer,file:`output/audio-qa/${layer}.flac`,sha256:sha256(flac),events:score.events.filter(e=>e.layer===layer).length});
    console.log(`Rendered ${layer}: ${layerEvidence.at(-1).events} events`);
  }
  wave(join(QA_DIR,'music-premaster.wav'),music.l,music.r); wave(join(AUDIO_DIR,'sfx.wav'),fx.l,fx.r);
  return {layerEvidence};
}

export function parseSrt(text) {
  const stamp=s=> { const [h,m,sec]=s.replace(',','.').split(':').map(Number); return h*3600+m*60+sec; };
  return text.trim().split(/\r?\n\s*\r?\n/).map(block=> {
    const lines=block.split(/\r?\n/),i=lines.findIndex(l=>l.includes(' --> ')); must(i>=0,'Invalid service SRT');
    const [start,end]=lines[i].split(' --> ').map(stamp);
    return {start,end,text:lines.slice(i+1).join('').replaceAll('&amp;','&').replaceAll('&quot;','"')};
  });
}
// Actual installed CLI, with constructor boundary option (CLI has no flag).
// Proxy is discovered INSIDE the subprocess; it is never logged or passed by shell.
const TTS_CLI = `import functools, runpy, sys, os, urllib.request
import edge_tts.util
route = sys.argv.pop(1)
if route == 'proxy':
    proxies = urllib.request.getproxies()
    proxy = next((os.environ.get(k) for k in ('HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy','ALL_PROXY','all_proxy') if os.environ.get(k)), None) or proxies.get('https') or proxies.get('http')
    if not proxy: raise RuntimeError('No existing environment/system proxy available')
    if '://' not in proxy: proxy = 'http://' + proxy
    sys.argv.extend(['--proxy',proxy])
edge_tts.util.Communicate = functools.partial(edge_tts.util.Communicate, boundary='WordBoundary')
runpy.run_module('edge_tts', run_name='__main__')`;
function sourceVoice(cue,rate,tools) {
  const params={text:cue.text,voice:VOICE,rate:`${rate}%`,pitch:PITCH,boundary:'WordBoundary',provider:'edge-tts'};
  const key=digest(params),stem=`raw/${cue.id}-${key.slice(0,20)}`;
  const source=join(AUDIO_DIR,stem+'.mp3'),srt=join(AUDIO_DIR,stem+'.srt'),meta=join(AUDIO_DIR,stem+'.json');
  function check() {
    const words=parseSrt(readFileSync(srt,'utf8'));
    must(canonical(words.map(w=>w.text).join(''))===canonical(cue.text),`Incomplete service transcript ${cue.id}`);
    const info=probe(tools,source).streams[0],data=decode(tools,source);
    const duration=data.length/info.channels/Number(info.sample_rate);
    must(duration>.3&&words.length>0&&words.every(w=>w.end>w.start&&w.start>=0&&w.end<=duration+.05),`Service boundaries out of source ${cue.id}`);
    must(data.every(Number.isFinite),`Nonfinite service PCM ${cue.id}`);
    return words;
  }
  if([source,srt,meta].every(existsSync)) {
    const old=JSON.parse(readFileSync(meta,'utf8'));
    if(digest(old.parameters)===key&&old.sha256===sha256(source)&&old.srtSha256===sha256(srt)) {
      check(); console.log(`TTS ${cue.id}: verified raw cache ${params.rate}`); return {source,srt,meta,params,key,reused:true};
    }
  }
  let last;
  for(const route of ['direct','proxy']) {
    // The service can complete a websocket turn without returning any audio.
    // Retry that specific failure once; never certify empty media or bad words.
    for(let attempt=1;attempt<=2;attempt++) {
      try {
        console.log(`TTS ${cue.id}: generic ${VOICE} ${params.rate} ${PITCH}, ${route}, attempt ${attempt}`);
        run('python',['-c',TTS_CLI,route,'--voice',VOICE,`--rate=${params.rate}`,`--pitch=${PITCH}`,'--text',cue.text,
          '--write-media',source,'--write-subtitles',srt],false,85000);
        check(); json(meta,{parameters:params,sha256:sha256(source),srtSha256:sha256(srt),generic:true,voiceCloning:false});
        return {source,srt,meta,params,key,reused:false};
      } catch(error) {
        last=redact(error.message);
        const path=join(QA_DIR,'tts-errors.json'),errors=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):[];
        errors.push({id:cue.id,rate:params.rate,route,attempt,error:last});json(path,errors);console.warn(`TTS ${cue.id}: ${last}`);
        if(!last.includes('NoAudioReceived')) break;
      }
    }
  }
  throw new Error(`Real TTS failure ${cue.id}; no silent substitute. ${last}`);
}
function trimEdges(tools,source,words,dest) {
  const samples=decode(tools,source,true),duration=samples.length/SR;
  const r=run(tools.ffmpeg,['-hide_banner','-nostdin','-i',source,'-af','silencedetect=noise=-55dB:d=0.08','-f','null','-']);
  const silences=[];let a=null;
  for(const m of r.stderr.matchAll(/silence_(start|end):\s*([\d.]+)/g)) {
    if(m[1]==='start') a=Number(m[2]); else if(a!==null) {silences.push([a,Number(m[2])]);a=null;}
  }
  if(a!==null) silences.push([a,duration]);
  let start=0,end=duration;
  for(const [s,e] of silences) {
    if(s<.005) start=Math.max(0,Math.min(e-.04,words[0].start-.04));
    if(e>=duration-.01) end=Math.min(duration,Math.max(s+.08,words.at(-1).end+.06));
  }
  const first=Math.floor(start*SR),last=Math.ceil(end*SR);
  wave(dest,samples.slice(first,last));
  return {sourceDecodedDuration:duration,trimStart:first/SR,trimEnd:last/SR,duration:(last-first)/SR,
    removedSilence:duration-(last-first)/SR,internalSilenceRemoved:0};
}
export function narration(tools) {
  const voices=[],cues=[];
  for(const cue of VOICE_CUES) {
    let done=false;
    for(const rate of [-6,0]) {
      const raw=sourceVoice(cue,rate,tools),words=parseSrt(readFileSync(raw.srt,'utf8'));
      const trimPath=join(QA_DIR,`${cue.id}-trim.wav`),trim=trimEdges(tools,raw.source,words,trimPath);
      const span=cue.end-cue.at,tempo=Math.max(1,trim.duration/(span-.075));
      if(tempo>1.18) {console.log(`${cue.id} ${rate}% needs ${tempo.toFixed(4)}x; trying native normal rate, not chopping words`);continue;}
      const path=join(AUDIO_DIR,'voices',`${cue.id}.wav`),pre=join(QA_DIR,`${cue.id}-pre.wav`);
      ff(tools,['-i',trimPath,'-af',`${tempo>1?`atempo=${tempo.toFixed(12)},`:''}highpass=f=65,lowpass=f=10500`,'-c:a','pcm_f32le',pre]);
      const input=measure(tools,pre),gain=-19-input.LUFS;
      ff(tools,['-i',pre,'-af',`aresample=192000,volume=${gain}dB,alimiter=limit=${10**(-4/20)}:attack=3:release=65:level=false:latency=true,aresample=48000`,
        '-c:a','pcm_f32le',path]);
      const data=decode(tools,path),duration=data.length/SR,s=stats(data,1);
      must(duration>.35&&duration<=span-.02,`Voice ${cue.id} exceeds window: ${duration}s / ${span}s`);
      must(s.rmsDbFS>-33&&s.clipping===0&&s.nonfinite===0,`Invalid voice ${cue.id}: ${JSON.stringify(s)}`);
      const speechStart=cue.at+(words[0].start-trim.trimStart)/tempo,speechEnd=cue.at+(words.at(-1).end-trim.trimStart)/tempo;
      const end=cue.at+duration;
      must(speechStart>=cue.at-.002&&speechEnd<=end+.05,`Service mapping outside decoded voice ${cue.id}`);
      const voice={id:cue.id,at:cue.at,end:round(end),text:cue.text,source:relative(AUDIO_DIR,raw.source).split(sep).join('/'),
        windowEnd:cue.end,file:`voices/${cue.id}.wav`,voice:VOICE,generic:true,voiceCloning:false,rate:`${rate}%`,pitch:PITCH,tempo:round(tempo),tempoApplied:tempo,
        decodedFrames:data.length,sampleRate:SR,channels:1,sha256:sha256(path),sourceSha256:sha256(raw.source),
        srt:relative(AUDIO_DIR,raw.srt).split(sep).join('/'),srtSha256:sha256(raw.srt),
        cacheMetadata:relative(AUDIO_DIR,raw.meta).split(sep).join('/'),cacheMetadataSha256:sha256(raw.meta),cacheKey:raw.key,
        ...trim,speechStart:round(speechStart),speechEnd:round(speechEnd),duration:round(duration),endMargin:round(cue.end-end),
        chineseCharacters:han(cue.text),fixedGainDb:round(gain),...s,
        timingSource:'Service WordBoundary SRT; edge-only measured silence removal, then actual atempo; no word-time interpolation'};
      voices.push(voice);
      cues.push({start:cue.at,end:round(Math.max(end,cue.at+2)),text:cue.text,voiceId:cue.id});
      must(cues.at(-1).end<=cue.end,`Readable caption hold exceeds window ${cue.id}`);
      console.log(`${cue.id}: ${duration.toFixed(3)}s, ${rate}%, atempo ${tempo.toFixed(4)}, margin ${(cue.end-end).toFixed(3)}s`);
      done=true;break;
    }
    must(done,`Cannot fit ${cue.id} naturally at <=1.18x; no words truncated.`);
  }
  const captions={duration:DURATION,cues,voices};json(join(AUDIO_DIR,'captions.json'),captions);return captions;
}

function silenceArchive(tools,path,musicOnly) {
  // Fixed limiter/resampler ringing only: authored windows were already zero.
  const data=decode(tools,path);must(data.length===FRAMES*2,'Limiter changed frame count');
  if(musicOnly) data.fill(0,148.5*SR*2,150.5*SR*2);
  data.fill(0,179.98*SR*2);
  const l=new Float32Array(FRAMES),r=new Float32Array(FRAMES);
  for(let i=0;i<FRAMES;i++) {l[i]=data[2*i];r[i]=data[2*i+1];}
  wave(path,l,r);
}
function masterTrack(tools,source,stem,target,musicOnly) {
  const wav=join(AUDIO_DIR,stem+'.wav'),mp3=join(AUDIO_DIR,stem+'.mp3'),input=measure(tools,source);
  let gain=target-input.LUFS,ceiling=-2.6,output;
  for(let attempt=0;attempt<4;attempt++) {
    ff(tools,['-i',source,'-af',`aresample=192000,volume=${gain}dB,alimiter=limit=${10**(ceiling/20)}:attack=3:release=65:level=false:latency=true,aresample=48000`,
      '-c:a','pcm_f32le',wav]);
    silenceArchive(tools,wav,musicOnly);
    ff(tools,['-i',wav,'-map_metadata','-1','-c:a','libmp3lame','-b:a','256k','-write_xing','1','-id3v2_version','3',
      '-metadata',`title=${TITLE} / ${stem}`,'-metadata',`story_sha256=${LOCKED_STORY}`,'-metadata',`score_sha256=${sha256(SELF)}`,
      '-metadata','bpm=120','-metadata','comment=Original 8-bit score. Generic synthesized Mandarin narration where present. No voice cloning.',mp3]);
    output=measure(tools,mp3); console.log(`${stem} pass ${attempt+1}: ${output.LUFS} LUFS / ${output.truePeakDbTP} dBTP`);
    if(Math.abs(output.LUFS-target)<=.15&&output.truePeakDbTP<=-1.5) break;
    if(attempt<3) {
      gain+=clamp(target-output.LUFS,-1,1);
      if(output.truePeakDbTP>-1.5) ceiling-=output.truePeakDbTP+1.8;
    }
  }
  must(Math.abs(output.LUFS-target)<=1&&output.truePeakDbTP<=-1.5,`${stem} target failed: ${JSON.stringify(output)}`);
  return {targetLUFS:target,measuredInput:input,fixedGainDb:gain,ceilingDb:ceiling,adaptiveNormalization:false,
    limiter:{oversampling:4,stereoLinked:true,attackMs:3,releaseMs:65,latencyCompensated:true,autoLevel:false}};
}
function mix(tools,voices) {
  const music=decode(tools,join(AUDIO_DIR,'music.wav')),fx=decode(tools,join(AUDIO_DIR,'sfx.wav')),out=bus(),voiceBus=new Float32Array(FRAMES);
  for(const voice of voices) {
    const data=decode(tools,join(AUDIO_DIR,voice.file)),start=Math.round(voice.at*SR);
    must(start+data.length<=Math.round(voice.windowEnd*SR),'Voice outside mix window');voiceBus.set(data,start);
  }
  for(let i=0;i<FRAMES;i++) {
    const t=i/SR;let duck=1;
    for(const v of voices) duck=Math.min(duck,1-.66*smooth((t-v.at+.07)/.08)*(1-smooth((t-v.end)/.16)));
    const mg=.76*duck;
    out.l[i]=music[2*i]*mg+fx[2*i]*.7+voiceBus[i];out.r[i]=music[2*i+1]*mg+fx[2*i+1]*.7+voiceBus[i];
  }
  wave(join(QA_DIR,'voice-bus.wav'),voiceBus);wave(join(QA_DIR,'mix-premaster.wav'),out.l,out.r);
}
function spectrum(data,midi,start,seconds=.4,channels=2) {
  const n=Math.round(seconds*SR),a=Math.round(start*SR),omega=TAU*hz(midi)/SR;let re=0,im=0;
  for(let i=0;i<n;i++) {
    let v=0;for(let c=0;c<channels;c++) v+=data[(a+i)*channels+c]/channels;
    const w=.5-.5*Math.cos(TAU*i/(n-1));re+=v*w*Math.cos(omega*i);im-=v*w*Math.sin(omega*i);
  } return db(Math.hypot(re,im)*4/n);
}
function correlation(master,voice,at) {
  const a=Math.round(at*SR);let xy=0,xx=0,yy=0;
  for(let i=0;i<voice.length;i++) {const x=voice[i],y=(master[2*(a+i)]+master[2*(a+i)+1])/2;xy+=x*y;xx+=x*x;yy+=y*y;}
  return round(xy/Math.max(1e-30,Math.sqrt(xx*yy)));
}
export function verify(tools,report) {
  contract();must(report.storysha256===LOCKED_STORY&&report.scoreSha256===sha256(SELF),'Source hash mismatch');
  for(const [p,hash] of Object.entries(report.files)) must(sha256(join(ROOT,p))===hash,`Artifact hash mismatch ${p}`);
  const captions=JSON.parse(readFileSync(join(AUDIO_DIR,'captions.json'),'utf8'));
  must(digest(captions.voices)===digest(report.voices)&&captions.cues.length===26,'Caption records mismatch');
  const score=buildScore();must(score.eventSha256===report.composition.eventSha256,'Event table mismatch');
  const tracks={},decoded={};let rest;
  for(const name of ['master.mp3','master.wav','music.mp3','music.wav']) {
    const path=join(AUDIO_DIR,name),p=probe(tools,path),s=p.streams[0],data=decode(tools,path);
    must(p.streams.length===1&&s.channels===2&&Number(s.sample_rate)===SR,`${name} stream format`);
    must(name.endsWith('.mp3') ? s.codec_name==='mp3'&&Number(s.bit_rate)===256000 : s.codec_name==='pcm_f32le',`${name} codec`);
    must(data.length===FRAMES*2,`${name} frames ${data.length/2}, expected ${FRAMES}`);
    const m={decodedFrames:data.length/2,decodedDuration:data.length/2/SR,metadataDuration:Number(p.format.duration),...stats(data),...measure(tools,path)};
    const target=name.startsWith('music')?-13:-15;
    must(Math.abs(m.LUFS-target)<=1&&m.truePeakDbTP<=-1.5&&m.clipping===0&&m.nonfinite===0,`${name}: ${JSON.stringify(m)}`);
    must(m.correlation>0&&m.correlation<.999&&m.sideRmsDbFS>-42,`${name} stereo: ${JSON.stringify(m)}`);
    must(stats(data,2,179.99,180).peakDbFS<-80,`${name} final fade`);tracks[name]=m;
    if(name.endsWith('.mp3')) decoded[name]=data;
    if(name==='music.wav') rest=stats(data,2,148.5,150.5);
    console.log(`Verified complete ${name}: ${m.decodedFrames} frames, ${m.LUFS} LUFS`);
  }
  const voiceMetrics=[];
  for(const [i,v] of report.voices.entries()) {
    const cue=VOICE_CUES[i],data=decode(tools,join(AUDIO_DIR,v.file)),s=stats(data,1),duration=data.length/SR;
    must(v.id===cue.id&&v.text===cue.text&&v.at===cue.at&&v.end<=cue.end&&v.duration===round(duration),`Voice timing ${v.id}`);
    must(v.tempoApplied>=1&&v.tempoApplied<=1.18&&['-6%','0%'].includes(v.rate)&&v.generic&&!v.voiceCloning,'Voice identity/rate');
    must(s.clipping===0&&s.nonfinite===0&&s.rmsDbFS>-33,`Voice signal ${v.id}`);
    const words=parseSrt(readFileSync(join(AUDIO_DIR,v.srt),'utf8'));
    must(canonical(words.map(w=>w.text).join(''))===canonical(cue.text),`Incomplete transcript ${v.id}`);
    must(v.trimStart<=words[0].start-.0399&&v.trimEnd>=words.at(-1).end+.0599,`Trim clipped boundary ${v.id}`);
    const c=captions.cues[i];
    must(c.voiceId===v.id&&c.text===cue.text&&c.start===v.at&&c.end>=v.end&&c.end-c.start>=2-.000001&&c.end<=cue.end,'Full-caption timing');
    const corr=correlation(decoded['master.mp3'],data,v.at);
    must(corr>.40,`Voice absent/masked in actual master ${v.id}: correlation=${corr}`);
    voiceMetrics.push({id:v.id,decodedDuration:duration,decodedFrames:data.length,masterCorrelation:corr,...s});
  }
  const music=decoded['music.mp3'],master=decoded['master.mp3'];
  const mp3Rest=stats(music,2,148.56,150.44),spoken=stats(master,2,149.15,150.25);
  must(rest.peakDbFS===-240&&mp3Rest.peakDbFS<-100,`Music not silent: ${JSON.stringify({rest,mp3Rest})}`);
  must(spoken.rmsDbFS>-35,'149.1 revelation was muted');
  const chapters=CHAPTERS.map(c=>({id:c.id,start:c.start,end:c.end,...stats(music,2,c.start,c.end)}));
  const rms=id=>chapters.find(c=>c.id===id).rmsDbFS;
  const contrast={throneOverOpeningDb:round(rms('throne')-rms('gate')),roadOverFatigueDb:round(rms('road')-rms('wall')),
    throneOverFogDb:round(rms('throne')-rms('sea')),dawnOverCurtainDb:round(rms('dawn')-rms('curtain')),
    openDoorOverThroneDb:round(stats(music,2,174,178).rmsDbFS-rms('throne'))};
  must(contrast.throneOverOpeningDb>=7&&contrast.roadOverFatigueDb>=4&&contrast.throneOverFogDb>=9&&contrast.dawnOverCurtainDb>=9&&contrast.openDoorOverThroneDb>=1,
    `Narrative dynamics failed: ${JSON.stringify(contrast)}`);
  const bass=decode(tools,join(QA_DIR,'triangle-bass.flac')),harmony=decode(tools,join(QA_DIR,'reed-choir.flac'));
  const tonal={bassDBeforeDb:spectrum(bass,38,160.2)-spectrum(bass,41,160.2),bassFAfterDb:spectrum(bass,41,162.2)-spectrum(bass,38,162.2),
    chordDBeforeDb:spectrum(harmony,50,160.2)-spectrum(harmony,60,160.2),chordCAfterDb:spectrum(harmony,60,162.2)-spectrum(harmony,50,162.2),
    decodedMusicFAfterDb:spectrum(music,41,162.2)-spectrum(music,38,162.2)};
  must(Object.values(tonal).every(v=>v>6),`D-to-F actual spectral evidence failed: ${JSON.stringify(tonal)}`);
  return {tracks,voices:voiceMetrics,chapters,contrast,tonal,
    silence:{start:148.5,end:150.5,exactArchiveZeroFrames:96000,archive:rest,mp3Interior:mp3Rest,revelationInMaster:spoken},
    listeningTestPerformed:false};
}
function manifest() {
  const files={};
  function scan(dir) { for(const e of readdirSync(dir,{withFileTypes:true})) {
    const p=join(dir,e.name);
    if(e.isDirectory()) scan(p);
    // Live stdout/stderr change AFTER verification prints; they are diagnostics,
    // not immutable audio evidence. Never exclude any media or TTS cache here.
    else if(!e.name.endsWith('.log')&&!['report.json','independent-tests.json','failure.json','tts-errors.json'].includes(e.name))
      files[relative(ROOT,p).split(sep).join('/')]=sha256(p);
  } }
  scan(AUDIO_DIR);scan(QA_DIR);return files;
}
export function main(args=process.argv.slice(2)) {
  must(args.length===0||(args.length===1&&['--verify','--voices-only'].includes(args[0])),'Usage: node qin/score.mjs [--verify | --voices-only]');
  contract();const tools=getTools();
  if(args[0]==='--verify') {
    const report=JSON.parse(readFileSync(join(AUDIO_DIR,'report.json'),'utf8')),measured=verify(tools,report);
    must(digest(measured)===digest(report.measurements),'Stale stored measurements');console.log(JSON.stringify(measured,null,2));return;
  }
  dirs();const scoreHash=sha256(SELF);
  // Do not leave a previous PASS report after a failed/new build; preserve raw TTS caches.
  for(const p of [join(AUDIO_DIR,'report.json'),join(QA_DIR,'failure.json'),join(QA_DIR,'independent-tests.json')]) if(existsSync(p)) rmSync(owned(p));
  try {
    const captions=narration(tools);
    if(args[0]==='--voices-only') {console.log('26 real decoded voice clips and captions ready; music not yet certified.');return;}
    const score=buildScore();json(join(QA_DIR,'score-events.json'),score);
    writeFileSync(owned(join(QA_DIR,'composition.md')),`# 门外：原创主题与编配\n\n120 BPM / 360拍 / 90小节 / 4/4 / 八条器乐层（不是6/8拍号）。\n\n主题：${score.themeIdentity}。开头删去第五音F；162秒旋律与节奏不变，低D换低F，Dm换F。无旧片音轨/旋律导入。\n\n${score.chapters.map(c=>`- ${c.intent}`).join('\n')}\n\n全部音符、力度、声像、精确采样位置及角色见 score-events.json。独立stem用于实际解码频谱和能量验收，不以标签代替听感。未进行人耳试听。\n`);
    const synthesis=compose(tools,score);
    const musicProcessing=masterTrack(tools,join(QA_DIR,'music-premaster.wav'),'music',-13,true);
    mix(tools,captions.voices);
    const masterProcessing=masterTrack(tools,join(QA_DIR,'mix-premaster.wav'),'master',-15,false);
    const report={schemaVersion:1,title:TITLE,duration:DURATION,bpm:BPM,beats:TOTAL_BEATS,bars:90,sampleRate:SR,channels:2,
      storysha256:LOCKED_STORY,scoreSha256:scoreHash,mastersha256:sha256(join(AUDIO_DIR,'master.mp3')),
      musicsha256:sha256(join(AUDIO_DIR,'music.mp3')),captionSha256:sha256(join(AUDIO_DIR,'captions.json')),
      archiveSha256:sha256(join(AUDIO_DIR,'master.wav')),musicArchiveSha256:sha256(join(AUDIO_DIR,'music.wav')),
      voices:captions.voices,composition:{...score,...synthesis},files:manifest(),
      fileManifestPolicy:'All audio files, raw TTS audio/SRT/metadata, stems, event table and stable QA media; excludes live .log diagnostics, self-referential report.json and independently hashed test results.',
      processing:{master:masterProcessing,music:musicProcessing,voiceTargetMonoLUFS:-19,voiceMaximumAtempo:1.18,
        voiceFilter:'65Hz highpass; 10.5kHz lowpass; fixed gain; 4x peak-only limiter; no internal pause removal',
        musicOnlyRest:[148.5,150.5],musicFade:[178.8,179.96],musicDucking:{attackSeconds:.08,releaseSeconds:.16,underVoiceGain:.34,bedGain:.76},
        archive:'IEEE float32 48kHz stereo',delivery:'MP3 48kHz stereo 256kbps with Xing gapless metadata'},
      provenance:{music:'New deterministic local oscillator/noise composition; no samples or existing melody imported',
        techniquesOnly:['polyBLEP oscillator','fixed-gain 4x oversampled linked peak limiter'],
        voice:{provider:'Microsoft Edge TTS via installed edge-tts',identity:VOICE,generic:true,voiceCloning:false,pitch:PITCH,defaultRate:'-6%'},
        networkScope:'Only these 26 utterances and TTS parameters; no other workspace content transmitted',
        runtimeNetworkRequired:false,listeningTestPerformed:false},
      captions:{file:'captions.json',count:26,maximumHanCharacters:21,minimumReadableSeconds:2,
        timing:'One complete script utterance per cue; start/end from actual decoded clip, extending short clips to 2s for reading; service speech boundaries separately preserved'}};
    report.measurements=verify(tools,report);
    must(sha256(SELF)===scoreHash&&sha256(STORY)===LOCKED_STORY,'Source changed during production');
    report.validation={passed:true,fullDecode:true,hashes:true,serviceTranscriptComplete:true,allVoicesInMaster:true,
      exactMusicRest:true,narrativeDynamics:true,spectralReharmonization:true,listeningTestPerformed:false,browserTestPerformed:false,
      independentTestCommand:'node --test qin/audio-test.mjs',independentTestExecutedByThisBuild:false};
    json(join(AUDIO_DIR,'report.json'),report);
    console.log(JSON.stringify({passed:true,tracks:report.measurements.tracks,voices:report.voices.length,hanCharacters:313,
      contrast:report.measurements.contrast,tonal:report.measurements.tonal,silence:report.measurements.silence,listeningTestPerformed:false},null,2));
  } catch(error) {
    json(join(QA_DIR,'failure.json'),{passed:false,error:redact(error.stack),silentSubstitute:false});throw error;
  }
}
if(process.argv[1]&&resolve(process.argv[1])===SELF) {
  try {main();} catch(error) {console.error(redact(error.stack));process.exitCode=1;}
}