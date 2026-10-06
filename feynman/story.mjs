// Original fictional pixel-art story, not a biographical anecdote or quotation.
export const TITLE = '知识之塔';
export const SUBTITLE = '理解，才是通关密钥';
export const BPM = 150;
export const BEAT = 60 / BPM;
export const TOTAL_BEATS = 144;
export const DURATION = 57.6;
export const CHAPTERS = [
  { id: 'summit', start: 0, end: 6.4, name: '知识之塔', tag: 'THE TOWER', tint: 'blue' },
  { id: 'illusion', start: 6.4, end: 12.8, name: '熟悉的幻觉', tag: 'FALSE CONFIDENCE', tint: 'violet' },
  { id: 'failure', start: 12.8, end: 19.2, name: '解释失败', tag: 'THE FIRST QUESTION', tint: 'red' },
  { id: 'select', start: 19.2, end: 25.6, name: '选一个概念', tag: '01 / PICK ONE IDEA', tint: 'cyan' },
  { id: 'teach', start: 25.6, end: 32, name: '讲给新手', tag: '02 / TEACH IT SIMPLY', tint: 'yellow' },
  { id: 'gaps', start: 32, end: 38.4, name: '补上缺口', tag: '03 / FIND THE GAPS', tint: 'red' },
  { id: 'simplify', start: 38.4, end: 44.8, name: '化繁为简', tag: '04 / MAKE IT CLEAR', tint: 'mint' },
  { id: 'retest', start: 44.8, end: 51.2, name: '再讲一遍', tag: 'THE FINAL CHECK', tint: 'cyan' },
  { id: 'ascend', start: 51.2, end: 57.6, name: '真正的理解', tag: 'UNDERSTANDING UNLOCKED', tint: 'gold' },
];
export const CAPTIONS = [
  { start: .4, end: 3.1, text: '知识之塔，只有一道门。' },
  { start: 3.2, end: 6.25, text: '门上写着：把它讲清楚。' },
  { start: 6.6, end: 9.5, text: '他记下了一百个答案。' },
  { start: 9.6, end: 12.65, text: '却把熟悉，当成了理解。' },
  { start: 13, end: 15.9, text: '孩子问：为什么，二分之一等于四分之二？' },
  { start: 16, end: 19.05, text: '他背出了定义，却没能解释。' },
  { start: 19.4, end: 22.3, text: '这次，他不再试图一次征服整座塔。' },
  { start: 22.4, end: 25.45, text: '第一步：选一个概念，写下你知道的。' },
  { start: 25.8, end: 28.7, text: '第二步：不用术语，讲给新手听。' },
  { start: 28.8, end: 31.85, text: '讲不顺的地方，自己会露出来。' },
  { start: 32.2, end: 35.1, text: '第三步：标出卡壳处，回原资料补课。' },
  { start: 35.2, end: 38.25, text: '这次，他找到了漏掉的前提。' },
  { start: 38.6, end: 41.5, text: '第四步：删掉黑话，用例子重新解释。' },
  { start: 41.6, end: 44.65, text: '同一块饼，切得更细；拿到的量，不变。' },
  { start: 45, end: 47.9, text: '合上书，再讲一遍。' },
  { start: 48, end: 51.05, text: '能回答追问，才算走过这一关。' },
  { start: 51.4, end: 54.3, text: '不是把知识，装进脑海。' },
  { start: 54.4, end: 57.4, text: '是让知识，从你的话里走出来。' },
];
export const CUTS = Array.from({ length: 36 }, (_, i) => i * 1.6);
export const SOURCES = [
  { label: 'Farnam Street：选择概念、简单解释、发现缺口并复习、检验理解', url: 'https://fs.blog/feynman-technique/' },
];
export const NOTES = '费曼学习法的常见实践整理；闯关故事和台词均为原创，不是费曼本人的经历或引语。分数示例基于同一个整体且平均分割，不把简化解释当作严谨证明的替代。';