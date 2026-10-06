/* Audio is the only animation clock. No frame-integrated physics or timing. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const data = JSON.parse($('film-data').textContent);
  const app = $('cinema'), stage = $('stage'), audio = $('music');
  const world = createOdysseyWorld($('world'), data), duration = data.duration;
  let ready = false, started = false, playing = false, pending = false, ended = false, failed = false;
  let requestId = 0, raf = 0, hideTimer = 0, lastChapter = -1, lastCaption = -1, lastUI = 0;
  let frames = 0, began = 0, finishedAt = 0, previousTime = 0, maxGap = 0, displayedTime = 0;
  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = t => Math.max(0, Math.min(duration, t));
  const chapterAt = t => Math.max(0, data.chapters.findIndex(ch => t >= ch.start && t < ch.end));
  const chapterIndex = t => t >= duration ? data.chapters.length - 1 : chapterAt(t);
  const timeText = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const endTitleAt = data.shots.find(shot => shot.id === 'home-coast').start;
  // Chromium stores seek positions in integer microseconds. At 144 BPM a
  // rational cut such as 10/3 becomes 3.333333, just before the intended shot.
  // Recover only the media clock's <1us grid quantization; ordinary times stay exact.
  const audioTime = () => {
    const t = clamp(audio.currentTime), grid = Math.round(t / data.beat) * data.beat;
    return Math.abs(t - grid) < .000001 ? clamp(grid) : t;
  };
  const romans = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];
  $('gentle').checked = reduced;
  audio.volume = Number($('volume').value);

  function status(message, error = false) {
    $('status').textContent = message;
    $('status').classList.toggle('error', error);
    if (error) { clearTimeout(hideTimer); app.classList.remove('controls-hidden'); }
  }
  function fit() { stage.style.setProperty('--fit', String(Math.min(app.clientWidth / 1280, app.clientHeight / 720))); }
  new ResizeObserver(fit).observe(app);
  window.addEventListener('resize', fit); fit();
  function controls() {
    clearTimeout(hideTimer); app.classList.remove('controls-hidden');
    if (playing) hideTimer = setTimeout(() => {
      if (playing && !$('about-dialog').open) app.classList.add('controls-hidden');
    }, 1500);
  }
  function buttons() {
    $('toggle').textContent = playing ? 'Ⅱ' : ended ? '↺' : '▶';
    $('toggle').setAttribute('aria-label', playing ? '暂停' : ended ? '重播' : '播放');
    $('end-replay').hidden = !ended;
    controls();
  }
  function ui(t, force = false) {
    const now = performance.now(); if (!force && now - lastUI < 100) return; lastUI = now;
    $('time').textContent = `${timeText(t)} / ${timeText(duration)}`;
    $('timeline').value = String(t);
    $('timeline').setAttribute('aria-valuetext', `${t.toFixed(1)} 秒，共 ${duration} 秒`);
  }
  function render(time) {
    const t = clamp(Number.isFinite(time) ? time : 0);
    displayedTime = t;
    const index = chapterIndex(t), chapter = data.chapters[index];
    world.draw(t, { reduced }); stage.dataset.shot = world.inspect(t).shot;
    if (index !== lastChapter) {
      lastChapter = index; stage.dataset.chapter = chapter.id;
      $('chapter-tag').textContent = chapter.tag;
      $('chapter-number').textContent = String(index + 1).padStart(2, '0');
      $('chapter-roman').textContent = `CHAPTER ${romans[index]}`;
      $('chapter-name').textContent = chapter.name;
    }
    const ci = data.captions.findIndex(cue => t >= cue.start && (t < cue.end || t === duration && cue.end === duration));
    if (ci !== lastCaption) {
      lastCaption = ci; const cue = ci >= 0 ? data.captions[ci] : null;
      $('caption').textContent = cue?.text || ''; $('speaker').textContent = cue?.speaker || '';
      $('caption-box').dataset.kind = cue?.kind || 'none';
      $('caption-box').style.opacity = cue ? '1' : '0';
    }
    const local = t - chapter.start;
    $('chapter-card').style.opacity = String(local < 2.1 ? .8 : Math.max(0, .8 - (local - 2.1) * .7));
    const endTitle = t >= endTitleAt;
    $('end-title').hidden = !endTitle;
    $('end-title').style.opacity = String(Math.min(1, Math.max(0, (t - endTitleAt) / .85)));
    ui(t);
  }
  function enterFilm() {
    if (started) return; started = true; app.classList.remove('cover-visible'); $('poster').hidden = true;
    for (const id of ['hud','chapter-card','caption-box']) $(id).hidden = false;
    status('');
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  function finish() {
    requestId++; audio.pause(); playing = false; pending = false; ended = true;
    finishedAt = performance.now(); stop(); render(duration); ui(duration, true); buttons(); status('');
  }
  function tick() {
    raf = 0; if (!playing) return;
    const t = audioTime();
    if (t >= duration || audio.ended) { finish(); return; }
    maxGap = Math.max(maxGap, t - previousTime); previousTime = t;
    render(t); frames++; raf = requestAnimationFrame(tick);
  }
  async function play() {
    if (!ready || pending || playing) return;
    pending = true; const token = ++requestId;
    try {
      if (ended || audio.currentTime >= duration - .005) audio.currentTime = 0;
      ended = false; enterFilm(); render(audioTime());
      await audio.play();
      if (token !== requestId || document.hidden) { audio.pause(); return; }
      playing = true; frames = 0; began = performance.now(); finishedAt = 0;
      previousTime = audioTime(); maxGap = 0; stop(); raf = requestAnimationFrame(tick);
      buttons(); status(''); app.focus({ preventScroll:true });
    } catch (error) {
      playing = false; audio.pause(); buttons(); status(`无法开始播放，请再点击一次。${error.message}`, true);
    } finally { pending = false; }
  }
  function pause() { requestId++; audio.pause(); playing = false; stop(); ui(ended ? duration : audioTime(), true); buttons(); }
  function seek(time) {
    if (!ready || !Number.isFinite(time)) return;
    enterFilm(); const t = clamp(time); audio.currentTime = Math.min(t, audio.duration); previousTime = t; ended = t >= duration;
    if (ended) { requestId++; audio.pause(); playing = false; stop(); }
    render(t); ui(t, true); buttons();
  }
  function replay() { pause(); seek(0); void play(); }
  function fullscreen(start = false) {
    try {
      if (document.fullscreenElement === app) { if (!start) void document.exitFullscreen(); }
      else void app.requestFullscreen().catch(() => status('原生全屏未获允许，仍可正常观看。', true));
    } catch { status('此浏览器不支持原生全屏。', true); }
    if (start) void play();
  }
  $('start').addEventListener('click', () => failed ? location.reload() : void play());
  $('start-fullscreen').addEventListener('click', () => fullscreen(true));
  $('toggle').addEventListener('click', () => playing || pending ? pause() : void play());
  $('replay').addEventListener('click', replay); $('end-replay').addEventListener('click', replay);
  $('timeline').addEventListener('input', event => seek(Number(event.target.value)));
  $('mute').addEventListener('click', () => {
    audio.muted = !audio.muted; $('mute').setAttribute('aria-pressed', String(audio.muted));
    $('mute').setAttribute('aria-label', audio.muted ? '开启音乐' : '静音'); $('mute').textContent = audio.muted ? '♩' : '♪';
  });
  $('volume').addEventListener('input', event => { audio.volume = Number(event.target.value); });
  $('fullscreen').addEventListener('click', () => fullscreen());
  const openAbout = () => { pause(); $('about-dialog').showModal(); };
  $('about').addEventListener('click', openAbout);
  $('poster-about').addEventListener('click', openAbout);
  $('close-about').addEventListener('click', () => $('about-dialog').close());
  $('about-dialog').addEventListener('click', event => { if (event.target === $('about-dialog')) $('about-dialog').close(); });
  $('gentle').addEventListener('change', () => { reduced = $('gentle').checked; if (started) render(ended ? duration : audioTime()); });
  app.addEventListener('pointermove', controls); app.addEventListener('pointerdown', controls); app.addEventListener('focusin', controls);
  document.addEventListener('fullscreenchange', () => { fit(); controls(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && (playing || pending)) pause(); });
  document.addEventListener('keydown', event => {
    if ($('about-dialog').open || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable]')) return;
    if (event.code === 'Space' && event.target.closest('button,a')) return;
    if (!['Space','ArrowLeft','ArrowRight','KeyR','KeyF','KeyM'].includes(event.code)) return;
    event.preventDefault(); if (event.repeat && !['ArrowLeft','ArrowRight'].includes(event.code)) return;
    if (event.code === 'Space') playing || pending ? pause() : void play();
    else if (event.code === 'ArrowLeft') seek(audioTime() - data.bar);
    else if (event.code === 'ArrowRight') seek(audioTime() + data.bar);
    else if (event.code === 'KeyR') replay();
    else if (event.code === 'KeyF') fullscreen();
    else $('mute').click();
    controls();
  });
  // An ended event queued by a prior end-seek can arrive after a new seek to 0.
  // Recheck native state and position instead of resurrecting a stale ending.
  audio.addEventListener('ended', () => { if (audio.ended && audioTime() >= duration - .01) finish(); });
  audio.addEventListener('seeking', () => { if (ready && started) render(ended ? duration : audioTime()); });
  audio.addEventListener('error', () => { pause(); failed = true; status('本地音乐未能打开。请保留 HTML 同级的 audio 文件夹后重试。', true); });
  async function init() {
    world.draw(0, { poster:true, reduced });
    try {
      await Promise.all([document.fonts.ready, new Promise((resolve,reject) => {
        if (audio.readyState >= 3) { resolve(); return; }
        const controller = new AbortController();
        const timer = setTimeout(() => { controller.abort(); reject(new Error('音乐加载超时')); }, 30000);
        audio.addEventListener('canplay', () => { clearTimeout(timer); controller.abort(); resolve(); }, { signal:controller.signal });
        audio.addEventListener('error', () => { clearTimeout(timer); controller.abort(); reject(new Error('请用完整 Chrome/Edge 打开，并保留同级 audio 文件夹')); }, { signal:controller.signal });
        audio.load();
      })]);
      if (Math.abs(audio.duration - duration) > .065) throw new Error('音轨版本与三分钟时间轴不符');
      ready = true;
      for (const id of ['start','start-fullscreen','toggle','replay','timeline']) $(id).disabled = false;
      $('start-label').textContent = '开始故事'; status('三分钟 · 戴上耳机，从这里启航');
    } catch (error) {
      failed = true; $('start').disabled = false; $('start-label').textContent = '重新加载'; status(`准备失败：${error.message}`, true);
    }
  }
  window.__ODYSSEY__ = {
    get ready() { return ready; },
    get state() {
      const t = ended ? duration : audioTime();
      return { time:t, displayedTime, playing, pending, ended, ready, duration, audioDuration:audio.duration,
        chapter:data.chapters[chapterIndex(t)].id, shot:stage.dataset.shot || 'poster', caption:$('caption').textContent,
        speaker:$('speaker').textContent, frames, elapsedMs:began ? (finishedAt || performance.now()) - began : 0,
        maxFrameGap:maxGap, reduced, muted:audio.muted, volume:audio.volume, source:audio.currentSrc };
    },
    get data() { return data; },
    play, pause, seek, replay, inspect:time => world.inspect(time),
    render(time) { pause(); seek(time); return world.snapshot(); },
  };
  void init();
})();