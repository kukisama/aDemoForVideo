import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TITLE,TAGLINE,DURATION,BPM,BEAT,BAR,TOTAL_BEATS,WIDTH,HEIGHT,CHAPTERS,SHOTS,CAPTIONS,ACTION_CUES,HOLDS,SOURCES,FACTS,NOTES} from './story.mjs';

const dir = fileURLToPath(new URL('./',import.meta.url)), root = fileURLToPath(new URL('../',import.meta.url));
const read = name => readFileSync(resolve(dir,name),'utf8');
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const report = JSON.parse(read('audio/report.json'));
assert.equal(report.validation.passed,true); assert.equal(report.noVoice,true); assert.equal(report.music.original,true);
assert.equal(report.duration,DURATION); assert.equal(report.bpm,BPM);
assert.equal(report.storysha256,hash(resolve(dir,'story.mjs')),'台本修改后须重新制作并核验音乐');
assert.equal(report.generatorSha256,hash(resolve(dir,'score.mjs')),'配乐生成器与已核验母带不匹配');
assert.equal(report.mastersha256,hash(resolve(dir,'audio/master.mp3')),'母带与实测报告不匹配');
assert.equal(DURATION,180); assert.equal(TOTAL_BEATS,432); assert.equal(BPM,144);
assert.equal(CHAPTERS.reduce((sum,ch) => sum + ch.bars,0),108);
assert.equal(CHAPTERS.length,15); assert.equal(SHOTS.length,54); assert.equal(ACTION_CUES.length,30);
assert.equal(CHAPTERS.at(-1).end,DURATION); assert.equal(SHOTS.at(-1).end,DURATION);
for (const collection of [CHAPTERS,SHOTS]) {
  for (let i = 0; i < collection.length; i++) {
    const item = collection[i]; assert.ok(item.end > item.start);
    assert.ok(Math.abs(item.start / BEAT - Math.round(item.start / BEAT)) < 1e-8);
    if (i) assert.equal(item.start,collection[i - 1].end,'镜头不可重叠或缺帧');
    else assert.equal(item.start,0);
  }
}
for (let i = 0; i < CAPTIONS.length; i++) {
  const cue = CAPTIONS[i]; assert.ok(cue.start >= 0 && cue.end <= DURATION && cue.end > cue.start);
  assert.equal(cue.original,true); if (cue.kind === 'dialogue') assert.ok(cue.speaker);
  if (i) assert.ok(cue.start >= CAPTIONS[i - 1].end,'字幕不可重叠');
  const readingRate = cue.text.replace(/[\s。！？，、“”——]/g,'').length / (cue.end - cue.start);
  assert.ok(readingRate < 9,`字幕阅读过密：${cue.start}s ${readingRate.toFixed(1)}字/秒`);
}
for (const cue of ACTION_CUES) {
  assert.ok(Math.abs(cue.time - cue.beat * BEAT) < 1e-8);
  assert.ok(CHAPTERS.some(ch => ch.id === cue.chapter && cue.time >= ch.start && cue.time < ch.end));
}
for (const fact of FACTS) assert.ok(SOURCES[fact.source]);
const fonts = [
  ['Space Grotesk',400,'space-grotesk/files/space-grotesk-latin-400-normal.woff2'],
  ['Space Grotesk',500,'space-grotesk/files/space-grotesk-latin-500-normal.woff2'],
  ['IBM Plex Mono',400,'ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2'],
].map(([family,weight,path]) => `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${readFileSync(resolve(root,'web/node_modules/@fontsource',path)).toString('base64')}) format('woff2')}`).join('\n');
const licenses = ['space-grotesk','ibm-plex-mono'].map(name => {
  const folder = resolve(root,'web/node_modules/@fontsource',name), file = readdirSync(folder).find(f => /^(license|ofl)/i.test(f));
  assert.ok(file); return `${name}\n${readFileSync(resolve(folder,file),'utf8')}`;
}).join('\n\n');
const script = ['art-characters.js','world.js','player.js'].map(read).join('\n');
assert.ok(!/speechSynthesis|SpeechSynthesisUtterance|rotate[XY]\(|perspective\(/.test(script + read('style.css')));
const data = {title:TITLE,tagline:TAGLINE,duration:DURATION,bpm:BPM,beat:BEAT,bar:BAR,totalBeats:TOTAL_BEATS,width:WIDTH,height:HEIGHT,
  chapters:CHAPTERS,shots:SHOTS,captions:CAPTIONS,actionCues:ACTION_CUES,holds:HOLDS,sources:SOURCES,facts:FACTS,notes:NOTES};
const html = read('index.template.html')
  .replace('/*__STYLE__*/',fonts + '\n/* Font licenses\n' + licenses.replaceAll('*/','* /') + '\n*/\n' + read('style.css'))
  .replace('/*__DATA__*/',JSON.stringify(data).replaceAll('<','\\u003c'))
  .replace('/*__SCRIPT__*/',script.replaceAll('</script','<\\/script'));
assert.ok(!html.includes('/*__')); assert.ok(!/<(?:img|video)\b/i.test(html));
assert.ok(!/(?:src|href)=["']https?:/i.test(html.replace(/<a\b[^>]*>/g,'')),'不能引入网络播放依赖');
const prior = [
  'export/一念万物/GENESIS.html','export/知识之塔/开始观看.html','export/知识之塔/audio/master.mp3',
  'export/X500/开始观看.html','export/X500/audio/master.mp3','export/西部余烬/开始观看.html','export/西部余烬/audio/master.mp3',
].filter(name => existsSync(resolve(root,name))).map(name => [name,hash(resolve(root,name))]);
const target = resolve(root,'export/奥德赛'); mkdirSync(resolve(target,'audio'),{recursive:true});
writeFileSync(resolve(dir,'ODYSSEY.html'),html); writeFileSync(resolve(target,'开始观看.html'),html);
copyFileSync(resolve(dir,'audio/master.mp3'),resolve(target,'audio/master.mp3'));
writeFileSync(resolve(target,'FONT-LICENSES.txt'),licenses);
writeFileSync(resolve(target,'说明.txt'),[
  '奥德赛 · 无人之名 / 三分钟原创像素史诗',
  '双击「开始观看.html」，点击「开始故事」或「全屏启航」。使用Chrome/Edge，无需联网、服务器或安装依赖。',
  '移机时请复制整个「奥德赛」目录，保留 audio/master.mp3。',
  '180秒 / 15幕 / 54镜头 / 144BPM / 432拍 / 30个原创动作音效。字幕＋原创器乐，没有旁白。',
  '以2026电影公开题材与荷马原著为依据的非官方原创压缩改编，不是电影正片复刻或剧情解说。含原著归乡与识认情节。',
  '对白、动作、画面及配乐均为本片新写/新绘/新合成；未使用电影录音、旋律转写、演员声音、剧照或视频。',
  '空格暂停，左右键跳一小节，R重播，F全屏，M静音。「资料」可看改编来源并开启柔和动效。',
  '强音乐请先调整音量。柔和动效减少镜头冲击、火花和天气密度，不改变故事时序。',
  '角色与影片相关权利归各自权利人。本片与电影官方无关联、无背书。',
].join('\n') + '\n');
for (const [file,expected] of prior) assert.equal(hash(resolve(root,file)),expected,'不得修改已有影片');
assert.equal(hash(resolve(target,'audio/master.mp3')),report.mastersha256);
console.log(JSON.stringify({result:'PASS',title:TITLE,duration:DURATION,bpm:BPM,chapters:CHAPTERS.length,shots:SHOTS.length,
  captions:CAPTIONS.length,actionCues:ACTION_CUES.length,htmlBytes:Buffer.byteLength(html),entry:resolve(target,'开始观看.html'),
  htmlsha256:hash(resolve(target,'开始观看.html')),mastersha256:report.mastersha256,oldFilmsPreserved:true},null,2));