import { DURATION, clamp } from './timeline'

declare const __SCORE_URL__: string

/** One decoded, locally bundled master. The audio clock is the only playback clock. */
export class Soundtrack {
  readonly context = new AudioContext({ sampleRate: 48000 })
  readonly gain = this.context.createGain()
  buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private loadPromise: Promise<AudioBuffer> | null = null
  private origin = 0
  private position = 0
  playing = false
  muted = false

  constructor() {
    this.gain.gain.value = .8
    this.gain.connect(this.context.destination)
  }

  load(): Promise<AudioBuffer> {
    if (this.buffer) return Promise.resolve(this.buffer)
    if (this.loadPromise) return this.loadPromise
    this.loadPromise = fetch(__SCORE_URL__)
      .then(response => {
        if (!response.ok) throw new Error('配乐未能加载，请检查本地 audio/score.wav。')
        return response.arrayBuffer()
      })
      .then(data => this.context.decodeAudioData(data))
      .then(buffer => {
        if (Math.abs(buffer.duration - DURATION) > .03) throw new Error('配乐时长不符合 30 秒时间轴。')
        this.buffer = buffer
        return buffer
      })
      .catch(error => { this.loadPromise = null; throw error })
    return this.loadPromise
  }

  get time() { return this.playing ? clamp(this.context.currentTime - this.origin, 0, DURATION) : this.position }

  private startSource(at: number) {
    this.source?.stop()
    this.source?.disconnect()
    const source = this.context.createBufferSource()
    source.buffer = this.buffer
    source.connect(this.gain)
    source.start(0, at)
    this.source = source
    this.origin = this.context.currentTime - at
    this.position = at
    this.playing = true
  }

  async play() {
    await this.load()
    await this.context.resume()
    if (this.context.state !== 'running') throw new Error('声音尚未启用，请再次点击播放。')
    this.startSource(this.position >= DURATION ? 0 : this.position)
  }

  pause() {
    this.position = this.time
    this.playing = false
    this.source?.stop()
    this.source?.disconnect()
    this.source = null
  }

  seek(at: number) {
    const wasPlaying = this.playing
    this.pause()
    this.position = clamp(at, 0, DURATION)
    if (wasPlaying && this.position < DURATION && this.buffer) this.startSource(this.position)
  }

  toggleMute() {
    this.muted = !this.muted
    this.gain.gain.setTargetAtTime(this.muted ? 0 : .8, this.context.currentTime, .015)
    return this.muted
  }
}