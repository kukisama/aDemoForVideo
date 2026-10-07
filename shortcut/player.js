(() => {
  'use strict';
  const $=id=>document.getElementById(id),data=JSON.parse($('film-data').textContent);
  const app=$('cinema'),stage=$('stage'),audio=$('music'),world=createShortcutWorld($('world'),data),duration=data.duration;
  let ready=false,started=false,playing=false,pending=false,ended=false,failed=false,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf=0,requestId=0,hideTimer=0,lastChapter=-1,lastCaption=-2,lastUI=0,frames=0,began=0,finishedAt=0,maxGap=0,previousTime=0;
  const clamp=t=>Math.max(0,Math.min(duration,t));
  const chapterAt=t=>{const index=data.chapters.findIndex(ch=>t<ch.end);return index<0?data.chapters.length-1:index;};
  const shotAt=t=>(data.shots.find(shot=>t<shot.end)||data.shots.at(-1)).id;
  const timeText=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
  $('gentle').checked=reduced;
  function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);if(error){clearTimeout(hideTimer);app.classList.remove('controls-hidden');}}
  function fit(){stage.style.setProperty('--fit',String(Math.min(app.clientWidth/1536,app.clientHeight/864)));}
  new ResizeObserver(fit).observe(app);window.addEventListener('resize',fit);fit();
  function controls(){clearTimeout(hideTimer);app.classList.remove('controls-hidden');if(playing)hideTimer=setTimeout(()=>{if(playing&&!$('about-dialog').open)app.classList.add('controls-hidden');},1100);}
  function buttons(){$('toggle').textContent=playing?'Ⅱ':ended?'↺':'▶';$('toggle').setAttribute('aria-label',playing?'暂停':ended?'重播':'播放');$('end-replay').hidden=!ended;controls();}
  function ui(t,force=false){const now=performance.now();if(!force&&now-lastUI<90)return;lastUI=now;const stamp=`${timeText(t)} / 01:00`;$('time').textContent=stamp;$('film-time').textContent=stamp;$('timeline').value=String(t);$('timeline').style.setProperty('--progress',`${100*t/duration}%`);$('timeline').setAttribute('aria-valuetext',`${t.toFixed(1)} 秒，共 60 秒`);}
  function render(time){const t=clamp(time),index=chapterAt(t),chapter=data.chapters[index];world.draw(t,{reduced});
    if(index!==lastChapter){lastChapter=index;stage.dataset.chapter=chapter.id;$('chapter-name').textContent=chapter.name;$('chapter-count').textContent=`${String(index+1).padStart(2,'0')} / 09`;}
    stage.dataset.shot=shotAt(t);
    const ci=data.captions.findIndex(cue=>t>=cue.start&&t<cue.end);if(ci!==lastCaption){lastCaption=ci;const cue=data.captions[ci];$('caption').textContent=cue?.text||'';$('speaker').textContent=cue?.speaker||'';$('captions').style.opacity=cue?'1':'0';$('captions').dataset.kind=cue?.kind||'none';}
    $('context-label').textContent=t>=52.5?'LIFE REFLECTION / 人生类比':t>=7.5&&t<48.75?'ILLUSTRATIVE MODEL / 非实地交通数据':'ORIGINAL ALLEGORY / 原创寓言';ui(t);
  }
  function enter(){if(started)return;started=true;app.classList.remove('cover-visible');$('poster').hidden=true;for(const id of ['hud','captions','film-footer'])$(id).hidden=false;status('');}
  function stop(){cancelAnimationFrame(raf);raf=0;}
  function finish(){audio.pause();playing=false;ended=true;finishedAt=performance.now();stop();render(duration);ui(duration,true);buttons();status('改变走法，不是放弃抵达。');}
  function tick(){raf=0;if(!playing)return;const t=clamp(audio.currentTime);if(t>=duration||audio.ended){finish();return;}maxGap=Math.max(maxGap,t-previousTime);previousTime=t;render(t);frames++;raf=requestAnimationFrame(tick);}
  async function play(){if(!ready||pending||playing)return;pending=true;const token=++requestId;
    try{if(ended||audio.currentTime>=duration-.005)audio.currentTime=0;ended=false;enter();await audio.play();if(token!==requestId||document.hidden){audio.pause();return;}playing=true;frames=0;began=performance.now();finishedAt=0;previousTime=audio.currentTime;maxGap=0;stop();raf=requestAnimationFrame(tick);buttons();status('');app.focus({preventScroll:true});}
    catch(error){if(token===requestId){playing=false;audio.pause();buttons();status(`暂时无法播放，请再点击一次。${error.message}`,true);}}finally{pending=false;}
  }
  function pause(){requestId++;audio.pause();playing=false;stop();if(started){render(clamp(audio.currentTime));ui(clamp(audio.currentTime),true);}buttons();}
  function seek(time){if(!ready||!Number.isFinite(time))return;enter();const t=clamp(time);audio.currentTime=Math.min(t,audio.duration);previousTime=t;ended=t>=duration;if(ended){audio.pause();playing=false;stop();}render(t);ui(t,true);buttons();}
  function replay(){pause();seek(0);void play();}
  function fullscreen(start=false){try{if(document.fullscreenElement===app){if(!start)void document.exitFullscreen();}else void app.requestFullscreen().catch(()=>status('全屏未获允许，仍可正常观看。',true));}catch{status('此浏览器不支持原生全屏。',true);}if(start)void play();}
  function about(){pause();$('about-dialog').showModal();}
  $('start').addEventListener('click',()=>failed?location.reload():void play());$('start-fullscreen').addEventListener('click',()=>fullscreen(true));$('toggle').addEventListener('click',()=>playing||pending?pause():void play());$('replay').addEventListener('click',replay);$('end-replay').addEventListener('click',replay);
  $('timeline').addEventListener('input',event=>seek(Number(event.target.value)));$('fullscreen').addEventListener('click',()=>fullscreen());$('about').addEventListener('click',about);$('poster-about').addEventListener('click',about);$('close-about').addEventListener('click',()=>$('about-dialog').close());
  $('about-dialog').addEventListener('click',event=>{if(event.target===$('about-dialog'))$('about-dialog').close();});$('gentle').addEventListener('change',()=>{reduced=$('gentle').checked;if(started)render(audio.currentTime);});
  $('mute').addEventListener('click',()=>{audio.muted=!audio.muted;$('mute').setAttribute('aria-pressed',String(audio.muted));$('mute').setAttribute('aria-label',audio.muted?'开启音乐':'静音');$('mute').textContent=audio.muted?'♩':'♪';});
  app.addEventListener('pointermove',controls);app.addEventListener('pointerdown',controls);app.addEventListener('focusin',controls);document.addEventListener('fullscreenchange',()=>{fit();controls();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&(playing||pending))pause();});
  document.addEventListener('keydown',event=>{if($('about-dialog').open||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable]'))return;if(event.code==='Space'&&event.target.closest('button,a'))return;if(!['Space','ArrowLeft','ArrowRight','KeyR','KeyF','KeyM'].includes(event.code))return;event.preventDefault();if(event.repeat&&!['ArrowLeft','ArrowRight'].includes(event.code))return;
    if(event.code==='Space')playing||pending?pause():void play();else if(event.code==='ArrowLeft')seek(audio.currentTime-data.bar);else if(event.code==='ArrowRight')seek(audio.currentTime+data.bar);else if(event.code==='KeyR')replay();else if(event.code==='KeyF')fullscreen();else $('mute').click();controls();});
  // Ignore a stale ended event after seeking from the end back to the start.
  audio.addEventListener('ended',()=>{if(audio.ended&&audio.currentTime>=duration-.065)finish();});audio.addEventListener('seeking',()=>{if(ready&&started)render(clamp(audio.currentTime));});
  audio.addEventListener('error',()=>{pause();failed=true;status('音乐未能读取，请保留 HTML 同级的 audio 文件夹。',true);});
  async function init(){app.classList.add('cover-visible');world.draw(0,{poster:true});
    try{await Promise.all([document.fonts.ready,new Promise((resolve,reject)=>{if(audio.readyState>=3){resolve();return;}if(audio.error){reject(new Error('本地音乐无法读取'));return;}const control=new AbortController();const timer=setTimeout(()=>{control.abort();reject(new Error('音乐载入超时'));},25000);audio.addEventListener('canplay',()=>{clearTimeout(timer);control.abort();resolve();},{signal:control.signal});audio.addEventListener('error',()=>{clearTimeout(timer);control.abort();reject(new Error('音乐无法解码或文件缺失'));},{signal:control.signal});})]);
      if(Math.abs(audio.duration-duration)>.065)throw new Error('音轨长度与故事版本不符');audio.volume=.8;ready=true;for(const id of ['start','start-fullscreen','toggle','replay','timeline'])$(id).disabled=false;$('start-label').textContent='开始故事';status('60 秒 · 二维画面 · 原创音乐');
    }catch(error){failed=true;$('start').disabled=false;$('start-label').textContent='重新加载';status(`准备失败：${error.message}`,true);}
  }
  window.__SHORTCUT__={get ready(){return ready;},get state(){const t=ended?duration:clamp(audio.currentTime);return {time:t,playing,pending,ended,failed,duration,audioDuration:audio.duration,chapter:data.chapters[chapterAt(t)].id,shot:shotAt(t),caption:$('caption').textContent,speaker:$('speaker').textContent,reduced,frames,elapsedMs:began?(finishedAt||performance.now())-began:0,maxFrameGap:maxGap,source:audio.currentSrc,traffic:trafficAt(t)};},get captions(){return data.captions;},get chapters(){return data.chapters;},get shots(){return data.shots;},play,pause,seek,replay,render(t){pause();seek(t);return world.snapshot();},model:trafficAt};
  void init();
})();