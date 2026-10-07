import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMAND,ROUTES,trafficState,trafficAt,assertTrafficModel} from './traffic.mjs';
import {DURATION,BEAT,BAR,CHAPTERS,SHOTS,CAPTIONS,AUDIO_CUES} from './story.mjs';
test('One minute: contiguous acts, shots and exact music boundaries',()=>{
  assert.equal(DURATION,60);assert.equal(CHAPTERS.reduce((n,ch)=>n+ch.bars,0)*BAR,60);
  for(const spans of [CHAPTERS,SHOTS]){assert.equal(spans[0].start,0);assert.equal(spans.at(-1).end,60);for(let i=0;i<spans.length;i++){assert.ok(spans[i].end>spans[i].start);assert.equal(spans[i].start/BEAT,Math.round(spans[i].start/BEAT));if(i)assert.equal(spans[i-1].end,spans[i].start);}}
  for(const shot of SHOTS){const act=CHAPTERS.find(c=>c.id===shot.chapter);assert.ok(shot.start>=act.start&&shot.end<=act.end);}
});
test('Captions do not overlap, cut off, or infer career guarantees',()=>{
  assert.equal(CAPTIONS.length,14);for(let i=0;i<CAPTIONS.length;i++){const cue=CAPTIONS[i];assert.ok(cue.end>cue.start&&cue.end<=60);if(i)assert.ok(cue.start>=CAPTIONS[i-1].end);}
  assert.ok(CAPTIONS.filter(c=>c.kind==='reflection').every(c=>c.start>=52.5));assert.ok(CAPTIONS.some(c=>c.speaker.includes('类比')));
});
test('Cornell baseline 4000 cars split 2000/2000: 65 minutes',()=>{const m=assertTrafficModel().before;assert.equal(m.demand,4000);assert.deepEqual(m.flow,{upper:2000,lower:2000,shortcut:0});assert.equal(m.routeCosts.upper,65);assert.equal(m.routeCosts.lower,65);assert.equal(m.routeCosts.shortcut,null);});
test('Optional zero-time connector initially appears attractive',()=>{const m=trafficState(0,true);assert.equal(m.routeCosts.shortcut,40);assert.equal(m.routeCosts.upper,65);assert.equal(m.costs.CD,0);});
test('All choose the connector: both bottlenecks carry 4000, result 80',()=>{const m=assertTrafficModel().after;assert.equal(m.loads.AC,4000);assert.equal(m.loads.DB,4000);assert.equal(m.loads.CB,0);assert.equal(m.loads.AD,0);assert.equal(m.costs.CD,0);assert.equal(m.routeCosts.shortcut,80);assert.equal(m.average,80);});
test('Lone detour cannot magically improve the bad equilibrium',()=>{const m=trafficState(1,true);assert.equal(m.routeCosts.upper,85);assert.equal(m.routeCosts.lower,85);assert.ok(m.routeCosts.upper>m.routeCosts.shortcut);});
test('Every transition conserves the same traffic demand and node flow',()=>{
  for(let t=0;t<=60;t+=.05){const m=trafficAt(t),sum=m.flow.upper+m.flow.lower+m.flow.shortcut;assert.ok(Math.abs(sum-DEMAND)<1e-6);assert.ok(Math.abs(m.loads.AC+m.loads.AD-DEMAND)<1e-6);assert.ok(Math.abs(m.loads.CB+m.loads.DB-DEMAND)<1e-6);assert.ok(Math.abs(m.loads.AC-m.loads.CB-m.loads.CD)<1e-6);assert.ok(Math.abs(m.loads.DB-m.loads.AD-m.loads.CD)<1e-6);assert.equal(m.costs.CD,0);}
});
test('Closing the connector restores 65 only after redistribution',()=>{assert.equal(trafficAt(41.25).average,80);assert.equal(trafficAt(41.25).equilibrium,false);assert.ok(trafficAt(43).shortcutShare>0);assert.equal(trafficAt(45).average,65);assert.equal(trafficAt(45).phase,'restored');assert.equal(trafficAt(60).average,65);});
test('Exact model cuts, valid routes and two-beat editorial silence',()=>{assert.equal(trafficAt(14.999).open,false);assert.equal(trafficAt(15).open,true);assert.equal(trafficAt(30).average,80);assert.equal(trafficAt(41.25).open,false);assert.deepEqual(ROUTES.shortcut,['AC','CD','DB']);assert.equal(AUDIO_CUES.silenceEnd-AUDIO_CUES.silenceStart,BEAT*2);for(const value of [-1,1.1,NaN,Infinity])assert.throws(()=>trafficState(value),RangeError);});