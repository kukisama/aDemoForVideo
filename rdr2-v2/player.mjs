import {createWesternWorld} from './world.mjs';

const data=JSON.parse(document.getElementById('film-data').textContent);
const $=id=>document.getElementById(id),app=$('cinema'),stage=$('stage'),audio=$('music');
const duration=data.duration,clamp=t=>Math.max(0,Math.min(duration,t));
let world=null,ready=false,started=false,playing=false,pending=false,ended=false,failure='';
let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let raf=0,hideTimer=0,requestId=0,lastCaption=-2,lastChapter=-1,lastUI=-Infinity;
let frames=0,began=0,finishedAt=0,previousTime=0,maxGap=0,lastSeek=null,renderedTime=0;
const chapterAt=t=>data.chapters.findIndex(c=>t>=c.start&&t<c.end);
const chapterFor=t=>data.chapters[chapterAt(t)]||data.chapters.at(-1);
const format=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const normalize=t=>{t=clamp(t);if(lastSeek!==null&&Math.abs(t-lastSeek)<1e-6)return lastSeek;return t;};
$('gentle').checked=reduced;audio.volume=.9;

function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);if(error){clearTimeout(hideTimer);app.classList.remove('controls-hidden');}}
function fit(){stage.style.setProperty('--fit',String(Math.min(app.clientWidth/1280,app.clientHeight/720)));}
new ResizeObserver(fit).observe(app);window.addEventListener('resize',fit);fit();
function showControls(){clearTimeout(hideTimer);app.classList.remove('controls-hidden');if(playing)hideTimer=setTimeout(()=>{if(playing&&!$('about-dialog').open)app.classList.add('controls-hidden');},1400);}
function buttons(){$('toggle').textContent=playing?'Ⅱ':ended?'↺':'▶';$('toggle').setAttribute('aria-label',playing?'暂停':ended?'重播':'播放');$('end-replay').hidden=!ended;showControls();}
function updateTime(t,force=false){const now=performance.now();if(!force&&now-lastUI<100)return;lastUI=now;$('time').textContent=`${format(t)} / 03:00`;$('time-code').textContent=`${format(t)} / 03:00`;$('timeline').value=String(t);$('timeline').style.setProperty('--progress',`${t/duration*100}%`);$('timeline').setAttribute('aria-valuetext',`${t.toFixed(1)} 秒，共180秒`);$('film-progress').style.setProperty('--progress',`${t/duration*100}%`);}
function render(t){
  if(!world)return;t=normalize(t);renderedTime=t;world.draw(t,{reduced});
  const chapter=chapterFor(t),index=data.chapters.indexOf(chapter),local=t-chapter.start;
  if(index!==lastChapter){lastChapter=index;stage.dataset.chapter=chapter.id;$('chapter-marker').textContent=`${String(index+1).padStart(2,'0')} / 07`;$('chapter-index').textContent=String(index+1).padStart(2,'0');$('chapter-name').textContent=chapter.name;}
  // Chapter text dissolves completely, leaving each scene room to speak.
  $('chapter-card').style.opacity=String(Math.max(0,Math.min(1,local/.6,(4.8-local)/1.2)));
  const ci=data.captions.findIndex(cue=>t>=cue.start&&t<cue.end);
  if(ci!==lastCaption){lastCaption=ci;const cue=ci>=0?data.captions[ci]:null;$('caption').textContent=cue?.text||'';$('speaker').textContent=cue?.speaker||'';$('adapted').hidden=cue?.kind!=='dialogue';$('caption-box').style.opacity=cue?'1':'0';$('caption-box').dataset.person=cue?.speaker==='亚瑟'?'arthur':cue?.speaker==='达奇'?'dutch':'narrative';}
  const title=Math.max(0,Math.min(1,(t-174)/1.6));$('end-title').hidden=title===0;$('end-title').style.opacity=String(title);
  updateTime(t);
}
function enterFilm(){if(started)return;started=true;app.classList.remove('cover-visible');$('poster').hidden=true;for(const id of ['film-header','film-footer','chapter-card','caption-box'])$(id).hidden=false;status('');}
function cancelFrame(){cancelAnimationFrame(raf);raf=0;}
function pause(){requestId++;audio.pause();playing=false;cancelFrame();updateTime(ended?duration:normalize(audio.currentTime),true);buttons();}
function fail(error){pause();ready=false;failure=error?.message||String(error);$('start').disabled=true;$('start-fullscreen').disabled=true;for(const id of ['toggle','replay','timeline'])$(id).disabled=true;$('retry').hidden=false;status(failure,true);}
function finish(){if(!started)return;audio.pause();playing=false;ended=true;finishedAt=performance.now();cancelFrame();render(duration);updateTime(duration,true);buttons();status('原《西部余烬》独立保留 · 新版《明天以西》');}
function tick(){raf=0;if(!playing)return;try{const t=normalize(audio.currentTime);if(audio.ended||t>=duration){finish();return;}maxGap=Math.max(maxGap,t-previousTime);previousTime=t;render(t);frames++;raf=requestAnimationFrame(tick);}catch(error){fail(error);}}
async function play(){
  if(!ready||pending||playing)return;pending=true;const token=++requestId;
  try{if(ended||audio.currentTime>=duration-.001){lastSeek=0;audio.currentTime=0;}ended=false;enterFilm();await audio.play();if(token!==requestId||document.hidden){audio.pause();return;}playing=true;began=performance.now();finishedAt=0;frames=0;maxGap=0;previousTime=normalize(audio.currentTime);cancelFrame();raf=requestAnimationFrame(tick);buttons();status('');app.focus({preventScroll:true});}
  catch(error){if(token===requestId){playing=false;audio.pause();buttons();status(`声音未能启动，请再点击播放。${error.message}`,true);}}
  finally{pending=false;}
}
function seek(time){if(!ready||!Number.isFinite(time))return;enterFilm();const t=clamp(time);lastSeek=t;audio.currentTime=Math.min(t,audio.duration);previousTime=t;ended=t>=duration;if(ended){audio.pause();playing=false;cancelFrame();}render(t);updateTime(t,true);buttons();}
function replay(){pause();seek(0);void play();}
function fullscreen(start=false){if(document.fullscreenElement!==app){try{void app.requestFullscreen().catch(()=>status('浏览器未允许全屏，窗口模式仍可正常观看。',true));}catch{status('当前浏览器无法进入全屏。',true);}}else if(!start)void document.exitFullscreen();if(start)void play();}
function about(){pause();$('about-dialog').showModal();}
$('start').addEventListener('click',()=>void play());$('start-fullscreen').addEventListener('click',()=>fullscreen(true));
$('toggle').addEventListener('click',()=>playing||pending?pause():void play());$('replay').addEventListener('click',replay);$('end-replay').addEventListener('click',replay);
$('timeline').addEventListener('input',e=>seek(Number(e.target.value)));$('fullscreen').addEventListener('click',()=>fullscreen());
$('volume').addEventListener('input',e=>{audio.volume=Number(e.target.value);});
$('mute').addEventListener('click',()=>{audio.muted=!audio.muted;$('mute').setAttribute('aria-pressed',String(audio.muted));$('mute').setAttribute('aria-label',audio.muted?'开启音乐':'静音');$('mute').textContent=audio.muted?'♩':'♪';});
$('about').addEventListener('click',about);$('cover-about').addEventListener('click',about);$('close-about').addEventListener('click',()=>$('about-dialog').close());
$('about-dialog').addEventListener('click',e=>{if(e.target===$('about-dialog')){const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)e.target.close();}});
$('gentle').addEventListener('change',()=>{reduced=$('gentle').checked;if(ready){if(started)render(ended?duration:audio.currentTime);else world.draw(0,{poster:true,reduced});}});
$('retry').addEventListener('click',()=>location.reload());
app.addEventListener('pointermove',showControls);app.addEventListener('pointerdown',showControls);app.addEventListener('focusin',showControls);
document.addEventListener('fullscreenchange',()=>{fit();showControls();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(playing||pending))pause();});
document.addEventListener('keydown',e=>{
  if($('about-dialog').open||e.altKey||e.ctrlKey||e.metaKey||e.target.closest('input,textarea,select,[contenteditable]'))return;
  if(e.code==='Space'&&e.target.closest('button,a'))return;if(!['Space','ArrowLeft','ArrowRight','KeyR','KeyF','KeyM'].includes(e.code))return;
  e.preventDefault();if(e.repeat&&!['ArrowLeft','ArrowRight'].includes(e.code))return;
  if(e.code==='Space')playing||pending?pause():void play();else if(e.code==='ArrowLeft')seek(audio.currentTime-3);else if(e.code==='ArrowRight')seek(audio.currentTime+3);else if(e.code==='KeyR')replay();else if(e.code==='KeyF')fullscreen();else $('mute').click();showControls();
});
// An old ended event may arrive after a seek back to zero. Check native state first.
audio.addEventListener('ended',()=>{if(audio.ended&&audio.currentTime>=duration-.002)finish();});
audio.addEventListener('seeking',()=>{const t=normalize(audio.currentTime);if(ready&&started&&Math.abs(t-renderedTime)>1e-6)render(t);});
audio.addEventListener('error',()=>{if(ready)fail(new Error('本地音乐无法解码。请用完整 Chrome / Edge 打开，并保留 HTML 同级的 audio 文件夹。'));});
$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();fail(new Error('三维图形上下文已丢失，请重新载入。此版本不会自动替换成旧二维画面。'));});
function audioReady(){return new Promise((resolve,reject)=>{if(audio.readyState>=3){resolve();return;}const controller=new AbortController();const timer=setTimeout(()=>{controller.abort();reject(new Error('音乐载入超时，请检查 audio/master.mp3 并使用 Chrome / Edge。'));},30000);const done=error=>{clearTimeout(timer);controller.abort();error?reject(error):resolve();};audio.addEventListener('canplay',()=>done(),{signal:controller.signal});audio.addEventListener('error',()=>done(new Error('音乐无法打开，请保留 audio 文件夹，使用完整 Chrome / Edge 浏览器。')),{signal:controller.signal});/* The fixed src + preload=auto already starts loading; do not cancel it with load(). */});}
async function init(){
  try{await Promise.all([audioReady(),(async()=>{await document.fonts.ready;world=createWesternWorld($('world'),data);world.resize(1280,720);world.draw(0,{poster:true,reduced});})()]);if(Math.abs(audio.duration-duration)>.04)throw new Error('音轨长度与新版三分钟时间轴不一致。');ready=true;for(const id of ['start','start-fullscreen','toggle','replay','timeline'])$(id).disabled=false;$('start-label').textContent='走进故事';status('建议戴上耳机 · 前奏有意留白 · 本地离线播放');}
  catch(error){fail(error);}
}
window.__WESTERN2__={
  get ready(){return ready;},get data(){return data;},get captions(){return data.captions;},get chapters(){return data.chapters;},get shots(){return data.shots;},
  get state(){const t=ended?duration:normalize(audio.currentTime),info=world?.info()||null;return{ready,started,time:t,renderedTime,playing,pending,ended,duration,audioDuration:audio.duration,chapter:chapterFor(t).id,caption:$('caption').textContent,speaker:$('speaker').textContent,frames,elapsedMs:began?(finishedAt||performance.now())-began:0,maxFrameGap:maxGap,reduced,source:audio.currentSrc,error:failure,renderInfo:info};},
  play,pause,seek,replay,render(t){pause();seek(t);return world?.snapshot()||null;},info(){return world?.info()||null;},snapshot(){return world?.snapshot()||null;},
};
void init();