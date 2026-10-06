/** 30-second technique study. Original choreography, not a claimed scene from the film. */
export const TITLE = '奥德赛 II · 空弦';
export const DURATION = 30;
export const BPM = 128;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const STAGES = [
  {id:'string',start:0,end:3.75,label:'试弦',camera:'macro'},
  {id:'guard',start:3.75,end:7.5,label:'迎击',camera:'duel'},
  {id:'counter',start:7.5,end:11.25,label:'破势',camera:'track'},
  {id:'evade',start:11.25,end:15,label:'闪避',camera:'low'},
  {id:'rise',start:15,end:18.75,label:'腾空',camera:'rise'},
  {id:'land',start:18.75,end:22.5,label:'回身',camera:'wide'},
  {id:'draw',start:22.5,end:26.25,label:'空弦',camera:'bow'},
  {id:'release',start:26.25,end:30,label:'余响',camera:'pullback'},
];
const event = (beat,id,kind,position,power=1) => ({beat,time:beat*BEAT,id,kind,position,power});
export const EVENTS = [
  event(6,'first-string','pluck',[-2.3,1.46,.12],.45),
  event(12,'first-parry','parry',[-.73,1.5,0],.85),
  event(17,'dash-launch','dash',[-2.5,.09,.15],.65),
  event(19,'counter-cut','slash',[.15,1.2,0],.8),
  event(21,'second-parry','parry',[.53,1.5,0],.7),
  event(27,'heavy-ground','ground',[-.25,.07,.1],1),
  event(30,'slide-turn','slide',[.8,.05,.15],.55),
  event(34,'rising-cut','launch',[.72,1.3,0],.9),
  event(36,'air-cross','slash',[1.3,2.35,0],.8),
  event(41,'hero-landing','land',[-.62,.04,.2],.9),
  event(43,'turning-cut','slash',[.2,1.25,0],.75),
  event(46,'weapon-fall','metal',[1.7,.06,-.15],.5),
  event(54,'empty-string','release',[-1.26,1.44,.05],1),
  event(56,'far-rings','resonate',[3.3,1.42,-.3],.8),
];
export const HOLDS = EVENTS.filter(e=>['parry','slash','launch','ground','release'].includes(e.kind)).map(e=>({time:e.time,duration:e.kind==='release'?.09:.065}));
const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
const smooth = v => {v=clamp(v);return v*v*(3-2*v);};
const mix = (a,b,p) => a+(b-a)*p;
export const eventAt = id => EVENTS.find(e=>e.id===id);
export function stageAt(time) {return STAGES.find(s=>time<s.end)||STAGES.at(-1);}
export function motionTime(time) {
  // Local hit-stop and catch-up; soundtrack and camera clock never stop.
  for(const hold of HOLDS) {
    const age=time-hold.time;
    if(age>=0&&age<hold.duration)return hold.time;
    if(age>=hold.duration&&age<hold.duration+.10)return time-hold.duration*(1-smooth((age-hold.duration)/.10));
  }
  return time;
}

// Beat, x, y (feet height), pose, phase, facing. Distinct motion arcs, no repeated idle troupe.
const HERO = [
  [0,-2.5,0,'bow',.12,1],[5,-2.5,0,'bow',.78,1],[6,-2.5,0,'bow',.90,1],[7,-2.5,0,'release',.3,1],
  [8,-2.5,0,'idle',0,1],[10,-2.24,0,'guard',.15,1],[11.4,-1.78,0,'guard',.5,1],[12,-1.72,0,'parry',.55,1],
  [12.9,-2.15,0,'recoil',.3,1],[14,-2.48,0,'guard',.75,1],[16,-2.48,0,'crouch',.4,1],
  [17,-2.42,0,'dash',.2,1],[18,-1.24,.08,'dash',.65,1],[19,-.74,.02,'slash',.55,1],
  [20,-.64,0,'slash',.95,1],[20.5,-.6,0,'guard',.15,1],[21,-.62,0,'parry',.55,1],[22,-1.08,0,'guard',.8,1],
  [24,-1.08,0,'idle',0,1],[25,-1.09,0,'crouch',.25,1],[26,-1.1,0,'slide',.05,1],
  [27,.02,.02,'slide',.48,1],[28,.65,0,'slide',.86,-1],[29,.87,0,'crouch',.7,-1],[30,.85,0,'turn',.4,-1],
  [31,.45,0,'guard',.4,-1],[32,-.75,0,'crouch',.2,1],[33,-.70,0,'uppercut',.14,1],
  [34,-.4,.3,'uppercut',.40,1],[35,.03,1.17,'air',.25,1],[36,.25,1.32,'airSlash',.55,1],
  [37,.18,1.21,'airSlash',.98,1],[38,-.08,.8,'air',.7,1],[39.3,-.52,.12,'land',.12,1],
  [41,-.62,0,'land',.5,1],[42,-.62,0,'turn',.1,1],[43,-.64,.08,'spin',.52,1],[44,-.68,0,'spin',.94,1],
  [46,-1.06,0,'guard',.7,1],[48,-2.13,0,'idle',0,1],[49,-2.13,0,'bow',.05,1],
  [52,-2.13,0,'bow',.84,1],[53.8,-2.13,0,'bow',1,1],[54,-2.13,0,'release',0,1],
  [55,-2.33,0,'release',.75,1],[56,-2.27,0,'bow',.12,1],[58,-2.27,0,'idle',0,1],[64,-2.27,0,'idle',0,1],
];
const RIVAL = [
  [0,3.7,0,'idle',0,-1],[8,3.7,0,'idle',0,-1],[9,3.2,0,'run',.15,-1],[10,2.1,0,'run',.6,-1],
  [11,2.08,0,'thrust',.12,-1],[12,1.60,0,'thrust',.55,-1],[13,2.02,0,'recoil',.65,-1],[14,2.10,0,'guard',.3,-1],
  [16,1.58,0,'guard',.8,-1],[18,1.58,0,'guard',.3,-1],[19,1.05,0,'recoil',.4,-1],[20,3.15,0,'guard',.75,-1],
  [21,2.80,0,'thrust',.55,-1],[22,3.03,0,'thrust',.95,-1],[24,1.9,0,'idle',0,-1],
  [25,1.64,0,'overhead',.12,-1],[26,1.05,.16,'overhead',.3,-1],[27,.79,0,'overhead',.58,-1],[28,.85,0,'overhead',.98,-1],
  [30,1.8,0,'turn',.35,-1],[32,1.85,0,'guard',.1,-1],[34,1.02,.14,'recoil',.35,-1],
  [35,1.22,1.14,'airHurt',.22,-1],[36,1.32,1.48,'airHurt',.45,-1],[37,1.91,1.19,'airHurt',.75,-1],
  [39,2.52,.3,'airHurt',.9,-1],[40,2.64,0,'land',.4,-1],[41,2.50,0,'guard',.2,-1],
  [42,2.06,0,'thrust',.12,-1],[43,1.08,0,'thrust',.55,-1],[44,1.73,0,'recoil',.45,-1],
  [46,2.25,0,'kneel',.5,-1],[48,2.25,0,'kneel',.7,-1],[54,2.43,0,'guard',.55,-1],
  [55,3.02,0,'recoil',.7,-1],[57,3.5,0,'kneel',.6,-1],[64,3.5,0,'kneel',.8,-1],
];
function actorTrack(keys,beat) {
  let i=keys.length-2;for(let j=0;j<keys.length-1;j++)if(beat<keys[j+1][0]){i=j;break;}
  const a=keys[i],b=keys[i+1],u=clamp((beat-a[0])/(b[0]-a[0])),v=smooth(u);
  const same=a[3]===b[3];
  return {x:mix(a[1],b[1],v),y:mix(a[2],b[2],v),z:0,pose:a[3],nextPose:b[3],
    phase:same?mix(a[4],b[4],u):a[4],nextPhase:b[4],blend:same?0:smooth(clamp((u-.65)/.35)),
    facing:u<.8?a[5]:b[5],velocity:(b[1]-a[1])/(Math.max(.001,(b[0]-a[0])*BEAT)),trackBeat:beat};
}
export function sample(time,{reduced=false}={}) {
  const t=clamp(Number.isFinite(time)?time:0,0,DURATION),mt=reduced?t:motionTime(t),beat=mt/BEAT;
  const hero=actorTrack(HERO,beat),rival=actorTrack(RIVAL,beat);
  return {t,beat,stage:stageAt(t),hero,rival,hitStopped:Math.abs(mt-t)>.00001,
    activeEvents:EVENTS.filter(e=>t>=e.time&&t-e.time<1.8),
    actionIntensity:EVENTS.reduce((v,e)=>Math.max(v,t>=e.time&&t<e.time+.35?e.power*(1-(t-e.time)/.35):0),0),
    ending:t===DURATION};
}
export const MUSIC_NOTICE = '当前为原创演示底轨，不是电影主题。可选择本地有权使用的音频；原片主题变奏尚未制作。';
export const NOTES = [
  '30秒动作与视听技术演示；不追求完整电影故事。',
  '动作与弓弦光波为原创风格化设计，不声称电影人物使用这些招式或法术。',
  '借鉴像素格斗的预备、接触、停顿、回弹，以及HD-2D的立体环境与平面角色组合；未使用相关游戏资产。',
  MUSIC_NOTICE,
];