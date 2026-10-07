// Original allegory. The traffic example is the explicitly idealized Cornell
// textbook model; the closing life reflection is an analogy, not a theorem.
export const TITLE = '赶路的人';
export const TAGLINE = '改变走法，不是放弃抵达。';
export const DURATION = 60;
export const BPM = 128;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const TOTAL_BEATS = 128;
export const CHAPTERS = [
  {id:'wish',name:'再快一点',start:0,end:7.5,bars:4,mood:'hope'},
  {id:'balance',name:'原来的路',start:7.5,end:15,bars:4,mood:'steady'},
  {id:'shortcut',name:'一条近路',start:15,end:22.5,bars:4,mood:'bright'},
  {id:'rush',name:'人人都这么想',start:22.5,end:30,bars:4,mood:'rising'},
  {id:'gridlock',name:'越赶越晚',start:30,end:37.5,bars:4,mood:'pressure'},
  {id:'rethink',name:'换一种走法',start:37.5,end:45,bars:4,mood:'quiet'},
  {id:'release',name:'重新流动',start:45,end:48.75,bars:2,mood:'release'},
  {id:'meaning',name:'路以外的事',start:48.75,end:56.25,bars:4,mood:'warm'},
  {id:'horizon',name:'继续抵达',start:56.25,end:60,bars:2,mood:'open'},
];
export const SHOTS = [
  {id:'courier',start:0,end:3.75,chapter:'wish'},
  {id:'city-reveal',start:3.75,end:7.5,chapter:'wish'},
  {id:'old-network',start:7.5,end:11.25,chapter:'balance'},
  {id:'two-routes',start:11.25,end:15,chapter:'balance'},
  {id:'open-gate',start:15,end:18.75,chapter:'shortcut'},
  {id:'temptation',start:18.75,end:22.5,chapter:'shortcut'},
  {id:'choices',start:22.5,end:26.25,chapter:'rush'},
  {id:'converge',start:26.25,end:30,chapter:'rush'},
  {id:'red-clock',start:30,end:33.75,chapter:'gridlock'},
  {id:'no-solo-escape',start:33.75,end:37.5,chapter:'gridlock'},
  {id:'stop-and-look',start:37.5,end:41.25,chapter:'rethink'},
  {id:'close-gate',start:41.25,end:45,chapter:'rethink'},
  {id:'flow-again',start:45,end:48.75,chapter:'release'},
  {id:'reveal',start:48.75,end:52.5,chapter:'meaning'},
  {id:'study-roads',start:52.5,end:56.25,chapter:'meaning'},
  {id:'keep-going',start:56.25,end:60,chapter:'horizon'},
];
export const CAPTIONS = [
  {start:.65,end:3.4,speaker:'阿禾',text:'再快一点，我就能早点到。',kind:'dialogue'},
  {start:4.15,end:7.1,speaker:'故事',text:'他以为，答案是一条更短的路。',kind:'story'},
  {start:8.0,end:13.2,speaker:'原来的路',text:'两条路，各分一半车流。\n到达终点，都是 65 分钟。',kind:'model'},
  {start:15.65,end:19.1,speaker:'阿禾',text:'这里连起来，不就省时间了？',kind:'dialogue'},
  {start:20.0,end:22.2,speaker:'故事',text:'谁不想，先人一步。',kind:'story'},
  {start:23.2,end:28.3,speaker:'每个人的选择',text:'于是，一个接着一个，\n所有人都选了近路。',kind:'model'},
  {start:30.55,end:33.4,speaker:'阿禾',text:'路更短了，怎么反而更晚？',kind:'dialogue'},
  {start:34.0,end:37.1,speaker:'两段瓶颈',text:'同一个聪明选择，\n让两段窄路承受了全部车流。',kind:'model'},
  {start:38.8,end:41.0,speaker:'阿禾',text:'我能改变的，难道只有速度？',kind:'dialogue'},
  {start:42.1,end:44.6,speaker:'重新选择',text:'他们暂时关掉近路。',kind:'story'},
  {start:45.45,end:48.5,speaker:'重新分流后',text:'少了一条路，反而更早抵达。',kind:'model'},
  {start:49.1,end:51.8,speaker:'布雷斯悖论',text:'各自最快，不一定让大家都更快。',kind:'science'},
  {start:52.6,end:55.9,speaker:'从路网想到人生 · 类比',text:'选专业，学本事，\n别只看哪条路最热闹。',kind:'reflection'},
  {start:56.55,end:59.65,speaker:'继续向前',text:'努力是为了抵达，\n不是为了证明这条路没选错。',kind:'reflection'},
];
export const AUDIO_CUES = {
  gateOpen:15, convergence:22.5, gridlock:30,
  silenceStart:37.5,silenceEnd:38.4375, gateClose:41.25,
  release:45,reveal:48.75,reflection:52.5,fadeStart:59.15,end:60,
};
export const SOURCES = [{
  id:'cornell',label:'Easley & Kleinberg《Networks, Crowds, and Markets》第8章',
  url:'https://www.cs.cornell.edu/home/kleinber/networks-book/networks-book-ch08.pdf',
}];
export const NOTES = [
  '原创寓言，不是现实道路改造案例；人物与城市均为虚构。',
  '模型保持同一批4000辆车：两段窄路耗时x/100分钟，两段外路固定45分钟；新增连接理想化为0分钟。',
  '无近路时均衡各2000辆，耗时65分钟；开放近路后的均衡为全走连接，耗时80分钟；此时单人换回外路约85分钟。',
  '关掉近路并让车流重新分配，才恢复65分钟；不是单个人换路就能在原均衡里变快。',
  '车流迁移过程是示意动画，不是逐车微观交通仿真；故事秒数不是模型行程分钟。',
  '悖论依赖路网、拥堵函数和自主择路等条件，不代表修路必然变慢或封路总有好处。',
  '学习和专业选择是人生类比，不是路网定理的证明；不保证换专业成功，不否定努力或长期坚持。',
  '原创8-bit音乐，无旁白，无原声采样；二维画面，无HD-2D或3D渲染。',
];