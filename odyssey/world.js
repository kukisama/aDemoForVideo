/* ODYSSEY / NOBODY. Original 640x360 pixel cinematography, classic script.
 * 54 independently staged shots; story.mjs is the sole editorial clock.
 * All noise is a fixed hash. Seeking, reverse seeking and the endpoint are pure.
 * Captions belong to HTML: the bottom 60px carry atmosphere, never vital action. */
function createOdysseyWorld(canvas, data) {
  'use strict';
  if (!data || !data.chapters || !data.shots) throw new Error('Odyssey needs locked story data');
  canvas.width=640;canvas.height=360;
  const c=canvas.getContext('2d',{alpha:false});
  if(!c)throw new Error('Odyssey: Canvas 2D unavailable');
  const actors=createOdysseyActors(), W=640,H=360,TAU=Math.PI*2;
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),mix=(a,b,p)=>a+(b-a)*p;
  const smooth=(a,b,x)=>{const u=clamp((x-a)/(b-a));return u*u*(3-2*u);};
  const fract=v=>v-Math.floor(v),hash=n=>fract(Math.sin(n*127.1+311.7)*43758.5453123);
  const duration=Number.isFinite(data.duration)?data.duration:180;
  const cues=new Map((data.actionCues||[]).map(q=>[q.id,q]));
  const when=id=>cues.has(id)?cues.get(id).time:Infinity;
  const elapsed=(id,t)=>t-when(id);
  const phase=(id,t,pre=.65,post=.65)=>{
    let d=elapsed(id,t);
    if(d>=0&&d<.2&&['clash','shield','impact'].includes(cues.get(id)?.kind))d=d<.05?0:d-.05*(1-smooth(.05,.2,d));
    return clamp((d+pre)/(pre+post));
  };
  const attack=(id,t)=>{const d=elapsed(id,t);return d<0?smooth(-.6,0,d):1-smooth(.05,.8,d);};
  const pulse=(id,t,life=.6)=>{const d=elapsed(id,t);return d>=0&&d<life?1-d/life:0;};
  const P={ink:'#0b1421',navy:'#14283b',blue:'#24465b',teal:'#3b737e',foam:'#a8c6b8',cream:'#e9d8ad',gold:'#d7b072',rust:'#8b513e',wine:'#703439'};
  const R=(x,y,w,h,col)=>{if(w<=0||h<=0)return;c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));};
  function poly(points,col){
    const lo=Math.max(-400,Math.floor(Math.min(...points.map(p=>p[1])))),hi=Math.min(800,Math.ceil(Math.max(...points.map(p=>p[1]))));
    c.fillStyle=col;
    for(let y=lo;y<hi;y++){
      const xs=[];
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const a=points[j],b=points[i],v=y+.5;
        if((a[1]<=v&&b[1]>v)||(b[1]<=v&&a[1]>v))xs.push(a[0]+(v-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)c.fillRect(Math.round(xs[i]),y,Math.max(1,Math.round(xs[i+1])-Math.round(xs[i])),1);
    }
  }
  function line(x,y,xx,yy,col,w=1){
    const steps=Math.max(1,Math.ceil(Math.max(Math.abs(xx-x),Math.abs(yy-y))));
    for(let i=0;i<=steps;i++)R(mix(x,xx,i/steps)-w/2,mix(y,yy,i/steps)-w/2,w,w,col);
  }
  function ellipse(x,y,rx,ry,col){for(let v=-Math.ceil(ry);v<=ry;v++){const width=rx*Math.sqrt(Math.max(0,1-v*v/(ry*ry)));R(x-width,y+v,width*2+1,1,col);}}
  function ring(x,y,rx,ry,col,width=1,start=0,end=TAU){let prev;for(let a=start;a<=end+.025;a+=.035){const p=[x+Math.cos(a)*rx,y+Math.sin(a)*ry];if(prev)line(...prev,...p,col,width);prev=p;}}
  function alpha(a,fn){c.save();c.globalAlpha*=clamp(a);fn();c.restore();}
  function placed(x,y,s,fn,rotation=0){c.save();c.translate(Math.round(x),Math.round(y));c.scale(s,s);if(rotation)c.rotate(rotation);fn();c.restore();}
  function deckMotion(angle,fn){c.save();c.translate(320,263);c.rotate(angle);c.translate(-320,-263);try{fn();}finally{c.restore();}}
  function grit(x,y,w,h,colors,count=90,seed=0){for(let i=0;i<count;i++){const xx=x+hash(i+seed+10)*w,yy=y+hash(i+seed+321)*h;R(xx,yy,1+Math.floor(hash(i+seed+80)*5),1,colors[i%colors.length]);}}
  function sky(t,kind='sea'){
    const palettes={sea:['#14283e','#2c4e65','#537c88','#859f9d','#c5c7ac'],gold:['#333750','#685461','#a57e73','#cfad88','#edcea0'],fire:['#171d30','#352b3d','#66404a','#925143','#c58254'],night:['#0b1427','#14233c','#243755','#344864','#5b6678'],storm:['#111e30','#203347','#334c5f','#4e6975','#738a8e'],violet:['#131c36','#292849','#484164','#74647e','#a49799']};
    const cols=palettes[kind]||palettes.sea;
    for(let i=0;i<5;i++){R(0,i*43,W,44,cols[i]);if(i>0)for(let y=0;y<8;y++)for(let x=(y%2)*3;x<W;x+=6)if((x+y)%4<2)R(x,i*43-y,2,1,cols[i]);}
    if(kind==='gold'||kind==='sea'){ellipse(kind==='gold'?434:463,110,25,25,kind==='gold'?'#f4dbac':'#d8d7bb');}
    if(kind==='night')for(let i=0;i<80;i++){const x=hash(i+443)*W,y=hash(i+513)*160;R(x,y,i%17===0?2:1,1,i%4?'#b2b9c0':'#e9d7ad');}
    for(let layer=0;layer<3;layer++)for(let j=0;j<5;j++){
      const id=j+layer*7,x=fract(hash(id+303)+t*(layer+1)*.0004)*850-110,y=35+layer*36+hash(id)*21,w=75+hash(id+70)*100;
      const top=[];for(let k=0;k<9;k++)top.push([x+k*w/8,y-4-Math.sin(k*.48+id)*7-hash(id*13+k)*8]);
      poly([...top,[x+w+19,y+7],[x+5,y+11]],cols[Math.min(4,layer+1)]);
      line(x+15,y+10,x+w-19,y+10,cols[Math.min(4,layer+2)]);
    }
  }
  function island(x,y,w,h,seed=1,near=false){
    const pts=[[x-w*.1,y+12]];
    for(let i=0;i<=12;i++){const u=i/12;pts.push([x+w*u,y-Math.sin(u*Math.PI)*h*(.7+hash(seed+i)*.4)]);}
    pts.push([x+w+15,y+12]);poly(pts,near?'#304e55':'#4f747e');
    for(let i=1;i<10;i+=2){const u=i/12,peak=y-Math.sin(u*Math.PI)*h*.8;poly([[x+w*u,peak],[x+w*(u+.08),y],[x+w*(u+.19),y]],near?'#496266':'#66858a');}
    line(x,y+8,x+w,y+8,near?'#8e9b88':'#789797');
  }
  function sea(t,{horizon=174,kind='sea',rough=0,reduced=false}={}){
    const banks={sea:['#426f7c','#315b6f','#23475d','#19334a','#11283d'],gold:['#8f9d94','#677e7d','#456568','#294953','#1c3645'],night:['#263c58','#20344e','#192a44','#13223b','#101c31'],storm:['#446577','#365469','#28465d','#1b354c','#10283d'],violet:['#70617f','#514c70','#343a5d','#232c4b','#171e36']};
    const cols=banks[kind]||banks.sea;R(0,horizon,W,H-horizon,cols[0]);
    for(let row=0;row<17;row++){
      const depth=row/16,y=horizon+depth*depth*(360-horizon),amp=1+depth*(rough?9:3),pts=[[0,360]];
      for(let x=-8;x<=W+8;x+=8){const v=y+Math.sin(x*.026+t*(rough?1.4:.7)+row)*amp+Math.sin(x*.064-t*.8+row*2)*amp*.4;pts.push([x,v]);}
      pts.push([W,360]);poly(pts,cols[Math.min(4,Math.floor(row/4))]);
      for(let i=0;i<12;i++){const xx=fract(hash(row*31+i)+t*.003*(1+depth))*W,yy=y+Math.sin(xx*.026+t*.7+row)*amp;R(xx,yy,3+depth*17+hash(i+row)*12,1,depth<.4?'#71959a':row%3?'#3c6477':'#658d98');}
    }
    for(let i=0;i<80*(reduced?.4:1);i++){const d=hash(i+167),x=fract(hash(i+7)+t*.002*(1+d))*W,y=horizon+d*d*(H-horizon);R(x,y,2+d*13,1,i%4?'#517c88':'#97b4ad');}
  }
  function waveWall(t,x=430,y=229,s=1){
    placed(x,y,s,()=>{
      poly([[-310,128],[-276,57],[-223,-12],[-186,-95],[-133,-150],[-61,-170],[0,-161],[54,-135],[88,-98],[52,-111],[18,-113],[-14,-92],[-38,-43],[-18,15],[38,39],[105,71],[173,128]],'#193b52');
      poly([[-281,110],[-218,12],[-175,-74],[-126,-126],[-64,-148],[4,-142],[48,-122],[13,-126],[-34,-99],[-63,-47],[-42,9],[7,53],[85,79]],'#326c7b');
      poly([[-260,93],[-197,-17],[-145,-105],[-99,-130],[-38,-140],[14,-132],[-30,-129],[-79,-90],[-92,-34],[-71,19],[-20,54]],'#4c8b91');
      const crest=[[-189,-78],[-169,-108],[-133,-138],[-87,-158],[-37,-161],[9,-149],[42,-131],[65,-111],[38,-121],[8,-122],[-23,-107]];
      for(let i=1;i<crest.length;i++)line(...crest[i-1],...crest[i],i%2?'#c4d6bb':'#82b5ae',4);
      for(let i=0;i<48;i++){const a=hash(i)*2.4+2.7,rad=60+hash(i+99)*65;R(-45+Math.cos(a)*rad,-30+Math.sin(a)*rad,2+hash(i+20)*5,1,'#71a9a6');}
      for(let i=0;i<35;i++){const age=fract(t*.45+hash(i+104));R(-100+hash(i)*160+age*24,-153-hash(i+51)*40+age*32,2,2,'#b4cdb6');}
    });
  }
  function rock(x,y,w,h,seed=1,col='#4f534f'){
    const outline=[[x-w*.5,y],[x-w*.56,y-h*.24],[x-w*.36,y-h*.74],[x-w*.09,y-h],[x+w*.29,y-h*.88],[x+w*.51,y-h*.42],[x+w*.46,y]];
    poly(outline,col);poly([[x-w*.09,y-h],[x+w*.29,y-h*.88],[x+w*.51,y-h*.42],[x+w*.1,y-h*.27],[x-w*.1,y-h*.58]],'#73766a');
    poly([[x-w*.36,y-h*.74],[x-w*.09,y-h],[x-w*.1,y-h*.58],[x-w*.27,y-h*.35]],'#92917a');
    for(let i=0;i<8;i++){const xx=x-w*.27+hash(i+seed)*w*.53,yy=y-h*.13-hash(i+seed+61)*h*.64;line(xx,yy,xx+8+hash(i)*w*.12,yy-3,'#3b4448');}
  }
  function floor(y=269,kind='cave'){
    const cols=kind==='palace'?['#565750','#7f7963','#383f43']:['#33383d','#5d5950','#252e37'];
    R(0,y,W,H-y,cols[0]);
    for(let row=0;row<7;row++){const yy=y+row*row*2.6;line(0,yy,W,yy,cols[2]);}
    for(let i=-8;i<=12;i++)line(320+i*18,y,320+i*80,H,cols[1]);
    grit(0,y,W,H-y,cols.slice(1),65,411);
  }
  function fire(x,y,t,s=1){
    alpha(.1,()=>ellipse(x,y-13*s,35*s,40*s,'#ecaa60'));
    for(let i=0;i<7;i++){const h=(11+Math.sin(t*8+i*2)*5+i%3*4)*s;poly([[x+(i-4)*3*s,y],[x+(i-3)*3*s+Math.sin(t*5+i)*3*s,y-h],[x+(i-1)*3*s,y]],['#a25640','#d8894e','#e8b66d','#f3d79b'][i%4]);}
    for(let i=0;i<7;i++){const v=fract(t*.4+hash(i));R(x+Math.sin(i+v*7)*13*s,y-v*49*s,1,2,'#ddae6e');}
  }
  function motes(t,x,y,w,h,count=30,col='#c2ab7e'){
    for(let i=0;i<count;i++){const v=fract(hash(i+703)+t*.019);alpha(.2+hash(i)*.4,()=>R(x+hash(i+81)*w+Math.sin(t+i)*2,y+v*h,1+(i%9===0),1,col));}
  }
  function impact(id,t,x,y,{reduced=false,color='#e4bc76',size=1}={}){
    const d=elapsed(id,t);if(d<0||d>.7)return;
    if(reduced)return;
    // Local sparks only. There is deliberately no full-screen flash layer.
    if(cues.get(id)?.kind==='shield'&&d<.3)alpha((1-d/.3)*.6,()=>{
      ring(x,y,(7+d*87)*size,(10+d*66)*size,'#e6d6a7',1);
      if(d<.12)line(x-8*size,y,x+9*size,y,'#f7e5b6',2);
    });
    for(let i=0;i<(reduced?6:23);i++){const a=hash(i+31)*TAU,r=(8+d*(24+hash(i+16)*55))*size;
      const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r+d*d*37;
      alpha((1-d/.7)*.9,()=>line(px,py,px-Math.cos(a)*(reduced?2:6)*size,py-Math.sin(a)*4*size,i%3?color:'#fff0bb',1+(i%5===0)));}
    if(!reduced&&d<.16)alpha(.1*(1-d/.16),()=>ellipse(x,y,45*size,34*size,color));
  }
  function bladeTrail(id,t,x,y,scale,reduced=false){
    const age=elapsed(id,t);if(reduced||age<-.3||age>.38)return;
    // An afterimage of the ACTUAL hand and sword tip, not a projectile or spell.
    const points=[];
    for(let i=0;i<7;i++){
      const sample=t-(6-i)*.021,q=actors.pose('slash',sample,phase(id,sample));
      const a=mix(-2.4,.25,clamp((q.phase-.3)/.3));
      points.push([x+(q.handNear[0]+Math.cos(a)*29)*scale,y+(q.handNear[1]+Math.sin(a)*29)*scale]);
    }
    for(let i=1;i<points.length;i++)alpha(i/points.length*.62,()=>{
      line(...points[i-1],...points[i],i>4?'#f5ddab':'#92acac',i>4?2:3);
    });
  }
  function splash(id,t,x,y,s=1,reduced=false){
    const d=elapsed(id,t);if(d<0||d>2.4)return;
    for(let j=0;j<4;j++)ring(x,y,12+(d*65+j*8)*s,(4+d*13+j*2)*s,j%2?'#507b88':'#bdd0b7',1);
    for(let i=0;i<(reduced?12:48);i++){const u=hash(i+517),vx=(u-.5)*110,vy=-30-hash(i+93)*90,yy=y+(vy*d+55*d*d)*s;
      if(yy<y+8)R(x+vx*d*s,yy,2,2+(i%3),'#c9d6bd');}
  }
  function arrow(x,y,length=28,angle=0,color='#e9d2a0'){
    const dx=Math.cos(angle),dy=Math.sin(angle);line(x-dx*length,y-dy*length,x,y,color);
    poly([[x+dx*4,y+dy*4],[x-dx*3-dy*2,y-dy*3+dx*2],[x-dx*3+dy*2,y-dy*3-dx*2]],'#dfe0c0');
    line(x-dx*length,y-dy*length,x-dx*(length-4)-dy*3,y-dy*(length-4)+dx*3,color);
  }
  function olive(x,y,s=1,seed=1){
    placed(x,y,s,()=>{
      poly([[-7,0],[-4,-37],[-17,-64],[-12,-67],[1,-45],[12,-70],[18,-69],[6,-36],[10,0]],'#655646');
      line(-2,-3,2,-40,'#a3936f',2);
      for(let i=0;i<19;i++){const a=i*2.399,xx=Math.cos(a)*(18+hash(i+seed)*22),yy=-61+Math.sin(a)*18;
        ellipse(xx,yy,14+hash(i)*9,7+hash(i+9)*6,i%3?'#697f66':'#455e55');
        for(let j=0;j<5;j++)R(xx-8+j*4,yy-3+(j%2),3,1,'#a5b08c');}
    });
  }
  function person(x,y,t,o={}){
    if(o.hands){const s=o.scale||1,f=o.facing===-1?-1:1;o={...o};for(const side of ['Near','Far']){const h=o.hands[side.toLowerCase()];if(h)o['hand'+side]=[(h[0]-x)/(s*f),(h[1]-y)/s];}}
    return actors.person(c,x,y,t,o);
  }
  function deck(t,{tilt=0,broken=0,mast=true}={}){
    placed(320,263,1,()=>{
      poly([[-360,-9],[-175,-34],[158,-34],[357,-7],[360,100],[-360,100]],'#674b3c');
      for(let i=-9;i<12;i++)line(i*24,-28,i*40,98,i%3?'#a07b50':'#493735');
      for(let i=0;i<4;i++)line(-360,i*24,360,i*24,'#392d31');
      line(-330,-36,317,-36,'#c3a16a',5);line(-330,-28,317,-28,'#322d31',3);
      for(let i=-5;i<6;i++){R(i*57,-40,6,32,'#624c3b');R(i*57,-40,2,32,'#bd985e');}
      if(mast){const top=broken?-97:-208;R(-36,top,13,-top,'#533c31');R(-32,top,4,-top-2,'#c19a60');
        if(broken){placed(-29,-97,1,()=>{line(0,0,0,-108,'#b48c59',7);poly([[0,-100],[147,-93],[137,-53],[95,-20],[72,-35],[54,-22],[29,-48],[0,-37]],'#aaaf9b');},broken*1.35);}
        else{line(-29,-203,-200,-37,'#a9a990');line(-29,-203,227,-37,'#a9a990');}
      }
    },tilt);
  }
  function cave(t,{sealed=false,close=false}={}){
    R(0,0,W,H,'#101d2a');
    poly([[0,0],[640,0],[640,300],[518,271],[470,91],[374,43],[290,54],[177,164],[148,291],[0,321]],'#363d40');
    for(let i=0;i<9;i++){
      const x=i*89-42,depth=hash(i+612);poly([[x,0],[x+93,0],[x+88,58+depth*110],[x+41,140+depth*78],[x+11,79]],i%2?'#464a46':'#292f36');
      poly([[x+15,4],[x+31,9],[x+41,140+depth*78],[x+27,87]],'#65655a');
    }
    if(!sealed){poly([[54,63],[126,48],[173,91],[171,247],[29,247],[31,101]],'#6e9b9c');poly([[69,73],[124,59],[159,96],[149,237],[41,237]],'#bccab0');
      alpha(.16,()=>poly([[64,83],[151,86],[414,275],[72,274]],'#ebd9a1'));
      for(let i=0;i<8;i++)line(62+i*11,93,72+i*43,273,'#34444a');
    }else rock(107,273,183,236,73,'#50524a');
    floor(267);for(let i=0;i<8;i++)rock(19+i*84,282+hash(i)*12,16+hash(i+1)*29,11+hash(i+2)*26,i,'#454748');
    if(close)poly([[0,0],[49,0],[73,142],[27,303],[0,330]],'#17232e');
    grit(193,30,440,212,['#424746','#596055','#222f36'],130,901);
    motes(t,46,88,177,181,22);
  }
  function palace(t,{warm=false,depth=true}={}){
    R(0,0,W,H,warm?'#29282c':'#202832');
    poly([[126,30],[514,30],[435,259],[210,259]],warm?'#51473e':'#3e4949');
    R(258,78,119,178,'#13232b');R(270,84,95,169,warm?'#4b3a30':'#263a40');
    floor(262,'palace');
    for(let i=3;i>=0;i--){const z=Math.pow(.73,i),yy=264-i*8;
      for(const side of [-1,1]){const x=320+side*(266*z),w=35*z,top=29+(1-z)*102;
        R(x-w/2,top,w,yy-top,'#74796b');R(x-w/2+2,top,w*.25,yy-top,'#b3ac89');R(x+w*.24,top,w*.26,yy-top,'#4e5b55');
        for(let f=0;f<4;f++)line(x-w*.28+f*w*.15,top+9,x-w*.28+f*w*.15,yy-5,'#8a8d78');
        R(x-w*.7,top-8,w*1.4,8,'#a49b7d');R(x-w*.65,yy-4,w*1.3,7,'#8e8c73');
      }
    }
    R(30,21,580,12,'#a19372');for(let i=0;i<23;i++){R(36+i*25,21,17,3,'#d2b888');R(36+i*25,25,3,7,'#d2b888');}
    for(const x of [144,495]){R(x-4,215,8,40,'#454440');poly([[x-17,212],[x+17,212],[x+10,225],[x-10,225]],'#8f714c');fire(x,213,t,.85);}
    if(depth){alpha(.12,()=>poly([[207,37],[243,37],[355,260],[266,260]],'#e1c490'));motes(t,150,60,350,189,33);}
  }
  function axe(x,y,s=1){
    placed(x,y,s,()=>{
      R(-2,0,4,61,'#947148');R(-5,59,10,3,'#bc9c64');
      poly([[-4,-20],[-13,-24],[-19,-12],[-17,3],[-7,8],[-5,3],[5,3],[7,8],[17,3],[19,-12],[13,-24],[4,-20]],'#c0c4aa');
      poly([[-14,-20],[-18,-10],[-15,0],[-9,4],[-9,-10]],'#78969a');
      R(-6,-14,12,14,'#1a2e38');R(-4,-12,8,10,'#101e2a');
      line(-5,-15,5,-15,'#ede0b6');line(6,-14,6,0,'#768c8c');
    });
  }
  const axeStations=Array.from({length:12},(_,i)=>({x:262+i*27,y:190,s:.72}));
  function axes(){for(const a of axeStations)axe(a.x,a.y,a.s);}
  function arrowState(t){const release=when('arrow-release'),finish=when('twelve-axes');return {released:t>=release,release,contact:finish,progress:clamp((t-release)/(finish-release)),x:mix(242,559,clamp((t-release)/(finish-release))),y:184.9};}
  function bed(t,detail=false){
    // Rooted pillar, not a planter. Roots visibly cross the actual stone floor.
    const x=detail?314:433,base=detail?283:267,s=detail?1.63:1;
    placed(x,base,s,()=>{
      poly([[-6,-55],[101,-47],[103,-14],[-7,-18]],'#594437');R(-2,-48,97,13,'#b8a788');R(4,-47,88,3,'#e0ca9d');
      poly([[4,-43],[101,-39],[101,-18],[43,-26],[6,-27]],'#7f7c70');for(let i=0;i<7;i++)line(13+i*13,-41,18+i*13,-26,'#a8a58b');
      R(90,-53,6,54,'#956d46');R(88,-57,10,6,'#c1a36b');
      poly([[-12,0],[-7,-62],[-9,-114],[-3,-144],[5,-141],[7,-91],[10,-40],[12,0]],'#75603f');
      poly([[-6,-3],[-4,-60],[-5,-114],[-1,-140],[2,-139],[3,-92],[6,-40],[5,-1]],'#ba995b');
      for(let i=0;i<5;i++){const xx=-7+i*4;line(xx,-17,xx+Math.sin(i)*4,-101,'#4f4935');}
      line(0,-133,-22,-147,'#8e7749',4);line(1,-121,19,-134,'#8e7749',4);
      for(let i=0;i<12;i++){const a=i*2.4,xx=i<6?-21:21,yy=i<6?-144:-133;poly([[xx+Math.cos(a)*10,yy+Math.sin(a)*8],[xx+Math.cos(a)*16+4,yy+Math.sin(a)*12-3],[xx+Math.cos(a)*14+6,yy+Math.sin(a)*10+2]],i%2?'#a8b488':'#71895f');}
      for(let i=0;i<7;i++){const side=i%2?-1:1,len=21+i*7;poly([[side*4,-14],[side*12,-4],[side*len,5+i%3*4],[side*(len+12),8+i%3*4],[side*(len-2),10+i%3*3],[side*11,4],[-side*2,0]],i%2?'#937c4e':'#b39a61');}
      for(let i=0;i<8;i++)line(-41+i*14,8,-30+i*14,12,'#303b39');
    });
  }
  function coast(t,{night=false,wide=false}={}){
    sky(t,night?'night':'gold');sea(t,{horizon:175,kind:night?'night':'gold'});
    island(67,187,220,76,12);island(392,174,234,109,34);
    poly([[0,273],[81,259],[156,243],[226,260],[295,295],[370,303],[397,360],[0,360]],night?'#202e39':'#756c52');
    poly([[0,299],[104,279],[182,265],[240,282],[282,310],[351,326],[363,360],[0,360]],night?'#31403f':'#a49970');
    for(let row=0;row<3;row++)for(let i=0;i<5-row;i++){
      const x=20+i*36+row*12,y=263-row*25,s=1-row*.18;
      R(x,y-20*s,28*s,22*s,night?'#50534a':'#c4b48b');poly([[x-2,y-20*s],[x+14*s,y-29*s],[x+30*s,y-20*s]],night?'#594c43':'#8a6247');
      R(x+10*s,y-10*s,5*s,12*s,night?'#e5bb70':'#555748');
    }
    olive(35,297,1.1,9);if(!wide)olive(613,305,1.9,13);
    for(let i=0;i<7;i++){const x=270+i*15,y=286+i*7;line(x,y,x+38,y-3,'#c2b996');}
  }
  function threshold(v){
    const {t,shot,p}=v;R(0,0,W,H,'#1b2932');
    if(shot.name==='hands'){
      for(let i=0;i<7;i++){R(i*94,0,91,H,i%2?'#53554c':'#676454');grit(i*94,0,91,H,['#8c8266','#3f4746'],25,i*17);}
      R(309,0,11,H,'#111e26');R(322,0,4,H,'#aa946c');
      ellipse(329,196,17,25,'#292e31');ring(329,193,11,16,'#b39461',3);R(324,176,8,5,'#d4b67e');
      // Cropped adult arm enters from right; fingers stop short of the ring.
      const reach=8*smooth(.1,.8,p);poly([[640,230],[496,209],[423,185],[392-reach,174],[364-reach,173],[355-reach,180],[378-reach,188],[383-reach,202],[411,218],[500,260],[640,286]],'#5c483b');
      poly([[640,233],[496,216],[421,192],[391-reach,180],[364-reach,179],[380-reach,190],[386-reach,202],[417,211],[501,253],[640,278]],'#bb916b');
      for(let i=0;i<4;i++){line(390-reach,184+i*6,365-reach-i*3,177+i*7,'#e0b58a',4);line(410,194+i*4,394,189+i*5,'#76563f');}
      poly([[498,213],[520,216],[508,260],[486,252]],'#9e7e4c');line(502,219,492,247,'#e0bd78',3);
      line(315,243,303,219,'#777454',2);poly([[303,222],[288,213],[285,203],[301,207],[307,217]],'#899975');poly([[307,227],[319,215],[327,216],[320,225]],'#b5ba8d');
    }else{
      R(107,37,426,244,'#79745c');R(128,52,384,229,'#343a39');
      for(let i=0;i<10;i++){R(132+i*38,56,36,223,i%2?'#565246':'#49483e');line(139+i*38,63,139+i*38,267,'#786c50');}
      R(316,55,7,226,'#101c25');R(142,124,360,10,'#383b37');R(142,220,360,10,'#383b37');
      for(let x=152;x<502;x+=29){R(x,126,3,3,'#b39767');R(x,222,3,3,'#b39767');}
      floor(282);person(367,270,t,{scale:1.8,action:'reach',phase:.25+p*.2,facing:-1,ragged:true,cloak:true,shield:false});
      olive(28,287,1.35,81);line(319,265,311,246,'#939168');poly([[310,252],[301,244],[303,239],[314,247]],'#adb58a');
      alpha(.08,()=>poly([[319,63],[323,63],[332,280],[306,280]],'#e5bf7b'));
    }
    motes(t,170,90,295,182,17,'#bfb493');
  }
  function city(t){
    sky(t,'fire');
    for(let depth=0;depth<3;depth++){
      const y=205+depth*17,col=['#594650','#746054','#8f7660'][depth];
      for(let i=0;i<8;i++){const x=i*91-depth*29,h=48+hash(i+depth*11)*44;R(x,y-h,86,h,col);R(x-5,y-h-9,95,9,col);for(let j=0;j<4;j++)R(x+j*25,y-h-17,11,12,col);}
      for(let i=0;i<18;i++){const x=i*38,y0=y-31;R(x,y0,17,2,'#a28764');R(x+8,y0+12,26,1,'#433c40');}
    }
    for(const x of [75,206,394,575]){fire(x,166,t,.75);alpha(.55,()=>{for(let i=0;i<6;i++){const age=fract(t*.11+i/6);ellipse(x+age*19,148-age*133,9+age*16,9+age*19,'#292a38');}});}
    // Original wooden horse silhouette, not the Western horse actor.
    poly([[258,196],[265,154],[254,143],[258,124],[272,107],[292,102],[303,124],[304,164],[347,164],[357,179],[355,198]],'#1b2630');
    poly([[269,145],[265,127],[277,115],[288,113],[294,126],[296,151]],'#3c3c3b');
    for(const x of [269,298,335,351])line(x,190,x-2,218,'#202a32',7);
    line(268,174,348,183,'#73624c',2);line(272,183,346,192,'#73624c',2);
    for(const x of [272,345]){ellipse(x,220,10,10,'#18232e');ring(x,220,7,7,'#635846');}
    floor(266);
  }
  function troy(v){
    const {t,shot,p,reduced}=v;city(t);
    if(shot.name==='city'){
      for(let row=0;row<3;row++)for(let i=0;i<7;i++)person(61+i*59+row*22,242+row*14,t+i*.08,{identity:i%4?'sailor':'guard',scale:.45+row*.17,action:'walk',helmet:true,shield:true,cloak:false});
      person(481-p*25,267,t,{scale:1.25,action:'walk',facing:-1,helmet:true,shield:true});
      for(let i=0;i<8;i++){const u=(t-(when('shield-meet')-2.1+i*.085))/1.8;if(u>=0&&u<=1)arrow(60+u*570,82+u*u*147,16,.28+u*.5,'#c8a575');}
    }else if(shot.name==='shieldwall'){
      for(let row=2;row>=0;row--)for(let i=0;i<5;i++)person(170+i*70+row*19,267-row*18,t,{identity:i===2&&row===0?'odysseus':'guard',scale:1.25-row*.22,action:'guard',phase:phase('shield-meet',t),helmet:true,shield:true});
      const d=elapsed('shield-meet',t),x=345-Math.max(0,-d)*430;
      if(d<.08&&d>-.8)arrow(x,219-Math.max(0,-d)*40,29,.15);
      if(d>=0){arrow(334,235+clamp(d)*20,24,1.7,'#987f57');impact('shield-meet',t,340,212,{reduced});}
    }else if(shot.name==='parry'){
      const block=elapsed('bronze-parry',t),counter=elapsed('troy-counter',t);
      bladeTrail('troy-counter',t,266,272,2,reduced);
      person(266,272,t,{scale:2.0,action:counter>-.6?'slash':'guard',phase:phase('troy-counter',t),helmet:true,shield:counter<-.6,weapon:counter>-.6?'sword':null});
      person(381+Math.max(0,counter)*18,269,t,{scale:1.8,identity:'guard',facing:-1,action:block<.35?'slash':counter>.1?'kneel':'guard',phase:phase('bronze-parry',t),weapon:'sword',helmet:true,shield:false});
      impact('bronze-parry',t,303,185,{reduced});impact('troy-counter',t,356,213,{reduced,size:.7});
      rock(74,294,134,79,83,'#4a4140');
    }else{
      sea(t,{horizon:268,kind:'storm'});actors.ship(c,512,289,t,{scale:.67,crew:true,hero:false});
      poly([[0,270],[333,264],[428,279],[414,294],[0,299]],'#5b5650');
      for(let i=0;i<4;i++)person(226+i*34+p*37,264-i%2*4,t,{scale:.75,identity:'sailor',action:'run',shield:false});
      person(161+p*31,267,t,{scale:1.6,action:p<.43?'idle':'walk',facing:p<.43?-1:1,helmet:false,shield:true});
      alpha(.17,()=>poly([[0,210],[188,269],[155,299],[0,249]],'#e2b277'));
    }
    motes(t,0,45,W,240,reduced?15:42,'#e7aa68');
  }
  function fleet(v){
    const {t,shot,p}=v;sky(t,'sea');island(0,179,233,75,3);island(378,174,279,112,13);sea(t,{horizon:184});
    if(shot.name==='prow'){
      actors.ship(c,132,290,t,{scale:1.63,crew:true});person(285,250,t,{scale:1.52,action:'idle',cloak:true,shield:true});
      for(let i=0;i<8;i++)R(318+i*9,287+Math.sin(t*3+i)*3,12,2,'#c4d2b5');
    }else if(shot.name==='armada'){
      for(let i=0;i<11;i++){const row=Math.floor(i/4),s=.15+row*.12,x=76+(i%4)*155+row*14+Math.sin(t*.3+i)*3,y=197+row*28+(i%3)*3;actors.ship(c,x,y,t+i*.11,{scale:s,crew:row===2,hero:i===9});}
      island(-90,259,250,92,34,true);poly([[0,251],[28,259],[86,321],[96,360],[0,360]],'#193744');
    }else{
      island(260,185,157,68,71);actors.ship(c,327,255,t,{scale:.58,crew:true,hero:true});
      for(let i=0;i<6;i++)actors.ship(c,50+i*106,210+i%2*8,t,{scale:.13,crew:false});
      // A warm, bounded memory inset in reflected sunlight, not a cut to the bed.
      alpha(Math.sin(p*Math.PI)*.28,()=>{ellipse(442,134,55,36,'#d1b28a');person(441,161,0,{identity:'penelope',scale:.9,action:'idle'});olive(472,165,.45,7);});
      for(let i=0;i<30;i++)R(411+Math.sin(i*7)*33,190+i*3,10+hash(i)*20,1,'#aab9a4');
    }
  }
  function caveChapter(v){
    const {t,shot,p}=v;const sealed=t>=when('stone-seals');cave(t,{sealed:sealed&&shot.name!=='stone'});
    if(shot.name==='entrance'){
      rock(449,268,220,224,57,'#3b4143');
      for(let i=0;i<4;i++)person(118+i*31+p*21,269-i%2*7,t,{scale:i===0?.92:.65,identity:i===0?'odysseus':'sailor',action:'walk',shield:i===0});
      fire(236,249,t,.38);
    }else if(shot.name==='eye'){
      actors.cyclops(c,406,444,t,{scale:1.56,awake:smooth(when('eye-opens')-.4,when('eye-opens')+.5,t),arm:0});
      person(151,270,t,{scale:.85,action:'guard',shield:true});
      alpha(.12,()=>poly([[125,81],[184,92],[459,250],[315,263]],'#b7ba94'));
    }else if(shot.name==='stone'){
      actors.cyclops(c,365,277,t,{scale:1.04,arm:.82});
      const q=smooth(when('stone-seals')-1.4,when('stone-seals'),t);rock(mix(253,105,q),274,188,225,17);
      person(472,268,t,{scale:1.02,action:'guard',facing:-1,shield:true});impact('stone-seals',t,173,259,{reduced:v.reduced,size:1.3});
      for(let i=0;i<2;i++)person(511+i*32,268,t,{scale:.8,identity:'sailor',action:'kneel',facing:-1});
    }else{
      actors.cyclops(c,417,282,t,{scale:.81,sleep:.1,arm:0});
      person(247,271,t,{scale:1.6,action:p<.45?'guard':'idle',weapon:p<.45?'sword':null,shield:false,facing:-1});
      // Sword lowered, palm toward the enormous sealed door: strength is not an exit.
      if(p>=.45)person(298,269,t,{scale:1.0,identity:'sailor',action:'reach',phase:.3,facing:-1});
      fire(335,272,t,.48);
    }
  }
  function cyclopsChapter(v){
    const {t,shot,p,reduced}=v;cave(t,{sealed:t<when('cave-opens'),close:true});
    if(shot.name==='wine'){
      actors.cyclops(c,416,305,t,{scale:1.03,sleep:smooth(.65,.95,p)*.8,arm:.26,cup:p>.23,drink:smooth(.24,.7,p)});
      person(296,270,t,{scale:1.4,action:'reach',phase:.22,cup:p<=.23,shield:false,hands:{near:[337,219]}});
      person(187,265,t,{scale:.8,identity:'sailor',action:'kneel'});fire(178,256,t,.42);
    }else if(shot.name==='club'){
      actors.cyclops(c,444,291,t,{scale:1.12,arm:1-smooth(when('club-falls')-.6,when('club-falls')+.12,t)});
      const q=phase('club-falls',t,.8,.2),angle=mix(1.7,-.12,smooth(.1,.8,q));
      placed(385,128+36*smooth(when('club-falls')+.13,when('club-falls')+.4,t),1,()=>{line(0,0,-105,82,'#352f31',23);line(-2,-2,-106,78,'#827052',15);line(-8,4,-103,68,'#a39064',4);},angle);
      person(267,268,t,{scale:1.18,action:'guard',shield:true});impact('club-falls',t,289,221,{reduced,size:1.3});
      const d=elapsed('club-falls',t);if(d>=0)for(let i=0;i<16;i++){const vx=(hash(i)-.5)*100,yy=266-(20+hash(i+3)*70)*d+70*d*d;if(yy<281)rock(282+vx*d,yy,4+hash(i)*8,4+hash(i+11)*7,i,'#8a8067');}
    }else if(shot.name==='dodge'){
      actors.cyclops(c,494,285,t,{scale:.93,sleep:.55,arm:.1});
      const d=elapsed('roll-clear',t),q=phase('roll-clear',t,.65,.65),xx=mix(314,200,q);
      person(xx,269,t,{scale:1.4,action:d<-.65?'guard':d<.65?'roll':'kneel',phase:q,shield:d<-.65});
      line(355,188,288,258,'#61543f',19);line(355,185,291,253,'#998460',7);
      impact('roll-clear',t,278,261,{reduced,size:.6});
      person(160,267,t,{scale:.85,identity:'sailor',action:'reach',phase:.15});
    }else if(shot.name==='stake'){
      actors.cyclops(c,506,297,t,{scale:.9,sleep:1,arm:0});
      const lift=smooth(when('stake-lift')-.8,when('stake-lift')+.65,t),y=mix(250,212,lift);
      for(let i=0;i<4;i++){const xx=186+i*53,yy=y+6-(xx-160)/215*16;person(xx,272,t,{identity:i===3?'odysseus':'sailor',scale:1.05,action:lift<.15?'kneel':'raise',phase:lift*.65,shield:false,hands:{near:[xx+9,yy],far:[xx-5,yy+1]}});}
      line(160,y+9,375,y-8,'#47372f',12);line(160,y+6,377,y-10,'#a4814c',7);
      poly([[367,y-16],[403,y-13],[382,y-3]],'#ec9f4b');line(369,y-12,396,y-12,'#f8df9a',3);fire(382,y-10,t,.42);
      for(let i=0;i<4;i++)line(195+i*53,y+6-i*4,195+i*53,y-1-i*4,'#d2a476',4);
    }else if(shot.name==='impact'){
      const d=elapsed('cave-impact',t),drive=smooth(when('cave-impact')-.8,when('cave-impact'),t);
      actors.cyclops(c,465,305,t,{scale:.95,sleep:d<0?1:.5,arm:d>=0?.75:0});
      for(let i=0;i<4;i++)person(165+i*51+drive*39,270,t,{scale:.97,identity:i===3?'odysseus':'sailor',action:'thrust',phase:phase('cave-impact',t),shield:false});
      line(152+drive*40,203,359+drive*65,153,'#9c7848',8);
      if(d>=-.03&&d<.6){poly([[403,64],[495,78],[512,173],[455,202],[395,166]],'#16212a');fire(417,151,t,1.18);impact('cave-impact',t,421,131,{reduced,size:1.4});}
      // No injury imagery: silhouette + embers; subsequent giant keeps his eye closed.
    }else{
      rock(mix(106,205,smooth(when('cave-opens')-.5,when('cave-opens')+.5,t)),274,160,226,17);
      actors.cyclops(c,332,284,t,{scale:.84,sleep:1,arm:.25});
      for(let i=0;i<6;i++){const x=472-i*66-p*120;actors.sheep(c,x,274+i%2*5,t+i*.15,{scale:.85,hidden:i===1||i===3});}
      alpha(.15,()=>poly([[51,78],[127,67],[265,290],[69,290]],'#dfd1a2'));
      impact('cave-opens',t,168,254,{reduced,size:.6});
    }
  }
  function hubris(v){
    const {t,shot,p}=v;sky(t,'storm');island(376,192,285,188,43,true);sea(t,{horizon:194,kind:'storm',rough:.4});
    if(shot.name==='boast'){
      actors.ship(c,330,284,t,{scale:1.32,sail:false,crew:true,facing:-1});
      person(189,257,t,{scale:1.45,facing:1,action:'raise',phase:smooth(.12,.7,p),shield:false,cloak:true});
      actors.cyclops(c,544,187,t,{scale:.25,sleep:1,arm:.5});
    }else if(shot.name==='answer'){
      actors.cyclops(c,477,233,t,{scale:.57,sleep:1,arm:.94});
      // Sea-deity metaphor, not a claimed film design: a face suggested by cloud facets.
      alpha(.28*smooth(.05,.65,p),()=>{poly([[56,216],[76,94],[127,32],[203,20],[265,60],[282,139],[250,218]],'#718a88');poly([[83,109],[143,100],[166,123],[115,125]],'#1c344b');poly([[194,105],[245,114],[224,131],[188,123]],'#1c344b');poly([[163,106],[179,162],[155,170]],'#adbaa0');poly([[111,182],[208,182],[167,222]],'#284457');});
      actors.ship(c,188,271,t,{scale:.37,hero:true});
    }else{
      actors.ship(c,229,266,t,{scale:.61,hero:true});actors.cyclops(c,568,178,t,{scale:.22,sleep:1,arm:.9});
      const d=elapsed('boulder-sea',t),q=clamp((d+1.65)/1.65);if(d<0)rock(mix(555,350,q),mix(151,258,q)-Math.sin(q*Math.PI)*142,25,28,17);
      splash('boulder-sea',t,350,258,1.2,v.reduced);waveWall(t,721,351,.57);
    }
  }
  function sirens(v){
    const {t,shot,p}=v;sky(t,'violet');sea(t,{horizon:180,kind:'violet'});
    for(let i=0;i<4;i++){const x=85+i*163,y=232-i%2*22;rock(x,y,55+i%2*12,95+i%2*33,i,'#3c3b55');actors.siren(c,x-5,y-92-i%2*33,t,{scale:.62});}
    if(shot.name==='island'){
      actors.ship(c,323,268,t,{scale:.8,sail:false,crew:true});person(319,248,t,{scale:.88,action:'bound',shield:false});
    }else if(shot.name==='illusion'){
      actors.ship(c,232,289,t,{scale:1.03,sail:false,crew:true});
      person(227,267,t,{scale:1.27,action:'bound',shield:false});
      alpha(.35+Math.sin(p*Math.PI)*.2,()=>{ellipse(482,171,68,89,'#7d775e');person(480,239,t,{scale:1.7,identity:'penelope',action:'reach',phase:.2,facing:-1});olive(558,240,.78,27);});
      for(let i=0;i<12;i++){const x=428+hash(i)*123,y=116+hash(i+9)*126;R(x,y,2,2,'#d6bc7e');}
    }else if(shot.name==='rope'){
      deck(t);person(291,266,t,{scale:2.15,action:'bound',cloak:true,shield:false});
      const tighten=smooth(when('rope-tight')-.5,when('rope-tight')+.25,t);
      for(let i=0;i<5;i++)line(264,183+i*8,326-tighten*5,185+i*8,'#d7bd86',3);
      person(418,269,t,{scale:1.5,identity:'sailor',action:'thrust',phase:.5,facing:-1,shield:false});line(328,212,382,213-tighten*8,'#d7bd86',2);
      impact('rope-tight',t,320,211,{reduced:true,size:.35});
    }else{
      deck(t,{mast:false});
      R(552,56,12,207,'#574334');R(555,56,4,207,'#bc9a66');
      line(557,59,478,230,'#bcb68f');line(557,59,628,230,'#bcb68f');
      for(let i=0;i<4;i++){const x=138+i*112;const a=person(x,261,t+i*.07,{scale:1.5,identity:'sailor',action:'row'});const h=a.handNear;line(...h,h[0]+42+Math.sin(t*4.8)*22,299,'#b79661',4);R(x+2,203,3,4,'#ede0b7');}
      person(558,251,t,{scale:1.1,action:'bound',shield:false});
    }
    if(!v.reduced)for(let i=0;i<6;i++){let prev;for(let x=79;x<563;x+=7){const yy=142+i*7+Math.sin(x*.017-t*1.8+i*.6)*18;if(prev)alpha(.45,()=>line(...prev,x,yy,'#bca571'));prev=[x,yy];}}
  }
  function whirlpool(t,x=253,y=206,s=1){
    ellipse(x,y,163*s,88*s,'#142438');
    for(let j=23;j>=1;j--){const r=j*6.8*s;let prev;
      for(let i=0;i<=110;i++){const a=i/110*TAU+t*.25+j*.24,rr=r*(.89+.1*Math.sin(a*3+j*.4));const pt=[x+Math.cos(a)*rr,y+Math.sin(a)*rr*.51];if(prev)line(...prev,...pt,['#2c5368','#467e87','#8cb2aa','#1c3e57'][j%4],j%3===0?2:1);prev=pt;}
    }
    ellipse(x,y,15*s,9*s,'#070f20');
  }
  function strait(v){
    const {t,shot,p,reduced}=v;sky(t,'storm');sea(t,{horizon:138,kind:'storm',rough:.5});
    if(shot.name==='overhead'){
      whirlpool(t,237,196,1.07);poly([[540,0],[640,0],[640,360],[579,339],[562,267],[594,204],[553,135]],'#223847');
      rock(586,201,82,209,18,'#4e676c');actors.ship(c,457+p*11,232-p*18,t,{scale:.34,sail:false,crew:true,tilt:-.3});
      for(let i=0;i<9;i++)ring(420+i*3,241+i*6,7+i*2,3,'#8ba99f');
    }else if(shot.name==='cliffs'){
      for(let i=0;i<4;i++)rock(404+i*83,284,122,290+hash(i)*91,i,'#354e5a');
      poly([[454,213],[460,111],[504,72],[549,114],[557,247]],'#091724');
      actors.ship(c,220,271,t,{scale:.7,sail:false,hero:true});whirlpool(t,-71,265,.9);
    }else if(shot.name==='heads'){
      rock(613,292,213,359,37,'#344e57');poly([[527,272],[502,188],[525,88],[616,83],[640,259]],'#0a1c2a');
      actors.ship(c,239,278,t,{scale:.83,sail:false,hero:true});actors.scylla(c,539,234,t,{scale:1.12,extension:smooth(when('six-heads')-.7,when('six-heads')+.8,t)});
    }else if(shot.name==='defend'){
      deck(t,{mast:false});const second=elapsed('spear-turn',t),spear=second>-.6;
      actors.scylla(c,583,227,t,{scale:1.03,extension:1,strike:spear?attack('spear-turn',t):attack('first-block',t),strikeIndex:spear?2:0,strikeTarget:spear?[-91,-30]:[-189,-23]});
      person(339,267,t,{scale:1.64,action:second>-.6?'thrust':'guard',phase:phase('spear-turn',t),shield:second<-.6,weapon:second>-.6?'spear':null});
      person(237,262,t,{scale:1.1,identity:'sailor',action:'row'});
      person(143,259,t,{scale:1.1,identity:'sailor',action:'row'});
      impact('first-block',t,368,203,{reduced});impact('spear-turn',t,466,197,{reduced});
    }else if(shot.name==='loss'){
      actors.ship(c,284,277,t,{scale:1.07,sail:false,missing:[2,5,7],hero:false});
      actors.scylla(c,601,221,t,{scale:.83,extension:1,strike:attack('second-block',t),strikeTarget:[-221,-15]});
      person(379,253,t,{scale:1.22,action:'guard',shield:true});
      impact('second-block',t,400,210,{reduced});
      const d=elapsed('empty-oar',t);if(d>=0){placed(390-d*24,280+Math.min(d,1)*8,1,()=>line(-26,0,26,0,'#c5a672',3),d*.6);splash('empty-oar',t,400,283,.38,reduced);}
      // Three empty rowing stations and a loose paddle convey loss, no bodies.
    }else{
      actors.scylla(c,579,171,t,{scale:.44,extension:1});rock(605,284,190,286,72,'#233e4c');
      actors.ship(c,246-p*43,270,t,{scale:.73,sail:false,missing:[2,5,7],hero:true});whirlpool(t,-95,251,.76);
      for(let i=0;i<3;i++)line(399+i*27,282+i*7,428+i*27,286+i*7,'#a6a88e',2);
    }
  }
  function rain(t,reduced){
    for(let layer=0;layer<3;layer++)for(let i=0;i<(reduced?15:46);i++){
      const id=i+layer*71,x=fract(hash(id+404)-t*(.08+layer*.035))*W,y=fract(hash(id+201)+t*(.3+layer*.16))*H;
      alpha(.16+layer*.13,()=>line(x,y,x-3-layer*2,y+7+layer*4,'#9ab6bf',layer===2?2:1));
    }
  }
  function underwater(v){
    const {t,p}=v;R(0,0,W,H,'#101e36');
    for(let i=0;i<5;i++)alpha(.04+i*.01,()=>poly([[134+i*39,0],[149+i*39,0],[343+i*51,360],[196+i*61,360]],'#8dafb1'));
    poly([[0,0],[640,0],[640,35],[574,29],[502,40],[411,23],[302,34],[204,20],[101,31],[0,19]],'#527b88');
    const d=elapsed('underwater-fall',t),drop=smooth(when('underwater-fall')-.3,when('underwater-fall')+1.9,t);
    placed(313,104+drop*123,.99,()=>person(0,0,t,{scale:1.45,action:'reach',phase:.6,cloak:false,shield:false}),-.55);
    placed(206,175+p*50,1,()=>actors.shield(c,0,0,1.2,'#607c78'),p*.6);
    for(let i=0;i<28;i++){const xx=286+hash(i+7)*74,yy=245-fract(hash(i)+Math.max(0,d)*.17)*213;ring(xx,yy,1+i%3,2+i%2,'#86a4aa');}
    for(let i=0;i<8;i++){const xx=87+i*69;line(xx,32+p*60,xx+17,27+p*70,'#5b716e',3);}
  }
  function storm(v){
    const {t,shot,p,reduced}=v;
    if(shot.name==='underwater'){underwater(v);return;}
    sky(t,'storm');sea(t,{horizon:147,kind:'storm',rough:1,reduced});
    if(shot.name==='omen'){
      island(397,178,197,68,10);actors.ship(c,287,269,t,{scale:.69,hero:true,missing:[2,5,7]});
      // Three remote shrine columns in rain: compressed transgression montage.
      for(let i=0;i<3;i++){R(472+i*15,125,5,31,'#809088');R(469+i*15,122,11,4,'#afb399');}
      poly([[462,124],[494,111],[520,124]],'#71847e');
    }else if(shot.name==='wall'){
      waveWall(t,461,245,1.34);actors.ship(c,212,280,t,{scale:.67,hero:true,tilt:reduced?0:Math.sin(t*1.6)*.07});
      impact('wave-wall',t,375,116,{reduced,size:1.2,color:'#abc8bc'});
    }else if(shot.name==='deck'){
      waveWall(t,670,322,.87);const tilt=reduced?0:Math.sin(t*1.7)*.13;
      deckMotion(tilt,()=>{
        deck(t);person(326,263,t,{scale:1.58,action:'reach',phase:.8,shield:false,hands:{near:[370,179]}});line(370,179,416,30,'#c7bd8e',3);
        person(185,265,t,{scale:1.12,identity:'sailor',action:'kneel'});splash('deck-hit',t,159,246,1.2,reduced);
      });
    }else{
      const breakage=smooth(when('mast-break')-.02,when('mast-break')+1.1,t);
      waveWall(t,661,263,.9);
      deckMotion(reduced?0:Math.sin(t*1.6)*.14,()=>{
        deck(t,{broken:breakage});const fall=smooth(when('mast-break')+.45,when('mast-break')+1.35,t);
        person(346+fall*58,264+fall*32,t,{scale:1.6,action:'reach',phase:.9,shield:false,hands:{near:[391+fall*35,176+fall*30]}});line(391+fall*35,176+fall*30,445+breakage*43,49+breakage*36,'#c2b990',2);
        impact('mast-break',t,290,166,{reduced,size:1.4});
        const d=elapsed('mast-break',t);if(d>=0)for(let i=0;i<(reduced?5:17);i++){
          const xx=290+(hash(i)-.3)*120*d,yy=165-(20+hash(i+31)*50)*d+43*d*d;
          if(yy<306)line(xx,yy,xx+4+hash(i+18)*9,yy-6,'#b0a07c',2);
        }
      });
    }
    rain(t,reduced);
  }
  function drift(v){
    const {t,shot,p}=v;sky(t,shot.name==='stars'?'night':'storm');sea(t,{horizon:181,kind:shot.name==='stars'?'night':'storm'});
    if(shot.name==='empty'){
      placed(334,246,1,()=>{line(-32,0,24,-4,'#75654d',6);line(-31,-2,21,-5,'#b5a176',2);});
      person(335,244,t,{scale:.39,action:'bound',cloak:false,shield:false});
      alpha(.32,()=>{actors.shield(c,269,286+p*13,.69,'#557c80');poly([[398,254],[412,266],[416,288],[395,290],[386,276]],'#284650');});
    }else if(shot.name==='reach'){
      const grip=smooth(when('wood-grip')-.55,when('wood-grip')+.65,t);
      line(289,242,424,228,'#463d35',13);line(291,238,423,225,'#ae9464',5);
      person(253+grip*46,284-grip*27,t,{scale:1.13,action:grip<.66?'reach':'climb',phase:.6,cloak:false,shield:false,hands:{near:[307+grip*12,238-grip*2]}});
      // Foreground water masks his submerged legs, not the hand/log contact.
      poly([[0,280],[137,276],[233,282],[331,274],[425,280],[548,273],[640,279],[640,360],[0,360]],'#1d3d52');
      for(let i=0;i<12;i++)R(239+i*10,281+Math.sin(i+t)*3,8,1,'#91aaa2');
      impact('wood-grip',t,307,238,{reduced:true,size:.28});
    }else{
      line(299,252,359,248,'#9b8760',5);person(328,249,t,{scale:.5,action:'kneel',cloak:false,shield:false});
      // The stars turn into sunrise within this shot, making elapsed time visible.
      const dawn=smooth(.4,.96,p);alpha(dawn*.5,()=>{for(let i=0;i<6;i++)R(0,146+i*8,W,9,['#826879','#aa827f','#b89385','#c5a78e','#cebb9d','#d7c8ac'][i]);});
      ellipse(461,181-dawn*30,13,13,dawn>.5?'#e9d6a8':'#c0c9bc');
    }
  }
  function ithaca(v){
    const {t,shot,p}=v;coast(t);
    if(shot.name==='shore'){
      poly([[277,275],[329,262],[407,268],[470,303],[483,360],[296,360]],'#b1a27d');
      person(383+p*14,282,t,{scale:.72,action:'walk',facing:-1,ragged:true,cloak:true,shield:false});
      for(let i=0;i<6;i++)R(402+i*5,281+i%2,2,1,'#665f4d');
    }else{
      for(let i=0;i<7;i++){R(216-i*17,274+i*10,365+i*35,10,'#9b9477');R(216-i*17,274+i*10,365+i*35,2,'#ddd0a3');}
      R(398,37,207,237,'#8e8d73');R(427,76,152,198,'#404b46');R(438,83,132,188,'#564f41');
      for(let i=0;i<4;i++)R(437+i*34,85,2,184,'#897352');
      person(299+p*52,270-p*10,t,{scale:1.5,action:'climb',phase:p,ragged:true,cloak:true,shield:false});olive(127,298,1.8,39);
    }
  }
  function bow(v){
    const {t,shot,p}=v;palace(t);axes();
    if(shot.name==='axes'){
      person(184,264,t,{scale:1.47,action:'kneel',ragged:true,shield:false});
      ring(216,224,7,26,'#d4b97d',2,-1.4,1.4);line(217,198,217,249,'#ded1a9');
      for(let i=0;i<3;i++)person(465+i*44,250,t,{identity:'guard',scale:.74,action:'idle',cloak:false});
    }else{
      // Same visible bow and same stations across draw/release. No offscreen emitter.
      const a=arrowState(t),drawn=shot.name==='draw'?mix(.25,1,smooth(.05,.9,p)):1;
      person(158,252.1,t,{scale:1.6,action:'bow',phase:a.released?Math.max(.8,1-(t-a.release)*.6):drawn,ragged:false,cloak:true,shield:false,nocked:!a.released});
      if(a.released){
        const ax=t<a.contact?a.x:mix(559,598,clamp((t-a.contact)/.065));arrow(ax,a.y,78,0);
        if(!v.reduced&&t<a.contact+.065)alpha(.25,()=>line(Math.max(242,ax-91),a.y,ax,a.y,'#d6c28c'));
      }
      if(t>=a.contact)impact('twelve-axes',t,559,184.9,{reduced:v.reduced,size:.65});
      // Rim glints follow the actual arrow through all twelve aligned openings.
      if(a.released)for(let i=0;i<12;i++){const station=axeStations[i],passed=a.x>=station.x;if(passed&&t<a.contact+.7)R(station.x-3,179,6,1,'#f3d899');}
      if(shot.name==='release')person(109,253,t,{scale:.82,identity:'telemachus',action:'raise',phase:smooth(a.contact,a.contact+.6,t),shield:false});
    }
  }
  function hall(v){
    const {t,shot,p,reduced}=v;palace(t,{warm:true});
    // Eight local bars have distinct intentions, driven by the six shared cues.
    const bar=Math.min(7,Math.floor((t-v.chapter.start)/(data.beat*4))),counter=elapsed('hall-counter',t);
    const fatherX=bar<4?284:284+smooth(when('hall-counter')-.7,when('hall-counter')+.7,t)*35;
    let fa='guard',son='guard',weapon=null,fp=.3;
    if(bar===0){fa='idle';son='walk';}
    if(bar===1){fa='guard';son='guard';fp=phase('father-son-guard',t);}
    if(bar===2){fa='guard';son='kneel';fp=phase('hall-volley',t);}
    if(bar===3){fa='guard';son='thrust';fp=phase('hall-parry',t);}
    if(bar===4){fa='slash';son='guard';weapon='sword';fp=phase('hall-counter',t);}
    if(bar===5){fa='guard';son='thrust';fp=phase('last-shield',t);}
    if(bar>=6){fa='idle';son='idle';}
    bladeTrail('hall-counter',t,fatherX,267,1.57,reduced);
    person(fatherX,267,t,{scale:1.57,action:fa,phase:fp,shield:fa==='guard',weapon});
    person(bar===0?384-p*65:241,266,t,{identity:'telemachus',scale:1.42,action:son,phase:bar===3?phase('hall-parry',t):fp,facing:-1,shield:son==='guard',weapon:son==='thrust'?'spear':null});
    if(bar<6){
      for(let i=0;i<3;i++)person(439+i*43+(counter>.1?clamp(counter)*25:0),260-i*7,t,{scale:1.08-i*.14,identity:'guard',action:counter>.1?'kneel':bar===3?'slash':'guard',phase:phase('hall-parry',t),facing:-1,weapon:'sword',shield:bar!==3});
      person(137,258,t,{scale:1.05,identity:'guard',action:bar===3?'thrust':'guard',phase:phase('hall-parry',t),weapon:bar===3?'spear':null});
    }else{
      for(let i=0;i<3;i++)person(424+i*43+(t-when('last-shield'))*15,253-i*8,t,{identity:'guard',scale:.9-i*.1,action:'walk',facing:1,shield:false});
      line(388,267,419,255,'#b9bda6',3);line(395,270,390,257,'#a98c57',3);
    }
    const volley=elapsed('hall-volley',t);if(volley>-.65&&volley<.5)for(let i=0;i<5;i++){
      const d=volley-i*.05,x=d<0?mix(602,315,clamp((d+.65)/.65)):315-d*28,y=d<0?mix(135+i*8,211+i*3,clamp((d+.65)/.65)):211+i*3+d*50;arrow(x,y,22,d<0?2.89:1.9,'#c8b88e');}
    for(const [id,x,y]of[['father-son-guard',306,210],['hall-parry',384,204],['hall-counter',395,220],['last-shield',342,207]])impact(id,t,x,y,{reduced});
    if(counter>=0&&counter<1.2)placed(416+counter*29,213-counter*25+counter*counter*44,1,()=>{line(-17,0,17,0,'#c7d0b6',3);line(-13,-6,-13,6,'#b18f58',2);},counter*7);
    // Close foreground column occludes depth, without covering father/son.
    if(shot.name==='cross'){R(71,32,40,250,'#3c4945');R(76,32,9,250,'#979579');}
    if(shot.name==='quiet'){fire(495,213,t,.65);motes(t,180,81,267,180,16);}
  }
  function root(v){
    const {t,shot,p}=v;palace(t,{warm:true});
    if(shot.name==='question'){
      person(439,267,t,{scale:1.65,identity:'penelope',action:'idle',facing:-1});
      person(232,268,t,{scale:1.53,action:'idle',cloak:true,shield:false});
      // A wall conceals the chamber completely before the locked bed shot.
      R(509,39,131,236,'#55574c');for(let i=0;i<8;i++)line(510,55+i*28,640,55+i*28,'#797863');
    }else if(shot.name==='bed'){
      R(274,53,331,222,'#3c3932');R(300,73,269,190,'#555044');bed(t,false);
      person(241,270,t,{scale:1.28,action:'reach',phase:.28,shield:false});person(170,268,t,{identity:'penelope',scale:1.18,action:'idle'});
      const recognized=pulse('root-recognized',t,1.3);alpha(recognized*.09,()=>ellipse(433,189,38,68,'#e7c483'));
    }else{
      R(0,0,W,H,'#282b2b');floor(285,'palace');bed(t,true);
      fire(553,273,t,.65);alpha(.08,()=>poly([[551,233],[190,61],[207,280]],'#ddad6d'));
      // Root continuity gets the close-up; faces return for recognition, not text.
      person(143,276,t,{identity:'penelope',scale:1.55,action:'reach',phase:.12+p*.38});
      person(522,277,t,{scale:1.6,action:'reach',phase:.22,facing:-1,cloak:false,shield:false});
    }
  }
  const FONT={O:[14,17,17,17,17,17,14],D:[30,17,17,17,17,17,30],Y:[17,17,10,4,4,4,4],S:[15,16,16,14,1,1,30],E:[31,16,16,30,16,16,31],H:[17,17,17,31,17,17,17],M:[17,27,21,21,17,17,17],'/':[1,2,2,4,8,8,16],' ':[0,0,0,0,0,0,0]};
  function pixel(text,x,y,color=P.cream){for(let i=0;i<text.length;i++)for(let r=0;r<7;r++)for(let k=0;k<5;k++)if((FONT[text[i]]||FONT[' '])[r]&(1<<(4-k)))R(x+i*6+k,y+r,1,1,color);}
  function home(v){
    const {t,shot,p}=v;
    if(shot.name==='embrace'){
      palace(t,{warm:true});bed(t,false);
      const close=smooth(.02,.64,p),x1=mix(277,303,close),x2=mix(361,340,close);
      person(x2,270,t,{identity:'penelope',scale:1.63,action:'embrace',phase:close,facing:-1});
      person(x1,271,t,{scale:1.7,action:'embrace',phase:close,cloak:false,shield:false});
      // Explicit arms across the other's back, above both torsos at full closure.
      if(close>.5){line(x1+16,213,x2-9,214,'#cda179',6);line(x2-17,224,x1+17,228,'#ded0a7',6);R(x2-11,211,5,6,'#e6b88a');}
      line(204,282,249,276,'#bec7b1',3);line(215,273,216,287,'#d6b879',3);actors.shield(c,184,278,.49,'#997d4e');
    }else{
      coast(t,{night:false,wide:true});
      R(58,188,110,74,'#8d8065');poly([[47,189],[111,155],[179,189]],'#5c4e43');R(93,213,36,49,'#44372d');R(96,215,30,43,'#e7bd7e');
      person(106,251,t,{identity:'penelope',scale:.29,action:'embrace',phase:1,facing:-1});person(100,251,t,{scale:.3,action:'embrace',phase:1,cloak:false,shield:false});
      olive(47,271,1.18,27);for(let i=0;i<4;i++){const x=398+i*20,y=88+Math.sin(i)*9;line(x-3,y-2,x,y,'#516467');line(x,y,x+4,y-2,'#516467');}
      if(t>=176){pixel('ODYSSEY / HOME',425,240,'#e7d6ac');line(427,255,500,255,'#9d9f89');}
    }
  }
  const painters={threshold,troy,fleet,cave:caveChapter,cyclops:cyclopsChapter,hubris,sirens,strait,storm,drift,ithaca,bow,hall,root,home};
  function poster(){
    sky(0,'night');sea(0,{horizon:165,kind:'night'});island(394,193,297,215,69,true);
    // The distant face can also read as cliff: no bed, bow, reunion or story text.
    alpha(.38,()=>actors.cyclops(c,471,201,0,{scale:.62,awake:.3,arm:0}));waveWall(0,402,267,1.27);
    actors.ship(c,466,298,0,{scale:.9,sail:false,crew:false,hero:false});
    person(548,270,0,{scale:1.52,action:'guard',shield:true,cloak:true,facing:-1});
    for(let i=0;i<17;i++)R(342+hash(i)*254,273+hash(i+43)*29,8+hash(i+3)*15,1,'#b6b08a');
    alpha(.4,()=>poly([[0,0],[300,0],[282,143],[201,296],[0,360]],'#091426'));
  }
  function context(time){
    const t=Number.isFinite(time)?clamp(time,0,duration):0;
    const chapter=data.chapters.find(q=>t>=q.start&&t<q.end)||data.chapters[data.chapters.length-1];
    const shot=data.shots.find(q=>t>=q.start&&t<q.end)||data.shots[data.shots.length-1];
    const active=(data.actionCues||[]).filter(q=>q.chapter===chapter.id&&t>=q.time-.7&&t<=q.time+1.1).sort((a,b)=>Math.abs(t-a.time)-Math.abs(t-b.time));
    return {t,chapter,shot,p:clamp((t-shot.start)/(shot.end-shot.start)),u:t-chapter.start,action:active[0]||null};
  }
  function inspect(time){
    const v=context(time),a=arrowState(v.t);
    return {time:v.t,chapter:v.chapter.id,shot:v.shot.id,shotName:v.shot.name,shotIndex:data.shots.indexOf(v.shot),action:v.action?v.action.id:'idle',
      actionTime:v.action?v.action.time:null,shotProgress:v.p,axesCount:v.chapter.id==='bow'?12:0,axeStations:axeStations.map(q=>({...q})),
      arrow:{...a},scyllaHeads:v.chapter.id==='strait'&&['heads','defend','loss','passage'].includes(v.shot.name)?6:0,
      bedVisible:['root-bed','root-roots','home-embrace'].includes(v.shot.id),ending:v.t===duration,
      fullScreenFlashAlpha:0,deterministic:true,dimensions:{width:W,height:H}};
  }
  function draw(time,opts={}){
    const v=context(time);v.reduced=!!opts.reduced;
    c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.imageSmoothingEnabled=false;R(0,0,W,H,P.ink);
    c.save();
    try {
      if(opts.poster)poster();
      else{
        // 50 ms LOCAL contact hold: actor time only, never changes data/audio time.
        // Cue effects still receive the true time; the poses below already use
        // finite anticipation/contact/recovery windows rather than beat loops.
        if(!v.reduced&&v.action&&['clash','shield','impact','crack'].includes(v.action.kind)){
          const d=v.t-v.action.time;
          if(d>=0&&d<.23){const a=(1-d/.23)*1.6;c.translate(Math.round(Math.sin(d*97)*a),Math.round(Math.cos(d*83)*a));}
        }
        const painter=painters[v.chapter.id];if(!painter)throw new Error('Unstaged chapter: '+v.chapter.id);painter(v);
      }
    }finally{c.restore();}
    // Quiet cinematic border, no canvas captions, labels or progress bars.
    R(0,0,W,13,'#09121d');R(0,348,W,12,'#09121d');
    for(let y=298;y<348;y++)alpha((y-298)/50*.28,()=>R(0,y,W,1,'#0b1421'));
    c.globalAlpha=1;
  }
  return {draw,snapshot:()=>canvas.toDataURL('image/png'),inspect,actors,dimensions:{width:W,height:H},sceneNames:Object.keys(painters)};
}