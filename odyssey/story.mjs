/** Shared editorial contract. All dialogue is newly written; no film dialogue or score is quoted. */
export const TITLE = '奥德赛 · 无人之名';
export const TAGLINE = '所有人都听过他的名字。谁还认得他？';
export const DURATION = 180;
export const BPM = 144;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const TOTAL_BEATS = 432;
export const WIDTH = 640;
export const HEIGHT = 360;

const acts = [
  ['threshold', 4, '门前的陌生人', 'THE STRANGER', 'ash', '一双饱经风浪的手停在家门前；石缝中一片橄榄叶。先提出识认之谜。'],
  ['troy', 8, '城已陷落', 'A WAR IS OVER', 'ember', '燃烧城墙与木马剪影；盾阵掩护撤离，近景格挡，主角回望后转身。'],
  ['fleet', 6, '海的另一边', 'ONE WAY HOME', 'azure', '镜头从青铜船首拉至整支舰队；帆与桨有独立运动，故乡暖色记忆一闪而过。'],
  ['cave', 8, '山睁开了眼', 'THE CYCLOPS', 'ochre', '岩壁不是岩壁：独眼巨人起身，巨石封门；剑不能解决封住出口的重量。'],
  ['cyclops', 12, '无人', 'THE NAME IS NOBODY', 'fire', '递酒与筹谋；巨棍落下、举盾、翻滚、合力举起炽热木桩；冲击以剪影和光遮蔽，羊群掩护脱离。'],
  ['hubris', 6, '海听见了', 'A NAME TOO LOUD', 'storm', '脱险后主角在船尾报出真名；远处巨人呼唤海神，巨石落海，余波变成风暴。'],
  ['sirens', 8, '不能回应的歌', 'THE SIRENS', 'violet', '静得异常的海面，海妖与金色幻象；主角绑在桅杆上，船员塞耳划桨，绳索绷紧。'],
  ['strait', 12, '两种深渊', 'SCYLLA / CHARYBDIS', 'abyss', '俯视漩涡与直插天空的峭壁；六首海兽从洞窟探下，举盾与长矛只能争取划桨的时间，无法消除损失。'],
  ['storm', 10, '最后一条船', 'THE SEA TAKES EVERYTHING', 'cobalt', '旅程与神罚压缩蒙太奇；黑云、雷电、折桅、甲板倾斜，主角抓住绳索又落海，船在浪墙前碎裂。'],
  ['drift', 6, '不再有军队', 'ONE MAN REMAINS', 'moon', '空旷海面只剩一人和残木；水下盔甲沉没，伸手攀上浮木；琴声拾起开场动机。'],
  ['ithaca', 4, '伊萨卡', 'THE SHORE REMEMBERS', 'sage', '漫长漂泊与援助以时间跳切略过；黎明故土，主角披旧斗篷走向被求婚者占据的家。'],
  ['bow', 6, '弓弦认得他的手', 'THE TWELVE AXES', 'bronze', '远近十二斧孔排列；主角检查、上弦、拉满，固定时刻放箭穿孔，身份以行动而非头衔揭示。'],
  ['hall', 8, '守住门口', 'FATHER AND SON', 'gold', '父子与忠诚同伴并肩；箭落、盾挡、剑弧、柱间侧移与反击，火光和尘屑局部爆发，不呈现血腥伤口。'],
  ['root', 6, '最后的试探', 'WHAT CANNOT BE MOVED', 'olive', '佩涅洛佩并不凭战绩认人；一句挪床的试探，镜头穿过石墙，揭出以生根橄榄树做成的床柱。'],
  ['home', 4, '回家的人', 'NO LONGER A STRANGER', 'dawn', '两人相拥，手从武器移到彼此；镜头拉出暖屋与辽阔海岸，远征动机变成家的旋律。'],
];
let cursor = 0;
export const CHAPTERS = acts.map(([id, bars, name, tag, palette, direction]) => {
  const startBeat = cursor;
  cursor += bars * 4;
  return { id, bars, name, tag, palette, direction, startBeat, endBeat:cursor, start:startBeat * BEAT, end:cursor * BEAT };
});

// Explicit shot changes, not one repeated four-state camera cycle. Each scene has its own staging.
const shotPlan = [
  ['threshold', [[0,8,'hands'],[8,16,'door']]],
  ['troy', [[0,8,'city'],[8,16,'shieldwall'],[16,24,'parry'],[24,32,'leave']]],
  ['fleet', [[0,8,'prow'],[8,16,'armada'],[16,24,'horizon']]],
  ['cave', [[0,8,'entrance'],[8,16,'eye'],[16,24,'stone'],[24,32,'sword']]],
  ['cyclops', [[0,8,'wine'],[8,16,'club'],[16,24,'dodge'],[24,32,'stake'],[32,40,'impact'],[40,48,'escape']]],
  ['hubris', [[0,8,'boast'],[8,16,'answer'],[16,24,'boulder']]],
  ['sirens', [[0,8,'island'],[8,16,'illusion'],[16,24,'rope'],[24,32,'oars']]],
  ['strait', [[0,8,'overhead'],[8,16,'cliffs'],[16,24,'heads'],[24,32,'defend'],[32,40,'loss'],[40,48,'passage']]],
  ['storm', [[0,8,'omen'],[8,16,'wall'],[16,24,'deck'],[24,32,'mast'],[32,40,'underwater']]],
  ['drift', [[0,8,'empty'],[8,16,'reach'],[16,24,'stars']]],
  ['ithaca', [[0,8,'shore'],[8,16,'steps']]],
  ['bow', [[0,8,'axes'],[8,16,'draw'],[16,24,'release']]],
  ['hall', [[0,8,'together'],[8,16,'volley'],[16,24,'cross'],[24,32,'quiet']]],
  ['root', [[0,8,'question'],[8,16,'bed'],[16,24,'roots']]],
  ['home', [[0,8,'embrace'],[8,16,'coast']]],
];
export const SHOTS = shotPlan.flatMap(([chapterId, shots]) => {
  const chapter = CHAPTERS.find(c => c.id === chapterId);
  return shots.map(([from,to,name]) => ({ id:`${chapterId}-${name}`, chapter:chapterId, name, start:(chapter.startBeat + from) * BEAT, end:(chapter.startBeat + to) * BEAT }));
});

const cue = (start, end, text, speaker = '', kind = 'narrative') => ({ start, end, text, speaker, kind, original:true });
export const CAPTIONS = [
  cue(.65,3.4,'所有人都听过他的名字。'),
  cue(3.55,6.5,'可站在家门前，他仍是个陌生人。'),
  cue(7.1,11.9,'这一切，要从一座陷落的城说起。'),
  cue(12.15,16.3,'盾举起来！掩护他们上船！','奥德修斯','dialogue'),
  cue(16.7,19.7,'战争结束了。归途才刚开始。'),
  cue(20.5,24.8,'伊萨卡在海的另一边。'),
  cue(25.1,29.6,'那里有人在等他，不是等一个传说。'),
  cue(30.5,34.4,'他们走进洞穴时，以为那是一座山。'),
  cue(34.6,38,'直到山，睁开了眼睛。'),
  cue(38.25,42.9,'杀掉它也没用。谁来推开门口的巨石？'),
  cue(43.7,47.7,'我叫“无人”。先尝尝这杯酒。','奥德修斯','dialogue'),
  cue(48.15,51.9,'别跟它比力气。等它失去警觉。'),
  cue(52.25,55.75,'它低下头时——一起！','奥德修斯','dialogue'),
  cue(57,59.5,'是谁？谁在洞里？','远处的巨人','dialogue'),
  cue(59.7,63,'“无人”的名字，替他们挡住了追兵。'),
  cue(63.75,67.25,'记住！是伊萨卡的奥德修斯！','奥德修斯','dialogue'),
  cue(67.6,70.15,'他忍不住，把胜利刻上自己的名字。'),
  cue(70.35,73,'于是，大海知道该找谁了。'),
  cue(73.7,78,'海妖唱起他的功绩，也唱起他的渴望。'),
  cue(78.3,82.1,'如果我求你们松绑，就把绳子勒得更紧。','奥德修斯','dialogue'),
  cue(82.4,86.3,'这一次，他让同伴替自己守住方向。'),
  cue(87.15,91.2,'左边，是吞船的漩涡。'),
  cue(91.55,95.5,'右边，六个头颅从峭壁探下。'),
  cue(96,100.3,'举盾！不停桨！我们不是来杀死大海的！','奥德修斯','dialogue'),
  cue(101.3,106.2,'他们穿过了海峡。身后，有座位永远空了。'),
  cue(107.1,111.4,'他们又错过岛屿，触犯禁令，耗尽归途。'),
  cue(112.2,116,'最后一条船，也没能越过那道浪。'),
  cue(117.25,120.1,'抓住绳子——','奥德修斯','dialogue'),
  cue(124,127.9,'再没有军队，也没有人呼喊他的名字。'),
  cue(128.3,132.95,'他抓紧一块木头。还得回去。'),
  cue(133.65,136.5,'许多年、许多援手之后，他终于踏上故土。'),
  cue(136.65,139.8,'可他的家，已被别人占据。'),
  cue(140.35,144.2,'没有人认出披着旧斗篷的来客。'),
  cue(144.45,147.7,'他拿起那张无人能拉开的弓。'),
  cue(147.95,149.8,'一箭，穿过十二道斧孔。'),
  cue(150.35,153.5,'父亲。这次我站在你身边。','忒勒马科斯','dialogue'),
  cue(154,158,'不是为另一座城。是为身后的家。'),
  cue(159.4,163.1,'交锋终于停下。她仍没有走近。'),
  cue(163.65,166.55,'把他的床，搬到外面吧。','佩涅洛佩','dialogue'),
  cue(166.75,170,'搬不动的。床柱是那棵活着的橄榄树。','奥德修斯','dialogue'),
  cue(170.2,173.05,'那是他们一起生活过、外人不知道的细节。'),
  cue(173.7,176.8,'她等的从来不是一个战无不胜的人。'),
  cue(177,180,'只是他。终于，回来了。'),
];

// Music and visual effects consume these same absolute markers. Impact never shifts the audio clock.
const hit = (chapterId, beat, id, kind, intensity = 1) => {
  const ch = CHAPTERS.find(c => c.id === chapterId);
  return { id, chapter:chapterId, beat:ch.startBeat + beat, time:(ch.startBeat + beat) * BEAT, kind, intensity };
};
export const ACTION_CUES = [
  hit('troy',10,'shield-meet','shield',.75), hit('troy',18,'bronze-parry','clash'),
  hit('troy',22,'troy-counter','slash',.7), hit('cave',12,'eye-opens','reveal',.7),
  hit('cave',20,'stone-seals','stone'), hit('cyclops',10,'club-falls','stone'),
  hit('cyclops',18,'roll-clear','whoosh',.7), hit('cyclops',26,'stake-lift','rise',.6),
  hit('cyclops',33,'cave-impact','impact'), hit('cyclops',41,'cave-opens','stone',.7),
  hit('hubris',18,'boulder-sea','splash'), hit('sirens',20,'rope-tight','pluck',.5),
  hit('strait',18,'six-heads','reveal',.8), hit('strait',25,'first-block','shield'),
  hit('strait',29,'spear-turn','clash'), hit('strait',33,'second-block','shield',.85),
  hit('strait',39,'empty-oar','impact',.65), hit('storm',10,'wave-wall','rise'),
  hit('storm',17,'deck-hit','splash'), hit('storm',26,'mast-break','crack'),
  hit('storm',33,'underwater-fall','sub'), hit('drift',9,'wood-grip','wood',.45),
  hit('bow',18,'arrow-release','arrow'), hit('bow',19,'twelve-axes','metal',.7),
  hit('hall',4,'father-son-guard','shield'), hit('hall',10,'hall-volley','whoosh',.8),
  hit('hall',14,'hall-parry','clash'), hit('hall',18,'hall-counter','slash'),
  hit('hall',22,'last-shield','shield'), hit('root',12,'root-recognized','bell',.45),
];
export const HOLDS = [{ id:'beneath-the-wave', start:122.5, end:122.5 + BEAT, reason:'落水后缺掉一拍，随即回到孤独拨弦；不是时间轴暂停。' }];

export const SOURCES = {
  film:{ title:'2026 电影官网 · 简介', url:'https://www.odysseymovie.com/synopsis/', accessed:'2026-10-06', supports:'Christopher Nolan执导、改编荷马史诗、神话动作史诗定位及2026-07-17上映；不据此推断具体镜头、台词或结局。' },
  filmHome:{ title:'2026 电影官网 · 当前发行页', url:'https://www.odysseymovie.com/', accessed:'2026-10-06', supports:'页面当前标题标注In Theaters Now，og:site_name为The Odyssey (2026 Movie)。' },
  homer:{ title:'荷马《奥德赛》· 公版原著', url:'https://www.gutenberg.org/ebooks/1727', accessed:'2026-10-06', supports:'古典故事人物、归乡母题和各卷事件；不用它冒充2026电影剧情证据。' },
  text:{ title:'原著全文 · 第九、十二、二十一至二十三卷', url:'https://www.gutenberg.org/cache/epub/1727/pg1727-images.html', accessed:'2026-10-06', supports:'无人之名、报出真名、绑桅穿过海妖、双险海峡、弓与十二斧孔、橄榄树床柱的识认。' },
};
export const FACTS = [
  { source:'film', text:'2026年电影The Odyssey由Christopher Nolan执导，官方称其为改编荷马史诗的神话动作史诗。' },
  { source:'text', text:'无人之名与独眼巨人的事件来自原著第九卷；海妖、斯库拉和卡律布狄斯来自第十二卷。' },
  { source:'text', text:'弓穿十二斧孔来自原著第二十一卷；父子与同伴的宫殿交锋来自第二十二卷。' },
  { source:'text', text:'佩涅洛佩用挪床试探，奥德修斯说出橄榄树床柱的秘密，来自原著第二十三卷。' },
];
export const NOTES = [
  '本片是以2026电影的公开题材和荷马原著为依据的新编像素短片，不是电影正片复刻、剧情解说或官方预告。',
  '为180秒戏剧结构重排、压缩旅程；开场倒叙、全部中文对白、战斗编排、人物造型与视听符号均为本片原创。',
  '含原著归乡与识认情节。未核实电影是否采用这些具体段落，不把原著结局当作电影结局。',
  '8-bit是像素与芯片音色的美术语言，并非对NES硬件色数或声道的仿真。音乐为48kHz立体声原创合成，不使用电影原声录音、旋律转写或演员声音。',
  '神话险境和动作采用非写实、无血腥表现。柔和动效会减少镜头冲击和天气密度；字幕不随世界震动。',
];