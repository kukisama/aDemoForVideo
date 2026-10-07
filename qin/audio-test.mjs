/** Independent offline acceptance: own decoder, R128 measurement, SRT parser,
 * sample/energy/spectral analysis. Does NOT call score.verify or synthesize TTS.
 * node --test qin/audio-test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync, openSync, readSync, closeSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DURATION, BPM, TOTAL_BEATS, CHAPTERS, SHOTS, VOICE_CUES, AUDIO_CUES } from './story.mjs';
import { buildScore } from './score.mjs';

const ROOT=fileURLToPath(new URL('./',import.meta.url)), AUDIO=join(ROOT,'audio'), QA=join(ROOT,'output','audio-qa');
const SELF=fileURLToPath(import.meta.url), SR=48000, N=8640000;
const require=createRequire(new URL('../web/package.json',import.meta.url));
const FFMPEG='C:\\Users\\kukisama\\AppData\\Roaming\\Python\\Python312\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
const PROBE=require('ffprobe-static').path;
function hash(p) {
  const fd=openSync(p,'r'),h=createHash('sha256'),chunk=Buffer.allocUnsafe(1024*1024);
  try {let n;while((n=readSync(fd,chunk,0,chunk.length,null))>0)h.update(chunk.subarray(0,n));return h.digest('hex');}
  finally {closeSync(fd);}
}
const objectHash=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const report=read(join(AUDIO,'report.json')),captions=read(join(AUDIO,'captions.json')),score=read(join(QA,'score-events.json'));
const evidence={testSha256:hash(SELF),reportSha256:hash(join(AUDIO,'report.json')),tests:[],tracks:{},voices:[],listeningTestPerformed:false};
const decoded=new Map();
let scheduledTests=0,registered=false;
function exec(exe,args,binary=false) {
  const r=spawnSync(exe,args,{encoding:binary?null:'utf8',windowsHide:true,maxBuffer:160*1024*1024,stdio:['ignore','pipe','pipe']});
  assert.equal(r.error,undefined);assert.equal(r.status,0,String(r.stderr).slice(-1800));return r;
}
function info(path) {return JSON.parse(exec(PROBE,['-v','error','-show_streams','-show_format','-of','json',path]).stdout);}
function pcm(path,cache=false) {
  if(decoded.has(path)) return decoded.get(path);
  // No sample-rate/channel conversion and no -t/atrim/apad in the test decoder.
  const b=exec(FFMPEG,['-v','error','-nostdin','-i',path,'-map','0:a:0','-c:a','pcm_f32le','-f','f32le','-'],true).stdout;
  const a=new Float32Array(b.buffer,b.byteOffset,b.byteLength/4);
  if(cache) decoded.set(path,a);return a;
}
function loudness(path) {
  const r=exec(FFMPEG,['-hide_banner','-nostdin','-i',path,'-af','loudnorm=I=-15:TP=-2.5:LRA=16:print_format=json','-f','null','-']);
  const match=r.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);assert.ok(match);
  const m=JSON.parse(match[0]);return {LUFS:+m.input_i,truePeakDbTP:+m.input_tp,loudnessRangeLU:+m.input_lra};
}
const dB=v=>20*Math.log10(Math.max(1e-12,v));
function signal(a,channels=2,start=0,end=a.length/channels/SR,sr=SR) {
  let energy=0,peak=0,bad=0,clips=0,dc=0,side=0,l2=0,r2=0,cross=0;
  const begin=Math.round(start*sr),finish=Math.min(a.length/channels,Math.round(end*sr));
  for(let i=begin;i<finish;i++) {
    for(let c=0;c<channels;c++) {const v=a[i*channels+c];if(!Number.isFinite(v))bad++;if(Math.abs(v)>=1)clips++;energy+=v*v;dc+=v;peak=Math.max(peak,Math.abs(v));}
    if(channels===2) {const l=a[i*2],r=a[i*2+1];l2+=l*l;r2+=r*r;cross+=l*r;side+=((l-r)/2)**2;}
  }
  const samples=Math.max(1,(finish-begin)*channels);
  return {rms:dB(Math.sqrt(energy/samples)),peak:dB(peak),nonfinite:bad,clipping:clips,dc:dc/samples,
    correlation:cross/Math.max(1e-30,Math.sqrt(l2*r2)),sideRms:dB(Math.sqrt(side/Math.max(1,finish-begin)))};
}
function projected(a,midi,start,length=.4) {
  const omega=2*Math.PI*440*2**((midi-69)/12)/SR,n=Math.round(length*SR),offset=Math.round(start*SR);let x=0,y=0;
  for(let i=0;i<n;i++) {const v=(a[2*(offset+i)]+a[2*(offset+i)+1])*.5*(.5-.5*Math.cos(2*Math.PI*i/(n-1)));x+=v*Math.cos(omega*i);y+=v*Math.sin(omega*i);}
  return dB(Math.hypot(x,y)*4/n);
}
function alignedCorrelation(master,voice,start) {
  let xy=0,xx=0,yy=0;const offset=Math.round(start*SR);
  for(let i=0;i<voice.length;i++) {const x=voice[i],y=(master[2*(offset+i)]+master[2*(offset+i)+1])*.5;xy+=x*y;xx+=x*x;yy+=y*y;}
  return xy/Math.sqrt(xx*yy);
}
function srt(path) {
  const stamp=s=>{const [h,m,v]=s.replace(',','.').split(':').map(Number);return h*3600+m*60+v;};
  return readFileSync(path,'utf8').trim().split(/\r?\n\s*\r?\n/).map(block=>{
    const lines=block.split(/\r?\n/),i=lines.findIndex(l=>l.includes(' --> '));assert.ok(i>=0);
    const [start,end]=lines[i].split(' --> ').map(stamp);return {start,end,text:lines.slice(i+1).join('')};
  });
}
const canonical=s=>s.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'');
function check(name,fn) {
  scheduledTests++;
  test(name,()=>{
    try {fn();evidence.tests.push({name,passed:true});}
    catch(e) {evidence.tests.push({name,passed:false,error:e.message});throw e;}
    finally {
      evidence.expectedTests=scheduledTests;evidence.complete=registered&&evidence.tests.length===scheduledTests;
      evidence.passed=evidence.complete&&evidence.tests.every(t=>t.passed);evidence.completedTests=evidence.tests.length;
      writeFileSync(join(QA,'independent-tests.json'),JSON.stringify(evidence,null,2)+'\n');
    }
  });
}

check('Locked story, exact 180s / 120 BPM / 360 beats / 90 bars, 313 Han',()=>{
  assert.equal(hash(join(ROOT,'story.mjs')),'1a6d4caf6dd6bc4346fefd47d76b90f0bd50fc3e7b92551326cd59b54e8340d0');
  assert.equal(DURATION,180);assert.equal(BPM,120);assert.equal(TOTAL_BEATS,360);assert.equal(report.bars,90);
  assert.equal(VOICE_CUES.length,26);assert.equal(VOICE_CUES.reduce((n,v)=>n+[...v.text.matchAll(/\p{Script=Han}/gu)].length,0),313);
  assert.equal(VOICE_CUES[4].text,'那时，我的国门之外，还有六国的高墙。');
});
check('All media/caption/source/cache/stem hashes match, manifest has full audio coverage',()=>{
  assert.equal(report.scoreSha256,hash(join(ROOT,'score.mjs')));assert.equal(report.storysha256,hash(join(ROOT,'story.mjs')));
  for(const [key,name] of Object.entries({mastersha256:'master.mp3',musicsha256:'music.mp3',captionSha256:'captions.json',archiveSha256:'master.wav',musicArchiveSha256:'music.wav'}))
    assert.equal(report[key],hash(join(AUDIO,name)),key);
  for(const [p,h] of Object.entries(report.files)) assert.equal(hash(join(ROOT,p)),h,p);
  function scan(dir) {for(const e of readdirSync(dir,{withFileTypes:true})) {
    const path=join(dir,e.name);if(e.isDirectory())scan(path);else if(e.name!=='report.json')assert.equal(report.files[relative(ROOT,path).split(sep).join('/')],hash(path),path);
  }} scan(AUDIO);
  evidence.manifestFileCount=Object.keys(report.files).length;
});
check('Actual events match deterministic new theme and immutable narrative cues',()=>{
  const generated=buildScore();assert.equal(score.eventSha256,objectHash(score.events));assert.deepEqual(generated,score);
  assert.deepEqual(report.composition.events,score.events);assert.equal(score.instrumentLayerCount,8);assert.equal(score.bars.length,90);
  assert.deepEqual(score.theme,[[0,74,.48],[.75,81,.52],[1.5,79,.78],[2.5,84,.48],[3.25,77,.66]]);
  for(const e of score.events) {assert.equal(e.sample,Math.round(e.at*SR));assert.ok(e.at>=0&&e.at<180&&e.hold>0);assert.ok(e.at<148.5||e.at>=150.5);}
  assert.equal(report.provenance.runtimeNetworkRequired,false);assert.equal(report.provenance.voice.voiceCloning,false);
  assert.equal(report.validation.listeningTestPerformed,false);
});
for(const name of ['master.mp3','master.wav','music.mp3','music.wav']) check(`${name}: independent full decode, format, R128, true peak, stereo, fades`,()=>{
  const path=join(AUDIO,name),p=info(path),s=p.streams[0],a=pcm(path,name.endsWith('.mp3'));
  assert.equal(p.streams.length,1);assert.equal(+s.sample_rate,48000);assert.equal(s.channels,2);assert.equal(a.length/2,N);
  if(name.endsWith('.mp3')) {assert.equal(s.codec_name,'mp3');assert.equal(+s.bit_rate,256000);
    assert.equal(p.format.tags.story_sha256,report.storysha256);assert.equal(p.format.tags.score_sha256,report.scoreSha256);
  } else assert.equal(s.codec_name,'pcm_f32le');
  const actual=loudness(path),target=name.startsWith('music')?-13:-15,sg=signal(a);
  assert.ok(Math.abs(actual.LUFS-target)<=1,JSON.stringify(actual));assert.ok(actual.truePeakDbTP<=-1.5,JSON.stringify(actual));
  for(const k of ['LUFS','truePeakDbTP','loudnessRangeLU']) assert.equal(actual[k],report.measurements.tracks[name][k]);
  assert.equal(sg.clipping,0);assert.equal(sg.nonfinite,0);assert.ok(Math.abs(sg.dc)<.001);
  assert.ok(sg.correlation>0&&sg.correlation<.999&&sg.sideRms>-42,JSON.stringify(sg));
  assert.ok(signal(a,2,179.99,180).peak<-80,'End must actually be silent');
  assert.ok(signal(a,2,0,.003).rms<signal(a,2,.1,.2).rms-10,'Opening must fade in');
  evidence.tracks[name]={...actual,...sg,decodedFrames:a.length/2,decodedDuration:a.length/2/SR};
});
for(const name of ['music.mp3','master.mp3']) check(`${name}: gapless packet padding accounts for exactly 8640000 frames`,()=>{
  const p=JSON.parse(exec(PROBE,['-v','error','-select_streams','a:0','-show_packets','-show_entries','packet=duration_time,side_data_list','-of','json',join(AUDIO,name)]).stdout);
  let frames=0,skip=0,pad=0;
  for(const packet of p.packets) {frames+=Math.round(+packet.duration_time*SR);for(const s of packet.side_data_list??[]) {skip+=+(s.skip_samples??0);pad+=+(s.discard_padding??0);}}
  assert.ok(skip>0);assert.equal(frames-skip-pad,N);evidence.tracks[name].gapless={frames,skip,padding:pad,decodedFrames:frames-skip-pad};
});
for(const [i,cue] of VOICE_CUES.entries()) check(`${cue.id}: real source/SRT, full text, safe trim, natural tempo, exact window and presence in master`,()=>{
  const v=report.voices[i],clip=join(AUDIO,v.file),a=pcm(clip),p=info(clip).streams[0],duration=a.length/SR;
  assert.equal(v.id,cue.id);assert.equal(v.text,cue.text);assert.equal(v.at,cue.at);assert.equal(v.windowEnd,cue.end);
  assert.equal(p.codec_name,'pcm_f32le');assert.equal(+p.sample_rate,SR);assert.equal(p.channels,1);assert.equal(v.decodedFrames,a.length);
  assert.ok(Math.abs(v.duration-duration)<.000001);assert.ok(Math.abs(v.end-(cue.at+duration))<.000001);assert.ok(v.end<=cue.end-.02);
  assert.ok(v.tempoApplied>=1&&v.tempoApplied<=1.18);assert.ok(['-6%','0%'].includes(v.rate));assert.equal(v.pitch,'-3Hz');
  assert.equal(v.voice,'zh-CN-YunxiNeural');assert.equal(v.generic,true);assert.equal(v.voiceCloning,false);
  const rawPath=join(AUDIO,v.source),raw=pcm(rawPath),rp=info(rawPath).streams[0],rawDuration=raw.length/rp.channels/(+rp.sample_rate);
  assert.ok(raw.every(Number.isFinite));assert.ok(Math.abs(rawDuration-v.sourceDecodedDuration)<1/SR);
  const words=srt(join(AUDIO,v.srt));assert.equal(canonical(words.map(w=>w.text).join('')),canonical(cue.text));
  assert.ok(words.every((w,j)=>w.start>=0&&w.end>w.start&&w.end<=rawDuration+.05&&(!j||w.start>=words[j-1].end-.001)));
  assert.ok(v.trimStart<=words[0].start-.0399);assert.ok(v.trimEnd>=words.at(-1).end+.0599);assert.equal(v.internalSilenceRemoved,0);
  assert.ok(Math.abs(v.speechStart-(v.at+(words[0].start-v.trimStart)/v.tempoApplied))<.000001);
  assert.ok(Math.abs(v.speechEnd-(v.at+(words.at(-1).end-v.trimStart)/v.tempoApplied))<.000001);
  const meta=read(join(AUDIO,v.cacheMetadata));assert.equal(objectHash(meta.parameters),v.cacheKey);assert.equal(meta.parameters.text,cue.text);
  assert.equal(meta.parameters.rate,v.rate);assert.equal(meta.parameters.pitch,v.pitch);assert.equal(meta.sha256,hash(rawPath));assert.equal(meta.srtSha256,hash(join(AUDIO,v.srt)));
  assert.equal(v.sha256,hash(clip));assert.equal(v.sourceSha256,hash(rawPath));assert.equal(v.srtSha256,hash(join(AUDIO,v.srt)));
  assert.equal(v.cacheMetadataSha256,hash(join(AUDIO,v.cacheMetadata)));
  const sg=signal(a,1),corr=alignedCorrelation(pcm(join(AUDIO,'master.mp3'),true),a,v.at);
  assert.equal(sg.clipping,0);assert.equal(sg.nonfinite,0);assert.ok(sg.rms>-33);assert.ok(corr>.40,`${v.id} actual mix correlation=${corr}`);
  const c=captions.cues[i];assert.equal(c.voiceId,v.id);assert.equal(c.text,v.text);assert.equal(c.start,v.at);
  assert.ok(Math.abs(c.end-Math.max(v.at+duration,v.at+2))<.000001);assert.ok(c.end-c.start>=2-.000001);assert.ok(c.end<=cue.end);
  assert.ok([...c.text.matchAll(/\p{Script=Han}/gu)].length<=21);
  evidence.voices.push({id:v.id,duration,rate:v.rate,atempo:v.tempoApplied,margin:cue.end-v.end,masterCorrelation:corr,sourceDecodedDuration:rawDuration});
});
check('Caption schema: exactly 26 complete utterances, reading hold, no overlap or invented word times',()=>{
  assert.equal(captions.duration,180);assert.equal(captions.cues.length,26);assert.deepEqual(captions.voices,report.voices);
  assert.deepEqual(captions.cues.map(c=>c.text),VOICE_CUES.map(v=>v.text));
  for(let i=1;i<26;i++) assert.ok(captions.cues[i].start>=captions.cues[i-1].end);
  assert.equal(captions.cues[21].start,149.1);assert.equal(captions.cues[21].text,'是时间。');assert.equal(captions.cues[21].end,151.1);
});
for(const layer of [...score.layers,'sfx']) check(`${layer}: full real stem decode, nonempty finite PCM, no notes/tails in music rest`,()=>{
  const path=join(QA,layer+'.flac'),a=pcm(path),p=info(path).streams[0],s=signal(a);
  assert.equal(a.length,N*2);assert.equal(+p.sample_rate,SR);assert.equal(p.channels,2);assert.equal(s.nonfinite,0);assert.equal(s.clipping,0);
  assert.ok(s.peak>-65,`${layer} empty stem: ${JSON.stringify(s)}`);assert.equal(signal(a,2,148.5,150.5).peak,-240);
});
check('Music rest is 96000 exact-zero archive frames; decoded MP3 silence; revelation survives',()=>{
  const wav=pcm(join(AUDIO,'music.wav')),music=pcm(join(AUDIO,'music.mp3'),true),master=pcm(join(AUDIO,'master.mp3'),true),fx=pcm(join(AUDIO,'sfx.wav'));
  for(const a of [wav,fx]) for(let i=148.5*SR*2;i<150.5*SR*2;i++) assert.equal(Math.abs(a[i]),0);
  assert.ok(signal(music,2,148.56,150.44).peak<-100);assert.ok(signal(master,2,149.15,150.25).rms>-35);
  const v=report.voices[21],corr=alignedCorrelation(master,pcm(join(AUDIO,v.file)),149.1);
  assert.ok(corr>.98,`Revelation correlation=${corr}`);
  evidence.silence={start:148.5,end:150.5,exactMusicZeroFrames:96000,mp3InteriorPeak:signal(music,2,148.56,150.44).peak,revelationCorrelation:corr};
});
check('Actual D minor to F major reharmonization: unchanged lead, different decoded bass AND chord',()=>{
  const bass=pcm(join(QA,'triangle-bass.flac')),pad=pcm(join(QA,'reed-choir.flac')),lead=pcm(join(QA,'pulse-lead.flac')),music=pcm(join(AUDIO,'music.mp3'),true);
  const evidenceTonal={beforeD:projected(bass,38,160.2)-projected(bass,41,160.2),afterF:projected(bass,41,162.2)-projected(bass,38,162.2),
    beforeChordD:projected(pad,50,160.2)-projected(pad,60,160.2),afterChordC:projected(pad,60,162.2)-projected(pad,50,162.2),
    finalEncodedF:projected(music,41,162.2)-projected(music,38,162.2)};
  for(const [k,v] of Object.entries(evidenceTonal)) assert.ok(v>6,`${k}=${v}dB`);
  const motif=origin=>score.events.filter(e=>e.layer==='pulse-lead'&&e.at>=origin&&e.at<origin+2&&e.midi>=74).map(e=>[Math.round((e.at-origin)*1000)/1000,e.midi,e.hold]);
  assert.deepEqual(motif(24),motif(162));assert.deepEqual(motif(24),motif(174));
  for(const origin of [24,162,174]) for(const [b,m,g] of score.theme) {
    const t=origin+b*.5+.045,d=Math.min(.12,g*.5-.05),wanted=projected(lead,m,t,d),wrong=projected(lead,m+1,t,d);
    assert.ok(wanted-wrong>6,`Theme audio ${origin}s ${m}: ${wanted-wrong}dB`);
  }
  evidence.tonal=evidenceTonal;
});
check('Actual music energy preserves fatigue, fog, emptying, opening and largest final door section',()=>{
  const a=pcm(join(AUDIO,'music.mp3'),true),chapters=CHAPTERS.map(c=>({id:c.id,rms:signal(a,2,c.start,c.end).rms})),level=id=>chapters.find(c=>c.id===id).rms;
  const contrasts={throneOverOpening:level('throne')-level('gate'),roadOverFatigue:level('road')-level('wall'),
    throneOverFog:level('throne')-level('sea'),dawnOverCurtain:level('dawn')-level('curtain'),openDoorOverThrone:signal(a,2,174,178).rms-level('throne')};
  for(const [k,min] of Object.entries({throneOverOpening:7,roadOverFatigue:4,throneOverFog:9,dawnOverCurtain:9,openDoorOverThrone:1}))
    assert.ok(contrasts[k]>=min,`${k}: ${contrasts[k]}dB, requires ${min}dB`);
  assert.ok(signal(a,2,138,142).rms-signal(a,2,144,148).rms>4,'Curtain must progressively empty');
  assert.ok(signal(a,2,178,178.5).rms-signal(a,2,179.75,179.95).rms>15,'Warm ending must genuinely fade');
  evidence.chapters=chapters;evidence.contrast=contrasts;
});
check('Different writing/measurement rhythms, half-time fatigue and truncated edict have real event changes',()=>{
  const ev=(layer,a,z)=>score.events.filter(e=>e.layer===layer&&e.at>=a&&e.at<z);
  const writing=ev('low-drum',54,56).map(e=>e.at-54),measure=ev('low-drum',66,68).map(e=>e.at-66);
  assert.deepEqual(writing,[0,1]);assert.deepEqual(measure,[0,.875,1.5]);
  assert.equal(ev('low-drum',78,90).length,12);assert.equal(ev('low-drum',90,102).length,6);
  assert.equal(ev('pulse-lead',102,114).length,4);assert.ok(ev('pulse-lead',102,114).every(e=>[62,69].includes(e.midi)));
  const drum=pcm(join(QA,'low-drum.flac'));
  for(const at of [24,42,54,66,78,90,174]) {
    assert.ok(signal(drum,2,at,at+.12).rms>-48,`Missing drum ${at}`);
    assert.ok(signal(drum,2,at-.02,at).peak<-60,`Early/unaligned onset ${at}`);
  }
});
check('Independent sound effects match door/seal/writing/balance/coin/tamping/wind cues without overload',()=>{
  const fx=pcm(join(AUDIO,'sfx.wav')),events=score.events.filter(e=>e.layer==='sfx');
  assert.deepEqual(events.filter(e=>e.role==='door-knock').map(e=>e.at),AUDIO_CUES.openingKnocks);
  assert.deepEqual(events.filter(e=>e.role==='tamping').map(e=>e.at),AUDIO_CUES.tamping);
  for(const [role,at] of [['seal',48],['writing',56.2],['balance',68],['coin',72],['sea-wind',114]]) assert.ok(events.some(e=>e.role===role&&e.at===at));
  for(const e of events) {
    const start=e.at+(e.kind==='wind'?.7:0),s=signal(fx,2,start,start+(e.kind==='wind'?1:.16));
    assert.ok(s.rms>-65,`Missing effect ${e.role} ${e.at}: ${s.rms}dBFS`);
  }
  assert.ok(signal(fx).peak<-10,'Effects must remain below -10dBFS on their isolated bus');
});
check('Action schedule drives coin impacts at 72/.27/.54; decoded SFX attacks and unchanged contact cues align',()=>{
  const fx=pcm(join(AUDIO,'sfx.wav')),events=score.events.filter(e=>e.layer==='sfx');
  const start=id=>SHOTS.find(s=>s.id===id).start;
  const schedule={shot:'coins',shotStart:start('coins'),releaseDelay:.2,flightSeconds:.8,interval:.27,count:3};
  assert.deepEqual(score.actionSchedule.coins,schedule);
  assert.deepEqual(report.composition.actionSchedule,score.actionSchedule);
  const impacts=[0,1,2].map(i=>Math.round((start('coins')+.2+i*.27+.8)*SR));
  const coins=events.filter(e=>e.role==='coin');
  assert.deepEqual(coins.map(e=>e.at),[72,72.27,72.54]);
  assert.deepEqual(coins.map(e=>e.sample),impacts);
  // No old 71s trigger; measure the delivered SFX bus, not just event labels.
  const beforeFirst=signal(fx,2,start('coins'),impacts[0]/SR).peak;
  assert.ok(beforeFirst<-100,`Early coin signal: ${beforeFirst}dBFS`);
  const attacks=coins.map(e=>{
    const before=signal(fx,2,e.at-.02,e.at-.005).rms,after=signal(fx,2,e.at+.005,e.at+.025).rms;
    assert.ok(after>before+3,`Coin ${e.at}s attack: before=${before}, after=${after}dBFS`);
    return {at:e.at,sample:e.sample,beforeDbFS:before,afterDbFS:after,riseDb:after-before};
  });
  const onset=fx.findIndex((v,i)=>i>=impacts[0]*2&&Math.abs(v)>1e-5);
  assert.ok(onset>=impacts[0]*2&&onset<Math.round((72+.0025)*SR)*2,`First coin onset sample=${onset/2}`);
  assert.equal(AUDIO_CUES.writing,start('bamboo')+2.2);
  assert.equal(AUDIO_CUES.balance,start('balance')+2);
  assert.equal(AUDIO_CUES.seal,start('seal')+1.5);
  assert.deepEqual(events.filter(e=>e.role==='writing').map(e=>e.sample),[0,.3,.7,1.05].map(off=>Math.round((start('bamboo')+2.2+off)*SR)));
  assert.deepEqual(AUDIO_CUES.tamping,[92,94,96,98,100]);
  assert.deepEqual(AUDIO_CUES.tamping.filter(at=>at>=start('shoulders')),[0,1].map(i=>start('shoulders')+1.42-.42+2*i));
  evidence.actionSync={coins:attacks,firstCoinOnsetFrame:Math.floor(onset/2),writing:AUDIO_CUES.writing,balance:AUDIO_CUES.balance,seal:AUDIO_CUES.seal,tamping:AUDIO_CUES.tamping};
});
check('Every remaining media artifact independently decodes without hidden failure; all stored evidence agrees',()=>{
  // Includes intermediate speech trims/premasters and raw cache audio, not only delivered MP3.
  let media=0;
  for(const path of Object.keys(report.files).filter(p=>/\.(mp3|wav|flac)$/i.test(p))) {
    exec(FFMPEG,['-v','error','-nostdin','-i',join(ROOT,path),'-map','0:a:0','-f','null','-']);media++;
  }
  assert.equal(report.validation.passed,true);assert.equal(report.validation.fullDecode,true);
  assert.equal(report.processing.master.adaptiveNormalization,false);assert.equal(report.processing.music.adaptiveNormalization,false);
  assert.equal(report.processing.master.limiter.oversampling,4);assert.equal(report.processing.music.limiter.oversampling,4);
  assert.equal(evidence.voices.length,26);evidence.decodedMediaArtifacts=media;
});
registered=true;