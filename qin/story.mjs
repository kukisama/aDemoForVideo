// Original historical fiction. The first-person words are NOT historical quotations.
export const TITLE = '门外';
export const SUBTITLE = '秦始皇 · 第一人称像素史诗';
export const DURATION = 180;
export const BPM = 120;
export const BEAT = .5;
export const BAR = 2;
export const TOTAL_BEATS = 360;
export const NOTES = '基于秦代历史的原创第一人称文学独白，并非秦始皇原话。心理、对话、宫门与身后回望属于创作；场景是二维像素艺术，不是考古复原。结尾不代表秦始皇真实悔悟，也不以历史贡献抵消徭役与思想控制的代价。';
export const CHAPTERS = [
  ['gate',0,12,'宫门','玄黑 / 一线金','低鼓与叩门；未完成的五音主题'],
  ['boy',12,24,'高处','月蓝 / 冷玉','主题低八度，孤立拨弦'],
  ['campaign',24,42,'六道门','铁青 / 朱砂','鼓组递进，五音主旋律第一次完整出现'],
  ['throne',42,54,'始皇帝','玄黑 / 赤金','宽音域主题、钟声与长音'],
  ['script',54,66,'同一个字','墨色 / 竹黄','短促脉冲与对答，书写动作卡点'],
  ['measure',66,78,'同一杆秤','青铜 / 玉绿','三角波低音、金属音、切分节奏'],
  ['road',78,90,'车辙','晨金 / 远青','主题扩展，行进八分音符'],
  ['wall',90,102,'肩上','黄土 / 暮红','主题减半、夯筑重音、拉开强弱'],
  ['edict',102,114,'无声','暗红 / 灰烬','旋律截断，低音悬置'],
  ['sea',114,126,'雾中','深蓝 / 月白','稀疏五音变体、海风噪声与远钟'],
  ['clay',126,138,'地下','陶褐 / 冷青','低八度主题复现，进行曲转为凝固的和声'],
  ['curtain',138,150,'车帘','暗金 / 深黑','心跳式低鼓逐渐抽空'],
  ['after',150,162,'回声','土灰 / 草青','留白后单音重生；身后回望为文学想象'],
  ['dawn',162,180,'门外','青绿 / 日金','由D小调色彩转F大调，旧主题重新配和声，末尾留长音'],
].map(([id,start,end,name,palette,music])=>({id,start,end,name,palette,music}));

export const SHOTS = [
  ['latch','gate',0,4.5,'第一视角：手推沉重门闩；铜钉由近向远'],
  ['seam','gate',4.5,12,'极暗宫门的细光；无人出现，脚步仍在'],
  ['small-hands','boy',12,17,'少年双手握住过大的扶手'],
  ['court','boy',17,24,'视点从双手抬到绵延的廊柱与群臣'],
  ['drums','campaign',24,28,'手压沙盘；六面印牌先后立起'],
  ['banners','campaign',28,34,'队列行进、战车车轮与旗海，非血腥战斗'],
  ['six-gates','campaign',34,42,'六道关门依次开启，远处山河显露'],
  ['stairs','throne',42,46.5,'第一视角登阶，持节官员两侧退开'],
  ['seal','throne',46.5,54,'双手按下印章，画面拉至宏大宫阙'],
  ['bamboo','script',54,59,'指尖铺开竹简、执笔、落笔'],
  ['one-script','script',59,66,'不同书写印象汇拢，主角手把简册递出'],
  ['balance','measure',66,71,'手放青铜砝码；两端秤盘实际回正'],
  ['coins','measure',71,78,'圆形方孔钱落下；标准器从近景延伸到工坊'],
  ['tracks','road',78,83,'从车前第一视角看车辙向地平线展开'],
  ['crossing','road',83,90,'驿路与桥梁、商旅和携简的信使相遇'],
  ['rampart','wall',90,97,'黄土山脊上层层夯土墙；非明代砖石长城'],
  ['shoulders','wall',97,102,'停在劳作者肩与手，夯杵落下后扬尘'],
  ['decree','edict',102,107.5,'手上的诏书与远处熄灭的书房灯'],
  ['empty-court','edict',107.5,114,'再看同一座朝堂：所有人低头，无人应答'],
  ['shore','sea',114,119.5,'皇帝的手拨开帘子，看向苍茫海岸'],
  ['ships','sea',119.5,126,'船帆、划桨与雾墙；不画真实仙山'],
  ['kiln','clay',126,131.5,'工匠为陶俑合拢双手、雕出甲片'],
  ['silent-host','clay',131.5,138,'由一张陶俑面孔拉开至层层军阵'],
  ['carriage','curtain',138,144,'车帘与指尖回到开场构图，风推动帘角'],
  ['falling-hand','curtain',144,150,'手缓缓垂下，光线变窄，声音抽空'],
  ['absence','after',150,153,'门闩仍在；门后的高位空了'],
  ['erosion','after',153,162,'同一座宫阙风化，草从石缝长出'],
  ['market','dawn',162,167,'重见道路，镜头不再站在高台'],
  ['child','dawn',167,174,'普通人把写好的字递给孩子；同一主题变亮'],
  ['open-door','dawn',174,180,'开场那扇门敞开；人走向晨光，高位留在身后'],
].map(([id,chapter,start,end,action])=>({id,chapter,start,end,action}));

// One complete utterance per cue, with intentional instrumental breathing room.
// Audio production must fit without truncating a word; no runtime cloud TTS.
export const VOICE_CUES = [
  [1.0,5.5,'把门关上。再关紧一点。'],
  [6.6,11.7,'可门外的脚步，为什么还在？'],
  [13.0,18.8,'我从少年时，就坐在这高处。'],
  [19.2,23.7,'脚下，是我还不懂的天下。'],
  [25.0,30.6,'那时，我的国门之外，还有六国的高墙。'],
  [33.0,39.3,'我以为，只要推开它们，就再没有什么能挡住我。'],
  [43.0,47.6,'后来，他们叫我，始皇帝。'],
  [48.5,53.5,'我要这个名字，传到万世。'],
  [55.0,62.4,'我让不同的文字，写成同一种模样。'],
  [67.0,74.5,'让一尺有一尺的准，一斤有一斤的重。'],
  [79.0,85.6,'让车辙越过旧日的关口，连向远方。'],
  [91.0,96.4,'可诏书上的一笔，落到人间，就是一生。'],
  [97.0,101.6,'墙在长高。有人，再没回家。'],
  [103.0,107.8,'我容不下，反对我的声音。'],
  [108.7,113.4,'天下越安静，那脚步，越清楚。'],
  [115.1,120.7,'他们说，海的尽头，有不死之药。'],
  [121.4,125.7,'船进了雾。雾，没有回答。'],
  [127.0,132.8,'而骊山之下，另一个天下早已在成形。'],
  [133.3,137.6,'可陶土的兵，守得住什么？'],
  [138.6,143.7,'最后一次巡行，我没能回到咸阳。'],
  [144.1,148.0,'不是刺客，也不是叛军。'],
  [149.1,151.8,'是时间。'],
  [153.0,158.8,'我想要万世。我的王朝，却没能走多远。'],
  [159.0,163.7,'功与过，都不能替我活下去。'],
  [165.0,172.4,'可同一个字，仍能让陌生的人，读懂彼此。'],
  [173.2,179.5,'天下，不必永远属于我。它要有自己的明天。'],
].map(([at,end,text],i)=>({id:`v${String(i+1).padStart(2,'0')}`,at,end,text}));

export const AUDIO_CUES = {
  openingKnocks:[.5,2.5,6,10], unified:42, seal:48, writing:56.2, balance:68,
  road:78, tamping:[92,94,96,98,100], silenceStart:148.5, silenceEnd:150.5,
  revelation:149.1, harmonicTurn:162, openDoor:174, fadeStart:178.8, end:180,
};
export const SOURCES = [
  {label:'大都会艺术博物馆：秦代的统一、标准化与陶俑',url:'https://www.metmuseum.org/essays/qin-dynasty-221-206-b-c',kind:'museum'},
  {label:'World History Encyclopedia：始皇生平与统一年表',url:'https://www.worldhistory.org/Shi_Huangdi/',kind:'read'},
  {label:'World History Encyclopedia：秦王朝与统治代价',url:'https://www.worldhistory.org/Qin_Dynasty/',kind:'read'},
  {label:'World History Encyclopedia：陶俑与早期即开工的陵墓',url:'https://www.worldhistory.org/Terracotta_Army/',kind:'read'},
  {label:'World History Encyclopedia：秦代边墙与明代长城的区别',url:'https://www.worldhistory.org/Great_Wall_of_China/',kind:'read'},
];

export function validateStory() {
  if(DURATION!==180 || TOTAL_BEATS*BEAT!==DURATION) throw new Error('Timing contract');
  for(const list of [CHAPTERS,SHOTS]) {
    if(list[0].start!==0 || list.at(-1).end!==DURATION) throw new Error('Incomplete timeline');
    list.forEach((x,i)=>{if(x.end<=x.start || (i && x.start!==list[i-1].end)) throw new Error(`Timeline gap: ${x.id}`);});
  }
  for(const s of SHOTS) {
    const c=CHAPTERS.find(c=>c.id===s.chapter);
    if(!c || s.start<c.start || s.end>c.end) throw new Error(`Shot outside chapter: ${s.id}`);
  }
  VOICE_CUES.forEach((v,i)=>{if(v.at<0 || v.end>DURATION || v.end<=v.at || (i&&v.at<VOICE_CUES[i-1].end)) throw new Error(`Voice overlap: ${v.id}`);});
  return true;
}