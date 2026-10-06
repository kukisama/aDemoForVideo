(() => {
  'use strict';
  const data=JSON.parse(document.getElementById('film-data').textContent);
  const $=id=>document.getElementById(id);
  const app=$('cinema'),stage=$('stage'),audio=$('music'),duration=data.duration;
  const world=createPixelWorld($('world'));
  const bars=[...document.querySelectorAll('#quest-progress i')];
  let ready=false,started=false,playing=false,pending=false,ended=false,failed=false;
  let raf=0,hideTimer=0,lastChapter=-1,lastCaption='',lastUI=0,requestId=0;
  let frames=0,began=0,finishedAt=0,previousTime=0,maxGap=0;
  let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp=x=>Math.max(0,Math.min(duration,x));
  const chapterAt=t=>Math.min(data.chapters.length-1,Math.floor((t+1e-7)/6.4));
  const timeText=t=>`00:${String(Math.floor(t)).padStart(2,'0')}`;
  $('gentle').checked=reduced;
  const status=(message,error=false)=>{ $('status').textContent=message;$('status').classList.toggle('error',error);if(error){app.classList.remove('controls-hidden');clearTimeout(hideTimer);} };
  function fit(){stage.style.setProperty('--fit',String(Math.min(app.clientWidth/960,app.clientHeight/540)));}
  new ResizeObserver(fit).observe(app);window.addEventListener('resize',fit);fit();
  function controls(){clearTimeout(hideTimer);app.classList.remove('controls-hidden');if(playing)hideTimer=setTimeout(()=>{if(playing&&!$('about-dialog').open)app.classList.add('controls-hidden');},1000);}
  function buttons(){$('toggle').textContent=playing?'Ⅱ':ended?'↺':'▶';$('toggle').setAttribute('aria-label',playing?'暂停':ended?'重播':'播放');$('end-replay').hidden=!ended;controls();}
  function ui(t,force=false){const now=performance.now();if(!force&&now-lastUI<90)return;lastUI=now;$('time').textContent=`${timeText(t)} / 00:58`;$('timeline').value=String(t);$('timeline').style.setProperty('--progress',`${t/duration*100}%`);$('timeline').setAttribute('aria-valuetext',`${t.toFixed(1)} 秒，共 57.6 秒`);$('beat-label').textContent=`${String(Math.min(144,Math.floor((t+1e-7)/.4)+1)).padStart(3,'0')} / 144`;}
  function render(time){
    const t=clamp(time),index=chapterAt(t),chapter=data.chapters[index];
    world.draw(t,{reduced});
    if(index!==lastChapter){lastChapter=index;stage.dataset.chapter=chapter.id;$('chapter-tag').textContent=chapter.tag;$('chapter-number').textContent=String(index+1).padStart(2,'0');$('chapter-name').textContent=chapter.name;bars.forEach((bar,i)=>{bar.classList.toggle('done',index>i+3);bar.classList.toggle('current',index===i+3);});}
    const caption=data.captions.find(cue=>t>=cue.start&&t<cue.end)?.text||'';
    if(caption!==lastCaption){lastCaption=caption;$('caption').textContent=caption;$('caption-area').style.opacity=caption?'1':'0';}
    ui(t);
  }
  function enterFilm(){if(started)return;started=true;app.classList.remove('cover-visible');$('poster').hidden=true;for(const id of ['hud','chapter-banner','caption-area','film-footer'])$(id).hidden=false;status('');}
  function stop(){cancelAnimationFrame(raf);raf=0;}
  function finish(){audio.pause();playing=false;ended=true;finishedAt=performance.now();stop();render(duration);ui(duration,true);buttons();status('理解，才是通关密钥。');}
  function tick(){raf=0;if(!playing)return;const t=clamp(audio.currentTime);if(t>=duration||audio.ended){finish();return;}maxGap=Math.max(maxGap,t-previousTime);previousTime=t;render(t);frames++;raf=requestAnimationFrame(tick);}
  async function play(){
    if(!ready||pending||playing)return;
    pending=true;const token=++requestId;
    try{if(ended||audio.currentTime>=duration-.005)audio.currentTime=0;ended=false;enterFilm();await audio.play();if(token!==requestId||document.hidden){audio.pause();return;}playing=true;frames=0;began=performance.now();finishedAt=0;previousTime=audio.currentTime;maxGap=0;stop();raf=requestAnimationFrame(tick);buttons();status('');app.focus({preventScroll:true});}
    catch(error){playing=false;audio.pause();buttons();status(`无法播放，请再点一次开始。${error.message}`,true);}
    finally{pending=false;}
  }
  function pause(){requestId++;audio.pause();playing=false;stop();ui(clamp(audio.currentTime),true);buttons();}
  function seek(time){if(!ready||!Number.isFinite(time))return;enterFilm();const t=clamp(time);audio.currentTime=Math.min(t,audio.duration);previousTime=t;ended=t>=duration;if(ended){audio.pause();playing=false;stop();}render(t);ui(t,true);buttons();}
  function replay(){pause();seek(0);void play();}
  function fullscreen(start=false){try{if(document.fullscreenElement===app){if(!start)void document.exitFullscreen();}else void app.requestFullscreen().catch(()=>status('全屏未获允许，仍可正常播放。',true));}catch{status('浏览器未支持原生全屏。',true);}if(start)void play();}
  $('start').addEventListener('click',()=>failed?location.reload():void play());
  $('start-fullscreen').addEventListener('click',()=>fullscreen(true));
  $('toggle').addEventListener('click',()=>playing||pending?pause():void play());
  $('replay').addEventListener('click',replay);$('end-replay').addEventListener('click',replay);
  $('timeline').addEventListener('input',event=>seek(Number(event.target.value)));
  $('mute').addEventListener('click',()=>{audio.muted=!audio.muted;$('mute').setAttribute('aria-pressed',String(audio.muted));$('mute').setAttribute('aria-label',audio.muted?'开启音乐':'静音');$('mute').textContent=audio.muted?'♩':'♪';});
  $('fullscreen').addEventListener('click',()=>fullscreen());
  $('about').addEventListener('click',()=>{pause();$('about-dialog').showModal();});
  $('close-about').addEventListener('click',()=>$('about-dialog').close());
  $('about-dialog').addEventListener('click',event=>{if(event.target===$('about-dialog'))$('about-dialog').close();});
  $('gentle').addEventListener('change',()=>{reduced=$('gentle').checked;if(started)render(audio.currentTime);});
  app.addEventListener('pointermove',controls);app.addEventListener('pointerdown',controls);app.addEventListener('focusin',controls);
  document.addEventListener('fullscreenchange',()=>{fit();controls();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(playing||pending))pause();});
  document.addEventListener('keydown',event=>{
    if($('about-dialog').open||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable]'))return;
    if(event.code==='Space'&&event.target.closest('button,a'))return;
    if(!['Space','ArrowLeft','ArrowRight','KeyR','KeyF','KeyM'].includes(event.code))return;
    event.preventDefault();if(event.repeat&&!['ArrowLeft','ArrowRight'].includes(event.code))return;
    if(event.code==='Space')playing||pending?pause():void play();else if(event.code==='ArrowLeft')seek(audio.currentTime-1.6);else if(event.code==='ArrowRight')seek(audio.currentTime+1.6);else if(event.code==='KeyR')replay();else if(event.code==='KeyF')fullscreen();else $('mute').click();controls();
  });
  audio.addEventListener('ended',finish);audio.addEventListener('seeking',()=>{if(ready&&started)render(audio.currentTime);});
  audio.addEventListener('error',()=>{pause();failed=true;status('音轨无法加载。请保留 HTML 旁的 audio 文件夹，再重新打开。',true);});
  async function init(){
    app.classList.add('cover-visible');world.draw(0,{poster:true});
    try{
      await Promise.all([document.fonts.ready,new Promise((resolve,reject)=>{
        if(audio.readyState>=3){resolve();return;}const abort=new AbortController();const timer=setTimeout(()=>{abort.abort();reject(new Error('音乐加载超时'));},25000);
        audio.addEventListener('canplay',()=>{clearTimeout(timer);abort.abort();resolve();},{signal:abort.signal});audio.addEventListener('error',()=>{clearTimeout(timer);abort.abort();reject(new Error('本地音乐文件不存在或无法解码'));},{signal:abort.signal});audio.load();
      })]);
      if(Math.abs(audio.duration-duration)>.065)throw new Error('音乐版本与故事时长不匹配');
      audio.volume=.8;ready=true;for(const id of ['start','start-fullscreen','toggle','replay','timeline'])$(id).disabled=false;$('start-label').textContent='开始远征';status('纯音乐 · 建议戴上耳机');
    }catch(error){failed=true;$('start').disabled=false;$('start-label').textContent='重新加载';status(`准备失败：${error.message}`,true);}
  }
  window.__FEYNMAN__={
    get ready(){return ready;},
    get state(){const t=ended?duration:clamp(audio.currentTime);return{time:t,playing,ended,duration,audioDuration:audio.duration,chapter:data.chapters[chapterAt(t)].id,caption:lastCaption,beat:Math.min(143,Math.floor((t+1e-7)/.4)),bar:Math.min(35,Math.floor((t+1e-7)/1.6)),frames,elapsedMs:began?(finishedAt||performance.now())-began:0,maxFrameGap:maxGap,reduced,source:audio.currentSrc};},
    get captions(){return data.captions;},
    play,pause,seek,replay,
    render(t){pause();seek(t);return world.snapshot();},
  };
  void init();
})();