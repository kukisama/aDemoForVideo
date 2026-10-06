/** Real audio regressions: node odyssey2/audio-test.mjs. Writes no files. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {DURATION,BPM,BEAT,BAR,STAGES,EVENTS} from './timeline.mjs';
import {AUDIO_DIR,SR,SPB,BAR_FRAMES,FRAMES,SELF,TIMELINE,SOUND_MODE,LOCKED_EVENTS,THEMES,
  contract,buildScore,synthEffect,renderScore,sha,getTools,verify} from './score.mjs';

const score=buildScore(),report=JSON.parse(readFileSync(join(AUDIO_DIR,'report.json'),'utf8'));
test('timeline exact: 30s /128BPM /64beats /16bars /8 stages /integer sample clock',()=>{
  assert.equal(contract(),true);assert.equal(DURATION,30);assert.equal(BPM,128);assert.equal(BEAT,.46875);assert.equal(BAR,1.875);
  assert.equal(SR,48000);assert.equal(SPB,22500);assert.equal(BAR_FRAMES,90000);assert.equal(FRAMES,1440000);
  assert.equal(STAGES.length,8);assert.equal(DURATION/BEAT,64);assert.equal(DURATION/BAR,16);
  STAGES.forEach((s,i)=>{assert.equal(s.start,i*3.75);assert.equal(s.end,(i+1)*3.75);});
});
test('exactly 14 shared events and IDs, with unchanged sample positions',()=>{
  assert.equal(score.effects.length,14);assert.equal(new Set(score.effects.map(e=>e.id)).size,14);
  assert.deepEqual(EVENTS.map(e=>[e.id,e.beat,e.kind]),LOCKED_EVENTS);
  for(const [i,e]of score.effects.entries()){
    assert.equal(e.id,EVENTS[i].id);assert.equal(e.source,'timeline.EVENTS');assert.equal(e.time,EVENTS[i].time);
    assert.equal(e.sample,e.time*SR);assert.equal(e.sample,e.beat*SPB);assert.equal(e.power,EVENTS[i].power);
  }
  assert.equal(score.effects.find(e=>e.id==='empty-string').sample,1215000);
  assert.equal(score.effects.find(e=>e.id==='far-rings').sample,1260000);
});
test('actual deterministic isolated SFX starts within 2 samples; all samples finite',()=>{
  score.effects.forEach((e,i)=>{
    const a=synthEffect(e,i),b=synthEffect(e,i);assert.deepEqual(a,b);
    const onset=a.findIndex(x=>Math.abs(x)>1e-12);assert.ok(onset>=0&&onset<=2,`${e.id}: onset=${onset}`);
    let energy=0;for(const x of a){assert.ok(Number.isFinite(x));energy+=x*x;}assert.ok(energy>1e-6);
  });
});
test('only two short newly authored melodic statements; eight distinct arrangements',()=>{
  assert.equal(THEMES.length,2);assert.deepEqual(THEMES.map(t=>t.startBeat),[0,32]);
  assert.equal(new Set(score.stages.map(s=>s.structureSha256)).size,8);
  assert.equal(score.bars.length,16);score.bars.forEach((b,i)=>assert.equal(b.startBeat,i*4));
  assert.ok(score.music.filter(e=>e.beat<8).every(e=>['lyra','harmonic'].includes(e.kind)));
  assert.ok(score.music.filter(e=>e.kind==='pulse').every(e=>e.frames<=.35*SPB+1&&e.beat>=16&&e.beat<48));
  assert.deepEqual(score.bars[2].drumAccents,[8,9.5,11]);assert.deepEqual(score.bars[3].drumAccents,[12,13.5,15]);
  assert.notDeepEqual(score.bars[6].drumAccents.map(b=>b-24),[0,1.5,3]);
});
test('quiet tension at22.5; physical string release25.3125; no end drums or laser voice',()=>{
  assert.ok(score.music.filter(e=>e.beat>=48&&e.beat<54).every(e=>e.kind==='tension'));
  assert.ok(score.music.filter(e=>e.beat>=48).every(e=>!['war','frame','pulse','brass'].includes(e.kind)));
  assert.equal(score.effects.find(e=>e.id==='empty-string').synthesis,'string-release');
  assert.equal(score.effects.find(e=>e.id==='far-rings').synthesis,'string-harmonics');
  const r=renderScore(score);assert.equal(r.drumTail.nonzeroFrames,0);
  assert.deepEqual(r.sourceHashes,report.sourcePcmSha256);assert.deepEqual(r.proof,report.sfx.events);
  for(const e of r.proof){assert.ok(e.onsetErrorSamples<=2);assert.ok(e.sfxOverMusicDb<=-6.99);assert.ok(e.maxLocal60msOverMusicDb<=2.001);}
});
test('honest original-demo provenance, actual source/generator/three-track hashes',()=>{
  assert.equal(report.soundMode,SOUND_MODE);assert.equal(report.themeAdaptation,false);assert.equal(report.externalSamples,false);
  assert.equal(report.originalThemeMissing,true);assert.match(report.notice,/电影主题变奏尚未制作/);
  assert.equal(report.timelineSha256,sha(TIMELINE));assert.equal(report.storysha256,sha(TIMELINE));assert.equal(report.generatorSha256,sha(SELF));
  assert.equal(report.music.eventSha256,score.eventSha256);
  assert.equal(report.processing.adaptiveLoudnessGain,false);assert.equal(report.processing.limiter.oversampling,4);
  assert.equal(report.processing.limiter.latency,true);assert.equal(report.processing.limiter.level,false);
  for(const [role,entry]of Object.entries(report.files)){
    assert.equal(entry.sha256,sha(join(AUDIO_DIR,`${role}.mp3`)));assert.equal(entry.referenceSha256,sha(join(AUDIO_DIR,entry.reference)));
    assert.equal(entry.timelineSha256,report.timelineSha256);assert.equal(entry.generatorSha256,report.generatorSha256);
  }
});
test('reject corrupted timeline/generator/provenance before any external tool executes',async()=>{
  await assert.rejects(verify({}, {...report,timelineSha256:'0'.repeat(64)}),/source hash changed/);
  await assert.rejects(verify({}, {...report,generatorSha256:'0'.repeat(64)}),/Generator source hash/);
  await assert.rejects(verify({}, {...report,themeAdaptation:true}),/provenance/);
  await assert.rejects(verify({}, {...report,originalThemeMissing:false}),/limitation/);
});
test('fresh complete 3track decode/R128/truepeak/stereo/silence/dynamics; not report-only',async()=>{
  const fake=structuredClone(report);fake.measurements.tracks.master.LUFS=0;fake.measurements.tracks.master.decodedFrames=1;
  const actual=await verify(getTools(),fake);assert.deepEqual(actual,report.measurements);
  for(const [role,s]of Object.entries(actual.tracks)){
    assert.equal(s.decodedFrames,1440000);assert.equal(s.decodedDuration,30);assert.equal(s.sampleRate,48000);assert.equal(s.channels,2);assert.equal(s.bitrate,256000);
    assert.equal(s.clips,0);assert.equal(s.nonfinite,0);assert.ok(s.truePeakDbTP<=-1.5,`${role}: ${s.truePeakDbTP}`);
  }
  assert.ok(actual.tracks.master.LUFS>=-15&&actual.tracks.master.LUFS<=-12);
  assert.ok(actual.tracks.master.dynamicContrastDb>=6);assert.ok(actual.tracks.master.quietRuns.every(q=>q.start>=29.15));
  assert.ok(actual.tracks.sfx.quietRuns.length>0,'Intentional sparse SFX should contain silence');
  for(const e of actual.encodedAlignment){assert.ok(Math.abs(e.lagSamples)<=2,JSON.stringify(e));assert.ok(e.correlation>.96);}
  for(const e of actual.balances){assert.ok(e.maxLocal60msOverMusicDb<=3,JSON.stringify(e));assert.ok(e.fullEventOverMusicDb<=0);}
  assert.ok(actual.losslessStemSum.relativeRmsDb< -100);assert.ok(actual.mp3StemSum.relativeRmsDb< -24);
});