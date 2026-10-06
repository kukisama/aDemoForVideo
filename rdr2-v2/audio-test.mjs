/** Offline, independent DSP and final-signal regression. Writes only ./audio/test-report.json.
 * node <absolute path>/rdr2-v2/audio-test.mjs [--structure]
 * No human listening/browser claim. No test threshold is relaxed to accommodate a failure.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TITLE as FILM, DURATION, BPM, BEAT, TOTAL_BEATS, CHAPTERS, CUES, SHOTS } from './story.mjs';
import { TITLE, AUDIO_DIR, SR, SPB, BAR, FRAMES, THEME, WHISTLE, PITCHED, PALETTE, SPACES, contract, buildScore, createVoice, getTools, verify, sha } from './score.mjs';

const structuralOnly=process.argv.includes('--structure'),score=buildScore(),checks=[],evidence={};
const report=()=>JSON.parse(readFileSync(join(AUDIO_DIR,'report.json'),'utf8'));
const act=id=>score.events.filter(e=>CHAPTERS[e.section].id===id&&e.kind!=='wind');
async function test(name,fn) {
  try {await fn();checks.push({name,passed:true});console.log(`PASS ${name}`);}
  catch(error){checks.push({name,passed:false,error:error.message});console.error(`FAIL ${name}: ${error.message}`);}
}
const rms=a=>Math.sqrt(a.reduce((sum,x)=>sum+x*x,0)/a.length);
const db=x=>20*Math.log10(Math.max(x,1e-12));

// Windowed, explicit DFT band powers, independent of oscillator internals/name labels.
function bandPower(samples,f,N=8192) {
  let power=0;
  const bin=Math.round(f*N/SR);
  for(let k=bin-3;k<=bin+3;k++) {
    let re=0,im=0;
    for(let i=0;i<N;i++) {
      const x=samples[i]*(.5-.5*Math.cos(2*Math.PI*i/(N-1))),a=2*Math.PI*k*i/N;
      re+=x*Math.cos(a);im-=x*Math.sin(a);
    }
    power+=re*re+im*im;
  }
  return power;
}
function estimatePitch(samples,from,to) {
  const crossings=[];
  for(let i=Math.floor(from*SR)+1;i<Math.floor(to*SR);i++) {
    if(samples[i-1]<=0&&samples[i]>0)crossings.push(i-1-samples[i-1]/(samples[i]-samples[i-1]));
  }
  assert.ok(crossings.length>40,'Insufficient positive crossings.');
  return SR*(crossings.length-1)/(crossings.at(-1)-crossings[0]);
}

await test('exact locked story: 180s, 80 BPM, 240 beats, seven chapters, 24 shots, 16 cues',()=>{
  assert.equal(contract(),true);assert.equal(FILM,'明天以西');assert.equal(DURATION,180);assert.equal(BPM,80);
  assert.equal(BEAT,.75);assert.equal(TOTAL_BEATS,240);assert.equal(SPB,36000);assert.equal(BAR,144000);assert.equal(FRAMES,8640000);
  assert.deepEqual(CHAPTERS.map(c=>c.bars),[7,10,11,10,10,8,4]);assert.equal(SHOTS.length,24);assert.equal(CUES.length,16);
});
await test('deterministic newly composed five-note cell and different chapter programs',()=>{
  assert.deepEqual(THEME,[76,71,74,79,78]);assert.equal(buildScore().eventSha256,score.eventSha256);
  assert.equal(new Set(score.sections.map(s=>s.signature)).size,7);
  const first=act('promise').filter(e=>e.kind==='whistle').slice(0,5).map(e=>e.midi);
  assert.deepEqual(first,THEME);assert.deepEqual(act('fraying').filter(e=>e.kind==='whistle').map(e=>e.midi),THEME);
});
await test('source whitelist and sample bounds; no hats, brass, speech, dense sequences',()=>{
  for(const e of score.events){assert.ok(PALETTE.has(e.kind));assert.equal(e.sample,Math.round(e.time*SR));assert.ok(e.gain>0&&e.pan>=-1&&e.pan<=1);assert.ok(e.sample+Math.round(e.duration*SR)<=FRAMES);}
  assert.ok(!score.events.some(e=>/hat|snare|cymbal|horn|reed|voice|tts/.test(e.kind)));
  assert.equal(score.events.filter(e=>e.kind==='chip').length,2);
  for(let t=0;t<179;t+=.25) {
    const notes=score.events.filter(e=>PITCHED.has(e.kind)&&e.time>=t&&e.time<t+1);
    assert.ok(notes.length<=6,`Too dense at ${t}s: ${notes.length}`);
  }
});
await test('whistle breath gaps / nonmechanical phrasing / no oscillator overlap',()=>{
  const notes=score.events.filter(e=>e.kind==='whistle');let rests=0,offGrid=0;
  for(let i=0;i<notes.length;i++) {
    const e=notes[i];if(e.sample%(SPB/4)!==0)offGrid++;
    if(i){const silence=e.time-notes[i-1].time-notes[i-1].duration;assert.ok(silence>=0,`Overlapping mouth at ${e.time}`);if(silence>.45)rests++;}
  }
  assert.ok(rests>=20,`Only ${rests} meaningful mouth rests.`);assert.ok(offGrid>notes.length*.7);
  evidence.phrasing={whistleNotes:notes.length,restsOver450ms:rests,offSixteenthGrid:offGrid};
});
await test('at least three multi-second real arrangement rests, no concealed bass/pad',()=>{
  assert.ok(SPACES.length>=3);for(const g of SPACES){assert.ok(g.end-g.start>=3);assert.equal(score.events.filter(e=>PITCHED.has(e.kind)&&e.time<g.end&&e.time+e.duration>g.start).length,0,g.id);}
  assert.equal(score.events.filter(e=>e.time<6.8&&e.kind!=='wind').length,0);
  assert.equal(act('dust').filter(e=>e.kind==='bass'||e.kind==='pluck').length,0);
});
await test('promise has real warm answer; burden steps; fraying deletes answers',()=>{
  const trust=act('promise').filter(e=>e.kind==='whistle'),cold=act('fraying').filter(e=>e.kind==='whistle');
  assert.ok(trust.some(e=>e.phrase==='trust-answer'&&e.midi===76));assert.ok(cold.length<trust.length/2);
  assert.ok(act('burden').filter(e=>e.kind==='step').length>=12);assert.equal(act('burden').filter(e=>e.kind==='chip').length,0);
  assert.ok(act('fraying').filter(e=>PITCHED.has(e.kind)).every(e=>e.time+e.duration<104));
});
await test('choice expands only 130–137, third plan really unanswered until 168',()=>{
  assert.ok(score.events.filter(e=>e.kind==='chip').every(e=>e.time>=130&&e.time+e.duration<137));
  const q=act('silence').filter(e=>PITCHED.has(e.kind));assert.equal(q.length,3);assert.ok(q.every(e=>e.kind==='whistle'));
  assert.deepEqual(q.map(e=>e.midi),[76,71,78]);assert.equal(q[0].time,147);
  assert.ok(score.events.filter(e=>e.time>=150.6&&e.time<168).every(e=>!PITCHED.has(e.kind)));
  assert.deepEqual(act('coda').filter(e=>e.kind==='whistle').slice(0,3).map(e=>e.midi),[76,71,74]);
  const last=act('coda').filter(e=>e.kind==='whistle').at(-1);assert.equal(last.midi,78);
  assert.ok(act('coda').filter(e=>e.time>174&&PITCHED.has(e.kind)).every(e=>[59,78].includes(e.midi)));
});
await test('cue anchors and all shot mappings retain exact sample times (no beat snapping)',()=>{
  for(const cue of CUES){const c=score.cues.find(v=>v.id===cue.id);assert.equal(c.sample,Math.round(cue.time*SR));assert.equal(c.time,cue.time);assert.ok(c.note.length>10);}
  for(const id of ['plan-one','plan-two','plan-three','lone-theme'])assert.ok(score.cues.find(c=>c.id===id).exactOnsets.some(e=>e.kind==='whistle'));
  for(const id of ['hoof','wheel','paper-accept','paper-fold','effort','river','turn-back','hand'])assert.ok(score.cues.find(c=>c.id===id).exactOnsets.length>0);
  assert.equal(score.cues.find(c=>c.id==='unanswered').exactOnsets.length,0);
  assert.equal(score.shots[17].start,129);assert.equal(score.cues.find(c=>c.id==='turn-back').time,130);
});
await test('isolated whistle measured as sine-led, with actual breath attack, pitch drift, decaying tail',()=>{
  const e={id:'e777',kind:'whistle',midi:76,time:0,sample:0,gate:2.2,duration:2.5,gain:1,pan:0};
  const v=createVoice(e),a=new Float64Array(Math.round(e.duration*SR));for(let i=0;i<a.length;i++)a[i]=v.render(i/SR);
  const f=440*2**((76-69)/12),slice=a.subarray(Math.round(.8*SR),Math.round(.8*SR)+8192);
  const fundamental=bandPower(slice,f),harmonics=[2,3,4,5].map(h=>bandPower(slice,f*h));
  const share=fundamental/(fundamental+harmonics.reduce((x,y)=>x+y,0));
  assert.ok(share>.99,`Fundamental share ${share}; organ-like harmonic load.`);
  assert.equal(WHISTLE.pulseComponent,0);assert.ok(harmonics[0]/fundamental>.0004,'Missing soft second harmonic.');
  const onset=rms(a.subarray(48,700)),body=rms(a.subarray(24000,36000)),tail=rms(a.subarray(a.length-480));
  assert.ok(onset>1e-4&&onset<body*.02,`Air onset ${onset}, body ${body}.`);
  assert.ok(tail<body*.005,`End did not exhale: ${tail}/${body}.`);
  const pitches=[[.5,.75],[.85,1.1],[1.25,1.5],[1.6,1.85]].map(([x,y])=>1200*Math.log2(estimatePitch(a,x,y)/f));
  const range=Math.max(...pitches)-Math.min(...pitches);
  assert.ok(range>.8&&range<20,`Natural drift range ${range}c; ${pitches}.`);
  assert.ok(pitches.every(c=>Math.abs(c)<15),`Pitch drift exceeds natural bound: ${pitches}.`);
  evidence.whistle={fundamentalShare:share,secondToFundamentalPower:harmonics[0]/fundamental,airOnsetRmsDbFS:db(onset),bodyRmsDbFS:db(body),tailRmsDbFS:db(tail),pitchWindowCents:pitches,pitchRangeCents:range};
});

if(!structuralOnly) {
  await test('published compact report, real rest-bus evidence and explicit no-listening disclosure',()=>{
    const r=report();assert.equal(r.title,TITLE);assert.equal(r.validation.passed,true);assert.equal(r.noVoice,true);
    assert.equal(r.validation.humanListeningPerformed,false);assert.equal(r.validation.browserPlaybackTested,false);
    assert.equal(r.music.eventSha256,score.eventSha256);assert.ok(statSync(join(AUDIO_DIR,'report.json')).size<65536);
    assert.equal(r.music.render.renderedEvents,score.events.length);assert.ok(r.music.render.allocatedMixBytes<6*1024*1024);
    assert.equal(r.music.render.spaces.length,SPACES.length);
    for(const gap of r.music.render.spaces){assert.equal(gap.music.peakDbFS,-240);assert.ok(gap.environment.rmsDbFS>-75);}
    const map=JSON.parse(readFileSync(join(AUDIO_DIR,'edit-cues.json'),'utf8'));assert.equal(map.sourceOnsets.length,score.events.length);
    for(const m of map.sourceOnsets){const e=score.events.find(e=>e.id===m.id);assert.equal(m.scheduledSample,e.sample);assert.ok(m.firstNonzeroSample>=e.sample&&m.firstNonzeroSample-e.sample<=48);}
  });
  await test('stale story, edited WAV/MP3 and incorrect cue metadata rejected before decode',async()=>{
    const r=report();await assert.rejects(verify({}, {...r,storysha256:'0'.repeat(64)}),/Story changed/);
    await assert.rejects(verify({}, {...r,mastersha256:'0'.repeat(64)}),/MP3 hash mismatch/);
    await assert.rejects(verify({}, {...r,archiveSha256:'0'.repeat(64)}),/WAV hash mismatch/);
    const stale=structuredClone(r);stale.music.cues[0].sample=1;await assert.rejects(verify({},stale),/Cue\/rest metadata mismatch/);
  });
  await test('both final masters fully redecoded and freshly measured, not trusted report numbers',async()=>{
    const r=report(),fake=structuredClone(r);fake.master.LUFS=0;fake.archive.decodedDuration=1;
    const actual=await verify(getTools(),fake);assert.deepEqual(actual.master,r.master);assert.deepEqual(actual.archive,r.archive);
    for(const x of [actual.master,actual.archive]){assert.equal(x.decodedFrames,8640000);assert.equal(x.decodedDuration,180);assert.equal(x.clipping,0);assert.equal(x.nonfinite,0);assert.ok(x.LUFS>=-17&&x.LUFS<=-15);assert.ok(x.truePeakDbTP<=-1.5);assert.ok(x.chapterContrastDb>=8);}
    evidence.master={LUFS:actual.master.LUFS,truePeakDbTP:actual.master.truePeakDbTP,LRA:actual.master.loudnessRangeLU,chapterContrastDb:actual.master.chapterContrastDb};
  });
}
const result={passed:checks.every(c=>c.passed),structuralOnly,tests:checks.length,checks,evidence,
  storysha256:sha(fileURLToPath(new URL('./story.mjs',import.meta.url))),
  generatorSha256:sha(fileURLToPath(new URL('./score.mjs',import.meta.url))),testSha256:sha(fileURLToPath(import.meta.url)),
  humanListeningPerformed:false,browserPlaybackTested:false,checkedAt:new Date().toISOString()};
if(!structuralOnly){result.mastersha256=sha(join(AUDIO_DIR,'master.mp3'));result.archiveSha256=sha(join(AUDIO_DIR,'master.wav'));writeFileSync(join(AUDIO_DIR,'test-report.json'),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({passed:result.passed,tests:checks.length,evidence},null,2));
if(!result.passed)process.exitCode=1;