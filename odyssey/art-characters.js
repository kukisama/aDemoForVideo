/* Original mythic pixel actors. Classic script; feet/deck contact is the origin.
 * No external art, actor likenesses, random state, or wall-clock dependencies.
 * Extra options: weapon, shield, ragged, nocked, cup, handNear/handFar (local
 * contact targets), tilt. All are optional. */
function createOdysseyActors() {
  'use strict';
  const INK = '#101a25', TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const num = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
  const lerp = (a, b, p) => a + (b - a) * p;
  const palettes = {
    odysseus: { skin:'#c69b73', light:'#e5bd8b', hair:'#393035', metal:'#ab8048', rim:'#e6c486', shade:'#65513b', cloth:'#773538', fold:'#482734', tunic:'#b4aa84' },
    telemachus: { skin:'#d8ad83', light:'#efd0a0', hair:'#594033', metal:'#b99861', rim:'#f1d295', shade:'#72684a', cloth:'#3f8384', fold:'#244b5c', tunic:'#d2c5a0' },
    penelope: { skin:'#d0a27e', light:'#e9bf91', hair:'#392f39', metal:'#bb9562', rim:'#f3d494', shade:'#7a674f', cloth:'#c1bfa2', fold:'#767d73', tunic:'#a29f8a' },
    sailor: { skin:'#b7815c', light:'#dba371', hair:'#473639', metal:'#826c4b', rim:'#c7b183', shade:'#574c3f', cloth:'#69848b', fold:'#3e5765', tunic:'#aaa88f' },
    guard: { skin:'#b68965', light:'#d4ae7b', hair:'#383238', metal:'#879294', rim:'#c5c8ab', shade:'#4a6169', cloth:'#54516c', fold:'#302f49', tunic:'#7c8687' }
  };
  function rect(c, color, x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
  // Scan-converted polygons and square-ended lines preserve hard pixel edges.
  function poly(c, color, points) {
    const ymin = Math.floor(Math.min(...points.map(p => p[1]))), ymax = Math.ceil(Math.max(...points.map(p => p[1])));
    c.fillStyle = color;
    for (let y = ymin; y < ymax; y++) {
      const xs = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[j], b = points[i], scan = y + .5;
        if ((a[1] <= scan && b[1] > scan) || (b[1] <= scan && a[1] > scan)) xs.push(a[0] + (scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      xs.sort((a,b) => a-b);
      for (let i = 0; i+1 < xs.length; i+=2) c.fillRect(Math.round(xs[i]), y, Math.max(1, Math.round(xs[i+1])-Math.round(xs[i])), 1);
    }
  }
  function line(c, color, a, b, width = 1) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0]-a[0]), Math.abs(b[1]-a[1]))));
    for (let i=0; i<=n; i++) rect(c,color,lerp(a[0],b[0],i/n)-width/2,lerp(a[1],b[1],i/n)-width/2,width,width);
  }
  function ellipse(c, color, x,y,rx,ry) {
    for(let v=-Math.ceil(ry);v<=ry;v++) {
      const w=rx*Math.sqrt(Math.max(0,1-v*v/(ry*ry)));
      rect(c,color,x-w,y+v,w*2+1,1);
    }
  }
  function limb(c, a,b,d,color,width=4) {
    line(c,INK,a,b,width+2);line(c,INK,b,d,width+2);
    line(c,color,a,b,width);line(c,color,b,d,width);
  }
  function shield(c,x,y,s=1,color='#ab8048') {
    ellipse(c,INK,x,y,11*s,15*s);ellipse(c,color,x,y,10*s,14*s);
    ellipse(c,'#e2bc78',x-1*s,y-1*s,8*s,12*s);ellipse(c,'#66563d',x,y,7*s,10*s);
    poly(c,color,[[x,y-10*s],[x+6*s,y-2*s],[x+5*s,y+7*s],[x,y+10*s],[x-6*s,y+4*s],[x-5*s,y-5*s]]);
    ellipse(c,'#e6c486',x,y,3*s,4*s);rect(c,'#f7dc9b',x-2*s,y-3*s,2*s,3*s);
    for(let i=0;i<8;i++){const a=i*TAU/8;rect(c,'#f1d295',x+Math.cos(a)*8*s,y+Math.sin(a)*12*s,s,s);}
  }
  // Adult proportions: 8px head, 22px trunk, 23px jointed legs. No chibi template.
  function pose(action='idle',t=0,phase) {
    const p=clamp(num(phase, (num(t)*1.4)%1)), gait=Math.sin(num(t)*TAU*(action==='run'?2.05:1.15));
    const q={hip:[0,-23],neck:[1,-44],shoulderFar:[-5,-40],shoulderNear:[6,-40],
      elbowFar:[-8,-32],handFar:[-6,-25],elbowNear:[10,-32],handNear:[9,-24],
      kneeFar:[-4,-12],footFar:[-5,0],kneeNear:[5,-12],footNear:[7,0],head:[2,-48],rotation:0,phase:p};
    if(action==='walk'||action==='run') {
      const run=action==='run', stride=run?14:8, lift=run?9:4, bob=-Math.abs(gait)*(run?3:1);
      q.hip=[run?4:1,-23+bob];q.neck=[run?9:2,-44+bob];q.head=[q.neck[0]+1,-48+bob];
      q.shoulderFar=[q.neck[0]-6,-40+bob];q.shoulderNear=[q.neck[0]+5,-40+bob];
      q.footNear=[6+gait*stride,-Math.max(0,Math.cos(t*TAU*(run?2.05:1.15)))*lift];
      q.footFar=[-5-gait*stride,-Math.max(0,-Math.cos(t*TAU*(run?2.05:1.15)))*lift];
      q.kneeNear=[6+gait*stride*.65,-12-Math.max(0,-gait)*lift];q.kneeFar=[-3-gait*stride*.65,-12-Math.max(0,gait)*lift];
      q.elbowNear=[9-gait*5,-32+bob];q.handNear=[10-gait*12,-25+bob-(run?5:0)];
      q.elbowFar=[-7+gait*5,-33+bob];q.handFar=[-5+gait*12,-25+bob];
    } else if(action==='guard') {
      q.hip=[-2,-21];q.footNear=[13,0];q.kneeNear=[8,-11];q.footFar=[-12,0];q.kneeFar=[-7,-10];
      q.elbowNear=[12,-35];q.handNear=[17,-40];q.elbowFar=[-11,-40];q.handFar=[-4,-48];
    } else if(action==='slash') {
      const strike=clamp((p-.3)/.3),settle=clamp((p-.72)/.28);
      q.hip=[lerp(-3,5,strike),-22];q.footFar=[-13,0];q.footNear=[16,0];q.kneeNear=[10,-12];
      q.elbowNear=[lerp(-7,18,strike),lerp(-51,-34,strike)];q.handNear=[lerp(-9,28,strike),lerp(-59,-25,strike)-settle*4];
      q.elbowFar=[-10,-34];q.handFar=[-13,-26];
    } else if(action==='thrust') {
      const v=Math.sin(p*Math.PI);q.hip=[v*6,-22];q.footFar=[-13,0];q.footNear=[17,0];q.kneeNear=[12,-11];
      q.elbowNear=[11+v*7,-36];q.handNear=[14+v*17,-38];q.elbowFar=[-3+v*5,-33];q.handFar=[8+v*12,-38];
    } else if(action==='bow') {
      q.footFar=[-12,0];q.footNear=[11,0];q.kneeFar=[-7,-13];q.kneeNear=[7,-12];
      q.elbowFar=[15,-41];q.handFar=[27,-42];q.elbowNear=[lerp(16,-13,p),-39];q.handNear=[lerp(24,1,p),-44];
    } else if(action==='roll') {
      q.hip=[0,-17];q.neck=[5,-31];q.head=[7,-35];q.shoulderNear=[9,-28];q.shoulderFar=[0,-28];
      q.kneeNear=[13,-13];q.footNear=[4,-7];q.kneeFar=[-9,-10];q.footFar=[-13,-15];
      q.elbowNear=[16,-22];q.handNear=[15,-13];q.elbowFar=[-5,-24];q.handFar=[-9,-18];q.rotation=-TAU*p;
    } else if(action==='climb') {
      q.hip=[-5,-21];q.neck=[3,-39];q.head=[5,-44];q.footFar=[-15,0];q.kneeFar=[-11,-12];
      q.kneeNear=[14,-23];q.footNear=[15,-13];q.elbowNear=[17,-42];q.handNear=[22,-54+p*9];q.elbowFar=[-2,-46];q.handFar=[2,-56];
    } else if(action==='bound') {
      const pull=Math.sin(t*7)*2;q.elbowFar=[-16,-35];q.handFar=[-12-pull,-24];q.elbowNear=[18,-37];q.handNear=[15+pull,-25];
      q.footNear=[8,0];q.footFar=[-8,0];q.head=[4+Math.sin(t*3),-48];
    } else if(action==='kneel') {
      q.hip=[-4,-13];q.neck=[1,-33];q.head=[3,-37];q.shoulderFar=[-5,-29];q.shoulderNear=[6,-29];
      q.kneeFar=[-11,-1];q.footFar=[-21,0];q.kneeNear=[12,-13];q.footNear=[14,0];
      q.elbowNear=[11,-19];q.handNear=[15,-13];q.elbowFar=[-10,-20];q.handFar=[-8,-13];
    } else if(action==='reach') {
      q.hip=[-3,-21];q.neck=[7,-42];q.head=[10,-46];q.shoulderNear=[12,-39];q.shoulderFar=[1,-38];
      q.elbowNear=[19,-39-p*6];q.handNear=[26+p*5,-43-p*12];q.elbowFar=[-1,-31];q.handFar=[4,-26];q.footFar=[-12,0];q.footNear=[11,0];
    } else if(action==='embrace') {
      q.elbowFar=[9+9*p,-37];q.handFar=[22+5*p,-44+7*p];q.elbowNear=[15,-30-4*p];q.handNear=[22+6*p,-26-6*p];q.head=[4,-48];
    } else if(action==='raise') {
      q.elbowNear=[14,-44-p*5];q.handNear=[19,-51-p*12];q.elbowFar=[-9,-34];q.handFar=[-13,-28];
    } else if(action==='row') {
      const v=Math.sin((phase===undefined?t*.8:p)*TAU);
      q.hip=[-3,-15];q.neck=[v*5,-35];q.head=[v*5+2,-39];q.shoulderNear=[v*5+5,-32];q.shoulderFar=[v*5-5,-32];
      q.kneeNear=[14,-10];q.footNear=[21,-3];q.kneeFar=[8,-8];q.footFar=[16,-2];
      q.elbowNear=[12+v*4,-25];q.handNear=[20+v*8,-23];q.elbowFar=[7+v*4,-26];q.handFar=[16+v*8,-23];
    }
    return q;
  }
  function personInk(c,x,y,t=0,opts={}) {
    opts=opts||{};t=num(t);const id=Object.hasOwn(palettes,opts.identity)?opts.identity:'odysseus',p=palettes[id];
    const action=opts.action||'idle',q=pose(action,t,opts.phase),s=Math.max(.05,num(opts.scale,1)),f=num(opts.facing,1)<0?-1:1;
    // Two-bone contact solve. Props are held by fingers, not independent sprites.
    for(const side of ['Near','Far']) {
      const target=opts['hand'+side];
      if(!Array.isArray(target)||target.length!==2||!target.every(Number.isFinite))continue;
      const sh=q['shoulder'+side],dx=target[0]-sh[0],dy=target[1]-sh[1],dist=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
      const length=Math.max(14.5,dist*.505),bend=Math.acos(clamp(dist/(length*2),0,1))*(side==='Near'?1:-1);
      q['elbow'+side]=[sh[0]+Math.cos(a+bend)*length,sh[1]+Math.sin(a+bend)*length];q['hand'+side]=[...target];
    }
    const dress=id==='penelope',armored=id!=='sailor'&&!dress&&!opts.ragged;
    c.save();c.translate(Math.round(num(x)),Math.round(num(y)));c.scale(s*f,s);
    if(q.rotation){c.translate(0,-18);c.rotate(q.rotation);c.translate(0,18);}
    const hx=q.hip[0],hy=q.hip[1],nx=q.neck[0],ny=q.neck[1];
    const cloak=opts.cloak===undefined?(id==='odysseus'||id==='telemachus'||dress):opts.cloak;
    if(cloak){
      const wind=(action==='run'?12:4)+Math.sin(t*3.2)*2,base=opts.ragged?'#6c7469':p.cloth;
      poly(c,INK,[[nx-5,ny+1],[nx+3,ny+3],[hx-3,hy+12],[hx-13-wind,-5],[hx-17,-12],[hx-12,hy-2]]);
      poly(c,base,[[nx-4,ny+2],[nx+1,ny+5],[hx-5,hy+10],[hx-12-wind,-7],[hx-15,-12],[hx-10,hy-2]]);
      poly(c,opts.ragged?'#444d4b':p.fold,[[nx-3,ny+5],[hx-8,-11],[hx-12-wind,-7],[hx-10,hy-2]]);
      line(c,p.rim,[nx-4,ny+3],[hx-8,hy+4]);
      if(opts.ragged)for(let i=0;i<4;i++)poly(c,INK,[[hx-10-i*3,-8],[hx-11-i*3,-14-i%2*3],[hx-14-i*3,-7]]);
    }
    function leg(far){
      const knee=far?q.kneeFar:q.kneeNear,foot=far?q.footFar:q.footNear;
      limb(c,[hx+(far?-3:3),hy],knee,foot,far?p.shade:p.skin,4);
      line(c,far?p.shade:p.metal,[knee[0],knee[1]+2],[foot[0],foot[1]-3],3);
      rect(c,INK,foot[0]-3,foot[1]-2,9,3);rect(c,'#816449',foot[0]-2,foot[1]-2,7,2);
      line(c,p.light,[foot[0]-1,foot[1]-6],[foot[0]+1,foot[1]-5]);
    }
    leg(true);leg(false);
    if(dress){poly(c,INK,[[nx-7,ny+6],[nx+7,ny+6],[hx+12,0],[hx-12,0]]);poly(c,p.cloth,[[nx-5,ny+7],[nx+5,ny+7],[hx+10,-1],[hx-10,-1]]);for(let i=0;i<4;i++)line(c,i%2?p.fold:p.tunic,[hx-5+i*3,hy],[hx-8+i*5,-2],2);}
    limb(c,q.shoulderFar,q.elbowFar,q.handFar,p.shade,4);
    poly(c,INK,[[nx-8,ny+3],[nx+7,ny+3],[hx+8,hy+5],[hx-8,hy+5]]);
    poly(c,armored?p.metal:p.tunic,[[nx-6,ny+4],[nx+5,ny+4],[hx+6,hy+3],[hx-6,hy+3]]);
    if(armored){
      poly(c,p.rim,[[nx-6,ny+4],[nx-1,ny+5],[hx-1,hy-3],[hx-5,hy-2]]);
      poly(c,p.shade,[[nx+3,ny+5],[nx+5,ny+4],[hx+6,hy+1],[hx+1,hy-1]]);
      line(c,p.shade,[nx-4,ny+10],[nx+3,ny+11]);line(c,p.rim,[hx-4,hy-4],[hx+3,hy-4]);
      for(let i=0;i<5;i++){rect(c,INK,hx-7+i*3,hy+2,3,7);rect(c,p.metal,hx-6+i*3,hy+3,2,5+(i%2));}
    }
    line(c,p.fold,[nx-4,ny+4],[hx+5,hy],2);rect(c,p.fold,hx-7,hy-1,14,3);rect(c,p.rim,hx+1,hy-1,3,2);
    rect(c,p.skin,nx-1,ny-3,5,6);
    const head=q.head;
    poly(c,INK,[[head[0]-5,head[1]-5],[head[0]+4,head[1]-5],[head[0]+6,head[1]+1],[head[0]+4,head[1]+6],[head[0]-4,head[1]+5]]);
    rect(c,p.skin,head[0]-3,head[1]-3,7,8);rect(c,p.light,head[0]+2,head[1]-1,3,4);rect(c,p.skin,head[0]+5,head[1]+1,2,2);
    rect(c,p.hair,head[0]-4,head[1]-5,8,3);rect(c,p.hair,head[0]-4,head[1]-3,2,dress?15:5);
    rect(c,INK,head[0]+3,head[1],2,1);rect(c,p.light,head[0]+2,head[1]-2,3,1);
    if(id==='odysseus'){poly(c,p.hair,[[head[0]-2,head[1]+3],[head[0]+5,head[1]+3],[head[0]+3,head[1]+8],[head[0]-1,head[1]+7]]);rect(c,'#897362',head[0],head[1]+5,1,2);}
    if(dress){poly(c,p.fold,[[head[0]-6,head[1]-5],[head[0]-4,head[1]-7],[head[0]+5,head[1]-6],[head[0]+4,head[1]-3],[head[0]-3,head[1]-4],[head[0]-4,head[1]+14],[head[0]-8,head[1]+14]]);rect(c,p.rim,head[0]-4,head[1]-4,9,1);rect(c,p.rim,head[0]-2,head[1]+3,1,3);}
    if(opts.helmet===true||(opts.helmet!==false&&id==='guard')){
      poly(c,p.metal,[[head[0]-5,head[1]],[head[0]-5,head[1]-6],[head[0]-1,head[1]-9],[head[0]+4,head[1]-6],[head[0]+5,head[1]-2],[head[0]+2,head[1]-2],[head[0]+2,head[1]+4],[head[0],head[1]+4],[head[0],head[1]-2]]);
      line(c,p.rim,[head[0]-4,head[1]-5],[head[0]+3,head[1]-5]);rect(c,p.cloth,head[0]-2,head[1]-12,3,5);
    }
    if(action==='bow') {
      const b=q.handFar;
      const pts=[[b[0]-2,b[1]-20],[b[0]+5,b[1]-12],[b[0]+7,b[1]],[b[0]+5,b[1]+12],[b[0]-2,b[1]+20]];
      for(let i=1;i<pts.length;i++)line(c,p.rim,pts[i-1],pts[i],2);
      line(c,'#dbd2ad',pts[0],q.handNear);line(c,'#dbd2ad',q.handNear,pts[4]);
      if(opts.nocked!==false){line(c,'#e4cc94',[q.handNear[0]-3,b[1]],[b[0]+19,b[1]]);poly(c,'#e8e1bf',[[b[0]+19,b[1]-2],[b[0]+24,b[1]],[b[0]+19,b[1]+2]]);}
      rect(c,p.light,b[0]-2,b[1]-2,4,4);
    }
    limb(c,q.shoulderNear,q.elbowNear,q.handNear,p.skin,4);
    line(c,p.metal,[q.elbowNear[0]+(q.handNear[0]-q.elbowNear[0])*.5,q.elbowNear[1]+(q.handNear[1]-q.elbowNear[1])*.5],q.handNear,4);
    const hand=q.handNear;rect(c,p.light,hand[0]-2,hand[1]-2,4,4);rect(c,p.skin,hand[0]+2,hand[1]-1,2,3);
    if(action==='reach'||action==='raise'||action==='embrace')for(let i=0;i<3;i++)rect(c,p.light,hand[0]+2+i,hand[1]-3+i,1,4);
    if(opts.cup){poly(c,'#dfb26d',[[hand[0]+1,hand[1]-4],[hand[0]+9,hand[1]-4],[hand[0]+7,hand[1]+3],[hand[0]+3,hand[1]+3]]);rect(c,'#6e3040',hand[0]+2,hand[1]-4,6,2);}
    if(opts.shield===true||(opts.shield!==false&&action==='guard'))shield(c,hand[0]+1,hand[1]+2,1,p.metal);
    if(opts.weapon==='sword'){
      const a=action==='slash'?lerp(-2.4,.25,clamp((q.phase-.3)/.3)):-1.05;
      const end=[hand[0]+Math.cos(a)*29,hand[1]+Math.sin(a)*29];
      line(c,INK,hand,end,5);line(c,'#adc2bc',hand,end,3);line(c,'#f1dfb4',[hand[0]+1,hand[1]-1],end);
      line(c,p.rim,[hand[0]-Math.sin(a)*5,hand[1]+Math.cos(a)*5],[hand[0]+Math.sin(a)*5,hand[1]-Math.cos(a)*5],2);
    } else if(opts.weapon==='spear'){
      const a=action==='thrust'?-.07:-1.08,end=[hand[0]+Math.cos(a)*47,hand[1]+Math.sin(a)*47];
      line(c,'#956f49',[hand[0]-Math.cos(a)*22,hand[1]-Math.sin(a)*22],end,2);
      poly(c,'#c8d4c8',[[end[0]-2,end[1]-3],[end[0]+Math.cos(a)*9,end[1]+Math.sin(a)*9],[end[0]+2,end[1]+3]]);
    }
    if(action==='bound')for(let i=0;i<4;i++){line(c,'#bea373',[-10,-36+i*4],[12,-35+i*4],2);rect(c,'#f0cd90',-9,-36+i*4,2,1);}
    c.restore();
    const world=a=>{
      const cos=Math.cos(q.rotation),sin=Math.sin(q.rotation),rx=a[0]*cos-(a[1]+18)*sin,ry=a[0]*sin+(a[1]+18)*cos-18;
      return [num(x)+rx*s*f,num(y)+ry*s];
    };
    return {handNear:world(hand),handFar:world(q.handFar),head:world(head),bow:world(q.handFar),pose:q};
  }
  /* Full oared ship, origin at waterline center. Supports damaged mast and missing
   * rowing stations, while row motion remains a pure function of absolute t. */
  function shipInk(c,x,y,t=0,opts={}) {
    const s=Math.max(.02,num(opts.scale,1)),f=opts.facing===-1?-1:1,tilt=num(opts.tilt);
    c.save();c.translate(Math.round(x),Math.round(y));c.scale(s*f,s);c.rotate(tilt);
    const hull=[[-126,-13],[-112,4],[-84,15],[59,16],[97,5],[125,-18],[138,-41],[133,-53],[125,-51],[125,-35],[112,-24],[83,-20],[-85,-20],[-112,-26],[-127,-43],[-135,-43],[-133,-28]];
    poly(c,INK,hull);poly(c,'#684734',[[-125,-28],[-109,-14],[87,-12],[114,-28],[104,-7],[78,8],[-82,10],[-108,0]]);
    poly(c,'#a2784b',[[-116,-17],[93,-17],[117,-34],[108,-20],[91,-9],[-100,-9]]);
    for(let i=0;i<4;i++)line(c,i%2?'#b58b53':'#493735',[-104+i*7,-7+i*5],[90-i*9,-7+i*5],2);
    for(let i=0;i<14;i++){const xx=-94+i*13;line(c,'#392c30',[xx,-7],[xx+3,10]);rect(c,'#d4af73',xx,-15,2,2);}
    line(c,'#d9bb78',[-112,-23],[93,-23],2);line(c,'#d9bb78',[93,-23],[128,-45],2);
    ellipse(c,'#e5c687',107,-23,6,4);ellipse(c,INK,109,-23,2,2);
    // Far side oars behind the deck, near side paddles below.
    const count=opts.oars===undefined?9:opts.oars,missing=opts.missing||[];
    for(let i=0;i<count;i++){
      if(missing.includes(i))continue;const xx=-89+i*19,phase=t*4.8+i*.11,sw=Math.sin(phase),lift=Math.cos(phase);
      line(c,'#776145',[xx,-18],[xx-20-sw*13,-40-lift*5],2);
    }
    const broken=clamp(num(opts.broken)),mastX=-4,mastY=-146;
    line(c,INK,[mastX,-20],[mastX,broken?-74:mastY],7);line(c,'#c29d61',[mastX-1,-20],[mastX-1,-(broken?74:146)],4);
    if(broken){
      // The upper mast follows a bounded fall; no accumulated simulation.
      c.save();c.translate(-4,-75);c.rotate(broken*1.35);line(c,'#95724b',[0,0],[0,-71],5);
      poly(c,'#beb89b',[[0,-64],[76,-61],[68,-20],[45,-10],[30,-25],[18,-15],[0,-22]]);
      for(let i=0;i<5;i++)line(c,'#777f76',[8+i*14,-61],[8+i*12,-23]);c.restore();
      poly(c,'#e8c488',[[-7,-74],[-5,-84],[-2,-76],[1,-82],[0,-71]]);
    }else if(opts.sail!==false){
      line(c,'#8f734e',[-73,-133],[69,-133],4);
      const billow=5+Math.sin(t*1.8)*2;
      poly(c,INK,[[-70,-132],[68,-132],[76+billow,-80],[63,-61],[-57,-61],[-72+billow,-93]]);
      poly(c,'#c3c4a7',[[-68,-130],[66,-130],[74+billow,-80],[61,-63],[-56,-63],[-70+billow,-93]]);
      poly(c,'#e8dec0',[[-63,-129],[4,-129],[15,-78],[-12,-67],[-54,-66],[-64,-94]]);
      for(let i=0;i<8;i++)line(c,i%2?'#969f91':'#d2cbb0',[-61+i*17,-128],[-55+i*17+billow*.4,-66]);
      line(c,'#806e51',[-69,-132],[-104,-22]);line(c,'#806e51',[69,-132],[111,-24]);
      line(c,'#bfb491',[-4,-147],[-115,-26]);line(c,'#bfb491',[-4,-147],[117,-27]);
      poly(c,'#833f41',[[-3,-145],[30,-143],[21,-137],[-3,-139]]);
    }else{line(c,'#897555',[-4,-144],[-110,-25]);line(c,'#897555',[-4,-144],[111,-25]);line(c,'#aea990',[-61,-118],[56,-118],5);}
    if(opts.crew!==false){for(let i=0;i<6;i++){if(missing.includes(i+1))continue;person(c,-80+i*27,-20,t+i*.03,{scale:.55,identity:'sailor',action:opts.rowing===false?'idle':'row',cloak:false,helmet:false});}}
    for(let i=0;i<count;i++){
      if(missing.includes(i))continue;const xx=-89+i*19,phase=t*4.8+i*.11,sw=Math.sin(phase),lift=Math.cos(phase),end=[xx+14+sw*18,27+lift*7];
      line(c,INK,[xx,-11],end,4);line(c,'#bb9761',[xx,-11],end,2);line(c,'#cbb386',[end[0]-sw*3,end[1]-5],[end[0]+sw*4,end[1]+5],4);
      if(lift>.15){rect(c,'#a3c3b6',end[0]-8,end[1]+2,17,1);rect(c,'#e6d4a9',end[0]-4,end[1],7,1);}
    }
    if(opts.hero)person(c,89,-24,t,{identity:'odysseus',scale:.88,action:opts.heroAction||'guard',shield:true,cloak:true,helmet:false,phase:opts.phase});
    c.restore();
  }
  function cyclopsInk(c,x,y,t=0,opts={}) {
    const s=num(opts.scale,1),awake=clamp(num(opts.awake,1)),sleep=clamp(num(opts.sleep)),arm=clamp(num(opts.arm));
    c.save();c.translate(x,y);c.scale(s, s);
    const flesh=['#34363b','#54514a','#827662','#ab926f'];
    // Broad torso, weight-bearing feet and individually jointed fingers.
    poly(c,INK,[[-50,0],[-49,-39],[-38,-80],[-53,-122],[-39,-159],[-20,-176],[27,-174],[49,-151],[56,-107],[42,-64],[50,-4],[29,0],[14,-57],[-12,-58],[-24,-1]]);
    poly(c,flesh[1],[[-46,-3],[-41,-56],[-27,-94],[-45,-125],[-33,-150],[-14,-169],[24,-164],[44,-143],[47,-111],[31,-66],[44,-4],[30,-3],[12,-65],[-13,-67],[-29,-4]]);
    poly(c,flesh[2],[[-33,-149],[-13,-169],[9,-158],[4,-117],[-24,-100],[-37,-123]]);
    poly(c,flesh[0],[[8,-160],[36,-140],[45,-109],[22,-77],[-9,-72],[-26,-96],[4,-116]]);
    poly(c,'#443b39',[[-29,-79],[31,-78],[37,-53],[-34,-51]]);
    for(let i=0;i<8;i++)line(c,'#80745c',[-29+i*8,-76],[-31+i*9,-53],2);
    const headY=-178+sleep*18;
    poly(c,INK,[[-28,headY-29],[-13,headY-42],[20,headY-39],[37,headY-15],[30,headY+15],[-15,headY+22],[-32,headY+5]]);
    poly(c,flesh[2],[[-25,headY-26],[-11,headY-38],[18,headY-35],[32,headY-14],[26,headY+11],[-14,headY+17],[-27,headY+3]]);
    poly(c,flesh[1],[[13,headY-33],[30,headY-14],[24,headY+12],[3,headY+16],[6,headY-2]]);
    poly(c,'#302f35',[[-26,headY-25],[-14,headY-39],[18,headY-38],[30,headY-25],[8,headY-28],[-10,headY-23]]);
    line(c,INK,[-14,headY-14],[16,headY-16],5);
    const eyeH=Math.max(1,5*awake*(1-sleep));ellipse(c,'#dbc49a',2,headY-8,12,eyeH);ellipse(c,'#e6a258',5,headY-8,4,eyeH);rect(c,INK,5,headY-10,2,Math.max(1,eyeH*2));
    poly(c,flesh[3],[[1,headY-1],[6,headY-3],[11,headY+6],[-1,headY+7]]);line(c,'#3a3030',[-10,headY+11],[15,headY+10],3);
    function armAt(side){
      const sh=[side*40,-144],el=[side*(64+arm*8),-100-arm*43],hand=[side*(59+arm*39),-63-arm*74];
      if(side===-1&&opts.drink!==undefined){const p=clamp(opts.drink);hand[0]=lerp(hand[0],-18,p);hand[1]=lerp(hand[1],-149,p);}
      limb(c,sh,el,hand,flesh[1],21);line(c,flesh[2],[sh[0]-4,sh[1]],[el[0]-4,el[1]],7);
      ellipse(c,flesh[2],...hand,13,13);
      for(let i=0;i<4;i++)line(c,flesh[i%2+1],[hand[0]-9+i*6,hand[1]+5],[hand[0]-8+i*6,hand[1]+20-(i===3?5:0)],4);
      line(c,flesh[3],[hand[0]-10,hand[1]],[hand[0]-18,hand[1]+9],5);
      if(side===-1&&opts.cup){poly(c,'#b38c56',[[hand[0]-13,hand[1]-9],[hand[0]+14,hand[1]-9],[hand[0]+10,hand[1]+9],[hand[0]-8,hand[1]+9]]);ellipse(c,'#ebc780',hand[0],hand[1]-9,14,5);ellipse(c,'#74303d',hand[0],hand[1]-9,11,3);}
    }
    armAt(-1);armAt(1);
    for(let i=0;i<5;i++){rect(c,flesh[3],-45+i*4,-4,3,3);rect(c,flesh[3],28+i*4,-4,3,3);}
    c.restore();
  }
  function scyllaInk(c,x,y,t=0,opts={}) {
    const s=num(opts.scale,1),extension=clamp(num(opts.extension,1)),strike=clamp(num(opts.strike)),heads=[];
    c.save();c.translate(x,y);c.scale(s,s);
    poly(c,'#112631',[[-52,21],[-62,-21],[-23,-52],[26,-48],[55,-12],[48,29]]);
    for(let i=0;i<6;i++){
      const a=-2.65+i*.43,reach=42+extension*(47+i%2*18),wave=Math.sin(t*1.7+i)*4;
      const root=[-25+i*10,8],mid=[Math.cos(a)*reach*.53,-22-i*7],tip=[Math.cos(a)*reach-18-strike*20,-38-i*19+wave+strike*(i%2?27:12)];
      if(i===(opts.strikeIndex||0)&&Array.isArray(opts.strikeTarget)){
        tip[0]=lerp(tip[0],opts.strikeTarget[0],strike);tip[1]=lerp(tip[1],opts.strikeTarget[1],strike);
        mid[0]=lerp(mid[0],tip[0]*.7,strike);mid[1]=lerp(mid[1],tip[1]-34,strike);
      }
      const points=[];
      for(let j=0;j<=18;j++){const u=j/18;points.push([(1-u)*(1-u)*root[0]+2*(1-u)*u*mid[0]+u*u*tip[0],(1-u)*(1-u)*root[1]+2*(1-u)*u*mid[1]+u*u*tip[1]]);}
      for(let j=1;j<points.length;j++)line(c,'#0b1824',points[j-1],points[j],15-j*.3);
      for(let j=1;j<points.length;j++){line(c,i%2?'#3d696c':'#467d7e',points[j-1],points[j],10-j*.25);if(j%3===0)rect(c,'#9ab59d',points[j][0]-2,points[j][1]-2,3,2);}
      poly(c,INK,[[tip[0]+7,tip[1]-7],[tip[0]-9,tip[1]-8],[tip[0]-23,tip[1]-1],[tip[0]-22,tip[1]+10],[tip[0]-2,tip[1]+10],[tip[0]+8,tip[1]+3]]);
      poly(c,'#719c8b',[[tip[0]+5,tip[1]-5],[tip[0]-9,tip[1]-6],[tip[0]-21,tip[1]],[tip[0]-12,tip[1]+3],[tip[0]+5,tip[1]+2]]);
      poly(c,'#355a65',[[tip[0]-19,tip[1]+8],[tip[0]-6,tip[1]+4],[tip[0]+5,tip[1]+3],[tip[0],tip[1]+9]]);
      rect(c,'#f0c87a',tip[0]-7,tip[1]-4,4,2);rect(c,INK,tip[0]-6,tip[1]-4,1,2);
      for(let k=0;k<3;k++)poly(c,'#d6d5b0',[[tip[0]-18+k*5,tip[1]+1],[tip[0]-15+k*5,tip[1]+1],[tip[0]-16+k*5,tip[1]+5]]);
      poly(c,'#a8bc9b',[[tip[0]+1,tip[1]-6],[tip[0]+4,tip[1]-14],[tip[0]+7,tip[1]-4]]);
      heads.push([x+tip[0]*s,y+tip[1]*s]);
    }
    c.restore();return heads;
  }
  function sheepInk(c,x,y,t=0,opts={}) {
    const s=num(opts.scale,1);c.save();c.translate(x,y);c.scale(s, s);
    for(let i=0;i<4;i++){const xx=-11+i*7,sw=Math.sin(t*6+i*Math.PI)*3;line(c,'#5d554b',[xx,-12],[xx+sw,0],3);}
    if(opts.hidden)person(c,-1,-1,t,{scale:.43,action:'bound',cloak:false,shield:false});
    ellipse(c,'#878c7e',0,-20,23,13);
    for(let i=0;i<14;i++){const a=i*2.399;ellipse(c,i%3?'#d4d4b3':'#aeb79e',Math.cos(a)*(i%2?17:11),-23+Math.sin(a)*8,6,5);}
    poly(c,'#827663',[[18,-25],[28,-29],[33,-20],[29,-13],[20,-14]]);rect(c,INK,28,-24,2,2);
    ellipse(c,'#c5b17c',21,-28,6,6);ellipse(c,'#76654e',21,-28,3,3);c.restore();
  }
  function sirenInk(c,x,y,t=0,opts={}) {
    const s=num(opts.scale,1);c.save();c.translate(x,y);c.scale(s,s);
    const wing=3+Math.sin(t*1.1)*3;
    poly(c,'#4c3e68',[[-3,-33],[-23,-55-wing],[-37,-57],[-31,-42],[-13,-22],[-3,-12],[7,-13],[24,-33],[38,-54-wing],[23,-49],[5,-35]]);
    for(let i=0;i<5;i++){line(c,'#8c79a0',[-6,-29],[-32+i*3,-49-i],1);line(c,'#8c79a0',[5,-29],[30-i*3,-47-i],1);}
    poly(c,'#b5a5b1',[[-5,-35],[4,-35],[10,-12],[6,0],[-10,0],[-8,-16]]);poly(c,'#665779',[[-3,-34],[3,-32],[6,-3],[-5,-1]]);
    ellipse(c,'#d8c8b7',0,-41,5,6);poly(c,'#332d53',[[-5,-43],[-3,-50],[4,-48],[8,-39],[5,-35],[2,-44]]);
    line(c,'#d5c49f',[-4,-31],[-16,-25],2);line(c,'#d5c49f',[4,-31],[16,-39],2);c.restore();
  }
  // Scratch surfaces are cleared on every call; they hold no animation state.
  // Rasterize at native pixel scale, THEN nearest-neighbor scale the completed
  // actor. Direct fractional fillRect transforms otherwise produce thousands
  // of unintended interpolated colors along armour and limb silhouettes.
  const tiles=new Map();
  function raster(kind,c,x,y,t,opts,ink,width,height,ox,oy){
    opts=opts||{};
    let tile=tiles.get(kind);
    if(!tile){
      const cv=typeof OffscreenCanvas==='function'?new OffscreenCanvas(width,height):document.createElement('canvas');
      cv.width=width;cv.height=height;tile={cv,ctx:cv.getContext('2d')};tiles.set(kind,tile);
    }
    const tc=tile.ctx;tc.setTransform(1,0,0,1,0,0);tc.globalAlpha=1;tc.globalCompositeOperation='source-over';tc.clearRect(0,0,width,height);tc.imageSmoothingEnabled=false;
    const result=ink(tc,ox,oy,num(t),{...opts,scale:1,facing:1});
    const s=Math.max(.02,num(opts.scale,1)),f=opts.facing===-1?-1:1;
    c.save();c.translate(Math.round(num(x)),Math.round(num(y)));c.scale(s*f,s);c.imageSmoothingEnabled=false;c.drawImage(tile.cv,-ox,-oy);c.restore();
    const world=p=>[num(x)+(p[0]-ox)*s*f,num(y)+(p[1]-oy)*s];
    if(kind==='person')return {pose:result.pose,handNear:world(result.handNear),handFar:world(result.handFar),head:world(result.head),bow:world(result.bow)};
    if(kind==='scylla')return result.map(world);
    return result;
  }
  function person(c,x,y,t=0,opts={}){return raster('person',c,x,y,t,opts,personInk,192,144,78,110);}
  function ship(c,x,y,t=0,opts={}){return raster('ship',c,x,y,t,opts,shipInk,368,252,184,195);}
  function cyclops(c,x,y,t=0,opts={}){return raster('cyclops',c,x,y,t,opts,cyclopsInk,280,264,140,242);}
  function scylla(c,x,y,t=0,opts={}){return raster('scylla',c,x,y,t,opts,scyllaInk,490,246,330,194);}
  function sheep(c,x,y,t=0,opts={}){return raster('sheep',c,x,y,t,opts,sheepInk,98,68,46,56);}
  function siren(c,x,y,t=0,opts={}){return raster('siren',c,x,y,t,opts,sirenInk,104,96,52,82);}
  return {person,pose,ship,cyclops,scylla,sheep,siren,shield,palettes};
}