import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {TITLE,SUBTITLE,DURATION,BPM,BEAT,BAR,CHAPTERS,SHOTS,VOICE_CUES,AUDIO_CUES,NOTES,SOURCES,validateStory} from './story.mjs';
import {verifyPrevious} from './protect.mjs';
import {prepareFonts,fontText} from './fonts.mjs';
const dir=fileURLToPath(new URL('./',import.meta.url)),root=fileURLToPath(new URL('../',import.meta.url));
const read=n=>readFileSync(resolve(dir,n),'utf8'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hash=n=>sha(readFileSync(resolve(dir,n))),protectedFiles=verifyPrevious();
validateStory();const report=JSON.parse(read('audio/report.json')),captionData=JSON.parse(read('audio/captions.json'));
assert.equal(report.duration,DURATION);assert.equal(report.bpm,BPM);assert.equal(report.validation.passed,true);
for(const [field,path] of [['storysha256','story.mjs'],['scoreSha256','score.mjs'],['mastersha256','audio/master.mp3'],['musicsha256','audio/music.mp3'],['captionSha256','audio/captions.json']])assert.equal(report[field],hash(path),`Stale ${field}`);
assert.equal(captionData.duration,DURATION);assert.equal(captionData.cues.length,VOICE_CUES.length);
captionData.cues.forEach((c,i)=>{const v=VOICE_CUES[i];assert.equal(c.text,v.text);assert.equal(c.start,v.at);assert.ok(c.end<=v.end&&c.end>c.start);if(i)assert.ok(c.start>=captionData.cues[i-1].end);});
// Keep the one-line literary sentences long enough to read when using music-only mode.
const captions=captionData.cues.map((c,i)=>({...c,end:Math.min(VOICE_CUES[i].end,Math.max(c.end,c.start+3.2,[...c.text].length/5+c.start))}));
const fontManifest=await prepareFonts();assert.equal(fontManifest.textSha256,sha(fontText()));
const fontCss=fontManifest.fonts.map(f=>`@font-face{font-family:'Qin Serif';font-style:normal;font-weight:${f.weight};font-display:swap;src:url(data:font/${f.format==='truetype'?'ttf':f.format};base64,${readFileSync(resolve(dir,'assets',f.file)).toString('base64')}) format('${f.format}');}`).join('\n');
const script=['art.js','world.js','player.js'].map(read).join('\n').replace(/<\/script/gi,'<\\/script');new Script(script,{filename:'qin-inline.js'});
const data={title:TITLE,subtitle:SUBTITLE,duration:DURATION,bpm:BPM,beat:BEAT,bar:BAR,chapters:CHAPTERS,shots:SHOTS,captions,audioCues:AUDIO_CUES,notes:NOTES,sources:SOURCES,
  sourceNote:'博物馆正文已在浏览器核读；对资料中关于即位年龄、死因等存在分歧的细节不作确定性复述。不把水银致死说成已证实事实，不展示尚未发掘的墓室内部。',
  fontCredit:'中文内嵌字体：Noto Serif SC，SIL Open Font License 1.1；仅内嵌本片所需字形。完整许可随交付提供。'};
const html=read('index.template.html')
  .replace('/*__STYLE__*/',()=>fontCss+'\n'+read('style.css'))
  .replace('/*__DATA__*/',()=>JSON.stringify(data,null,2).replaceAll('<','\\u003c'))
  .replace('/*__SCRIPT__*/',()=>script);
assert.ok(!html.includes('/*__'));assert.equal((html.match(/<script\b/g)||[]).length,2);
assert.ok(!/<(?:video|iframe)\b|<script[^>]+src=/i.test(html));assert.ok(!/speechSynthesis|new WebSocket|fetch\(/.test(script));
assert.ok(!/data:audio\//i.test(html),'Audio must remain in independent files');
const audioPaths=['audio/master.mp3','audio/music.mp3'];
assert.deepEqual([...html.matchAll(/<audio\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]),audioPaths);
const final=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];assert.equal(final,script);new Script(final);
const dest=resolve(root,'export/秦始皇');mkdirSync(dest,{recursive:true});mkdirSync(resolve(dir,'output'),{recursive:true});
mkdirSync(resolve(dest,'audio'),{recursive:true});
for(const path of audioPaths){copyFileSync(resolve(dir,path),resolve(dest,path));assert.equal(sha(readFileSync(resolve(dest,path))),hash(path),`Audio copy mismatch: ${path}`);}
const license=read('assets/OFL.txt');
const credited=html.replace('</body>',()=>`<!-- Font license: Noto Serif SC\n${license.replaceAll('--','—')}\n-->\n</body>`);
writeFileSync(resolve(dir,'QIN.html'),credited);writeFileSync(resolve(dest,'开始观看.html'),credited);
writeFileSync(resolve(dest,'FONT-LICENSES.txt'),license);
writeFileSync(resolve(dest,'说明.txt'),'门外 · 秦始皇第一人称像素史诗\n\n时长：180秒。原创二维8-bit动画、原创芯片配乐、通用男声文学独白与字幕。\n双击「开始观看.html」，用Chrome或Edge打开，再点「全屏入场」。\n音频是独立文件，不再将音频Base64写入HTML正文；画面代码、字体和说明仍在HTML中。\n请复制整个「秦始皇」文件夹，保留同级audio目录，无需联网或服务器。\naudio/master.mp3：旁白与配乐混音；audio/music.mp3：纯配乐。不要只复制HTML。\n\n播放控制：空格暂停/继续；左右键前后5秒；R重播；F全屏；M静音；V切换人声/纯配乐。\n「说明」中可开关字幕及柔和动效。浏览器报告页面隐藏时会自动暂停；若未报告，请用空格暂停。\n\n本片是基于历史的原创文学作品，不是秦始皇原话或自传；身后回望为文学想象。\n资料边界与来源见片内说明。不是考古复原，不使用现成游戏素材、影视音乐或声音克隆。\n\n无ZIP、无MP4。原有作品保持不变。字体许可已内嵌，另附FONT-LICENSES.txt便于查阅。\n');
assert.equal(verifyPrevious(),protectedFiles);
const result={result:'PASS',title:TITLE,entry:resolve(dest,'开始观看.html'),duration:DURATION,chapters:CHAPTERS.length,shots:SHOTS.length,captions:captions.length,captionSeconds:captions.reduce((n,c)=>n+c.end-c.start,0),bytes:Buffer.byteLength(credited),singleFile:false,embeddedTracks:0,externalAudio:audioPaths,embeddedFonts:fontManifest.fonts.length,protectedFiles,sha256:sha(credited),storysha256:report.storysha256};
writeFileSync(resolve(dir,'output/build.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));