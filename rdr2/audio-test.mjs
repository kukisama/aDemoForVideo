/** Offline score + delivered-signal regression tests. No browser or audio playback.
 * node <absolute path>/rdr2/audio-test.mjs [--structure]
 * Default includes full decode/R128/peak/silence checks, not only metadata assertions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { BPM, BEAT, DURATION, TOTAL_BEATS, CHAPTERS } from './story.mjs';
import { AUDIO_DIR, SR, FRAMES, SPB, BAR, THEME, CUES, contract, buildScore, getTools, verify, scanPCM } from './score.mjs';

const structuralOnly=process.argv.includes('--structure');
const score=buildScore();
const act=id=>score.events.filter(e=>CHAPTERS[e.section].id===id);
const report=()=>JSON.parse(readFileSync(join(AUDIO_DIR,'report.json'),'utf8'));
const palette=new Set(['whistle','guitar','banjo','reed','bass','strings','horn','piano','kick','snare','brush','tom','hoof','rim','hat','ride','cymbal','wind']);

test('exact 180s / 128 BPM / 384 beats / 96 bars, all unequal chapter boundaries',()=>{
  assert.equal(contract(),true);assert.equal(BPM,128);assert.equal(BEAT,.46875);
  assert.equal(DURATION,180);assert.equal(TOTAL_BEATS,384);assert.equal(FRAMES,8640000);
  assert.equal(SPB,22500);assert.equal(BAR,90000);
  assert.deepEqual(CHAPTERS.map(c=>c.bars),[4,8,8,10,6,8,8,6,8,8,8,6,8]);
  assert.equal(score.bars.length,96);
});

test('eight newly authored bars and deterministic event program',()=>{
  assert.equal(THEME.length,8);assert.deepEqual(THEME[0].map(n=>n[1]),[74,77,76,69]);
  for(const bar of THEME) for(const [at,midi,length] of bar) {
    assert.ok(at>=0&&at<4&&length>0&&at+length<=4);
    assert.ok(Number.isInteger(at*4));assert.ok(midi>=69&&midi<=82);
  }
  assert.equal(score.eventSha256,buildScore().eventSha256);
});

test('13 distinct orchestration/rhythm programs, not volume-only copies',()=>{
  assert.equal(new Set(score.sections.map(s=>s.rhythmSignature)).size,13);
  assert.equal(new Set(score.sections.map(s=>JSON.stringify(s.eventCounts))).size,13);
  score.sections.forEach((s,i)=>{
    assert.equal(s.id,CHAPTERS[i].id);assert.equal(s.start,CHAPTERS[i].start);assert.equal(s.end,CHAPTERS[i].end);
    assert.ok(s.notes>0);assert.ok(s.instruments.length>=3);
  });
});

test('every event is on an integer-sample sixteenth grid, with no act spill or unknown sound source',()=>{
  for(const e of score.events) {
    const c=CHAPTERS[e.section];assert.ok(palette.has(e.kind));
    assert.ok(Number.isInteger(e.beat*4));assert.equal(e.sample,e.beat*SPB);
    assert.ok(e.sample>=c.start*SR&&e.sample<c.end*SR);
    assert.ok(e.sample+Math.round(e.duration*SR)<=c.end*SR);
    assert.ok(e.gain>0&&e.pan>=-1&&e.pan<=1);
  }
  score.bars.forEach((b,i)=>{assert.equal(b.sample,i*BAR);assert.equal(b.beat,i*4);});
});

test('camp really remaps to F major; rider really raises F and Bb to F# and B',()=>{
  const fMajor=new Set([0,2,4,5,7,9,10]);
  for(const e of act('camp').filter(e=>['bass','guitar','banjo','reed'].includes(e.kind))) assert.ok(fMajor.has(e.midi%12));
  const rider=act('rider').filter(e=>e.kind==='whistle');
  assert.ok(rider.some(e=>e.midi%12===6));assert.ok(rider.some(e=>e.midi%12===11));
  assert.ok(rider.every(e=>e.midi%12!==5&&e.midi%12!==10));
});

test('city has an actual chromatic bass descent, frontier is six independent bars',()=>{
  assert.deepEqual(score.bars.filter(b=>b.section==='city').slice(0,6).map(b=>b.rootMidi),[38,37,36,35,34,33]);
  assert.equal(score.bars.filter(b=>b.section==='frontier').length,6);
  assert.ok(act('frontier').some(e=>e.kind==='whistle'&&e.midi%12===11));
});

test('opening has no generic dance drums; fracture is truly a cold muted duet',()=>{
  assert.ok(act('promise').every(e=>['bass','guitar','reed','whistle'].includes(e.kind)));
  const duet=act('fracture');assert.ok(duet.every(e=>['bass','guitar','reed'].includes(e.kind)));
  assert.ok(duet.filter(e=>e.kind==='guitar').every(e=>e.muted===true&&e.pan<0));
  assert.ok(duet.filter(e=>e.kind==='reed').every(e=>e.cold===true&&e.pan>0));
});

test('snow expands the motif, whistle slides are gentle, escape changes backbeat without changing BPM',()=>{
  const snow=act('snow').find(e=>e.kind==='whistle'),hero=act('arthur').find(e=>e.kind==='whistle');
  assert.equal(snow.gate,hero.gate*2);
  assert.ok(score.events.filter(e=>e.kind==='whistle'&&e.slide).every(e=>e.slide>=.025&&e.slide<=.065));
  assert.equal(act('escape').filter(e=>e.kind==='snare').length,32);
  assert.equal(act('arthur').filter(e=>e.kind==='snare').length,10);
});

test('one missing beat has no scheduled notes; riser and fade cues are exact',()=>{
  const hold=CUES.find(c=>c.id==='broken-promise-hold');
  assert.equal(hold.start,220*BEAT);assert.equal(hold.end-hold.start,BEAT);
  assert.equal(score.events.filter(e=>e.beat>=220&&e.beat<221).length,0);
  assert.ok(score.events.some(e=>e.beat===221));
  const wind=act('choice').find(e=>e.kind==='wind');assert.equal(wind.beat,320);assert.equal(wind.gate,8*BEAT);
  for(const c of CUES.filter(c=>c.beat!==undefined)) assert.equal(c.start,c.beat*BEAT);
  const fade=CUES.find(c=>c.id==='terminal-fade');assert.equal(fade.start,178.8);assert.equal(fade.end,180);
});

test('final answer remains open: only D / A / E, no major or minor third',()=>{
  const last=score.events.filter(e=>e.beat>=380),pcs=new Set(last.map(e=>e.midi%12));
  assert.deepEqual([...pcs].sort((a,b)=>a-b),[2,4,9]);
  assert.equal(last.find(e=>e.kind==='whistle').midi,76);
});

test('published provenance / compact report / bounded mix allocation',{skip:structuralOnly},()=>{
  const r=report();assert.equal(r.validation.passed,true);assert.equal(r.noVoice,true);assert.equal(r.music.original,true);
  assert.equal(r.music.eventSha256,score.eventSha256);assert.equal(r.music.eventCount,score.events.length);
  assert.equal(r.processing.masterBitReduction,false);assert.equal(r.processing.externalSamples,false);assert.equal(r.processing.TTS,false);
  assert.ok(r.music.render.allocatedMixBufferBytes<4*1024*1024);
  assert.ok(statSync(join(AUDIO_DIR,'report.json')).size<65536);
  assert.equal(r.music.events,undefined);assert.equal(r.music.render.chapterOnsets.length,13);
  assert.ok(r.music.render.chapterOnsets.every(m=>m.firstDrySample-m.scheduledSample<=2));
});

test('stale story and edited MP3 hashes are rejected before decode',{skip:structuralOnly},async()=>{
  const r=report();
  await assert.rejects(verify({}, {...r,storysha256:'0'.repeat(64)}),/Story changed/);
  await assert.rejects(verify({}, {...r,mastersha256:'0'.repeat(64)}),/MP3 hash mismatch/);
  const wrongCue=structuredClone(r);wrongCue.music.cues[1].end+=BEAT;
  await assert.rejects(verify({},wrongCue),/Stale cue/);
});

test('full delivered MP3 decode + fresh R128/true peak, not trusted report numbers',{skip:structuralOnly},async()=>{
  const r=report(),fake=structuredClone(r);fake.master.LUFS=0;fake.master.decodedDuration=1;
  const actual=await verify(getTools(),fake);assert.deepEqual(actual,r.master);
  assert.equal(actual.decodedFrames,8640000);assert.equal(actual.clipping,0);
  assert.ok(actual.quietLoudContrastDb>=5);assert.equal(actual.sceneEnergy.length,13);
});

test('24-bit archive independently probes and fully decodes to 180 seconds',{skip:structuralOnly},async()=>{
  const tools=getTools(),file=join(AUDIO_DIR,'master.wav');
  const p=spawnSync(tools.ffprobe,['-v','error','-show_streams','-of','json',file],{encoding:'utf8',windowsHide:true,maxBuffer:65536});
  assert.equal(p.status,0,p.stderr);const stream=JSON.parse(p.stdout).streams[0];
  assert.equal(stream.codec_name,'pcm_s24le');assert.equal(stream.channels,2);assert.equal(Number(stream.sample_rate),48000);
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),report().archiveSha256);
  const pcm=await scanPCM(tools,file);assert.equal(pcm.decodedFrames,FRAMES);assert.equal(pcm.clipping,0);assert.equal(pcm.nonfinite,0);
});