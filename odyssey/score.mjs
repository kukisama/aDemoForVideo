/** THE NAME THAT RETURNS — newly composed epic chip score, no recorded sources.
 * Node 24: node odyssey/score.mjs [--verify]. Writes ONLY ./audio/.
 * Reuses streaming/R128/oscillator engineering, NOT the Western notes or arrangement.
 * All timings derive from the immutable story. 48kHz floats, never an 8-bit master.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, openSync, readSync, writeSync, closeSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TITLE as FILM_TITLE, BPM, BEAT, DURATION, TOTAL_BEATS, CHAPTERS, SHOTS, ACTION_CUES, HOLDS } from './story.mjs';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const SELF = fileURLToPath(import.meta.url), STORY = fileURLToPath(new URL('./story.mjs', import.meta.url));
export const AUDIO_DIR = fileURLToPath(new URL('./audio/', import.meta.url));
export const SR = 48000, SPB = 20000, BAR_SAMPLES = 80000, FRAMES = 8640000;
export const TITLE = 'The Name That Returns / 奥德赛·归来之名';
const SEED = 0x49544841, TAU = Math.PI * 2;
const COMMENT = 'Original epic chiptune, 144 BPM. Mathematical instruments and local SFX only. No voice, external recordings, film music or melody transcription.';
const check = (ok, message) => { if (!ok) throw new Error(message); };
const clamp = (x, lo=0, hi=1) => Math.max(lo, Math.min(hi, x));
const smooth = x => { x=clamp(x); return x*x*(3-2*x); };
const hz = midi => 440*2**((midi-69)/12);
const db = x => 20*Math.log10(Math.max(1e-12,x));
const round = x => Math.round(x*1e6)/1e6;
const digest = data => createHash('sha256').update(data).digest('hex');
export function sha(path) {
  const fd=openSync(path,'r'), buffer=Buffer.alloc(1024*1024), hash=createHash('sha256');
  try { let n; while((n=readSync(fd,buffer,0,buffer.length,null))>0) hash.update(buffer.subarray(0,n)); }
  finally { closeSync(fd); } return hash.digest('hex');
}
const json = (path,value) => writeFileSync(path,JSON.stringify(value,null,2)+'\n');
const rng = seed => { let x=seed>>>0; return () => { x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296; }; };

export function contract() {
  check(BPM===144 && DURATION===180 && TOTAL_BEATS===432 && BEAT===60/144,'Locked duration/tempo changed.');
  const ids=['threshold','troy','fleet','cave','cyclops','hubris','sirens','strait','storm','drift','ithaca','bow','hall','root','home'];
  const bars=[4,8,6,8,12,6,8,12,10,6,4,6,8,6,4]; let beat=0;
  check(CHAPTERS.length===15 && SHOTS.length===54,'Requires 15 chapters / 54 shots.');
  CHAPTERS.forEach((c,i)=>{ check(c.id===ids[i]&&c.bars===bars[i]&&c.startBeat===beat&&c.endBeat===beat+bars[i]*4,`Chapter contract: ${c.id}`); beat=c.endBeat; });
  check(beat===432&&SPB===SR*BEAT&&BAR_SAMPLES===SPB*4&&FRAMES===SR*DURATION,'Invalid sample clock.');
  check(HOLDS.length===1&&HOLDS[0].start===122.5&&Math.abs(HOLDS[0].end-(122.5+BEAT))<1e-10,'Shared hold changed.');
  check(ACTION_CUES.length===30&&new Set(ACTION_CUES.map(c=>c.id)).size===30,'Action cue contract changed.');
  for(const c of ACTION_CUES) check(Math.abs(c.time-c.beat*BEAT)<1e-10&&Number.isInteger(c.beat),`Invalid shared action ${c.id}`);
  for(const [id,time] of [['arrow-release',147.5],['twelve-axes',147.91666666666666],['root-recognized',168.33333333333334]])
    check(Math.abs(ACTION_CUES.find(c=>c.id===id)?.time-time)<1e-9,`Locked action moved: ${id}`);
  return true;
}

// Entirely new eight-bar A-Dorian expedition: A–C–D, E–D–B; a rising sixth
// in bar three, then a downward answering arc. Tuples = beat, MIDI, gate beats.
export const EXPEDITION = [
  [[0,69,1],[1.5,72,.5],[2,74,1.5]],
  [[0,76,1.5],[2,74,.5],[3,71,.75]],
  [[0,69,.75],[1,74,.75],[2,78,1.5]],
  [[0,76,1],[1.5,74,.5],[2.5,72,.5],[3.25,71,.5]],
  [[0,69,1.5],[2,76,.75],[3,79,.75]],
  [[0,78,1],[1.5,76,1],[3,74,.75]],
  [[0,72,.75],[1,71,.75],[2,67,1],[3.25,71,.5]],
  [[0,74,1],[1.5,71,.5],[2.5,69,1.25]],
];
// Independent four-bar domestic phrase: an open fifth, a turn, a quiet arrival.
export const HOME = [
  [[0,69,1],[1.5,76,.75],[2.5,74,.5],[3.25,72,.5]],
  [[0,71,1.5],[2,67,.75],[3,69,.75]],
  [[0,72,.75],[1,74,.75],[2,76,1],[3.25,79,.5]],
  [[0,76,1],[1.5,71,.75],[2.75,69,1]],
];
const H={
  Am:[33,[57,60,64,69]], Am9:[33,[57,60,64,71]], A5:[33,[57,64,69,71]],
  D:[38,[57,62,66,69]], G:[31,[55,59,62,67]], Em:[40,[55,59,64,67]], C:[36,[55,60,64,67]],
  F:[29,[53,57,60,65]], E:[40,[56,59,64,68]], Esus:[40,[57,59,64,69]],
  A:[33,[57,61,64,69]], A9:[33,[57,61,64,71]], Fs:[30,[54,57,61,66]],
  Bb:[34,[58,62,65,70]], Ab:[32,[56,60,63,68]], Eflat:[39,[55,58,63,67]],
  Em9:[40,[59,62,66,71]], Bm:[35,[59,62,66,71]], B5:[35,[59,66,71,73]],
  Dm:[38,[57,62,65,69]], Dm9:[38,[57,62,65,76]], Gm:[31,[55,58,62,67]],
};
export const SECTIONS = [
  {id:'threshold',key:'A suspended / incomplete home',level:.42,chords:['A5','Am9','A5','Esus'],instruments:['lyra','bass','wind'],rhythm:'Isolated two-note domestic question; no drums',development:'门前留白：归家主题只说前两个音。'},
  {id:'troy',key:'A Aeolian → Dorian',level:.95,chords:['Am','F','C','G','Am','D','Esus','Am'],instruments:['brass','war','frame','metal','bass','strings','pulse'],rhythm:'Bronze drum phalanx: 0, 1.5, 2.75; alternating shield replies',development:'青铜低鼓与错位帧鼓，短铜管宣叙；不是EDM四踩。'},
  {id:'fleet',key:'A Dorian',level:.96,chords:['Am9','G','D','Em','Am','D'],instruments:['pulse','lyra','strings','brass','bass','frame'],rhythm:'Broad theme over rowing half-notes and flowing lyra',development:'旋律舒展，F#点亮Dorian；里拉琴左右应答。'},
  {id:'cave',key:'A Phrygian / chromatic floor',level:.62,chords:['Am','Bb','Am','Ab','Gm','Eflat','Esus','E'],instruments:['bass','war','pulse','wind','lyra'],rhythm:'Uneven low strikes: 0 / 1.75 / 3.25, every other bar incomplete',development:'半音地板、窄脉冲与不对称低鼓；大空间中仍有空隙。'},
  {id:'cyclops',key:'A minor → Dorian escape',level:1.06,chords:['Am9','Esus','Am','F','Dm','Esus','Am','F','E','Am','G','D'],instruments:['lyra','frame','bass','war','strings','brass','pulse','metal'],rhythm:'12 bars: wine/probe 3 → charge 3 → impact 3 → escape 3',development:'先拨弦试探，再震音聚力，铜管重击，最后半拍脉冲脱离。'},
  {id:'hubris',key:'False A major → chromatic collapse',level:.92,chords:['A','D','A9','Ab','Gm','E'],instruments:['pulse','brass','metal','bass','war','wind','strings'],rhythm:'Triumphal dotted calls fracture into falling chromatic stabs',development:'前三小节虚假大调胜利；随后移调崩落，不用同伴奏只降音量。'},
  {id:'sirens',key:'E Dorian',level:.73,chords:['Em9','A','Bm','D','Em9','A9','Bm','Esus'],instruments:['bell','pulse','lyra','bass','frame','wind'],rhythm:'3+3+2 eighth-note accents with two independent interlocking lines',development:'通透FM铃与脉冲复调；节拍仍为144，错觉来自重音而非改速。'},
  {id:'strait',key:'B Phrygian / B minor tension',level:1.13,chords:['Bm','C','Bm','Am','Bm','C','G','Fs','Bm','C','E','B5'],instruments:['pulse','brass','strings','war','frame','metal','bass','lyra'],rhythm:'Six-register calls against 3+2+3 low drums and oar ostinato',development:'六个声部按不同音区和声像探下；损失一刻抽掉领奏，鼓阵仍逼迫向前。'},
  {id:'storm',key:'D minor / descending sea',level:1.05,chords:['Dm9','Bb','Gm','Dm','Eflat','Bb','Gm','E','Dm','A5'],instruments:['strings','wind','bass','brass','war','metal','lyra'],rhythm:'Rotating tremolo, displaced thunder and widening surf; then subtraction',development:'危机靠音区、海浪滤波、错位低鼓与撤去领奏建立，不只是加响。'},
  {id:'drift',key:'A minor, open ninth',level:.43,chords:['A5','Am9','C','G','Am9','Esus'],instruments:['lyra','bass','wind'],rhythm:'Exposed solo with long unaccompanied gaps over a quiet sustained floor',development:'独奏拨弦拾起归家动机；没有鼓和合奏垫底。'},
  {id:'ithaca',key:'A major / warm borrowed C',level:.59,chords:['A9','D','Fs','A'],instruments:['lyra','strings','bass','bell'],rhythm:'Complete home melody, soft inner-voice suspensions; no percussion',development:'归家主题第一次完整暖色呈现。'},
  {id:'bow',key:'A suspended → E tension',level:.56,chords:['A5','Esus','Am9','Esus','E','A5'],instruments:['lyra','tension','bass'],rhythm:'Plucks contract; continuous ten-beat draw ends exactly at release',development:'从稀疏拨弦收缩到弦张力升音；放箭与斧孔声由共享动作点触发。'},
  {id:'hall',key:'A Dorian; two themes in counterpoint',level:1.18,chords:['Am','G','D','Em','Am9','D','Esus','Am'],instruments:['pulse','lyra','brass','strings','bass','war','frame','metal'],rhythm:'Full eight-bar expedition above independent four-bar home twice',development:'双主题八小节交织；结尾按字幕逐层撤军鼓，为识认留出空间。'},
  {id:'root',key:'A open ninth → warm major',level:.40,chords:['A5','Am9','D','A9','D','A5'],instruments:['lyra','bass','bell'],rhythm:'No drums or inherited drum reverberation; sparse intimate replies',development:'真正退出鼓阵，168.333秒只用柔和铃声确认识认。'},
  {id:'home',key:'A major',level:.64,chords:['A9','D','Esus','A'],instruments:['lyra','pulse','strings','bass'],rhythm:'Home reprise with augmented expedition fragments; drum-free cadence',development:'归家旋律明亮而克制，远征只作长音回应；末1.5秒完整淡出。'},
];
export const CUES = [
  ...ACTION_CUES.map(c=>({...c,source:'story.ACTION_CUES',sample:Math.round(c.beat*SPB)})),
  ...HOLDS.map(c=>({...c,source:'story.HOLDS',startSample:Math.round(c.start*SR),endSample:Math.round(c.end*SR),edgeRampMs:8,allBusesMuted:true})),
  {id:'bow-draw',start:344*BEAT,end:354*BEAT,source:'original arrangement, ending at arrow-release'},
  {id:'drums-exit',start:CHAPTERS[13].start,source:'story.CHAPTERS.root; all FX memory cleared'},
  {id:'terminal-fade',start:178.5,end:180,source:'original master envelope'},
];
const modePitch = (m,mode='dorian',transpose=0) => {
  const pc=((m%12)+12)%12;
  if(mode==='major'&&(pc===0||pc===7)) m++;
  if(mode==='minor'&&pc===6) m--;
  if(mode==='phrygian') { if(pc===6) m--; if(pc===11) m--; }
  return m+transpose;
};
const sfxMap={shield:'sfx-metal',clash:'sfx-metal',slash:'sfx-whoosh',reveal:'sfx-sub',stone:'sfx-stone',whoosh:'sfx-whoosh',rise:'sfx-rise',impact:'sfx-impact',splash:'sfx-surf',pluck:'sfx-pluck',crack:'sfx-crack',sub:'sfx-sub',wood:'sfx-wood',arrow:'sfx-arrow',metal:'sfx-metal',bell:'sfx-bell'};
export const PALETTE = ['pulse','bass','lyra','brass','strings','war','frame','metal','bell','wind','tension',...new Set(Object.values(sfxMap))];

export function buildScore() {
  contract(); const events=[],bars=[];let section=0;
  const add=(kind,beat,midi,length,gain,pan=0,extra={})=>{
    const c=CHAPTERS[section],sample=Math.round(beat*SPB),end=Math.round(c.endBeat*SPB);
    if(beat>=c.endBeat) return;
    if(HOLDS.some(h=>sample>=Math.round(h.start*SR)&&sample<Math.round(h.end*SR))) return;
    check(beat>=c.startBeat&&Number.isInteger(beat*4),`Off-grid/out-of-act ${kind} ${beat}`);
    const release=['strings','brass','lyra','bell'].includes(kind)?.22:.035;
    const gateFrames=Math.min(Math.round(length*SPB),end-sample),frames=Math.min(gateFrames+Math.round(release*SR),end-sample);
    events.push({kind,beat,sample,midi,gateFrames,frames,gain:gain*SECTIONS[section].level,pan,section,role:'music',...extra});
  };
  const chord=(kind,at,tones,length,gain,extra={})=>tones.forEach((m,i)=>add(kind,at,m,length,gain,-.8+i*1.6/Math.max(1,tones.length-1),extra));
  const phrase=(theme,index,at,kind,gain,options={})=>{
    for(const [t,m,d] of theme[index%theme.length]) add(kind,at+t*(options.stretch??1),modePitch(m,options.mode,options.transpose??0)+(options.octave??0),d*(options.stretch??1),gain,options.pan??-.12,{theme:theme===HOME?'home':'expedition',themeBar:index%theme.length,...options});
  };
  const bass=(at,root,gate=3.8,gain=.25)=>add('bass',at,root,gate,gain);
  const perc=(kind,at,gain,pan=0,midi=38)=>add(kind,at,midi,kind==='war'?.9:.45,gain,pan);
  const weave=(at,tones,gain,positions=[0,.5,1.5,2,2.5,3.5])=>positions.forEach((t,i)=>add('lyra',at+t,tones[(i*2+Math.floor(i/3))%tones.length],.8,gain*(i%3===0?1:.75),i%2?.55:-.52));
  const drums=(at,style,level)=>{
    const patterns={bronze:[0,1.5,2.75],charge:[0,.75,2,3.5],impact:[0,2.5,3.25],escape:[0,1.75,2.5],strait:[0,1.5,2.5],hall:[0,.75,2.5,3.5]};
    patterns[style].forEach((t,i)=>perc('war',at+t,level*(i===0?.48:.31),i%2?.16:-.14,36+i*3));
    const reply=style==='hall'?[.5,1.5,2,3]:style==='escape'?[.5,1,2,3,3.5]:[.75,2,3.5];
    reply.forEach((t,i)=>perc('frame',at+t,level*.20,i%2?.48:-.48,55+i*2));
    if(['charge','strait','hall'].includes(style)) [1.25,2.75,3.75].forEach((t,i)=>perc('metal',at+t,level*.085,.5-i*.5,82));
  };
  for(section=0;section<CHAPTERS.length;section++) {
    const c=CHAPTERS[section],s=SECTIONS[section];check(s.id===c.id&&s.chords.length===c.bars,`Arrangement length ${c.id}`);
    for(let b=0;b<c.bars;b++) {
      const at=c.startBeat+b*4,name=s.chords[b],[root,tones]=H[name];
      bars.push({bar:at/4,beat:at,time:at*BEAT,sample:at*SPB,section:c.id,chord:name,rootMidi:root});
      switch(c.id) {
        case 'threshold':
          bass(at,33,3.95,.13);add('wind',at,45,4,.05,.55);
          if(b===0||b===2) {add('lyra',at,69,2,.34,-.35,{theme:'home-fragment'});add('lyra',at+2,76,1.8,.24,.4,{theme:'home-fragment'});}
          else add('lyra',at+1.5,b===1?64:59,2,.16,-.1);
          break;
        case 'troy':
          drums(at,'bronze',.93);bass(at,root,1.4);bass(at+2.75,root+7,.85,.21);
          chord('brass',at,tones.slice(0,3).map(m=>m-12),1.3,.075);chord('strings',at,tones,3.8,.042,{tremolo:b%2===1});
          phrase(EXPEDITION,b,at,b<4?'brass':'pulse',b<4?.23:.29,{mode:b<4?'minor':'dorian',octave:b<4?-12:0});
          if(b%2) perc('metal',at+3.25,.11,-.6,79);
          break;
        case 'fleet':
          phrase(EXPEDITION,b,at,'pulse',.32);weave(at,tones,.21);
          bass(at,root,3.8,.27);chord('strings',at,tones,3.9,.065,{slow:true});
          if(b%2===0) add('brass',at+1,tones[1]-12,2.5,.15,.5);
          perc('frame',at,.15,-.45,50);perc('frame',at+2,.11,.45,57);
          break;
        case 'cave':
          bass(at,root,3.85,.25);add('wind',at,35,4,.09,b%2?.6:-.6);
          (b%2?[1.75]:[0,3.25]).forEach((t,i)=>perc('war',at+t,.32,-.25+i*.5,29+b%3));
          add('pulse',at+.75,modePitch([69,70,69,68,67,66,65,64][b]),1.4,.18,.12,{dark:true});
          if(b>3) add('lyra',at+2.75,tones[1],.5,.19,-.6,{damped:true});
          break;
        case 'cyclops': {
          const phase=['wine-probe','charge','impact','escape'][Math.floor(b/3)];
          if(b<3) {weave(at,tones,.23,[0,1.25,2.75]);bass(at,root,3.8,.20);perc('frame',at+2,.12,.4);}
          else {drums(at,b<6?'charge':b<9?'impact':'escape',b<6?.84:1.05);bass(at,root,1.3,.31);bass(at+2,root+7,1.6,.23);}
          if(b>=3) chord('strings',at,tones,3.8,b<6?.048:.062,{tremolo:true,phase});
          if(b>=4) phrase(EXPEDITION,b-4,at,b<6?'lyra':'pulse',b<6?.35:.33,{mode:b<9?'minor':'dorian',phase});
          if(b>=6&&b<9) chord('brass',at+.5,tones.slice(0,3).map(m=>m-12),1.4,.10,{phase});
          if(b>=9) weave(at,tones,.18,[0,.5,1,1.75,2.5,3,3.5]);
          break;
        }
        case 'hubris':
          bass(at,root,2.4,.28);
          if(b<3) {phrase(EXPEDITION,b+4,at,'pulse',.32,{mode:'major'});chord('brass',at,tones,2.7,.08);perc('metal',at,.10,.6);perc('war',at+2.5,.3);}
          else { [0,1.25,2.75].forEach((t,i)=>{add('brass',at+t,68-(b-3)*2-i,.5,.21,i%2?.4:-.4);perc('war',at+t,.3,0,34-i*2);});chord('strings',at,tones,3.8,.05,{tremolo:true});add('wind',at,40,4,.22,.6); }
          break;
        case 'sirens':
          bass(at,root,3.85,.19);add('wind',at,55,4,.035,-.65);
          phrase(EXPEDITION,b,at,'bell',.27,{transpose:7,pan:.40});
          [0,1.5,3].forEach((t,i)=>{add('pulse',at+t,tones[(i+b)%tones.length]+12,.7,.16,-.55,{round:true});perc('frame',at+t,.09,.5,64);});
          [0.5,2,3.5].forEach((t,i)=>add('lyra',at+t,tones[(i+2)%tones.length],.6,.18,.15));
          break;
        case 'strait':
          drums(at,'strait',1.02);bass(at,root,1.1,.32);bass(at+1.5,root+12,.7,.20);bass(at+2.5,root,.95,.28);
          chord('strings',at,tones,3.8,.071,{tremolo:true});weave(at,tones,.16,[.5,1,2,3]);
          // Six calls have distinct registers/pans. They answer, rather than stacking six loud leads.
          for(let head=0;head<6;head++) add(head%2?'brass':'pulse',at+head*.5,tones[(head+b)%tones.length]+(head<2?-12:head>3?12:0),.38,.13,-.85+head*.34,{head:head+1});
          if(b<8||b>=10) phrase(EXPEDITION,b,at,'pulse',.27,{mode:'phrygian',transpose:2});
          else add('brass',at+1,root+24,2.6,.13,.35);
          break;
        case 'storm':
          if(b<9) {
            bass(at,root,3.85,.30);chord('strings',at,tones,3.85,.079,{tremolo:true,rotate:b});
            add('wind',at,38,4,.30,b%2?.65:-.65,{surf:true});
            [b%2?.75:0,2.25,3.5].forEach((t,i)=>perc('war',at+t,.40,[-.55,.45,0][i],32+i*5));
            if(b<6) [0,1.75].forEach((t,i)=>add('brass',at+t,tones[(i+b)%tones.length]-12,1.5,.21,i?.45:-.45));
            if(b>=5) weave(at,tones,.19,[.25,1,2.75,3.5]);
            if(b%2===1) perc('metal',at+1.5,.15,-.5);
          } else {
            bass(at,33,2,.16);add('wind',at,30,2,.24,0,{surf:true});
            // Shared hold is beat 294..295. This pickup is already the lone survivor's lyra.
            add('lyra',at+3,69,.9,.36,-.35,{theme:'home-pickup'});
          }
          break;
        case 'drift':
          bass(at,root,3.96,.14);add('wind',at,44,4,.024,.6);
          if(b%2===0) phrase(HOME,b/2,at,'lyra',.38,{stretch:2,octave:b===4?-12:0,pan:-.28});
          break;
        case 'ithaca':
          phrase(HOME,b,at,'lyra',.43,{mode:'major',pan:-.3});bass(at,root,3.9,.19);
          chord('strings',at,tones,3.9,.047,{slow:true});if(b%2===0) add('bell',at+2.5,tones[2]+12,1.4,.10,.55);
          break;
        case 'bow':
          bass(at,root,3.9,.11);
          if(b<4) weave(at,tones,.28,b<2?[0,1.5,3]:[0,2.5]);
          if(b===2) add('tension',at,45,10,.20,-.12);
          if(b===4) add('lyra',at,64,1,.19,.35,{damped:true});
          if(b===5) add('lyra',at+1,69,2.4,.27,-.35);
          break;
        case 'hall':
          phrase(EXPEDITION,b,at,'pulse',.34,{pan:-.15});
          phrase(HOME,b%4,at,'lyra',.41,{octave:-12,pan:.47});
          bass(at,root,1.6,.31);bass(at+2,root+7,1.6,.26);
          chord('strings',at,tones,3.85,.066,{tremolo:b<6});
          chord('brass',at+.5,tones.slice(0,3).map(m=>m-12),b<6?1.4:2.8,b<6?.084:.055);
          if(b<7) drums(at,'hall',b<6?1.02:.72);
          else perc('frame',at,.13,-.5);
          break;
        case 'root':
          bass(at,root,3.95,.12);
          add('lyra',at,b%2?tones[1]:tones[0],2.8,.31,b%2?.35:-.35);
          if(b===1||b===4) add('lyra',at+2,tones[2],1.8,.23,.3);
          break;
        case 'home':
          phrase(HOME,b,at,'lyra',.45,{mode:'major',pan:.30});bass(at,root,3.9,.20);
          chord('strings',at,tones,3.95,.055,{slow:true});
          if(b===0||b===2) phrase(EXPEDITION,b===0?0:7,at,'pulse',.15,{mode:'major',stretch:2,octave:-12,pan:-.4,round:true});
          if(b===3) add('lyra',at+2.75,81,1,.24,-.4,{theme:'home-cadence'});
          break;
      }
    }
  }
  for(const c of ACTION_CUES) {
    const section=CHAPTERS.findIndex(s=>s.id===c.chapter),kind=sfxMap[c.kind];check(kind,`Unknown action ${c.kind}`);
    const seconds={rise:1.05,reveal:.7,stone:.55,impact:.55,splash:.7,sub:.65,bell:.85,arrow:.16,metal:.42,wood:.18,crack:.36,pluck:.30,clash:.28,shield:.30,slash:.25,whoosh:.3}[c.kind];
    const sample=Math.round(c.beat*SPB),frames=Math.min(Math.round(seconds*SR),Math.round(CHAPTERS[section].endBeat*SPB)-sample);
    events.push({kind,beat:c.beat,sample,midi:c.kind==='bell'?81:c.kind==='metal'?86:45,gateFrames:frames,frames,
      gain:(c.kind==='bell'?.045:c.kind==='rise'?.13:c.kind==='sub'?.085:.115)*c.intensity,
      pan:c.kind==='bell'?.45:c.kind==='arrow'?-.15:c.kind==='metal'?.3:((ACTION_CUES.indexOf(c)%3)-1)*.35,
      section,role:'sfx',cueId:c.id,cueKind:c.kind,source:'story.ACTION_CUES',intensity:c.intensity});
  }
  events.sort((a,b)=>a.sample-b.sample||a.kind.localeCompare(b.kind,'en'));
  events.forEach((e,i)=>{
    e.id=`ev-${String(i+1).padStart(5,'0')}`;
    check(PALETTE.includes(e.kind)&&e.frames>0&&e.gain>0&&Math.abs(e.pan)<=1,`Invalid event ${e.id}`);
    check(e.sample>=CHAPTERS[e.section].startBeat*SPB&&e.sample+e.frames<=CHAPTERS[e.section].endBeat*SPB,`Act spill ${e.id}`);
  });
  const sections=SECTIONS.map((s,i)=>{
    const {level,...rest}=s,c=CHAPTERS[i],notes=events.filter(e=>e.section===i&&e.role==='music'),counts={};
    notes.forEach(e=>counts[e.kind]=(counts[e.kind]??0)+1);
    // Exclude volume, IDs and absolute origin. Hash musical structure, not gain variation.
    const identity=notes.map(({gain,id,section,sample,beat,...e})=>({...e,beat:beat-c.startBeat}));
    return {...rest,start:c.start,end:c.end,bars:c.bars,startBeat:c.startBeat,eventCounts:counts,musicEvents:notes.length,structureSha256:digest(JSON.stringify(identity))};
  });
  return {events,bars,sections,eventSha256:digest(JSON.stringify(events))};
}

function blep(p,d) {
  if(p<d){const x=p/d;return x+x-x*x-1;}
  if(p>1-d){const x=(p-1)/d;return x*x+x+x+1;}return 0;
}
const saw=(p,d)=>2*p-1-blep(p,d);
const pulse=(p,d)=> (p<.30?.70:-.30)+.5*blep(p,d)-.5*blep((p+.70)%1,d);
export function voice(e,index) {
  const random=rng(SEED^Math.imul(index+1,0x9e3779b1)),noise=()=>random()*2-1;
  const f=hz(e.midi),total=e.frames/SR,gate=e.gateFrames/SR;
  const envelope=(t,a=.004)=>smooth(t/a)*(1-smooth((t-gate)/Math.max(.004,total-gate)))*(1-smooth((t-(total-.010))/.010));
  let p=0,lo=0,hi=0,phase=0,render,room=.15;
  switch(e.kind) {
    case 'pulse':
      room=.22;render=t=>{const d=f*(1+.0018*Math.sin(TAU*5.1*t)*smooth(t/.2))/SR;p=(p+d)%1;const x=pulse(p,d)*(e.round?.30:.60)+Math.sin(TAU*p)*.58;lo+=(e.dark?.085:.29)*(x-lo);return lo*envelope(t,.009);};break;
    case 'bass':
      room=.012;render=t=>{p=(p+f/SR)%1;const a=TAU*p;return (Math.sin(a)-Math.sin(3*a)/9+Math.sin(5*a)/25-Math.sin(7*a)/49)*.80*envelope(t,.008);};break;
    case 'lyra': {
      // Fractional-delay plucked string plus synthetic bridge: entirely computed excitation.
      const damp=e.damped?.53:.30,period=SR/f-damp/(1-damp),length=Math.ceil(period)+2,line=new Float32Array(length);
      let cursor=0,last=0,mean=0;
      for(let i=0;i<length;i++){lo=.40*lo+.60*noise();line[i]=lo;mean+=lo;}
      for(let i=0;i<length;i++) line[i]=(line[i]-mean/length)*1.65;
      const feedback=Math.exp(-Math.log(1000)/(f*(e.damped?.70:2.6)));
      room=.24;render=t=>{let read=cursor-period;if(read<0)read+=length;const a=Math.floor(read),fract=read-a,x=line[a]*(1-fract)+line[(a+1)%length]*fract;last=(1-damp)*x+damp*last;line[cursor]=last*feedback;cursor=(cursor+1)%length;return (x*.76+Math.sin(TAU*f*t)*Math.exp(-t*3.2)*.28+Math.sin(TAU*f*2.002*t)*Math.exp(-t*12)*.09)*envelope(t,.0018);};break;
    }
    case 'brass':case 'strings': {
      const brass=e.kind==='brass',phases=[random(),random(),random()],detune=brass?[.997,1,1.003]:[.994,1,1.006];room=brass?.24:.34;
      render=t=>{let x=0;for(let i=0;i<3;i++){const d=f*detune[i]/SR;phases[i]=(phases[i]+d)%1;x+=saw(phases[i],d)/3;}lo+=(brass?.13:.24)*(x-lo);const trem=e.tremolo?.65+.35*Math.sin(TAU*t/(BEAT/2)+(e.rotate??0)*.6)**2:1;return (lo*.88+Math.sin(TAU*phases[1])*(brass?.28:.07))*envelope(t,e.slow?.28:brass?.028:.11)*trem;};break;
    }
    case 'war':
      room=.24;render=t=>{phase+=TAU*f*(1+.35*Math.exp(-t*28))/SR;lo+=.09*(noise()-lo);return (Math.sin(phase)*.91+Math.sin(phase*1.53)*.15+lo*.25)*Math.exp(-t*9)*envelope(t,.001);};break;
    case 'frame':
      room=.14;render=t=>{const w=noise();lo+=.18*(w-lo);hi+=.62*(w-hi);return ((Math.sin(TAU*151*t)*.55+Math.sin(TAU*233*t)*.20)*Math.exp(-t*23)+(hi-lo)*.57*Math.exp(-t*38))*envelope(t,.001);};break;
    case 'metal':case 'sfx-metal': {
      room=.20;const base=e.kind==='metal'?1220:e.cueKind==='metal'?1860:e.cueKind==='shield'?760:1340;
      render=t=>(Math.sin(TAU*base*t)*.58+Math.sin(TAU*base*1.437*t)*.25+Math.sin(TAU*base*2.113*t)*.13)*Math.exp(-t*(e.cueKind==='metal'?12:27))*envelope(t,.001);break;
    }
    case 'bell':case 'sfx-bell':
      room=.30;render=t=>(Math.sin(TAU*f*t+.55*Math.sin(TAU*f*2.003*t)*Math.exp(-t*5))*.75+Math.sin(TAU*f*3.01*t)*.075*Math.exp(-t*8))*Math.exp(-t*2.8)*envelope(t,.008);break;
    case 'wind':
      room=.32;render=t=>{const u=t/total,w=noise(),cut=.009+.045*(.5+.5*Math.sin(TAU*u-.7))**2;lo+=cut*(w-lo);hi+=.002*(lo-hi);return (lo-hi)*2.1*(e.surf?.4+.6*Math.sin(Math.PI*u)**2:.8)*envelope(t,.07);};break;
    case 'tension':
      room=.10;render=t=>{const u=clamp(t/total);phase+=TAU*(110+650*u*u)/SR;lo+=.12*(noise()-lo);return (Math.sin(phase)*.32+Math.sin(phase*1.005)*.20+lo*.20)*(.25+.75*u)*envelope(t,.03);};break;
    case 'sfx-arrow':case 'sfx-whoosh':case 'sfx-rise': {
      room=.08;render=t=>{const u=clamp(t/total),w=noise();lo+=(.03+.45*(1-u))*(w-lo);hi+=.018*(lo-hi);phase+=TAU*(e.kind==='sfx-rise'?80+450*u*u:140+1500*(1-u)**3)/SR;return ((lo-hi)*.75+Math.sin(phase)*.18)*(e.kind==='sfx-rise'?.2+.8*u:(1-u)**1.5)*envelope(t,.003);};break;
    }
    case 'sfx-sub':case 'sfx-impact':
      room=.09;render=t=>{phase+=TAU*(39+72*Math.exp(-t*35))/SR;lo+=.1*(noise()-lo);return (Math.sin(phase)*.85+lo*(e.kind==='sfx-impact'?.65:.08))*Math.exp(-t*7)*envelope(t,.002);};break;
    case 'sfx-stone':case 'sfx-crack':case 'sfx-surf':
      room=.18;render=t=>{const w=noise();lo+=(e.kind==='sfx-crack'?.35:.055)*(w-lo);hi+=.004*(lo-hi);const grains=.65+.35*Math.sin(TAU*37*t)*Math.sin(TAU*53*t);return (lo-hi)*grains*2*Math.exp(-t*(e.kind==='sfx-surf'?3:8))*envelope(t,.001);};break;
    case 'sfx-wood':case 'sfx-pluck':
      room=.09;render=t=>(Math.sin(TAU*(e.kind==='sfx-wood'?410:220)*t)*.65+Math.sin(TAU*697*t)*.24)*Math.exp(-t*29)*envelope(t,.001);break;
    default: throw new Error(`Unknown DSP ${e.kind}`);
  }
  return {...e,index,render,room,end:e.sample+e.frames,left:Math.cos((e.pan+1)*Math.PI/4)*e.gain,right:Math.sin((e.pan+1)*Math.PI/4)*e.gain,firstNonzero:null};
}

function wavHeader(frames) {
  const b=Buffer.alloc(44),size=frames*8;b.write('RIFF');b.writeUInt32LE(size+36,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(3,20);b.writeUInt16LE(2,22);b.writeUInt32LE(SR,24);b.writeUInt32LE(SR*8,28);b.writeUInt16LE(8,32);b.writeUInt16LE(32,34);b.write('data',36);b.writeUInt32LE(size,40);return b;
}
export function holdGain(sample) {
  let g=1;
  for(const h of HOLDS) {
    const a=Math.round(h.start*SR),b=Math.round(h.end*SR),edge=Math.round(.008*SR);
    if(sample>=a&&sample<b) return 0;
    if(sample>=a-edge&&sample<a) g*=1-smooth((sample-a+edge)/edge);
    if(sample>=b&&sample<b+edge) g*=smooth((sample-b)/edge);
  }return g;
}
export function renderScore(path,score) {
  const ml=new Float32Array(BAR_SAMPLES),mr=new Float32Array(BAR_SAMPLES),sl=new Float32Array(BAR_SAMPLES),sr=new Float32Array(BAR_SAMPLES),sendL=new Float32Array(BAR_SAMPLES),sendR=new Float32Array(BAR_SAMPLES),pcm=Buffer.alloc(BAR_SAMPLES*8);
  const combs=[.0371,.0437,.0593,.0719].map((t,i)=>({l:new Float32Array(Math.round(t*SR)),r:new Float32Array(Math.round((t+.0053)*SR)),il:0,ir:0,ll:0,rr:0,feedback:.66-i*.02}));
  const clear=()=>{for(const c of combs){c.l.fill(0);c.r.fill(0);c.ll=c.rr=0;}};
  const cuts=new Set([HOLDS[0].start,HOLDS[0].end,CHAPTERS[9].start,CHAPTERS[11].start,CHAPTERS[13].start].map(t=>Math.round(t*SR)));
  const allOnsets=[],sfx=score.events.filter(e=>e.role==='sfx').map(e=>({id:e.cueId,kind:e.cueKind,sample:e.sample,frames:e.frames,firstNonzeroSample:null,sum:0,peak:0,musicSum:0}));
  const sfxById=new Map(sfx.map(s=>[s.id,s]));let cursor=0,active=[],peak=0,maxVoices=0,prevL=0,prevR=0,dcL=0,dcR=0;
  const fd=openSync(path,'w');
  try {
    writeSync(fd,wavHeader(FRAMES));
    for(let block=0;block<108;block++) {
      const start=block*BAR_SAMPLES,end=start+BAR_SAMPLES;for(const b of [ml,mr,sl,sr,sendL,sendR]) b.fill(0);
      while(cursor<score.events.length&&score.events[cursor].sample<end){active.push(voice(score.events[cursor],cursor));cursor++;}
      maxVoices=Math.max(maxVoices,active.length);
      for(const v of active) {
        const proof=v.role==='sfx'?sfxById.get(v.cueId):null;
        for(let n=Math.max(start,v.sample);n<Math.min(end,v.end);n++) {
          const k=n-start,value=v.render((n-v.sample)/SR);check(Number.isFinite(value),`Nonfinite ${v.id} at ${n}`);
          if(v.firstNonzero===null&&Math.abs(value)>1e-12){v.firstNonzero=n;allOnsets.push({id:v.id,scheduledSample:v.sample,firstNonzeroSample:n,section:v.section});if(proof)proof.firstNonzeroSample=n;}
          const l=value*v.left,r=value*v.right;
          if(proof){sl[k]+=l;sr[k]+=r;proof.sum+=l*l+r*r;proof.peak=Math.max(proof.peak,Math.abs(l),Math.abs(r));}else{ml[k]+=l;mr[k]+=r;}
          sendL[k]+=l*v.room;sendR[k]+=r*v.room;
        }
      }
      for(const cue of sfx) for(let n=Math.max(start,cue.sample);n<Math.min(end,cue.sample+cue.frames);n++){const k=n-start;cue.musicSum+=ml[k]**2+mr[k]**2;}
      active=active.filter(v=>v.end>end);
      for(let k=0;k<BAR_SAMPLES;k++) {
        const n=start+k,t=n/SR;if(cuts.has(n)){clear();prevL=prevR=dcL=dcR=0;}
        let wetL=0,wetR=0;
        for(const c of combs){const l=c.l[c.il],r=c.r[c.ir];c.ll+=.22*(l-c.ll);c.rr+=.22*(r-c.rr);c.l[c.il]=sendL[k]+c.ll*c.feedback;c.r[c.ir]=sendR[k]+c.rr*c.feedback;c.il=(c.il+1)%c.l.length;c.ir=(c.ir+1)%c.r.length;wetL+=l*.25;wetR+=r*.25;}
        const l=ml[k]+sl[k]+wetL*.62,r=mr[k]+sr[k]+wetR*.62;
        dcL=l-prevL+.9992*dcL;dcR=r-prevR+.9992*dcR;prevL=l;prevR=r;
        let g=smooth(t/.012)*holdGain(n)*(1-smooth((t-178.5)/1.5));
        // Remove ALL inherited drum returns at the quiet-dialogue edit, with an 8ms edge.
        const rootSample=CHAPTERS[13].startBeat*SPB;
        if(n>=rootSample-384&&n<rootSample)g*=1-smooth((n-rootSample+384)/384);
        if(n>=rootSample&&n<rootSample+384)g*=smooth((n-rootSample)/384);
        const a=dcL*g,b=dcR*g;peak=Math.max(peak,Math.abs(a),Math.abs(b));pcm.writeFloatLE(a,k*8);pcm.writeFloatLE(b,k*8+4);
      }
      writeSync(fd,pcm);
      if(CHAPTERS.some(c=>c.endBeat*SPB===end))console.log(`Synthesized ${round(end/SR)}s / ${block+1} of 108 bars`);
    }
  } finally {closeSync(fd);}
  check(allOnsets.length===score.events.length,`Rendered ${allOnsets.length}/${score.events.length} events`);
  const cueProof=sfx.map(({sum,musicSum,peak,...s})=>({...s,scheduledTime:s.sample/SR,firstNonzeroTime:s.firstNonzeroSample/SR,onsetErrorSamples:s.firstNonzeroSample-s.sample,
    rmsDbFS:round(db(Math.sqrt(sum/(2*s.frames)))),peakDbFS:round(db(peak)),musicRmsDbFS:round(db(Math.sqrt(musicSum/(2*s.frames)))),sfxOverMusicDb:round(10*Math.log10(sum/Math.max(1e-25,musicSum)))}));
  for(const s of cueProof)check(s.firstNonzeroSample!==null&&s.onsetErrorSamples<=8&&s.sfxOverMusicDb<=-6,`SFX onset/level ${s.id}: ${JSON.stringify(s)}`);
  return {frames:FRAMES,blockFrames:BAR_SAMPLES,allocatedMixBufferBytes:BAR_SAMPLES*6*4+pcm.length,maxVoices,rawPeak:round(peak),renderedEvents:allOnsets.length,
    maxOnsetErrorSamples:Math.max(...allOnsets.map(e=>e.firstNonzeroSample-e.scheduledSample)),cueProof,
    chapterOnsets:CHAPTERS.map((c,i)=>({id:c.id,scheduledSample:c.startBeat*SPB,firstDrySample:Math.min(...allOnsets.filter(e=>e.section===i).map(e=>e.firstNonzeroSample))})),
    sfxProofScope:'Actual isolated dry DSP onset and energy against simultaneous music before mastering; encoded onset localization cannot isolate a sound inside a composite mix.'};
}

function run(exe,args) {const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});check(!r.error&&r.status===0,`${r.error?.message??`Exit ${r.status}`}: ${r.stderr?.slice(-4000)}`);return r;}
export function getTools() {
  const ffmpeg='C:\\Users\\kukisama\\AppData\\Roaming\\Python\\Python312\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe',ffprobe=require('ffprobe-static').path;
  check(existsSync(ffmpeg)&&existsSync(ffprobe),'FFmpeg / ffprobe missing');return {ffmpeg,ffprobe};
}
const ff=(tools,args)=>run(tools.ffmpeg,['-hide_banner','-nostdin','-v','error','-y',...args]);
export const probe=(tools,path)=>JSON.parse(run(tools.ffprobe,['-v','error','-show_streams','-show_format','-of','json',path]).stdout);
export function loudness(tools,path) {
  // R128 measurement ONLY. Its output is discarded; no loudnorm audio enters the master.
  const r=run(tools.ffmpeg,['-hide_banner','-nostdin','-i',path,'-af','loudnorm=I=-12.2:TP=-2.4:LRA=15:print_format=json','-f','null','-']);
  const match=r.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);check(match,'Missing R128 measurement');const m=JSON.parse(match[0]);
  check(Number.isFinite(+m.input_i)&&Number.isFinite(+m.input_tp),'Invalid R128');return {LUFS:+m.input_i,truePeakDbTP:+m.input_tp,loudnessRangeLU:+m.input_lra};
}
const accumulator=()=>({frames:0,l:0,r:0,cross:0,side:0,peak:0,clipping:0,nonfinite:0,nonzero:0});
function accumulate(a,l,r){a.frames++;a.l+=l*l;a.r+=r*r;a.cross+=l*r;a.side+=(l-r)**2;a.peak=Math.max(a.peak,Math.abs(l),Math.abs(r));if(Math.abs(l)>=1)a.clipping++;if(Math.abs(r)>=1)a.clipping++;if(!Number.isFinite(l)||!Number.isFinite(r))a.nonfinite++;if(l!==0||r!==0)a.nonzero++;}
const metrics=a=>{check(a.frames>0,'Empty analysis interval');return {frames:a.frames,rmsDbFS:round(db(Math.sqrt((a.l+a.r)/(2*a.frames)))),leftRmsDbFS:round(db(Math.sqrt(a.l/a.frames))),rightRmsDbFS:round(db(Math.sqrt(a.r/a.frames))),peakDbFS:round(db(a.peak)),clipping:a.clipping,nonfinite:a.nonfinite,nonzeroFrames:a.nonzero,correlation:round(a.cross/Math.max(1e-25,Math.sqrt(a.l*a.r))),sideRmsDbFS:round(db(Math.sqrt(a.side/a.frames)/2))};};

export async function scanPCM(tools,path) {
  const child=spawn(tools.ffmpeg,['-hide_banner','-nostdin','-v','error','-xerror','-i',path,'-map','0:a:0','-f','f32le','-c:a','pcm_f32le','-'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stderr='',failure;child.stderr.on('data',b=>stderr=(stderr+b.toString()).slice(-4000));
  const done=new Promise(res=>{child.on('error',e=>{failure=e;res(-1);});child.on('close',res);});
  const total=accumulator(),scenes=CHAPTERS.map(()=>accumulator()),openings=CHAPTERS.map(()=>accumulator()),hashes=CHAPTERS.map(()=>createHash('sha256'));
  const h=HOLDS[0],windows=[{id:'holdFull',start:h.start,end:h.end},{id:'holdCore',start:h.start+.025,end:h.end-.025},{id:'holdResume',start:h.end,end:h.end+.20},{id:'fadeStart',start:178.5,end:178.6},{id:'fadeTail',start:179.995,end:180},...ACTION_CUES.map(c=>({id:c.id,start:c.time,end:Math.min(180,c.time+.16)}))].map(w=>({...w,a:Math.round(w.start*SR),b:Math.round(w.end*SR),data:accumulator()}));
  let frame=0,section=0,rest=Buffer.alloc(0),bin=accumulator(),quietStart=null;const quietRuns=[];
  const finishBin=end=>{const quiet=metrics(bin).rmsDbFS< -58;if(quiet&&quietStart===null)quietStart=end-bin.frames;if(!quiet&&quietStart!==null){if(end-bin.frames-quietStart>=SR*.1)quietRuns.push({start:quietStart/SR,end:(end-bin.frames)/SR});quietStart=null;}bin=accumulator();};
  try {
    for await(const chunk of child.stdout) {
      const b=rest.length?Buffer.concat([rest,chunk]):chunk,len=b.length-b.length%8;let hashOffset=0,hashSection=section;
      for(let i=0;i<len;i+=8,frame++) {
        while(section<14&&frame>=CHAPTERS[section].endBeat*SPB)section++;
        if(section!==hashSection){hashes[hashSection].update(b.subarray(hashOffset,i));hashOffset=i;hashSection=section;}
        const l=b.readFloatLE(i),r=b.readFloatLE(i+4);accumulate(total,l,r);accumulate(scenes[section],l,r);accumulate(bin,l,r);
        if(frame<CHAPTERS[section].startBeat*SPB+SR*.16)accumulate(openings[section],l,r);
        for(const w of windows)if(frame>=w.a&&frame<w.b)accumulate(w.data,l,r);
        if(bin.frames===480)finishBin(frame+1);
      }
      hashes[hashSection].update(b.subarray(hashOffset,len));rest=Buffer.from(b.subarray(len));
    }
  }catch(error){child.kill();await done;throw error;}
  const status=await done;check(!failure&&status===0,`Decode error: ${failure?.message??stderr}`);check(rest.length===0&&frame===FRAMES,`Decoded ${frame}/${FRAMES} frames`);
  if(bin.frames)finishBin(frame);if(quietStart!==null&&frame-quietStart>=SR*.1)quietRuns.push({start:quietStart/SR,end:frame/SR});
  return {decodedFrames:frame,decodedDuration:frame/SR,...metrics(total),sceneEnergy:scenes.map((s,i)=>({id:CHAPTERS[i].id,start:CHAPTERS[i].start,end:CHAPTERS[i].end,...metrics(s),opening160msRmsDbFS:metrics(openings[i]).rmsDbFS,pcmSha256:hashes[i].digest('hex')})),windows:Object.fromEntries(windows.map(w=>[w.id,metrics(w.data)])),quietRuns};
}

export function assertSignal(scan,measure,{archive=false}={}) {
  check(measure.LUFS>=-13&&measure.LUFS<=-11.5&&measure.truePeakDbTP<=-1.5,`Loudness/peak: ${JSON.stringify(measure)}`);
  check(scan.clipping===0&&scan.nonfinite===0,`Invalid PCM: clips=${scan.clipping}, nonfinite=${scan.nonfinite}`);
  check(scan.correlation>-.05&&scan.correlation<.985&&scan.sideRmsDbFS> -35&&Math.abs(scan.leftRmsDbFS-scan.rightRmsDbFS)<4,`Stereo correlation=${scan.correlation}, side=${scan.sideRmsDbFS}, L/R=${scan.leftRmsDbFS}/${scan.rightRmsDbFS}`);
  for(const s of scan.sceneEnergy)check(s.rmsDbFS> -42&&s.leftRmsDbFS> -46&&s.rightRmsDbFS> -46&&s.opening160msRmsDbFS> -48,`Empty act ${JSON.stringify(s)}`);
  const energy=Object.fromEntries(scan.sceneEnergy.map(s=>[s.id,s.rmsDbFS])),contrast=Math.max(...Object.values(energy))-Math.min(...Object.values(energy));
  check(contrast>=6&&energy.hall-energy.root>=6&&energy.strait-energy.drift>=6,`Dynamic contrast=${contrast}, hall/root=${energy.hall-energy.root}, strait/drift=${energy.strait-energy.drift}`);
  check(scan.windows.holdCore.rmsDbFS< -85&&scan.windows.holdFull.rmsDbFS< -60&&scan.windows.holdResume.rmsDbFS> -42,`Hold/resume ${JSON.stringify(scan.windows.holdFull)} / ${scan.windows.holdCore.rmsDbFS} / ${scan.windows.holdResume.rmsDbFS}`);
  if(archive)check(scan.windows.holdFull.nonzeroFrames===0,'Archive hold must contain exactly 20,000 all-zero stereo frames');
  check(scan.windows.fadeTail.peakDbFS< -70&&scan.windows.fadeStart.rmsDbFS-scan.windows.fadeTail.rmsDbFS>35,`Fade ${JSON.stringify(scan.windows.fadeTail)}`);
  check(scan.quietRuns.every(q=>(q.start>=HOLDS[0].start-.02&&q.end<=HOLDS[0].end+.025)||q.start>=178.5),`Unintended long silence ${JSON.stringify(scan.quietRuns)}`);
  check(new Set(scan.sceneEnergy.map(s=>s.pcmSha256)).size===15,'Repeated decoded chapter PCM');
  for(const c of ACTION_CUES)check(scan.windows[c.id].rmsDbFS> -48,`No master energy at ${c.id}`);
  return {quietLoudContrastDb:round(contrast),hallOverRootDb:round(energy.hall-energy.root),straitOverDriftDb:round(energy.strait-energy.drift)};
}

export async function verify(tools,report,directory=AUDIO_DIR) {
  contract();const score=buildScore();
  check(report.title===TITLE&&report.duration===180&&report.bpm===144&&report.beats===432&&report.bars===108&&report.noVoice===true&&report.music.original===true,'Score identity mismatch');
  check(report.storysha256===sha(STORY),'Story changed; regenerate');check(report.generatorSha256===sha(SELF),'Generator changed; regenerate');
  check(report.music.eventSha256===score.eventSha256&&JSON.stringify(report.music.sections)===JSON.stringify(score.sections),'Arrangement mismatch');
  check(JSON.stringify(report.music.cues)===JSON.stringify(CUES)&&JSON.stringify(report.music.bars)===JSON.stringify(score.bars),'Shared cues/bars mismatch');
  check(report.eventsSha256===sha(join(directory,'events.json'))&&JSON.stringify(JSON.parse(readFileSync(join(directory,'events.json'),'utf8')))!==undefined,'Event file hash mismatch');
  check(JSON.stringify(JSON.parse(readFileSync(join(directory,'events.json'),'utf8')))==JSON.stringify(score.events),'Stale event program');
  check(report.processing.adaptiveLoudnessGain===false&&report.processing.masterBitReduction===false&&report.processing.externalSamples===false&&report.processing.TTS===false,'Invalid mastering/provenance');
  const file=join(directory,'master.mp3');check(report.mastersha256===sha(file),'MP3 hash mismatch');check(report.archiveSha256===sha(join(directory,'master.wav')),'Archive hash mismatch');
  const info=probe(tools,file),s=info.streams[0],padding=Number(info.format.duration)-180,tags=info.format.tags;
  check(info.streams.length===1&&s.codec_name==='mp3'&&s.channels===2&&+s.sample_rate===SR&&+s.bit_rate===256000,'MP3 format mismatch');
  check(padding>=0&&padding<.04,`Gapless container padding ${padding}`);
  check(tags.title===TITLE&&tags.comment===COMMENT&&tags.story_sha256===report.storysha256&&tags.generator_sha256===report.generatorSha256&&tags.no_voice==='true','MP3 provenance tags mismatch');
  const scan=await scanPCM(tools,file),measure=loudness(tools,file),dynamics=assertSignal(scan,measure);
  return {...scan,...measure,...dynamics,sampleRate:SR,channels:2,bitrate:256000,metadataDuration:+info.format.duration,metadataPaddingSeconds:round(padding),
    eventGrid:{samplesPerBeat:SPB,samplesPerBar:BAR_SAMPLES,bars:108,beats:432,shots:54,actions:30,events:score.events.length,offGridEvents:0}};
}

function normalize(tools,source,dest,inputLUFS,target,ceiling) {
  const fixedGain=target-inputLUFS,limit=10**(ceiling/20),h=HOLDS[0],a=Math.round(h.start*SR),b=Math.round(h.end*SR),edge=384;
  const cubic=x=>`((${x})*(${x})*(3-2*(${x})))`;
  const gain=`if(between(n,${a},${b-1}),0,if(between(n,${a-edge},${a-1}),1-${cubic(`(n-${a-edge})/${edge}`)},if(between(n,${b},${b+edge-1}),${cubic(`(n-${b})/${edge}`)},1)))`;
  // Exact sample gating AFTER every IIR/resampler/limiter, including all room and SFX.
  const filter=`aresample=${SR*4},volume=${fixedGain}dB,alimiter=limit=${limit}:attack=3:release=80:level=false:latency=true,aresample=${SR},apad=whole_len=${FRAMES},atrim=end_sample=${FRAMES},aeval='val(0)*${gain}|val(1)*${gain}'`;
  ff(tools,['-i',source,'-af',filter,'-ar',String(SR),'-ac','2','-c:a','pcm_s24le',dest]);return round(fixedGain);
}
function publish(work,names) {
  const committed=[],backups=[];
  try {for(const name of names){const dest=join(AUDIO_DIR,name),backup=join(work,`previous-${name}`);if(existsSync(dest)){renameSync(dest,backup);backups.push({dest,backup});}renameSync(join(work,name),dest);committed.push(dest);}}
  catch(error){for(const dest of committed.reverse())rmSync(dest,{force:true});for(const b of backups.reverse())renameSync(b.backup,b.dest);throw error;}
}
const summary=r=>({passed:r.validation.passed,files:['master.mp3','master.wav','events.json','report.json'].map(f=>join(AUDIO_DIR,f)),duration:r.master.decodedDuration,frames:r.master.decodedFrames,LUFS:r.master.LUFS,truePeakDbTP:r.master.truePeakDbTP,dynamicContrastDb:r.master.quietLoudContrastDb,hallOverRootDb:r.master.hallOverRootDb,correlation:r.master.correlation,sideRmsDbFS:r.master.sideRmsDbFS,holdCoreDbFS:r.master.windows.holdCore.rmsDbFS,holdWholeBeatDbFS:r.master.windows.holdFull.rmsDbFS,fadeTailPeakDbFS:r.master.windows.fadeTail.peakDbFS,actions:r.music.render.cueProof.length,maxSfxOnsetErrorSamples:Math.max(...r.music.render.cueProof.map(c=>c.onsetErrorSamples)),largestSfxOverMusicDb:Math.max(...r.music.render.cueProof.map(c=>c.sfxOverMusicDb)),chapters:r.master.sceneEnergy.map(s=>({id:s.id,rmsDbFS:s.rmsDbFS}))});
export async function main() {
  contract();const tools=getTools();
  if(process.argv.includes('--verify')) {
    const report=JSON.parse(readFileSync(join(AUDIO_DIR,'report.json'),'utf8')),fresh=await verify(tools,report);
    check(report.validation.passed===true&&JSON.stringify(fresh)===JSON.stringify(report.master),'Stale published measurements');
    console.log(JSON.stringify(summary(report),null,2));return report;
  }
  mkdirSync(AUDIO_DIR,{recursive:true});const storyHash=sha(STORY),generatorHash=sha(SELF),work=mkdtempSync(join(AUDIO_DIR,'.stage-'));
  try {
    const score=buildScore();json(join(work,'events.json'),score.events);
    const render=renderScore(join(work,'premaster.wav'),score);
    ff(tools,['-i',join(work,'premaster.wav'),'-af','highpass=f=27,lowpass=f=16500','-c:a','pcm_f32le',join(work,'prepared.wav')]);
    const sourceMeasure=loudness(tools,join(work,'prepared.wav'));let target=-12.08,ceiling=-2.4,fixedGain,encoded;const attempts=[];
    for(let attempt=0;attempt<3;attempt++) {
      fixedGain=normalize(tools,join(work,'prepared.wav'),join(work,'master.wav'),sourceMeasure.LUFS,target,ceiling);
      ff(tools,['-i',join(work,'master.wav'),'-map_metadata','-1','-c:a','libmp3lame','-b:a','256k','-ar',String(SR),'-ac','2','-write_xing','1','-id3v2_version','3','-metadata',`title=${TITLE}`,'-metadata',`comment=${COMMENT}`,'-metadata',`story_sha256=${storyHash}`,'-metadata',`generator_sha256=${generatorHash}`,'-metadata','no_voice=true','-metadata','bpm=144',join(work,'master.mp3')]);
      encoded=loudness(tools,join(work,'master.mp3'));attempts.push({attempt:attempt+1,target:round(target),ceiling:round(ceiling),fixedGainDb:fixedGain,...encoded});console.log(`Master ${attempt+1}: ${encoded.LUFS} LUFS / ${encoded.truePeakDbTP} dBTP`);
      if(encoded.LUFS>=-13&&encoded.LUFS<=-11.5&&encoded.truePeakDbTP<=-1.5&&Math.abs(encoded.LUFS+12.2)<.18)break;
      target+=clamp(-12.2-encoded.LUFS,-1.5,1.5);if(encoded.truePeakDbTP> -1.5)ceiling-=encoded.truePeakDbTP+1.8;
    }
    const report={title:TITLE,film:FILM_TITLE,duration:180,bpm:144,beats:432,bars:108,shots:54,noVoice:true,sampleRate:SR,
      storysha256:storyHash,generatorSha256:generatorHash,mastersha256:sha(join(work,'master.mp3')),archiveSha256:sha(join(work,'master.wav')),eventsSha256:sha(join(work,'events.json')),
      music:{original:true,noVoice:true,seed:SEED,expedition:{key:'A Dorian',bars:8,notes:EXPEDITION},home:{key:'A minor → A major',bars:4,notes:HOME},sections:score.sections,bars:score.bars,cues:CUES,eventSha256:score.eventSha256,eventCount:score.events.length,render,
        synthesis:'Deterministic polyBLEP pulse, additive triangle, fractional-delay digital lyra, detuned low brass and tremolo strings, FM bells, mathematical drum/metal/noise/SFX. No borrowed musical material.',eventsFile:'events.json'},
      processing:{externalSamples:false,TTS:false,masterBitReduction:false,adaptiveLoudnessGain:false,drumSidechain:false,targetLUFS:-12.2,allowedLUFS:[-13,-11.5],encodedPeakLimitDbTP:-1.5,fixedGainDb:fixedGain,sourceMeasure,attempts,
        signalChain:'Bar-streamed float32 -> 27Hz HP/16.5kHz LP -> measured FIXED gain -> stereo-linked 192kHz limiter (level=false, latency=true) -> 48kHz -> sample-exact full-bus hold -> 24bit WAV -> 256k gapless MP3',limiter:{oversampling:4,attackMs:3,releaseMs:80,latencyCompensated:true,level:false,stereoLinked:true},fade:{start:178.5,end:180},hold:{source:'story.HOLDS',edgeRampMs:8}},
      provenance:{createdAt:new Date().toISOString(),sources:'Only score.mjs mathematics and story.mjs shared markers; no network, samples, narration, voice clone, film score recording or transcription.',engineering:'Streaming PCM, fractional delay and fixed-gain measurement techniques adapted from local rdr2 DSP; all pitches, motifs, rhythmic forms and section arrangements newly authored.'},
      delivery:{file:'master.mp3',relativeURL:'audio/master.mp3',archive:'master.wav',archiveExported:false,playback:'Standard gapless MP3 for native audio playback; no generated video or HTML.'}};
    report.master=await verify(tools,report,work);
    const archiveInfo=probe(tools,join(work,'master.wav')).streams[0];check(archiveInfo.codec_name==='pcm_s24le'&&archiveInfo.channels===2&&+archiveInfo.sample_rate===SR,'Archive must be 24bit stereo 48kHz');
    const archiveScan=await scanPCM(tools,join(work,'master.wav')),archiveMeasure=loudness(tools,join(work,'master.wav'));
    report.archive={...archiveScan,...archiveMeasure,...assertSignal(archiveScan,archiveMeasure,{archive:true})};
    report.validation={passed:true,stagedBeforePublication:true,checkedAt:new Date().toISOString(),checks:['180s full MP3 and 24bit WAV decode','8,640,000 stereo frames','fresh EBU R128 / oversampled true peak for both files','zero clipping/nonfinite','stereo width','15 unique musical structure hashes excluding gain','15 unique decoded chapter hashes','all 30 action cue DSP onsets within 8 samples','all local SFX at least 6dB below concurrent dry music','exact 20,000 zero stereo frames in archive hold','MP3 hold core below -85dBFS, full beat below -60dBFS','no unintended >=100ms silence','>=6dB act and climax/quiet contrast','no drum voices or room memory at root','tail peak below -70dBFS','story/generator/events/archive/master hashes'],scope:'Computed signal and provenance verification, NOT a claim of listening or artistic approval.'};
    check(storyHash===sha(STORY)&&generatorHash===sha(SELF),'Inputs changed while synthesizing; refusing publication');
    check(report.mastersha256===sha(join(work,'master.mp3'))&&report.archiveSha256===sha(join(work,'master.wav'))&&report.eventsSha256===sha(join(work,'events.json')),'Staged outputs changed');
    json(join(work,'report.json'),report);publish(work,['master.wav','master.mp3','events.json','report.json']);console.log(JSON.stringify(summary(report),null,2));return report;
  }finally{rmSync(work,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===SELF)main().catch(error=>{console.error(error.stack);process.exitCode=1;});