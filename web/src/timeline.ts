export const BPM = 128
export const BEAT = 60 / BPM
export const DURATION = 64 * BEAT
export const FPS = 60

export const CHAPTERS = [
  { start: 0, end: 7.5, title: '诞生', name: 'THE SPARK', code: '01' },
  { start: 7.5, end: 15, title: '引力', name: 'SHAPING CHAOS', code: '02' },
  { start: 15, end: 22.5, title: '超光速', name: 'BEYOND LIMITS', code: '03' },
  { start: 22.5, end: 30, title: '创世', name: 'GENESIS', code: '04' },
] as const

export const VOICE_CUES = [
  { at: 0.65, end: 3.4, text: '起初，什么也没有。', file: 'voice-01.mp3' },
  { at: 4.1, end: 7.1, text: '直到，一个念头。', file: 'voice-02.mp3' },
  { at: 11.4, end: 13.6, text: '打破规则。', file: 'voice-03.mp3' },
  { at: 19.7, end: 21.9, text: '越过想象。', file: 'voice-04.mp3' },
  { at: 26.15, end: 29.15, text: '一念，万物。', file: 'voice-05.mp3' },
] as const

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
export const smooth = (a: number, b: number, v: number) => {
  const x = clamp((v - a) / (b - a))
  return x * x * (3 - 2 * x)
}
export const easeOut = (v: number) => 1 - (1 - clamp(v)) ** 4
export const chapterAt = (time: number) => Math.min(3, Math.floor(clamp(time, 0, DURATION) / 7.5))
export const beatAt = (time: number) => Math.min(63, Math.floor(clamp(time, 0, DURATION) / BEAT))
export const pulseAt = (time: number) => Math.exp(-((Math.max(0, time) / BEAT) % 1) * 7)
export const subtitleAt = (time: number) => VOICE_CUES.find(cue => time >= cue.at && time < cue.end)?.text ?? ''

export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}