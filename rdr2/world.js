/* Original 2D pixel cinematography. Locations are evocative compositions,
 * not traced screenshots, exact maps, or reconstructions of a canonical mission. */
function createWesternWorld(canvas, chapters) {
  const c=canvas.getContext('2d',{alpha:false});
  if(!c)throw new Error('无法创建像素画布');
  const W=640,H=360,TAU=Math.PI*2,actors=createWesternActors();
  let gentleWeather=false;
  const P={ink:'#101519',coal:'#202226',night:'#14212d',cream:'#f3dfae',gold:'#eabd79',red:'#bc493b',teal:'#67908b',snow:'#d5e1dc',blue:'#5b7e95'};
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const smooth=(a,b,t)=>{const p=clamp((t-a)/(b-a));return p*p*(3-2*p);};
  const mix=(a,b,v)=>a+(b-a)*v;
  const fract=v=>v-Math.floor(v),hash=n=>fract(Math.sin(n*127.1+31.7)*43758.5453);
  let seed=0x1899cafe;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const dust=Array.from({length:240},()=>({x:random()*W,y:random()*H,v:.3+random(),p:random(),a:random()*TAU}));
  const stars=Array.from({length:90},()=>({x:random()*W,y:random()*205,p:random()}));
  const R=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const poly=(points,color)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.closePath();c.fill();};
  const line=(x0,y0,x1,y1,color,width=1)=>{const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0),1);for(let i=0;i<=n;i++)R(mix(x0,x1,i/n),mix(y0,y1,i/n),width,width,color);};
  const box=(x,y,w,h,color,width=1)=>{R(x,y,w,width,color);R(x,y+h-width,w,width,color);R(x,y,width,h,color);R(x+w-width,y,width,h,color);};
  function circle(x,y,r,color,step=1){for(let v=-r;v<=r;v+=step){const half=Math.floor(Math.sqrt(Math.max(0,r*r-v*v)));R(x-half,y+v,half*2+1,step,color);}}
  function oval(x,y,rx,ry,color){for(let v=-ry;v<=ry;v++){const half=rx*Math.sqrt(Math.max(0,1-v*v/(ry*ry)));R(x-half,y+v,half*2,1,color);}}
  function txt(text,x,y,size=14,color=P.cream,align='center',font='serif'){
    c.save();c.font=`${font==='serif'?'bold ':''}${size}px ${font==='serif'?'"Noto Serif SC","Songti SC","SimSun",serif':'"Space Grotesk","Microsoft YaHei",sans-serif'}`;c.textAlign=align;c.textBaseline='top';c.fillStyle='#0b111a';c.fillText(text,Math.round(x+1),Math.round(y+1));c.fillStyle=color;c.fillText(text,Math.round(x),Math.round(y));c.restore();
  }
  const F={A:[14,17,17,31,17,17,17],B:[30,17,17,30,17,17,30],C:[15,16,16,16,16,16,15],D:[30,17,17,17,17,17,30],E:[31,16,16,30,16,16,31],F:[31,16,16,30,16,16,16],G:[14,17,16,23,17,17,15],H:[17,17,17,31,17,17,17],I:[31,4,4,4,4,4,31],J:[7,2,2,2,18,18,12],K:[17,18,20,24,20,18,17],L:[16,16,16,16,16,16,31],M:[17,27,21,21,17,17,17],N:[17,25,21,19,17,17,17],O:[14,17,17,17,17,17,14],P:[30,17,17,30,16,16,16],Q:[14,17,17,17,21,18,13],R:[30,17,17,30,20,18,17],S:[15,16,16,14,1,1,30],T:[31,4,4,4,4,4,4],U:[17,17,17,17,17,17,14],V:[17,17,17,17,17,10,4],W:[17,17,17,21,21,21,10],X:[17,17,10,4,10,17,17],Y:[17,17,10,4,4,4,4],Z:[31,1,2,4,8,16,31],'0':[14,17,19,21,25,17,14],'1':[4,12,4,4,4,4,14],'2':[14,17,1,2,4,8,31],'3':[30,1,1,14,1,1,30],'4':[2,6,10,18,31,2,2],'5':[31,16,16,30,1,1,30],'6':[14,16,16,30,17,17,14],'7':[31,1,2,4,8,8,8],'8':[14,17,17,14,17,17,14],'9':[14,17,17,15,1,1,14],'.':[0,0,0,0,0,6,6],':':[0,4,4,0,4,4,0],'/':[1,2,2,4,8,8,16],'-':[0,0,0,31,0,0,0],' ':[0,0,0,0,0,0,0],'?':[14,17,1,2,4,0,4]};
  function pixel(text,x,y,s=1,color=P.cream,align='left'){
    text=String(text).toUpperCase();if(align==='center')x-=(text.length*6-1)*s/2;if(align==='right')x-=(text.length*6-1)*s;
    for(let i=0;i<text.length;i++)for(let row=0;row<7;row++)for(let col=0;col<5;col++)if((F[text[i]]||F['?'])[row]&(1<<(4-col)))R(x+(i*6+col)*s,y+row*s,s,s,color);
  }
  function sky(t,mode='dawn'){
    const palettes={dawn:['#263249','#53404b','#9d6157','#d59870','#e7bd91'],day:['#537990','#7197a4','#9ab7b6','#bec6af','#d8ccb1'],snow:['#172733','#3b505f','#617987','#91a3a9','#bdccd0'],night:['#0e1926','#142539','#243749','#354353','#56606a'],storm:['#16212c','#273741','#465458','#6a6b67','#828478'],red:['#191d26','#47323b','#7d4242','#ba6e54','#d99663']};
    const colors=palettes[mode]||palettes.dawn;
    colors.forEach((color,i)=>R(0,i*52,W,53,color));
    if(['night','snow'].includes(mode)){for(const p of stars){c.globalAlpha=.2+p.p*.5;R(p.x,p.y,1,1,'#c8d2d5');}c.globalAlpha=1;}
    if(mode==='dawn'||mode==='red'||mode==='day'){const x=mode==='day'?459:468,y=mode==='day'?69:128,r=mode==='day'?26:37;circle(x,y,r,mode==='red'?'#eac188':'#f2d6a2',2);if(mode!=='day')for(let i=0;i<8;i++)R(x-r,y+8+i*5,r*2,1,colors[3]);}
    if(mode==='night'){circle(474,64,19,'#c7c8b0',2);circle(482,61,16,'#3b4a5c',2);}
    for(let layer=0;layer<3;layer++){
      c.globalAlpha=.22+layer*.07;
      for(let i=0;i<7;i++){const x=((i*143+t*(layer+1)*.9+layer*61)%890)-130,y=45+layer*43+(i%3)*11;const w=55+(i*37)%81;R(x,y,w,3,mode==='night'?'#87959b':'#d5d1bd');R(x+13,y-3,w-25,3,mode==='night'?'#6b7d8c':'#e2d6bb');}
      c.globalAlpha=1;
    }
  }
  function mountains(t,{snow=false,mode='dawn',scroll=0}={}){
    const colors=snow?['#7c939e','#4a6575','#2f4e5e']:mode==='night'||mode==='storm'?['#45545d','#344957','#213b48']:['#927d77','#677478','#415d64'];
    const facets=snow?['#a4b5bb','#7e99a3','#587983']:mode==='night'||mode==='storm'?['#52616a','#3c5664','#335362']:['#9a9290','#75858a','#4c6e76'];
    for(let layer=0;layer<3;layer++){
      const base=182+layer*34,period=210-layer*37,offset=-(scroll*(layer*.4+.5))%period;
      for(let k=-2;k<6;k++){
        const x=k*period+offset,peak=base-54-layer*7-hash(k+37+layer*13)*37;
        poly([[x-20,base+32],[x+period*.17,base-13],[x+period*.43,peak],[x+period*.56,peak+18],[x+period*.67,peak+6],[x+period+22,base+35],[x+period+22,310],[x-20,310]],colors[layer]);
        poly([[x+period*.43,peak],[x+period*.50,base+19],[x+period*.79,base+26],[x+period*.67,peak+6],[x+period*.56,peak+18]],facets[layer]);
        for(let seam=0;seam<4;seam++){
          const v=.26+seam*.17,xx=x+period*(.43+.19*v),yy=mix(peak,base+19,v);
          poly([[xx,yy],[xx+period*.025,yy+5],[xx+period*(.025+v*.075),yy+3],[xx+period*.065,yy+1]],colors[layer]);
        }
        if(snow)poly([[x+period*.43,peak],[x+period*.29,peak+27],[x+period*.38,peak+21],[x+period*.47,peak+29],[x+period*.52,peak+16]],layer<2?'#d4e0dd':'#91b0b8');
      }
    }
  }
  function pine(x,y,s=1,color='#253e46',snow=false,t=0){
    R(x-2*s,y-28*s,4*s,30*s,'#443d34');
    for(let i=0;i<4;i++){const w=(10+i*6)*s,top=y-(69-i*13)*s;poly([[x+Math.sin(t*.9+x)*s,top],[x-w,top+25*s],[x+w,top+25*s]],color);if(snow)poly([[x,top],[x-w*.58,top+16*s],[x+w*.65,top+15*s],[x+w*.15,top+11*s]],'#aebfc2');}
  }
  function tree(x,y,s=1,t=0,color='#3c594e'){
    poly([[x-3*s,y],[x-2*s,y-39*s],[x-13*s,y-54*s],[x-9*s,y-56*s],[x+1*s,y-42*s],[x+8*s,y-57*s],[x+11*s,y-56*s],[x+4*s,y-34*s],[x+5*s,y]],'#403f33');
    for(let i=0;i<6;i++){const a=i*1.6;const cx=x+Math.cos(a)*15*s+Math.sin(t*.8+i)*s,cy=y-54*s+Math.sin(a)*9*s;oval(cx,cy,(16+i%2*3)*s,12*s,color);R(cx-11*s,cy-9*s,13*s,2*s,'#738069');}
  }
  function land(t,mode='grass',scroll=0,y=263){
    const colors=mode==='snow'?['#c4d3d2','#a8bfc3','#819da5']:mode==='night'?['#273d40','#354945','#172f35']:mode==='mud'?['#5a594e','#767260','#444d45']:['#68765a','#8d916b','#424f46'];
    poly([[-20,y+7],[70,y-8],[155,y+1],[254,y-12],[343,y-2],[458,y-11],[660,y+4],[660,360],[-20,360]],colors[0]);
    for(let i=0;i<140;i++){const p=dust[i],x=((p.x-scroll*(1+p.p*.5))%W+W)%W,yy=y+9+p.p*(H-y);R(x,yy,2+(i%3)*3,1,i%2?colors[1]:colors[2]);if(mode!=='snow'&&i%5===0)line(x,yy,x-2,yy-5,colors[2]);}
    if(mode!=='snow'){poly([[270,y-1],[297,y-1],[475,360],[344,360]],mode==='night'?'#586053':'#b29b73');line(283,y,385,358,colors[1],1);}
  }
  function birds(t,x=380,y=89,count=8){for(let i=0;i<count;i++){const px=x+i*12+((t*7)%70),py=y+Math.sin(i*1.7)*14+Math.sin(t+i)*2,wing=Math.sin(t*6+i)*3;line(px-4,py-wing,px,py,'#233749');line(px,py,px+4,py-wing,'#233749');}}
  function weather(t,type='snow',strength=1){
    c.save();
    for(let i=0;i<(type==='snow'?200:150)*strength*(gentleWeather?.32:1);i++){const p=dust[i%dust.length];const x=((p.x+t*(type==='snow'?17:-75)*p.v)%W+W)%W;const y=(p.y+t*(type==='snow'?16:145)*p.v)%H;c.globalAlpha=(.18+p.p*.47)*(gentleWeather?.65:1);
      if(type==='snow')R(x,y,1+p.p*2,1+p.p*2,'#e4ece8');else line(x,y,x-5,y+12,'#9eb8c2');
    }c.restore();
  }
  function fire(x,y,t,s=1,glow=true){
    if(glow){c.save();c.globalAlpha=.13;oval(x,y,42*s,17*s,'#eea465');c.globalAlpha=.08;oval(x,y,66*s,24*s,'#df8556');c.restore();}
    line(x-12*s,y+3*s,x+13*s,y-2*s,'#473323',4*s);line(x+12*s,y+4*s,x-10*s,y-3*s,'#986441',3*s);
    for(let i=0;i<8;i++){const h=(8+(Math.sin(t*9+i*2)+1)*6)*s,xx=x+(i-3.5)*2*s;poly([[xx-3*s,y],[xx-2*s,y-h*.7],[xx+Math.sin(t*7+i)*3*s,y-h],[xx+3*s,y-4*s]],['#b9563c','#e58a4a','#f3b969','#ffe0a1'][i%4]);}
    for(let i=0;i<18;i++){const p=dust[i],age=(t*.7+p.p*2)%1;R(x+Math.sin(age*4+p.p*7)*14*s,y-age*60*s,1,2,i%3?'#e4a867':'#eedab0');}
  }
  function tent(x,y,w=94,h=54,color='#a4a38b'){
    poly([[x,y],[x+w*.46,y-h],[x+w,y],[x+w*.86,y+4],[x+w*.07,y+4]],'#383e3b');
    poly([[x+3,y],[x+w*.46,y-h+2],[x+w*.87,y]],color);poly([[x+w*.46,y-h+2],[x+w*.87,y],[x+w*.53,y]],'#595f53');
    poly([[x+w*.46,y-h+10],[x+w*.35,y],[x+w*.57,y]],'#1d292d');
    line(x+w*.46,y-h-2,x+w*.47,y,'#d7cbae');line(x+7,y-4,x-13,y+9,'#938977');line(x+w*.86,y-4,x+w+17,y+10,'#938977');R(x-14,y+7,2,8,'#605343');R(x+w+16,y+7,2,8,'#605343');
  }
  function cabin(x,y,w=98,h=69){
    R(x,y-h,w,h,'#535447');for(let r=0;r<h;r+=7){R(x,y-h+r,w,3,'#817b64');R(x+2,y-h+r,2,4,'#a59c81');}
    poly([[x-11,y-h+3],[x+w*.48,y-h-34],[x+w+11,y-h+3]],'#353b39');poly([[x-6,y-h+1],[x+w*.47,y-h-29],[x+w*.51,y-h+1]],'#82918e');
    R(x+w*.44,y-36,23,36,'#292f2d');R(x+13,y-46,20,24,'#293d45');R(x+17,y-42,12,16,'#c3b382');line(x+23,y-43,x+23,y-25,'#555f56');line(x+16,y-35,x+31,y-35,'#555f56');
    R(x+w-23,y-h-27,10,27,'#635e54');
  }
  function smoke(x,y,t,size=1){for(let i=0;i<11;i++){const age=(t*.28+i/11)%1;const xx=x+Math.sin(age*5)*17*size,yy=y-age*85*size;c.globalAlpha=(1-age)*.19;oval(xx,yy,(5+age*17)*size,(3+age*9)*size,'#99a5a3');}c.globalAlpha=1;}
  function river(t,y=215){
    poly([[289,y],[321,y],[421,265],[599,360],[230,360],[242,287],[308,263]],'#477b88');
    for(let i=0;i<90;i++){const p=dust[i],yy=y+p.p*(360-y);const left=yy<268?mix(289,245,(yy-y)/53):mix(245,230,(yy-268)/92),right=yy<268?mix(321,426,(yy-y)/53):mix(426,599,(yy-268)/92);const x=mix(left,right,fract(p.x/W+t*.025));R(x,yy,4+p.p*16,1,i%3?'#779c9e':'#bbcebd');}
  }
  function bridge(t,y=243){
    for(let i=0;i<7;i++){const x=22+i*98;line(x,y,x+34,350,'#293942',6);line(x+65,y,x+34,350,'#47554f',4);line(x,y+46,x+65,y+46,'#526359',3);}
    R(-10,y-4,660,10,'#9b8b69');R(0,y+7,640,4,'#424c43');
    for(let x=0;x<W;x+=8)R(x,y-5,4,12,'#615e50');
    R(0,y-22,640,3,'#897d61');for(let x=0;x<W;x+=32)R(x,y-22,2,18,'#696d57');
  }
  function wheel(x,y,r,t){circle(x,y,r,'#121e25');circle(x,y,r-2,'#586363');for(let i=0;i<8;i++){const a=t*5+i*TAU/8;line(x,y,x+Math.cos(a)*(r-3),y+Math.sin(a)*(r-3),'#aaa997');}circle(x,y,2,'#172735');}
  function train(x,y,t,s=1){
    c.save();c.translate(x,y);c.scale(s,s);
    for(let car=0;car<5;car++){const xx=-car*125;R(xx-116,-48,114,41,car%2?'#644b38':'#7d5740');R(xx-120,-53,121,6,'#323d3e');R(xx-115,-8,115,4,'#1d2c33');for(let j=0;j<6;j++){R(xx-107+j*16,-41,10,18,'#263d47');R(xx-106+j*16,-40,4,15,'#c4b887');}wheel(xx-98,0,9,t);wheel(xx-24,0,9,t);R(xx,-6,7,2,'#888572');}
    R(0,-41,89,33,'#22373e');oval(61,-27,23,17,'#33474a');R(7,-55,29,40,'#34434a');R(3,-59,37,5,'#78837c');R(12,-48,16,16,'#c6ba8c');R(70,-68,10,27,'#21363c');R(66,-72,18,6,'#475c5b');R(40,-47,10,7,'#9c956d');R(9,-9,96,6,'#727665');poly([[88,-9],[109,4],[88,4]],'#354a4e');wheel(16,0,11,t);wheel(48,0,12,t);wheel(78,0,12,t);line(16,Math.sin(t*5)*4,78,Math.sin(t*5)*4,'#b1ae8f',2);circle(91,-26,4,'#f0d78e');smoke(76,-72,t,1.05);c.restore();
  }
  function cityBuildings(t){
    const scroll=(t*3)%57;
    for(let layer=0;layer<2;layer++)for(let i=-1;i<11;i++){
      const x=i*67-scroll*(layer?.8:.25),w=46+(i+9)%3*10,h=55+hash(i+layer*30)*80,y=layer?267:216;
      R(x,y-h,w,h,layer?'#555049':'#50616a');R(x-3,y-h-4,w+6,5,layer?'#998777':'#77858a');
      for(let row=0;row<Math.floor((h-13)/18);row++)for(let col=0;col<3;col++){const wx=x+7+col*(w-10)/3,wy=y-h+11+row*18;R(wx,wy,8,11,hash(i*9+row+col)>.33?'#d9b775':'#203a49');R(wx,wy+5,8,1,'#685d50');}
      if(i%3===1){R(x+9,y-h-29,7,29,'#635d55');smoke(x+12,y-h-31,t+i,.55);}
      if(layer){R(x+5,y-29,w-10,4,'#ad9678');R(x+w/2-7,y-27,14,27,'#24353c');}
    }
  }
  function telegraph(x,y,h=120){R(x,y-h,4,h,'#4c4e43');R(x-19,y-h+13,42,4,'#655e4a');for(let i=-1;i<2;i++){R(x+i*17,y-h+7,3,7,'#b4b6a0');line(x+i*17,y-h+7,x+190+i*17,y-h+24,'#344146');}}
  function fence(y=280,t=0){for(let x=-30;x<W+40;x+=35){const xx=x-(t*17)%35;R(xx,y-22,4,28,'#3f493f');R(xx-1,y-23,6,3,'#8d9071');}R(0,y-15,W,3,'#68735a');R(0,y-4,W,3,'#58634f');}
  function noteBook(x,y,t,s=1){c.save();c.translate(x,y);c.scale(s,s);poly([[-34,-19],[-2,-25],[36,-20],[37,29],[-1,25],[-35,30]],'#5c473a');poly([[-31,-16],[-2,-21],[-1,22],[-32,26]],'#d7c6a0');poly([[2,-21],[32,-17],[33,25],[1,21]],'#e3d2ac');for(let i=0;i<7;i++){R(-26,-12+i*5,19-(i%3)*3,1,'#947b60');R(7,-11+i*5,19,1,'#a18b6d');}line(0,-20,0,24,'#aa8c6b');c.restore();}
  function landscape(t,mode='dawn',options={}){sky(t,mode);mountains(t,{snow:options.snow,mode,scroll:options.scroll||0});}
  function narrativeCard(title,sub,x=36,y=88,color=P.cream){txt(title,x,y,29,color,'left');if(sub)pixel(sub,x+1,y+39,1,'#cab58e');}

  function promise(t,u,poster=false){
    landscape(t,'red');land(t,'night',0,272);
    pine(53,267,1.7,'#1c3437',false,t);tree(543,275,1.6,t,'#233f3e');
    if(poster){actors.horse(c,465,281,t,{scale:2.35,rider:'arthur',gait:'idle',coat:'bay',dust:false,facing:-1});fire(388,304,t,1.25);birds(t,200,85,5);}
    else{fire(318,281,t,1.5);actors.person(c,237,287,t,{identity:'dutch',action:u<3.75?'point':'idle',scale:3.3});actors.person(c,405,289,t,{identity:'arthur',action:'sit',scale:3.2,facing:-1});tent(448,255,125,66,'#8b8a77');pixel('ONE MORE TOMORROW',320,94,2,'#d5b286','center');}
    for(let i=0;i<20;i++){const p=dust[i];R(p.x,300-((t*13+p.p*200)%170),1,2,'#cf9460');}
  }
  function snow(t,u){
    landscape(t,'snow',{snow:true,scroll:u*7});
    for(let i=0;i<14;i++)pine(i*61-u*4%61,249+(i%3)*8,.55+(i%4)*.13,'#345767',true,t);
    land(t,'snow',u*19,274);
    for(let i=0;i<4;i++)actors.horse(c,346-i*84+Math.sin(u*.4+i)*6,282-i%2*7,t+i*.22,{scale:1.26-i*.09,coat:i%2?'black':'bay',rider:['arthur','dutch','camp','traveler'][i],gait:'walk',speed:.85,dust:false});
    actors.wagon(c,66,286,t,{scale:.9,moving:true,occupants:2});
    pine(5-u*12%140,332,2.1,'#1c3848',true,t);pine(670-u*12%140,333,2.5,'#1b3544',true,t);
    if(u<5.5){pixel('AMERICA',324,82,2,'#beced1','center');pixel('1899',324,109,6,P.cream,'center');}else if(u<9.5){pixel('AFTER BLACKWATER',323,91,2,'#c9d4d4','center');}
    weather(t,'snow',1);
  }
  function camp(t,u){
    landscape(t,'dawn');land(t,'grass',0,247);
    for(let i=0;i<8;i++)pine(i*97-21,253,.9+(i%3)*.35,'#314f4c',false,t);
    tent(57,272,99,61,'#b4b299');tent(434,266,105,60,'#929987');actors.wagon(c,561,275,t,{scale:.7,moving:false,occupants:1});
    line(122,241,460,246,'#544d3c');for(let i=0;i<5;i++){R(175+i*38,243+i*.3,20,15,['#8b8270','#a8aaa1','#806d6a'][i%3]);}
    fire(316,282,t,1.3);R(194,274,49,11,'#4c4738');R(366,274,44,10,'#514638');
    actors.person(c,222,279,t,{identity:'arthur',action:'sit',scale:2.4});actors.person(c,390,279,t,{identity:'dutch',action:u>9?'point':'sit',scale:2.5,facing:-1});
    actors.person(c,449-Math.sin(u*.21)*34,279,t,{identity:'woman',action:'walk',scale:1.55,facing:-1});actors.person(c,105,291,t,{identity:'camp',variant:1,action:'lantern',scale:1.5});
    actors.horse(c,63,288,t,{scale:1.0,gait:'idle',coat:'cream',rider:false,dust:false});
    if(u<4.8)narrativeCard('篝火另一边','THE VAN DER LINDE GANG',31,75);
    else if(u>10)txt('有人叫它帮派。有人叫它家。',320,103,18,'#ddc69f');
    birds(t,303,74,4);
  }
  function arthur(t,u){
    if(u<9.375){
      landscape(t,'day',{scroll:u*2});river(t,228);land(t,'grass',0,275);
      tree(591,277,2.4,t,'#375349');actors.horse(c,400,297,t,{scale:2.9,coat:'bay',rider:'arthur',gait:u<4?'walk':'idle',speed:.8,dust:false});
      narrativeCard('亚瑟·摩根','ARTHUR MORGAN',40,84);pixel('THE MAN BEHIND THE PROMISE',43,139,1,'#acbba9');
      birds(t,91,54,6);
    }else{
      landscape(t,'dawn');land(t,'night',0,270);tree(497,302,3,t,'#1a3338');
      R(391,282,94,24,'#3e4238');actors.person(c,426,288,t,{identity:'arthur',action:'journal',scale:5,facing:-1});fire(270,308,t,.75);
      noteBook(144,169,t,2.1);pixel('A LIFE BETWEEN THE LINES',144,244,1,'#bea886','center');
      if(u>13)txt('替人背负的人，也会有疑问。',182,85,19,'#dac49d');
    }
  }
  function frontier(t,u){
    landscape(t,'day',{scroll:u*4});river(t,222);
    poly([[0,250],[120,231],[237,266],[280,360],[0,360]],'#536c51');poly([[438,236],[560,230],[640,252],[640,360],[573,360]],'#577851');
    for(let i=0;i<9;i++)tree(20+i*72,278+(i%3)*7,.55+(i%2)*.18,t,'#4c714f');
    const riderX=178+Math.min(u,5.625)*5;
    oval(riderX,284,35,3,'#354e42');
    actors.horse(c,riderX,282,t,{scale:1.7,gait:u<3.75?'gallop':u<5.625?'walk':'idle',rider:'arthur',speed:1.0,dust:u<5.625});
    for(let i=0;i<3;i++)actors.horse(c,450+i*39-u*4,246+i*3,t+i,{scale:.58,gait:'walk',rider:false,coat:i%2?'cream':'bay',dust:false});
    birds(t,173,92,11);tree(-34,320,3,t,'#273e35');tree(664,330,3.7,t,'#213e36');
    for(let i=0;i<38;i++){const p=dust[i];const x=p.x,y=304+p.p*36;R(x,y,2,2,i%3?'#d1b273':'#ede0a5');}
    if(u<4.3)narrativeCard('世界仍然辽阔','THE OPEN COUNTRY',34,57);
  }
  function city(t,u){
    sky(t,'storm');cityBuildings(t);R(0,268,W,92,'#766f5d');
    for(let y=275;y<H;y+=8)for(let x=0;x<W;x+=17)R(x+(y%16?8:0),y,15,1,'#aaa087');
    line(0,309,W,277,'#333a39',2);line(0,329,W,294,'#b5b5a3',2);
    telegraph(44,285,165);telegraph(444,271,147);telegraph(630,282,145);
    const tram=(u*30)%850-100;R(tram,230,83,46,'#7c4c35');R(tram-5,225,94,7,'#283b43');for(let i=0;i<5;i++)R(tram+6+i*15,235,10,19,'#bac2ad');R(tram+2,262,80,3,'#c39f68');wheel(tram+15,280,6,t);wheel(tram+70,280,6,t);line(tram+37,225,tram+60,192,'#283839',2);
    actors.person(c,498-u*7,302,t,{identity:'arthur',action:'walk',scale:2});actors.person(c,124+u*5,310,t+.4,{identity:'woman',action:'walk',scale:1.5});actors.person(c,329,286,t,{identity:'traveler',action:'idle',scale:1.2});
    if(u<5)narrativeCard('文明向西','AN AGE OF IRON',35,54);
    c.globalAlpha=.09;R(0,0,W,H,'#b59774');c.globalAlpha=1;
  }
  function pursuit(t,u){
    landscape(t,'night',{scroll:u*16});land(t,'night',u*42,280);
    for(let i=0;i<16;i++)pine(i*59-u*16%59,277+(i%3)*7,.6+(i%4)*.17,'#243f49',false,t);
    actors.horse(c,330+Math.sin(u*.5)*32,290,t,{scale:2.2,rider:'arthur',gait:'gallop',speed:1.07,coat:'bay'});
    actors.horse(c,115+Math.sin(u*.7)*17,279,t+.23,{scale:1.5,rider:'dutch',gait:'gallop',speed:1.02,coat:'black'});
    for(let i=0;i<3;i++){const x=-18+i*56+Math.sin(u*.3+i)*10;actors.horse(c,x,257,t+i*.31,{scale:.65,rider:'traveler',gait:'gallop',coat:'black',dust:false});R(x+11,233,2,3,'#e6c581');}
    for(let i=0;i<9;i++){const x=((i*101-u*85)%950+950)%950-160;pine(x,345,2.7+(i%2)*.7,'#101f28',false,t);}
    if(u<4.3)pixel('THE ROAD HAS NO REAR DOOR',321,72,2,'#c4d6d4','center');
    weather(t,'rain',.35);
  }
  function plan(t,u){
    R(0,0,W,H,'#111d25');for(let i=0;i<8;i++)pine(i*100-30,280,2,'#192c31',false,t);
    land(t,'night',0,278);fire(315,282,t,u>=5.625&&u<6.09375?.45:1.2);
    actors.person(c,181,282,t,{identity:'dutch',action:u<3.6?'point':'idle',scale:4});actors.person(c,460,281,t,{identity:'arthur',action:'idle',scale:3.8,facing:-1});
    const tableY=248;R(264,tableY,124,12,'#79674f');R(271,tableY+12,5,35,'#524e40');R(377,tableY+12,5,35,'#524e40');poly([[267,244],[371,239],[379,249],[275,253]],'#d0b58a');
    for(let i=0;i<6;i++)line(280+i*13,243,286+i*13,249,'#806b54');
    pixel(u<5.625?'ONE MORE CHANCE.':'HOW MANY TOMORROWS?',320,76,2,u<5.625?'#dfb67c':'#b89384','center');
    if(u>6.4)txt('承诺没有变。沉默变长了。',320,111,17,'#bea895');
    if(u>=5.625&&u<6.09375){c.globalAlpha=.48;R(0,0,W,H,'#08121c');c.globalAlpha=1;}
  }
  function escape(t,u){
    sky(t,'storm');mountains(t,{mode:'storm',scroll:u*15});river(t,219);bridge(t,252);
    const tx=((u*91)%1350)-180;train(tx,243,t,1.0);
    poly([[0,315],[100,290],[200,306],[361,298],[462,304],[570,279],[640,283],[640,360],[0,360]],'#354d4b');
    const jump=Math.sin(clamp((u-5.5)/1.15)*Math.PI)*37;
    actors.horse(c,352+Math.sin(u*.6)*27,311-jump,t,{scale:2.25,rider:'arthur',gait:'gallop',speed:1.17,coat:'bay'});
    actors.horse(c,192+Math.sin(u*.4)*22,321-Math.sin(clamp((u-5.85)/1.15)*Math.PI)*25,t+.24,{scale:1.7,rider:'dutch',gait:'gallop',speed:1.1,coat:'black'});
    if(!gentleWeather&&((u>2.9&&u<3.12)||(u>10.45&&u<10.67))){poly([[446,29],[424,78],[441,77],[401,150],[421,92],[406,94]],'#bccad0');}
    weather(t,'rain',.85);
    if(u<3.0)pixel('KEEP MOVING',323,64,3,'#d4d8c9','center');
    for(let i=0;i<8;i++){const p=dust[i];R((p.x-u*170+W*80)%W,286+i*7,20+p.p*23,1,'#496465');}
  }
  function fracture(t,u){
    sky(t,'night');land(t,'night',0,284);tent(64,279,151,87,'#435961');tent(413,276,152,83,'#4a5758');
    pine(39,303,3,'#0d222a',false,t);pine(589,312,3.2,'#10252d',false,t);fire(320,282,t,.9);
    const separation=smooth(0,14,u);
    actors.person(c,225-separation*31,282,t,{identity:'dutch',action:u>5&&u<9?'point':'idle',scale:3.2});
    actors.person(c,417+separation*31,281,t,{identity:'arthur',action:u>10?'walk':'idle',facing:u>10?1:-1,scale:3.2});
    line(320,284,320,355,'#8e664e',1);
    if(u<4.7)narrativeCard('同一团火，两个方向','LOYALTY / CONSCIENCE',70,74,'#c6c0bc');
    else if(u<9.6)pixel('DO YOU STILL BELIEVE?',320,u>=5.625?126:82,2,'#c3b0a1','center');
    else pixel('IN WHO WE WANTED TO BE.',320,126,2,'#aebec2','center');
    for(let i=0;i<25;i++){const p=dust[i];R(270+p.x*.17,305-((u*11+i*8)%83),1,1,'#ad7954');}
  }
  function choice(t,u){
    landscape(t,'dawn');river(t,214);land(t,'night',0,277);
    poly([[0,292],[188,278],[230,284],[174,360],[0,360]],'#2b4243');poly([[330,277],[451,261],[640,284],[640,360],[367,360]],'#2c4645');
    actors.horse(c,500,298,t,{scale:1.8,coat:'bay',gait:'idle',rider:false,dust:false});
    actors.person(c,299,307,t,{identity:'arthur',action:u<5?'journal':u<10?'idle':'reach',scale:3.2});
    const pulse=Math.sin(u*.35)*.5+.5;
    if(u<9){txt('忠诚',153,106,32,'#ac9278');txt('良心',478,106,32,'#c5d2ba');line(190,129,273,186,'#a18c6c');line(422,129,330,186,'#93b7aa');}
    else{txt('你愿意留下些什么？',321,99,27,P.cream);pixel('NOT AN ANSWER. A CHOICE.',321,140,1,'#a6c3bd','center');}
    c.globalAlpha=.06+pulse*.05;poly([[300,185],[361,360],[235,360]],'#edd0a4');c.globalAlpha=1;
    birds(t,36,78,3);
  }
  function rider(t,u){
    landscape(t,'dawn',{scroll:u*10});land(t,'grass',u*27,277);river(t,226);
    poly([[0,292],[244,266],[339,282],[324,360],[0,360]],'#595f47');
    actors.horse(c,250+u*19,293,t,{scale:2.35,rider:'arthur',coat:'bay',gait:'gallop',speed:.96});
    for(let i=0;i<4;i++)actors.horse(c,60+i*42+u*5,254+i*3,t+i*.26,{scale:.7,coat:i%2?'black':'cream',rider:i===0?'dutch':'camp',riderVariant:i,gait:'walk',speed:.9,dust:false});
    birds(t,251,58,12);tree(-25-u*9%210,349,3.6,t,'#243c37');tree(782-u*9%210,345,3.3,t,'#263f36');
    if(u>4.2)txt('一匹马，载不走一个时代。',319,73,23,'#efc994');
    for(let i=0;i<50;i++){const p=dust[i];R((p.x-u*21+W*10)%W,296+p.p*53,2,1,i%3?'#9da47b':'#d1b674');}
  }
  function redemption(t,u){
    landscape(t,'red',{scroll:u*3});land(t,'night',0,283);actors.horse(c,342+u*7,284,t,{scale:1.2,coat:'bay',rider:'arthur',gait:'walk',speed:.68,dust:false});
    birds(t,115,89,6);
    const title=smooth(6.0,8.0,u);
    c.globalAlpha=title;R(0,0,W,H,'#171717');c.globalAlpha=1;
    if(title>.01){
      c.save();c.globalAlpha=title;
      circle(488,121,65,'#a54537',2);poly([[0,253],[118,192],[224,259],[319,213],[446,264],[547,181],[640,234],[640,360],[0,360]],'#713e32');
      actors.horse(c,483,263,t,{scale:2.1,coat:'black',rider:'arthur',gait:'idle',dust:false,facing:-1});
      pixel('RED DEAD',47,82,5,'#efe0ba');pixel('REDEMPTION',47,132,4,'#efe0ba');pixel('II',313,176,4,'#b64e3c');
      txt('荒野大镖客 2',48,186,25,'#efc894','left');pixel('ROCKSTAR GAMES',49,226,1,'#a9967e');
      txt('在一个时代的尽头，认识一个人。',48,249,14,'#d1bca0','left');c.restore();
    }
    if(u>13.5){c.globalAlpha=smooth(13.5,15,u)*.25;R(0,0,W,H,'#050b10');c.globalAlpha=1;}
  }
  const painters={promise,snow,camp,arthur,frontier,city,pursuit,plan,escape,fracture,choice,rider,redemption};
  function transition(t,reduced){
    if(reduced)return;
    const boundary=chapters.slice(1).find(ch=>t>ch.start-.16&&t<ch.start+.34);if(!boundary)return;
    const p=(t-boundary.start+.16)/.5,index=chapters.indexOf(boundary);
    if(index%3===0){for(let i=0;i<12;i++){const q=clamp(p*1.25-i*.018),width=Math.sin(q*Math.PI)*W;R(i%2?W-width:0,i*30,width,31,i%2?'#39282a':'#201f24');}}
    else if(index%3===1){const a=Math.sin(p*Math.PI);c.globalAlpha=a*.75;R(0,0,W,H,'#151d24');for(let i=0;i<40;i++)R(i*17-p*57,0,2,H,'#71615a');c.globalAlpha=1;}
    else{const e=Math.sin(p*Math.PI);R(0,0,W,H*.52*e,'#141a20');R(0,H-H*.52*e,W,H*.52*e,'#141a20');}
  }
  function draw(time,{poster=false,reduced=false}={}){
    const t=clamp(time,0,180),ch=chapters.find(item=>t<item.end)||chapters.at(-1),u=t-ch.start;
    gentleWeather=reduced;
    c.resetTransform();c.globalAlpha=1;c.globalCompositeOperation='source-over';c.imageSmoothingEnabled=false;R(0,0,W,H,P.ink);
    if(poster){promise(2,2,true);return;}
    c.save();
    const beat=60/128,bar=beat*4,shot=Math.floor((u+1e-7)/(bar*2)),hit=Math.exp(-((t/beat)%1)*9);
    const active=['pursuit','escape'].includes(ch.id);
    let zoom=reduced?1:[1,1.037,1.012,1.055,1.024][shot%5]+(active?hit*.008:0),focusX=320,focusY=183;
    if(!reduced&&ch.id==='promise'){zoom=1.16;focusX=u<3.75?286:354;focusY=201;}
    if(!reduced&&ch.id==='plan'&&u<7.5){zoom=1.18;focusX=u<3.75?273:372;focusY=211;}
    if(!reduced&&ch.id==='fracture'&&u>=5.625){zoom=u<9.375?1.34:1.32;focusX=u<9.375?251:394;focusY=215;}
    c.translate(320,183);c.scale(zoom,zoom);c.translate(-focusX+(reduced?0:[0,-4,3,-2,1][shot%5]),-focusY);
    if(active&&!reduced)c.translate(Math.round(Math.sin(t*51)*hit),Math.round(Math.cos(t*43)*hit));
    painters[ch.id](t,u);c.restore();
    transition(t,reduced);
    // Letterbox and edge grain maintain a cinematic frame without obscuring captions.
    R(0,0,W,18,'#101316');R(0,H-15,W,15,'#101316');
    if(!reduced){c.globalAlpha=.05;for(let i=0;i<22;i++){const p=dust[i];R((p.x+Math.floor(t*12)*7)%W,p.y,1,1,'#e2d1b0');}c.globalAlpha=1;}
    R(13,346,614,1,'#504a40');R(13,346,614*t/180,1,'#c18d5c');
  }
  return {draw,snapshot:()=>canvas.toDataURL('image/png'),dimensions:{width:W,height:H},sceneNames:Object.keys(painters)};
}