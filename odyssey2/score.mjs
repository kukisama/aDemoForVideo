/** EMPTY STRING — original demonstration music + mathematical action SFX.
 * NOT a film-theme arrangement. No film recording or transcription supplied.
 * node odyssey2/score.mjs [--verify]; only writes odyssey2/audio/**.
 * Does not import or execute any old score/build/player.
 */
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,statSync,renameSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TITLE as FILM_TITLE,DURATION,BPM,BEAT,BAR,STAGES,EVENTS} from './timeline.mjs';

const require=createRequire(new URL('../web/package.json',import.meta.url));
export const SELF=fileURLToPath(import.meta.url);
export const TIMELINE=fileURLToPath(new URL('./timeline.mjs',import.meta.url));
export const AUDIO_DIR=fileURLToPath(new URL('./audio/',import.meta.url));
export const SR=48000,FRAMES=1440000,SPB=22500,BAR_FRAMES=90000;
export const SOUND_MODE='original-demo-not-film-theme';
export const NOTICE='原创演示底轨 + SFX；未提供原片音源，电影主题变奏尚未制作。不声称官方配乐或可辨认的电影主题。';
export const SEED=0x4c595241;
export const LOCKED_EVENTS=[
  ['first-string',6,'pluck'],['first-parry',12,'parry'],['dash-launch',17,'dash'],
  ['counter-cut',19,'slash'],['second-parry',21,'parry'],['heavy-ground',27,'ground'],
  ['slide-turn',30,'slide'],['rising-cut',34,'launch'],['air-cross',36,'slash'],
  ['hero-landing',41,'land'],['turning-cut',43,'slash'],['weapon-fall',46,'metal'],
  ['empty-string',54,'release'],['far-rings',56,'resonate'],
];
const TAU=2*Math.PI;
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const hz=m=>440*2**((m-69)/12);
const db=x=>20*Math.log10(Math.max(1e-12,x));
const round=x=>Math.round(x*1e6)/1e6;
export const digest=data=>createHash('sha256').update(data).digest('hex');
export const sha=path=>digest(readFileSync(path));
const json=(path,data)=>writeFileSync(path,JSON.stringify(data,null,2)+'\n');
const randomFor=seed=>{let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296*2-1;};};
const bytes=pcm=>Buffer.from(pcm.buffer,pcm.byteOffset,pcm.byteLength);

export function contract(){
  check(DURATION===30&&BPM===128&&BEAT===.46875&&BAR===1.875,'Timeline tempo/duration changed');
  check(SPB===SR*BEAT&&BAR_FRAMES===SPB*4&&FRAMES===DURATION*SR,'Invalid sample clock');
  check(STAGES.length===8&&EVENTS.length===14,'Requires exactly eight stages and fourteen events');
  const ids=['string','guard','counter','evade','rise','land','draw','release'];
  STAGES.forEach((s,i)=>check(s.id===ids[i]&&s.start===i*3.75&&s.end===(i+1)*3.75,`Stage moved: ${s.id}`));
  LOCKED_EVENTS.forEach(([id,beat,kind],i)=>{
    const e=EVENTS[i];check(e.id===id&&e.beat===beat&&e.kind===kind&&e.time===beat*BEAT,`Event moved: ${id}`);
    check(Number.isInteger(e.time*SR)&&e.time*SR===beat*SPB,`Fractional event sample: ${id}`);
  });
  check(EVENTS[12].time===25.3125&&EVENTS[12].time*SR===1215000,'Empty-string release moved');
  return true;
}

// Two original, short melodic statements. No melody was obtained from a film.
export const THEMES=[
  {id:'question',startBeat:0,notes:[[0,62,2.7],[1.5,69,2.2],[3,65,2.6],[5,64,2.8],[7,62,2.3]]},
  {id:'answer',startBeat:32,notes:[[0,74,1.8],[2,69,1.5],[3.5,72,1.7],[5,70,1.8],[7,69,2.2]]},
];
export const BAR_PLAN=[
  ['D minor / open fifth','Exposed lyra question; overlapping natural decays, no bed'],
  ['D–A–E','Last two solo notes and open-string overtones; no percussion'],
  ['D5','Low strings enter under skin drum 3+3+2; no chip lead'],
  ['Bb/D','Viola suspension, darker bass and a wood-frame reply'],
  ['Dm(add9)','Brief pulse shards and low orchestral stabs answer the dash'],
  ['C(sus2)','Fewer drums; mid-register response, not a repeated lead'],
  ['Bb/D','Missing downbeat; skin/body impacts and descending inner strings'],
  ['A(sus4)','Offbeat frame taps, held tension and a breath before lift'],
  ['Dm','Second short melody, higher lyra and low strings, rising action accents'],
  ['F6/9','Melody falls through Bb to A; airy upper strings, shorter drum tail'],
  ['Bb/A','Turning stabs, sparse pulse, asymmetrical skin/wood replies'],
  ['D5','Single low accent, then sustained strings; percussion removed at 22.5s'],
  ['D/Eb tension','Very quiet bowed-string tension; no drum, pulse or orchestral strike'],
  ['D/A open','Tension until beat 54; open-string plucks and sympathetic resonance'],
  ['D/A/E harmonics','Far string harmonics, low-pitched spatial resonance, no melody loop'],
  ['D5 with ninth','Unanswered open fifth; broad stereo decay with terminal fade'],
];
export const STAGE_NOTES=[
  '里拉琴独奏，以真实计算的延迟弦与空弦泛音留出间隙；没有铺底与鼓。',
  '低弦进入，皮膜古战鼓以八分音符3+3+2重音，木框答句。',
  '短pulse碎片与低铜管/弦乐冲击；没有连续芯片主题循环。',
  '抽掉强拍，低弦下行、木框错位与衣物/土层声音分开。',
  '第二次短旋律提高音区，泛音与弦乐呼应腾空；不是第一段换音量。',
  '回身用短合奏回应，末小节减法撤鼓，所有鼓和鼓混响止于22.5秒。',
  '22.5至25.3125秒极轻弦张力；放弦后由空弦与低脉冲接住，不用激光扫频。',
  '相隔的弦模态泛音、宽立体声尾音；不再恢复鼓阵与旋律循环。',
];
export const SFX_CONFIG={
  'first-string':{material:'bow string / wood bridge',synthesis:'bow-pluck',seconds:1.1,gain:.10,pan:-.40},
  'first-parry':{material:'bronze edge / steel response',synthesis:'bronze',seconds:.62,gain:.095,pan:-.22},
  'dash-launch':{material:'cloth / low air / earth',synthesis:'cloth-dash',seconds:.48,gain:.075,pan:-.50},
  'counter-cut':{material:'cloth / short bronze contact',synthesis:'cloth-cut',seconds:.46,gain:.085,pan:.10},
  'second-parry':{material:'iron blade, shorter/darker body',synthesis:'iron',seconds:.50,gain:.080,pan:.30},
  'heavy-ground':{material:'wood / compact soil / low body',synthesis:'earth-heavy',seconds:.80,gain:.10,pan:-.12},
  'slide-turn':{material:'leather / grit / cloth',synthesis:'grit-slide',seconds:.67,gain:.064,pan:.35},
  'rising-cut':{material:'cloth lift / wood grip / blade',synthesis:'cloth-rise',seconds:.62,gain:.083,pan:.24},
  'air-cross':{material:'two cloth edges / soft metal',synthesis:'cloth-cross',seconds:.58,gain:.077,pan:.48},
  'hero-landing':{material:'soil / leather / hollow wood',synthesis:'earth-land',seconds:.75,gain:.084,pan:-.25},
  'turning-cut':{material:'turning cloth / muted bronze',synthesis:'cloth-turn',seconds:.62,gain:.070,pan:.10},
  'weapon-fall':{material:'three diminishing metal/wood contacts',synthesis:'metal-fall',seconds:1.02,gain:.058,pan:.58},
  'empty-string':{material:'modeled bow string / bridge / sympathetic open strings / low pulse',synthesis:'string-release',seconds:4.60,gain:.14,pan:-.20},
  'far-rings':{material:'far sympathetic string harmonics, no metal bell or laser',synthesis:'string-harmonics',seconds:3.75,gain:.075,pan:.60},
};

export function buildScore(){
  contract();const music=[];
  const add=(kind,beat,midi,beats,gain,pan=0,extra={})=>{
    const sample=Math.round(beat*SPB),frames=Math.min(FRAMES-sample,Math.round(beats*SPB));
    check(Number.isInteger(beat*4)&&frames>0&&gain>0,`Invalid note ${kind}/${beat}`);
    music.push({id:`music-${String(music.length+1).padStart(3,'0')}`,kind,beat,sample,midi,frames,gain,pan,...extra});
  };
  const chord=(kind,beat,notes,beats,gain,extra={})=>notes.forEach((m,i)=>add(kind,beat,m,beats,gain,-.65+i*1.3/Math.max(1,notes.length-1),extra));
  for(const theme of THEMES)for(const [beat,midi,gate]of theme.notes)
    add('lyra',theme.startBeat+beat,midi,gate+.65,theme.id==='question'?.33:.28,theme.id==='question'?-.18:.18,{theme:theme.id});
  // Open-string overtones, still a single exposed plucked instrument in the opening.
  add('harmonic',6.5,57,3.2,.033,.5);
  const roots=[38,34,38,36,34,33,38,41,33,38];
  const voicings=[[50,57,62],[50,58,65],[50,57,64],[48,55,62],[46,53,62],
    [45,57,62],[50,57,65],[53,60,67],[45,58,64],[50,57,62]];
  for(let b=2;b<12;b++){
    const beat=b*4,idx=b-2;
    add('low-string',beat,roots[idx],b===11?4:4.6,b===2?.22:.25,-.16,{section:'low-arc'});
    chord('strings',beat+(b%3===0?.5:0),voicings[idx],b===11?4.4:4.5,b<4?.074:.086,{tremolo:b>=4&&b<10});
  }
  // 3+3+2 is audible in the initial drum phrase. Later bars omit/displace accents.
  const patterns={2:[0,1.5,3],3:[0,1.5,3],4:[0,1.5,3],5:[0,3],6:[1.5,3],
    7:[.5,2.5],8:[0,1.5,3],9:[0,1.5,3],10:[0,1.75,3],11:[0]};
  for(const [bar,pattern]of Object.entries(patterns)){
    const b=Number(bar);
    pattern.forEach((t,i)=>add('war',b*4+t,35+(i%2)*5,1.4,(i===0?.34:.25)*(b===11?.7:1),i%2?.25:-.2,{bus:'drums',accentPattern:b===2||b===3?'3+3+2':'developed'}));
    if(b<11)for(const t of b===7?[1.25,3.5]:b%2?[.75,2.5]:[1,2.75])
      add('frame',b*4+t,55,0.55,.12,t<2?-.55:.48,{bus:'drums'});
  }
  // Short hybrid attacks, not a continually repeating chip melody.
  for(const [beat,midi,pan]of [[16,62,-.4],[17.5,69,.4],[19,65,-.3],[20.75,64,.4],
    [26.5,58,-.4],[28,57,.3],[33,74,-.4],[34.5,69,.4],[36,72,-.3],[38,70,.3],[42,65,-.4],[43.5,64,.4],[46,62,-.2]])
    add('pulse',beat,midi,.35,.087,pan);
  for(const [beat,notes]of [[17,[38,50,57]],[19,[38,53,62]],[21,[36,55,62]],
    [27,[34,50,58]],[34,[38,57,65]],[36,[41,60,67]],[41,[33,57,64]],[43,[38,58,65]]]){
    chord('brass',beat,notes,.72,.105);
    chord('strings',beat,notes.map(n=>n+12),.95,.064,{short:true});
  }
  // Airy overtones instead of another motif/loop.
  chord('harmonic',35,[62,69],5,.056);
  add('lyra',45,50,3.1,.11,-.45);
  // Suspense is deliberately very quiet, but never digitally silent.
  chord('tension',48,[50,51,57],6,.010,{section:'draw'});
  // Release begins precisely at beat 54; the SFX stem carries the physical attack.
  chord('open-string',54,[38,50,57,62],9.8,.098,{section:'release'});
  add('low-resonance',54,38,6,.078,0);
  chord('harmonic',56,[62,69,74],8,.047,{section:'release'});
  const effects=EVENTS.map(e=>({...e,...SFX_CONFIG[e.id],role:'sfx',sample:e.beat*SPB,
    frames:Math.min(FRAMES-e.beat*SPB,Math.round(SFX_CONFIG[e.id].seconds*SR)),source:'timeline.EVENTS'}));
  music.sort((a,b)=>a.sample-b.sample||a.id.localeCompare(b.id));
  const bars=BAR_PLAN.map(([harmony,development],i)=>({bar:i+1,startBeat:i*4,endBeat:i*4+4,start:i*BAR,end:(i+1)*BAR,harmony,development,
    drumAccents:(patterns[i]??[]).map(t=>i*4+t)}));
  const stages=STAGES.map((s,i)=>{
    const notes=music.filter(e=>e.beat>=i*8&&e.beat<(i+1)*8),eventCounts={};
    notes.forEach(e=>eventCounts[e.kind]=(eventCounts[e.kind]??0)+1);
    return {...s,bars:[i*2+1,i*2+2],notes:STAGE_NOTES[i],eventCounts,
      sustainedInstruments:[...new Set(music.filter(e=>e.sample<s.end*SR&&e.sample+e.frames>s.start*SR).map(e=>e.kind))],
      structureSha256:digest(JSON.stringify(notes.map(({gain,id,sample,beat,...e})=>({...e,beat:beat-i*8}))))};
  });
  return {music,effects,bars,stages,eventSha256:digest(JSON.stringify({music,effects}))};
}

// Fractional-delay waveguide with computed excitation and a damped bridge filter.
// No recordings, soundfonts or impulse-response files are read.
function plucked(f,seed,{decay=3,damp=.30,brightness=.45}={}){
  const random=randomFor(seed),period=SR/f-damp/(1-damp),length=Math.ceil(period)+2,line=new Float64Array(length);
  let cursor=0,last=0,low=0,mean=0;
  for(let i=0;i<length;i++){low+=(brightness)*(random()-low);line[i]=low;mean+=low;}
  mean/=length;for(let i=0;i<length;i++)line[i]-=mean;
  const feedback=Math.exp(-Math.log(1000)/(f*decay));
  return t=>{
    let p=cursor-period;if(p<0)p+=length;const a=Math.floor(p),u=p-a;
    const x=line[a]*(1-u)+line[(a+1)%length]*u;
    last=(1-damp)*x+damp*last;line[cursor]=last*feedback;cursor=(cursor+1)%length;
    return x*.78+Math.sin(TAU*f*t)*Math.exp(-t*2.5/decay)*.20
      +Math.sin(TAU*f*2.002*t)*Math.exp(-t*5/decay)*.055;
  };
}
function blep(p,d){if(p<d){const t=p/d;return 2*t-t*t-1;}if(p>1-d){const t=(p-1)/d;return t*t+2*t+1;}return 0;}
const saw=(p,d)=>2*p-1-blep(p,d);

export function synthMusic(e,index){
  const random=randomFor(SEED^Math.imul(index+1,0x9e3779b1)),f=hz(e.midi),seconds=e.frames/SR;
  const mono=new Float32Array(e.frames),pluck=plucked(f,SEED+index*7919,{decay:e.kind==='open-string'?6:3.8});
  let phase=0,phase2=.19,low=0,noiseLow=0;
  for(let n=0;n<e.frames;n++){
    const t=n/SR,tail=1-smooth((t-seconds+.09)/.09);let x=0,attack=.015;
    switch(e.kind){
      case 'lyra':case 'open-string':
        attack=.0007;x=pluck(t)*(e.kind==='open-string'?.85:1);break;
      case 'harmonic':
        attack=.015;x=(Math.sin(TAU*f*2*t)*.48+Math.sin(TAU*f*3.001*t)*.22+Math.sin(TAU*f*4.002*t)*.09)*Math.exp(-t*.85);break;
      case 'low-resonance':
        attack=.002;x=(Math.sin(TAU*f*t)*.82+Math.sin(TAU*f*1.5*t)*.12)*Math.exp(-t*2.4);break;
      case 'tension':
        attack=.08;noiseLow+=.018*(random()-noiseLow);
        x=(Math.sin(TAU*f*t+.005*Math.sin(TAU*4.4*t))*.55+Math.sin(TAU*f*2.004*t)*.19+noiseLow*.22)
          *(.65+.35*smooth(t/seconds));break;
      case 'strings':case 'low-string':{
        attack=e.short?.012:e.kind==='low-string'?.09:.14;
        const vibrato=1+.0018*Math.sin(TAU*(4.7+(index%3)*.23)*t)*smooth(t/.3),d=f*vibrato/SR;
        phase=(phase+d)%1;phase2=(phase2+d*1.0025)%1;
        x=(saw(phase,d)+saw(phase2,d*1.0025))*.20+Math.sin(TAU*phase)*.60;
        noiseLow+=.055*(random()-noiseLow);x+=noiseLow*.04;
        low+=.16*(x-low);x=low*(e.tremolo?.82+.18*Math.sin(TAU*t/(BEAT/2))**2:1);break;
      }
      case 'brass':{
        attack=.009;const d=f/SR;phase=(phase+d)%1;phase2=(phase2+d*1.004)%1;
        const q=.45*(saw(phase,d)+saw(phase2,d*1.004))+Math.sin(TAU*phase)*.4;
        low+=.12*(q-low);x=low*Math.exp(-t*5);break;
      }
      case 'pulse':{
        attack=.003;const d=f/SR;phase=(phase+d)%1;
        const q=(phase<.27?.73:-.27)+.5*blep(phase,d)-.5*blep((phase+.73)%1,d);
        low+=.24*(q-low);x=(low*.6+Math.sin(TAU*phase)*.40)*Math.exp(-t*9);break;
      }
      case 'war':
        attack=.001;phase+=TAU*f*(1+.18*Math.exp(-t*25))/SR;noiseLow+=.045*(random()-noiseLow);
        x=(Math.sin(phase)*.85+Math.sin(phase*1.59)*.16+noiseLow*.20)*Math.exp(-t*7);break;
      case 'frame':
        attack=.0006;noiseLow+=.16*(random()-noiseLow);
        x=(Math.sin(TAU*143*t)*.57+Math.sin(TAU*227*t)*.18+noiseLow*.35)*Math.exp(-t*22);break;
      default:throw new Error(`Unknown music voice ${e.kind}`);
    }
    mono[n]=x*smooth(t/attack)*tail;
  }
  return mono;
}

export function synthEffect(e,index){
  const random=randomFor(SEED^Math.imul(index+17,0x85ebca6b)),mono=new Float32Array(e.frames),duration=e.frames/SR;
  const release=e.synthesis==='string-release',harmonics=e.synthesis==='string-harmonics';
  const strings=[146.832384,220,293.664768].map((f,i)=>plucked(f,SEED+index*701+i*13,{decay:release?6:3.2,damp:.32,brightness:.35}));
  let low=0,mid=0,peak=0;
  const metal=(t,base,decay)=>t<0?0:(Math.sin(TAU*base*t)*.58+Math.sin(TAU*base*1.473*t)*.25+Math.sin(TAU*base*2.091*t)*.09)*Math.exp(-t*decay);
  for(let n=0;n<e.frames;n++){
    const t=n/SR,u=t/duration,w=random();low+=.030*(w-low);mid+=.17*(w-mid);
    const air=(mid-low)*(.62+.38*Math.sin(Math.PI*u)**2)*Math.exp(-t*7);
    const earth=(low*1.6+Math.sin(TAU*63*t)*.5+Math.sin(TAU*177*t)*.10)*Math.exp(-t*12);
    let x;
    switch(e.synthesis){
      case 'bow-pluck':x=strings[0](t)*.9+Math.sin(TAU*397*t)*.065*Math.exp(-t*24);break;
      case 'bronze':x=metal(t,648,14)+metal(t,391,27)*.16;break;
      case 'iron':x=metal(t,873,21)+metal(t,472,30)*.19;break;
      case 'cloth-dash':x=air*.95+earth*.17;break;
      case 'cloth-cut':x=air*.77+metal(t,1027,40)*.16;break;
      case 'earth-heavy':x=earth*.9+Math.sin(TAU*321*t)*Math.exp(-t*34)*.16;break;
      case 'grit-slide':x=(low*.6+air*.6)*(1+.3*Math.sin(TAU*31*t))+Math.sin(TAU*203*t)*Math.exp(-t*27)*.07;break;
      case 'cloth-rise':x=air*.95+Math.sin(TAU*267*t)*Math.exp(-t*30)*.12+metal(t,716,42)*.11;break;
      case 'cloth-cross':x=air*(.65+.35*Math.sin(TAU*7*t)**2)+metal(t,1143,35)*.12;break;
      case 'earth-land':x=earth*.8+Math.sin(TAU*139*t)*Math.exp(-t*23)*.2;break;
      case 'cloth-turn':x=air*(.6+.4*Math.sin(TAU*4*t)**2)+metal(t,584,33)*.14;break;
      case 'metal-fall':x=metal(t,794,22)*.8+metal(t-.13,963,26)*.38+metal(t-.31,631,30)*.18+earth*.16;break;
      case 'string-release':
        x=strings.reduce((sum,s,i)=>sum+s(t)*[.62,.26,.16][i],0)
          +Math.sin(TAU*55*t)*Math.exp(-t*5)*.18
          +Math.sin(TAU*293.664768*t)*Math.exp(-t*.9)*.06;break;
      case 'string-harmonics':
        x=(Math.sin(TAU*293.664768*t)*.50+Math.sin(TAU*440*t)*.24+Math.sin(TAU*587.329536*t)*.10)*Math.exp(-t*1.4);break;
      default:throw new Error(`Unknown effect ${e.synthesis}`);
    }
    // First dry nonzero is sample 1. No pre-roll, pre-hit noise, pitch sweeps or laser.
    x*=smooth(t/(harmonics?.012:release?.0015:.00065))*(1-smooth((t-duration+.03)/.03));
    check(Number.isFinite(x),`Nonfinite effect ${e.id}/${n}`);mono[n]=x;peak=Math.max(peak,Math.abs(x));
  }
  check(peak>0,`Empty effect ${e.id}`);for(let n=0;n<mono.length;n++)mono[n]*=.8/peak;
  return mono;
}

function addMono(dest,mono,start,gain,pan){
  const l=Math.cos((pan+1)*Math.PI/4)*gain,r=Math.sin((pan+1)*Math.PI/4)*gain;
  for(let n=0;n<mono.length&&n+start<FRAMES;n++){const i=(n+start)*2;dest[i]+=mono[n]*l;dest[i+1]+=mono[n]*r;}
}
function addStereo(dest,source,start=0,gain=1){
  for(let i=0;i<source.length&&i+start*2<dest.length;i++)dest[i+start*2]+=source[i]*gain;
}
function room(dry,amount=.20){
  const out=new Float32Array(dry),len=dry.length/2;
  const taps=[[.0311,.0379,.48],[.0479,.0583,.39],[.0733,.0917,.29],[.1133,.1319,.20]];
  for(const [left,right,weight]of taps){
    const dl=Math.round(left*SR),dr=Math.round(right*SR);let l=0,r=0;
    for(let n=0;n<len;n++){
      l+=.20*((n>=dl?dry[(n-dl)*2]:0)-l);r+=.20*((n>=dr?dry[(n-dr)*2+1]:0)-r);
      out[n*2]+=amount*weight*(l*.8+r*.2);out[n*2+1]+=amount*weight*(r*.8+l*.2);
    }
  }
  // Long cross-room echoes remain synthetic and causal. A string tail, not a wash of hiss.
  const a=Math.round(.181*SR),b=Math.round(.227*SR);
  for(let n=0;n<len;n++){
    if(n>=a)out[n*2]+=out[(n-a)*2+1]*amount*.42;
    if(n>=b)out[n*2+1]+=out[(n-b)*2]*amount*.42;
  }
  return out;
}
function prepare(pcm,{music=false}={}){
  let prevL=0,prevR=0,dcL=0,dcR=0,loL=0,loR=0;
  const pole=Math.exp(-TAU*24/SR),cut=1-Math.exp(-TAU*11500/SR);
  for(let n=0;n<pcm.length/2;n++){
    const t=n/SR,l=pcm[n*2],r=pcm[n*2+1];
    dcL=l-prevL+pole*dcL;dcR=r-prevR+pole*dcR;prevL=l;prevR=r;
    loL+=cut*(dcL-loL);loR+=cut*(dcR-loR);
    // All inherited orchestral tails retreat BEFORE 22.5; fresh tension/release are added separately.
    const g=(music?1-smooth((t-22.42)/.08):1)*(1-smooth((t-29.15)/.85));
    pcm[n*2]=loL*g;pcm[n*2+1]=loR*g;
  }
  return pcm;
}
export function metrics(pcm,start=0,end=pcm.length/2){
  check(end>start&&start>=0&&end<=pcm.length/2,'Invalid measurement interval');
  let l=0,r=0,cross=0,side=0,peak=0,clips=0,nonfinite=0,nonzero=0;
  for(let n=start;n<end;n++){
    const a=pcm[n*2],b=pcm[n*2+1];l+=a*a;r+=b*b;cross+=a*b;side+=(a-b)**2;
    peak=Math.max(peak,Math.abs(a),Math.abs(b));if(Math.abs(a)>=1||Math.abs(b)>=1)clips++;
    if(!Number.isFinite(a)||!Number.isFinite(b))nonfinite++;if(a!==0||b!==0)nonzero++;
  }
  const frames=end-start;
  return {frames,rmsDbFS:round(db(Math.sqrt((l+r)/(2*frames)))),leftRmsDbFS:round(db(Math.sqrt(l/frames))),rightRmsDbFS:round(db(Math.sqrt(r/frames))),
    peakDbFS:round(db(peak)),correlation:round(cross/Math.max(1e-25,Math.sqrt(l*r))),sideRmsDbFS:round(db(Math.sqrt(side/frames)/2)),clips,nonfinite,nonzeroFrames:nonzero};
}
const interval=(pcm,a,b)=>metrics(pcm,Math.round(a*SR),Math.round(b*SR));
const endFade=pcm=>{for(let n=0;n<pcm.length/2;n++){const g=1-smooth((n/SR-29.15)/.85);pcm[n*2]*=g;pcm[n*2+1]*=g;}return pcm;};

export function renderScore(score=buildScore()){
  const body=new Float32Array(FRAMES*2),ending=new Float32Array(FRAMES*2),drums=new Float32Array(FRAMES*2);
  score.music.forEach((e,i)=>addMono(e.bus==='drums'?drums:e.beat>=48?ending:body,synthMusic(e,i),e.sample,e.gain,e.pan));
  const drumBus=prepare(room(drums,.16),{music:true});
  const music=prepare(room(body,.26),{music:true});
  addStereo(music,drumBus);addStereo(music,prepare(room(ending,.62)));
  const sfx=new Float32Array(FRAMES*2),proof=[];
  score.effects.forEach((e,i)=>{
    const mono=synthEffect(e,i),local=new Float32Array(Math.min(FRAMES-e.sample,e.frames+Math.round(.7*SR))*2);
    addMono(local,mono,0,1,e.pan);
    const isolated=room(local,e.id==='empty-string'||e.id==='far-rings'?.68:.15);
    // Measure source event against concurrent music, and choose one STATIC cue gain.
    // Full-event energy remains below music; no runtime ducking or pumping.
    // Peak-normalized short transients have high crest factors: calibrate their
    // nominal sensitivity before the measured full-event and local-detail caps.
    let gain=e.gain*e.power*4;
    const musicAt=metrics(music,e.sample,e.sample+local.length/2).rmsDbFS;
    gain=Math.min(gain,10**((musicAt-7-metrics(isolated).rmsDbFS)/20));
    // Every 60ms local detail window may rise at most +2dB, leaving 1dB of QA margin.
    for(let n=0;n+2880<=Math.min(e.frames,.6*SR);n+=1440){
      const a=metrics(isolated,n,n+2880).rmsDbFS,b=metrics(music,e.sample+n,e.sample+n+2880).rmsDbFS;
      gain=Math.min(gain,10**((b+2-a)/20));
    }
    for(let n=0;n<isolated.length;n++)isolated[n]*=gain;
    let first=null;for(let n=0;n<isolated.length/2;n++)if(Math.abs(isolated[n*2])+Math.abs(isolated[n*2+1])>1e-12){first=n;break;}
    const dryFirst=mono.findIndex(x=>Math.abs(x)>1e-12);
    check(first!==null&&first<=2&&dryFirst>=0&&dryFirst<=2,`Source onset >2 samples: ${e.id}/${first}/${dryFirst}`);
    const source=metrics(isolated);let localMax=-240;
    for(let n=0;n+2880<=Math.min(e.frames,.6*SR);n+=1440)
      localMax=Math.max(localMax,metrics(isolated,n,n+2880).rmsDbFS-metrics(music,e.sample+n,e.sample+n+2880).rmsDbFS);
    proof.push({id:e.id,beat:e.beat,time:e.time,kind:e.kind,material:e.material,synthesis:e.synthesis,source:e.source,
      scheduledSample:e.sample,firstNonzeroSample:e.sample+first,onsetErrorSamples:first,dryOnsetErrorSamples:dryFirst,
      frames:isolated.length/2,gain:round(gain),isolatedSourceSha256:digest(bytes(isolated)),monoSha256:digest(bytes(mono)),
      rmsDbFS:source.rmsDbFS,peakDbFS:source.peakDbFS,musicRmsDbFS:musicAt,sfxOverMusicDb:round(source.rmsDbFS-musicAt),maxLocal60msOverMusicDb:round(localMax)});
    addStereo(sfx,isolated,e.sample);
  });
  prepare(sfx);
  const mix=new Float32Array(FRAMES*2);for(let n=0;n<mix.length;n++)mix[n]=music[n]+sfx[n];
  const sourceHashes={demo:digest(bytes(music)),sfx:digest(bytes(sfx)),master:digest(bytes(mix))};
  return {music,sfx,mix,proof,sourceHashes,drumTail:interval(drumBus,22.5,30)};
}

export function writeWav(path,pcm,rate=SR){
  const data=bytes(pcm),h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(data.length+36,4);h.write('WAVEfmt ',8);
  h.writeUInt32LE(16,16);h.writeUInt16LE(3,20);h.writeUInt16LE(2,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*8,28);
  h.writeUInt16LE(8,32);h.writeUInt16LE(32,34);h.write('data',36);h.writeUInt32LE(data.length,40);writeFileSync(path,Buffer.concat([h,data]));
}
function run(exe,args,{binary=false,maxBuffer=128*1024*1024}={}){
  const r=spawnSync(exe,args,{encoding:binary?undefined:'utf8',windowsHide:true,maxBuffer});
  check(!r.error&&r.status===0,`Command failed: ${r.error?.message??r.status}\n${String(r.stderr).slice(-5000)}`);return r;
}
export function getTools(){
  // Discover the installed user Python tool, never hard-code its version/site-packages.
  const ffmpeg=run('python',['-c','import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())']).stdout.trim();
  const ffprobe=require('ffprobe-static').path;check(existsSync(ffmpeg)&&existsSync(ffprobe),'Local FFmpeg/ffprobe missing');
  return {ffmpeg,ffprobe};
}
const ff=(tools,args)=>run(tools.ffmpeg,['-hide_banner','-nostdin','-v','error','-y',...args]);
export const probe=(tools,path)=>JSON.parse(run(tools.ffprobe,['-v','error','-show_streams','-show_format','-of','json',path]).stdout);
export function decode(tools,path,filter=null){
  const args=['-hide_banner','-nostdin','-v','error','-xerror','-i',path,'-map','0:a:0'];
  if(filter)args.push('-af',filter);
  args.push('-c:a','pcm_f32le','-f','f32le','-');
  const b=run(tools.ffmpeg,args,{binary:true}).stdout;
  check(b.length%8===0,'Partial decoded stereo frame');
  return new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
}
export function loudness(tools,path){
  // EBU R128 + oversampled true peak measurement ONLY. No loudnorm filter is used.
  const r=run(tools.ffmpeg,['-hide_banner','-nostdin','-i',path,'-af','ebur128=peak=true','-f','null','-']);
  const text=r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const i=text.match(/I:\s*([-\d.]+) LUFS/),tp=text.match(/Peak:\s*([-\d.]+) dBFS/),lra=text.match(/LRA:\s*([-\d.]+) LU/);
  check(i&&tp&&lra,`Missing R128 measurement: ${text}`);
  return {LUFS:Number(i[1]),truePeakDbTP:Number(tp[1]),LRA:Number(lra[1]),method:'FFmpeg ebur128=peak=true (measurement only)'};
}
export function analyze(pcm){
  check(pcm.length===FRAMES*2,`Decoded ${pcm.length/2}, expected exactly ${FRAMES} frames`);
  const quietRuns=[];let quietStart=null;
  for(let n=0;n<FRAMES;n+=960){
    const quiet=metrics(pcm,n,Math.min(n+960,FRAMES)).rmsDbFS< -65;
    if(quiet&&quietStart===null)quietStart=n;
    if(!quiet&&quietStart!==null){if(n-quietStart>=SR*.2)quietRuns.push({start:quietStart/SR,end:n/SR});quietStart=null;}
  }
  if(quietStart!==null&&FRAMES-quietStart>=SR*.2)quietRuns.push({start:quietStart/SR,end:30});
  const fight=interval(pcm,7.5,22.4),suspense=interval(pcm,22.65,25.20);
  return {...metrics(pcm),decodedFrames:pcm.length/2,decodedDuration:pcm.length/(2*SR),quietRuns,
    stageEnergy:STAGES.map(s=>({id:s.id,start:s.start,end:s.end,...interval(pcm,s.start,s.end)})),
    fight,suspense,dynamicContrastDb:round(fight.rmsDbFS-suspense.rmsDbFS),tail:interval(pcm,29.995,30)};
}
export function assertSignal(scan,measure,role){
  check(scan.decodedFrames===FRAMES&&scan.decodedDuration===30,'Gapless frame count mismatch');
  check(scan.clips===0&&scan.nonfinite===0,`${role}: clips=${scan.clips}, nonfinite=${scan.nonfinite}`);
  check(measure.truePeakDbTP<=-1.5,`${role} true peak ${measure.truePeakDbTP} > -1.5`);
  check(scan.correlation>-.15&&scan.correlation<.995&&scan.sideRmsDbFS> -50,`${role} stereo: ${JSON.stringify({correlation:scan.correlation,side:scan.sideRmsDbFS})}`);
  check(Math.abs(scan.leftRmsDbFS-scan.rightRmsDbFS)<4,`${role} unbalanced L/R`);
  if(role==='master'){
    check(measure.LUFS>=-15&&measure.LUFS<=-12,`Master LUFS ${measure.LUFS} outside [-15,-12]`);
    check(scan.dynamicContrastDb>=6,`Master fight/suspense difference ${scan.dynamicContrastDb} < 6dB`);
    check(scan.suspense.rmsDbFS< -32,`Suspense not very quiet: ${scan.suspense.rmsDbFS}`);
    check(scan.quietRuns.every(q=>q.start>=29.15),`Unintended master silence: ${JSON.stringify(scan.quietRuns)}`);
  }
  // Sparse SFX silence is intentional: NO music-silence test on this role.
  check(scan.tail.peakDbFS< -65,`${role} tail not faded: ${scan.tail.peakDbFS}`);
  return true;
}

function sumError(a,b,master){
  check(a.length===b.length&&b.length===master.length,'Stem reconstruction length');let error=0,signal=0,peak=0;
  for(let i=0;i<a.length;i++){const d=a[i]+b[i]-master[i];error+=d*d;signal+=master[i]*master[i];peak=Math.max(peak,Math.abs(d));}
  return {rmsDbFS:round(db(Math.sqrt(error/a.length))),relativeRmsDb:round(10*Math.log10(Math.max(1e-24,error)/Math.max(1e-24,signal))),peakDbFS:round(db(peak))};
}
export function alignment(reference,encoded,e){
  // Matched-waveform lag, not threshold onset: MP3 can have small pre-echo before a transient.
  const start=e.sample+96,end=Math.min(e.sample+Math.round(.14*SR),FRAMES-32);
  let best=-Infinity,bestLag=0;
  for(let lag=-16;lag<=16;lag++){
    let cross=0,a=0,b=0;
    for(let n=start;n<end;n++)for(let ch=0;ch<2;ch++){
      const x=reference[n*2+ch],y=encoded[(n+lag)*2+ch];cross+=x*y;a+=x*x;b+=y*y;
    }
    const correlation=cross/Math.max(1e-24,Math.sqrt(a*b));if(correlation>best){best=correlation;bestLag=lag;}
  }
  return {id:e.id,lagSamples:bestLag,correlation:round(best),windowStart:start,windowEnd:end};
}

function encode(tools,source,dest,role,hashes){
  const comment=`Original demonstration ${role}; NOT a film theme. Synthesized locally; no external samples.`;
  ff(tools,['-i',source,'-map_metadata','-1','-c:a','libmp3lame','-b:a','256k','-ar',String(SR),'-ac','2','-write_xing','1','-id3v2_version','3',
    '-metadata',`title=Empty String - ${role} (original demo)`, '-metadata',`comment=${comment}`,
    '-metadata',`sound_mode=${SOUND_MODE}`,'-metadata','theme_adaptation=false','-metadata','external_samples=false',
    '-metadata',`timeline_sha256=${hashes.timeline}`,'-metadata',`story_sha256=${hashes.timeline}`,
    '-metadata',`generator_sha256=${hashes.generator}`,'-metadata','bpm=128',dest]);
}

function masterStems(tools,work,render,inputMeasure,hashes){
  const proofDir=join(work,'proof');mkdirSync(proofDir,{recursive:true});
  const source=join(work,'source.wav');writeWav(source,render.mix);
  // Fixed gain established ONCE from measured source loudness. No dynamic loudnorm.
  const fixedGainDb=round(-13.65-inputMeasure.LUFS),fixedGain=10**(fixedGainDb/20),up=SR*4;
  const musicSource=join(work,'music-source.wav'),sfxSource=join(work,'sfx-source.wav');
  writeWav(musicSource,render.music);writeWav(sfxSource,render.sfx);
  const music4=decode(tools,musicSource,`aresample=${up},apad=whole_len=${FRAMES*4},atrim=end_sample=${FRAMES*4}`);
  const sfx4=decode(tools,sfxSource,`aresample=${up},apad=whole_len=${FRAMES*4},atrim=end_sample=${FRAMES*4}`);
  const mix4=new Float32Array(music4.length);
  for(let i=0;i<mix4.length;i++){music4[i]*=fixedGain;sfx4[i]*=fixedGain;mix4[i]=music4[i]+sfx4[i];}
  const upSource=join(work,'up-mix.wav');writeWav(upSource,mix4,up);
  // One stereo-linked 192kHz limiter. Its actual gain is shared by BOTH stems;
  // this avoids independent normalization, competing limiters or SFX-only makeup gain.
  const ceilingDbTP=-2.8,filter=`alimiter=limit=${10**(ceilingDbTP/20)}:attack=3:release=80:level=false:latency=true,apad=whole_len=${FRAMES*4},atrim=end_sample=${FRAMES*4}`;
  const limited=decode(tools,upSource,filter);check(limited.length===mix4.length,'Limiter did not compensate latency');
  let minGain=1,limitedFrames=0,maxLinkError=0;
  for(let n=0;n<limited.length/2;n++){
    const i=n*2,k=Math.abs(mix4[i])>=Math.abs(mix4[i+1])?i:i+1;
    const g=Math.abs(mix4[k])>1e-12?limited[k]/mix4[k]:1;
    check(g>=-.000001&&g<=1.0001,`Limiter alignment/gain mismatch at ${n}: ${g}`);
    maxLinkError=Math.max(maxLinkError,Math.abs(limited[i]-mix4[i]*g),Math.abs(limited[i+1]-mix4[i+1]*g));
    check(maxLinkError<1e-5,`Limiter is not stereo-linked/aligned: ${maxLinkError}`);
    minGain=Math.min(minGain,g);if(g<.999)limitedFrames++;
    music4[i]*=g;music4[i+1]*=g;sfx4[i]*=g;sfx4[i+1]*=g;
  }
  const refs={};
  for(const [role,pcm]of Object.entries({demo:music4,sfx:sfx4,master:limited})){
    const tmp=join(work,`up-${role}.wav`);writeWav(tmp,pcm,up);
    const down=decode(tools,tmp,`aresample=${SR},apad=whole_len=${FRAMES},atrim=end_sample=${FRAMES}`);
    // Shared linear terminal fade AFTER resampling prevents filter tails at 30s.
    endFade(down);refs[role]=down;
    const ref=join(proofDir,`${role}.wav`);writeWav(ref,down);
    encode(tools,ref,join(work,`${role}.mp3`),role,hashes);
  }
  const reconstruction=sumError(refs.demo,refs.sfx,refs.master);
  check(reconstruction.relativeRmsDb< -100,`Lossless stem sum does not equal master: ${JSON.stringify(reconstruction)}`);
  return {fixedGainDb,adaptiveLoudnessGain:false,externalSamples:false,measurement:'EBU R128 measurement only; no loudnorm',
    limiter:{oversampling:4,sampleRate:up,stereoLinked:true,latency:true,level:false,attackMs:3,releaseMs:80,ceilingDbTP,
      minGainDb:round(db(minGain)),limitedFrameFraction:round(limitedFrames/(FRAMES*4)),maxStereoLinkError:round(maxLinkError)},
    stemPolicy:'Same fixed gain and actual shared master-limiter gain envelope, never independent loudness normalization',
    signalChain:'Computed 48kHz float stereo -> causal HP24/LP11500 -> 4x resampling -> fixed gain -> stereo-linked alimiter -> common limiter gain to both stems -> 48kHz -> shared fade -> gapless MP3',
    sourceMeasure:inputMeasure,losslessStemSum:reconstruction};
}

export async function verify(tools,report,directory=AUDIO_DIR,{rendered=null}={}){
  contract();const score=buildScore();
  check(report.soundMode===SOUND_MODE&&report.themeAdaptation===false&&report.externalSamples===false,'False theme/provenance identity');
  check(report.originalThemeMissing===true&&report.notice===NOTICE,'Missing film-theme limitation');
  check(report.duration===30&&report.bpm===128&&report.beats===64&&report.bars===16,'Report clock mismatch');
  check(report.timelineSha256===sha(TIMELINE)&&report.storysha256===sha(TIMELINE),'Timeline/story source hash changed; regenerate');
  check(report.generatorSha256===sha(SELF),'Generator source hash changed; regenerate');
  check(report.music.eventSha256===score.eventSha256&&JSON.stringify(report.music.bars)===JSON.stringify(score.bars)&&JSON.stringify(report.music.stages)===JSON.stringify(score.stages),'Stale musical structure');
  check(report.processing.adaptiveLoudnessGain===false&&report.processing.limiter.oversampling===4&&report.processing.limiter.latency===true&&report.processing.limiter.level===false&&report.processing.limiter.stereoLinked===true,'Invalid mastering policy');
  // Re-synthesis is deterministic: source hashes and all 14 onset measurements are checked,
  // rather than trusting a manifest's onset claims.
  const source=rendered??renderScore(score);
  check(JSON.stringify(source.sourceHashes)===JSON.stringify(report.sourcePcmSha256),'Synthesized source PCM hash mismatch');
  check(JSON.stringify(source.proof)===JSON.stringify(report.sfx.events),'SFX proof mismatch');
  check(source.drumTail.nonzeroFrames===0,'Percussion survived the 22.5-second exit');
  const tracks={},decoded={},refs={};
  for(const role of ['demo','sfx','master']){
    const file=join(directory,`${role}.mp3`),ref=join(directory,'proof',`${role}.wav`),entry=report.files[role];
    check(entry.sha256===sha(file)&&entry.referenceSha256===sha(ref),`${role} file hash mismatch`);
    check(entry.bytes===statSync(file).size&&entry.soundMode===SOUND_MODE&&entry.themeAdaptation===false&&entry.externalSamples===false,`${role} file identity mismatch`);
    check(entry.timelineSha256===report.timelineSha256&&entry.storysha256===report.storysha256&&entry.generatorSha256===report.generatorSha256,`${role} source metadata mismatch`);
    const info=probe(tools,file),s=info.streams[0],tags=info.format.tags;
    check(info.streams.length===1&&s.codec_name==='mp3'&&s.channels===2&&+s.sample_rate===SR&&+s.bit_rate===256000,`${role} codec/rate/channels mismatch`);
    check(tags.sound_mode===SOUND_MODE&&tags.theme_adaptation==='false'&&tags.external_samples==='false'&&tags.timeline_sha256===report.timelineSha256&&tags.generator_sha256===report.generatorSha256,`${role} embedded metadata mismatch`);
    const padding=Number(info.format.duration)-30;
    check(padding>=0&&padding<.05,`${role} gapless container padding ${padding}`);
    decoded[role]=decode(tools,file);refs[role]=decode(tools,ref);
    check(refs[role].length===FRAMES*2,`${role} reference frame count`);
    const scan=analyze(decoded[role]),r128=loudness(tools,file);assertSignal(scan,r128,role);
    const referenceScan=analyze(refs[role]),referenceMeasure=loudness(tools,ref);assertSignal(referenceScan,referenceMeasure,role);
    tracks[role]={...scan,...r128,sampleRate:SR,channels:2,bitrate:256000,metadataDuration:+info.format.duration,metadataPaddingSeconds:round(padding),
      reference:{...referenceScan,...referenceMeasure}};
  }
  check(tracks.demo.LUFS<tracks.master.LUFS&&tracks.sfx.LUFS<tracks.master.LUFS,'Stems must be quieter than the default master');
  const losslessStemSum=sumError(refs.demo,refs.sfx,refs.master),mp3StemSum=sumError(decoded.demo,decoded.sfx,decoded.master);
  check(losslessStemSum.relativeRmsDb< -100,`Lossless stems differ: ${JSON.stringify(losslessStemSum)}`);
  check(mp3StemSum.relativeRmsDb< -24,`MP3 stems not near master: ${JSON.stringify(mp3StemSum)}`);
  const encodedAlignment=score.effects.map(e=>alignment(refs.sfx,decoded.sfx,e));
  for(const e of encodedAlignment)check(Math.abs(e.lagSamples)<=2&&e.correlation>.96,`Encoded SFX timing mismatch: ${JSON.stringify(e)}`);
  const balances=score.effects.map(e=>{
    let max=-240;
    for(let n=e.sample;n+2880<=e.sample+Math.min(e.frames,.6*SR);n+=1440)
      max=Math.max(max,metrics(decoded.sfx,n,n+2880).rmsDbFS-metrics(decoded.demo,n,n+2880).rmsDbFS);
    const a=e.sample,b=Math.min(FRAMES,e.sample+e.frames),full=metrics(decoded.sfx,a,b).rmsDbFS-metrics(decoded.demo,a,b).rmsDbFS;
    check(max<=3&&full<=0,`SFX masks music ${e.id}: max60ms=${max}, full=${full}`);
    return {id:e.id,maxLocal60msOverMusicDb:round(max),fullEventOverMusicDb:round(full)};
  });
  return {tracks,losslessStemSum,mp3StemSum,encodedAlignment,balances,sourceHashes:source.sourceHashes,drumTail:source.drumTail};
}

function publish(work,names){
  const moved=[],backups=[];
  try{
    for(const name of names){
      const dest=join(AUDIO_DIR,name),backup=join(work,`previous-${name}`);
      if(existsSync(dest)){renameSync(dest,backup);backups.push({dest,backup});}
      renameSync(join(work,name),dest);moved.push(dest);
    }
  }catch(error){for(const dest of moved.reverse())rmSync(dest,{recursive:true,force:true});for(const x of backups.reverse())renameSync(x.backup,x.dest);throw error;}
}
const summary=report=>({passed:report.validation.passed,soundMode:report.soundMode,themeAdaptation:false,notice:report.notice,
  files:Object.entries(report.files).map(([role,f])=>({role,path:join(AUDIO_DIR,f.path),bytes:f.bytes,sha256:f.sha256,frames:report.measurements.tracks[role].decodedFrames,
    LUFS:report.measurements.tracks[role].LUFS,truePeakDbTP:report.measurements.tracks[role].truePeakDbTP})),
  contrastDb:report.measurements.tracks.master.dynamicContrastDb,maxSourceOnsetErrorSamples:Math.max(...report.sfx.events.map(e=>e.onsetErrorSamples)),
  maxDecodedMatchedLagSamples:Math.max(...report.measurements.encodedAlignment.map(e=>Math.abs(e.lagSamples))),mp3StemSum:report.measurements.mp3StemSum});

export async function main(){
  contract();const tools=getTools();
  if(process.argv.includes('--verify')){
    const report=JSON.parse(readFileSync(join(AUDIO_DIR,'report.json'),'utf8')),actual=await verify(tools,report);
    check(report.validation.passed===true&&JSON.stringify(actual)===JSON.stringify(report.measurements),'Published measurements are stale');
    console.log(JSON.stringify(summary(report),null,2));return report;
  }
  mkdirSync(AUDIO_DIR,{recursive:true});const work=mkdtempSync(join(AUDIO_DIR,'.render-'));
  try{
    const hashes={timeline:sha(TIMELINE),generator:sha(SELF)},score=buildScore(),render=renderScore(score);
    const sourcePath=join(work,'source.wav');writeWav(sourcePath,render.mix);
    const sourceMeasure=loudness(tools,sourcePath);console.log(`Source: ${sourceMeasure.LUFS} LUFS; rendering shared-limiter stems`);
    const processing=masterStems(tools,work,render,sourceMeasure,hashes),files={};
    for(const role of ['demo','sfx','master'])files[role]={path:`${role}.mp3`,role,sha256:sha(join(work,`${role}.mp3`)),bytes:statSync(join(work,`${role}.mp3`)).size,
      reference:`proof/${role}.wav`,referenceSha256:sha(join(work,'proof',`${role}.wav`)),duration:30,frames:FRAMES,sampleRate:SR,channels:2,bitrate:256000,
      timelineSha256:hashes.timeline,storysha256:hashes.timeline,generatorSha256:hashes.generator,soundMode:SOUND_MODE,themeAdaptation:false,externalSamples:false};
    const report={title:'空弦 / Empty String — Original Demonstration',film:FILM_TITLE,notice:NOTICE,soundMode:SOUND_MODE,themeAdaptation:false,externalSamples:false,originalThemeMissing:true,
      originalThemeStatus:'Not produced: no film source supplied; no download, melody transcription or invented claim of film-theme recognition.',
      duration:30,bpm:128,beats:64,bars:16,sampleRate:SR,channels:2,frames:FRAMES,timelineSha256:hashes.timeline,storysha256:hashes.timeline,generatorSha256:hashes.generator,
      storyHashMeaning:'This project has no separate story.mjs. storysha256 is explicitly an alias of the authoritative timeline.mjs SHA256.',
      mastersha256:files.master.sha256,files,sourcePcmSha256:render.sourceHashes,
      music:{original:true,themes:THEMES,bars:score.bars,stages:score.stages,eventSha256:score.eventSha256,musicEventCount:score.music.length,musicEvents:score.music},
      sfx:{count:14,source:'timeline.EVENTS',events:render.proof,sparseTrackSilenceIntentional:true,
        timingScope:'Dry and isolated causal source onsets measured sample-by-sample. MP3 matched-waveform lag separately measured against gapless lossless reference; pre-echo is not asserted to be zero.',
        balanceScope:'Static per-event gain against concurrent music; decoded aggregate SFX/music also checked in sliding 60ms windows (30ms steps) over first 600ms.'},
      processing,delivery:{default:'audio/master.mp3',musicOnly:'audio/demo.mp3',sfxOnly:'audio/sfx.mp3',
        replacement:'Main player may replace demo with authorized local user music and retain sfx. This audio-only task does not modify the player.',
        gapless:'Container duration includes MPEG frame padding. Decoded PCM must be exactly 1,440,000 frames, 30 seconds for every track.',
        references:'proof/*.wav are 48kHz float lossless QA references, not external inputs.'},
      provenance:{seed:SEED,externalSamples:false,networkUsed:false,apiUsed:false,tts:false,createdAt:new Date().toISOString(),
        synthesis:'Computed fractional-delay plucked strings, sympathetic additive modes, detuned bowed strings/brass, short anti-aliased pulse, skin/wood/metal/cloth/earth DSP.',
        engineering:'Basic oscillator, fractional-delay and fixed-gain engineering informed by read-only odyssey/score.mjs. No old module imported or executed; all musical notes and form newly authored.'}};
    report.measurements=await verify(tools,report,work,{rendered:render});
    report.validation={passed:true,checkedAt:new Date().toISOString(),checks:['timeline 30s/128BPM/64beats/16bars/8stages','14 exact event IDs and sample clock','deterministic re-synthesis source and generator/timeline SHA256',
      '3 MP3 + 3 reference full decodes / exactly 1440000 stereo frames','R128 and true peak measured on every actual file','no clipping/nonfinite','master [-15,-12] LUFS / every track <= -1.5dBTP',
      'master fight/suspense >=6dB; no unintended >=200ms silence','source SFX onset <=2 samples','decoded matched-waveform SFX lag <=2 samples','local SFX/music <=+3dB, whole event <=0dB',
      'all percussion and percussion room zero after22.5s','lossless stem sum relative RMS <-100dB; lossy sum <-24dB'],scope:'Signal/provenance measurements, not a listening review or a claim that a film theme was reproduced.'};
    check(sha(TIMELINE)===hashes.timeline&&sha(SELF)===hashes.generator,'Inputs changed during rendering');
    json(join(work,'report.json'),report);publish(work,['demo.mp3','sfx.mp3','master.mp3','proof','report.json']);
    console.log(JSON.stringify(summary(report),null,2));return report;
  }finally{rmSync(work,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===SELF)main().catch(error=>{console.error(error.stack);process.exitCode=1;});