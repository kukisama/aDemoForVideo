// Everything below is original, two-dimensional procedural pixel art.
function createPixelWorld(canvas) {
  const c = canvas.getContext('2d', { alpha: false });
  if (!c) throw new Error('无法创建二维像素画布');
  c.imageSmoothingEnabled = false;
  const W = 480, H = 270, TAU = Math.PI * 2;
  const P = { ink: '#080c21', deep: '#10152e', blue: '#253664', steel: '#405d7c', cyan: '#78f3e2', pale: '#d3f4e4', gold: '#ffd082', amber: '#db905b', pink: '#e47ba0', red: '#fa7777', violet: '#795ca1', cream: '#f8eacb' };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, t) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
  const ease = v => 1 - (1 - clamp(v)) ** 4;
  const mix = (a, b, v) => a + (b - a) * v;
  let seed = 0x544f5745;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const stars = Array.from({ length: 120 }, () => ({ x: random() * W, y: random() * 210, size: random() > .92 ? 2 : 1, phase: random() * TAU }));
  const motes = Array.from({ length: 240 }, () => ({ a: random() * TAU, v: 12 + random() * 90, s: 1 + Math.floor(random() * 3), p: random(), x: random() * W, y: random() * H }));
  const FONT = {
    A:[14,17,17,31,17,17,17],B:[30,17,17,30,17,17,30],C:[14,17,16,16,16,17,14],D:[30,17,17,17,17,17,30],E:[31,16,16,30,16,16,31],F:[31,16,16,30,16,16,16],G:[14,17,16,23,17,17,15],H:[17,17,17,31,17,17,17],I:[31,4,4,4,4,4,31],J:[7,2,2,2,18,18,12],K:[17,18,20,24,20,18,17],L:[16,16,16,16,16,16,31],M:[17,27,21,21,17,17,17],N:[17,25,21,19,17,17,17],O:[14,17,17,17,17,17,14],P:[30,17,17,30,16,16,16],Q:[14,17,17,17,21,18,13],R:[30,17,17,30,20,18,17],S:[15,16,16,14,1,1,30],T:[31,4,4,4,4,4,4],U:[17,17,17,17,17,17,14],V:[17,17,17,17,17,10,4],W:[17,17,17,21,21,21,10],X:[17,17,10,4,10,17,17],Y:[17,17,10,4,4,4,4],Z:[31,1,2,4,8,16,31],
    '0':[14,17,19,21,25,17,14],'1':[4,12,4,4,4,4,14],'2':[14,17,1,2,4,8,31],'3':[30,1,1,14,1,1,30],'4':[2,6,10,18,31,2,2],'5':[31,16,16,30,1,1,30],'6':[14,16,16,30,17,17,14],'7':[31,1,2,4,8,8,8],'8':[14,17,17,14,17,17,14],'9':[14,17,17,15,1,1,14],
    '?':[14,17,1,2,4,0,4],'!':[4,4,4,4,4,0,4],':':[0,4,4,0,4,4,0],'/':[1,2,2,4,8,8,16],'-':[0,0,0,31,0,0,0],'+':[0,4,4,31,4,4,0],'=':[0,0,31,0,31,0,0],'.':[0,0,0,0,0,6,6],'%':[17,2,4,4,8,16,17],'>':[16,8,4,2,4,8,16],'<':[1,2,4,8,4,2,1],'_':[0,0,0,0,0,0,31],' ':[0,0,0,0,0,0,0],
  };
  const HERO = [
    '....nnnnnn....','...nbbbbbbn...','..nbbBBBBbbn..','..nbBCCCCBbn..','..nbCppppCbn..','...npeppepn...','....pppppp....','...ggGGgg.....','..gGGGGGGgn...','.gGGGGGGGgn...','.gGgGGGGgGgn..','..pgGGGGgpp...','..nGGGGGGn....','..nGGggGGn....','..nGGggGGn....','...bb..bb.....','...bb..bb.....','..nnn..nnn....',
  ];
  const PAL = { n:'#080e20', b:'#29365d', B:'#435887', C:'#65aece', p:'#e5bc92', e:'#14243b', g:'#285a72', G:'#68b7c4' };
  const R = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const box = (x,y,w,h,color,thick=1) => { R(x,y,w,thick,color); R(x,y+h-thick,w,thick,color); R(x,y,thick,h,color); R(x+w-thick,y,thick,h,color); };
  function line(x0,y0,x1,y1,color,width=1) {
    x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
    const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;
    let err=dx+dy;
    for(let guard=0;guard<1200;guard++) {R(x0,y0,width,width,color);if(x0===x1&&y0===y1)break;const e=2*err;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}}
  }
  function pixText(text,x,y,scale=1,color=P.cream,align='left',shadow=true) {
    text=String(text).toUpperCase(); const width=(text.length*6-1)*scale;
    if(align==='center')x-=width/2; else if(align==='right')x-=width;
    if(shadow)pixText(text,x+scale,y+scale,scale,'#080a1f','left',false);
    for(let i=0;i<text.length;i++){const rows=FONT[text[i]]||FONT['?'];for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(rows[row]&(1<<(4-col)))R(x+(i*6+col)*scale,y+row*scale,scale,scale,color);}
  }
  function cn(text,x,y,size=18,color=P.cream,align='center',shadow=true) {
    c.save(); c.font=`900 ${size}px "Microsoft YaHei","PingFang SC",sans-serif`; c.textAlign=align;c.textBaseline='top';
    if(shadow){c.fillStyle='#070c24';c.fillText(text,Math.round(x+1),Math.round(y+2));}c.fillStyle=color;c.fillText(text,Math.round(x),Math.round(y));c.restore();
  }
  function circle(x,y,r,color,step=1) {
    for(let v=-r;v<=r;v+=step){const half=Math.floor(Math.sqrt(Math.max(0,r*r-v*v))/step)*step;R(x-half,y+v,half*2+step,step,color);}
  }
  function ring(x,y,r,color,width=1,start=0,end=TAU) {
    for(let a=start;a<end;a+=1/Math.max(3,r)){R(x+Math.cos(a)*r,y+Math.sin(a)*r,width,width,color);}
  }
  function star(x,y,size,color) {R(x-size,y,size*2+1,1,color);R(x,y-size,1,size*2+1,color);if(size>2){R(x-1,y-1,3,3,color);}}
  function sky(t,theme='blue') {
    const bands=theme==='red'?['#190f28','#261832','#30243f','#373045']:theme==='gold'?['#231b43','#49314b','#76505d','#c08b79']:['#10122e','#171b3b','#202743','#2a3651'];
    bands.forEach((color,i)=>R(0,i*68,W,69,color));
    for(const p of stars){const x=(p.x+t*1.2)%W; const a=.25+(.5+.5*Math.sin(t*.6+p.phase))*.6;c.globalAlpha=a;R(x,p.y,p.size,p.size,theme==='gold'?P.gold:'#99bfd8');}c.globalAlpha=1;
    const moonColor=theme==='gold'?'#f6b978':'#b6b7cf';
    circle(363,64,30,moonColor,2);circle(372,56,25,theme==='gold'?'#df9b77':'#9e9bb9',2);circle(380,60,4,theme==='gold'?'#e6a580':'#8d8ead',2);circle(351,74,4,theme==='gold'?'#f0b283':'#939bb9',2);
  }
  function mountains(t,level=0,theme='blue') {
    const colors=theme==='gold'?['#63546a','#46445d','#293c51']:['#293651','#23374d','#182c42'];
    for(let layer=0;layer<3;layer++){
      const y=155+layer*22-level*8,period=110-layer*15,offset=-(t*(1+layer*.6))%period;
      c.fillStyle=colors[layer];c.beginPath();c.moveTo(-period,270);
      for(let x=-period;x<=W+period;x+=period){c.lineTo(x+offset,y+20);c.lineTo(x+period*.3+offset,y-23-layer*3);c.lineTo(x+period*.43+offset,y-13-layer*3);c.lineTo(x+period*.6+offset,y-35-layer*2);c.lineTo(x+period+offset,y+20);}c.lineTo(W+period,270);c.fill();
    }
  }
  function ground(y=219,t=0,color='#334557') {
    R(0,y,W,H-y,'#121e32');R(0,y,W,4,color);R(0,y+4,W,2,'#779392');
    for(let row=0;row<5;row++)for(let x=-30;x<W+30;x+=30){const shift=row%2?15:0;R(x+shift-(t*8)%30,y+8+row*9,28,7,row%2?'#26364a':'#223248');R(x+shift-(t*8)%30,y+8+row*9,28,1,'#394b5b');}
  }
  function tower(x,y,w=88,h=156,open=0,glow=P.gold) {
    const top=y-h;
    R(x+6,top+12,w-12,h-12,'#334057');R(x+13,top+16,w-26,h-16,'#44516a');
    R(x+7,top+12,6,h-12,'#57627d');R(x+w-14,top+12,7,h-12,'#27364e');
    for(let row=0;row<Math.ceil(h/9);row++)for(let bx=0;bx<w-26;bx+=16){const px=x+13+bx+(row%2?8:0);if(px+13<x+w-12)R(px,top+21+row*9,13,1,row%3?'#65708a':'#849098');}
    for(let i=0;i<6;i++)R(x+i*w/6,top,w/12,17,'#566781');R(x,top+14,w,4,'#8a98a8');R(x-5,top+22,w+10,4,'#283853');
    for(let row=0;row<3;row++){R(x+w/2-5,top+37+row*23,10,15,'#182238');R(x+w/2-2,top+39+row*23,4,10,glow);}
    const doorW=w*.40,dx=x+w/2-doorW/2,dy=y-48;
    R(dx-5,dy-7,doorW+10,55,'#14223a');R(dx,dy-9,doorW,57,open>.1?'#a9eecc':'#080f25');
    if(open>.1){c.globalAlpha=open*.3;R(dx-25*open,dy,doorW+50*open,48,'#e2f5b3');c.globalAlpha=1;}
    const half=doorW/2;
    R(dx-open*half,dy,half*(1-open),48,'#273249');R(dx+half+open*half,dy,half*(1-open),48,'#354052');
    if(open<.7){R(dx+half-1,dy+9,2,31,glow);R(dx+half-5,dy+25,10,2,glow);}
    R(x-6,y,w+12,6,'#93a1a1');R(x-11,y+6,w+22,5,'#4b6374');
  }
  function hero(x,y,t,scale=2,walking=false,child=false,facing=1,pose=0) {
    const bob=walking?Math.floor(Math.sin(t*15))*scale:0;
    const top=y-HERO.length*scale+bob;
    // Amber scarf flows behind the original apprentice sprite.
    if(!child){for(let i=0;i<7;i++)R(x-5*scale-i*scale*facing,top+8*scale+Math.floor(Math.sin(t*7-i*.9))*scale,(2+i%2)*scale,2*scale,i%2?'#efbc78':'#b67861');}
    for(let row=0;row<HERO.length;row++)for(let col=0;col<HERO[row].length;col++){
      const key=HERO[row][col];if(key==='.')continue;
      let color=PAL[key];if(child&&key==='G')color='#c893b2';if(child&&key==='g')color='#845b94';
      let px=x+(col-7)*scale*facing,py=top+row*scale;
      if(walking&&row>14)py+=Math.floor(Math.sin(t*14+(col<7?0:Math.PI)))*scale;
      if(pose===1&&row<7)px+=scale;
      R(px,py,scale,scale,color);
    }
    if(!child){R(x+6*scale*facing,top+10*scale,5*scale,6*scale,'#dcb97d');R(x+7*scale*facing,top+11*scale,3*scale,4*scale,'#fff0c8');}
  }
  function book(x,y,scale=1,color=P.cyan,opened=false,tilt=0) {
    c.save();c.translate(Math.round(x),Math.round(y));if(tilt)c.rotate(tilt);
    const w=opened?20:12,h=16;
    R(-w*scale/2,-h*scale/2,w*scale,h*scale,'#081326');R(-w*scale/2+scale,-h*scale/2+scale,(w-2)*scale,(h-2)*scale,color);
    R(-w*scale/2+3*scale,-h*scale/2+2*scale,(w-5)*scale,(h-4)*scale,'#e4d8b2');
    if(opened)R(-scale/2,-h*scale/2+scale,scale,(h-2)*scale,'#94765d');
    for(let i=0;i<4;i++)R(-w*scale/2+4*scale,(-4+i*3)*scale,(w-8)*scale,scale,'#a29483');
    c.restore();
  }
  function bubble(x,y,w,h,text,color=P.cream,tail=1) {R(x-2,y,w+4,h,'#080d21');R(x,y-2,w,h+4,'#080d21');R(x,y,w,h,'#e9e0c4');R(x+3,y+3,w-6,h-6,'#f5efd9');R(x+(tail>0?w-16:12),y+h,8,6,'#080d21');R(x+(tail>0?w-14:14),y+h-2,4,6,'#e9e0c4');cn(text,x+w/2,y+8,14,color,'center',false);}
  function burst(x,y,age,power=1,color=P.cyan,count=60) {
    if(age<0||age>2)return;
    c.save();c.globalAlpha=Math.max(0,1-age/2);
    for(let i=0;i<count;i++){const p=motes[i];const r=(10+age*p.v)*power;R(x+Math.cos(p.a)*r,y+Math.sin(p.a)*r+age*age*10,p.s,p.s,i%3?color:P.cream);}c.restore();
  }
  function bars(x,y,w,value,color=P.cyan,label='') {box(x,y,w,10,'#7494a1');R(x+2,y+2,w-4,6,'#142438');R(x+2,y+2,(w-4)*clamp(value),6,color);for(let i=8;i<w;i+=10)R(x+i,y+2,1,6,'#101d32');if(label)pixText(label,x,y-11,1,P.pale);}
  function rune(x,y,size=8,color=P.gold) {box(x-size,y-size,size*2,size*2,color);box(x-size+3,y-size+3,size*2-6,size*2-6,color);star(x,y,2,color);}
  function skyline(t,theme='blue') {sky(t,theme);mountains(t,0,theme);}
  function accent(t,color=P.cyan) {const p=(t/.4)%1; c.save();c.globalAlpha=(1-p)*.42;R(11,34,3,18,color);R(466,34,3,18,color);c.restore();}

  function summit(t,u,poster=false) {
    skyline(t);tower(323,219,97,167,0,P.gold);tower(428,224,49,106,0,'#739fc5');tower(281,224,38,100,0,'#739fc5');
    ground(226,t*.12);
    for(let i=0;i<6;i++)R(70+i*41,219,25,7,'#445e72');
    const x=poster?239:45+smooth(0,5.7,u)*210;
    hero(x,224,t,2,!poster,false,1);
    const beam=.2+Math.sin(t*2)*.05;c.globalAlpha=beam;R(365,40,13,172,P.gold);c.globalAlpha=1;
    if(!poster){if(u<3.2){pixText('ONE TOWER.',46,77,3,P.cream);pixText('ONE WAY IN.',48,112,2,P.gold);}else{cn('把它讲清楚',148,86,27,P.cream);pixText('THE ONLY KEY',147,126,1,P.cyan,'center');}}
    for(let i=0;i<10;i++){const p=motes[i];R(335+p.p*50,200-((t*17+i*17)%135),1,2,P.gold);}
  }
  function illusion(t,u) {
    R(0,0,480,270,'#15132e');
    for(let col=0;col<9;col++)for(let row=0;row<4;row++){
      const x=col*58-15,y=47+row*42;R(x-2,y+33,54,4,'#795373');R(x,y,48,33,'#251d3c');
      for(let j=0;j<6;j++){const h=18+(col*7+row*5+j*3)%13;R(x+j*8,y+33-h,6,h,['#485481','#8f566c','#b5807b','#506e85'][(col+row+j)%4]);R(x+j*8+1,y+36-h,4,1,'#e0b58b');}
    }
    R(91,44,298,108,'#10132a');box(89,42,302,112,'#696287');
    const count=Math.floor(100*ease(u/2.6));
    pixText('MEMORIZED',240,57,2,'#a9a3cf','center');pixText(`${String(count).padStart(3,'0')}%`,240,83,5,P.gold,'center');
    bars(170,133,141,count/100,P.gold);
    hero(240,218,t,3,u<2.3);
    for(let i=0;i<12;i++){const a=i/12*TAU+u*.45;const radius=69+Math.sin(t+i)*9;book(240+Math.cos(a)*radius*2,176+Math.sin(a)*radius*.6,1,i%2?'#8d9fc2':'#e0ab90',false,Math.sin(a)*.22);}
    if(u>3.2){R(130,155,220,19,'#080f29d9');pixText('UNDERSTAND?  UNKNOWN',240,161,1,P.red,'center');}
    ground(225,0,'#624c6c');burst(240,120,(u%1.6),.38,'#bc9cf1',24);
  }
  function failure(t,u) {
    skyline(t,'red');ground(225);tower(278,221,96,138,0,P.red);
    hero(130,224,t,3,false,false,1,1);hero(239,223,t,2,false,true,-1);
    if(u<3.2){bubble(123,63,230,35,'为什么  1/2 = 2/4？','#293148');pixText('WHY?',240,113,4,P.red,'center');}
    else{R(83,62,306,62,'#1b1229');box(81,60,310,66,'#8f4a63');pixText('EXPLAIN FAILED',236,77,3,P.red,'center');cn('定义，不是解释。',236,113,15,'#c7adc1');}
    burst(157,153,u,.7,P.red,100);
    for(let i=0;i<18;i++){const p=motes[i];const age=(u+i*.13)%2.2;R(135+(p.p-.5)*90+age*(p.a-3)*17,148+age*age*21,3+age*2,2,['#d6988e','#84729e','#576281'][i%3]);}
    const slash=clamp(u/.3);line(340-31*slash,136-31*slash,340+31*slash,136+31*slash,P.red,3);line(340+31*slash,136-31*slash,340-31*slash,136+31*slash,P.red,3);
    if(u>4.3){pixText('RETRY >',411,194,1,P.gold,'center');star(410,183,3,P.gold);}
  }
  function select(t,u) {
    skyline(t);R(0,159,480,67,'#142539');ground(225,0,'#3b7481');
    const e=ease(u/.8),y=mix(150,66,e);
    R(104,y-5,280,127,'#07162a');R(109,y,270,117,'#597b8c');R(114,y+5,260,107,'#e9ddb8');
    R(119,y+10,250,97,'#f3e8ca');R(121,y+10,3,97,'#c1ad82');
    pixText('01 / CHOOSE YOUR QUEST',244,y+16,1,'#426777','center',false);
    cn('只选一个概念',244,y+34,24,'#213448','center',false);
    box(154,y+70,180,25,'#94a587');cn('分数，为什么能等值？',244,y+76,12,'#48635d','center',false);
    hero(62,224,t,2,true);
    const positions=[[-50,100,'RATIO'],[428,82,'AREA'],[420,170,'LOGIC']];
    for(let i=0;i<positions.length;i++){const [px,py,label]=positions[i];const push=smooth(.3,2.6,u);const x=px+(i?-1:1)*(1-push)*70;book(x,py,2,'#668798');if(push<.95)pixText(label,x,py+24,1,'#7b9baf','center');}
    rune(402,151,14,P.cyan);ring(244,y+59,94+(u%1.6)*12,'#73cbd150',1);burst(244,y+60,u,.9,P.cyan,50);
    if(u>3.2){pixText('FOCUS LOCKED',244,203,1,P.cyan,'center');for(let i=0;i<3;i++)R(323+i*5,204,3,3,P.cyan);}
  }
  function teach(t,u) {
    R(0,0,480,270,'#18263b');
    for(let i=0;i<15;i++){const x=(i*41+12)%480;R(x,43,1,164,'#2a3c51');R(x-8,58+i%3*18,17,1,'#3b5368');}
    ground(223,0,'#79847b');hero(72,220,t,3);hero(411,220,t,2,false,true,-1);
    const a=ease(u/.6);bubble(126,64,234,43,u<3.2?'先试着用自己的话说。':'不用术语，你能讲清吗？','#36404e');
    const topics=u<3.2?['NUMERATOR','DENOMINATOR']:['PLAIN WORDS','ONE EXAMPLE'];
    topics.forEach((word,i)=>{const w=word.length*6+16,x=240-w/2+Math.sin(t+i)*5,y=123+i*29;R(x,y,w,20,i?'#353653':'#344963');box(x,y,w,20,i?'#8d7d9c':'#6aa9b7');pixText(word,x+w/2,y+7,1,i?'#c1a2c0':P.cyan,'center');});
    const barrier=1-smooth(2.8,5.1,u);for(let i=0;i<6;i++){const x=165+i*28;R(x,192+Math.sin(t*2+i)*4,22*barrier,9,'#766387');}
    if(u>3.2){bubble(311,128,109,30,'能举个例子吗？','#4a3752',-1);star(399,121,3,P.gold);}
    c.globalAlpha=a;line(114,192,166,192,P.gold,2);line(315,192,373,192,P.gold,2);c.globalAlpha=1;
  }
  function gaps(t,u) {
    skyline(t,'red');R(0,221,153,49,'#23354a');R(330,221,150,49,'#23354a');R(0,218,155,4,'#758c91');R(328,218,152,4,'#758c91');
    for(let i=0;i<12;i++){const y=229+i*4;R(152,y,178,1,i%2?'#633c59':'#422c48');}
    const found=smooth(2.5,3.35,u);const bridge=smooth(3.3,5.7,u);
    for(let i=0;i<8;i++){const fill=clamp(bridge*8-i);R(154+i*22,220+(1-fill)*40,21,9,fill>.9?'#5caaac':'#a65f6c');if(fill>.9)R(154+i*22,220,21,2,P.cyan);}
    hero(124+bridge*160,217,t,2,bridge>0&&bridge<1);
    book(61,143,3,P.cyan,true);
    pixText('BACK TO THE SOURCE',239,56,2,P.red,'center');
    if(u<3.2){cn('哪里卡住，就查哪里。',245,90,21,P.cream);R(182,132,61,32,'#53677b');R(269,125,100,40,'#53677b');R(182,132,30,32,P.gold);R(269,125,50,40,P.gold);pixText('1/2',212,172,1,P.gold,'center');pixText('2/4',319,172,1,P.gold,'center');star(251,151,4,P.red);}
    else{R(126,91,278,88,'#142b3b');box(126,91,278,88,P.cyan);pixText('MISSING CONDITION FOUND',265,105,1,P.gold,'center');cn('同一个整体',265,123,24,P.cream);cn('并且，平均分割。',265,153,14,P.cyan);}
    burst(251,140,u-3.2,.9,P.cyan,90);
    for(let i=0;i<8;i++){const phase=clamp((u-3-i*.22)/1.0);if(phase>0&&phase<1)book(mix(62,167+i*22,phase),mix(131,214,phase)-Math.sin(phase*Math.PI)*60,1,P.gold);}
    if(found>.8)rune(435,169,12,P.cyan);
  }
  function pie(x,y,r,quarters,split=0) {
    for(let row=-r;row<=r;row+=2)for(let col=-r;col<=r;col+=2){if(col*col+row*row>r*r)continue;const fill=col<0;const dx=quarters?Math.sign(col)*split:0,dy=quarters?Math.sign(row)*split:0;R(x+col+dx,y+row+dy,2,2,fill?P.gold:'#34435c');}
    ring(x,y,r+1,'#ccddc6',1);
    line(x,y-r,x,y+r,'#0d1a2c',2);
    if(quarters)line(x-r,y,x+r,y,'#0d1a2c',2);
    if(!quarters){pixText('1',x-r/2,y-3,1,'#70532c','center',false);}
    else{pixText('1',x-r/2,y-r/2,1,'#70532c','center',false);pixText('1',x-r/2,y+r/2-5,1,'#70532c','center',false);}
  }
  function simplify(t,u) {
    R(0,0,480,270,'#122a32');
    for(let i=0;i<18;i++){const p=motes[i];const x=(p.x+t*11)%480;R(x,p.y,2,1,'#3b6768');}
    cn(u<3.2?'换一种说法。':'切法变了。量没变。',240,49,25,P.cream);
    pixText('SAME WHOLE. EQUAL PARTS.',240,81,1,P.cyan,'center');
    const split=Math.sin(smooth(.3,4.5,u)*Math.PI)*4;
    pie(133,145,39,false);pie(341,145,39,true,split);
    pixText('=',239,130,5,P.cyan,'center');
    pixText('1/2',133,197,2,P.gold,'center');pixText('2/4',341,197,2,P.gold,'center');
    for(let i=0;i<4;i++){const age=(u-i*.4)%1.6;if(age>=0){c.globalAlpha=(1-age/1.6)*.25;ring(133,145,45+age*24,P.cyan,1);ring(341,145,45+age*24,P.cyan,1);c.globalAlpha=1;}}
    const progress=smooth(0,1.2,u);line(176,145,212,145,P.gold);line(266,145,298,145,P.gold);
    for(let i=0;i<16;i++){const p=motes[i];const age=(u+i*.1)%2;R(30+p.p*420,215-age*80,1,2,'#99d5ac');}
    if(progress>.9){rune(44,140,12,P.gold);rune(432,140,12,P.gold);}
  }
  function retest(t,u) {
    skyline(t);const opening=smooth(2.6,4.4,u);tower(298,218,109,147,opening,P.cyan);ground(226,0,'#426d77');
    const run=smooth(4,6.1,u);hero(166+run*174,224,t,2,run>0&&run<1);hero(246,223,t,2,false,true,-1);
    book(73,136,2.5*(1-smooth(.2,2.0,u))+1,P.cyan,u<1.1);
    if(u<3.2){pixText('NO NOTES.',111,63,2,P.gold,'center');cn('合上书，再讲一遍。',160,91,18,P.cream);bubble(190,133,112,28,'为什么相等？','#4c405c',-1);}
    else{pixText('ANSWER THE WHY.',242,49,2,P.cyan,'center');bubble(152,89,133,31,'因为量没有变。','#284153');pixText('GATE UNLOCKED',355,157,1,P.gold,'center');}
    burst(348,183,u-3.2,.8,P.gold,100);
    if(opening>.2){star(353,190,Math.floor(3+opening*6),P.cream);for(let i=0;i<6;i++)R(330+i*9,199-(u*20+i*15)%90,1,5,P.cyan);}
  }
  function ascend(t,u) {
    skyline(t,'gold');
    const growth=ease(u/1.6);for(let i=0;i<7;i++){const x=150+i*25,y=225-i*9;R(x,y+(1-growth)*40,25,50,'#304e5c');R(x,y+(1-growth)*40,25,3,P.gold);}
    tower(325,220,72,115,1,P.gold);hero(197+smooth(0,2.9,u)*127,204-smooth(0,2.9,u)*47,t,2,u<2.9);
    for(let k=0;k<4;k++)burst([68,410,137,348][k],[92,75,45,115][k],(u-k*.32)%2.4,.9,[P.gold,P.cyan,P.pink,P.pale][k],45);
    if(u<2.6){R(46,58,388,71,'#132539df');pixText('UNDERSTANDING',240,69,3,P.gold,'center');pixText('UNLOCKED',240,99,2,P.cyan,'center');}
    else{R(44,53,392,116,'#101d37ed');box(45,54,390,114,'#709990');cn('费曼学习法',240,67,31,P.cream);pixText('LEARN IT. TEACH IT. OWN IT.',240,108,1,P.gold,'center');cn('理解，才是通关密钥。',240,133,18,P.cyan);}
    if(u>2.7){const labels=['选','讲','补','简'];labels.forEach((label,i)=>{const x=106+i*73;R(x-24,184,48,29,'#122c3ce8');box(x-24,184,48,29,'#749e9d');cn(label,x,188,17,P.gold);});}
    for(let i=0;i<40;i++){const p=motes[i];const y=(p.y-u*(12+p.p*20)+400)%250;R(p.x,y,1,2,i%3?P.gold:P.cyan);}
  }

  function transition(t,reduced) {
    if(reduced)return;
    const cuts=[6.4,12.8,19.2,25.6,32,38.4,44.8,51.2];
    const index=cuts.findIndex(cut=>t>cut-.18&&t<cut+.28);
    if(index<0)return;
    const p=(t-cuts[index]+.18)/.46;
    if(index%3===0){for(let row=0;row<15;row++){const q=clamp(p*1.35-row*.023);const x=q<.5?mix(-W,0,ease(q*2)):mix(0,W,ease((q-.5)*2));R(x,row*18,W,18,row%2?'#283d5f':'#182943');}}
    else if(index%3===1){for(let y=0;y<15;y++)for(let x=0;x<27;x++){const offset=((x*7+y*13)%11)/50;const q=clamp(p-offset);const amount=q<.4?ease(q/.4):1-ease((q-.4)/.4);const size=18*amount;if(size>0)R(x*18+(18-size)/2,y*18+(18-size)/2,size,size,index===1?'#67415a':'#3a7983');}}
    else{const width=Math.sin(p*Math.PI)*W;R((W-width)/2,0,width,H,'#132640');for(let y=0;y<H;y+=12)R((W-width)/2-2,y,width+4,2,'#4b7d87');}
  }
  function draw(time,{poster=false,reduced=false}={}) {
    const t=clamp(time,0,57.6),index=Math.min(8,Math.floor((t+1e-7)/6.4)),u=t-index*6.4;
    c.resetTransform();c.globalAlpha=1;c.globalCompositeOperation='source-over';c.imageSmoothingEnabled=false;R(0,0,W,H,P.ink);
    c.save();
    const hit=Math.exp(-((t/.4)%1)*9),shake=reduced||poster?0:hit*(index===2?2:1);
    c.translate(Math.round(Math.sin(t*63)*shake),Math.round(Math.cos(t*49)*shake*.7));
    if(!poster&&!reduced){
      // Four explicitly cut, flat camera compositions per act = 36 beat-locked shots.
      // The subtitle layer stays still while the pixel world punch-cuts behind it.
      const shot=Math.min(3,Math.floor((u+1e-7)/1.6));
      const zoom=[1,1.065,1.012,1.09][shot]+hit*.006;
      const pan=[0,-3,3,-2][shot];
      c.translate(240,138);c.scale(zoom,zoom);c.translate(-240+pan,-138);
    }
    if(poster)summit(4.6,4.6,true);
    else [summit,illusion,failure,select,teach,gaps,simplify,retest,ascend][index](t,u);
    c.restore();
    if(!poster){
      const bar=Math.floor((t+1e-7)/1.6),phase=(t%1.6)/1.6;
      // Frequent edits remain localized: no repetitive full-frame white flashes.
      if(!reduced&&phase<.09&&index!==2){c.globalAlpha=(1-phase/.09)*.42;for(let i=0;i<5;i++){R(0,48+i*31,24+(bar*19+i*27)%130,1,P.cyan);R(390+(i*13)%40,61+i*27,95,1,P.gold);}c.globalAlpha=1;}
      accent(t,index===2?P.red:index>=6?P.gold:P.cyan);
      transition(t,reduced);
      R(10,255,460,1,'#24384d');R(10,255,460*t/57.6,1,index>=6?P.gold:P.cyan);
    }
  }
  return { draw, snapshot:()=>canvas.toDataURL('image/png'), dimensions:{width:W,height:H} };
}