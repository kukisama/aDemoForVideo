/**
 * ONE MORE HORIZON / 西部余烬 — original instrumental Western cinema.
 * node <absolute path>/rdr2/score.mjs [--verify]
 * No samples, voice, TTS, network, game music, or master bit reduction.
 * One-bar stereo buffers and streaming PCM verification: memory is duration-independent.
 * Writes only rdr2/audio; validates staged audio before replacing the published pair.
 */
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, openSync, writeSync, closeSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TITLE as FILM_TITLE, BPM, BEAT, DURATION, TOTAL_BEATS, CHAPTERS } from './story.mjs';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const SELF = fileURLToPath(import.meta.url), STORY = fileURLToPath(new URL('./story.mjs', import.meta.url));
export const AUDIO_DIR = fileURLToPath(new URL('./audio/', import.meta.url));
export const SR = 48000, FRAMES = 8640000, SPB = 22500, BAR = 90000;
export const TITLE = 'One More Horizon / 西部余烬·再一个远方';
const TAU = Math.PI * 2, SEED = 0x57455354;
const COMMENT = 'Original instrumental Western score. Synthesized instruments only; no speech, TTS, samples, quotations or game soundtrack. 128 BPM.';
const assert = (ok, text) => { if (!ok) throw new Error(text); };
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const db = x => 20 * Math.log10(Math.max(1e-12, x));
const round = x => Math.round(x * 1e6) / 1e6;
const digest = data => createHash('sha256').update(data).digest('hex');
const sha = path => digest(readFileSync(path));
const json = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
const rng = initial => { let s = initial >>> 0; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; };

export function contract() {
  const boundaries = [0,7.5,22.5,37.5,56.25,67.5,82.5,97.5,108.75,123.75,138.75,153.75,165,180];
  const ids = ['promise','snow','camp','arthur','frontier','city','pursuit','plan','escape','fracture','choice','rider','redemption'];
  assert(BPM === 128 && BEAT === .46875 && DURATION === 180 && TOTAL_BEATS === 384, 'Requires exact 180s / 128 BPM / 384 beats.');
  assert(CHAPTERS.length === 13 && CHAPTERS.every((c,i) => c.id === ids[i] && c.start === boundaries[i] && c.end === boundaries[i+1] && (c.end-c.start)/BEAT/4 === c.bars), 'Thirteen unequal chapter boundaries changed.');
  assert(CHAPTERS.every(c => Number.isInteger(c.start / BEAT / 4)) && SPB === SR * BEAT && FRAMES === SR * DURATION, 'Non-integral beat/bar clock.');
  return true;
}

// Entirely new eight-bar leitmotif: D–F–E–A / C–D–A, an upward reach and a falling answer.
// Tuples: [beat in bar, MIDI pitch, gate in beats]. Space between phrases is intentional.
export const THEME = [
  [[0,74,1.25],[1.5,77,.5],[2.5,76,.5],[3.25,69,.5]],
  [[0,72,.75],[1,74,1.5],[3,69,.75]],
  [[0,77,1],[1.5,81,.75],[2.5,79,.5],[3.25,77,.5]],
  [[0,76,1.5],[2,72,.75],[3,69,.75]],
  [[0,74,.75],[1,77,.5],[2,81,1.5]],
  [[0,82,.75],[1,81,.75],[2,79,.5],[3,77,.75]],
  [[0,76,.75],[1,73,.5],[2,69,.75],[3,76,.75]],
  [[0,77,.75],[1,76,.5],[2,74,1.75]],
];
const H = {
  Dm9: [38,[57,62,65,69,76]], Dm: [38,[57,62,65,69]], DmA: [33,[57,62,65,69]],
  Bbmaj7: [34,[58,62,65,69]], BbD: [38,[58,62,65,69]], F: [41,[57,60,65,69]],
  F9: [41,[57,60,65,67]], F6: [41,[57,60,62,65]], FA: [33,[57,60,65,69]],
  C: [36,[55,60,64,67]], CE: [40,[55,60,64,67]], Csus: [36,[55,60,65,67]],
  Gm: [31,[55,58,62,67]], G: [31,[55,59,62,67]], G9: [31,[55,59,62,69]],
  A7: [33,[57,61,64,67]], A7sus: [33,[57,62,64,67]], A7b9: [33,[57,61,64,67,70]],
  ACs: [37,[57,61,64,69]], Cm: [36,[55,60,63,67]], GB: [35,[55,59,62,67]],
  Bbm: [34,[58,61,65,70]], Ebmaj7: [39,[55,58,62,63]], Em7b5: [40,[55,58,62,64]],
  D: [38,[57,62,66,69]], D9: [38,[57,62,66,69,76]], DFs: [42,[57,62,66,69]],
  Bm: [35,[54,59,62,66]], Asus: [33,[57,62,64,69]], Dopen9: [38,[57,62,69,76]],
};
export const SECTIONS = [
  { id:'promise', key:'D minor · tonic pedal / suspended dominant', gain:.36, chords:['Dm9','BbD','DmA','A7sus'],
    instruments:['low FM reed','muted guitar','triangle drone','distant pulse whistle'],
    transformation:'Unanswered two-note fragments; no backbeat or dance kick.', intent:'安静、阴郁的承诺；先听见疑问，不急着亮出英雄。' },
  { id:'snow', key:'D minor · Aeolian', gain:.70, chords:['Dm9','Bbmaj7','F9','Csus','Dm','Gm','Bbmaj7','A7sus'],
    instruments:['breathy pulse whistle','slow wide strings','guitar harmonics','half-time floor tom','triangle bass'],
    transformation:'Theme opening stretched to twice its length; high register against broad low strings.', intent:'风雪里的慢半拍；宽阔、艰难，但远处仍有路。' },
  { id:'camp', key:'F major', gain:.78, chords:['F','CE','Dm','Bbmaj7','FA','Gm','C','F6'],
    instruments:['Karplus guitar','bright banjo','FM harmonica','brushed snare','soft triangle bass'],
    transformation:'D-minor scale degrees remapped to F major; alternating plucked call and reed answer.', intent:'篝火与家的温度；拨弦和簧片像两个人接话。' },
  { id:'arthur', key:'D minor · harmonic-minor dominant', gain:1.02, chords:['Dm','Bbmaj7','F','C','Dm','Gm','A7','Dm','Bbmaj7','A7'],
    instruments:['sliding pulse whistle','guitar','banjo','horns','strings','triangle bass','hoof blocks','snare and toms'],
    transformation:'First complete eight-bar theme, then a new two-bar horn answer; walking gallop, not four-on-the-floor.', intent:'坚定却有重量的英雄主题；他扛着人，而不只是冲锋。' },
  { id:'frontier', key:'F Lydian / D Dorian', gain:1.01, chords:['F9','C','G9','Dm9','F9','G9'],
    instruments:['high whistle','flowing guitar','banjo harmonics','wide strings','horn countermelody','open ride'],
    transformation:'Independent six-bar flight phrase, Lydian B-natural, long arch over flowing plucks.', intent:'六小节开阔飞行；旋律越过山脊，节拍不催人逃跑。' },
  { id:'city', key:'D minor · chromatic descent D–C#–C–B–Bb–A', gain:.87, chords:['Dm','ACs','Cm','GB','Bbm','A7sus','Ebmaj7','A7b9'],
    instruments:['damped guitar ostinato','metallic piano','short pulse','dry rim','mechanical hat','triangle bass'],
    transformation:'Shortened motif cells locked to chromatically descending harmony; asymmetrical iron pulse.', intent:'城市像齿轮咬合；和声收窄、半音下行，不靠提速变危险。' },
  { id:'pursuit', key:'D minor · dominant tension', gain:1.04, chords:['Dm','DmA','Bbmaj7','A7','Gm','Em7b5','A7b9','A7'],
    instruments:['clipped whistle','low harmonica','banjo ostinato','tremolo strings','galloping hats','snare','tuned toms'],
    transformation:'Diminished motif fragments and a separate climbing ostinato; sixteenth gallop.', intent:'追踪收紧；高帽和马蹄交错，主旋律开始喘不过气。' },
  { id:'plan', key:'D minor · suspended / A7(b9)', gain:.49, chords:['Dm9','BbD','DmA','A7sus','Em7b5','A7b9'],
    instruments:['exposed FM harmonica','single guitar notes','thin pulse','low strings','late tom pickup'],
    transformation:'Opening promise returns altered; exact one-beat full hold at beat 220, then an unresolved pickup.', intent:'又一个明天：承诺断了一拍，没有答案；留白之后才重新吸气。' },
  { id:'escape', key:'D minor · heroic', gain:1.29, chords:['Dm','Bbmaj7','F','C','Dm','Gm','A7','Dm'],
    instruments:['octave whistle and reed','banjo runs','guitar','wide brass and strings','independent counterline','triangle sub','double-time snare','gallop hats','toms'],
    transformation:'Largest entrance: full theme plus independent brass answer, double-time backbeat at unchanged 128 BPM.', intent:'全片最大释放；马蹄、雷声与人的决心同时向前。' },
  { id:'fracture', key:'D minor · exposed add9 / G minor', gain:.47, chords:['Dm9','Bbmaj7','Gm','DmA','BbD','Gm','A7sus','Dm9'],
    instruments:['left muted guitar','right cold FM harmonica','quiet triangle pedal'],
    transformation:'Cold antiphonal duet, low-register motif with missing answers; no drums, brass or pad.', intent:'冷色二重奏：同一主题，从左右两边说出不同的话。' },
  { id:'choice', key:'D minor → A suspended dominant', gain:.58, chords:['Dm9','BbD','Gm','DmA','Bbmaj7','Gm','A7sus','A7'],
    instruments:['sparse synthesized piano','lonely pulse whistle','late string swell','late tom staircase','filtered wind riser'],
    transformation:'Single piano tones and long rests; second half adds harmonic suspensions and an eight-beat rise.', intent:'先听清选择的重量，再让弦乐缓缓把视线抬向黎明。' },
  { id:'rider', key:'D major', gain:1.10, chords:['D9','G','Bm','DFs','G9','Asus'],
    instruments:['major whistle reprise','bright banjo','guitar','wide horns and strings','moving counterline','riding percussion'],
    transformation:'Six-bar major-mode reprise; F# and B-natural replace the minor-mode shadows.', intent:'明亮的再出发，不是宣布胜利；骑手终于把目光转向前方。' },
  { id:'redemption', key:'D major / borrowed Bb and G minor → D5(add9)', gain:1.02, chords:['D9','Bbmaj7','G','DFs','Gm','Dm9','Asus','Dopen9'],
    instruments:['bittersweet whistle','wide strings','warm horns','guitar','FM reed answer','low toms','open fifth and ninth'],
    transformation:'Major light meets borrowed minor chords; last sonority D–A–E omits the third, lead ends on E.', intent:'宏大而苦甜；不替角色作答，最后把问题留在九音上。' },
];

export const CUES = [
  { id:'instrumental-flight', start:56.25, end:67.5, beat:120, bars:6, instruction:'Six-bar panoramic musical flight; all audio remains instrumental.' },
  { id:'broken-promise-hold', start:103.125, end:103.59375, beat:220, durationBeats:1, allBusesMuted:true,
    instruction:'Exactly one missing beat. Hold the image / let the promise hang; resume on beat 221, do not move the 128 BPM clock.', edgeRampMs:8 },
  { id:'largest-drop', start:108.75, beat:232, instruction:'Escape downbeat: full ensemble and double-time-like snare. Tempo remains 128 BPM.', preEntranceTaperMs:12 },
  { id:'cold-duet-cut', start:123.75, beat:264, instruction:'Cut drums/brass/reverb tails to the exposed guitar–reed duet.' },
  { id:'choice-riser', start:150, end:153.75, beat:320, durationBeats:8, instruction:'Eight-beat orchestral rise, no tempo ramp.' },
  { id:'major-reprise', start:153.75, beat:328, instruction:'First full D-major arrival: bright rider reprise.' },
  { id:'unanswered-ending', start:178.125, beat:380, instruction:'D–A–E open final chord; whistle on E, no closed triumphant cadence.' },
  { id:'terminal-fade', start:178.8, end:180, startSample:8582400, endSample:8640000, instruction:'Continuous 1.2-second smooth fade. This is an envelope, not a tempo change or extra cut.' },
];

// Preserve the motif's degrees, rather than merely transposing minor intervals.
function major(midi, root = 74) {
  const rel = midi - 74, octave = Math.floor(rel / 12), pc = ((rel % 12) + 12) % 12;
  const degrees = { 0:0, 2:2, 3:4, 5:5, 7:7, 8:9, 10:11, 11:11 };
  return root + octave * 12 + (degrees[pc] ?? pc);
}

export function buildScore() {
  contract(); const events = [], bars = [];
  let section = 0;
  const add = (kind, beat, midi, length, gain, pan = 0, extra = {}) => {
    const c = CHAPTERS[section], endBeat = c.end / BEAT;
    if (beat >= endBeat || (beat >= 220 && beat < 221)) return;
    assert(Number.isInteger(beat * 4), `Non-sixteenth-grid event ${kind} at ${beat}.`);
    const release = ['strings','horn'].includes(kind) ? .32 : ['guitar','banjo','piano'].includes(kind) ? .18 : .055;
    const gate = Math.min(length * BEAT, c.end - beat * BEAT);
    const duration = Math.min(gate + release, c.end - beat * BEAT);
    events.push({ kind, beat, sample:Math.round(beat * SPB), midi, gate, duration, gain:gain * SECTIONS[section].gain, pan, section, ...extra });
  };
  const chord = (kind, at, notes, length, gain, extra = {}) => notes.forEach((m,i) => add(kind,at,m,length,gain,-.82 + 1.64*i/Math.max(1,notes.length-1),extra));
  const phrase = (at, which, kind, gain, options = {}) => {
    let previous = null;
    for (const [offset,midi,duration] of THEME[which]) {
      const pitch = (options.major ? major(midi,options.root ?? 74) : midi) + (options.octave ?? 0);
      const stretch = options.stretch ?? 1;
      add(kind,at+offset*stretch,pitch,duration*stretch,gain,options.pan ?? -.12,{ ...options.timbre, from:previous, slide:kind === 'whistle' ? .036 : 0 });
      previous = pitch;
    }
  };
  const low = (at, midi, length, gain = .30) => add('bass',at,midi,length,gain);
  const perc = (kind, at, gain, pan = 0, midi = 48) => add(kind,at,midi,kind === 'tom' ? .75 : .5,gain,pan);
  const plucks = (at, tones, type, gain, mode = 'flow') => {
    const positions = mode === 'slow' ? [0,1.5,3] : mode === 'gallop' ? [0,.5,.75,1.5,2,2.5,2.75,3.5] : [0,.5,1,1.5,2,2.5,3,3.5];
    positions.forEach((off,i) => add(type,at+off,tones[(i*2+Math.floor(i/4))%tones.length] + (type === 'banjo' ? 12 : 0),type === 'banjo' ? .7 : 1.5,gain*(i%3===0?1:.74),type === 'banjo' ? .54 : -.48));
  };
  const riding = (at, level, style) => {
    const fast = style === 'escape', pursuit = style === 'pursuit';
    const kicks = fast ? [0,1.5,2,3.25] : pursuit ? [0,1.75,2.5] : [0,2.5];
    kicks.forEach((off,i) => perc('kick',at+off,level*(i===0?.66:.43)));
    (fast ? [.5,1.5,2.5,3.5] : [2]).forEach(off => perc('snare',at+off,level*(fast?.56:.43),.08));
    for (let k=0;k<4;k++) {
      [0,.5,.75].forEach((off,i) => perc('hoof',at+k+off,level*(i===0?.14:.09),i===1?-.5:.45,63+i*5));
      if (pursuit || fast) [0,.25,.5,.75].forEach((off,i) => perc('hat',at+k+off,level*(i===2?.17:.085),i%2?.60:-.40));
      else perc('hat',at+k+.5,level*.11,.5);
    }
  };

  for (section=0;section<CHAPTERS.length;section++) {
    const c=CHAPTERS[section], config=SECTIONS[section], origin=c.start/BEAT;
    assert(config.id === c.id && config.chords.length === c.bars, `Arrangement length ${c.id}.`);
    for (let bar=0;bar<c.bars;bar++) {
      const at=origin+bar*4, name=config.chords[bar], [root,tones]=H[name];
      bars.push({ bar:at/4, beat:at, at:at*BEAT, sample:at*SPB, section:c.id, chord:name, rootMidi:root });
      switch (c.id) {
        case 'promise':
          low(at,38,3.7,.19);
          add('reed',at,bar<2?50:57,3.25,.095,.25,{ cold:true });
          add('guitar',at+(bar%2?2:0),tones[1],2.75,.22,-.45,{ muted:true });
          if (bar===1) { add('whistle',at,74,1.5,.16,-.12); add('whistle',at+2,77,1,.11,.12,{ from:74,slide:.055 }); }
          if (bar===3) add('whistle',at+1,76,2.5,.17,.1,{ from:77,slide:.06 });
          break;
        case 'snow':
          chord('strings',at,tones,3.8,.078,{ slow:true }); low(at,root,3.6,.24);
          add('guitar',at,tones[2]+12,3.5,.22,-.5);
          if (bar%2===0) { perc('tom',at,.21,-.25,38); phrase(at,bar/2,'whistle',.26,{ stretch:2 }); }
          else { perc('brush',at+2,.14,.35); add('reed',at+2,tones[0],1.75,.12,.48,{ cold:true }); }
          break;
        case 'camp':
          // C/E's bass is E, not the chord root: its answering chord tone is G, not B.
          low(at,root,1.6,.23); low(at+2,name==='CE'?43:root+7,1.3,.18);
          plucks(at,tones,'guitar',.21); plucks(at+1,tones.slice(1),'banjo',.09,'slow');
          phrase(at,bar,bar%2?'reed':'guitar',bar%2?.22:.48,{ major:true,root:77,octave:-12,pan:bar%2?.28:-.25 });
          perc('brush',at+2,.19,.3); perc('hoof',at,.085,-.35,65);
          break;
        case 'arthur':
          low(at,root,1.4,.31); low(at+1.5,root+12,.8,.23); low(at+2.75,root+7,1,.25);
          chord('strings',at,tones,3.85,.062); plucks(at,tones,'guitar',.23,'gallop');
          plucks(at,tones,'banjo',.12,'gallop'); riding(at,.85,'ride');
          if (bar<8) phrase(at,bar,'whistle',.36);
          else [[0,bar===8?77:76,1.25],[1.5,bar===8?74:73,.75],[2.75,bar===8?69:69,1]].forEach(([t,m,d])=>add('horn',at+t,m-12,d,.23,.25));
          if (bar%2===1) { add('horn',at,tones[0],1.5,.17,-.6); add('reed',at+2.5,tones[2]+12,1,.12,.6); }
          if (bar===7 || bar===9) [2.5,3,3.5].forEach((t,i)=>perc('tom',at+t,.24,-.5+i*.5,52-i*5));
          break;
        case 'frontier': {
          const flight=[[[0,81,2],[2.5,79,1]],[[0,79,1],[1.5,76,.5],[2.5,72,1]],[[0,83,1.5],[2,81,.5],[3,79,.75]],[[0,81,2],[2.5,77,1]],[[0,84,1.25],[1.5,81,1],[3,79,.75]],[[0,83,1.5],[2,81,1.75]]];
          flight[bar].forEach(([t,m,d],i)=>add('whistle',at+t,m,d,.30,-.1,{ from:i?flight[bar][i-1][1]:m-2,slide:.045 }));
          chord('strings',at,tones.map(m=>m+12),3.9,.064,{ slow:true });
          add('horn',at+1,tones[1],2.8,.16,.50); low(at,root,3.65,.25);
          plucks(at,tones,'guitar',.24); plucks(at+1,tones,'banjo',.10,'slow');
          perc('tom',at,.25,-.2,41); perc('ride',at+2,.12,.55);
          break;
        }
        case 'city':
          [0,.75,1.5,2.5,3.25].forEach((t,i)=>{ low(at+t,root+(i%2?12:0),.35,.27); add('guitar',at+t,tones[i%tones.length],.25,.24,-.3,{ muted:true }); perc('rim',at+t,.19,.25,77); });
          [0,1,2,3].forEach(t=>{ perc('hat',at+t,.115,.5); add('piano',at+t,tones[(t+1)%tones.length]+12,.45,.13,-.5,{ metal:true }); });
          add('whistle',at+.5,tones[2]+12,.5,.20,-.12); add('whistle',at+2,tones[1]+12,.75,.18,.12);
          if (bar>3) chord('strings',at,tones,3.8,.036,{ cold:true });
          break;
        case 'pursuit':
          riding(at,.95,'pursuit'); plucks(at,tones,'banjo',.22,'gallop');
          [0,.75,1.5,2.5,3.25].forEach((t,i)=>low(at+t,root+(i%2?12:0),.55,.27));
          chord('strings',at,tones,3.8,.055,{ tremolo:true });
          THEME[bar].slice(0,3).forEach(([t,m,d])=>add('whistle',at+t,m,Math.min(.65,d),.29,-.14,{ from:m-1,slide:.025 }));
          add('reed',at+2.5,tones[1],1.25,.16,.45);
          if (bar%2===1) [3,3.5,3.75].forEach((t,i)=>perc('tom',at+t,.26+i*.035,-.5+i*.45,53-i*5));
          break;
        case 'plan':
          if (bar!==3) { low(at,root,3.5,.19); add('guitar',at,tones[1],2,.26,-.40,{ muted:true }); }
          if (bar<3) { add('reed',at,THEME[bar][0][1]-12,2.7,.23,.3,{ cold:true }); add('whistle',at+3,THEME[bar][1][1],.65,.13,-.2); }
          if (bar===3) { add('whistle',at+1,76,2.6,.20,-.12); add('guitar',at+1,57,2.5,.25,-.5); }
          if (bar>=4) { chord('strings',at,tones,3.8,.055,{ slow:true }); add('reed',at+1,bar===4?64:61,2.5,.25,.3); }
          if (bar===5) { [2,3,3.5].forEach((t,i)=>perc('tom',at+t,.22+i*.07,-.4+i*.4,45+i*3)); add('wind',at,60,4,.13); }
          break;
        case 'escape':
          riding(at,1.18,'escape'); plucks(at,tones,'guitar',.26,'gallop'); plucks(at,tones,'banjo',.22);
          [0,.75,1.5,2,2.75,3.5].forEach((t,i)=>low(at+t,root+(i%3===1?12:0),.65,.34));
          chord('strings',at,tones,3.85,.074); chord('horn',at,tones.slice(0,3),1.5,.085);
          phrase(at,bar,'whistle',.36); phrase(at,bar,'reed',.12,{ octave:-12,pan:.22 });
          [0.5,1.5,2.5,3.5].forEach((t,i)=>add('horn',at+t,tones[(i+bar)%tones.length]+(i%2?12:0),.65,.11,i%2?-.58:.58));
          if (bar===0 || bar===4) { perc('cymbal',at,.24,.55); perc('tom',at,.50,-.35,36); }
          if (bar%2===1) [3,3.25,3.5,3.75].forEach((t,i)=>perc('tom',at+t,.28+i*.035,-.6+i*.4,57-i*5));
          break;
        case 'fracture':
          // Sustain a very quiet floor beneath the duet's unanswered rests; not an extra pad.
          low(at,root,3.85,.10);
          if (bar%2===0) phrase(at,bar,'guitar',.44,{ octave:-12,pan:-.6,timbre:{muted:true} });
          else phrase(at,bar,'reed',.25,{ octave:-12,pan:.60,timbre:{cold:true} });
          add(bar%2?'guitar':'reed',at+2.5,tones[0],1.2,bar%2?.17:.10,bar%2?-.60:.6,{ cold:true,muted:true });
          break;
        case 'choice':
          add('piano',at,root+12,3.5,.29,-.28); add('piano',at,tones[1]+12,2.8,.25,.30);
          if (bar<4) add('whistle',at+2,THEME[bar][0][1],1.5,.17,-.05,{ from:THEME[bar][0][1]-1,slide:.065 });
          else { chord('strings',at,tones,3.8,.030+(bar-4)*.017,{ slow:true }); add('piano',at+2,tones[2]+12,1.8,.29,.32); low(at,root,3.5,.18); }
          if (bar>=6) { [0,2,3].forEach((t,i)=>perc('tom',at+t,.18+(bar-6)*.10+i*.025,-.4+i*.4,42+i*3)); }
          if (bar===6) add('wind',at,64,8,.30);
          break;
        case 'rider':
          phrase(at,[0,1,2,4,5,7][bar],'whistle',.35,{ major:true });
          chord('strings',at,tones,3.85,.075); chord('horn',at,tones.slice(0,3),2.6,.088);
          riding(at,.92,'ride'); plucks(at,tones,'guitar',.24); plucks(at,tones,'banjo',.18,'gallop');
          low(at,root,1.6,.31); low(at+2,root+7,1.5,.27);
          [1,2.5,3.5].forEach((t,i)=>add('reed',at+t,tones[(i+1)%tones.length]+12,.7,.12,.52));
          if (bar===0) perc('cymbal',at,.19,.55);
          break;
        case 'redemption':
          chord('strings',at,tones,3.95,.10,{ slow:true }); chord('horn',at,tones.slice(0,3),3.6,.087,{ slow:true });
          low(at,root,3.8,.28); plucks(at,tones,'guitar',.25,'slow');
          if (bar<6) { phrase(at,bar,'whistle',.31,{ major:[0,2,3].includes(bar) }); add('reed',at+2,tones[2],1.7,.13,.4); }
          if (bar===6) { add('whistle',at,77,1,.28,-.1); add('whistle',at+1.5,76,2.25,.25,-.1,{ from:77,slide:.06 }); }
          if (bar===7) { add('whistle',at,76,3.8,.24,-.08); add('piano',at,88,3.9,.20,.4); }
          if (bar<6) { perc('tom',at,.31,-.25,38); if (bar%2===1) perc('brush',at+2,.16,.4); }
          if (bar===0) perc('cymbal',at,.20,.55);
          break;
      }
    }
  }
  events.sort((a,b)=>a.sample-b.sample);
  // Bar-offset helpers must not spill accompaniment into the next act.
  for (const e of events) {
    assert(e.sample >= CHAPTERS[e.section].start*SR && e.sample < CHAPTERS[e.section].end*SR, `Event outside its act: ${e.kind}.`);
    assert(e.duration>0 && e.sample+Math.round(e.duration*SR)<=CHAPTERS[e.section].end*SR, 'Voice tail outside act.');
  }
  const sections = SECTIONS.map((s,i)=>{
    const { gain, chords, ...rest }=s, c=CHAPTERS[i], selected=events.filter(e=>e.section===i), counts={};
    for (const e of selected) counts[e.kind]=(counts[e.kind]??0)+1;
    return { ...rest, start:c.start,end:c.end,bars:c.bars,startBeat:c.start/BEAT,startSample:c.start*SR,notes:selected.length,eventCounts:counts,
      rhythmSignature:digest(JSON.stringify(selected.map(e=>[e.kind,e.beat-c.start/BEAT,e.midi]))).slice(0,16) };
  });
  assert(new Set(sections.map(s=>s.rhythmSignature)).size===13, 'Repeated chapter arrangement.');
  return { events,bars,sections,eventSha256:digest(JSON.stringify(events)) };
}

function blep(p,d) {
  if (p<d) { const x=p/d; return x+x-x*x-1; }
  if (p>1-d) { const x=(p-1)/d; return x*x+x+x+1; }
  return 0;
}
const saw = (p,d) => 2*p-1-blep(p,d);
const pulse = (p,d) => (p<.375?.625:-.375)+.5*blep(p,d)-.5*blep((p+.625)%1,d);
const env = (t,gate,attack,release) => smooth(t/attack)*(1-smooth((t-gate)/Math.max(.001,release)));

// Each event owns a tiny persistent oscillator/delay state; never an entire note buffer.
function voice(e,index) {
  const random=rng(SEED ^ Math.imul(index+1,0x9e3779b1)), noise=()=>random()*2-1;
  const f=hz(e.midi), gate=e.gate, total=e.duration, release=Math.max(.005,total-gate);
  const envelope=(t,attack=.005)=>env(t,gate,attack,release)*(1-smooth((t-(total-.012))/.012));
  let p=0,q=.27,lo=0,hi=0,phase=0;
  let render,room=.15,delay=0;
  switch (e.kind) {
    case 'whistle': {
      const from=e.from==null?f:hz(e.from), slide=e.slide??.04;
      room=.22; delay=.08;
      render=t=>{
        const base=from+(f-from)*smooth(t/Math.max(.001,slide));
        const d=base*(1+.0024*Math.sin(TAU*5.2*t)*smooth((t-.16)/.15))/SR;
        p=(p+d)%1;
        lo+=.25*((pulse(p,d)*.55+Math.sin(TAU*p)*.65)-lo);
        return lo*envelope(t,.013)*(.90+.10*Math.exp(-t*7));
      };
      break;
    }
    case 'guitar': case 'banjo': {
      const banjo=e.kind==='banjo', damp=banjo?.19:e.muted?.58:.39;
      // Fractional-delay Karplus–Strong; averaging filter's phase delay is compensated.
      const filterDelay=damp/(1-damp), period=SR/f-filterDelay, length=Math.ceil(period)+2;
      const line=new Float32Array(length); let cursor=0,filtered=0,last=0,mean=0;
      for (let j=0;j<length;j++) { const n=noise(); filtered=.48*filtered+.52*n; line[j]=filtered; mean+=filtered; }
      mean/=length;
      for (let j=0;j<length;j++) line[j]=(line[j]-mean)*1.9;
      const decay=e.muted?.65:banjo?1.4:3.1, feedback=Math.exp(-Math.log(1000)/(f*decay));
      room=banjo?.13:.20; delay=banjo?.025:.045;
      render=t=>{
        let read=cursor-period; if (read<0) read+=length;
        const a=Math.floor(read), frac=read-a;
        const x=line[a]*(1-frac)+line[(a+1)%length]*frac;
        last=(1-damp)*x+damp*last; line[cursor]=last*feedback; cursor=(cursor+1)%length;
        const body=Math.sin(TAU*f*t)*Math.exp(-t*(banjo?8:4))*.18;
        const bridge=banjo?Math.sin(TAU*f*2.001*t)*Math.exp(-t*14)*.10:0;
        return (x*.78+body+bridge)*envelope(t,.0015);
      };
      break;
    }
    case 'reed':
      room=e.cold?.12:.23; delay=.035;
      render=t=>{
        const d=f*(1+.0022*Math.sin(TAU*4.8*t)*smooth(t/.2))/SR; p=(p+d)%1;
        const breath=.03*noise(); lo+=.12*(breath-lo);
        const fm=Math.sin(TAU*p+(e.cold?.38:.70)*Math.sin(TAU*p*2));
        return (fm*.69+Math.sin(TAU*p*2)*.16+Math.sin(TAU*p*3)*.06+lo)*envelope(t,.035);
      };
      break;
    case 'bass':
      room=.018;
      render=t=>{
        p=(p+f/SR)%1; const a=TAU*p;
        const triangle=Math.sin(a)-Math.sin(3*a)/9+Math.sin(5*a)/25-Math.sin(7*a)/49+Math.sin(9*a)/81;
        return (triangle*.79+Math.sin(a)*.16)*envelope(t,.006);
      };
      break;
    case 'strings': case 'horn': {
      const horn=e.kind==='horn', phases=[random(),random(),random()], detune=horn?[.997,1,1.003]:[.994,1,1.006];
      room=horn?.27:.37;
      render=t=>{
        let x=0;
        for(let k=0;k<3;k++) { const d=f*detune[k]/SR; phases[k]=(phases[k]+d)%1; x+=saw(phases[k],d)/3; }
        const cutoff=horn?1000+1600*smooth(t/.10)*Math.exp(-t*.9):e.cold?1100:2300;
        lo+=(1-Math.exp(-TAU*cutoff/SR))*(x-lo);
        const tremolo=e.tremolo?.72+.28*Math.sin(TAU*t/(BEAT/2))**2:1;
        return (lo*.92+Math.sin(TAU*phases[1])*(horn?.22:.06))*envelope(t,e.slow?.30:horn?.035:.14)*tremolo;
      };
      break;
    }
    case 'piano': {
      const partials=[1,2.001,3.006,4.013,5.025,6.04].filter(h=>f*h<18000), weights=[.72,.27,.14,.065,.035,.02];
      room=.29; delay=.045;
      render=t=>{
        let x=0;
        for(let k=0;k<partials.length;k++) x+=weights[k]*Math.sin(TAU*f*partials[k]*t)*Math.exp(-t*(1.2+k*1.1+(e.metal?2:0)));
        return x*envelope(t,.002);
      };
      break;
    }
    case 'kick':
      room=.08;
      render=t=>{
        phase+=TAU*(48+78*Math.exp(-t*44))/SR; lo+=.20*(noise()-lo);
        return (Math.sin(phase)*Math.exp(-t*17)+lo*.30*Math.exp(-t*70))*envelope(t,.001);
      };
      break;
    case 'snare': case 'brush': {
      const brush=e.kind==='brush'; room=brush?.17:.22;
      render=t=>{
        const w=noise(); lo+=.10*(w-lo); hi+=.58*(w-hi);
        const shell=(Math.sin(TAU*181*t)*.32+Math.sin(TAU*327*t)*.15)*Math.exp(-t*22);
        return ((hi-lo)*(brush?.65:1.45)*Math.exp(-t*(brush?17:23))+(brush?.15:1)*shell)*envelope(t,brush?.006:.001);
      };
      break;
    }
    case 'tom':
      room=.29;
      render=t=>{
        phase+=TAU*f*(1+.33*Math.exp(-t*24))/SR; lo+=.08*(noise()-lo);
        return (Math.sin(phase)*.85+Math.sin(phase*1.51)*.17+lo*.24)*Math.exp(-t*9)*envelope(t,.001);
      };
      break;
    case 'hoof': case 'rim': {
      const metal=e.kind==='rim'; room=.09;
      render=t=>{
        const w=noise(); lo+=.32*(w-lo);
        return ((Math.sin(TAU*(metal?1560:820)*t)+.5*Math.sin(TAU*(metal?2317:1370)*t))*Math.exp(-t*(metal?95:115))*.55+lo*.25*Math.exp(-t*130))*envelope(t,.0004);
      };
      break;
    }
    case 'hat': case 'ride': case 'cymbal': {
      const long=e.kind==='cymbal', ride=e.kind==='ride'; room=long?.36:.12;
      render=t=>{
        const w=noise(); lo+=.64*(w-lo); hi+=.16*(w-hi);
        const metal=Math.sin(TAU*5473*t)*Math.sin(TAU*8317*t)*.12;
        return ((w-lo)*.80+(lo-hi)*.10+metal)*Math.exp(-t*(long?5:ride?13:70))*envelope(t,.001);
      };
      break;
    }
    case 'wind':
      room=.30;
      render=t=>{
        const u=clamp(t/total), w=noise(); lo+=(.008+.18*u*u)*(w-lo); hi+=.006*(lo-hi);
        p=(p+(80+600*u*u)/SR)%1;
        return ((lo-hi)*.8+Math.sin(TAU*p)*.028)*u*u*envelope(t,.08);
      };
      break;
    default: throw new Error(`Unknown instrument ${e.kind}`);
  }
  return { ...e,index,render,room,delay,end:e.sample+Math.round(e.duration*SR),
    left:Math.cos((e.pan+1)*Math.PI/4)*e.gain,right:Math.sin((e.pan+1)*Math.PI/4)*e.gain,firstNonzero:null };
}

function wavHeader(frames) {
  const b=Buffer.alloc(44), size=frames*8;
  b.write('RIFF'); b.writeUInt32LE(size+36,4); b.write('WAVEfmt ',8); b.writeUInt32LE(16,16);
  b.writeUInt16LE(3,20); b.writeUInt16LE(2,22); b.writeUInt32LE(SR,24); b.writeUInt32LE(SR*8,28);
  b.writeUInt16LE(8,32); b.writeUInt16LE(32,34); b.write('data',36); b.writeUInt32LE(size,40); return b;
}

export function renderScore(path,score) {
  const dryL=new Float32Array(BAR),dryR=new Float32Array(BAR),sendL=new Float32Array(BAR),sendR=new Float32Array(BAR),echoL=new Float32Array(BAR),echoR=new Float32Array(BAR);
  const pcm=Buffer.alloc(BAR*8);
  const combs=[.0371,.0437,.0593,.0719].map((t,i)=>({ l:new Float32Array(Math.round(t*SR)),r:new Float32Array(Math.round((t+.0047)*SR)),il:0,ir:0,ll:0,lr:0,feedback:.68-i*.018 }));
  const delayL=new Float32Array(Math.round(SPB*.75)),delayR=new Float32Array(Math.round(SPB*.5));
  let diL=0,diR=0,dl=0,dr=0,prevL=0,prevR=0,dcL=0,dcR=0,eventIndex=0,active=[],peak=0,peakVoices=0,maxOnsetError=0,onsets=0;
  const cutSamples=new Set([97.5,103.125,108.75,123.75,138.75].map(t=>t*SR));
  const clearRoom=()=>{ for(const c of combs) { c.l.fill(0);c.r.fill(0);c.ll=c.lr=0; } delayL.fill(0);delayR.fill(0);dl=dr=0; };
  const sectionOnsets=CHAPTERS.map(c=>({ id:c.id,scheduledSample:c.start*SR,firstDrySample:null }));
  const fd=openSync(path,'w');
  try {
    writeSync(fd,wavHeader(FRAMES));
    for(let block=0;block<96;block++) {
      const start=block*BAR,end=start+BAR;
      for(const buffer of [dryL,dryR,sendL,sendR,echoL,echoR]) buffer.fill(0);
      while(eventIndex<score.events.length && score.events[eventIndex].sample<end) { active.push(voice(score.events[eventIndex],eventIndex)); eventIndex++; }
      peakVoices=Math.max(peakVoices,active.length);
      for(const v of active) {
        for(let sample=Math.max(start,v.sample);sample<Math.min(end,v.end);sample++) {
          const n=sample-v.sample,t=n/SR,k=sample-start,value=v.render(t,n);
          assert(Number.isFinite(value),`Nonfinite ${v.kind} sample ${sample}.`);
          if(v.firstNonzero===null && Math.abs(value)>1e-12) {
            v.firstNonzero=sample; maxOnsetError=Math.max(maxOnsetError,sample-v.sample); onsets++;
            const marker=sectionOnsets[v.section];
            if(marker.firstDrySample===null || sample<marker.firstDrySample) marker.firstDrySample=sample;
          }
          const l=value*v.left,r=value*v.right;
          dryL[k]+=l;dryR[k]+=r;sendL[k]+=l*v.room;sendR[k]+=r*v.room;echoL[k]+=l*v.delay;echoR[k]+=r*v.delay;
        }
      }
      active=active.filter(v=>v.end>end);
      for(let k=0;k<BAR;k++) {
        const sample=start+k,time=sample/SR;
        if(cutSamples.has(sample)) clearRoom();
        dl+=.25*(delayL[diL]-dl);dr+=.25*(delayR[diR]-dr);
        delayL[diL]=echoL[k]+dr*.20;delayR[diR]=echoR[k]+dl*.20;
        diL=(diL+1)%delayL.length;diR=(diR+1)%delayR.length;
        let wetL=0,wetR=0;
        for(const c of combs) {
          const l=c.l[c.il],r=c.r[c.ir];c.ll+=.22*(l-c.ll);c.lr+=.22*(r-c.lr);
          c.l[c.il]=sendL[k]+c.ll*c.feedback;c.r[c.ir]=sendR[k]+c.lr*c.feedback;
          c.il=(c.il+1)%c.l.length;c.ir=(c.ir+1)%c.r.length;wetL+=l*.25;wetR+=r*.25;
        }
        // Natural panned instruments + unequal room returns. No Haas master trick or EDM pumping.
        const l=dryL[k]+wetL*.60+dl*.48,r=dryR[k]+wetR*.60+dr*.48;
        dcL=l-prevL+.9992*dcL;dcR=r-prevR+.9992*dcR;prevL=l;prevR=r;
        let level=smooth(time/.012)*(1-smooth((time-178.8)/1.2));
        if(time>=103.117 && time<103.125) level*=1-smooth((time-103.117)/.008);
        if(time>=103.125 && time<103.59375) level=0;
        if(time>=103.59375 && time<103.60175) level*=smooth((time-103.59375)/.008);
        if(time>=108.738 && time<108.75) level*=1-.94*smooth((time-108.738)/.012);
        if(time>=123.738 && time<123.75) level*=1-smooth((time-123.738)/.012);
        const outL=dcL*level,outR=dcR*level;peak=Math.max(peak,Math.abs(outL),Math.abs(outR));
        pcm.writeFloatLE(outL,k*8);pcm.writeFloatLE(outR,k*8+4);
      }
      writeSync(fd,pcm);
      if(CHAPTERS.some(c=>c.end*SR===end)) console.log(`Synthesized through ${round(end/SR)}s (${block+1}/96 bars).`);
    }
  } finally { closeSync(fd); }
  assert(onsets===score.events.length,`Rendered ${onsets}/${score.events.length} event onsets.`);
  assert(sectionOnsets.every(s=>s.firstDrySample!==null && s.firstDrySample-s.scheduledSample<=2),'Missing chapter downbeat in rendered source.');
  return { frames:FRAMES,blockFrames:BAR,stereoBusCount:3,pcmBlockBytes:pcm.length,peakVoices,
    allocatedMixBufferBytes:BAR*6*4+pcm.length,peakBeforeMastering:round(peak),renderedEvents:onsets,maxFirstNonzeroOffsetSamples:maxOnsetError,
    chapterOnsets:sectionOnsets,method:'Actual per-voice DSP first-nonzero detection before mix, plus delivered-MP3 chapter energy verification; not isolated onset recovery from the final mixed signal.' };
}

function run(exe,args) {
  const r=spawnSync(exe,args,{ encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024 });
  assert(!r.error && r.status===0,`${r.error?.message??`Exit ${r.status}`}: ${String(r.stderr).slice(-3000)}`); return r;
}
export function getTools() {
  const ffmpeg=execFileSync('python',['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8',windowsHide:true}).trim();
  const ffprobe=require('ffprobe-static').path;
  assert(existsSync(ffmpeg)&&existsSync(ffprobe),'Installed FFmpeg/ffprobe missing.');return { ffmpeg,ffprobe };
}
const ff=(tools,args)=>run(tools.ffmpeg,['-hide_banner','-nostdin','-v','error','-y',...args]);
function probe(tools,path) { return JSON.parse(run(tools.ffprobe,['-v','error','-show_streams','-show_format','-of','json',path]).stdout); }
function loudness(tools,path) {
  // Measurement only: never accept loudnorm's dynamic-normalization fallback as mastering.
  const r=run(tools.ffmpeg,['-hide_banner','-nostdin','-i',path,'-af','loudnorm=I=-12.2:TP=-2.3:LRA=12:print_format=json','-f','null','-']);
  const match=r.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);assert(match,'R128 / oversampled true-peak measurement absent.');
  const m=JSON.parse(match[0]);
  assert(Number.isFinite(Number(m.input_i))&&Number.isFinite(Number(m.input_tp)),'Invalid loudness measurement.');
  return { LUFS:Number(m.input_i),truePeakDbTP:Number(m.input_tp),loudnessRangeLU:Number(m.input_lra) };
}
function normalize(tools,source,dest,inputLUFS,target,ceiling) {
  const gain=target-inputLUFS,limit=10**(ceiling/20);
  ff(tools,['-i',source,'-af',`aresample=${SR*4},volume=${gain}dB,alimiter=limit=${limit}:attack=3:release=80:level=false:latency=true,aresample=${SR},apad=whole_len=${FRAMES},atrim=end_sample=${FRAMES}`,
    '-ar',String(SR),'-ac','2','-c:a','pcm_s24le',dest]);
  return round(gain);
}

const accumulator=()=>({ frames:0,sumL:0,sumR:0,cross:0,side:0,peak:0,clipping:0,nonfinite:0 });
function accumulate(a,l,r) {
  a.frames++;a.sumL+=l*l;a.sumR+=r*r;a.cross+=l*r;a.side+=(l-r)**2;
  a.peak=Math.max(a.peak,Math.abs(l),Math.abs(r));
  if(Math.abs(l)>=1) a.clipping++;if(Math.abs(r)>=1) a.clipping++;
  if(!Number.isFinite(l)||!Number.isFinite(r)) a.nonfinite++;
}
function metrics(a) {
  assert(a.frames>0,'Empty analysis interval.');
  return { rmsDbFS:round(db(Math.sqrt((a.sumL+a.sumR)/(2*a.frames)))),leftRmsDbFS:round(db(Math.sqrt(a.sumL/a.frames))),rightRmsDbFS:round(db(Math.sqrt(a.sumR/a.frames))),
    peakDbFS:round(db(a.peak)),clipping:a.clipping,nonfinite:a.nonfinite,
    correlation:round(a.cross/Math.max(1e-25,Math.sqrt(a.sumL*a.sumR))),sideRmsDbFS:round(db(Math.sqrt(a.side/a.frames)/2)) };
}

export async function scanPCM(tools,path) {
  // Pipe decoding is consumed incrementally. Never capture 69 MB of PCM in spawnSync stdout.
  const child=spawn(tools.ffmpeg,['-hide_banner','-nostdin','-v','error','-xerror','-i',path,'-map','0:a:0','-f','f32le','-c:a','pcm_f32le','-'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stderr='',failure;
  child.stderr.on('data',b=>{ stderr=(stderr+b.toString()).slice(-4000); });
  const done=new Promise(resolveDone=>{ child.on('error',e=>{failure=e;resolveDone(-1);});child.on('close',resolveDone); });
  const total=accumulator(),scenes=CHAPTERS.map(()=>accumulator()),openings=CHAPTERS.map(()=>accumulator());
  const windows=[
    {id:'holdCore',start:103.17,end:103.55}, {id:'holdResume',start:103.59375,end:103.79375},
    {id:'dropBefore',start:108.732,end:108.75}, {id:'dropAfter',start:108.75,end:108.91},
    {id:'opening',start:0,end:.25}, {id:'fadeStart',start:178.8,end:178.9}, {id:'fadeTail',start:179.995,end:180},
  ].map(w=>({...w,a:Math.round(w.start*SR),b:Math.round(w.end*SR),data:accumulator()}));
  let frame=0,section=0,rest=Buffer.alloc(0),bin=accumulator(),quietStart=null;
  const quietRuns=[];
  function finishBin(end) {
    const quiet=metrics(bin).rmsDbFS < -58;
    if(quiet && quietStart===null) quietStart=end-bin.frames;
    if(!quiet && quietStart!==null) {
      if(end-bin.frames-quietStart>=SR*.10) quietRuns.push({ start:quietStart/SR,end:(end-bin.frames)/SR });
      quietStart=null;
    }
    bin=accumulator();
  }
  try {
    for await(const chunk of child.stdout) {
      const buffer=rest.length?Buffer.concat([rest,chunk]):chunk,len=buffer.length-buffer.length%8;
      for(let i=0;i<len;i+=8,frame++) {
        const l=buffer.readFloatLE(i),r=buffer.readFloatLE(i+4);
        while(section<12 && frame>=CHAPTERS[section].end*SR) section++;
        accumulate(total,l,r);accumulate(scenes[section],l,r);accumulate(bin,l,r);
        if(frame<CHAPTERS[section].start*SR+SR*.16) accumulate(openings[section],l,r);
        for(const w of windows) if(frame>=w.a && frame<w.b) accumulate(w.data,l,r);
        if(bin.frames===480) finishBin(frame+1);
      }
      rest=Buffer.from(buffer.subarray(len));
    }
  } catch(error) { child.kill();await done;throw error; }
  const status=await done;assert(!failure&&status===0,`Decode failed: ${failure?.message??stderr}`);
  assert(rest.length===0 && frame===FRAMES,`Decoded ${frame} frames / ${frame/SR}s, expected ${FRAMES}/180s.`);
  if(bin.frames) finishBin(frame);
  if(quietStart!==null && frame-quietStart>=SR*.1) quietRuns.push({start:quietStart/SR,end:frame/SR});
  return { decodedFrames:frame,decodedDuration:frame/SR,...metrics(total),
    sceneEnergy:scenes.map((s,i)=>({id:CHAPTERS[i].id,start:CHAPTERS[i].start,end:CHAPTERS[i].end,...metrics(s),opening160msRmsDbFS:metrics(openings[i]).rmsDbFS})),
    windows:Object.fromEntries(windows.map(w=>[w.id,metrics(w.data)])),quietRuns };
}

export async function verify(tools,report,directory=AUDIO_DIR) {
  contract(); const score=buildScore();
  assert(report.title===TITLE && report.duration===180 && report.bpm===128 && report.noVoice===true && report.music.original===true,'Score identity contract failed.');
  assert(report.storysha256===sha(STORY),'Story changed: recompose against the new script.');
  assert(report.generatorSha256===sha(SELF),'Generator changed: regenerate the audio.');
  assert(report.music.eventSha256===score.eventSha256 && JSON.stringify(report.music.sections)===JSON.stringify(score.sections),'Arrangement/provenance mismatch.');
  assert(JSON.stringify(report.music.bars)===JSON.stringify(score.bars) && JSON.stringify(report.music.cues)===JSON.stringify(CUES),'Stale cue/bar metadata.');
  assert(report.processing.masterBitReduction===false && report.processing.externalSamples===false && report.processing.TTS===false && report.processing.adaptiveLoudnessGain===false,'Instrumental clean-master contract failed.');
  const mp3=join(directory,'master.mp3');assert(report.mastersha256===sha(mp3),'MP3 hash mismatch.');
  const info=probe(tools,mp3),stream=info.streams[0],padding=Number(info.format.duration)-DURATION;
  assert(info.streams.length===1&&stream.codec_name==='mp3'&&stream.channels===2&&Number(stream.sample_rate)===SR&&Number(stream.bit_rate)===256000,'Requires stereo 48kHz 256kbps MP3, one audio stream.');
  assert(padding>=0&&padding<.04,`Container padding ${padding}s exceeds limit.`);
  const tags=info.format.tags;
  assert(tags.title===TITLE&&tags.comment===COMMENT&&tags.story_sha256===report.storysha256&&tags.generator_sha256===report.generatorSha256&&tags.no_voice==='true','MP3 provenance tags mismatch.');
  const scan=await scanPCM(tools,mp3),measure=loudness(tools,mp3);
  assert(measure.LUFS>=-13&&measure.LUFS<=-11.5&&measure.truePeakDbTP<=-1.5,`Master ${measure.LUFS} LUFS / ${measure.truePeakDbTP} dBTP outside limits.`);
  assert(scan.clipping===0&&scan.nonfinite===0,'Clipping/nonfinite PCM.');
  assert(scan.correlation>-.05&&scan.correlation<.985&&scan.sideRmsDbFS>-35&&Math.abs(scan.leftRmsDbFS-scan.rightRmsDbFS)<4,
    `Stereo check: correlation=${scan.correlation}, side=${scan.sideRmsDbFS}, L/R=${scan.leftRmsDbFS}/${scan.rightRmsDbFS}.`);
  for(const s of scan.sceneEnergy) assert(s.rmsDbFS>-42&&s.leftRmsDbFS>-46&&s.rightRmsDbFS>-46&&s.opening160msRmsDbFS>-48,`Empty/inaudible act ${s.id}: ${JSON.stringify(s)}`);
  const energies=scan.sceneEnergy.map(s=>s.rmsDbFS),contrast=Math.max(...energies)-Math.min(...energies);
  const escape=scan.sceneEnergy.find(s=>s.id==='escape'),plan=scan.sceneEnergy.find(s=>s.id==='plan');
  assert(contrast>=5,`Only ${contrast} dB scene contrast.`);
  assert(escape.rmsDbFS>=Math.max(...energies)-.1&&escape.rmsDbFS-plan.rmsDbFS>=5,`Escape must be largest: ${escape.rmsDbFS}; previous=${plan.rmsDbFS}; maximum=${Math.max(...energies)}.`);
  assert(scan.windows.holdCore.rmsDbFS<-65&&scan.windows.holdResume.rmsDbFS>-42,`Hold/resume ${scan.windows.holdCore.rmsDbFS}/${scan.windows.holdResume.rmsDbFS}.`);
  assert(scan.windows.dropAfter.rmsDbFS-scan.windows.dropBefore.rmsDbFS>3,'Escape entrance lost contrast.');
  assert(scan.windows.fadeTail.rmsDbFS<-70&&scan.windows.fadeStart.rmsDbFS-scan.windows.fadeTail.rmsDbFS>35,`Fade tail ${scan.windows.fadeTail.rmsDbFS} dBFS.`);
  assert(scan.quietRuns.every(q=>(q.start>=103.11&&q.end<=103.62)||q.start>=178.8),`Unintended silence: ${JSON.stringify(scan.quietRuns)}`);
  return { ...scan,...measure,sampleRate:SR,channels:2,bitrate:256000,metadataDuration:Number(info.format.duration),metadataPaddingSeconds:round(padding),
    quietLoudContrastDb:round(contrast),escapeOverPlanDb:round(escape.rmsDbFS-plan.rmsDbFS),dropRiseDb:round(scan.windows.dropAfter.rmsDbFS-scan.windows.dropBefore.rmsDbFS),
    eventGrid:{samplesPerBeat:SPB,samplesPerBar:BAR,subdivision:'sixteenth',samplesPerSixteenth:SPB/4,totalEvents:score.events.length,bars:score.bars.length,offGridEvents:0,chapterMarkers:13},
    silenceThresholdDbFS:-58,minimumReportedSilenceSeconds:.10 };
}

function publish(work,names) {
  const committed=[],backups=[];
  try {
    for(const name of names) {
      const dest=join(AUDIO_DIR,name),backup=join(work,`previous-${name}`);
      if(existsSync(dest)) { renameSync(dest,backup);backups.push({dest,backup}); }
      renameSync(join(work,name),dest);committed.push(dest);
    }
  } catch(error) {
    for(const dest of committed.reverse()) rmSync(dest,{force:true});
    for(const {dest,backup} of backups.reverse()) renameSync(backup,dest);
    throw error;
  }
}
function summary(report) {
  return { passed:report.validation.passed,files:['master.mp3','report.json','master.wav'].map(n=>join(AUDIO_DIR,n)),
    duration:report.master.decodedDuration,decodedFrames:report.master.decodedFrames,LUFS:report.master.LUFS,truePeakDbTP:report.master.truePeakDbTP,
    clipping:report.master.clipping,stereoCorrelation:report.master.correlation,sideRmsDbFS:report.master.sideRmsDbFS,
    metadataPaddingSeconds:report.master.metadataPaddingSeconds,quietLoudContrastDb:report.master.quietLoudContrastDb,escapeOverPlanDb:report.master.escapeOverPlanDb,
    events:report.master.eventGrid.totalEvents,chapterRmsDbFS:report.master.sceneEnergy.map(s=>({id:s.id,rms:s.rmsDbFS})),
    verifyCommand:`node "${SELF}" --verify` };
}

export async function main() {
  contract(); const tools=getTools();
  if(process.argv.includes('--verify')) {
    const report=JSON.parse(readFileSync(join(AUDIO_DIR,'report.json'),'utf8'));
    const current=await verify(tools,report);
    assert(report.validation.passed===true&&JSON.stringify(report.master)===JSON.stringify(current),'Published measurements stale.');
    if(report.archiveSha256) assert(report.archiveSha256===sha(join(AUDIO_DIR,'master.wav')),'Archive integrity mismatch.');
    console.log(JSON.stringify(summary(report),null,2));return report;
  }
  mkdirSync(AUDIO_DIR,{recursive:true});
  const storyHash=sha(STORY),generatorHash=sha(SELF),work=mkdtempSync(join(AUDIO_DIR,'.stage-'));
  try {
    const score=buildScore(),render=renderScore(join(work,'premaster.wav'),score);
    ff(tools,['-i',join(work,'premaster.wav'),'-af','highpass=f=27,lowpass=f=16500','-c:a','pcm_f32le',join(work,'prepared.wav')]);
    const sourceMeasure=loudness(tools,join(work,'prepared.wav'));
    let target=-12.15,ceiling=-2.3,fixedGain,encoded;
    for(let attempt=0;attempt<4;attempt++) {
      fixedGain=normalize(tools,join(work,'prepared.wav'),join(work,'master.wav'),sourceMeasure.LUFS,target,ceiling);
      ff(tools,['-i',join(work,'master.wav'),'-map_metadata','-1','-c:a','libmp3lame','-b:a','256k','-ar',String(SR),'-ac','2','-write_xing','1','-id3v2_version','3',
        '-metadata',`title=${TITLE}`,'-metadata',`comment=${COMMENT}`,'-metadata',`story_sha256=${storyHash}`,'-metadata',`generator_sha256=${generatorHash}`,
        '-metadata','no_voice=true','-metadata','bpm=128',join(work,'master.mp3')]);
      encoded=loudness(tools,join(work,'master.mp3'));
      console.log(`Master attempt ${attempt+1}: ${encoded.LUFS} LUFS / ${encoded.truePeakDbTP} dBTP.`);
      if(encoded.LUFS>=-13&&encoded.LUFS<=-11.5&&encoded.truePeakDbTP<=-1.5&&Math.abs(encoded.LUFS+12.2)<.18) break;
      target+=clamp(-12.2-encoded.LUFS,-1.5,1.5);if(encoded.truePeakDbTP>-1.5) ceiling-=encoded.truePeakDbTP+1.8;
    }
    const report={ title:TITLE,film:FILM_TITLE,duration:DURATION,bpm:BPM,beats:TOTAL_BEATS,bars:96,noVoice:true,sampleRate:SR,
      storysha256:storyHash,generatorSha256:generatorHash,mastersha256:sha(join(work,'master.mp3')),archiveSha256:sha(join(work,'master.wav')),
      music:{ original:true,noVoice:true,seed:SEED,theme:{key:'D minor',lengthBars:8,notes:THEME,lead:'37.5%-duty polyBLEP pulse + sinusoidal whistle, gentle pitch slides; no voice model'},
        sections:score.sections,bars:score.bars,cues:CUES,eventSha256:score.eventSha256,eventCount:score.events.length,render,
        synthesis:'Original deterministic per-note DSP: fractional-delay Karplus–Strong, additive piano/triangle bass, bandlimited pulse/saw, FM reed, filtered-noise acoustic percussion; never a recording or sampled instrument.',
        masterBitReduction:false,narrationDucking:false },
      processing:{externalSamples:false,TTS:false,masterBitReduction:false,adaptiveLoudnessGain:false,drumSidechain:false,
        targetLUFS:-12.2,allowedLUFS:[-13,-11.5],encodedPeakLimitDbTP:-1.5,normalizationTarget:round(target),preEncodeCeiling:round(ceiling),fixedGainDb:fixedGain,sourceMeasure,
        signalChain:'Float32 bar-streamed mix -> 27Hz highpass / 16.5kHz lowpass -> R128-measured fixed gain -> stereo-linked 192kHz lookahead limiter with compensated latency -> 48kHz 24-bit PCM -> gapless 256kbps MP3',
        limiter:{oversampling:4,attackMs:3,releaseMs:80,latencyCompensated:true},fade:{start:178.8,end:180}},
      delivery:{file:'master.mp3',relativeURL:'audio/master.mp3',playback:'Native HTMLAudioElement with file:// relative URL; no fetch, WebAudio or server required.',archive:'master.wav'},
      provenance:{createdAt:new Date().toISOString(),noVoice:'All sound sources are whitelisted mathematical instrument generators. No speech synthesis, external audio, game soundtrack or melody transcription.'} };
    report.master=await verify(tools,report,work);
    report.validation={passed:true,checkedAt:new Date().toISOString(),stagedBeforePublication:true,
      checks:['full gapless PCM decode','exact 8,640,000 stereo frames','EBU R128 integrated LUFS','oversampled true peak','codec/rate/channels/bitrate/padding','clipping and nonfinite scan','stereo energy and correlation','13 nonempty acts','13 different event/rhythm identities','fixed beat/bar grid','quiet/loud contrast >=5dB','escape largest act','one-beat silence and resume','no unintended silent stretches','terminal fade','story/generator/MP3 hashes'],
      scope:'Local DSP/decoded-signal verification; no claim of human listening or browser playback testing.'};
    assert(storyHash===sha(STORY)&&generatorHash===sha(SELF),'Story/generator changed during synthesis; refusing stale publication.');
    json(join(work,'report.json'),report);publish(work,['master.wav','master.mp3','report.json']);
    console.log(JSON.stringify(summary(report),null,2));return report;
  } finally { rmSync(work,{recursive:true,force:true}); }
}
if(process.argv[1]&&resolve(process.argv[1])===SELF) main().catch(error=>{ console.error(error.stack);process.exitCode=1; });