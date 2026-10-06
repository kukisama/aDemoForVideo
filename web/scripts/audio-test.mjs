// Read-only integration checks of the actual delivered MP3s and decoded PCM master.
// Run from any directory: node <absolute path>/scripts/audio-test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { AUDIO_DIR, getTools, verifyMaster, verifyVoices } from './score.mjs';
import { BPM, BEAT, DURATION, VOICE_CUES } from '../src/timeline.ts';

const report = JSON.parse(readFileSync(join(AUDIO_DIR, 'score-report.json'), 'utf8'));
assert.equal(BPM, 128);
assert.equal(BEAT, 0.46875);
assert.equal(DURATION, 30);
assert.deepEqual(VOICE_CUES.map(({ at, end, text, file }) => ({ at, end, text, file })), [
  { at: 0.65, end: 3.4, text: '起初，什么也没有。', file: 'voice-01.mp3' },
  { at: 4.1, end: 7.1, text: '直到，一个念头。', file: 'voice-02.mp3' },
  { at: 11.4, end: 13.6, text: '打破规则。', file: 'voice-03.mp3' },
  { at: 19.7, end: 21.9, text: '越过想象。', file: 'voice-04.mp3' },
  { at: 26.15, end: 29.15, text: '一念，万物。', file: 'voice-05.mp3' },
]);
const tools = getTools();
const masterFile = join(AUDIO_DIR, 'score.wav');
const digest = createHash('sha256').update(readFileSync(masterFile)).digest('hex');
assert.equal(digest, report.masterSha256, 'Master differs from the verified build.');
const master = verifyMaster(tools, masterFile);
const voices = verifyVoices(tools, report.voices);
assert.equal(report.composition.arrangement[4].beats[0] * BEAT, 22.5);
assert.equal(report.composition.arrangement[5].beats[0] * BEAT, 23.4375);
assert.ok(report.composition.events.snare >= 16, 'Backbeats absent.');
assert.ok(report.composition.events.bass >= 48, 'Syncopated bass absent.');
assert.ok(report.composition.events.pluck >= 80, 'Arpeggios absent.');
console.log(JSON.stringify({ result: 'PASS', master, voices }, null, 2));