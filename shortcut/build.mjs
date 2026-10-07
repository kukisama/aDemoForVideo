import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {TITLE,TAGLINE,DURATION,BPM,BEAT,BAR,TOTAL_BEATS,CHAPTERS,SHOTS,CAPTIONS,AUDIO_CUES,SOURCES,NOTES} from './story.mjs';
import {assertTrafficModel} from './traffic.mjs';
import {verifyPrevious} from './protect.mjs';
const dir=fileURLToPath(new URL('./',import.meta.url)),root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>readFileSync(resolve(dir,name),'utf8'),hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const protectedFiles=verifyPrevious(),report=JSON.parse(read('audio/report.json'));
assert.equal(report.duration,DURATION);assert.equal(report.bpm,BPM);assert.equal(report.noVoice,true);assert.equal(report.validation.passed,true);
assert.equal(report.storysha256,hash(resolve(dir,'story.mjs')));assert.equal(report.mastersha256,hash(resolve(dir,'audio/master.mp3')));
assert.equal(DURATION,60);assert.equal(BEAT*TOTAL_BEATS,DURATION);assert.equal(CHAPTERS.reduce((n,ch)=>n+ch.bars,0),32);assertTrafficModel();
for(const spans of [CHAPTERS,SHOTS]){assert.equal(spans[0].start,0);assert.equal(spans.at(-1).end,DURATION);for(let i=0;i<spans.length;i++){assert.ok(spans[i].end>spans[i].start);assert.equal(spans[i].start/BEAT,Math.round(spans[i].start/BEAT));if(i)assert.equal(spans[i-1].end,spans[i].start);}}
for(let i=0;i<CAPTIONS.length;i++){const cue=CAPTIONS[i];assert.ok(cue.start>=0&&cue.end<=DURATION&&cue.end>cue.start);if(i)assert.ok(CAPTIONS[i-1].end<=cue.start);}
const fonts=[['Space Grotesk',400,'space-grotesk/files/space-grotesk-latin-400-normal.woff2'],['Space Grotesk',500,'space-grotesk/files/space-grotesk-latin-500-normal.woff2'],['IBM Plex Mono',400,'ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2']].map(([family,weight,path])=>`@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${readFileSync(resolve(root,'web/node_modules/@fontsource',path)).toString('base64')}) format('woff2')}`).join('\n');
const licenses=['space-grotesk','ibm-plex-mono'].map(name=>{const path=resolve(root,'web/node_modules/@fontsource',name),license=readdirSync(path).find(f=>/^(LICENSE|OFL)/i.test(f));assert.ok(license);return `${name}\n${readFileSync(resolve(path,license),'utf8')}`;}).join('\n\n');
const js=read('traffic.mjs').replace(/^export /gm,'')+'\n'+read('actors.js')+'\n'+read('world.js')+'\n'+read('player.js');
const inline=js.replace(/<\/script/gi,'<\\/script');new Script(inline,{filename:'shortcut-inline.js'});
const data={title:TITLE,tagline:TAGLINE,duration:DURATION,bpm:BPM,beat:BEAT,bar:BAR,chapters:CHAPTERS,shots:SHOTS,captions:CAPTIONS,audioCues:AUDIO_CUES,sources:SOURCES,notes:NOTES};
const html=read('index.template.html').replace('/*__STYLE__*/',()=>fonts+'\n'+read('style.css')).replace('/*__DATA__*/',()=>JSON.stringify(data).replaceAll('<','\\u003c')).replace('/*__SCRIPT__*/',()=>inline);
assert.ok(!html.includes('/*__'));assert.equal((html.match(/<script\b/g)||[]).length,2);assert.ok(!/<(?:video|img)\b/i.test(html));assert.ok(!/speechSynthesis|SpeechSynthesisUtterance|rotate[XY]\(|perspective\(/.test(js));
const finalScript=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];assert.equal(finalScript,inline);new Script(finalScript,{filename:'delivered-shortcut.js'});
const dest=resolve(root,'export/赶路的人');mkdirSync(resolve(dest,'audio'),{recursive:true});writeFileSync(resolve(dir,'SHORTCUT.html'),html);writeFileSync(resolve(dest,'开始观看.html'),html);copyFileSync(resolve(dir,'audio/master.mp3'),resolve(dest,'audio/master.mp3'));writeFileSync(resolve(dest,'FONT-LICENSES.txt'),licenses);
writeFileSync(resolve(dest,'说明.txt'),'赶路的人 · 60秒二维科普故事\n双击「开始观看.html」，再点击「全屏出发」。请保留同级 audio 文件夹；无需联网或安装依赖。\n原创8-bit音乐，只有字幕，无旁白、无HD-2D、无预录视频。\n交通故事采用布雷斯悖论的理想化模型；学习和专业选择属于人生类比，不保证换路必然成功，也不否定努力。知识依据详见片内「说明」。\n空格暂停/继续，左右键跳转一小节，R重播，F全屏，M静音。复制整个目录即可移机，无ZIP。\n');
assert.equal(verifyPrevious(),protectedFiles);
console.log(JSON.stringify({result:'PASS',title:TITLE,duration:DURATION,chapters:CHAPTERS.length,shots:SHOTS.length,captions:CAPTIONS.length,captionSeconds:CAPTIONS.reduce((n,c)=>n+c.end-c.start,0),htmlBytes:Buffer.byteLength(html),entry:resolve(dest,'开始观看.html'),protectedFiles,noVoice:true,no3D:true,mastersha256:report.mastersha256},null,2));