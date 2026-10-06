/** Actual delivered-signal regressions. node odyssey/audio-test.mjs [--structure]
 * No report-only substitute: default fully decodes BOTH files and reruns R128.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BPM, BEAT, DURATION, TOTAL_BEATS, CHAPTERS, SHOTS, ACTION_CUES, HOLDS } from './story.mjs';
import { AUDIO_DIR, SR, SPB, BAR_SAMPLES, FRAMES, EXPEDITION, HOME, CUES, PALETTE, contract, buildScore, holdGain, voice, getTools, probe, loudness, sha, scanPCM, assertSignal, verify } from './score.mjs';

const structuralOnly=process.argv.includes('--structure'),score=buildScore();
const act=id=>score.events.filter(e=>CHAPTERS[e.section].id===id&&e.role==='music');
const report=()=>JSON.parse(readFileSync(join(AUDIO_DIR,'report.json'),'utf8'));

test('immutable 180s / 144BPM / 432beats / 108bars / 15 chapters / 54 shots',()=>{
  assert.equal(contract(),true);assert.equal(BPM,144);assert.equal(BEAT,60/144);assert.equal(DURATION,180);assert.equal(TOTAL_BEATS,432);
  assert.equal(SR,48000);assert.equal(SPB,20000);assert.equal(BAR_SAMPLES,80000);assert.equal(FRAMES,8640000);
  assert.deepEqual(CHAPTERS.map(c=>c.bars),[4,8,6,8,12,6,8,12,10,6,4,6,8,6,4]);assert.equal(score.bars.length,108);assert.equal(SHOTS.length,54);
});
test('two independent new motifs, eight and four bars, repeatable composition',()=>{
  assert.equal(EXPEDITION.length,8);assert.equal(HOME.length,4);
  assert.deepEqual(EXPEDITION[0].map(n=>n[1]),[69,72,74]);assert.deepEqual(HOME[0].map(n=>n[1]),[69,76,74,72]);
  for(const theme of [EXPEDITION,HOME])for(const bar of theme)for(const [t,m,d] of bar){assert.ok(t>=0&&t<4&&t+d<=4);assert.ok(d>0&&m>=60&&m<=90);assert.ok(Number.isInteger(t*4));}
  assert.equal(buildScore().eventSha256,score.eventSha256);
});
test('15 distinct musical arrangements: identity excludes gain and absolute origin',()=>{
  assert.equal(new Set(score.sections.map(s=>s.structureSha256)).size,15);
  assert.equal(new Set(score.sections.map(s=>JSON.stringify(s.eventCounts))).size,15);
  for(const s of score.sections){assert.ok(s.musicEvents>0);assert.ok(s.instruments.length>=3);assert.ok(s.rhythm&&s.development);}
});
test('all musical events sample-exact, whitelisted, finite, inside their own acts',()=>{
  for(const e of score.events){assert.ok(PALETTE.includes(e.kind));assert.equal(e.sample,e.beat*SPB);assert.ok(Number.isInteger(e.beat*4));assert.ok(e.frames>0&&e.gateFrames<=e.frames);assert.ok(Number.isFinite(e.gain)&&e.gain>0&&Math.abs(e.pan)<=1);assert.ok(e.sample>=CHAPTERS[e.section].startBeat*SPB&&e.sample+e.frames<=CHAPTERS[e.section].endBeat*SPB);}
  score.bars.forEach((b,i)=>{assert.equal(b.sample,i*80000);assert.equal(b.beat,i*4);});
});
test('all 30 shared ACTION_CUES have exactly one original local SFX, never shifted',()=>{
  const effects=score.events.filter(e=>e.role==='sfx');assert.equal(effects.length,ACTION_CUES.length);
  for(const cue of ACTION_CUES){const matches=effects.filter(e=>e.cueId===cue.id);assert.equal(matches.length,1);const e=matches[0];assert.equal(e.sample,Math.round(cue.time*SR));assert.equal(e.beat,cue.beat);assert.equal(e.intensity,cue.intensity);assert.equal(e.source,'story.ACTION_CUES');assert.equal(CUES.find(c=>c.id===cue.id).sample,e.sample);}
  assert.equal(effects.find(e=>e.cueId==='arrow-release').sample,7080000);assert.equal(effects.find(e=>e.cueId==='twelve-axes').sample,7100000);assert.equal(effects.find(e=>e.cueId==='root-recognized').sample,8080000);
});
test('deterministic DSP really emits each SFX at its marker, not metadata-only',()=>{
  score.events.forEach((e,i)=>{if(e.role!=='sfx')return;const a=voice(e,i),b=voice(e,i);let first=null,energy=0;for(let n=0;n<e.frames;n++){const x=a.render(n/SR),y=b.render(n/SR);assert.equal(x,y);assert.ok(Number.isFinite(x));energy+=x*x;if(first===null&&Math.abs(x)>1e-12)first=n;}assert.ok(first!==null&&first<=8,`${e.cueId} onset ${first}`);assert.ok(energy>1e-7,`${e.cueId} empty`);});
});
test('threshold has only the incomplete home question; fleet contains the Dorian sixth',()=>{
  assert.ok(act('threshold').every(e=>['bass','wind','lyra'].includes(e.kind)));
  assert.deepEqual([...new Set(act('threshold').filter(e=>e.theme==='home-fragment').map(e=>e.midi))],[69,76]);
  assert.ok(act('fleet').some(e=>e.theme==='expedition'&&e.midi%12===6));
});
test('cyclops is four developing three-bar phases, not a repeated loop',()=>{
  const start=CHAPTERS.find(c=>c.id==='cyclops').startBeat,parts=[0,1,2,3].map(p=>act('cyclops').filter(e=>e.beat>=start+p*12&&e.beat<start+(p+1)*12));
  assert.ok(parts[0].every(e=>!['pulse','brass','strings','war'].includes(e.kind)));
  assert.ok(parts[1].some(e=>e.kind==='strings'&&e.tremolo));assert.ok(parts[2].some(e=>e.kind==='brass'));assert.ok(parts[3].some(e=>e.kind==='pulse'));assert.ok(parts[3].some(e=>e.kind==='lyra'));
});
test('hubris changes harmony; sirens has actual 3+3+2 at fixed tempo; six heads call',()=>{
  const hub=act('hubris'),start=CHAPTERS.find(c=>c.id==='hubris').startBeat;
  assert.ok(hub.some(e=>e.kind==='pulse'&&e.midi%12===1));assert.ok(hub.filter(e=>e.beat>=start+12).every(e=>e.kind!=='pulse'));
  const sirens=act('sirens').filter(e=>e.kind==='frame'),origin=CHAPTERS.find(c=>c.id==='sirens').startBeat;
  assert.deepEqual(sirens.filter(e=>e.beat<origin+4).map(e=>e.beat-origin),[0,1.5,3]);
  assert.deepEqual([...new Set(act('strait').filter(e=>e.head).map(e=>e.head))].sort(),[1,2,3,4,5,6]);
  assert.equal(new Set(act('strait').filter(e=>e.head).map(e=>e.pan)).size,6);
  assert.ok(act('storm').every(e=>e.kind!=='pulse'));assert.ok(act('storm').some(e=>e.surf));
});
test('shared hold is exactly one beat, hard zero with 8ms edges and next-beat pickup',()=>{
  const a=Math.round(HOLDS[0].start*SR),b=Math.round(HOLDS[0].end*SR);assert.equal(b-a,20000);
  for(let n=a;n<b;n++)assert.equal(holdGain(n),0);
  assert.equal(holdGain(a-384),1);assert.equal(holdGain(b+384),1);assert.ok(holdGain(a-192)>.4&&holdGain(a-192)<.6);
  assert.equal(score.events.filter(e=>e.sample>=a&&e.sample<b).length,0);assert.ok(score.events.some(e=>e.sample===b&&e.kind==='lyra'));
});
test('bow tension ends exactly on release, no drum accompaniment; hall has both full themes',()=>{
  const draw=act('bow').find(e=>e.kind==='tension');assert.equal(draw.beat,344);assert.equal(draw.sample+draw.gateFrames,7080000);
  assert.ok(act('bow').every(e=>['lyra','bass','tension'].includes(e.kind)));
  const hall=act('hall');for(let bar=0;bar<8;bar++){assert.ok(hall.some(e=>e.theme==='expedition'&&e.themeBar===bar));assert.ok(hall.some(e=>e.theme==='home'&&e.themeBar===bar%4));}
});
test('root and home really have no drums; warm major thirds and complete 1.5s fade',()=>{
  const drums=new Set(['war','frame','metal']);for(const id of ['drift','ithaca','bow','root','home'])assert.ok(act(id).every(e=>!drums.has(e.kind)));
  assert.ok(act('root').every(e=>['lyra','bass'].includes(e.kind)));
  assert.ok(act('home').some(e=>e.theme==='home'&&e.midi%12===1));
  assert.deepEqual(CUES.find(c=>c.id==='terminal-fade'),{id:'terminal-fade',start:178.5,end:180,source:'original master envelope'});
});
test('published events and provenance, measured SFX levels, memory bound',{skip:structuralOnly},()=>{
  const r=report();assert.equal(r.validation.passed,true);assert.equal(r.noVoice,true);assert.equal(r.music.original,true);
  assert.equal(r.music.eventSha256,score.eventSha256);assert.deepEqual(JSON.parse(readFileSync(join(AUDIO_DIR,'events.json'),'utf8')),score.events);
  assert.ok(r.music.render.allocatedMixBufferBytes<4*1024*1024);assert.equal(r.music.render.renderedEvents,score.events.length);assert.equal(r.music.render.cueProof.length,30);
  for(const c of r.music.render.cueProof){assert.ok(c.onsetErrorSamples<=8);assert.ok(c.sfxOverMusicDb<=-6,JSON.stringify(c));assert.equal(c.sample,Math.round(ACTION_CUES.find(a=>a.id===c.id).time*SR));}
  assert.ok(r.music.render.chapterOnsets.every(c=>c.firstDrySample-c.scheduledSample<=8));
  assert.equal(r.processing.adaptiveLoudnessGain,false);assert.equal(r.processing.masterBitReduction,false);assert.equal(r.processing.externalSamples,false);assert.equal(r.processing.TTS,false);assert.equal(r.processing.limiter.level,false);assert.equal(r.processing.limiter.oversampling,4);
});
test('stale story/generator/master/events/cues cannot pass before decoding',{skip:structuralOnly},async()=>{
  const r=report();await assert.rejects(verify({}, {...r,storysha256:'0'.repeat(64)}),/Story changed/);await assert.rejects(verify({}, {...r,generatorSha256:'0'.repeat(64)}),/Generator changed/);await assert.rejects(verify({}, {...r,mastersha256:'0'.repeat(64)}),/MP3 hash mismatch/);
  await assert.rejects(verify({}, {...r,eventsSha256:'0'.repeat(64)}),/Event file hash mismatch/);
  const wrong=structuredClone(r);wrong.music.cues[0].time+=BEAT;await assert.rejects(verify({},wrong),/Shared cues/);
});
test('full MP3 decode + independent R128/truepeak; deliberately false report is ignored',{skip:structuralOnly},async()=>{
  const r=report(),fake=structuredClone(r);fake.master.LUFS=0;fake.master.decodedFrames=1;
  const actual=await verify(getTools(),fake);assert.deepEqual(actual,r.master);assert.equal(actual.decodedFrames,8640000);assert.equal(actual.decodedDuration,180);assert.equal(actual.clipping,0);assert.ok(actual.quietLoudContrastDb>=6);assert.equal(actual.sceneEnergy.length,15);
});
test('24-bit archive: format, hash, full decode, fresh R128, true digital zero hold',{skip:structuralOnly},async()=>{
  const r=report(),tools=getTools(),file=join(AUDIO_DIR,'master.wav'),s=probe(tools,file).streams[0];
  assert.equal(s.codec_name,'pcm_s24le');assert.equal(s.bits_per_sample,24);assert.equal(s.channels,2);assert.equal(+s.sample_rate,48000);assert.equal(sha(file),r.archiveSha256);
  const scan=await scanPCM(tools,file),measure=loudness(tools,file),dynamics=assertSignal(scan,measure,{archive:true});
  assert.deepEqual({...scan,...measure,...dynamics},r.archive);assert.equal(scan.windows.holdFull.frames,20000);assert.equal(scan.windows.holdFull.nonzeroFrames,0);assert.equal(scan.windows.holdFull.peakDbFS,-240);
});