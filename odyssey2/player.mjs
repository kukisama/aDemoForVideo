import './style.css';
import {createHD2DScene} from './scene.mjs';
import {DURATION,BAR,STAGES,EVENTS,sample,MUSIC_NOTICE} from './timeline.mjs';

const $=id=>document.getElementById(id);
const app=$('cinema'),stage=$('stage'),master=$('master'),effects=$('effects'),local=$('local-music');
const audioElements=[master,effects,local];
let world=null,ready=false,playing=false,started=false,ended=false,pending=false,failed=false;
let raf=0,requestId=0,hideTimer=0,drawTime=0,frames=0,began=0,finishedAt=0,lastFrameTime=0,maxGap=0;
let mode='demo',offset=0,localURL=null,localFileName='',localDuration=0,musicLoadId=0;
let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,quality='cinematic',infoShown=false;
let muted=false,volume=Number($('volume').value),renderInfo=null,clockCorrections=0;
let soundContext=null,dry=null,wet=null,spaceFilter=null,graphOutput=null,analyser=null;
let localBuffer=null,sfxBuffer=null,localSources=[],sharedTime=0,sharedStart=0,sharedRunning=false;
let scheduledMusic=null,scheduledEffects=null;
const clamp=t=>Math.max(0,Math.min(DURATION,Number.isFinite(t)?t:0));
const clockAudio=()=>mode==='demo'?master:effects;
const sharedClock=()=>clamp(sharedTime+(sharedRunning?Math.max(0,soundContext.currentTime-sharedStart):0));
const clockTime=()=>ended?DURATION:mode==='local'?sharedClock():clamp(clockAudio().currentTime);
const display=t=>`00:${String(Math.floor(t)).padStart(2,'0')}`;
$('gentle').checked=reduced;
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);if(error){clearTimeout(hideTimer);app.classList.remove('controls-hidden');}}
function fit(){stage.style.setProperty('--fit',String(Math.min(app.clientWidth/1280,app.clientHeight/720)));}
new ResizeObserver(fit).observe(app);addEventListener('resize',fit);fit();
function updateVolume(){for(const a of audioElements){a.volume=volume;a.muted=muted;}if(graphOutput)graphOutput.gain.value=muted?0:volume;}
updateVolume();
function controls(){clearTimeout(hideTimer);app.classList.remove('controls-hidden');if(playing)hideTimer=setTimeout(()=>{if(playing&&!$('settings-dialog').open)app.classList.add('controls-hidden');},1500);}
function buttons(){$('toggle').textContent=playing?'Ⅱ':ended?'↺':'▶';$('toggle').setAttribute('aria-label',playing?'暂停':ended?'重播':'播放');$('end-replay').hidden=!ended;controls();}
function updateUI(t){$('time').textContent=`${display(t)} / 00:30`;$('timeline').value=String(t);$('timeline').setAttribute('aria-valuetext',`${t.toFixed(2)} 秒，共30秒`);}
function draw(time,{poster=false}={}){
  if(!world)return;
  const t=clamp(time);drawTime=t;renderInfo=world.draw(t,{reduced,poster});
  stage.dataset.stage=renderInfo.stage.id;
  $('ending').hidden=poster||t<28.5;$('ending').style.opacity=String(Math.min(1,Math.max(0,(t-28.5)/.7)));
  $('diagnostics').hidden=!infoShown||poster;
  if(infoShown&&!poster){const i=renderInfo;$('diagnostic-text').textContent=[
    `${t.toFixed(3)}s / 30.000s   ${i.stage.label}`,
    `WebGL2 · ${i.render.width} × ${i.render.height}`,
    `Hero: ${i.hero.displayedPose} / ${i.hero.frame}f`,
    `Rival: ${i.rival.displayedPose} / ${i.rival.frame}f`,
    `Focus: ${i.camera.focus.distance.toFixed(2)} · 真实深度`,
    `Particles: ${i.effects.particleCount} · Ghosts: ${i.effects.afterimages}`,
    `Draw calls: ${i.render.drawCalls} · Triangles: ${i.render.triangles}`,
    `Contact hold: ${i.hitStopped?'ON':'—'}`,
    `Audio: ${mode==='local'?'本地用户配乐':mode==='sfx'?'动作音效':'原创演示底轨'}`,
  ].join('\n');}
  if(!poster)updateUI(t);
}
function stop(){cancelAnimationFrame(raf);raf=0;}
function stopLocal(){
  if(sharedRunning)sharedTime=sharedClock();sharedRunning=false;
  for(const node of localSources){node.onended=null;try{node.stop();}catch{}node.disconnect();}localSources=[];
}
function pause(){requestId++;stopLocal();audioElements.forEach(a=>a.pause());playing=false;stop();updateUI(clockTime());buttons();}
function enter(){if(started)return;started=true;$('poster').hidden=true;app.classList.remove('cover-visible');status('');}
function position(time){const t=clamp(time);master.currentTime=t;effects.currentTime=t;sharedTime=t;lastFrameTime=t;}
function seek(time){if(!ready||!Number.isFinite(time))return;const t=clamp(time),resume=playing&&mode==='local';enter();if(t>=DURATION||resume)pause();ended=t>=DURATION;position(t);draw(t);buttons();if(resume&&t<DURATION)void play();}
function finish(){if(ended)return;requestId++;stopLocal();audioElements.forEach(a=>a.pause());playing=false;pending=false;ended=true;finishedAt=performance.now();stop();draw(DURATION);buttons();status('');}
function fail(error){pause();failed=true;$('loader').hidden=true;status(`播放遇到问题：${error.message}。可刷新重试；此演示需要完整 Chrome/Edge 与 WebGL2。`,true);}
function tick(){
  raf=0;if(!playing)return;
  const t=clockTime();
  if(t>=DURATION||(mode!=='local'&&clockAudio().ended)){finish();return;}
  try{maxGap=Math.max(maxGap,t-lastFrameTime);lastFrameTime=t;draw(t);frames++;
    // Custom music and SFX are AudioBufferSources scheduled on one AudioContext.
    // GPU stalls cannot introduce a second media clock or trigger audible reseeks.
    raf=requestAnimationFrame(tick);
  }catch(error){fail(error);}
}
function ensureSoundGraph(){
  if(!soundContext){
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)throw new Error('此浏览器不支持本地空间混音');
    // Match the 48kHz authored SFX. Chromium's default 44.1kHz resample was
    // measured to discard one frame (29.999977s) from these exact 30s files.
    soundContext=new AudioContext({sampleRate:48000});
    dry=soundContext.createGain();wet=soundContext.createGain();spaceFilter=soundContext.createBiquadFilter();
    graphOutput=soundContext.createGain();analyser=soundContext.createAnalyser();analyser.fftSize=256;
    graphOutput.connect(analyser);analyser.connect(soundContext.destination);
    spaceFilter.type='lowpass';spaceFilter.frequency.value=6800;spaceFilter.Q.value=.35;
    dry.connect(graphOutput);
    const echoL=soundContext.createDelay(.5),echoR=soundContext.createDelay(.5);
    echoL.delayTime.value=.093;echoR.delayTime.value=.141;
    const panL=soundContext.createStereoPanner(),panR=soundContext.createStereoPanner();panL.pan.value=-.7;panR.pan.value=.7;
    spaceFilter.connect(echoL);spaceFilter.connect(echoR);echoL.connect(panL);echoR.connect(panR);panL.connect(wet);panR.connect(wet);wet.connect(graphOutput);
  }
  const space=$('music-treatment').value==='space';dry.gain.value=space?.82:1;wet.gain.value=space?.13:0;
  updateVolume();
}
async function prepareSpace(){
  ensureSoundGraph();
  await soundContext.resume();
}
function startLocal(t,token){
  if(!localBuffer||!sfxBuffer)throw new Error('本地音频尚未完成解码');
  stopLocal();sharedTime=t;sharedStart=soundContext.currentTime+.045;sharedRunning=true;
  const music=soundContext.createBufferSource(),sfx=soundContext.createBufferSource();
  music.buffer=localBuffer;sfx.buffer=sfxBuffer;
  music.connect(dry);music.connect(spaceFilter);sfx.connect(graphOutput);localSources=[music,sfx];
  scheduledMusic={at:sharedStart,offset:offset+t,duration:DURATION-t};
  scheduledEffects={at:sharedStart,offset:t,duration:DURATION-t};
  sfx.onended=()=>{if(token===requestId&&sharedRunning&&sharedClock()>=DURATION-.002)finish();};
  music.start(sharedStart,offset+t,DURATION-t);sfx.start(sharedStart,t,DURATION-t);
}
async function play(){
  if(!ready||playing||pending)return;
  pending=true;const token=++requestId;
  try{
    if(ended||clockTime()>=DURATION-.001){ended=false;position(0);}
    enter();draw(clockTime());
    if(mode==='local')await prepareSpace();
    if(token!==requestId)return;
    if(mode==='local'){audioElements.forEach(a=>a.pause());startLocal(clockTime(),token);}
    else{audioElements.filter(a=>a!==clockAudio()).forEach(a=>a.pause());await clockAudio().play();}
    if(token!==requestId||document.hidden){stopLocal();audioElements.forEach(a=>a.pause());return;}
    playing=true;frames=0;began=performance.now();finishedAt=0;maxGap=0;lastFrameTime=clockTime();clockCorrections=0;
    stop();raf=requestAnimationFrame(tick);buttons();status('');app.focus({preventScroll:true});
  }catch(error){if(token===requestId)fail(error);}finally{pending=false;}
}
function replay(){pause();ended=false;position(0);enter();draw(0);void play();}
function fullscreen(start=false){if(document.fullscreenElement===app){if(!start)void document.exitFullscreen();}else void app.requestFullscreen().catch(()=>status('未能进入全屏，仍可在窗口中播放。',true));if(start)void play();}
function openSettings(){pause();$('settings-dialog').showModal();}
function waitAudio(audio,{metadata=false}={}){return new Promise((resolve,reject)=>{
  if((metadata?audio.readyState>=1:audio.readyState>=3)&&Number.isFinite(audio.duration)){resolve();return;}
  const control=new AbortController();const timer=setTimeout(()=>{control.abort();reject(new Error('音频加载超时'));},30000);
  const done=(error)=>{clearTimeout(timer);control.abort();error?reject(error):resolve();};
  audio.addEventListener(metadata?'loadedmetadata':'canplay',()=>done(),{signal:control.signal});
  audio.addEventListener('error',()=>done(new Error('无法解码音频；请使用完整浏览器并保留 audio 文件夹')),{signal:control.signal});audio.load();
});}
async function loadMusic(file){
  if(!file)return;
  pause();const loadId=++musicLoadId,newURL=URL.createObjectURL(file),oldURL=localURL;
  $('music-file-status').textContent='正在读取本地音频…';local.src=newURL;localURL=newURL;
  try{
    ensureSoundGraph();
    const [decoded,decodedSfx]=await Promise.all([
      file.arrayBuffer().then(buffer=>soundContext.decodeAudioData(buffer)),
      sfxBuffer||fetch(effects.currentSrc||effects.src).then(r=>r.arrayBuffer()).then(buffer=>soundContext.decodeAudioData(buffer)),
    ]);
    if(loadId!==musicLoadId)return;
    if(!Number.isFinite(decoded.duration)||decoded.duration<DURATION-.002)throw new Error('所选音频需至少30秒');
    localBuffer=decoded;sfxBuffer=decodedSfx;localDuration=decoded.duration;localFileName=file.name;offset=0;
    $('music-offset').value='0';$('music-offset').max=String(Math.max(0,localDuration-DURATION));$('music-offset').disabled=false;
    $('music-treatment').disabled=false;$('sound-mode').querySelector('[value="local"]').disabled=false;
    mode='local';$('sound-mode').value=mode;ended=false;position(0);
    $('cover-sound').textContent='♪ 本地用户配乐 + 同步动作音效';
    $('music-file-status').textContent=`已载入 ${file.name} · ${localDuration.toFixed(2)}秒 · 仅本地使用，不上传。`;
    status('');if(started)draw(0);
  }catch(error){
    if(loadId===musicLoadId){mode='demo';$('sound-mode').value=mode;local.removeAttribute('src');local.load();URL.revokeObjectURL(newURL);localURL=null;localBuffer=null;localDuration=0;localFileName='';
      $('music-file-status').textContent=`无法使用：${error.message}`;$('music-offset').disabled=true;$('music-treatment').disabled=true;$('sound-mode').querySelector('[value="local"]').disabled=true;
      $('cover-sound').textContent='♪ 原创演示底轨 · 未含电影主题';}
  }finally{if(oldURL)URL.revokeObjectURL(oldURL);}
}
function setMode(value){
  const t=clockTime();pause();if(value==='local'&&!localURL)return;
  mode=value;position(t);$('cover-sound').textContent=value==='local'?'♪ 本地用户配乐 + 同步动作音效':value==='sfx'?'♪ 仅动作音效':'♪ 原创演示底轨 · 未含电影主题';
}
async function setQuality(value){
  if(!ready||pending)return;
  pause();const t=clockTime();quality=value;ready=false;$('loader-text').textContent='重新配置渲染画幅…';$('loader').hidden=false;
  try{world.resize(value==='cinematic'?1280:960,value==='cinematic'?720:540);draw(t,{poster:!started});ready=true;$('loader').hidden=true;}
  catch(error){fail(error);}
}
$('start').addEventListener('click',()=>failed?location.reload():void play());$('start-full').addEventListener('click',()=>fullscreen(true));
$('toggle').addEventListener('click',()=>playing||pending?pause():void play());$('replay').addEventListener('click',replay);$('end-replay').addEventListener('click',replay);
$('timeline').addEventListener('input',event=>seek(Number(event.target.value)));$('fullscreen').addEventListener('click',()=>fullscreen());
$('mute').addEventListener('click',()=>{muted=!muted;updateVolume();$('mute').setAttribute('aria-pressed',String(muted));$('mute').setAttribute('aria-label',muted?'开启声音':'静音');$('mute').textContent=muted?'♩':'♪';});
$('volume').addEventListener('input',e=>{volume=Number(e.target.value);updateVolume();});
$('settings').addEventListener('click',openSettings);$('poster-settings').addEventListener('click',openSettings);
$('close-settings').addEventListener('click',()=>$('settings-dialog').close());
$('settings-dialog').addEventListener('click',e=>{if(e.target===$('settings-dialog'))$('settings-dialog').close();});
$('gentle').addEventListener('change',()=>{reduced=$('gentle').checked;draw(clockTime(),{poster:!started});});
$('show-info').addEventListener('change',()=>{infoShown=$('show-info').checked;draw(clockTime(),{poster:!started});});
$('quality').addEventListener('change',()=>void setQuality($('quality').value));
$('sound-mode').addEventListener('change',()=>setMode($('sound-mode').value));
$('music-file').addEventListener('change',()=>void loadMusic($('music-file').files[0]));
$('music-offset').addEventListener('change',()=>{pause();offset=Math.max(0,Math.min(localDuration-DURATION,Number($('music-offset').value)||0));$('music-offset').value=String(offset);position(clockTime());});
$('music-treatment').addEventListener('change',()=>{if(soundContext)ensureSoundGraph();});
for(const element of [master,effects]){
  element.addEventListener('ended',()=>{if(mode!=='local'&&element===clockAudio()&&element.ended&&element.currentTime>=DURATION-.02)finish();});
  element.addEventListener('error',()=>{if(ready)fail(new Error('本地演示音轨缺失或无法解码'));});
}
app.addEventListener('pointermove',controls);app.addEventListener('pointerdown',controls);app.addEventListener('focusin',controls);
document.addEventListener('fullscreenchange',()=>{fit();controls();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(playing||pending))pause();});
document.addEventListener('keydown',event=>{
  if($('settings-dialog').open||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,select,textarea,[contenteditable]'))return;
  if(event.code==='Space'&&event.target.closest('button,a'))return;
  if(!['Space','ArrowLeft','ArrowRight','KeyR','KeyF','KeyM'].includes(event.code))return;
  event.preventDefault();if(event.repeat&&!['ArrowLeft','ArrowRight'].includes(event.code))return;
  if(event.code==='Space')playing||pending?pause():void play();else if(event.code==='ArrowLeft')seek(clockTime()-1);else if(event.code==='ArrowRight')seek(clockTime()+1);
  else if(event.code==='KeyR')replay();else if(event.code==='KeyF')fullscreen();else $('mute').click();controls();
});
window.__ODYSSEY2__={
  get ready(){return ready;},get state(){return{ready,playing,pending,ended,time:clockTime(),displayedTime:drawTime,duration:DURATION,mode,
    stage:stage.dataset.stage,quality,reduced,frames,elapsedMs:began?(finishedAt||performance.now())-began:0,maxFrameGap:maxGap,
    audioDuration:mode==='local'?sfxBuffer?.duration:clockAudio().duration,muted,volume,localLoaded:!!localBuffer,localDuration,localFileName,offset,localTime:mode==='local'?offset+sharedClock():local.currentTime,
    treatment:$('music-treatment').value,audioGraph:!!soundContext,clockCorrections,clockType:mode==='local'?'AudioContext shared sample clock':'HTMLAudioElement',
    scheduledMusic,scheduledEffects,audioContextState:soundContext?.state,audioContextRate:soundContext?.sampleRate,themeAdaptation:false,musicNotice:MUSIC_NOTICE};},
  play,pause,seek,replay,sample,inspect:t=>world?.inspect(t),render(t){pause();seek(t);return world?.inspect();},snapshot:()=>world?.snapshot(),
  get renderInfo(){return renderInfo;},get timeline(){return{stages:STAGES,events:EVENTS,duration:DURATION,bar:BAR};},
};
async function init(){
  try{
    await Promise.all([document.fonts.ready,waitAudio(master),waitAudio(effects)]);
    if(Math.abs(master.duration-DURATION)>.065||Math.abs(effects.duration-DURATION)>.065)throw new Error('音轨时长不是30秒');
    world=await createHD2DScene($('world'),{width:1280,height:720,quality:'cinematic',onContextLost:()=>{ready=false;fail(new Error('WebGL上下文已丢失，需刷新重建'));}});
    draw(0,{poster:true});
    $('gpu-info').textContent=world.inspect().render.renderer;
    ready=true;$('loader').hidden=true;for(const id of ['start','start-full','toggle','replay','timeline'])$(id).disabled=false;
    $('start-label').textContent='开始演示';status('');
  }catch(error){failed=true;$('loader').hidden=true;$('start').disabled=false;$('start-label').textContent='重新加载';status(error.message,true);}
}
addEventListener('pagehide',()=>{stopLocal();audioElements.forEach(a=>a.pause());stop();world?.dispose();if(localURL)URL.revokeObjectURL(localURL);void soundContext?.close();},{once:true});
void init();