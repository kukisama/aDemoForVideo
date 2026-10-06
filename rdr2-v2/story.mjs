// New, standalone interpretation. All dialogue and small incidents are original,
// not game quotations or a reconstruction of a canonical mission or ending.
export const TITLE = '明天以西';
export const COLLECTION = '西部2';
export const TAGLINE = '他说他有个计划。亚瑟看向身边的人。';
export const DURATION = 180;
export const BPM = 80;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const TOTAL_BEATS = 240;
export const CHAPTERS = [
  {id:'dust',start:0,end:21,bars:7,name:'风比人先到',tag:'BEFORE TOMORROW',color:'dust'},
  {id:'promise',start:21,end:51,bars:10,name:'第一次，他相信',tag:'A PLACE FOR EVERYONE',color:'amber'},
  {id:'burden',start:51,end:84,bars:11,name:'眼前的事情',tag:'THE WEIGHT OF TODAY',color:'copper'},
  {id:'fraying',start:84,end:114,bars:10,name:'第二次，他停了一下',tag:'THE SAME MAP',color:'blue'},
  {id:'choice',start:114,end:144,bars:10,name:'有人还在后面',tag:'THOSE BEHIND US',color:'rain'},
  {id:'silence',start:144,end:168,bars:8,name:'第三次，换了回答',tag:'WHAT WE PROMISED',color:'ember'},
  {id:'coda',start:168,end:180,bars:4,name:'在明天之前',tag:'WEST OF TOMORROW',color:'dawn'},
];
export const CAPTIONS = [
  {start:4.2,end:8.8,speaker:'序章',text:'1899 年。西部亡命徒的时代，正在走向终结。',kind:'fact',source:'overview'},
  {start:12,end:16.4,speaker:'旁白字幕',text:'而有些人，仍把明天挂在嘴边。',kind:'creative'},
  {start:23,end:26.5,speaker:'达奇',text:'我有个计划。',kind:'dialogue'},
  {start:28,end:32.6,speaker:'达奇',text:'我们会有自己的地方。谁也不必再被留下。',kind:'dialogue'},
  {start:35,end:38.5,speaker:'亚瑟',text:'那就告诉我，从哪儿开始。',kind:'dialogue'},
  {start:43,end:47.5,speaker:'人物',text:'这个帮派，是养大亚瑟·摩根的家。',kind:'fact',source:'overview'},
  {start:53,end:57.2,speaker:'旁白字幕',text:'达奇说起远方。亚瑟收拾眼前。',kind:'creative'},
  {start:61,end:64.6,speaker:'营地成员',text:'亚瑟，轮子又陷住了。',kind:'dialogue'},
  {start:67,end:71.5,speaker:'亚瑟',text:'先把东西卸下来。人别落在后面。',kind:'dialogue'},
  {start:77,end:81.4,speaker:'旁白字幕',text:'他最熟悉的，不是梦想，是把事情做完。',kind:'creative'},
  {start:87,end:90.4,speaker:'达奇',text:'我还有个计划。',kind:'dialogue'},
  {start:93,end:97.3,speaker:'达奇',text:'再往前。到了那里，一切都会好起来。',kind:'dialogue'},
  {start:100,end:104,speaker:'亚瑟',text:'计划不会替我们推车，达奇。',kind:'dialogue'},
  {start:109,end:112.4,speaker:'旁白字幕',text:'这一次，亚瑟没有立刻伸手。',kind:'creative'},
  {start:116,end:120,speaker:'旁白字幕',text:'前面是渡口。身后，还有人没跟上。',kind:'creative'},
  {start:123,end:126.5,speaker:'达奇',text:'路就在前面，亚瑟。',kind:'dialogue'},
  {start:130,end:134.2,speaker:'亚瑟',text:'我看见了。等我把人带过来。',kind:'dialogue'},
  {start:147,end:150.8,speaker:'达奇',text:'相信我。我有个计划。',kind:'dialogue'},
  {start:155,end:160,speaker:'亚瑟',text:'我记得你说过，不留下任何一个人。',kind:'dialogue'},
  {start:171.5,end:175.5,speaker:'尾声',text:'一个时代正在远去。一个人，开始自己决定。',kind:'creative'},
  {start:176.2,end:179.7,speaker:'作品',text:'荒野大镖客 2 · 在明天之前，先看清身边。',kind:'creative'},
];
export const SHOTS = [
  {start:0,end:6,scene:'valley',view:'wide',action:'arrival'},
  {start:6,end:12,scene:'valley',view:'arthur-close',action:'listen'},
  {start:12,end:21,scene:'valley',view:'rider',action:'ride'},
  {start:21,end:30,scene:'camp-warm',view:'dutch-medium',action:'plan-one'},
  {start:30,end:37,scene:'camp-warm',view:'arthur-medium',action:'trust'},
  {start:37,end:43,scene:'camp-warm',view:'map',action:'accept'},
  {start:43,end:51,scene:'camp-warm',view:'wide',action:'together'},
  {start:51,end:59,scene:'trail',view:'wide',action:'convoy'},
  {start:59,end:66,scene:'trail',view:'wagon',action:'stuck'},
  {start:66,end:75,scene:'trail',view:'arthur-medium',action:'push'},
  {start:75,end:84,scene:'trail',view:'wide',action:'release'},
  {start:84,end:93,scene:'camp-cold',view:'dutch-medium',action:'plan-two'},
  {start:93,end:100,scene:'camp-cold',view:'map',action:'offer'},
  {start:100,end:106,scene:'camp-cold',view:'arthur-close',action:'doubt'},
  {start:106,end:114,scene:'camp-cold',view:'two-shot',action:'not-taking'},
  {start:114,end:122,scene:'crossing',view:'wide',action:'water'},
  {start:122,end:129,scene:'crossing',view:'dutch-medium',action:'go-ahead'},
  {start:129,end:137,scene:'crossing',view:'arthur-medium',action:'turn-back'},
  {start:137,end:144,scene:'crossing',view:'wide',action:'help'},
  {start:144,end:153,scene:'camp-night',view:'dutch-close',action:'plan-three'},
  {start:153,end:161,scene:'camp-night',view:'arthur-close',action:'answer'},
  {start:161,end:168,scene:'camp-night',view:'two-shot',action:'fold-map'},
  {start:168,end:174,scene:'valley-dawn',view:'wide',action:'leave'},
  {start:174,end:180,scene:'valley-dawn',view:'title',action:'coda'},
];
export const CUES = [
  {time:0,id:'wind',kind:'ambience'},
  {time:12,id:'hoof',kind:'soft-foley'},
  {time:23,id:'plan-one',kind:'motif'},
  {time:39,id:'paper-accept',kind:'soft-foley'},
  {time:59,id:'wheel',kind:'soft-foley'},
  {time:66,id:'effort',kind:'pulse'},
  {time:75,id:'release',kind:'release'},
  {time:87,id:'plan-two',kind:'motif'},
  {time:106,id:'unanswered',kind:'silence'},
  {time:114,id:'river',kind:'ambience'},
  {time:130,id:'turn-back',kind:'choice'},
  {time:137,id:'hand',kind:'release'},
  {time:147,id:'plan-three',kind:'motif'},
  {time:161,id:'paper-fold',kind:'soft-foley'},
  {time:168,id:'lone-theme',kind:'motif'},
  {time:178.5,id:'fade',kind:'fade'},
];
export const SOURCES = {
  overview:{label:'PlayStation 官方产品页：故事模式公开简介',url:'https://www.playstation.com/en-us/games/red-dead-redemption-2/'},
  gameplay:{label:'PlayStation 官方实机演示出处',url:'https://blog.playstation.com/2018/08/09/watch-the-red-dead-redemption-2-official-gameplay-video/'},
};
export const NOTES = '非官方原创演绎。采用官方公开开篇背景；全部对白、推车、递图与渡口小事件为创作压缩，不是游戏原台词或任务实录，不补写正史结局。音乐旋律、像素人物与环境贴图均为本项目原创，不使用游戏原声、截图或八方旅人素材。';