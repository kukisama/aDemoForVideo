/** Actual audio regression: node --test shortcut/audio-test.mjs. No browser. */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUDIO_DIR, QA_DIR, SR, FRAMES, SPB, THEME, majorNote, assertContract, buildScore,
  compose, getTools, verify, verifyProvenance, validateDecodedPCM, sha256,
} from './score.mjs';

const SELF=fileURLToPath(new URL('./score.mjs',import.meta.url));
const STORY=fileURLToPath(new URL('./story.mjs',import.meta.url));
let report, measured, tools, score;
before(() => {
  tools=getTools();
  report=JSON.parse(readFileSync(join(AUDIO_DIR,'report.json'),'utf8'));
  score=buildScore();
  measured=verify(tools,report); // Complete MP3/WAV decode + independent R128 and packet measurements.
});

test('01: literal story timing, 32 bars and sample-exact 60 seconds', () => {
  assertContract();
  assert.equal(FRAMES,2880000); assert.equal(SPB,22500);
  assert.equal(128*SPB,FRAMES); assert.equal(FRAMES/SR,60);
  assert.equal(score.bars.length,32);
  assert.deepEqual(score.chapters.map(c=>c.start),[0,7.5,15,22.5,30,37.5,45,48.75,56.25]);
  assert.equal(score.chapters.reduce((n,c)=>n+c.bars,0),32);
});
test('02: new four-bar memorable theme has the authored contour, not an old tune import', () => {
  assert.equal(THEME.length,4);
  assert.deepEqual(THEME[0].map(n=>n[1]),[79,82,81,86,84,82,79]);
  assert.deepEqual(THEME[0].slice(1).map((n,i)=>n[1]-THEME[0][i][1]),[3,-1,5,-2,-2,-3]);
  assert.equal(report.composition.themeBars,4);
  const source=readFileSync(SELF,'utf8');
  assert.doesNotMatch(source,/from\s+['"][^'"]*(?:feynman|odyssey|rdr2|x500)/i);
  assert.doesNotMatch(source,/fetch\s*\(|https?:\/\//);
  assert.equal(report.provenance.externalSamples,false);
  assert.equal(report.provenance.TTS,false);
  assert.equal(report.noVoice,true);
});
test('03: event score is deterministic and its provenance hash agrees', () => {
  assert.deepEqual(buildScore(),score);
  assert.equal(score.eventSha256,report.composition.eventSha256);
  assert.equal(score.events.length,report.composition.eventCount);
});
test('04: every onset is derived from the fixed beat/sample grid with no tempo drift', () => {
  for (const e of score.events) {
    assert.equal(e.sample,Math.round(e.beat*SPB));
    assert.ok(Number.isInteger(e.beat*4));
    assert.ok(e.sample>=0&&e.sample<FRAMES);
  }
});
test('05: two-beat rest has no hidden scheduled instrument onsets', () => {
  assert.equal(score.events.filter(e=>e.beat>=80&&e.beat<82).length,0);
  const first=score.events.find(e=>e.beat>=80);
  assert.equal(first.beat,82); assert.equal(first.sample,1845000);
});
test('06: bright reprise actually changes the original melody while preserving rhythm', () => {
  const opening=score.events.filter(e=>e.role==='theme'&&e.beat<8);
  const bright=score.events.filter(e=>e.role==='major-reprise'&&e.beat>=96&&e.beat<104);
  assert.equal(opening.length,bright.length);
  let changed=0;
  for (let i=0;i<opening.length;i++) {
    assert.equal(bright[i].beat-96,opening[i].beat);
    assert.equal(bright[i].gate,opening[i].gate);
    assert.equal(bright[i].midi,majorNote(opening[i].midi));
    if (bright[i].midi!==opening[i].midi) changed++;
  }
  assert.ok(changed>=5,`Only ${changed} actual altered notes`);
});
test('07: crowding changes orchestration and note density, not BPM', () => {
  const counts=Object.fromEntries(score.chapters.map(c=>[c.id,c.noteOnsets]));
  assert.ok(counts.rush>counts.wish);
  assert.ok(counts.gridlock>counts.wish);
  assert.ok(score.events.some(e=>e.role==='following-voice'));
  assert.ok(score.events.some(e=>e.role==='gridlock-fragment'&&e.midi===80));
});
test('08: warm 52.5-second closing uses slower, lower melody and G6 resolution', () => {
  const notes=score.events.filter(e=>e.role==='warm-augmentation');
  assert.equal(notes[0].beat*60/128,52.5);
  assert.ok(notes.every(e=>e.midi<=76&&e.gate>=.6));
  assert.equal(score.bars.at(-1).chord,'G6');
  assert.equal(notes.at(-1).midi,67);
});
test('09: input, generator, both delivered files and embedded provenance are verified', () => {
  verifyProvenance(report);
  assert.equal(report.storysha256,sha256(STORY));
  assert.equal(report.generatorSha256,sha256(SELF));
  assert.equal(report.mastersha256,sha256(join(AUDIO_DIR,'master.mp3')));
  assert.equal(report.archiveSha256,sha256(join(AUDIO_DIR,'master.wav')));
});
test('10: both COMPLETE decodes contain exactly 2,880,000 stereo frames', () => {
  for (const kind of ['mp3','wav']) {
    assert.equal(measured[kind].decodedFrames,2880000);
    assert.equal(measured[kind].decodedDuration,60);
    assert.equal(measured[kind].clipping,0); assert.equal(measured[kind].nonfinite,0);
  }
});
test('11: both files satisfy independent integrated loudness and true-peak targets', () => {
  for (const kind of ['mp3','wav']) {
    const m=measured[kind];
    assert.ok(m.LUFS>=-13&&m.LUFS<=-10.5,`${kind}: ${m.LUFS} LUFS`);
    assert.ok(m.truePeakDbTP<=-1.5,`${kind}: ${m.truePeakDbTP} dBTP`);
  }
});
test('12: stereo is neither mono nor phase-cancelled, including every act', () => {
  for (const kind of ['mp3','wav']) {
    const m=measured[kind];
    assert.ok(m.correlation>.05&&m.correlation<.985);
    assert.ok(m.sideRmsDbFS>-32); assert.ok(m.monoFoldLossDb>-3);
  }
  assert.ok(measured.chapters.every(c=>c.correlation>0));
});
test('13: archive contains every one of the 45,000 requested rest frames as exact zero', () => {
  assert.equal(measured.silence.wavExactZero.startSample,1800000);
  assert.equal(measured.silence.wavExactZero.endSampleExclusive,1845000);
  assert.equal(measured.silence.wavExactZero.frames,45000);
});
test('14: MP3 padding is accounted for and the actual silent interior is measured', () => {
  const g=measured.gapless,s=measured.silence;
  assert.equal(g.encodedFrames-g.skipSamples-g.discardPadding,2880000);
  assert.ok(g.skipSamples>0);
  assert.ok(s.mp3ExactZero.frames>=37440);
  assert.ok(s.measuredInterior.peakDbFS<=-100);
  assert.equal(s.encodedTimelineZeroStartSample,s.mp3ExactZero.startSample+g.skipSamples);
});
test('15: decoded MP3 spectral measurements prove Bb→B and F→F#', () => {
  assert.deepEqual(measured.tonalChanges.map(c=>[c.minorMidi,c.majorMidi]),[[82,83],[77,78]]);
  for (const c of measured.tonalChanges) {
    assert.ok(c.minorDominanceDb>6); assert.ok(c.majorDominanceDb>6);
  }
});
test('16: actual 30-second climax has onset contrast and at least 7dB over rethink', () => {
  const c=measured.contrast;
  assert.ok(c.climaxVsRethinkDb>=7,JSON.stringify(c));
  assert.ok(c.climaxVsRushDb>=.8,JSON.stringify(c));
  assert.ok(c.climaxOnsetRiseDb>=4,JSON.stringify(c));
});
test('17: first second, post-rest restart, closing fade and absence of accidental holes', () => {
  assert.ok(measured.opening.rmsDbFS>-25);
  assert.ok(measured.resume.rmsDbFS>-38);
  assert.ok(measured.ending.peakDbFS<-70);
  assert.ok(measured.quietRuns.every(q=>(q.start>=37.48&&q.end<=38.47)||q.start>=59.15));
});
test('18: compact report matches new measurements and does not pretend to be listening QA', () => {
  assert.deepEqual(report.measurements,measured);
  assert.equal(report.LUFS,measured.mp3.LUFS);
  assert.equal(report.truePeakDbTP,measured.mp3.truePeakDbTP);
  assert.equal(report.clipping,0); assert.equal(report.decodedFrames,2880000);
  assert.equal(report.validation.passed,true);
  assert.equal(report.validation.listeningTestPerformed,false);
  assert.equal(report.validation.browserTestPerformed,false);
  assert.ok(statSync(join(AUDIO_DIR,'report.json')).size<32000);
});
test('19: stale hashes, changed score and false provenance are REJECTED', () => {
  for (const field of ['storysha256','generatorSha256','mastersha256','archiveSha256']) {
    assert.throws(()=>verifyProvenance({...report,[field]:'0'.repeat(64)}),/SHA-256 mismatch/);
  }
  assert.throws(()=>verifyProvenance({...report,duration:59}),/contract mismatch/);
  assert.throws(()=>verifyProvenance({...report,noVoice:false}),/provenance contract/);
  assert.throws(()=>verifyProvenance({...report,composition:{...report.composition,eventSha256:'bad'}}),/schedule provenance/);
});
test('20: missing decoded samples are rejected, never silently padded by verification', () => {
  assert.throws(()=>validateDecodedPCM(new Float32Array((FRAMES-1)*2),'truncated'),/decodedFrames=2879999/);
});
test('21: nonfinite PCM and clipping are rejected', () => {
  const data=new Float32Array(FRAMES*2); data[100]=NaN; data[200]=1.1;
  assert.throws(()=>validateDecodedPCM(data,'corrupt'),/clipping=1, nonfinite=1/);
});
test('22: fake mono or inverted stereo cannot pass stereo validation', () => {
  const data=new Float32Array(FRAMES*2); data.fill(.1);
  assert.throws(()=>validateDecodedPCM(data,'mono'),/stereo\/phase/);
  for(let i=1;i<data.length;i+=2) data[i]=-.1;
  assert.throws(()=>validateDecodedPCM(data,'inverted'),/stereo\/phase/);
});
test('23: --verify is read-only, including unchanged content and mtime', () => {
  const paths=['master.mp3','master.wav','report.json'].map(n=>join(AUDIO_DIR,n));
  const snapshot=()=>paths.map(p=>({path:p,sha:sha256(p),mtimeMs:statSync(p).mtimeMs,size:statSync(p).size}));
  const before=snapshot();
  const output=execFileSync(process.execPath,[SELF,'--verify'],{encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});
  assert.equal(JSON.parse(output).passed,true);
  assert.deepEqual(snapshot(),before);
});
test('24: re-synthesis from source reproduces the FULL original premaster, no recordings loaded', () => {
  mkdirSync(QA_DIR,{recursive:true});
  const work=mkdtempSync(join(QA_DIR,'determinism-'));
  try {
    const proof=compose(work);
    assert.equal(proof.premastersha256,report.composition.premastersha256);
    assert.equal(proof.eventSha256,report.composition.eventSha256);
    assert.equal(proof.eventCount,report.composition.eventCount);
    writeFileSync(join(QA_DIR,'determinism.json'),JSON.stringify({passed:true,premastersha256:proof.premastersha256,
      eventSha256:proof.eventSha256,eventCount:proof.eventCount,frames:FRAMES,sampleRate:SR,noMediaInputs:true},null,2)+'\n');
  } finally { rmSync(work,{recursive:true,force:true}); }
});
