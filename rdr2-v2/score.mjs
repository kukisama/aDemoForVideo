/** 明天以西 — original, breath-led chip-Western score. No borrowed tune or samples.
 * node <absolute path>/rdr2-v2/score.mjs [--verify]
 * Only writes ./audio/. 180 decoded seconds, 80 BPM; phrases need not sit on a grid.
 * No speech/TTS/network. Measurement-only R128, fixed gain, linked 4x peak limiter.
 */
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, openSync, writeSync, closeSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TITLE as FILM, DURATION, BPM, BEAT, TOTAL_BEATS, CHAPTERS, CUES, SHOTS } from './story.mjs';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const SELF = fileURLToPath(import.meta.url), STORY = fileURLToPath(new URL('./story.mjs', import.meta.url));
export const AUDIO_DIR = fileURLToPath(new URL('./audio/', import.meta.url));
export const TITLE = 'Before Tomorrow / 明天以西·风里的承诺';
export const SR = 48000, FRAMES = 8640000, SPB = 36000, BAR = 144000;
export const SEED = 0x57455332;
const TAU = 2 * Math.PI;
const COMMENT = 'Original synthesized instrumental; no voice, samples, TTS or game melody. 80 BPM. Human listening not performed.';
const check = (ok, message) => { if (!ok) throw new Error(message); };
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const db = x => 20 * Math.log10(Math.max(1e-12, x));
const round = x => Math.round(x * 1e6) / 1e6;
const digest = data => createHash('sha256').update(data).digest('hex');
export const sha = path => digest(readFileSync(path));
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const rng = seed => { let s = seed >>> 0; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; };
export const PITCHED = new Set(['whistle', 'pluck', 'bass', 'chip']);
export const PALETTE = new Set([...PITCHED, 'wind', 'hoof', 'paper', 'wheel', 'water', 'step']);

// Newly composed melodic cell. Sparse asymmetric breathing, NOT the old eight-bar theme.
export const THEME = [76, 71, 74, 79, 78]; // E5 — B4 — D5 | G5 — F#5 (open ninth).
export const WHISTLE = Object.freeze({ fundamental: 1, second: .042, third: .009,
  attackSeconds: .135, releaseSeconds: .30, tonalDelaySeconds: .018,
  driftCents: 4.1, vibratoCents: 5.8, breathLevel: .055, pulseComponent: 0 });

// These are arrangement rests, NOT digital silence: ambient sound and finite room tails remain.
export const SPACES = [
  { id: 'first-horizon', start: 0, end: 6.8, intent: '开头只有风；不以低音/和弦偷偷铺满。' },
  { id: 'before-trust', start: 14.5, end: 21, intent: '马蹄进入远景，旋律让出地平线。' },
  { id: 'wheel-released', start: 75.5, end: 79.35, intent: '推车松动后不做鼓花，只留下地面与余音。' },
  { id: 'hand-not-taken', start: 104, end: 114, intent: '106秒无人接图：不新增音符，不做紧张上升音。' },
  { id: 'before-third-plan', start: 140.5, end: 147, intent: '救人动作之后收回，不持续扩编。' },
  { id: 'no-musical-answer', start: 150.6, end: 168, intent: '第三次plan的问句结束；155秒对白下无旋律回答，161秒只有折纸与风。' },
];
export const SECTIONS = [
  { id: 'dust', harmony: 'E minor, no harmonic bed', strategy: '风先到，7.15秒才有三枚相隔的哨音；数字拨弦和低音均缺席。', soundscape: '宽而轻的两路带限风；12秒双蹄声逐渐远去。' },
  { id: 'promise', harmony: 'Em(add9) / Cmaj7 / Am / G6, isolated tones', strategy: '23秒完整动机；34秒温暖E音回答。单根干弦与长间隔三角低音提供信任，不铺持续和弦。', soundscape: '营地低风；39秒接纸，纸声不替代打击乐。' },
  { id: 'burden', harmony: 'E / A / C / B open bass', strategy: '脚步式双拍轻脉冲；旋律分成工作之间的小口气，66秒加重脚步而非提速。75秒放下脉冲。', soundscape: '59秒木轮卡住与轻吱声；地面脚步，非舞曲踢鼓。' },
  { id: 'fraying', harmony: 'E / C / B with unclosed F#', strategy: '同一动机拆散，只保留五个哨音；低音与拨弦递减，省略温暖回答，104秒起停下。', soundscape: '风略冷；93秒图纸轻动，106秒以没有新声源回应。' },
  { id: 'choice', harmony: 'E / D / A / B, no major cadence', strategy: '130–137秒才短暂加入双根数字弦与一条极低脉冲音色；137秒撤下，140.5秒全留白。', soundscape: '114秒流水；130秒涉水，137秒细小水滴，不用镲片宣告胜利。' },
  { id: 'silence', harmony: 'E — B — F# question; no accompaniment', strategy: '147秒只吹三枚短音，末音上悬；150.6–168秒完全不新增乐音，155秒字幕不配安慰性回答。', soundscape: '低风；161秒折纸，留住动作本身。' },
  { id: 'coda', harmony: 'E / B, final F# over no chord', strategy: '168秒孤独主题回来；前奏的一呼一吸加一枚F#，无三度终止、无满编制。178.5秒统一退入风。', soundscape: '黎明的风不变成亮堂的胜利垫底；最后1.5秒自然淡出。' },
];

export function contract() {
  check(DURATION === 180 && BPM === 80 && BEAT === .75 && TOTAL_BEATS === 240, 'Requires 180s / 80 BPM / 240 beats.');
  const ids = ['dust', 'promise', 'burden', 'fraying', 'choice', 'silence', 'coda'];
  const boundaries = [0, 21, 51, 84, 114, 144, 168, 180];
  check(CHAPTERS.length === 7 && CHAPTERS.every((c, i) => c.id === ids[i] && c.start === boundaries[i] && c.end === boundaries[i + 1] && c.bars === (c.end - c.start) / 3), 'Seven-chapter contract changed.');
  const markers = [['wind',0],['hoof',12],['plan-one',23],['paper-accept',39],['wheel',59],['effort',66],['release',75],['plan-two',87],['unanswered',106],['river',114],['turn-back',130],['hand',137],['plan-three',147],['paper-fold',161],['lone-theme',168],['fade',178.5]];
  check(JSON.stringify(CUES.map(c => [c.id, c.time])) === JSON.stringify(markers), 'Story CUES changed.');
  const starts = [0,6,12,21,30,37,43,51,59,66,75,84,93,100,106,114,122,129,137,144,153,161,168,174];
  const actions = ['arrival','listen','ride','plan-one','trust','accept','together','convoy','stuck','push','release','plan-two','offer','doubt','not-taking','water','go-ahead','turn-back','help','plan-three','answer','fold-map','leave','coda'];
  check(SHOTS.length === 24 && SHOTS.every((s, i) => s.start === starts[i] && s.end === (starts[i + 1] ?? 180) && s.action === actions[i]), '24-shot timing/actions changed.');
  check(SPB === BEAT * SR && BAR === SPB * 4 && FRAMES === SR * DURATION, 'Sample clock mismatch.');
  return true;
}

export function buildScore() {
  contract();
  const events = [];
  const add = (kind, time, midi, gate, gain, pan = 0, extra = {}) => {
    check(PALETTE.has(kind), `Unknown source ${kind}.`);
    const sample = Math.round(time * SR), section = CHAPTERS.findIndex(c => time >= c.start && time < c.end);
    const release = kind === 'whistle' ? WHISTLE.releaseSeconds : kind === 'bass' ? .16 : kind === 'chip' ? .08 : 0;
    const duration = Math.min(gate + release, DURATION - time);
    const e = { id: `e${String(events.length).padStart(3, '0')}`, kind, time, beat: round(time / BEAT), sample, midi, gate, duration, gain, pan, section, ...extra };
    check(section >= 0 && duration > 0 && gain > 0, 'Invalid authored event.');
    events.push(e); return e;
  };
  const w = (time, midi, gate, gain = .34, extra = {}) => add('whistle', time, midi, gate, gain, -.055, extra);
  const p = (time, midi, gain = .16, duration = .86, pan = -.46) => add('pluck', time, midi, duration, gain, pan);
  const b = (time, midi, gain = .105, duration = 1.75) => add('bass', time, midi, duration, gain);
  const phrase = (rows, label) => rows.forEach(([t, m, d, g]) => w(t, m, d, g, { phrase: label }));

  // All soundscapes are generated from seeded noise and oscillator resonances.
  add('wind', 0, 0, 180, .061, -.80, { lane: 0, cue: 'wind' });
  add('wind', 0, 0, 180, .058, .83, { lane: 1 });
  phrase([[7.15,76,1.58,.26],[9.64,71,.76,.245],[11.22,74,1.02,.24]], 'first-fragment');
  [12,12.22,13.50,13.74,15.10,15.34,16.86,17.12].forEach((t, i) => add('hoof',t,0,.14,.093*(1-i*.073),-.50+i*.12,{ cue: i === 0 ? 'hoof' : undefined }));

  b(21,40,.105,2.3); p(21.55,59,.14); p(27.42,64,.135,.82,.46);
  phrase([[23,76,1.91,.36],[25.62,71,.61,.32],[26.61,74,.98,.34],[28.94,79,1.28,.35],[30.61,78,1.15,.32]], 'promise-call');
  b(30.08,36,.10,2.0); p(33.11,67,.128,.84,-.39);
  phrase([[34.05,71,.97,.33],[35.52,74,.90,.34],[36.84,76,2.16,.36]], 'trust-answer');
  b(38.8,33,.09,1.9); add('paper',39,0,.72,.064,.34,{ cue: 'paper-accept' });
  p(40.2,60,.13,.9,.42); b(44.6,43,.095,1.8); p(46.74,62,.12);
  phrase([[42.12,79,1.22,.34],[43.88,78,.82,.32],[45.10,76,1.80,.34],[48.18,71,1.08,.29]], 'shared-horizon');

  b(51,40,.105,1.3); p(51.49,59,.14);
  phrase([[54.35,76,1.30,.33],[56.29,71,.61,.31],[57.46,74,.91,.32]], 'work-call');
  for (let i=0;i<15;i++) {
    const t = 52.4 + i*1.5 + [0,.043,-.016,.027][i%4];
    add('step',t,0,.24,i<9?.060:.075,i%2? .19 : -.22);
  }
  b(56.8,33,.10,1.35); p(58.02,64,.13,.72,.42);
  add('wheel',59,0,2.8,.081,-.33,{ cue: 'wheel' });
  phrase([[63.28,74,1.08,.31],[64.89,71,.70,.29]], 'stuck-answer');
  add('step',66,0,.29,.084,-.13,{ cue: 'effort' }); b(66,40,.123,1.55); p(66.19,59,.15);
  b(69.1,36,.10,1.4); p(70.26,60,.125,.76,.43);
  phrase([[69.24,76,1.28,.34],[71.39,79,.72,.33],[72.64,78,1.12,.31]], 'carrying');
  b(72.45,35,.08,1.30);
  add('wheel',75,0,.44,.041,.35,{ released: true, cue: 'release' });
  phrase([[79.45,74,1.21,.30],[81.51,71,.76,.27]], 'not-a-victory');

  b(84.18,40,.075,1.5); p(84.46,59,.097);
  phrase([[87,76,1.47,.31],[89.17,71,.70,.285],[92.72,74,1.01,.27],[97.86,79,.68,.26],[100.13,78,.68,.25]], 'frayed-call-without-answer');
  add('paper',93,0,.55,.037,.37); p(93.68,60,.084,.62,.41); b(94.44,36,.065,1.1);
  p(98.98,59,.061,.57); // no ostinato to fill the missing answer

  add('water',114,0,29.7,.063,.69,{ cue: 'river' });
  add('water',114,0,29.7,.056,-.71,{ lane: 1 });
  b(114.12,40,.09,1.70); p(114.39,59,.126);
  phrase([[117.35,76,.98,.32],[119.21,74,1.17,.31],[124.24,71,1.72,.30]], 'crossing-distance');
  p(122.61,62,.112,.8,.44); b(123.10,38,.09,1.55);
  // Only seven seconds of widening, not a 30-second heroic climax.
  phrase([[130,76,1.43,.405],[131.77,79,.80,.385],[133.09,81,1.04,.39],[134.68,78,1.47,.36]], 'turn-back');
  b(130,33,.14,1.7); b(133.2,40,.135,1.75);
  for (const [t,m,pan] of [[130,64,-.52],[130.07,71,.52],[132.29,67,.47],[134.12,59,-.50],[135.64,64,.45]]) p(t,m,.19,.85,pan);
  [130,133].forEach(t => add('chip',t,47,.70,.047,.13));
  add('water',130,0,.65,.077,-.32,{ splash: true, cue: 'turn-back' });
  add('water',137,0,.49,.061,.35,{ splash: true, cue: 'hand' });
  p(137.08,71,.082,.70,.38); w(138.18,76,.84,.265,{ phrase: 'ensemble-withdraws' });

  phrase([[147,76,.77,.295],[148.16,71,.43,.26],[149.12,78,.69,.265]], 'third-plan-question');
  add('paper',161,0,.79,.063,-.18,{ fold: true, cue: 'paper-fold' });
  // Nothing pitched is added between 150.6 and 168, including under Arthur's reply.
  b(168,40,.063,1.35); p(168,64,.082,.66,-.39);
  phrase([[168,76,1.80,.31],[170.72,71,.70,.278],[172.07,74,1.10,.285],[175.12,78,1.73,.265]], 'lone-return');
  p(174.73,59,.065,.68,.35); // bare B, no third and no closing tonic chord

  events.sort((a,c) => a.sample-c.sample || a.id.localeCompare(c.id));
  for (const e of events) {
    check(e.sample >= 0 && e.sample + Math.round(e.duration*SR) <= FRAMES, `Event bounds ${e.id}.`);
    if (PITCHED.has(e.kind)) for (const gap of SPACES) check(e.time >= gap.end || e.time + e.duration <= gap.start, `Music overlaps rest ${gap.id}: ${e.id}.`);
  }
  const sections = SECTIONS.map((s,i) => {
    const c = CHAPTERS[i], selected = events.filter(e => e.section === i && e.kind !== 'wind');
    const counts = {};
    for (const e of selected) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
    return { ...s,start:c.start,end:c.end,bars:c.bars,startBeat:c.start/BEAT,startSample:c.start*SR,
      eventCounts:counts,whistleNotes:counts.whistle??0,signature:digest(JSON.stringify(selected)).slice(0,16) };
  });
  const cueNotes = {
    wind:'0秒起只有风；到7.15秒才出现主旋律。', hoof:'双蹄间距220ms，非循环马蹄节拍。',
    'plan-one':'23秒E5开句，五音动机；34.05秒开始可信任的回答。', 'paper-accept':'39秒纸张摩擦声，旋律已收口。',
    wheel:'59秒木轮轻撞/吱响，音景而非音乐重击。', effort:'66秒脚步落地与低音；不改变80BPM。',
    release:'75秒木轮轻松动，停止脚步；75.5–79.35秒无新乐音。', 'plan-two':'87秒同一开句，只有五音且更远离，省去回答。',
    unanswered:'106秒不加事件：104–114秒干音乐总线为零，只保留风和尾音。', river:'114秒宽幅流水淡入，不用噪声上升器。',
    'turn-back':'画面129秒转身；音乐延后至130秒字幕/决定落地，短暂扩编到137秒。', hand:'137秒微小水声，撤掉脉冲与较重低音。',
    'plan-three':'147秒E5、148.16秒B4、149.12秒F#5；150.6–168秒不回应。',
    'paper-fold':'161秒折纸是动作声，不是和声回答。', 'lone-theme':'168秒主题孤独返场；只有一枚低音和干弦，最终停F#。',
    fade:'178.5–180秒包括环境/尾音在内统一淡出，保持180秒解码长度。',
  };
  const cues = CUES.map(c => ({ ...c, sample:Math.round(c.time*SR), beat:round(c.time/BEAT),
    exactOnsets:events.filter(e=>e.sample===Math.round(c.time*SR)).map(e=>({id:e.id,kind:e.kind,midi:e.midi})), note:cueNotes[c.id] }));
  const shots = SHOTS.map((s,i) => ({ index:i+1,...s,startSample:Math.round(s.start*SR),endSample:Math.round(s.end*SR),
    cues:cues.filter(c=>c.time>=s.start&&c.time<s.end).map(c=>c.id),
    whistleOnsets:events.filter(e=>e.kind==='whistle'&&e.time>=s.start&&e.time<s.end).map(e=>e.time),
    restRanges:SPACES.filter(g=>g.start<s.end&&g.end>s.start).map(g=>[Math.max(s.start,g.start),Math.min(s.end,g.end)]) }));
  return {events,sections,cues,shots,eventSha256:digest(JSON.stringify(events))};
}

function envelope(t, gate, attack, release) {
  return smooth(t/attack)*(1-smooth((t-gate)/Math.max(.001,release)));
}
function blep(p,d) {
  if (p<d) { const x=p/d; return 2*x-x*x-1; }
  if (p>1-d) { const x=(p-1)/d; return x*x+2*x+1; }
  return 0;
}

// Public for independent isolated-timbre tests; identity derives from event ID, not sort order.
export function createVoice(e) {
  const index = Number(e.id?.replace(/\D/g,'') || 1);
  const random = rng(SEED ^ Math.imul(index+1,0x9e3779b1)), noise = () => random()*2-1;
  const phase0 = random()*TAU, driftPhase = random()*TAU;
  const f = hz(e.midi), release = Math.max(.004,e.duration-e.gate);
  let phase=0,lo=0,hi=0,slow=0;
  let render,room=0;
  switch(e.kind) {
    case 'whistle': {
      room=.57;
      const attackBend = -19-random()*15, vibratoRate=4.65+random()*.75;
      render=t=>{
        const drift=WHISTLE.driftCents*(.67*Math.sin(TAU*.63*t+phase0)+.33*Math.sin(TAU*1.39*t+driftPhase));
        const vibrato=WHISTLE.vibratoCents*Math.sin(TAU*vibratoRate*t+phase0)*smooth((t-.32)/.42);
        const bend=attackBend*(1-smooth(t/.19))-10*smooth((t-(e.gate-.18))/.44);
        phase+=TAU*f*2**((drift+vibrato+bend)/1200)/SR;
        const n=noise();lo+=.39*(n-lo);hi+=.115*(lo-hi);
        const breath=(lo-hi)*WHISTLE.breathLevel*(.13+Math.exp(-t*19))*smooth(t/.008)*(1-smooth((t-e.gate)/release));
        const air=1-.15*Math.sin(TAU*.47*t+phase0)**2;
        const mouth=envelope(t-WHISTLE.tonalDelaySeconds,e.gate-WHISTLE.tonalDelaySeconds,WHISTLE.attackSeconds,release)
          * (1-.38*smooth((t-(e.gate-.23))/.44))*air;
        return (Math.sin(phase)+WHISTLE.second*Math.sin(2*phase)+WHISTLE.third*Math.sin(3*phase))*mouth+breath;
      };
      break;
    }
    case 'pluck': {
      room=.19;
      // Discrete short Karplus line, with interpolation/filter-delay tuning compensation.
      const damping=.48, period=SR/f-damping/(1-damping), length=Math.ceil(period)+2;
      const line=new Float32Array(length);let cursor=0,last=0,mean=0;
      for(let i=0;i<length;i++) { lo+=.54*(noise()-lo);line[i]=lo;mean+=lo; }
      mean/=length;for(let i=0;i<length;i++) line[i]=(line[i]-mean)*1.4;
      const feedback=Math.exp(-Math.log(1000)/(f*.83));
      render=t=>{
        let read=cursor-period;if(read<0)read+=length;const a=Math.floor(read),q=read-a;
        const x=line[a]*(1-q)+line[(a+1)%length]*q;
        last=(1-damping)*x+damping*last;line[cursor]=last*feedback;cursor=(cursor+1)%length;
        const bridge=.16*Math.sin(TAU*f*t)*Math.exp(-t*7)+.027*Math.sin(TAU*f*2*t)*Math.exp(-t*18);
        return (x+bridge)*smooth(t/.0018)*(1-smooth((t-(e.duration-.10))/.10));
      };
      break;
    }
    case 'bass':
      room=.018;
      render=t=>{
        phase+=TAU*f/SR;
        const triangle=Math.sin(phase)-Math.sin(3*phase)/9+Math.sin(5*phase)/25-Math.sin(7*phase)/49;
        return (triangle*.62+Math.sin(phase/2)*.26)*envelope(t,e.gate,.028,release)*Math.exp(-t*.53);
      };
      break;
    case 'chip':
      room=.04;
      render=t=>{
        const d=f/SR;phase=(phase+d)%1;
        const pulse=(phase<.25?.75:-.25)+.5*blep(phase,d)-.5*blep((phase+.75)%1,d);
        lo+=.075*(pulse-lo);
        return lo*envelope(t,e.gate,.012,release)*Math.exp(-t*3.2);
      };
      break;
    case 'wind':
      render=t=>{
        const n=noise();lo+=.037*(n-lo);hi+=.0035*(lo-hi);slow+=.00065*(n-slow);
        const gust=.58+.21*Math.sin(TAU*.057*t+phase0)+.14*Math.sin(TAU*.137*t+driftPhase);
        const opening=1+.06*(1-smooth((t-5.8)/1));
        return ((lo-hi)*.83+slow*.28)*gust*opening*smooth(t/1.4);
      };
      break;
    case 'hoof': case 'step': {
      room=e.kind==='hoof'?.32:.11;
      const step=e.kind==='step';
      render=t=>{
        lo+=.095*(noise()-lo);
        const body=step?Math.sin(TAU*91*t)*Math.exp(-t*29)*.53:
          (Math.sin(TAU*610*t)+.43*Math.sin(TAU*987*t))*Math.exp(-t*72)*.53;
        return (body+lo*(step?.85:.48)*Math.exp(-t*(step?20:54)))*smooth(t/.0025)*(1-smooth((t-e.duration*.7)/(e.duration*.3)));
      };
      break;
    }
    case 'paper':
      room=.095;
      render=t=>{
        const n=noise();lo+=.48*(n-lo);hi+=.058*(lo-hi);
        const friction=.15+.85*Math.sin(TAU*(e.fold?5.6:7.9)*t+phase0)**4;
        return (lo-hi)*friction*Math.sin(Math.PI*clamp(t/e.duration))**1.2;
      };
      break;
    case 'wheel':
      room=.23;
      render=t=>{
        const n=noise();lo+=.11*(n-lo);
        phase+=TAU*(243+18*Math.sin(TAU*1.1*t)+6*Math.sin(TAU*7.2*t))/SR;
        const rub=Math.sin(phase)*.20*Math.sin(Math.PI*clamp(t/e.duration))**2;
        const knock=(Math.sin(TAU*177*t)*.46+lo*.41)*Math.exp(-t*32);
        return (rub*(e.released?.1:1)+knock)*smooth(t/.004)*(1-smooth((t-(e.duration-.14))/.14));
      };
      break;
    case 'water':
      room=.13;
      render=t=>{
        const n=noise();lo+=.28*(n-lo);hi+=.014*(lo-hi);
        const mod=.51+.21*Math.sin(TAU*2.13*t+phase0)+.16*Math.sin(TAU*3.37*t+driftPhase);
        const droplets=.033*Math.sin(TAU*(1410*t+120*t*t))*Math.sin(TAU*7.3*t)**14;
        const shape=e.splash?smooth(t/.011)*Math.exp(-t*6)*(1-smooth(t/e.duration)):
          smooth(t/.78)*(1-smooth((t-(e.duration-1.2))/1.2));
        return ((lo-hi)*mod+droplets)*shape;
      };
      break;
    default: throw new Error(`Unknown DSP ${e.kind}`);
  }
  return {...e,render,room,end:e.sample+Math.round(e.duration*SR),
    left:Math.cos((e.pan+1)*Math.PI/4)*e.gain,right:Math.sin((e.pan+1)*Math.PI/4)*e.gain,firstNonzero:null};
}

const acc=()=>({frames:0,l:0,r:0,cross:0,side:0,peak:0,clip:0,bad:0});
function take(a,l,r) {
  a.frames++;a.l+=l*l;a.r+=r*r;a.cross+=l*r;a.side+=(l-r)**2;a.peak=Math.max(a.peak,Math.abs(l),Math.abs(r));
  if(Math.abs(l)>=1)a.clip++;if(Math.abs(r)>=1)a.clip++;if(!Number.isFinite(l)||!Number.isFinite(r))a.bad++;
}
function metric(a) {
  check(a.frames>0,'Empty measurement interval.');
  return {rmsDbFS:round(db(Math.sqrt((a.l+a.r)/(2*a.frames)))),peakDbFS:round(db(a.peak)),
    leftRmsDbFS:round(db(Math.sqrt(a.l/a.frames))),rightRmsDbFS:round(db(Math.sqrt(a.r/a.frames))),
    correlation:round(a.cross/Math.max(1e-25,Math.sqrt(a.l*a.r))),sideRmsDbFS:round(db(Math.sqrt(a.side/a.frames)/2)),clipping:a.clip,nonfinite:a.bad};
}
function wavHeader(frames) {
  const b=Buffer.alloc(44),size=frames*8;b.write('RIFF');b.writeUInt32LE(size+36,4);b.write('WAVEfmt ',8);
  b.writeUInt32LE(16,16);b.writeUInt16LE(3,20);b.writeUInt16LE(2,22);b.writeUInt32LE(SR,24);b.writeUInt32LE(SR*8,28);
  b.writeUInt16LE(8,32);b.writeUInt16LE(32,34);b.write('data',36);b.writeUInt32LE(size,40);return b;
}

export function renderScore(path,score) {
  const dryL=new Float32Array(BAR),dryR=new Float32Array(BAR),musicL=new Float32Array(BAR),musicR=new Float32Array(BAR);
  const sendL=new Float32Array(BAR),sendR=new Float32Array(BAR),pcm=Buffer.alloc(BAR*8);
  // Finite, band-limited outdoor reflections. No pad, comb resonance, endless feedback or tempo delay.
  const times=[.117,.263,.431,.719,1.127,1.691,2.137],levels=[.24,.19,.145,.092,.053,.026,.011];
  const taps=times.map((t,i)=>({delay:Math.round(t*SR),gain:levels[i]}));
  const ringL=new Float32Array(taps.at(-1).delay+338),ringR=new Float32Array(ringL.length);
  let cursor=0,filterL=0,filterR=0,lowL=0,lowR=0,prevL=0,prevR=0,dcL=0,dcR=0,ei=0,active=[],onsets=0,maxOffset=0;
  const gapData=SPACES.map(g=>({...g,music:acc(),environment:acc(),room:acc()}));
  const voiceOnsets=[];let peak=0;
  const fd=openSync(path,'w');
  try {
    writeSync(fd,wavHeader(FRAMES));
    for(let block=0;block<60;block++) {
      const start=block*BAR,end=start+BAR;
      for(const a of [dryL,dryR,musicL,musicR,sendL,sendR])a.fill(0);
      while(ei<score.events.length&&score.events[ei].sample<end)active.push(createVoice(score.events[ei++]));
      for(const v of active) {
        const isMusic=PITCHED.has(v.kind);
        for(let s=Math.max(start,v.sample);s<Math.min(end,v.end);s++) {
          const x=v.render((s-v.sample)/SR),k=s-start;
          check(Number.isFinite(x),`Nonfinite ${v.kind} @ ${s}.`);
          if(v.firstNonzero===null&&Math.abs(x)>1e-12) {
            v.firstNonzero=s;onsets++;maxOffset=Math.max(maxOffset,s-v.sample);
            voiceOnsets.push({id:v.id,kind:v.kind,scheduledSample:v.sample,firstNonzeroSample:s});
          }
          const l=x*v.left,r=x*v.right;dryL[k]+=l;dryR[k]+=r;sendL[k]+=l*v.room;sendR[k]+=r*v.room;
          if(isMusic){musicL[k]+=l;musicR[k]+=r;}
        }
      }
      active=active.filter(v=>v.end>end);
      for(let k=0;k<BAR;k++) {
        const s=start+k,t=s/SR;
        filterL+=.31*(sendL[k]-filterL);filterR+=.31*(sendR[k]-filterR);
        lowL+=.028*(filterL-lowL);lowR+=.028*(filterR-lowR);
        ringL[cursor]=filterL-lowL;ringR[cursor]=filterR-lowR;
        let wetL=0,wetR=0;
        for(let i=0;i<taps.length;i++) {
          const tap=taps[i],a=(cursor-tap.delay+ringL.length)%ringL.length,b=(a-337+ringL.length)%ringL.length;
          wetL+=(i%2?ringR[a]:ringL[a])*tap.gain;wetR+=(i%2?ringL[b]:ringR[b])*tap.gain*(i%2?1.09:.91);
        }
        cursor=(cursor+1)%ringL.length;
        const l=dryL[k]+wetL,r=dryR[k]+wetR;
        dcL=l-prevL+.9993*dcL;dcR=r-prevR+.9993*dcR;prevL=l;prevR=r;
        const fade=1-smooth((t-178.5)/1.5),outL=dcL*fade,outR=dcR*fade;
        peak=Math.max(peak,Math.abs(outL),Math.abs(outR));pcm.writeFloatLE(outL,k*8);pcm.writeFloatLE(outR,k*8+4);
        for(const g of gapData)if(t>=g.start&&t<g.end){take(g.music,musicL[k],musicR[k]);take(g.environment,dryL[k]-musicL[k],dryR[k]-musicR[k]);take(g.room,wetL,wetR);}
      }
      writeSync(fd,pcm);
      if(CHAPTERS.some(c=>c.end*SR===end))console.log(`Rendered ${end/SR}/180s, ${block+1}/60 bars.`);
    }
  } finally {closeSync(fd);}
  check(onsets===score.events.length,`Rendered ${onsets}/${score.events.length} events.`);
  const measuredSpaces=gapData.map(g=>({id:g.id,start:g.start,end:g.end,music:metric(g.music),environment:metric(g.environment),room:metric(g.room)}));
  check(measuredSpaces.every(g=>g.music.peakDbFS===-240&&g.environment.rmsDbFS>-75),'Rest buses are not music-free / environment is absent.');
  return {frames:FRAMES,blockFrames:BAR,allocatedMixBytes:6*BAR*4+pcm.length+ringL.byteLength+ringR.byteLength,
    peakBeforeMasteringDbFS:round(db(peak)),renderedEvents:onsets,maxFirstNonzeroOffsetSamples:maxOffset,
    voiceOnsets,spaces:measuredSpaces,reflections:{seconds:times,rightOffsetSamples:337,gains:levels,feedback:0,highpassHzApprox:217,lowpassHzApprox:2835}};
}

function run(exe,args) {
  const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});
  check(!r.error&&r.status===0,`${r.error?.message??`Exit ${r.status}`}: ${String(r.stderr).slice(-3000)}`);return r;
}
export function getTools() {
  const ffmpeg=execFileSync('python',['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8',windowsHide:true}).trim();
  const ffprobe=require('ffprobe-static').path;check(existsSync(ffmpeg)&&existsSync(ffprobe),'Installed FFmpeg/ffprobe absent.');return {ffmpeg,ffprobe};
}
const ff=(tools,args)=>run(tools.ffmpeg,['-hide_banner','-nostdin','-v','error','-y',...args]);
export const probe=(tools,path)=>JSON.parse(run(tools.ffprobe,['-v','error','-show_streams','-show_format','-of','json',path]).stdout);
export function loudness(tools,path) {
  const r=run(tools.ffmpeg,['-hide_banner','-nostdin','-i',path,'-af','loudnorm=I=-16:TP=-2:LRA=20:print_format=json','-f','null','-']);
  const match=r.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);check(match,'R128 measurement missing.');
  const m=JSON.parse(match[0]);check(Number.isFinite(+m.input_i)&&Number.isFinite(+m.input_tp),'Invalid measured loudness.');
  return {LUFS:+m.input_i,truePeakDbTP:+m.input_tp,loudnessRangeLU:+m.input_lra};
}

export async function scanPCM(tools,path) {
  const child=spawn(tools.ffmpeg,['-hide_banner','-nostdin','-v','error','-xerror','-i',path,'-map','0:a:0','-f','f32le','-c:a','pcm_f32le','-'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stderr='',failure;child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-4000);});
  const done=new Promise(resolveDone=>{child.on('error',e=>{failure=e;resolveDone(-1);});child.on('close',resolveDone);});
  const total=acc(),chapters=CHAPTERS.map(()=>acc());
  const windows=[...SPACES.map(g=>({id:g.id,start:g.start,end:g.end})),
    {id:'trust-body',start:23,end:38},{id:'short-expansion',start:130,end:137},
    {id:'third-question',start:147,end:150.6},{id:'arthur-no-answer',start:154,end:160},
    {id:'lone-return',start:168,end:177.4},{id:'fade-tail',start:179.995,end:180}]
    .map(w=>({...w,a:Math.round(w.start*SR),b:Math.round(w.end*SR),data:acc()}));
  let frame=0,section=0,rest=Buffer.alloc(0),prevL=0,prevR=0,maxStep=0;
  try {
    for await(const chunk of child.stdout) {
      const buffer=rest.length?Buffer.concat([rest,chunk]):chunk,len=buffer.length-buffer.length%8;
      for(let i=0;i<len;i+=8,frame++) {
        const l=buffer.readFloatLE(i),r=buffer.readFloatLE(i+4);
        while(section<CHAPTERS.length-1&&frame>=CHAPTERS[section].end*SR)section++;
        take(total,l,r);take(chapters[section],l,r);maxStep=Math.max(maxStep,Math.abs(l-prevL),Math.abs(r-prevR));prevL=l;prevR=r;
        for(const w of windows)if(frame>=w.a&&frame<w.b)take(w.data,l,r);
      }
      rest=Buffer.from(buffer.subarray(len));
    }
  } catch(error){child.kill();await done;throw error;}
  const status=await done;check(!failure&&status===0,`Decode failed: ${failure?.message??stderr}`);
  check(rest.length===0&&frame===FRAMES,`Decoded ${frame} frames, expected ${FRAMES}.`);
  return {decodedFrames:frame,decodedDuration:frame/SR,...metric(total),maximumAdjacentSampleStep:round(maxStep),
    chapters:chapters.map((a,i)=>({id:CHAPTERS[i].id,start:CHAPTERS[i].start,end:CHAPTERS[i].end,...metric(a)})),
    windows:Object.fromEntries(windows.map(w=>[w.id,metric(w.data)]))};
}

function validateSignal(scan,measure,label) {
  check(measure.LUFS>=-17&&measure.LUFS<=-15&&measure.truePeakDbTP<=-1.5,`${label}: ${measure.LUFS} LUFS / ${measure.truePeakDbTP} dBTP.`);
  check(scan.clipping===0&&scan.nonfinite===0,`${label} clipping=${scan.clipping}, nonfinite=${scan.nonfinite}.`);
  check(scan.correlation>0&&scan.correlation<.995&&scan.sideRmsDbFS>-42&&Math.abs(scan.leftRmsDbFS-scan.rightRmsDbFS)<2,
    `${label} stereo: correlation=${scan.correlation}, side=${scan.sideRmsDbFS}, L/R=${scan.leftRmsDbFS}/${scan.rightRmsDbFS}.`);
  const energy=scan.chapters.map(c=>c.rmsDbFS),contrast=Math.max(...energy)-Math.min(...energy);
  check(contrast>=8,`${label} chapter contrast ${contrast}dB <8dB.`);
  const win=scan.windows;
  check(win['trust-body'].rmsDbFS-win['first-horizon'].rmsDbFS>=15,`${label} opening not spacious: ${win['first-horizon'].rmsDbFS} vs trust ${win['trust-body'].rmsDbFS}.`);
  check(win['third-question'].rmsDbFS-win['arthur-no-answer'].rmsDbFS>=13,`${label} third plan has no audible retreat: ${win['third-question'].rmsDbFS}/${win['arthur-no-answer'].rmsDbFS}.`);
  check(win['lone-return'].rmsDbFS-win['arthur-no-answer'].rmsDbFS>=13,`${label} lonely return inaudible.`);
  check(win['short-expansion'].rmsDbFS>win['trust-body'].rmsDbFS&&win['short-expansion'].rmsDbFS-win['trust-body'].rmsDbFS<6,`${label} choice must expand briefly, not dwarf trust.`);
  check(win['fade-tail'].rmsDbFS<-80,`${label} fade tail ${win['fade-tail'].rmsDbFS}.`);
  check(SPACES.every(g=>win[g.id].rmsDbFS>-65),`${label} intended environment is missing.`);
  return round(contrast);
}

export async function verify(tools,report,directory=AUDIO_DIR) {
  contract();const score=buildScore();
  check(report.title===TITLE&&report.duration===180&&report.bpm===80&&report.beats===240&&report.noVoice===true,'Identity contract failed.');
  check(report.storysha256===sha(STORY),'Story changed; regenerate, never edit the story from this task.');
  check(report.generatorSha256===sha(SELF),'Generator changed; regenerate.');
  check(report.music.eventSha256===score.eventSha256&&JSON.stringify(report.music.sections)===JSON.stringify(score.sections),'Arrangement provenance mismatch.');
  check(JSON.stringify(report.music.cues)===JSON.stringify(score.cues)&&JSON.stringify(report.music.spaces)===JSON.stringify(SPACES),'Cue/rest metadata mismatch.');
  check(report.music.original===true&&report.processing.externalSamples===false&&report.processing.TTS===false&&report.processing.adaptiveLoudnessGain===false&&report.processing.masterBitReduction===false,'Synthesis/processing provenance mismatch.');
  check(report.validation?.humanListeningPerformed===false&&report.validation?.browserPlaybackTested===false,'Do not claim human listening or browser acceptance.');
  const mp3=join(directory,'master.mp3'),wav=join(directory,'master.wav'),edit=join(directory,'edit-cues.json');
  check(report.mastersha256===sha(mp3),'MP3 hash mismatch.');check(report.archiveSha256===sha(wav),'WAV hash mismatch.');
  check(report.editCuesSha256===sha(edit),'Edit cues hash mismatch.');
  const edits=JSON.parse(readFileSync(edit,'utf8'));
  check(edits.storysha256===report.storysha256&&edits.mastersha256===report.mastersha256&&JSON.stringify(edits.shots)===JSON.stringify(score.shots)&&JSON.stringify(edits.cues)===JSON.stringify(score.cues),'Edit map is stale.');
  console.log('Verify: source/delivery hashes passed; probing MP3 and 24-bit WAV.');
  const a=probe(tools,mp3),m=a.streams[0],padding=+a.format.duration-180;
  check(a.streams.length===1&&m.codec_name==='mp3'&&m.channels===2&&+m.sample_rate===SR&&+m.bit_rate===256000,'48kHz stereo CBR 256kbps MP3 required.');
  check(padding>=0&&padding<.04,`MP3 container padding ${padding}s.`);
  const tags=a.format.tags;
  check(tags.title===TITLE&&tags.comment===COMMENT&&tags.story_sha256===report.storysha256&&tags.generator_sha256===report.generatorSha256&&tags.no_voice==='true','MP3 provenance tags mismatch.');
  const v=probe(tools,wav),s=v.streams[0];
  check(v.streams.length===1&&s.codec_name==='pcm_s24le'&&s.channels===2&&+s.sample_rate===SR&&+s.bits_per_raw_sample===24&&+v.format.duration===180,'24-bit / 48kHz / stereo / exact 180s WAV required.');
  console.log('Verify: decoding all 8,640,000 MP3 frames.');
  const mp3Scan=await scanPCM(tools,mp3);
  console.log('Verify: measuring MP3 R128 / true peak.');
  const mp3Measure=loudness(tools,mp3);
  console.log('Verify: decoding all 8,640,000 WAV frames.');
  const wavScan=await scanPCM(tools,wav);
  console.log('Verify: measuring WAV R128 / true peak.');
  const wavMeasure=loudness(tools,wav);
  const mp3Contrast=validateSignal(mp3Scan,mp3Measure,'MP3'),wavContrast=validateSignal(wavScan,wavMeasure,'WAV');
  check(Math.abs(mp3Measure.LUFS-wavMeasure.LUFS)<.5,'Encode changed integrated loudness >0.5 LU.');
  return {master:{...mp3Scan,...mp3Measure,sampleRate:SR,channels:2,bitrate:256000,chapterContrastDb:mp3Contrast,
    metadataDuration:+a.format.duration,metadataPaddingSeconds:round(padding)},
    archive:{...wavScan,...wavMeasure,sampleRate:SR,channels:2,bits:24,chapterContrastDb:wavContrast}};
}

function publish(work,names) {
  const committed=[],backups=[];
  try {
    for(const name of names) {
      const dest=join(AUDIO_DIR,name),backup=join(work,`previous-${name}`);
      if(existsSync(dest)){renameSync(dest,backup);backups.push({dest,backup});}
      renameSync(join(work,name),dest);committed.push(dest);
    }
  } catch(error) {
    for(const dest of committed.reverse())rmSync(dest,{force:true});
    for(const {dest,backup} of backups.reverse())renameSync(backup,dest);
    throw error;
  }
}
const summary=r=>({passed:r.validation.passed,title:r.title,duration:r.master.decodedDuration,frames:r.master.decodedFrames,
  LUFS:r.master.LUFS,truePeakDbTP:r.master.truePeakDbTP,LRA:r.master.loudnessRangeLU,chapterContrastDb:r.master.chapterContrastDb,
  correlation:r.master.correlation,sideRmsDbFS:r.master.sideRmsDbFS,clipping:r.master.clipping,
  metadataDuration:r.master.metadataDuration,metadataPaddingSeconds:r.master.metadataPaddingSeconds,
  archiveLUFS:r.archive.LUFS,archiveTruePeakDbTP:r.archive.truePeakDbTP,storysha256:r.storysha256,mastersha256:r.mastersha256,
  archiveSha256:r.archiveSha256,humanListeningPerformed:false});

export async function main() {
  contract();console.log('Score: story contract passed; locating installed FFmpeg/ffprobe.');
  const tools=getTools();
  if(process.argv.includes('--verify')) {
    console.log('Score: independently verifying published masters.');
    const r=JSON.parse(readFileSync(join(AUDIO_DIR,'report.json'),'utf8')),actual=await verify(tools,r);
    check(r.validation.passed===true&&JSON.stringify(r.master)===JSON.stringify(actual.master)&&JSON.stringify(r.archive)===JSON.stringify(actual.archive),'Published measurements stale.');
    json(join(AUDIO_DIR,'verify-report.json'),{...summary(r),generatorSha256:sha(SELF),mode:'--verify',checkedAt:new Date().toISOString()});
    console.log(JSON.stringify(summary(r),null,2));return r;
  }
  mkdirSync(AUDIO_DIR,{recursive:true});
  const storyHash=sha(STORY),generatorHash=sha(SELF),score=buildScore(),work=mkdtempSync(join(AUDIO_DIR,'.stage-'));
  try {
    const render=renderScore(join(work,'premaster.wav'),score);
    ff(tools,['-i',join(work,'premaster.wav'),'-af','highpass=f=28,lowpass=f=14500','-c:a','pcm_f32le',join(work,'prepared.wav')]);
    const source=loudness(tools,join(work,'prepared.wav'));
    let target=-16,ceiling=-2.2,fixedGainDb=0,encoded;
    for(let attempt=0;attempt<4;attempt++) {
      fixedGainDb=round(target-source.LUFS);
      ff(tools,['-i',join(work,'prepared.wav'),'-af',`aresample=192000,volume=${fixedGainDb}dB,alimiter=limit=${10**(ceiling/20)}:attack=4:release=100:level=false:latency=true,aresample=48000,apad=whole_len=${FRAMES},atrim=end_sample=${FRAMES}`,
        '-ar','48000','-ac','2','-c:a','pcm_s24le',join(work,'master.wav')]);
      ff(tools,['-i',join(work,'master.wav'),'-map_metadata','-1','-c:a','libmp3lame','-b:a','256k','-ar','48000','-ac','2','-write_xing','1','-id3v2_version','3',
        '-metadata',`title=${TITLE}`,'-metadata',`comment=${COMMENT}`,'-metadata',`story_sha256=${storyHash}`,'-metadata',`generator_sha256=${generatorHash}`,
        '-metadata','no_voice=true','-metadata','bpm=80',join(work,'master.mp3')]);
      encoded=loudness(tools,join(work,'master.mp3'));
      console.log(`Master ${attempt+1}: ${encoded.LUFS} LUFS / ${encoded.truePeakDbTP} dBTP.`);
      if(Math.abs(encoded.LUFS+16)<=.18&&encoded.truePeakDbTP<=-1.5)break;
      target+=clamp(-16-encoded.LUFS,-1,1);if(encoded.truePeakDbTP>-1.5)ceiling-=encoded.truePeakDbTP+1.8;
    }
    const masterHash=sha(join(work,'master.mp3'));
    const edits={title:TITLE,duration:180,bpm:80,beats:240,sampleRate:SR,storysha256:storyHash,mastersha256:masterHash,
      clock:'Use decoded audio.currentTime; do not resnap unquantized whistle onsets. Some visual reactions intentionally precede music.',
      cues:score.cues,shots:score.shots,spaces:SPACES,sourceOnsets:render.voiceOnsets};
    json(join(work,'edit-cues.json'),edits);
    const {voiceOnsets,...compactRender}=render;
    const r={title:TITLE,film:FILM,duration:180,bpm:80,beats:240,bars:60,noVoice:true,sampleRate:SR,
      storysha256:storyHash,generatorSha256:generatorHash,mastersha256:masterHash,archiveSha256:sha(join(work,'master.wav')),editCuesSha256:sha(join(work,'edit-cues.json')),
      music:{original:true,seed:SEED,eventSha256:score.eventSha256,eventCount:score.events.length,theme:{midi:THEME,key:'E minor with final F# question',whistle:WHISTLE},
        sections:score.sections,cues:score.cues,spaces:SPACES,render:compactRender,
        synthesis:'Near-sine breath whistle, detuned by cents not semitones; discrete dry Karplus plucks; additive triangle/sub and two short bandlimited pulse notes. Seeded synthetic wind/hooves/paper/wheel/water/steps. No imported audio.'},
      processing:{externalSamples:false,TTS:false,adaptiveLoudnessGain:false,masterBitReduction:false,drumSidechain:false,
        targetLUFS:-16,allowedLUFS:[-17,-15],truePeakLimitDbTP:-1.5,fixedGainDb,preEncodeCeilingDbTP:ceiling,sourceMeasurement:source,
        estimatedPeakReductionDb:round(Math.max(0,source.truePeakDbTP+fixedGainDb-ceiling)),
        signalChain:'Float32 block render -> 28Hz HP / 14.5kHz LP -> R128-measured fixed gain -> 4x stereo-linked limiter, 4ms attack/100ms release, latency compensated -> 48kHz s24le -> CBR 256k MP3 with gapless trim metadata',fade:{start:178.5,end:180}},
      delivery:{file:'master.mp3',archive:'master.wav',editMap:'edit-cues.json',relativeURL:'audio/master.mp3',
        durationContract:'WAV and gapless MP3 decode to exactly 8640000 stereo frames / 180.000s. MP3 container includes encoder padding (<40ms), not extra story time.'},
      validation:{passed:false,humanListeningPerformed:false,browserPlaybackTested:false,
        scope:'DSP and full decoded-signal measurements only. Timbre plausibility is tested, but subjective Western character requires human listening.',
        checks:['seven chapters / 24 shots / 16 exact CUES','original deterministic sparse score','six no-dry-music rests, real rendered bus measurements','both masters fully decoded','fresh integrated R128 and true peak','codec/rate/bits/bitrate/padding','no clipping or nonfinite PCM','stereo/contrast/retreat/return/fade','source and deliverable hashes']}};
    const actual=await verify(tools,r,work);Object.assign(r,actual);
    r.validation.passed=true;r.validation.checkedAt=new Date().toISOString();
    check(storyHash===sha(STORY)&&generatorHash===sha(SELF),'Story or generator changed during render; refuse stale publication.');
    json(join(work,'report.json'),r);publish(work,['master.wav','master.mp3','edit-cues.json','report.json']);
    console.log(JSON.stringify(summary(r),null,2));return r;
  } finally {rmSync(work,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===SELF)main().catch(error=>{console.error(error.stack);process.exitCode=1;});