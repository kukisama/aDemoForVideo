import test from 'node:test'
import assert from 'node:assert/strict'
import { BEAT, BPM, DURATION, CHAPTERS, VOICE_CUES, beatAt, chapterAt, pulseAt, seededRandom, subtitleAt } from '../src/timeline.ts'

test('64 beats at 128 BPM are exactly 30 seconds', () => {
  assert.equal(BPM, 128)
  assert.equal(BEAT * 64, 30)
  assert.equal(DURATION, 30)
})
test('chapter boundaries are contiguous and bounded', () => {
  for (let i = 0; i < CHAPTERS.length; i++) {
    const chapter = CHAPTERS[i]
    assert.equal(chapterAt(chapter.start), i)
    assert.equal(chapterAt(chapter.end - 1e-6), i)
    if (i) assert.equal(CHAPTERS[i - 1].end, chapter.start)
  }
  assert.equal(chapterAt(-1), 0)
  assert.equal(chapterAt(30), 3)
  assert.equal(chapterAt(999), 3)
})
test('every beat has its own exact impact and valid index', () => {
  for (let i = 0; i < 64; i++) {
    assert.equal(beatAt(i * BEAT), i)
    assert.equal(pulseAt(i * BEAT), 1)
    assert.ok(pulseAt(i * BEAT + BEAT / 2) < .05)
  }
  assert.equal(beatAt(30), 63)
})
test('all narration cues and subtitles are ordered and within the film', () => {
  for (let i = 0; i < VOICE_CUES.length; i++) {
    const cue = VOICE_CUES[i]
    assert.ok(cue.at >= 0 && cue.end <= DURATION && cue.at < cue.end)
    if (i) assert.ok(VOICE_CUES[i - 1].end < cue.at)
    assert.equal(subtitleAt(cue.at), cue.text)
    assert.equal(subtitleAt(cue.end), '')
  }
})
test('seeded visual state is deterministic, independent of frame rate', () => {
  const a = seededRandom(160128), b = seededRandom(160128)
  for (let i = 0; i < 1000; i++) assert.equal(a(), b())
  const times = [0, 7.5, 11.25, 15, 22.5, 23.4375, 26.25, 30]
  const before = times.map(t => [chapterAt(t), beatAt(t), subtitleAt(t)])
  for (const t of [29, 3, 22, 1]) { chapterAt(t); beatAt(t); subtitleAt(t) }
  assert.deepEqual(times.map(t => [chapterAt(t), beatAt(t), subtitleAt(t)]), before)
})