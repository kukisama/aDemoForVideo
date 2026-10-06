(() => {
  'use strict';
  const DATA = JSON.parse(document.getElementById('film-data').textContent);
  const DURATION = DATA.duration;
  const $ = id => document.getElementById(id);
  const app = $('cinema'), stage = $('stage'), audio = $('soundtrack');
  const scenes = DATA.chapters.map(chapter => $(chapter.id));
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = (a, b, time) => { const x = clamp((time - a) / (b - a)); return x * x * (3 - 2 * x); };
  const ease = x => 1 - Math.pow(1 - clamp(x), 4);
  const mix = (a, b, x) => a + (b - a) * x;
  const pulse = time => Math.exp(-((time * 2) % 1) * 7);
  const num = value => Math.round(value * 1000) / 1000;
  const opacity = (node, value) => { node.style.opacity = String(num(clamp(value))); };
  const transform = (node, value) => { node.style.transform = value; };
  const fade = (node, value, y = 30) => { opacity(node, value); transform(node, `translate3d(0,${num((1 - value) * y)}px,0)`); };
  const timeLabel = time => `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
  const chapterAt = time => Math.max(0, DATA.chapters.findIndex(c => time < c.end) === -1 ? DATA.chapters.length - 1 : DATA.chapters.findIndex(c => time < c.end));
  const notes = [
    '买手机，不只是买一张参数表。',
    'X500 标准版 · 2026 年 9 月上市',
    '屏幕按标准矩形测量；刷新率随场景调整。',
    '主摄 5000 万 / 长焦 6400 万 · 光路与外观为示意',
    '4K 120fps 慢动作拍摄 · 几何片段非手机实拍',
    '天玑 9600M · 3nm · OriginOS 7',
    '典型容量 7500mAh；充电功率及条件详见资料。',
    '12GB + 256GB · 官方建议价 · 核验于 2026.10.06',
  ];
  const sceneCopies = scenes.map(scene => scene.querySelector('.copy'));
  let ready = false, started = false, playing = false, ended = false, pending = false;
  let failure = false, raf = 0, controlsTimer = 0, lastChapter = -1, lastSubtitle = '', lastUI = -Infinity;
  let frameCount = 0, loopWallTime = 0, previousRenderedTime = 0, maxGap = 0;
  let playRequest = 0;
  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phones = new Map();

  function phoneMarkup() {
    return `<div class="phone">${Array.from({ length: 10 }, (_, i) => `<div class="phone-layer" style="--z:${-6 + i * 2}px"></div>`).join('')}<div class="phone-back"><div class="camera-island"><div class="camera-disc"><i class="phone-lens one"></i><i class="phone-lens two"></i><i class="phone-lens three"></i><i class="phone-lens sensor"></i><b class="zeiss-mark">ZEISS</b><b class="tstar">T*</b></div><i class="phone-sensor"></i><i class="phone-flash"></i><span class="island-note">vivo | ZEISS<br>Co-engineered</span></div><span class="back-vivo">vivo</span><div class="phone-shimmer"></div></div><div class="phone-front"><div class="phone-display"><div class="screen-wave"></div><div class="screen-wave second"></div><div class="screen-camera"></div><div class="screen-clock">09:21<small>MONDAY / 一眼心动</small></div><div class="screen-mark"></div></div></div><div class="phone-button"></div><div class="phone-button volume"></div></div>`;
  }
  document.querySelectorAll('[data-phone]').forEach((anchor, index) => {
    anchor.innerHTML = phoneMarkup();
    if (anchor.dataset.phone === 'front') anchor.classList.add('front-phone');
    phones.set(anchor.id || `phone-${index}`, { anchor, model: anchor.querySelector('.phone'), layers: [...anchor.querySelectorAll('.phone-layer')], back: anchor.querySelector('.phone-back'), front: anchor.querySelector('.phone-front'), shine: anchor.querySelector('.phone-shimmer') });
  });
  function pose(id, { rx = 8, ry = -24, rz = -10, x = 0, y = 0, scale = 1, spread = 0, shine = 0, alpha = 1 } = {}) {
    const p = phones.get(id);
    transform(p.model, `translate3d(${num(x)}px,${num(y)}px,0) rotateX(${num(rx)}deg) rotateY(${num(ry)}deg) rotateZ(${num(rz)}deg) scale(${num(scale)})`);
    opacity(p.anchor, alpha);
    p.layers.forEach((layer, i) => transform(layer, `translateZ(${num(-6 + i * 2 + (i - 4.5) * spread)}px)`));
    transform(p.back, `translateZ(${num(14 + spread * 5.5)}px)`);
    transform(p.front, `rotateY(180deg) translateZ(${num(6 + spread * 5.5)}px)`);
    p.shine.style.setProperty('--shine', `${num(shine)}px`);
  }

  const tileData = [
    ['3nm', 'PROCESS'], ['144Hz', 'DISPLAY MAX'], ['7500', 'TYPICAL mAh'],
    ['50MP', 'MAIN CAMERA'], ['4K', 'SLOW MOTION'], ['9600M', 'DIMENSITY'], ['3.1×', 'OPTICAL ZOOM'],
  ];
  $('spec-cloud').innerHTML = tileData.map(([title, subtitle]) => `<div class="spec-tile">${title}<small>${subtitle}</small></div>`).join('');
  const tiles = [...document.querySelectorAll('.spec-tile')];
  $('iris').innerHTML = Array.from({ length: 8 }, (_, i) => `<div class="iris-blade" style="transform:rotate(${i * 45}deg)"></div>`).join('');
  const optics = [...document.querySelectorAll('.optic')];
  $('film-tunnel').innerHTML = Array.from({ length: 11 }, () => '<div class="film-frame"></div>').join('');
  const frames = [...document.querySelectorAll('.film-frame')];
  $('moment-sculpture').innerHTML = Array.from({ length: 10 }, () => '<div class="moment-petal"></div>').join('');
  const petals = [...document.querySelectorAll('.moment-petal')];
  const circuitPaths = [];
  for (let side = 0; side < 4; side++) for (let i = 0; i < 8; i++) {
    const horizontal = side < 2;
    const startX = horizontal ? (side === 0 ? 730 : 1890) : 920 + i * 95;
    const startY = horizontal ? 220 + i * 87 : (side === 2 ? 105 : 959);
    const endX = horizontal ? (side === 0 ? 1110 : 1510) : 1150 + i * 46;
    const endY = horizontal ? 335 + i * 40 : (side === 2 ? 360 : 723);
    const midX = horizontal ? (startX + endX) / 2 : startX;
    const midY = horizontal ? startY : (startY + endY) / 2;
    const path = horizontal ? `M${startX} ${startY} H${midX} L${endX} ${endY} H${endX + (side ? -70 : 70)}` : `M${startX} ${startY} V${midY} L${endX} ${endY} V${endY + (side === 2 ? 70 : -70)}`;
    circuitPaths.push(`<path d="${path}"/><path class="energy" d="${path}"/><circle cx="${startX}" cy="${startY}" r="3"/>`);
  }
  $('circuit').innerHTML = circuitPaths.join('');
  const energies = [...document.querySelectorAll('.energy')];
  $('chip-pins').innerHTML = Array.from({ length: 80 }, (_, i) => {
    const side = Math.floor(i / 20), offset = 16 + (i % 20) * 22;
    const style = side === 0 ? `left:-7px;top:${offset}px` : side === 1 ? `right:-7px;top:${offset}px` : side === 2 ? `top:-7px;left:${offset}px;transform:rotate(90deg)` : `bottom:-7px;left:${offset}px;transform:rotate(90deg)`;
    return `<i class="pin" style="${style}"></i>`;
  }).join('');
  const slabs = [...document.querySelectorAll('.chip-slab')];
  $('battery-cells').innerHTML = Array.from({ length: 72 }, () => '<i class="battery-cell"></i>').join('');
  const cells = [...document.querySelectorAll('.battery-cell')];
  $('wipe').innerHTML = Array.from({ length: 10 }, () => '<i class="wipe-panel"></i>').join('');
  const wipePanels = [...document.querySelectorAll('.wipe-panel')];

  function fit() {
    const scale = Math.min(app.clientWidth / 1920, app.clientHeight / 1080);
    stage.style.setProperty('--stage-scale', String(scale));
  }
  new ResizeObserver(fit).observe(app);
  window.addEventListener('resize', fit);
  fit();

  function status(text, error = false) {
    $('status').textContent = text;
    $('status').classList.toggle('error', error);
    if (error) { app.classList.remove('controls-hidden'); clearTimeout(controlsTimer); }
  }
  function revealControls() {
    clearTimeout(controlsTimer);
    app.classList.remove('controls-hidden');
    if (playing) controlsTimer = setTimeout(() => { if (playing && !$('sources').open) app.classList.add('controls-hidden'); }, 1100);
  }
  function subtitle(time) {
    const text = DATA.captions.find(cue => time >= cue.start && time < cue.end)?.text || '';
    if (text !== lastSubtitle) { $('subtitles').textContent = text; lastSubtitle = text; }
  }
  function syncUI(time, force = false) {
    const now = performance.now();
    if (!force && now - lastUI < 100) return;
    lastUI = now;
    $('current-time').textContent = timeLabel(time);
    $('timeline').value = String(time);
    $('timeline').style.setProperty('--progress', `${time / DURATION * 100}%`);
    $('timeline').setAttribute('aria-valuetext', `${time.toFixed(1)} 秒，共 60 秒`);
    $('film-time').textContent = `${time.toFixed(2).padStart(5, '0')} / 60.00`;
  }
  function syncButtons() {
    $('toggle').textContent = playing ? 'Ⅱ' : ended ? '↺' : '▶';
    $('toggle').setAttribute('aria-label', playing ? '暂停' : ended ? '重播' : '播放');
    $('replay-overlay').hidden = !ended;
    app.classList.toggle('is-playing', playing);
    revealControls();
  }

  function render(time) {
    const t = clamp(time, 0, DURATION), chapter = chapterAt(t), info = DATA.chapters[chapter], local = t - info.start;
    const beat = reduced ? 0 : pulse(t);
    if (chapter !== lastChapter) {
      scenes.forEach((scene, index) => { scene.hidden = index !== chapter; });
      stage.classList.toggle('light-theme', scenes[chapter].dataset.theme === 'light');
      $('chapter-label').textContent = `${String(chapter + 1).padStart(2, '0')} / ${info.english}`;
      $('scene-note').textContent = notes[chapter];
      stage.dataset.chapter = info.id;
      lastChapter = chapter;
    }
    const copy = sceneCopies[chapter];
    if (copy) fade(copy, ease(local / .8), 32);

    if (chapter === 0) {
      fade($('question-line-1'), ease((local - .25) / .65), 75);
      fade($('question-line-2'), ease((local - 1.3) / .7), 90);
      fade($('question-answer'), smooth(3.25, 4.4, local), 25);
      tiles.forEach((tile, i) => {
        const enter = ease((local - i * .13) / .9), exit = smooth(4.75, 6, local);
        const a = i * .96 + local * .06;
        const x = 260 + Math.cos(a) * 230 - exit * 150;
        const y = 230 + Math.sin(a) * 200;
        const z = Math.sin(a) * 180 - exit * 500;
        transform(tile, `translate3d(${num(x)}px,${num(y + (1 - enter) * 100)}px,${num(z)}px) rotateY(${num(-18 + Math.sin(a) * 15)}deg) rotateZ(${num(Math.cos(a) * 8)}deg) scale(${num(.8 + enter * .2)})`);
        opacity(tile, enter * (1 - exit) * .85);
      });
      transform($('question-orbit'), `rotateZ(${num(local * 7)}deg) scale(${num(1 + beat * .022)})`);
    } else if (chapter === 1) {
      const enter = ease(local / 1.3);
      pose('reveal-phone', { rx: mix(20, 6, enter) + Math.sin(local * .8) * 2, ry: mix(-95, -20, enter) + Math.sin(local * .6) * 12, rz: mix(-32, 12, enter), x: (1 - enter) * 180, y: (1 - enter) * 90 + Math.sin(local) * 9, scale: .92 + enter * .08, shine: -400 + local * 110 });
      opacity($('reveal-phone'), enter);
      transform(document.querySelector('.reveal-word'), `translateX(${num(45 - local * 9)}px)`);
    } else if (chapter === 2) {
      const split = smooth(.8, 2.7, local) * (1 - smooth(5.3, 6.8, local));
      pose('design-phone', { rx: -5 + local * 1.3, ry: 26 + split * 42, rz: -9 + Math.sin(local * .45) * 7, x: split * -35, y: Math.sin(local * .7) * 12, spread: split * 5.5, shine: local * 95 - 350 });
      transform($('design-disc'), `rotate(${num(local * 4)}deg) scale(${num(.96 + beat * .015)})`);
      fade($('glass-label'), smooth(.7, 1.7, local), 35);
      fade($('metal-label'), smooth(2.1, 3, local), 35);
      fade($('refresh-label'), smooth(3.3, 4.3, local), 35);
    } else if (chapter === 3) {
      const lensOpen = smooth(.1, 1.8, local) * (1 - smooth(5.1, 8.1, local));
      const change = local >= 1.25;
      $('camera-number').textContent = change ? '64' : '50';
      $('camera-role').textContent = change ? '6400 万像素蔡司 APO 超级长焦' : '5000 万像素蔡司高动态主摄';
      $('camera-chip').textContent = change ? 'APO SUPER TELEPHOTO' : 'HIGH DYNAMIC RANGE';
      transform($('lens-assembly'), `rotateY(${num(-22 + Math.sin(local * .45) * 12)}deg) rotateX(${num(12 + Math.sin(local * .3) * 4)}deg) rotateZ(${num(-7 + local * 1.2)}deg) scale(${num(.96 + beat * .018)})`);
      optics.forEach((node, i) => transform(node, `translateZ(${num(-140 + i * 54 + (i - 2.5) * lensOpen * 21)}px) scale(${num(.65 + i * .07)})`));
      const frontGlass = 134 + lensOpen * 52.5;
      transform(document.querySelector('.lens-center'), `translateZ(${num(frontGlass)}px)`);
      transform(document.querySelector('.lens-reflection'), `translateZ(${num(frontGlass + 5)}px)`);
      transform($('iris'), `translateZ(${num(frontGlass + 2)}px) rotate(${num(local * 18)}deg) scale(${num(.75 + (1 - lensOpen) * .25)})`);
      fade($('zoom-number'), smooth(3.05, 3.7, local), 30);
    } else if (chapter === 4) {
      const slowed = local < 2.2 ? local * 1.6 : 3.52 + (local - 2.2) * .24;
      frames.forEach((node, i) => {
        const phase = (i / frames.length + local * .08) % 1;
        const z = -1700 + phase * 2300;
        transform(node, `translate3d(${num(Math.sin(i * .7 + local * .2) * 32)}px,0,${num(z)}px) rotateZ(${num(-17 + phase * 31 + Math.sin(local * .35) * 6)}deg)`);
        opacity(node, Math.sin(phase * Math.PI) * .6);
      });
      petals.forEach((node, i) => {
        const theta = i / petals.length * Math.PI * 2 + slowed * .26;
        const reach = 43 + smooth(0, 4, local) * 27;
        transform(node, `translate3d(${num(Math.cos(theta) * reach)}px,${num(Math.sin(theta) * reach)}px,${num(Math.sin(theta) * 90)}px) rotateY(${num(i * 18 + slowed * 16)}deg) rotateX(${num(52 + Math.cos(theta) * 17)}deg) rotateZ(${num(i * 36 + slowed * 18)}deg) scale(${num(.88 + i * .022)})`);
      });
      transform($('moment-sculpture'), `rotateZ(${num(-16 + Math.sin(local * .5) * 9)}deg) scale(${num(ease(local / .8))})`);
      $('motion-counter').textContent = `00:${String(Math.floor(slowed)).padStart(2, '0')}:${String(Math.floor(slowed * 120) % 120).padStart(3, '0')}`;
    } else if (chapter === 5) {
      const joined = ease((local - .25) / 2.5);
      transform($('chip-assembly'), `rotateX(${num(53 - Math.sin(local * .35) * 6)}deg) rotateZ(${num(-30 + local * 2.5)}deg) translateY(${num(Math.sin(local * .7) * 13)}px) scale(${num(.92 + beat * .016)})`);
      slabs.forEach((node, i) => transform(node, `translateZ(${num(-65 + i * 40 + (i - 1.5) * (1 - joined) * 85)}px)`));
      energies.forEach((node, i) => { node.style.strokeDashoffset = String(num(-local * 110 + i * 70)); opacity(node, .18 + .45 * ((Math.sin(local * 2 + i) + 1) / 2)); });
    } else if (chapter === 6) {
      const filled = smooth(0, 3.6, local);
      transform($('battery-world'), `translateY(${num((1 - ease(local / 1)) * 95 + Math.sin(local * .75) * 10)}px) rotate(${num(-10 + Math.sin(local * .6) * 3)}deg) scale(${num(.98 + beat * .012)})`);
      cells.forEach((node, i) => {
        const row = Math.floor(i / 6), column = i % 6;
        const level = 1 - row / 12;
        opacity(node, .14 + smooth(level - .13, level + .12, filled) * .74 + Math.sin(local * 3 - row * .8 + column * .3) * .035);
      });
      document.querySelectorAll('.charge-ring').forEach((node, i) => transform(node, `translateY(${num(Math.sin(local * 1.4 + i * 2) * 65)}px) rotate(${num(-18 - i * 10 + Math.sin(local) * 4)}deg)`));
    } else {
      const unveil = smooth(55.48, 55.80, t), signoff = smooth(57.50, 58.30, t);
      fade($('finale-ask'), 1 - smooth(54.9, 55.42, t), -50);
      opacity($('price-reveal'), unveil);
      transform($('price-reveal'), `translate3d(${num(signoff * -16)}px,${num((1 - unveil) * 70 + signoff * 410)}px,0) scale(${num(mix(1, .35, signoff))})`);
      $('price-reveal').style.transformOrigin = 'left top';
      $('price-reveal').classList.toggle('compact', signoff > .98);
      fade($('finale-slogan'), signoff, 45);
      pose('final-back', { ry: -21 + Math.sin(local * .35) * 7, rx: 6, rz: 11, y: (1 - ease(local / 1.1)) * 90 + Math.sin(local * .8) * 5, shine: -450 + local * 120, alpha: ease(local / 1.1) });
      pose('final-front', { ry: 158 - Math.sin(local * .4) * 5, rx: -3, rz: -11, x: -20 * signoff, y: 17 + Math.sin(local * .7) * 6, alpha: ease(local / 1.3) });
      fade($('endline'), signoff, 15);
    }

    let nearest = null;
    for (const c of DATA.chapters.slice(1)) if (t > c.start - .34 && t < c.start + .50) nearest = c.start;
    const transition = nearest === null ? 0 : (t - nearest + .34) / .84;
    wipePanels.forEach((node, i) => {
      if (nearest === null || reduced) { transform(node, 'translateY(110%)'); return; }
      const p = clamp(transition * 1.35 - i * .033);
      const y = p < .5 ? mix(110, 0, ease(p * 2)) : mix(0, -110, ease((p - .5) * 2));
      transform(node, `translateY(${num(y)}%) skewY(${num((1 - Math.sin(p * Math.PI)) * 5)}deg)`);
    });
    const pricePulse = t >= 55.6215 && t < 55.84 ? (1 - (t - 55.6215) / .2185) * (reduced ? .02 : .10) : 0;
    opacity($('impact'), pricePulse);
    subtitle(t);
    syncUI(t);
  }

  function showFilm() {
    if (started) return;
    started = true;
    $('cover').hidden = true;
    app.classList.remove('cover-visible');
    $('status').textContent = '';
  }
  function stopLoop() { cancelAnimationFrame(raf); raf = 0; }
  function finish() {
    audio.pause(); playing = false; ended = true;
    stopLoop(); render(60); syncUI(60, true); syncButtons();
    status('让日常，自带电影感。');
  }
  function tick() {
    raf = 0;
    if (!playing) return;
    const t = Math.min(DURATION, audio.currentTime);
    if (t >= DURATION || audio.ended) { finish(); return; }
    maxGap = Math.max(maxGap, t - previousRenderedTime); previousRenderedTime = t;
    render(t); frameCount++;
    raf = requestAnimationFrame(tick);
  }
  async function play() {
    if (!ready || pending || playing) return;
    const request = ++playRequest;
    pending = true;
    try {
      if (ended || audio.currentTime >= DURATION - .01) audio.currentTime = 0;
      showFilm(); ended = false;
      const playback = audio.play();
      await playback;
      if (request !== playRequest || document.hidden) { audio.pause(); return; }
      playing = true;
      previousRenderedTime = audio.currentTime;
      frameCount = 0; maxGap = 0; loopWallTime = performance.now();
      stopLoop(); raf = requestAnimationFrame(tick);
      status(''); syncButtons();
      app.focus({ preventScroll: true });
    } catch (error) {
      playing = false; audio.pause(); syncButtons();
      status(`无法开始声音播放，请再次点击播放。${error.message}`, true);
    } finally { pending = false; }
  }
  function pause() {
    playRequest++; audio.pause(); playing = false;
    stopLoop(); syncButtons(); syncUI(Math.min(audio.currentTime, DURATION), true);
  }
  function seek(time) {
    if (!ready || !Number.isFinite(time)) return;
    showFilm();
    const t = clamp(time, 0, DURATION);
    ended = t >= DURATION;
    audio.currentTime = Math.min(t, audio.duration);
    previousRenderedTime = t;
    render(t); syncUI(t, true);
    if (ended) { audio.pause(); playing = false; stopLoop(); }
    syncButtons();
  }
  function replay() { pause(); seek(0); void play(); }
  function fullscreen(andPlay = false) {
    try {
      if (document.fullscreenElement === app) {
        if (!andPlay) void document.exitFullscreen();
      } else void app.requestFullscreen().catch(() => status('当前浏览器未允许原生全屏；仍可正常播放。', true));
    } catch { status('当前浏览器不支持原生全屏。', true); }
    if (andPlay) void play();
  }
  $('start').addEventListener('click', () => { if (failure) location.reload(); else void play(); });
  $('fullscreen-start').addEventListener('click', () => fullscreen(true));
  $('toggle').addEventListener('click', () => (playing || pending) ? pause() : void play());
  $('restart').addEventListener('click', replay);
  $('replay-overlay').addEventListener('click', replay);
  $('timeline').addEventListener('input', event => seek(Number(event.target.value)));
  $('mute').addEventListener('click', () => {
    audio.muted = !audio.muted;
    $('mute').setAttribute('aria-pressed', String(audio.muted));
    $('mute').setAttribute('aria-label', audio.muted ? '开启声音' : '静音');
    $('mute').textContent = audio.muted ? '♩' : '♪';
  });
  $('fullscreen').addEventListener('click', () => fullscreen());
  $('sources-button').addEventListener('click', () => { pause(); $('sources').showModal(); });
  $('close-sources').addEventListener('click', () => $('sources').close());
  $('sources').addEventListener('click', event => { if (event.target === $('sources')) $('sources').close(); });
  app.addEventListener('pointermove', revealControls);
  app.addEventListener('pointerdown', revealControls);
  app.addEventListener('focusin', revealControls);
  document.addEventListener('fullscreenchange', () => { fit(); revealControls(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && (playing || pending)) pause(); });
  document.addEventListener('keydown', event => {
    if ($('sources').open || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable]')) return;
    if (event.code === 'Space' && event.target.closest('button,a')) return;
    if (!['Space', 'ArrowLeft', 'ArrowRight', 'KeyR', 'KeyF', 'KeyM'].includes(event.code)) return;
    event.preventDefault();
    if (event.repeat && !['ArrowLeft', 'ArrowRight'].includes(event.code)) return;
    if (event.code === 'Space') (playing || pending) ? pause() : void play();
    else if (event.code === 'ArrowLeft') seek(audio.currentTime - 2);
    else if (event.code === 'ArrowRight') seek(audio.currentTime + 2);
    else if (event.code === 'KeyR') replay();
    else if (event.code === 'KeyF') fullscreen();
    else if (event.code === 'KeyM') $('mute').click();
    revealControls();
  });
  audio.addEventListener('ended', finish);
  audio.addEventListener('seeking', () => { if (ready && started) render(Math.min(audio.currentTime, DURATION)); });
  audio.addEventListener('error', () => {
    pause(); failure = true;
    status('本地音轨未能打开。请将 X500.html 与 x500 文件夹保持同级，然后重新打开。', true);
  });

  async function init() {
    app.classList.add('cover-visible');
    try {
      await Promise.all([
        document.fonts.load('500 120px "Space Grotesk"'),
        document.fonts.load('400 20px "IBM Plex Mono"'),
        new Promise((resolve, reject) => {
          if (audio.readyState >= 3) { resolve(); return; }
          const controller = new AbortController();
          const timeout = setTimeout(() => { controller.abort(); reject(new Error('音轨加载超时')); }, 25000);
          audio.addEventListener('canplay', () => { clearTimeout(timeout); controller.abort(); resolve(); }, { signal: controller.signal });
          audio.addEventListener('error', () => { clearTimeout(timeout); controller.abort(); reject(new Error('音轨不存在或格式不受支持')); }, { signal: controller.signal });
          audio.load();
        }),
      ]);
      if (Math.abs(audio.duration - DURATION) > .06) throw new Error('音轨不是一分钟版本');
      audio.volume = .9;
      ready = true;
      for (const id of ['start', 'fullscreen-start', 'toggle', 'restart', 'timeline']) $(id).disabled = false;
      $('start-label').textContent = '开始发布';
      status('建议戴上耳机 · 已准备好 60 秒');
    } catch (error) {
      failure = true; $('start-label').textContent = '重新加载'; $('start').disabled = false;
      status(`准备失败：${error.message}`, true);
    }
  }
  window.__X500__ = {
    get ready() { return ready; },
    get state() { const t = Math.min(audio.currentTime, DURATION); return { time: t, playing, ended, duration: DURATION, audioDuration: audio.duration, chapter: DATA.chapters[chapterAt(t)].id, subtitle: lastSubtitle, frames: frameCount, elapsedMs: loopWallTime ? performance.now() - loopWallTime : 0, maxFrameGap: maxGap, dimensions: { width: stage.getBoundingClientRect().width, height: stage.getBoundingClientRect().height }, currentSource: audio.currentSrc }; },
    play, pause, seek, replay,
    render(time) { pause(); seek(time); return this.state; },
    get facts() { return DATA.facts; },
    get captions() { return DATA.captions; },
    setReduced(value) { reduced = !!value; if (started) render(audio.currentTime); },
  };
  void init();
})();