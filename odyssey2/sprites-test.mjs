/** Run: node odyssey2/sprites-test.mjs
 * Isolated headless Chromium, loopback-only modules, no screenshots/reports written.
 * Uses the workspace's existing Playwright; does not touch the user's browser.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../web/package.json',import.meta.url));
const {chromium}=require('playwright');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const {entries}=JSON.parse(readFileSync(new URL('./output/protected-baseline.json',import.meta.url),'utf8'));
function verifyOriginals() {
  for(const [name,hash] of Object.entries(entries)) assert.equal(sha(readFileSync(resolve(root,name))),hash,`Protected original changed: ${name}`);
}
verifyOriginals();
const source=readFileSync(new URL('./sprites.mjs',import.meta.url),'utf8');
assert.ok(!/Math\.random\s*\(|requestAnimationFrame\s*\(|\bfrom\s*['"]|\bimport\s*\(/.test(source),'Sprite must be self-contained and clock-free');
const files=new Map([
  ['/sprites.mjs',source],
  ['/timeline.mjs',readFileSync(new URL('./timeline.mjs',import.meta.url),'utf8')],
]);
const server=createServer((req,res)=>{
  if(req.url==='/') {res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><head><title>Isolated sprite QA</title></head><body></body></html>');return;}
  if(!files.has(req.url)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(files.get(req.url));
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
let browser;
try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1536,height:1100},deviceScaleFactor:1});
  const browserErrors=[];
  page.on('pageerror',error=>browserErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const report=await page.evaluate(async()=>{
    const {createFighterSprite}=await import('/sprites.mjs');
    const {sample,DURATION}=await import('/timeline.mjs');
    const names=['idle','bow','release','guard','parry','recoil','crouch','dash','slash','slide','turn','uppercut','air','airSlash','land','spin','run','thrust','overhead','airHurt','kneel'];
    // Count from the required names, not from private implementation tables.
    const actors={hero:createFighterSprite(),rival:createFighterSprite('rival')};
    const errors=[],counts={},checks={assertions:0,draws:0};
    const check=(truth,kind,detail)=>{
      checks.assertions++;
      if(truth)return;
      counts[kind]=(counts[kind]||0)+1;
      const scope=detail.label?detail.label.split('/').slice(0,2).join('/'):
        detail.blend===1?`${detail.identity}/${detail.nextPose}`:`${detail.identity}/${detail.pose}/${detail.nextPose||''}`;
      if(!errors.some(e=>e.kind===kind&&e.scope===scope))errors.push({kind,scope,...detail});
    };
    const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
    const frame=(actor,state,time=1.25,ghost=false)=>{
      checks.draws++;
      const m=actor.draw(state,time,{ghost});
      const data=actor.canvas.getContext('2d').getImageData(0,0,256,192).data;
      return {m,data};
    };
    const hash=data=>{
      let h=2166136261;
      for(let i=0;i<data.length;i++) {h^=data[i];h=Math.imul(h,16777619);}
      return (h>>>0).toString(16);
    };
    const alpha=(data,[x,y])=>x>=0&&x<256&&y>=0&&y<192?data[(y*256+x)*4+3]:0;
    const nearInk=(data,[x,y],radius)=>{
      let n=0;
      for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(alpha(data,[x+dx,y+dy]))n++;
      return n;
    };
    const inspect=(f,label)=>{
      const {m,data}=f;
      let x0=256,y0=192,x1=-1,y1=-1,count=0,aa=0;
      const colors=new Set();
      for(let i=3;i<data.length;i+=4) {
        if(!data[i])continue;
        count++;if(data[i]!==255)aa++;
        const pixel=(i-3)/4,x=pixel%256,y=Math.floor(pixel/256);
        x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
        colors.add((data[i-3]<<16)|(data[i-2]<<8)|data[i-1]);
      }
      const expected={x:x0,y:y0,width:x1-x0+1,height:y1-y0+1};
      check(count>1400,'empty-or-truncated-body',{label,count});
      check(aa===0,'anti-aliasing',{label,aa});
      check(colors.size<=46,'palette',{label,colors:colors.size});
      check(eq(m.bounds,expected),'inexact-bounds',{label,actual:m.bounds,expected});
      check(x0>=2&&x1<=253&&y0>=2&&y1<=189,'canvas-clipping',{label,bounds:expected});
      for(const key of ['hand','offHand','weaponTip','head']) {
        const v=m[key];
        check(v.length===2&&v.every(Number.isInteger),'invalid-coordinate',{label,key,v});
        check(alpha(data,v)===255,'attachment-off-pixel',{label,key,v});
      }
      check(nearInk(data,m.head,9)>120,'head-too-small-or-missing',{label,head:m.head});
      for(const key of ['farAnkle','nearAnkle'])check(nearInk(data,m.joints[key],5)>30,'missing-foot',{label,key,at:m.joints[key]});
      return {count,colors:colors.size,bounds:expected};
    };
    const grid={};
    for(const [identity,actor] of Object.entries(actors)) {
      check(actor.width===256&&actor.height===192&&actor.pixelsPerUnit===48&&eq(actor.origin,{x:128,y:162}),'interface',{identity});
      const silhouettes={},samples={};
      for(const pose of names) {
        const signatures=new Set(),tips=new Set(),pictures=new Set();
        for(let i=0;i<=64;i++)for(const facing of [1,-1]) {
          const state={pose,phase:i/64,facing,x:100,y:37,z:-12,velocity:0};
          const f=frame(actor,state);
          const stats=inspect(f,`${identity}/${pose}/${i}/64/${facing}`);
          check(f.m.identity===identity&&f.m.pose===pose&&f.m.phase===i/64,'input-contract',{identity,pose,i});
          if(facing===1){signatures.add(f.m.poseSignature);tips.add(f.m.weaponTip.join());if(i%8===0)pictures.add(hash(f.data));}
          if(i===32&&facing===1)samples[pose]=stats;
        }
        if(pose!=='idle') {
          check(signatures.size>=12,'static-pose',{identity,pose,signatures:signatures.size});
          check(tips.size>=8,'static-weapon-tip',{identity,pose,tips:tips.size});
          check(pictures.size>=5,'static-artwork',{identity,pose,pictures:pictures.size});
        }
        silhouettes[pose]={signatures:signatures.size,tips:tips.size,pictures:pictures.size};
      }
      grid[identity]={poses:names.length,phaseSteps:65,facings:2,silhouettes,samples};
    }
    // Exact reflection ABOUT x=128, not about the 127.5 canvas midpoint.
    for(const [identity,actor] of Object.entries(actors))for(const pose of names)for(const phase of [0,.3,.55,1]) {
      const right=frame(actor,{pose,phase,facing:1}),left=frame(actor,{pose,phase,facing:-1});
      let mismatch=0;
      for(let y=0;y<192;y++)for(let x=1;x<256;x++)for(let channel=0;channel<4;channel++) {
        if(right.data[(y*256+x)*4+channel]!==left.data[(y*256+256-x)*4+channel])mismatch++;
      }
      check(mismatch===0,'pixel-mirror',{identity,pose,phase,mismatch});
      for(const key of ['hand','offHand','weaponTip','head'])check(eq(left.m[key],[256-right.m[key][0],right.m[key][1]]),'metadata-mirror',{identity,pose,phase,key});
    }
    // Every pose-pair is exercised; endpoint equivalence must be pixel-exact.
    for(const [identity,actor] of Object.entries(actors))for(const pose of names)for(const nextPose of names) {
      const from=frame(actor,{pose,phase:.31}),to=frame(actor,{pose:nextPose,phase:.73});
      for(const blend of [0,.25,.5,.75,1]) {
        const f=frame(actor,{pose,phase:.31,nextPose,nextPhase:.73,blend});
        check(alpha(f.data,f.m.weaponTip)===255,'blend-weapon-tip',{identity,pose,nextPose,blend,tip:f.m.weaponTip});
        check(f.m.bounds.x>=2&&f.m.bounds.x+f.m.bounds.width<=254&&f.m.bounds.y>=2,'blend-clipping',{identity,pose,nextPose,blend,bounds:f.m.bounds});
        if(blend===0||blend===1) {
          const target=blend===0?from:to;
          check(hash(target.data)===hash(f.data),'blend-endpoint-pixels',{identity,pose,nextPose,blend});
          for(const key of ['head','hand','offHand','weaponTip'])check(eq(target.m[key],f.m[key]),'blend-endpoint-joint',{identity,pose,nextPose,blend,key});
        }
      }
    }
    // Actual timeline input: 48 samples/sec covers each 24Hz upload interval twice.
    let timelineFrames=0;
    for(let i=0;i<=DURATION*48;i++) {
      const t=i/48, state=sample(t);
      for(const [identity,actor] of Object.entries(actors)) {
        const f=frame(actor,state[identity],t);
        inspect(f,`timeline/${identity}/${t.toFixed(4)}`);timelineFrames++;
      }
    }
    for(const [identity,actor] of Object.entries(actors)) {
      const state={pose:'slash',phase:.56,nextPose:'land',nextPhase:.5,blend:.25,facing:-1,velocity:3,x:0,y:0,z:0};
      const clean=frame(actor,state,2);
      const context=actor.canvas.getContext('2d');
      context.save();context.translate(100,80);context.scale(3,2);context.globalAlpha=.07;
      context.globalCompositeOperation='destination-out';context.beginPath();context.rect(0,0,2,2);context.clip();
      const dirty=frame(actor,state,2);
      check(hash(clean.data)===hash(dirty.data),'context-reset',{identity});
      check(context.globalAlpha===1&&context.globalCompositeOperation==='source-over'&&context.getTransform().isIdentity,'context-leak',{identity});
      context.restore();
      const afterRestore=frame(actor,state,2);
      check(hash(clean.data)===hash(afterRestore.data),'context-stack-leak',{identity});
      const translated=frame(actor,{...state,x:1e6,y:-1e6,z:99},2);
      check(hash(clean.data)===hash(translated.data)&&eq(clean.m,translated.m),'applied-world-position',{identity});
      const ghost=frame(actor,state,2,true);
      let rgbMismatch=0,alphaMismatch=0,maxRgbError=0;
      // Canvas stores premultiplied 8-bit color. Unpremultiplying alpha=88 can
      // round RGB by <= ceil(255/(2*88)) = 2, without any palette/geometry change.
      const roundTripTolerance=Math.ceil(255/(2*88));
      for(let i=0;i<clean.data.length;i++) {
        if(i%4===3){if(ghost.data[i]!== (clean.data[i]?88:0))alphaMismatch++;}
        else {
          const error=Math.abs(ghost.data[i]-clean.data[i]);maxRgbError=Math.max(maxRgbError,error);
          if(error>roundTripTolerance)rgbMismatch++;
        }
      }
      check(rgbMismatch===0&&alphaMismatch===0&&eq(ghost.m,clean.m),'ghost-changed-geometry',{identity,rgbMismatch,alphaMismatch,maxRgbError});
      const distantTime=frame(actor,state,91);
      for(const key of ['head','hand','offHand','weaponTip','joints','poseSignature'])check(eq(clean.m[key],distantTime.m[key]),'time-drives-body',{identity,key});
      actor.draw({pose:'airHurt',phase:.67},101);
      check(hash(frame(actor,state,2).data)===hash(clean.data),'history-dependent',{identity});
      const unknown=frame(actor,{pose:'constructor',phase:NaN,nextPose:'__proto__',blend:Infinity,facing:NaN},NaN);
      check(unknown.m.pose==='idle'&&unknown.m.phase===0,'invalid-input-fallback',{identity});
      actor.canvas.width=80;actor.canvas.height=80;
      const resized=frame(actor,state,2);
      check(actor.canvas.width===256&&actor.canvas.height===192&&hash(resized.data)===hash(clean.data),'canvas-size-recovery',{identity});
      const twin=createFighterSprite(identity);
      check(hash(frame(twin,state,2).data)===hash(clean.data),'instance-dependency',{identity});
    }
    // Anatomical/action checks, independent of implementation tables.
    const hero=actors.hero,rival=actors.rival;
    const idle=frame(hero,{pose:'idle',phase:0}),sentinel=frame(rival,{pose:'idle',phase:0});
    const crouch=frame(hero,{pose:'crouch',phase:.5}),land=frame(hero,{pose:'land',phase:.5});
    const dash=frame(hero,{pose:'dash',phase:.65}),slide=frame(hero,{pose:'slide',phase:.5});
    const rise0=frame(hero,{pose:'uppercut',phase:.14}),rise1=frame(hero,{pose:'uppercut',phase:.55});
    const air=frame(hero,{pose:'air',phase:.4});
    const cut0=frame(hero,{pose:'slash',phase:.3}),cut1=frame(hero,{pose:'slash',phase:.56});
    const bowed0=frame(hero,{pose:'bow',phase:0}),bowed1=frame(hero,{pose:'bow',phase:1});
    const downCrouch=crouch.m.joints.pelvis[1]-idle.m.joints.pelvis[1];
    const downLand=land.m.joints.pelvis[1]-idle.m.joints.pelvis[1];
    check(downCrouch>=25&&downCrouch<=45&&downLand>=25&&downLand<=45,'shallow-crouch',{downCrouch,downLand});
    check(slide.m.joints.pelvis[1]>=145&&Math.abs(slide.m.joints.nearAnkle[0]-slide.m.joints.farAnkle[0])>=110,'slide-not-extended',{joints:slide.m.joints});
    const neck=dash.m.joints.neck,pelvis=dash.m.joints.pelvis;
    const dashLean=Math.atan2(neck[0]-pelvis[0],pelvis[1]-neck[1])*180/Math.PI;
    check(dashLean>=30&&dashLean<=45,'dash-not-leaning',{dashLean});
    const backStraight=distance(dash.m.joints.pelvis,dash.m.joints.farAnkle)/(distance(dash.m.joints.pelvis,dash.m.joints.farKnee)+distance(dash.m.joints.farKnee,dash.m.joints.farAnkle));
    check(backStraight>.95,'dash-back-leg-bent',{backStraight});
    check(rise0.m.hand[1]-rise1.m.hand[1]>80,'uppercut-no-rise',{low:rise0.m.hand,high:rise1.m.hand});
    check(air.m.joints.nearKnee[1]<air.m.joints.pelvis[1]+8&&air.m.joints.nearAnkle[1]<140,'air-not-tucked',{joints:air.m.joints});
    const elbowAngle=m=>{
      const a=distance(m.joints.shoulder,m.joints.elbow),b=distance(m.joints.elbow,m.hand),c=distance(m.joints.shoulder,m.hand);
      return Math.acos(Math.max(-1,Math.min(1,(a*a+b*b-c*c)/(2*a*b))))*180/Math.PI;
    };
    check(elbowAngle(cut1.m)>elbowAngle(cut0.m)+30,'slash-no-elbow-extension',{windup:elbowAngle(cut0.m),strike:elbowAngle(cut1.m)});
    check(distance(bowed1.m.hand,bowed1.m.offHand)>distance(bowed0.m.hand,bowed0.m.offHand)+25,'bow-not-drawn',{rest:bowed0.m.hand,pull:bowed1.m.hand});
    check(bowed1.m.weapon==='bow'&&idle.m.weapon==='sword'&&sentinel.m.weapon==='spear','weapon-identities',{});
    const contactChecks=[];
    for(const beat of [12,21]){
      const t=beat*.46875,body=sample(t),h=frame(hero,body.hero,t),r=frame(rival,body.rival,t);
      const world=(actor,p)=>[actor.x+(p[0]-128)/48,actor.y+(162-p[1])/48];
      const shieldPoint=world(body.hero,h.m.offHand),spearPoint=world(body.rival,r.m.weaponTip);
      const gap=distance(shieldPoint,spearPoint);
      contactChecks.push({beat,shieldPoint,spearPoint,gap});
      check(gap<.45,'spear-misses-shield-contact',{beat,shieldPoint,spearPoint,gap});
    }
    const armed=frame(rival,{pose:'kneel',phase:.5}),unarmed=frame(rival,{pose:'kneel',phase:.5,disarmed:true});
    check(unarmed.m.weapon==='none'&&unarmed.m.weaponHidden===true,'disarmed-metadata',{});
    check(eq(unarmed.m.weaponTip,unarmed.m.hand),'disarmed-trail-endpoint',{});
    check(hash(armed.data)!==hash(unarmed.data),'disarmed-pixels-unchanged',{});
    for(const f of [idle,sentinel]) {
      for(const key of ['nearAnkle','farAnkle']) {
        const x=f.m.joints[key][0];
        check(nearInk(f.data,[x,162],1)>0&&alpha(f.data,[x,163])===0,'sole-origin',{identity:f.m.identity,key,ankle:f.m.joints[key]});
      }
    }
    const heroHeight=162-idle.m.bounds.y+1,rivalHeight=162-sentinel.m.bounds.y+1;
    check(heroHeight>=116&&heroHeight<=123&&rivalHeight>=heroHeight+12,'adult-proportions',{heroHeight,rivalHeight});
    const heroShoulder=distance(idle.m.joints.shoulder,idle.m.joints.offShoulder),rivalShoulder=distance(sentinel.m.joints.shoulder,sentinel.m.joints.offShoulder);
    check(rivalShoulder>heroShoulder*1.2,'same-body-width',{heroShoulder,rivalShoulder});
    let maskDifference=0;
    for(let i=3;i<idle.data.length;i+=4)if(Boolean(idle.data[i])!==Boolean(sentinel.data[i]))maskDifference++;
    check(maskDifference>1000,'recoloured-clone',{maskDifference});
    // Measure pure draw cost only; do not claim scene/GPU/browser playback FPS.
    for(let i=0;i<100;i++)hero.draw({pose:'slash',phase:(i%64)/64},i/24);
    const start=performance.now();
    for(let i=0;i<720;i++) {
      const state=sample(i/24);hero.draw(state.hero,i/24);rival.draw(state.rival,i/24);
    }
    const drawMilliseconds=(performance.now()-start)/1440;
    // A contact sheet exists only in this isolated browser's memory.
    document.body.style.cssText='margin:0;background:#222b39;color:#e8dfc7;font:14px monospace;display:grid;grid-template-columns:repeat(6,256px)';
    for(const identity of ['hero','rival'])for(const pose of ['idle','bow','parry','slash','slide','uppercut','airSlash','land','spin','run','overhead','kneel']) {
      const actor=actors[identity];actor.draw({pose,phase:pose==='bow'?1:.55},1.25);
      const cell=document.createElement('div'),label=document.createElement('div'),canvas=document.createElement('canvas');
      label.textContent=`${identity} / ${pose}`;canvas.width=256;canvas.height=192;
      canvas.getContext('2d').drawImage(actor.canvas,0,0);cell.append(label,canvas);document.body.append(cell);
    }
    return {
      result:errors.length?'FAIL':'PASS',...checks,requiredPoses:names.length,gridFrames:names.length*65*2*2,
      posePairBlends:names.length**2*5*2,timelineFrames,protectedBrowser:'isolated-headless',
      anatomy:{heroHeight,rivalHeight,heroShoulder,rivalShoulder,downCrouch,downLand,dashLean,backStraight,maskDifference},contactChecks,
      averageDrawMilliseconds:Math.round(drawMilliseconds*1000)/1000,failures:counts,examples:errors,
      representative: {hero:grid.hero.samples,rival:grid.rival.samples},
    };
  });
  const contactSheet=await page.screenshot({fullPage:true});
  report.contactSheet={inMemoryOnly:true,pngBytes:contactSheet.length,sha256:sha(contactSheet)};
  report.browserErrors=browserErrors;
  verifyOriginals();report.protectedFiles=Object.keys(entries).length;
  if(!process.argv.includes('--details'))delete report.representative;
  console.log(JSON.stringify(report,null,2));
  assert.equal(report.result,'PASS','Sprite pixel/animation checks failed; see measurements above');
  assert.deepEqual(browserErrors,[],'Browser errors');
} finally {
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
  verifyOriginals();
}