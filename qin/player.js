(() => {
  'use strict';
  const $=id=>document.getElementById(id), data=JSON.parse($('film-data').textContent);
  const app=$('cinema'),stage=$('stage'),dialog=$('about-dialog'),tracks=[$('music'),$('instrumental')];
  const duration=data.duration,world=createQinWorld($('world'),data);
  let active=tracks[0],ready=false,started=false,playing=false,ended=false,failed=false;
  let version=0,pending=0,raf=0,hideTimer=0,lastCaption=-2,lastChapter=-1,lastUI=0;
  let frames=0,playStart=0,playEnd=0,previousTime=0,maxFrameGap=0,renderedTime=0;
  let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,showSubtitles=true;
  const boundaries=[...new Set([0,duration,...data.shots.flatMap(x=>[x.start,x.end]),...data.captions.flatMap(x=>[x.start,x.end])])].sort((a,b)=>a-b);
  const clamp=t=>Math.max(0,Math.min(duration,t));
  // Chromium can truncate a seek to integer microseconds; only correct that error.
  const canonical=t=>{t=clamp(t);const edge=boundaries.find(b=>Math.abs(b-t)<.00000101);return edge===undefined?t:edge;};
  const chapterAt=t=>data.chapters.find(c=>t<c.end)||data.chapters.at(-1);
  const stamp=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
  const current=()=>ended?duration:canonical(active.currentTime);
  $('gentle').checked=reduced;

  function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);if(error)controls();}
  function fit(){stage.style.setProperty('--fit',String(Math.min(app.clientWidth/1536,app.clientHeight/864)));}
  new ResizeObserver(fit).observe(app);window.addEventListener('resize',fit);fit();
  function controls(){
    clearTimeout(hideTimer);app.classList.remove('controls-hidden');
    if(playing)hideTimer=setTimeout(()=>{if(playing&&!dialog.open&&!$('controls').contains(document.activeElement))app.classList.add('controls-hidden');},1400);
  }
  function buttons(){
    $('toggle').textContent=playing?'Ⅱ':ended?'↻':'▶';
    $('toggle').setAttribute('aria-label',playing?'暂停':ended?'重播':'播放');
    $('end-replay').hidden=!ended;
    const voice=active===tracks[0];$('voice').textContent=voice?'人声 开':'纯配乐';
    $('voice').setAttribute('aria-pressed',String(voice));$('voice').setAttribute('aria-label',voice?'切换为纯配乐':'开启第一人称旁白');
    controls();
  }
  function ui(t,force=false){
    const now=performance.now();if(!force&&now-lastUI<80)return;lastUI=now;
    $('time').textContent=`${stamp(t)} / 03:00`;$('timeline').value=String(t);
    $('timeline').style.setProperty('--progress',`${100*t/duration}%`);
    $('timeline').setAttribute('aria-valuetext',`${t.toFixed(1)} 秒，共 180 秒`);
  }
  function render(time){
    const t=canonical(time),chapter=chapterAt(t);renderedTime=t;world.draw(t,{reduced});
    stage.dataset.chapter=chapter.id;stage.dataset.shot=world.state.shot;
    const ci=data.chapters.indexOf(chapter);
    if(ci!==lastChapter){lastChapter=ci;$('chapter-number').textContent=String(ci+1).padStart(2,'0');$('chapter-name').textContent=chapter.name;}
    // No on-screen chapter names disclose the final answer before it is spoken.
    $('chapter').hidden=t<12||t>=174;$('fiction-note').hidden=t<150;
    const cueIndex=data.captions.findIndex(c=>t>=c.start&&t<c.end);
    if(cueIndex!==lastCaption){lastCaption=cueIndex;$('caption').textContent=data.captions[cueIndex]?.text||'';}
    $('captions').hidden=!showSubtitles;$('captions').style.opacity=cueIndex>=0?'1':'0';ui(t);
  }
  function enter(){if(started)return;started=true;app.classList.remove('cover-visible');$('poster').hidden=true;status('');}
  function stopFrame(){cancelAnimationFrame(raf);raf=0;}
  function finish(){
    ++version;pending=0;tracks.forEach(a=>a.pause());playing=false;ended=true;playEnd=performance.now();stopFrame();
    render(duration);ui(duration,true);buttons();status('');
  }
  function tick(){
    raf=0;if(!playing)return;
    const t=canonical(active.currentTime);
    if(t>=duration||(active.ended&&t>=duration-.04)){finish();return;}
    maxFrameGap=Math.max(maxFrameGap,t-previousTime);previousTime=t;render(t);frames++;raf=requestAnimationFrame(tick);
  }
  async function play(){
    if(!ready||failed||playing||pending||dialog.open)return;
    const token=++version,media=active;pending=token;
    try{
      if(ended||media.currentTime>=duration-.001)media.currentTime=0;
      ended=false;enter();await media.play();
      if(token!==version)return;
      if(document.hidden){pause();return;}
      playing=true;frames=0;playStart=performance.now();playEnd=0;previousTime=media.currentTime;maxFrameGap=0;
      stopFrame();raf=requestAnimationFrame(tick);buttons();status('');app.focus({preventScroll:true});
    }catch(error){if(token===version){media.pause();playing=false;buttons();status(`播放未能启动，请再点击一次。${error.message}`,true);}}
    finally{if(pending===token)pending=0;}
  }
  function pause(){
    ++version;pending=0;tracks.forEach(a=>a.pause());playing=false;stopFrame();
    if(started){render(current());ui(current(),true);}buttons();
  }
  function seek(value){
    if(!ready||!Number.isFinite(value))return false;
    const t=clamp(value);enter();active.currentTime=t;previousTime=t;ended=false;
    if(t>=duration)finish();else{render(t);ui(t,true);buttons();}return true;
  }
  function replay(){pause();seek(0);void play();}
  function switchVoice(){
    if(!ready||failed)return;
    const wasPlaying=playing||!!pending,t=current();pause();active=active===tracks[0]?tracks[1]:tracks[0];
    active.currentTime=t;ended=t>=duration;previousTime=t;buttons();
    if(started){render(t);ui(t,true);}if(wasPlaying&&!ended)void play();
  }
  function setMute(){const mute=!active.muted;tracks.forEach(a=>{a.muted=mute;});$('mute').setAttribute('aria-pressed',String(mute));$('mute').setAttribute('aria-label',mute?'开启声音':'静音');$('mute').textContent=mute?'静音':'声音';controls();}
  function fullscreen(start=false){
    if(document.fullscreenElement===app){if(!start)void document.exitFullscreen();}
    else if(app.requestFullscreen)void app.requestFullscreen().catch(()=>status('全屏未获允许，仍可正常窗口观看。',true));
    else status('此浏览器不支持原生全屏，仍可窗口观看。',true);
    if(start)void play();
  }
  function about(){pause();dialog.showModal();}
  $('start').addEventListener('click',()=>failed?location.reload():void play());
  $('start-fullscreen').addEventListener('click',()=>fullscreen(true));
  $('toggle').addEventListener('click',()=>playing||pending?pause():void play());
  $('replay').addEventListener('click',replay);$('end-replay').addEventListener('click',replay);
  $('timeline').addEventListener('input',e=>seek(Number(e.target.value)));
  $('fullscreen').addEventListener('click',()=>fullscreen());$('voice').addEventListener('click',switchVoice);$('mute').addEventListener('click',setMute);
  $('volume').addEventListener('input',e=>{const value=Number(e.target.value);tracks.forEach(a=>{a.volume=value;});controls();});
  $('about').addEventListener('click',about);$('poster-about').addEventListener('click',about);
  $('close-about').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});
  $('gentle').addEventListener('change',()=>{reduced=$('gentle').checked;if(started)render(current());});
  $('subtitles').addEventListener('change',()=>{showSubtitles=$('subtitles').checked;if(started)render(current());});
  $('world').addEventListener('click',()=>{if(started)playing||pending?pause():void play();});
  app.addEventListener('pointermove',controls);app.addEventListener('pointerdown',controls);app.addEventListener('focusin',controls);
  document.addEventListener('fullscreenchange',()=>{fit();controls();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(playing||pending))pause();});
  document.addEventListener('keydown',event=>{
    if(dialog.open||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable]'))return;
    if(event.code==='Space'&&event.target.closest('button,a'))return;
    if(!['Space','ArrowLeft','ArrowRight','KeyR','KeyF','KeyM','KeyV'].includes(event.code))return;
    event.preventDefault();if(event.repeat&&!['ArrowLeft','ArrowRight'].includes(event.code))return;
    if(event.code==='Space')playing||pending?pause():void play();
    else if(event.code==='ArrowLeft')seek(current()-5);else if(event.code==='ArrowRight')seek(current()+5);
    else if(event.code==='KeyR')replay();else if(event.code==='KeyF')fullscreen();
    else if(event.code==='KeyV')switchVoice();else setMute();controls();
  });
  for(const media of tracks){
    media.addEventListener('ended',()=>{if(media===active&&media.ended&&media.currentTime>=duration-.04)finish();});
    media.addEventListener('seeking',()=>{if(media===active&&ready&&started)render(canonical(media.currentTime));});
    media.addEventListener('error',()=>{pause();failed=true;status('内嵌音轨解码失败，请使用完整的 Chrome 或 Edge 浏览器打开。',true);});
  }
  function mediaReady(media){return new Promise((resolve,reject)=>{
    if(media.error){reject(new Error('内嵌音轨无法解码'));return;}if(media.readyState>=3){resolve();return;}
    const abort=new AbortController(),timer=setTimeout(()=>{abort.abort();reject(new Error('音轨载入超时'));},45000);
    const done=fn=>{clearTimeout(timer);abort.abort();fn();};
    media.addEventListener('canplay',()=>done(resolve),{signal:abort.signal});
    media.addEventListener('error',()=>done(()=>reject(new Error('内嵌音轨无法解码'))),{signal:abort.signal});
    // preload is declared once in HTML; do not restart it with audio.load().
  });}
  async function init(){
    world.draw(0,{poster:true});
    for(const source of data.sources){const li=document.createElement('li'),link=document.createElement('a');link.href=source.url;link.textContent=source.label;link.target='_blank';link.rel='noopener noreferrer';li.append(link);$('sources').append(li);}
    $('source-note').textContent=data.sourceNote;$('font-credit').textContent=data.fontCredit;
    try{
      await Promise.all([document.fonts.ready,...[400,600,700].map(weight=>document.fonts.load(`${weight} 24px "Qin Serif"`,'门外秦始皇')),...tracks.map(mediaReady)]);
      if(tracks.some(a=>Math.abs(a.duration-duration)>.065))throw new Error('音轨长度与台本不符');
      tracks.forEach(a=>{a.volume=.8;});ready=true;
      for(const id of ['start','start-fullscreen','toggle','replay','timeline'])$(id).disabled=false;
      status('画面与声音已就绪 · 单文件离线播放');world.draw(0,{poster:true});
    }catch(error){failed=true;$('start').disabled=false;$('start').textContent='重新加载';status(error.message,true);}
  }
  window.__QIN__={get ready(){return ready;},get state(){return {ready,started,playing,pending:!!pending,ended,failed,time:current(),renderedTime,duration,audioDuration:active.duration,track:active===tracks[0]?'narration':'music',muted:active.muted,volume:active.volume,reduced,showSubtitles,chapter:stage.dataset.chapter,shot:stage.dataset.shot,caption:$('caption').textContent,frames,elapsedMs:playStart?(playEnd||performance.now())-playStart:0,maxFrameGap,embedded:tracks.every(a=>a.currentSrc.startsWith('data:audio/mpeg;base64,')),audibleTrackCount:tracks.filter(a=>!a.paused&&!a.muted&&a.volume>0).length,world:world.state};},
    get shots(){return data.shots;},get captions(){return data.captions;},get chapters(){return data.chapters;},
    play,pause,seek,replay,switchVoice,render(t){pause();seek(t);return world.snapshot();}};
  void init();
})();