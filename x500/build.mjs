import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { DURATION, BPM, CHAPTERS, VOICE_CUES, DISCLAIMER, SOURCES, FACTS } from './story.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = fileURLToPath(new URL('./', import.meta.url));
const read = name => readFileSync(resolve(directory, name), 'utf8');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const report = JSON.parse(read('audio/report.json'));
const captions = JSON.parse(read('audio/captions.json'));
assert.equal(report.provenance.storySha256, hash(resolve(directory, 'story.mjs')), 'Narration must be regenerated after any story edit.');
assert.equal(report.master.sha256, hash(resolve(directory, 'audio/master.mp3')), 'Master audio no longer matches its verified report.');
assert.equal(report.validation.passed, true);
assert.equal(report.master.decodedDuration, 60);
assert.equal(captions.duration, 60);
assert.equal(captions.voices.length, 8);
assert.equal(captions.cues.map(cue => cue.text).join(''), VOICE_CUES.map(cue => cue.text).join(''), 'Captions do not cover the actual authored text.');
assert.equal(FACTS.price, '¥5499');
assert.equal(FACTS.model, 'vivo X500 标准版（V2609A）');
const fonts = [
  { family: 'Space Grotesk', weight: 500, file: 'space-grotesk/files/space-grotesk-latin-500-normal.woff2' },
  { family: 'Space Grotesk', weight: 400, file: 'space-grotesk/files/space-grotesk-latin-400-normal.woff2' },
  { family: 'IBM Plex Mono', weight: 400, file: 'ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2' },
].map(font => {
  const bytes = readFileSync(resolve(root, 'web/node_modules/@fontsource', font.file));
  return `@font-face{font-family:'${font.family}';font-style:normal;font-weight:${font.weight};font-display:swap;src:url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2')}`;
}).join('\n');
const data = { duration: DURATION, bpm: BPM, chapters: CHAPTERS, captions: captions.cues, disclaimer: DISCLAIMER, sources: SOURCES, facts: FACTS };
let html = read('index.template.html')
  .replace('/*__FONTS__*/', fonts)
  .replace('/*__CSS__*/', read('style.css'))
  .replace('/*__DATA__*/', JSON.stringify(data).replaceAll('<', '\\u003c'))
  .replace('/*__JS__*/', read('film.js').replaceAll('</script', '<\\/script'));
assert.ok(!html.includes('/*__'), 'Unexpanded template placeholder');
assert.ok(!/<(?:img|canvas|video)\b/i.test(html), 'The film must be actual HTML/CSS/SVG, not imagery or rendered footage.');
const prior = resolve(root, 'GENESIS.html');
const priorHash = existsSync(prior) ? hash(prior) : null;
writeFileSync(resolve(root, 'X500.html'), html);
const collection = resolve(root, 'X500-观看包');
mkdirSync(resolve(collection, 'audio'), { recursive: true });
writeFileSync(resolve(collection, '开始观看.html'), html.replace('src="x500/audio/master.mp3"', 'src="audio/master.mp3"'));
copyFileSync(resolve(directory, 'audio/master.mp3'), resolve(collection, 'audio/master.mp3'));
writeFileSync(resolve(collection, '使用说明.txt'), '双击「开始观看.html」，点击「全屏 · 开始」。\n请保留 audio 文件夹。无需联网、服务器或安装依赖。\n空格暂停，左右键跳转，R重播，F全屏，M静音。\n介绍vivo X500标准版的非官方创意演绎，参数与条件可点击播放器「资料」查看。\n');
if (priorHash) assert.equal(hash(prior), priorHash, 'The previous film must remain untouched.');
console.log(JSON.stringify({ result: 'PASS', output: resolve(root, 'X500.html'), bytes: Buffer.byteLength(html), collection, duration: DURATION, subtitles: captions.cues.length, voices: VOICE_CUES.length, claims: FACTS, previousFilmPreserved: true }, null, 2));