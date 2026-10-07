/* Original 2D artwork. Route dots are traffic-share symbols, not a microscopic
 * simulation. Every composition is a deterministic function of soundtrack time. */
function createShortcutWorld(canvas, data) {
  'use strict';
  const c=canvas.getContext('2d',{alpha:false});
  if(!c)throw new Error('当前浏览器无法创建二维画布');
  const W=768,H=432,A=createShortcutActors(),TAU=Math.PI*2;
  const P={ink:'#183842',deep:'#112b39',teal:'#53b9a7',mint:'#98d7b4',gold:'#f1c35f',cream:'#f4e6ba',red:'#ea7868',blue:'#71b9d0',paper:'#eddfb4'};
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const lerp=(a,b,u)=>a+(b-a)*u;
  const ease=(a,b,t)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u);};
  const hash=i=>{let n=Math.imul(i+127,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;};
  const R=(x,y,w,h,color)=>{if(w<=0||h<=0)return;c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const poly=(p,color)=>{c.fillStyle=color;c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.closePath();c.fill();};
  function line(x,y,x2,y2,color,width=1){const n=Math.max(Math.abs(x2-x),Math.abs(y2-y),1);for(let i=0;i<=n;i+=Math.max(1,width/3))R(lerp(x,x2,i/n)-width/2,lerp(y,y2,i/n)-width/2,width,width,color);R(x2-width/2,y2-width/2,width,width,color);}
  function circle(x,y,r,color){for(let v=-r;v<r;v++){const h=Math.sqrt(Math.max(0,r*r-v*v));R(x-h,y+v,h*2,1,color);}}
  function oval(x,y,rx,ry,color){for(let v=-ry;v<ry;v++){const h=rx*Math.sqrt(Math.max(0,1-v*v/(ry*ry)));R(x-h,y+v,h*2,1,color);}}
  function frame(x,y,w,h,color=P.teal,fill='#142f3a'){R(x+3,y+3,w,h,'#0c263144');R(x,y,w,h,fill);R(x,y,w,1,color);R(x,y+h-1,w,1,color);R(x,y,1,h,color);R(x+w-1,y,1,h,color);}
  function text(str,x,y,size=16,color=P.cream,align='left',weight=500){c.save();c.font=`${weight} ${size}px "Microsoft YaHei","PingFang SC",sans-serif`;c.textBaseline='top';c.textAlign=align;c.fillStyle=color;c.fillText(str,Math.round(x),Math.round(y));c.restore();}
  function mono(str,x,y,size=9,color=P.mint,align='left'){c.save();c.font=`${size}px "IBM Plex Mono",monospace`;c.textBaseline='top';c.textAlign=align;c.fillStyle=color;c.fillText(str,Math.round(x),Math.round(y));c.restore();}
  function number(value,x,y,s=2,color=P.gold){c.save();c.font=`500 ${25*s}px "Space Grotesk",sans-serif`;c.textBaseline='top';c.textAlign='left';c.fillStyle=color;c.fillText(String(value),Math.round(x),Math.round(y));c.restore();}
  function sky(t,mode='morning'){
    const pal=mode==='night'?['#173b50','#275465','#447b80','#82a69a']:mode==='gold'?['#496f80','#88afa3','#d7c194','#f0d69d']:['#497f99','#78aaba','#b2d0c0','#d7e1b9'];
    pal.forEach((col,i)=>R(0,i*77,W,79,col));circle(620,97,mode==='gold'?34:23,mode==='night'?'#dbe8bb':'#f7e3ab');
    if(mode==='night')for(let i=0;i<52;i++)R(hash(i)*W,hash(i+92)*171,1+i%2,1,'#e7e0b7');
    for(let i=0;i<9;i++){const x=((i*121+t*(1+i%3)*2)%1020)-120,y=38+(i%4)*30;R(x,y,60+i%3*12,3,'#dce3c180');R(x+10,y-5,35+i%3*9,5,'#dce3c180');}
  }
  function hills(t,scroll=0,night=false){
    for(let row=0;row<3;row++){const y=188+row*30,col=night?['#437279','#315b64','#25454f'][row]:['#80ac9b','#5f9382','#467968'][row];
      const points=[[-30,H]];for(let x=-50;x<=W+80;x+=30)points.push([x,y+Math.sin((x+scroll*(row+1))*.012+row)*21+Math.cos(x*.028+row)*8]);points.push([W+80,H]);poly(points,col);
    }
  }
  function tree(x,y,s=1,t=0,night=false){
    R(x-2*s,y-35*s,4*s,36*s,night?'#334a47':'#775d44');line(x,y-19*s,x-13*s,y-41*s,'#775d44',2*s);line(x,y-24*s,x+11*s,y-46*s,'#775d44',2*s);
    for(let i=0;i<7;i++){const a=i*2.41,xx=x+Math.cos(a)*13*s+Math.sin(t*.9+i)*s,yy=y-43*s+Math.sin(a)*11*s;oval(xx,yy,13*s,9*s,night?'#356b60':i%2?'#599358':'#70a967');R(xx-8*s,yy-7*s,9*s,2*s,night?'#609779':'#a5cc83');}
  }
  function shrub(x,y,s=1){oval(x,y,12*s,6*s,'#496f56');R(x-5*s,y-4*s,7*s,2*s,'#8eb274');R(x+3*s,y-5*s,4*s,2*s,'#c9ce91');}
  function tower(x,y,s=1,t=0){
    R(x-22*s,y-112*s,44*s,113*s,'#b69d76');R(x-20*s,y-111*s,15*s,112*s,'#e7cf99');R(x+12*s,y-110*s,10*s,110*s,'#947e69');
    for(let i=0;i<9;i++){R(x-20*s,y-(i*10+12)*s,40*s,1*s,'#8d8270');for(let j=0;j<3;j++)R(x-14*s+j*12*s+(i%2)*3*s,y-(i*10+12)*s,1*s,8*s,'#b59d79');}
    poly([[x-30*s,y-112*s],[x,y-147*s],[x+30*s,y-112*s]],'#415c64');poly([[x,y-147*s],[x+30*s,y-112*s],[x+5*s,y-112*s]],'#234b57');
    R(x-25*s,y-115*s,50*s,5*s,'#203f4b');R(x-3*s,y-159*s,6*s,13*s,'#c79854');line(x,y-154*s,x+22*s,y-156*s,P.gold,3*s);
    circle(x,y-91*s,15*s,'#385766');circle(x,y-91*s,12*s,P.cream);line(x,y-91*s,x,y-100*s,'#395660',s);line(x,y-91*s,x+8*s,y-88*s,'#395660',s);
    R(x-7*s,y-25*s,14*s,25*s,'#2a5860');R(x-9*s,y-53*s,6*s,11*s,'#416b72');R(x+4*s,y-53*s,6*s,11*s,'#416b72');
  }
  function house(x,y,w,h,variant=0){
    const colors=['#d8bd88','#d79b77','#97b8a0','#c9bf9c'];R(x,y-h,w,h,colors[variant%4]);R(x+w-6,y-h,6,h,'#36565755');
    poly([[x-7,y-h+2],[x+w*.5,y-h-20],[x+w+7,y-h+2]],variant%2?'#536976':'#66817a');R(x-7,y-h+2,w+14,3,'#294c56');
    for(let yy=y-h+11;yy<y-15;yy+=17)for(let xx=x+7;xx<x+w-8;xx+=15){R(xx,yy,8,10,'#365d69');R(xx+1,yy+1,3,4,'#e9ddab');}
    R(x+w*.43,y-18,w*.2,18,'#456563');R(x+5,y-8,8,3,'#9b7450');
  }
  function city(t,y=282,scroll=0){for(let i=0;i<14;i++){const x=i*65-40-scroll;house(x,y,43+i%3*6,35+hash(i+7)*35,i);}tower(632-scroll,y,1,t);}
  function flowers(t,scroll=0,low=328){for(let i=0;i<73;i++){const x=((hash(i+600)*W-scroll)%W+W)%W,y=low+hash(i+970)*40;R(x,y,3,1,i%4?'#adc184':'#f2d485');if(i%7===0){R(x,y-5,1,5,'#406954');R(x-1,y-6,3,2,i%2?P.gold:'#e6a895');}}}
  function meadow(t,mode='morning',scroll=0){sky(t,mode);hills(t,scroll,mode==='night');city(t,281,scroll*.025);R(0,284,W,148,mode==='night'?'#284b4a':'#689769');poly([[0,307],[768,291],[768,331],[0,354]],'#c4b58a');line(0,311,768,295,'#e8d3a1',2);line(0,348,768,326,'#5c795e',2);flowers(t,scroll);}
  function sparkles(t,x,y,count=22,color=P.gold){for(let i=0;i<count;i++){const a=hash(i+33)*TAU,r=hash(i+80)*50,q=(t+hash(i))*1.2%1;R(x+Math.cos(a)*r*q,y+Math.sin(a)*r*q,2,2,color);}}
  function pill(label,x,y,color=P.mint,width=106){frame(x,y,width,26,color);text(label,x+width/2,y+5,12,color,'center');}
  function timeCard(value,x,y,label,color=P.gold){frame(x,y,116,91,color);mono(label,x+12,y+9,8,color);number(value,x+14,y+25,2,color);mono('MIN',x+80,y+63,9,color);}

  const nodes={A:[92,218],C:[331,112],D:[436,285],B:[680,218]};
  const edgePaths={AC:[[92,218],[171,173],[252,130],[331,112]],CB:[[331,112],[451,99],[576,116],[680,218]],AD:[[92,218],[209,298],[329,312],[436,285]],DB:[[436,285],[525,268],[603,242],[680,218]],CD:[[331,112],[360,166],[406,239],[436,285]]};
  function pathLength(points){let total=0;for(let i=1;i<points.length;i++)total+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);return total;}
  function samplePath(points,u){const total=pathLength(points);let rest=clamp(u)*total;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(rest<=d||i===points.length-1)return {x:lerp(a[0],b[0],rest/d),y:lerp(a[1],b[1],rest/d),angle:Math.atan2(b[1]-a[1],b[0]-a[0])};rest-=d;}return {x:points[0][0],y:points[0][1],angle:0};}
  function routePoints(id){const list=ROUTES[id];return list.flatMap((edge,i)=>edgePaths[edge].slice(i?1:0));}
  const routes={upper:routePoints('upper'),lower:routePoints('lower'),shortcut:routePoints('shortcut')};
  function paintPath(points,col,width=14,dashes=true){for(let i=1;i<points.length;i++)line(...points[i-1],...points[i],'#254a50',width+5);for(let i=1;i<points.length;i++)line(...points[i-1],...points[i],col,width);if(dashes){const length=pathLength(points);for(let d=7;d<length;d+=17){const p=samplePath(points,d/length);R(p.x-2,p.y-1,4,2,'#f8e9c180');}}}
  function car(x,y,angle,color,hero=false){c.save();c.translate(Math.round(x),Math.round(y));c.rotate(angle);R(-6,-4,12,8,P.ink);R(-5,-3,10,6,color);R(0,-2,3,4,hero?'#ffeccc':'#cbebd9');R(-4,-5,3,1,P.ink);R(-4,4,3,1,P.ink);if(hero)R(-4,-2,3,4,'#f1ba6a');c.restore();}
  function miniatureLandscape(t,dark=false){
    sky(t,dark?'night':'morning');hills(t,0,dark);R(0,145,W,288,dark?'#2b5554':'#7fa577');
    poly([[357,90],[382,91],[383,137],[403,183],[391,224],[443,279],[505,354],[472,386],[420,311],[367,253],[364,211],[377,180],[354,135]],dark?'#327885':'#5caaa8');
    for(let i=0;i<43;i++)R(366+hash(i)*27+Math.sin(i*1.7)*9,102+i*6,9,1,dark?'#5a9798':'#a1d4bd');
    for(let i=0;i<18;i++){const x=18+hash(i+40)*724,y=127+hash(i+25)*203;if(Math.abs(x-384)>71)tree(x,y,.35+hash(i+75)*.26,t,dark);}
    house(30,222,46,37,1);house(699,245,39,44,0);tower(708,186,.44,t);
  }
  function roadModel(t,{dark=false,labels=true,traffic=true,tint=1,compact=false}={}){
    const state=trafficAt(t),loadColor=state.shortcutShare>.62?P.red:state.shortcutShare>.15?'#d4aa63':P.teal;
    miniatureLandscape(t,dark);
    paintPath(edgePaths.CB,dark?'#63827e':'#b7b491',16);paintPath(edgePaths.AD,dark?'#63827e':'#b7b491',16);
    paintPath(edgePaths.AC,loadColor,11);paintPath(edgePaths.DB,loadColor,11);
    if(t>=15){const progress=t<16.875?ease(15,16.875,t):1;c.save();c.globalAlpha=(t>=41.25?.36:1)*tint;const points=edgePaths.CD;for(let i=1;i<points.length;i++){const begin=(i-1)/3,end=i/3,u=clamp((progress-begin)/(end-begin));if(u>0){line(...points[i-1],lerp(points[i-1][0],points[i][0],u),lerp(points[i-1][1],points[i][1],u),'#364d4b',19);line(...points[i-1],lerp(points[i-1][0],points[i][0],u),lerp(points[i-1][1],points[i][1],u),P.gold,13);}}c.restore();}
    if(traffic){
      const shortcutCount=Math.round(state.shortcutShare*40);
      // Continuous cumulative phase: changing speed must not teleport the entire flow.
      let distance=t*.075;
      if(t>22.5){const u=clamp((t-22.5)/7.5);distance-=.027*7.5*(u*u*u-.5*u*u*u*u);}
      if(t>30)distance-=.027*Math.min(t-30,11.25);
      if(t>41.25){const u=clamp((t-41.25)/3.75);distance-=.027*3.75*(u-u*u*u+.5*u*u*u*u);}
      for(let i=0;i<40;i++){const kind=i<shortcutCount?'shortcut':i%2?'upper':'lower',u=(i/40+distance)%1,p=samplePath(routes[kind],u);car(p.x,p.y,p.angle,i===0?P.gold:kind==='lower'?'#7eafdf':kind==='shortcut'?'#d88c70':'#cde3af',i===0);}
    }
    for(const [key,[x,y]] of Object.entries(nodes)){circle(x,y,14,P.ink);circle(x,y,10,key==='A'?P.cream:key==='B'?P.gold:P.mint);mono(key,x,y-6,13,P.ink,'center');}
    if(labels){
      const narrow=Math.round(state.costs.AC),outside=45;
      pill(`${narrow} 分钟 · 窄路`,163,120,loadColor,112);pill(`${narrow} 分钟 · 窄路`,506,280,loadColor,112);
      text(`${Math.round(state.loads.AC)} 辆`,219,105,10,P.ink,'center',600);text(`${Math.round(state.loads.DB)} 辆`,562,309,10,dark?P.cream:P.ink,'center',600);
      pill(`${outside} 分钟 · 外路`,475,63,'#d8dac0',116);pill(`${outside} 分钟 · 外路`,177,306,'#d8dac0',116);
      if(t>=15){pill(t>=41.25?'近路暂停':'近路 · 0 分钟',387,175,t>=41.25?'#9fafac':P.gold,113);}
      text('出发',89,244,11,P.cream,'center');text('抵达',680,241,11,P.cream,'center');
      mono('SAME 4,000 TRIPS',36,58,8,'#e6e3b9');text('同一批 4000 辆车',35,74,13,P.cream);
      if(!compact){const total=t>=22.5&&t<41.25?Math.round(state.routeCosts.shortcut):Math.round(state.average);timeCard(total,620,48,t>=30&&t<41.25?'EVERYONE / 每个人':t>=15&&t<22.5?'BEFORE / 原先':'TRAVEL / 行程',t>=30&&t<41.25?P.red:P.gold);}
    }
    if(t>=41.25){const gate=ease(41.25,42.6,t);c.save();c.translate(384,198);c.rotate(-.55+(1-gate)*1.5);R(-21,-3,42,6,'#e4d5ab');for(let i=-20;i<21;i+=10)R(i,-3,5,6,P.red);c.restore();R(382,197,4,12,P.ink);}
    return state;
  }
  function sign(x,y,label,color=P.cream){R(x-2,y,4,47,'#6d6852');poly([[x-28,y-20],[x+29,y-20],[x+38,y-8],[x+29,y+3],[x-28,y+3]],'#284d56');text(label,x+2,y-15,12,color,'center');}

  function wish(t,u){
    meadow(t,'morning',t*43);tree(52-(t*21)%260,308,1.6,t);tree(787-(t*21)%260,306,1.3,t);
    if(u<3.75){A.bicycle(c,222+u*23,329,t,{scale:2.7,effort:.86,expression:'hope'});text('再快一点。',513,131,33,P.cream,'center',700);mono('A LITTLE FASTER',511,178,10,P.ink,'center');for(let i=0;i<8;i++)R(90+i*40-u*34,286+i%3*11,25,1,'#eae3bba0');}
    else{A.bicycle(c,146+(u-3.75)*39,324,t,{scale:1.75,effort:.58});sign(488,265,'钟楼',P.gold);text('路，还能更短吗？',294,75,26,P.cream,'center',600);}
  }
  function balance(t,u){
    roadModel(t);if(u<3.75){pill('各 2000 辆',306,64,P.mint,113);pill('各 2000 辆',365,308,P.blue,113);}
    else{frame(265,193,205,63,P.mint);text('20 + 45 = 65',367,205,22,P.cream,'center',600);mono('TWO ROUTES / ONE BALANCE',367,235,8,P.mint,'center');}
  }
  function shortcut(t,u){
    roadModel(t);
    if(u<3.75){if(u<1.875)sparkles(u,383,200,34,P.gold);text('连起来，就快了？',377,29,21,P.cream,'center',600);}
    else{frame(277,30,266,44,P.gold);text('按当前车流估算：40 分钟',410,42,17,P.gold,'center',600);A.person(c,68,331,t,{scale:1.45,action:'point',phase:ease(18.75,19.7,t),expression:'hope'});}
  }
  function rush(t,u){
    const state=roadModel(t);const share=Math.round(state.shortcutShare*100);
    if(u<3.75){frame(278,30,268,44,P.gold);text(`选择近路：${share}%`,412,40,20,P.gold,'center',600);}
    else{frame(282,30,270,44,P.red);text('都想更快，挤向同一条路。',417,44,16,P.cream,'center');}
    if(u>4.0){const a=.16+.12*Math.sin(t*TAU/data.beat);c.save();c.globalAlpha=a;circle(204,161,37,P.red);circle(557,257,37,P.red);c.restore();}
  }
  function gridlock(t,u){
    if(u<3.75){
      sky(t,'night');hills(t,0,true);city(t,260,40);R(0,272,W,160,'#3f6263');R(0,306,W,39,'#8d9781');R(0,305,W,3,'#e9ce97');
      for(let i=0;i<11;i++){const x=i*79-25;R(x,284,63,25,i%3?'#a66b63':'#ba9166');R(x+8,276,34,13,'#6d898c');R(x+11,278,12,9,'#b7d8c8');circle(x+13,310,6,P.ink);circle(x+49,310,6,P.ink);R(x+60,297,3,4,P.red);}
      A.bicycle(c,310,329,t,{scale:2.05,moving:false,effort:.9,expression:'worry'});
      text('更短的路。更晚的抵达。',382,52,27,P.cream,'center',700);timeCard(65,173,105,'BEFORE / 原来',P.mint);text('→',326,133,40,P.cream);timeCard(80,399,105,'NOW / 现在',P.red);
      const hand=t*8;for(let i=0;i<7;i++)R(80+i*90,254+Math.sin(hand+i)*2,9,2,P.red);
    }else{
      roadModel(t,{dark:true});frame(239,29,350,43,P.red);text('40 + 0 + 40 = 80',414,39,24,P.cream,'center',600);
      frame(271,213,222,69,'#c2bbae');text('我独自改走外路呢？',382,223,15,P.cream,'center');text('40 + 45 ≈ 85 分钟',382,248,16,P.red,'center',600);
    }
  }
  function desk(t,u){
    R(0,0,W,H,'#143743');R(0,28,W,294,'#24515a');for(let i=0;i<9;i++)R(i*104,29,3,293,'#2b5d63');
    frame(551,47,135,113,'#83ac99','#659591');circle(645,82,19,P.cream);poly([[552,139],[602,107],[637,129],[685,112],[685,159],[552,159]],'#356c6b');R(615,48,4,112,'#294d53');R(553,103,131,4,'#294d53');
    R(53,285,461,17,'#ad8b63');R(67,303,13,60,'#655b4b');R(500,303,13,60,'#655b4b');
    poly([[109,119],[443,104],[472,267],[97,278]],'#324c4c');poly([[114,116],[445,103],[467,263],[101,273]],P.paper);
    c.save();c.translate(114,118);c.scale(.44,.43);
    for(const edge of ['CB','AD','AC','DB'])paintPath(edgePaths[edge],edge==='AC'||edge==='DB'?'#d3866d':'#9ea779',12);
    paintPath(edgePaths.CD,P.gold,11);for(const [key,[x,y]] of Object.entries(nodes)){circle(x,y,14,P.ink);mono(key,x,y-8,18,P.cream,'center');}c.restore();
    text('问题在这里。',258,84,23,P.cream,'center',600);
    if(u>1.0){const q=ease(38.5,40.3,t);c.save();c.globalAlpha=q;circle(204,187,17,'#df755d88');circle(360,231,17,'#df755d88');c.restore();line(231,181,270,152,P.ink,1);text('同一批人',291,127,12,'#365b5b','center');}
    oval(562,327,28,4,'#102d38');
    A.person(c,562,326,t,{scale:3.35,action:'think',phase:ease(37.8,39.3,t),expression:'thought',facing:-1});
    R(486,271,24,14,'#d7be84');R(491,274,14,3,'#816d51');line(491,271,477,250,'#e5cda0',3);
  }
  function rethink(t,u){
    if(u<3.75)desk(t,u);
    else{
      roadModel(t,{dark:false});frame(275,30,286,43,P.mint);text('重新分流，而不是更用力。',418,43,17,P.cream,'center');
      A.person(c,60,333,t,{identity:'hero',scale:1.5,action:'signal',phase:ease(41.25,42.5,t),expression:'resolve'});
      A.person(c,718,330,t,{identity:'dispatcher',scale:1.4,action:'signal',phase:ease(41.6,43.0,t),facing:-1});
    }
  }
  function release(t,u){roadModel(t);frame(288,30,252,43,P.mint);text('同样的车流，重新流动。',414,43,17,P.cream,'center');if(u<1.4)sparkles(u,680,210,24,P.mint);}
  function reveal(t){
    R(0,0,W,H,P.deep);for(let i=0;i<22;i++){const x=hash(i)*W,y=hash(i+4)*H;R(x,y,2,2,'#7fae9d');}
    text('你刚刚看见的，是',384,61,17,'#a6cbbd','center');text('布雷斯悖论',384,105,44,P.cream,'center',800);mono("BRAESS'S PARADOX",384,162,11,P.mint,'center');
    const values=[65,80,65],labels=['原来分两路','近路开放后','关闭并重新分流'];
    for(let i=0;i<3;i++){const x=133+i*193;timeCard(values[i],x,209,labels[i],i===1?P.red:P.mint);if(i<2)text('→',x+131,238,26,'#bad1bd');}
    text('特定路网模型，不是“道路越少越好”',384,317,12,'#88b3a8','center');
  }
  function study(t,u){
    sky(t,'gold');hills(t,0);R(0,281,W,151,'#496f5f');R(19,131,162,166,'#294e54');R(26,136,148,156,'#af916c');
    for(let row=0;row<3;row++){R(25,166+row*50,151,5,'#3c4e4b');for(let i=0;i<10;i++){const h=20+hash(i+row*31)*20;R(30+i*14,165+row*50-h,9,h,['#81aaa0','#d8ab6f','#a3685d','#668c98'][i%4]);R(32+i*14,167+row*50-h,4,1,P.paper);}}
    oval(346,335,29,4,'#33594f');
    A.person(c,346,335,t,{scale:2.8,action:'study',phase:ease(52.5,53.4,t),expression:'thought'});
    R(253,303,274,13,'#c19a6c');R(266,316,10,32,'#756448');R(504,316,10,32,'#756448');
    sign(596,260,'方法',P.mint);sign(688,232,'方向',P.gold);poly([[501,431],[613,303],[687,276],[768,277],[768,334],[649,330],[590,432]],'#b7bd8e');
    text('路网以外，也许我们可以问：',413,65,18,P.cream,'center');text('方向，还适合我吗？',423,111,30,P.cream,'center',700);mono('A REFLECTION, NOT A PROMISE',429,157,9,'#365d62','center');
    tree(739,320,1.4,t);flowers(t,0,352);
  }
  function meaning(t,u){if(u<3.75)reveal(t);else study(t,u-3.75);}
  function horizon(t,u){
    meadow(t,'gold',u*11);poly([[0,344],[135,327],[279,325],[428,295],[641,275],[645,287],[466,312],[293,344],[152,352],[0,380]],'#e1c996');
    A.bicycle(c,205+u*34,341-u*3.5,t,{scale:1.63,effort:.3,expression:'resolve'});
    text('赶路的人',385,64,50,P.cream,'center',800);text('改变走法，不是放弃抵达。',385,132,19,'#e3e9c5','center');mono('KEEP THE GOAL. RECONSIDER THE WAY.',385,166,9,P.ink,'center');
    tree(68,314,1.5,t);tree(733,301,1.8,t);if(u>2.9){c.save();c.globalAlpha=ease(59.15,60,t)*.2;R(0,0,W,H,P.deep);c.restore();}
  }
  const painters={wish,balance,shortcut,rush,gridlock,rethink,release,meaning,horizon};
  function draw(time,{poster=false,reduced=false}={}){
    const t=clamp(Number.isFinite(time)?time:0,0,60);c.resetTransform();c.globalAlpha=1;c.globalCompositeOperation='source-over';c.imageSmoothingEnabled=false;R(0,0,W,H,P.deep);
    if(poster){meadow(2,'gold');A.bicycle(c,568,320,2,{scale:2.85,moving:false,expression:'hope'});tree(728,315,1.8,2);sign(450,277,'远方');return;}
    const chapter=data.chapters.find(ch=>t<ch.end)||data.chapters.at(-1);painters[chapter.id](t,t-chapter.start);
    // Calm camera: cuts change the composition, not the readability of the UI.
    const cut=data.shots.find(s=>t>=s.start&&t<s.start+.16&&s.start>0);
    if(cut&&!reduced){c.save();c.globalAlpha=(1-ease(cut.start,cut.start+.16,t))*.55;R(0,0,W,H,P.deep);c.restore();}
    R(0,0,W,16,P.deep);R(0,H-16,W,16,P.deep);
    if(!reduced){c.save();c.globalAlpha=.1;for(let i=0;i<24;i++)R((hash(i+70)*W+Math.floor(t*8)*3)%W,hash(i+77)*H,1,1,P.cream);c.restore();}
    R(19,417,730,1,'#47646a');R(19,417,730*t/60,1,P.gold);
  }
  return {draw,snapshot:()=>canvas.toDataURL('image/png'),dimensions:{width:W,height:H},model:trafficAt,sceneNames:Object.keys(painters)};
}