// Unofficial creative presentation of the released vivo X500 STANDARD edition.
// Product claims checked against vivo's official pages on 2026-10-06.
export const DURATION = 60;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const CHAPTERS = [
  { id: 'question', start: 0, end: 6, name: '一个问题', english: 'A BETTER QUESTION' },
  { id: 'reveal', start: 6, end: 13, name: '一眼心动', english: 'MEET THE X500' },
  { id: 'design', start: 13, end: 20, name: '质感，自有分寸', english: 'SCULPTED TO FEEL' },
  { id: 'camera', start: 20, end: 29, name: '让远方靠近', english: 'BEYOND WHAT YOU SEE' },
  { id: 'display', start: 29, end: 37, name: '让瞬间，成为电影', english: 'MAKE A MOMENT A MOVIE' },
  { id: 'performance', start: 37, end: 45, name: '底子，要扎实', english: 'POWER BEHIND THE FRAME' },
  { id: 'battery', start: 45, end: 52, name: '电量，不抢戏', english: 'STAY IN THE STORY' },
  { id: 'finale', start: 52, end: 60, name: '让日常，自带电影感', english: 'YOUR LIFE. IN CINEMA.' },
];
export const VOICE_CUES = [
  { at: .4, end: 5.7, text: '朋友们，买手机，难道就是买一张参数表吗？', file: '01-question.mp3' },
  { at: 6.15, end: 12.7, text: '今天看，vivo X五百。它想做的很直接，把电影感，放进我们每天的生活。', file: '02-reveal.mp3' },
  { at: 13.1, end: 19.7, text: '六点五九英寸屏幕，冷雕玻璃，航空铝中框。你看，质感，不一定要靠张扬。', file: '03-design.mp3' },
  { at: 20.1, end: 28.65, text: '五千万主摄，六千四百万蔡司APO长焦，再加三点一倍光学变焦。远处的风景，不必留在远处。', file: '04-camera.mp3' },
  { at: 29.1, end: 36.65, text: '不止照片。四K，一百二十帧慢动作。普通的一瞬间，换个速度，就有了电影的味道。', file: '05-display.mp3' },
  { at: 37.1, end: 44.65, text: '再看底子，三纳米天玑九千六百M，搭配OriginOS七。把复杂交给技术，把顺手留给日常。', file: '06-performance.mp3' },
  { at: 45.1, end: 51.7, text: '七千五百毫安时，九十瓦有线，四十瓦无线。出去拍照，别让电量，抢了风景的戏。', file: '07-battery.mp3' },
  { at: 52.1, end: 59.7, text: '最后看价格。十二加二百五十六G，官方建议价，五千四百九十九元。vivo X五百，让日常，自带电影感。', file: '08-finale.mp3' },
];
export const DISCLAIMER = '非官方创意演绎 · 参数来自 vivo 官网 · 几何画面非实拍';
export const SOURCES = {
  specs: 'https://www.vivo.com.cn/vivo/param/x500',
  product: 'https://www.vivo.com.cn/vivo/x500/',
  announcement: 'https://www.vivo.com.cn/brand/news/detail?id=1393&type=0',
  shop: 'https://shop.vivo.com.cn/product/10062330',
};
export const FACTS = {
  model: 'vivo X500 标准版（V2609A）', checked: '2026-10-06',
  display: '6.59 英寸 AMOLED · 2750 × 1260 · 最高 144Hz',
  main: '5000 万像素蔡司高动态主摄', telephoto: '6400 万像素蔡司 APO 超级长焦', opticalZoom: '3.1×',
  video: '4K 120fps 慢动作', processor: '天玑 9600M · 3nm', os: 'OriginOS 7',
  battery: '7500mAh 典型容量', wired: '90W', wireless: '至高 40W',
  price: '¥5499', priceVersion: '12GB + 256GB 官方建议零售价',
};