// Unofficial, original dramatic interpretation of RDR2's officially published premise.
// Dialogue is authored for this short, NOT a verbatim quotation or a new canonical scene.
export const TITLE = '西部余烬';
export const TAGLINE = '一匹马，载不走一个时代。';
export const DURATION = 180;
export const BPM = 128;
export const BEAT = 60 / BPM;
export const TOTAL_BEATS = 384;
export const BAR = BEAT * 4;
export const CHAPTERS = [
  { id:'promise', start:0, end:7.5, name:'最后一票', tag:'ONE MORE TOMORROW', bars:4, palette:'ember' },
  { id:'snow', start:7.5, end:22.5, name:'风雪中的逃亡', tag:'AMERICA / 1899', bars:8, palette:'snow' },
  { id:'camp', start:22.5, end:37.5, name:'篝火另一边', tag:'A PLACE CALLED HOME', bars:8, palette:'amber' },
  { id:'arthur', start:37.5, end:56.25, name:'替人背负的人', tag:'ARTHUR MORGAN', bars:10, palette:'copper' },
  { id:'frontier', start:56.25, end:67.5, name:'世界仍然辽阔', tag:'THE OPEN COUNTRY', bars:6, palette:'sage' },
  { id:'city', start:67.5, end:82.5, name:'文明向西', tag:'AN AGE OF IRON', bars:8, palette:'smoke' },
  { id:'pursuit', start:82.5, end:97.5, name:'身后的脚步', tag:'NOWHERE TO STAND STILL', bars:8, palette:'storm' },
  { id:'plan', start:97.5, end:108.75, name:'又一个明天', tag:'THE SAME PROMISE', bars:6, palette:'red' },
  { id:'escape', start:108.75, end:123.75, name:'马蹄与雷声', tag:'HOLD THE LINE', bars:8, palette:'storm' },
  { id:'fracture', start:123.75, end:138.75, name:'同一团火，两个方向', tag:'LOYALTY / CONSCIENCE', bars:8, palette:'violet' },
  { id:'choice', start:138.75, end:153.75, name:'选择的重量', tag:'WHAT WILL YOU CARRY?', bars:8, palette:'teal' },
  { id:'rider', start:153.75, end:165, name:'黎明前的骑手', tag:'THE LAST OPEN ROAD', bars:6, palette:'dawn' },
  { id:'redemption', start:165, end:180, name:'救赎', tag:'BEYOND THE FRONTIER', bars:8, palette:'gold' },
];
export const CAPTIONS = [
  { start:.55,end:3.65,speaker:'达奇 · 创意改写',text:'再做最后一票，我们就能离开。',kind:'dialogue' },
  { start:3.95,end:7.3,speaker:'亚瑟 · 创意改写',text:'你说的是明天。可明天，究竟在哪？',kind:'dialogue' },
  { start:8,end:12.6,speaker:'序章',text:'1899 年。西部的时代，正在走向终结。',kind:'fact',source:'overview' },
  { start:13,end:17.3,speaker:'序章',text:'黑水镇行动失手，范德林德帮被迫逃亡。',kind:'fact',source:'overview' },
  { start:17.7,end:22.3,speaker:'旁白字幕',text:'风雪抹掉脚印，却抹不掉身后的追踪。',kind:'creative' },
  { start:23,end:27.35,speaker:'旁白字幕',text:'对于外面的人，他们是一群亡命徒。',kind:'fact',source:'overview' },
  { start:27.7,end:32,speaker:'旁白字幕',text:'对于亚瑟，这个帮派，却是养大他的家。',kind:'fact',source:'overview' },
  { start:32.4,end:37.3,speaker:'达奇 · 创意改写',text:'只要我们还围着这团火，就没有人被留下。',kind:'dialogue' },
  { start:38,end:42.3,speaker:'人物',text:'亚瑟·摩根。这个故事，从他的肩上开始。',kind:'fact',source:'overview' },
  { start:42.7,end:47,speaker:'亚瑟 · 创意改写',text:'你负责指向远方。我负责把大家带过去。',kind:'dialogue' },
  { start:47.4,end:51.8,speaker:'旁白字幕',text:'可是一个人，能替多少人背负明天？',kind:'creative' },
  { start:52.2,end:56.05,speaker:'亚瑟 · 创意改写',text:'我不是没有怀疑。我只是一直没有问出口。',kind:'dialogue' },
  { start:56.7,end:61.7,speaker:'旷野',text:'它给你的，不只有故事，还有一个辽阔的西部。',kind:'fact',source:'overview' },
  { start:62.1,end:67.3,speaker:'旁白字幕',text:'风越过山脊。河水向前。而你，可以暂时停下来。',kind:'creative' },
  { start:68,end:72.3,speaker:'旁白字幕',text:'可世界不会为了谁，一直停在从前。',kind:'creative' },
  { start:72.7,end:77.05,speaker:'旁白字幕',text:'铁轨向远方延伸，旧日的自由却越来越窄。',kind:'creative' },
  { start:77.45,end:82.3,speaker:'达奇 · 创意改写',text:'他们叫这进步。我只听见，门一扇扇关上。',kind:'dialogue' },
  { start:83,end:87.3,speaker:'追踪',text:'联邦探员与赏金猎人，始终紧追不舍。',kind:'fact',source:'overview' },
  { start:87.7,end:92.1,speaker:'亚瑟 · 创意改写',text:'再往前一点。别回头看，先看清脚下的路。',kind:'dialogue' },
  { start:92.5,end:97.3,speaker:'旁白字幕',text:'每一次逃离，看起来都像重新开始。',kind:'creative' },
  { start:98,end:101.35,speaker:'达奇 · 创意改写',text:'再给我一次机会。最后一次。',kind:'dialogue' },
  { start:101.7,end:105.05,speaker:'亚瑟 · 创意改写',text:'我们已经用多少个今天，换这个明天了？',kind:'dialogue' },
  { start:105.4,end:108.55,speaker:'旁白字幕',text:'没有人回答。只有篝火，忽然矮了一截。',kind:'creative' },
  { start:109.2,end:113.6,speaker:'亚瑟 · 创意改写',text:'抓紧。桥的那一边，还得有人先到。',kind:'dialogue' },
  { start:114,end:118.3,speaker:'旁白字幕',text:'马蹄追着雷声，列车把黑夜分成两半。',kind:'creative' },
  { start:118.7,end:123.55,speaker:'亚瑟 · 创意改写',text:'我能带你们穿过风暴。可谁来告诉我方向？',kind:'dialogue' },
  { start:124.2,end:128.5,speaker:'裂痕',text:'比追踪更危险的，是帮派内部不断加深的分歧。',kind:'fact',source:'overview' },
  { start:128.9,end:133.3,speaker:'达奇 · 创意改写',text:'你还相信我吗，亚瑟？',kind:'dialogue' },
  { start:133.7,end:138.55,speaker:'亚瑟 · 创意改写',text:'我相信我们曾经想成为的人。',kind:'dialogue' },
  { start:139.2,end:143.55,speaker:'抉择',text:'个人的理想，还是对养大自己的帮派的忠诚？',kind:'fact',source:'overview' },
  { start:143.95,end:148.3,speaker:'亚瑟 · 创意改写',text:'如果忠诚要我丢掉良心，那我究竟忠于什么？',kind:'dialogue' },
  { start:148.7,end:153.55,speaker:'旁白字幕',text:'这不是替亚瑟宣布答案，而是邀请你走进他的选择。',kind:'creative' },
  { start:154.2,end:159.1,speaker:'亚瑟 · 创意改写',text:'我追了半生的自由。也许，先要学会放下一点。',kind:'dialogue' },
  { start:159.5,end:164.8,speaker:'旁白字幕',text:'一匹马，载不走一个时代。却能载着一个人，继续向前。',kind:'creative' },
  { start:165.5,end:170.1,speaker:'尾声',text:'你以为自己要去征服西部。',kind:'creative' },
  { start:170.5,end:175,speaker:'尾声',text:'它却问你：当旧世界远去，你愿意留下些什么？',kind:'creative' },
  { start:175.4,end:179.7,speaker:'作品',text:'荒野大镖客 2——在一个时代的尽头，认识一个人。',kind:'creative' },
];
export const SOURCES = {
  overview:{label:'PlayStation 官方产品页：故事模式概述',url:'https://www.playstation.com/en-us/games/red-dead-redemption-2/'},
  gameplay:{label:'PlayStation 官方博客：Rockstar 游戏实机演示出处',url:'https://blog.playstation.com/2018/08/09/watch-the-red-dead-redemption-2-official-gameplay-video/'},
};
export const FACTS = {year:1899,lead:'Arthur Morgan / 亚瑟·摩根',gang:'Van der Linde gang / 范德林德帮',premise:'黑水镇行动失手后逃亡；外部追踪与内部分歧；个人理想与帮派忠诚的冲突',scope:'故事模式官方简介层级，不涉及主要结局'};
export const NOTES = '非官方像素创意介绍。对白为本片原创改写，不是游戏原台词；镜头为创意蒙太奇，非游戏实录、非特定任务逐镜重现。只采用官方公开开篇设定，不讲述人物重大后续命运，不包含线上模式专属职业。音乐完全原创，不改编游戏原声。';