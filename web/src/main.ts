import '@fontsource/anton/latin-400.css'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import './player.css'
import './playback.css'
import { Film } from './film'
import { Soundtrack } from './audio'
import { CHAPTERS, DURATION, chapterAt, clamp } from './timeline'

const icons: Record<string, string> = {
  play: '<path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  sound: '<path d="M11 5 6 9H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4zM16 9l6 6m0-6-6 6"/>',
  replay: '<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/>',
  full: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
}
const icon = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`
const el = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!

el('#app').innerHTML = `
  <main class="studio">
    <header class="masthead">
      <a href="./" class="brand" aria-label="FRAME ZERO 首页"><span class="brand-mark">✳</span> FRAME ZERO<span class="brand-divider"></span><span class="brand-caption">CODE AS CINEMA</span></a>
      <span class="edition"><i></i> AN AUDIOVISUAL EXPERIMENT &nbsp; / &nbsp; 001</span>
    </header>
    <section class="intro" aria-labelledby="film-title">
      <div><div class="eyebrow">NOT FILMED. PROGRAMMED.</div><h1 id="film-title">一念 <span>·</span> GENESIS <sup>2026</sup></h1><p>从一个光点，到一整个宇宙。</p></div>
      <div class="intro-actions"><button class="cinema-button" id="fullscreen-play" disabled>${icon('full')} 全屏播放</button><button class="about-button" id="about">关于这 30 秒 ${icon('arrow')}</button></div>
    </section>
    <section class="player" id="player" aria-label="GENESIS 影片播放器">
      <div class="screen" id="screen">
        <canvas id="film" aria-label="纯代码生成的黑金宇宙短片"></canvas>
        <div class="screen-badge"><span></span> PROCEDURAL CINEMA <b>4 ACTS · 30 SEC</b></div>
        <button class="start-overlay" id="start" disabled><span class="play-orb">${icon('play')}</span><span><strong id="start-label">正在构建宇宙</strong><small>建议戴上耳机 · SOUND ON</small></span></button>
        <p class="screen-error" id="screen-error" role="alert" hidden></p>
      </div>
      <div class="transport" aria-label="播放控制">
        <button class="icon-button" id="play" aria-label="播放" title="播放 / 暂停（空格）" disabled>${icon('play')}</button>
        <button class="icon-button secondary" id="replay" aria-label="从头播放" title="从头播放（R）" disabled>${icon('replay')}</button>
        <span class="time"><span id="current">00:00</span><span class="time-divider">/</span>00:30</span>
        <label class="timeline-wrap"><span class="sr-only">播放进度</span><input id="timeline" type="range" min="0" max="30" step="0.01" value="0" aria-label="播放进度" aria-valuetext="0 秒，共 30 秒" disabled /></label>
        <button class="icon-button" id="mute" aria-label="静音" aria-pressed="false" title="静音（M）" disabled>${icon('sound')}</button>
        <button class="icon-button fullscreen-button" id="fullscreen" aria-label="全屏播放" title="全屏播放（F）" disabled>${icon('full')}<span id="fullscreen-label">全屏播放</span></button>
      </div>
      <div class="chapters" aria-label="影片章节">${CHAPTERS.map((chapter, index) => `<button class="chapter ${index === 0 ? 'active' : ''}" data-chapter="${index}" aria-label="跳转至${chapter.title}" disabled><span class="chapter-number">${chapter.code}</span><span class="chapter-title">${chapter.title}<small>${chapter.name}</small></span><span class="chapter-time">00:${chapter.start.toFixed(2).padStart(5, '0')}</span></button>`).join('')}</div>
    </section>
    <div class="below-player"><span class="engine-state" id="status" role="status">正在准备渲染引擎…</span><span class="listening-note">原创配乐 · 中文旁白 · 建议戴上耳机</span></div>
    <footer><span>零视频素材。零生成图片。<em>每一帧，都从代码诞生。</em></span><span class="motion-note">含快速运动与短暂强光 <label><input type="checkbox" id="gentle" /> 柔光</label></span></footer>
  </main>
  <dialog id="credits"><div class="dialog-head"><span class="eyebrow">BEHIND THE FRAMES</span><button class="icon-button" id="close-credits" aria-label="关闭关于">${icon('close')}</button></div><h2>不是拍出来的。<br>是写出来的。</h2><p>《一念 · GENESIS》是一部 30 秒的程序化视听短片。黑洞、金属结构、粒子宇宙与超光速隧道，均由 Three.js、GLSL 与 Canvas 实时生成，没有使用视频素材或图像生成模型。</p><dl><div><dt>VISUALS</dt><dd>程序化着色器 · 三维几何 · 粒子系统</dd></div><div><dt>MUSIC</dt><dd>原创代码合成配乐 · 128 BPM · 64 拍</dd></div><div><dt>VOICE</dt><dd>中文 Yunxi 合成旁白 · 本地音频</dd></div><div><dt>CINEMA</dt><dd>代码实时绘制 · 跟随音频时钟</dd></div></dl><p class="credits-note">全部字体与音频随项目提供，播放无需在线服务。空格暂停，← → 跳转，M 静音，F 全屏，R 重播。地址加上 ?cinema 可隐藏页面边框，方便外部录屏。</p></dialog>
`

let film: Film
let sound: Soundtrack
let ready = false
let failed = false
let everStarted = false
let pendingPlay = false
let interruptedTime: number | null = null
let raf = 0
let hideTimer = 0
let lastUI = -Infinity
let lastPlayState = ''
let lastChapter = -1
let frameCount = 0
let lastRenderMs = 0
let elapsedMs = 0
let metricsSince: number | null = null
const canvas = el<HTMLCanvasElement>('#film')
const slider = el<HTMLInputElement>('#timeline')
const start = el<HTMLButtonElement>('#start')
const startLabel = el('#start-label')
const player = el('#player')
const playButton = el<HTMLButtonElement>('#play')
const fullscreenButton = el<HTMLButtonElement>('#fullscreen')
const muteButton = el<HTMLButtonElement>('#mute')
const status = el('#status')
const screenError = el('#screen-error')
const current = el('#current')
const gentle = el<HTMLInputElement>('#gentle')
const credits = el<HTMLDialogElement>('#credits')
const chapterButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-chapter]'))
const cinema = new URLSearchParams(location.search).has('cinema')
document.documentElement.classList.toggle('cinema', cinema)

function message(text: string, error = false) {
  status.textContent = text
  status.classList.toggle('error', error)
  screenError.hidden = !error
  if (error) screenError.textContent = text
}

function revealControls() {
  window.clearTimeout(hideTimer)
  player.classList.remove('controls-hidden')
  if (sound?.playing && (cinema || document.fullscreenElement === player)) {
    hideTimer = window.setTimeout(() => {
      if (sound.playing) player.classList.add('controls-hidden')
    }, 1000)
  }
}

function update(force = false, now = performance.now()) {
  const time = sound?.time ?? 0
  const playing = sound?.playing ?? false
  const state = playing ? 'playing' : time >= DURATION ? 'ended' : 'paused'
  if (state !== lastPlayState) {
    lastPlayState = state
    playButton.innerHTML = icon(playing ? 'pause' : state === 'ended' ? 'replay' : 'play')
    playButton.setAttribute('aria-label', playing ? '暂停' : state === 'ended' ? '重播' : '播放')
    player.classList.toggle('is-playing', playing)
    revealControls()
  }
  const hideStart = playing || (everStarted && time < DURATION)
  if (start.hidden !== hideStart) start.hidden = hideStart
  if (ready) {
    const label = time >= DURATION ? '再看一次' : '进入这 30 秒'
    if (startLabel.textContent !== label) startLabel.textContent = label
  }
  if (!force && now - lastUI < 100) return
  lastUI = now
  current.textContent = `00:${String(Math.floor(time)).padStart(2, '0')}`
  slider.value = String(time)
  slider.style.setProperty('--progress', `${time / DURATION * 100}%`)
  slider.setAttribute('aria-valuetext', `${time.toFixed(1)} 秒，共 30 秒`)
  const chapter = chapterAt(time)
  if (chapter !== lastChapter) {
    lastChapter = chapter
    chapterButtons.forEach((button, index) => {
      button.classList.toggle('active', chapter === index)
      button.setAttribute('aria-current', chapter === index ? 'step' : 'false')
    })
  }
}

function renderAt(time: number, poster = false) {
  const began = performance.now()
  film.render(time, poster)
  lastRenderMs = performance.now() - began
}

function metricElapsed() {
  return elapsedMs + (metricsSince === null ? 0 : performance.now() - metricsSince)
}

function resetMetrics() {
  frameCount = 0
  lastRenderMs = 0
  elapsedMs = 0
  metricsSince = sound?.playing ? performance.now() : null
}

function stopLoop() {
  cancelAnimationFrame(raf)
  raf = 0
  if (metricsSince !== null) {
    elapsedMs += performance.now() - metricsSince
    metricsSince = null
  }
}

function startLoop() {
  if (metricsSince === null) metricsSince = performance.now()
  if (!raf) raf = requestAnimationFrame(tick)
}

function tick(now: number) {
  raf = 0
  if (!sound.playing) { stopLoop(); update(true); return }
  const time = sound.time
  renderAt(time)
  // Only frames actually drawn by requestAnimationFrame count toward playback FPS.
  frameCount++
  if (time >= DURATION) {
    sound.seek(DURATION)
    stopLoop()
    message('宇宙落幕。想再看一次吗？')
    update(true, now)
    return
  }
  update(false, now)
  raf = requestAnimationFrame(tick)
}

async function play() {
  if (!ready || pendingPlay || sound.playing) return
  pendingPlay = true
  interruptedTime = null
  try {
    if (canvas.width !== 1920 || canvas.height !== 1080) film.resize(1920, 1080)
    await sound.play()
    // A pause, seek or hidden page during AudioContext.resume must win.
    if (interruptedTime !== null || document.hidden) {
      sound.pause()
      if (interruptedTime !== null) sound.seek(interruptedTime)
      update(true)
      revealControls()
      return
    }
    everStarted = true
    player.classList.add('has-started')
    startLoop()
    message('一念，万物。')
    update(true)
  } catch (error) {
    sound.pause()
    stopLoop()
    update(true)
    message(`播放未能开始，请再次点击播放：${String(error)}`, true)
  }
  finally { pendingPlay = false }
}

function pause() {
  if (!sound) return
  if (pendingPlay) interruptedTime = sound.time
  sound.pause()
  stopLoop()
  update(true)
  revealControls()
  message('已暂停 · 每一帧都值得停留')
}

function seek(time: number) {
  if (!ready || !Number.isFinite(time)) return
  const target = clamp(time, 0, DURATION)
  if (pendingPlay) interruptedTime = target
  sound.seek(target)
  everStarted = true
  player.classList.add('has-started')
  renderAt(sound.time)
  // seek(30) stops Soundtrack; also stop this loop so replay can start a fresh RAF.
  if (sound.playing) startLoop()
  else stopLoop()
  update(true)
  revealControls()
  if (!sound.playing) message(target >= DURATION ? '宇宙落幕。想再看一次吗？' : '已定位 · 点击播放继续')
}

function fullscreenPlay() {
  if (!ready) return
  // Request synchronously in the click handler, before Soundtrack.play awaits.
  try {
    if (document.fullscreenElement !== player) {
      void player.requestFullscreen().catch(() => message('浏览器未允许全屏，仍可在此播放；?cinema 可铺满窗口。', true))
    }
  } catch { message('浏览器不支持原生全屏；?cinema 可铺满窗口。', true) }
  void play()
}

function fullscreen() {
  if (document.fullscreenElement === player) {
    void document.exitFullscreen().catch(() => message('无法退出全屏，请按 Esc。', true))
  } else fullscreenPlay()
}

function togglePlay() {
  if (sound?.playing || pendingPlay) pause()
  else void play()
}

start.addEventListener('click', () => { if (failed) location.reload(); else void play() })
playButton.addEventListener('click', togglePlay)
el('#replay').addEventListener('click', () => { seek(0); void play() })
slider.addEventListener('input', () => seek(Number(slider.value)))
muteButton.addEventListener('click', () => {
  if (!ready) return
  const muted = sound.toggleMute()
  muteButton.innerHTML = icon(muted ? 'mute' : 'sound')
  muteButton.setAttribute('aria-label', muted ? '开启声音' : '静音')
  muteButton.setAttribute('aria-pressed', String(muted))
})
el('#fullscreen-play').addEventListener('click', fullscreenPlay)
fullscreenButton.addEventListener('click', fullscreen)
document.addEventListener('fullscreenchange', () => {
  const label = document.fullscreenElement === player ? '退出全屏' : '全屏播放'
  el('#fullscreen-label').textContent = label
  fullscreenButton.setAttribute('aria-label', label)
  fullscreenButton.title = `${label}（F）`
  revealControls()
})
player.addEventListener('pointermove', revealControls)
player.addEventListener('pointerdown', revealControls)
player.addEventListener('focusin', revealControls)
chapterButtons.forEach(button => button.addEventListener('click', () => seek(CHAPTERS[Number(button.dataset.chapter)].start)))
el('#about').addEventListener('click', () => {
  if (sound?.playing || pendingPlay) pause()
  credits.showModal()
})
el('#close-credits').addEventListener('click', () => credits.close())
credits.addEventListener('click', event => { if (event.target === credits) credits.close() })
gentle.checked = matchMedia('(prefers-reduced-motion: reduce)').matches
gentle.addEventListener('change', () => {
  if (film) {
    film.gentle = gentle.checked
    if (!sound?.playing) renderAt(sound?.time ?? 0, !everStarted)
  }
})
document.addEventListener('keydown', event => {
  if (credits.open || event.ctrlKey || event.metaKey || event.altKey) return
  revealControls()
  const target = event.target instanceof HTMLElement ? event.target : null
  // Leave range arrows, checkbox space and button activation to the browser.
  if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return
  if (event.code === 'Space' && target?.closest('button, a')) return
  if (!['Space', 'ArrowRight', 'ArrowLeft', 'KeyM', 'KeyF', 'KeyR'].includes(event.code)) return
  event.preventDefault()
  if (event.repeat && event.code !== 'ArrowRight' && event.code !== 'ArrowLeft') return
  if (event.code === 'Space') togglePlay()
  else if (event.code === 'ArrowRight') seek((sound?.time ?? 0) + 1)
  else if (event.code === 'ArrowLeft') seek((sound?.time ?? 0) - 1)
  else if (event.code === 'KeyM') muteButton.click()
  else if (event.code === 'KeyF') fullscreen()
  else if (event.code === 'KeyR') { seek(0); void play() }
})
document.addEventListener('visibilitychange', () => { if (document.hidden && (sound?.playing || pendingPlay)) pause() })

async function init() {
  let stage = 'fonts'
  try {
    await Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('400 20px "IBM Plex Mono"'), document.fonts.load('400 30px "Space Grotesk"')])
    stage = 'renderer'
    film = new Film(canvas, 1920, 1080)
    film.resize(1920, 1080)
    film.gentle = gentle.checked
    // Warm materials from each act, including the fragment reveal, before play.
    for (const time of [1, 8, 12, 17, 24]) renderAt(time)
    renderAt(0, true)
    stage = 'audio'
    message('宇宙已就绪，正在准备配乐…')
    sound = new Soundtrack()
    await sound.load()
    resetMetrics()
    ready = true
    player.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button,input').forEach(control => { control.disabled = false })
    el<HTMLButtonElement>('#fullscreen-play').disabled = false
    message('点击播放，开启这 30 秒。')
    update(true)
  } catch (error) {
    failed = true
    const hint = stage === 'renderer' ? '渲染器无法启动，请确认浏览器支持 WebGL 2 并启用硬件加速。' : stage === 'audio' ? '本地配乐未能加载。' : '字体未能加载。'
    message(`${hint} 点击重新加载重试。${String(error)}`, true)
    startLabel.textContent = '重新加载'
    start.disabled = false
  }
}

declare global {
  interface Window {
    __GENESIS__: {
      readonly ready: boolean
      readonly state: { time: number; playing: boolean; audioDuration: number; audioState: string; renderMs: number; frames: number; width: number; height: number; gpu: string; elapsedMs: number; fps: number }
      seek: typeof seek
      play: typeof play
      pause: typeof pause
      render: (time: number, width?: number, height?: number) => string
      resetMetrics: typeof resetMetrics
    }
  }
}
window.__GENESIS__ = {
  get ready() { return ready },
  get state() {
    const elapsed = metricElapsed()
    return { time: sound?.time ?? 0, playing: sound?.playing ?? false, audioDuration: sound?.buffer?.duration ?? 0, audioState: sound?.context.state ?? 'uninitialized', renderMs: lastRenderMs, frames: frameCount, width: canvas.width, height: canvas.height, gpu: film?.gpuName ?? 'uninitialized', elapsedMs: elapsed, fps: elapsed > 0 ? frameCount * 1000 / elapsed : 0 }
  },
  seek, play, pause, resetMetrics,
  render(time, width = 1920, height = 1080) {
    if (!ready) throw new Error('影片尚未准备完成。')
    if (!Number.isFinite(time) || !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) throw new Error('截图时间与尺寸必须是有效数值。')
    pause()
    film.resize(Math.round(width), Math.round(height))
    seek(time)
    return film.snapshot()
  },
}
void init()
