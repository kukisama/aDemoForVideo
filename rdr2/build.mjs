import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TITLE,TAGLINE,DURATION,BPM,BEAT,TOTAL_BEATS,BAR,CHAPTERS,CAPTIONS,SOURCES,FACTS,NOTES} from './story.mjs';
const dir=fileURLToPath(new URL('./',import.meta.url)),root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>readFileSync(resolve(dir,name),'utf8'),hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const report=JSON.parse(read('audio/report.json'));
assert.equal(report.validation.passed,true);assert.equal(report.noVoice,true);assert.equal(report.duration,180);assert.equal(report.bpm,BPM);
assert.equal(report.storysha256,hash(resolve(dir,'story.mjs')),'Story changed after music creation');assert.equal(report.mastersha256,hash(resolve(dir,'audio/master.mp3')),'Master differs from verified audio');
assert.equal(DURATION/BEAT,TOTAL_BEATS);assert.equal(CHAPTERS.reduce((sum,ch)=>sum+ch.bars,0),96);
for(let i=0;i<CHAPTERS.length;i++){const ch=CHAPTERS[i];assert.equal((ch.end-ch.start)/BAR,ch.bars);if(i)assert.equal(CHAPTERS[i-1].end,ch.start);}
for(const cue of CAPTIONS){assert.ok(cue.start>=0&&cue.end<=180&&cue.end>cue.start);if(cue.kind==='dialogue')assert.ok(cue.speaker.includes('创意改写'));if(cue.kind==='fact')assert.ok(SOURCES[cue.source]);}
const fonts=[['Space Grotesk',400,'space-grotesk/files/space-grotesk-latin-400-normal.woff2'],['Space Grotesk',500,'space-grotesk/files/space-grotesk-latin-500-normal.woff2'],['IBM Plex Mono',400,'ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2']].map(([family,weight,path])=>`@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${readFileSync(resolve(root,'web/node_modules/@fontsource',path)).toString('base64')}) format('woff2')}`).join('\n');
const licenses=['space-grotesk','ibm-plex-mono'].map(name=>{const folder=resolve(root,'web/node_modules/@fontsource',name),file=readdirSync(folder).find(f=>/^(license|ofl)/i.test(f));assert.ok(file);return `${name}\n${readFileSync(resolve(folder,file),'utf8')}`;}).join('\n\n');
const script=read('art-characters.js')+'\n'+read('world.js')+'\n'+read('player.js');
assert.ok(!/speechSynthesis|SpeechSynthesisUtterance|rotate[XY]\(|perspective\(/.test(script+read('style.css')));
const data={title:TITLE,tagline:TAGLINE,duration:DURATION,bpm:BPM,bar:BAR,chapters:CHAPTERS,captions:CAPTIONS,sources:SOURCES,facts:FACTS,notes:NOTES};
const html=read('index.template.html').replace('/*__STYLE__*/',fonts+'\n/* Font licenses\n'+licenses.replaceAll('*/','* /')+'\n*/\n'+read('style.css')).replace('/*__DATA__*/',JSON.stringify(data).replaceAll('<','\\u003c')).replace('/*__SCRIPT__*/',script.replaceAll('</script','<\\/script'));
assert.ok(!html.includes('/*__'));assert.ok(!/<(?:img|video)\b/i.test(html),'Only original programmatic art permitted');
const prior=['export/一念万物/GENESIS.html','export/知识之塔/开始观看.html','export/X500/开始观看.html'].filter(name=>existsSync(resolve(root,name))).map(name=>[name,hash(resolve(root,name))]);
const collection=resolve(root,'export/西部余烬');mkdirSync(resolve(collection,'audio'),{recursive:true});
writeFileSync(resolve(dir,'WESTERN.html'),html);writeFileSync(resolve(collection,'开始观看.html'),html);copyFileSync(resolve(dir,'audio/master.mp3'),resolve(collection,'audio/master.mp3'));writeFileSync(resolve(collection,'FONT-LICENSES.txt'),licenses);
writeFileSync(resolve(collection,'说明.txt'),'西部余烬 · 三分钟8-bit西部史诗\n双击「开始观看.html」，点击「全屏启程」。保留 audio 文件夹，无需联网或安装依赖。\n介绍《荒野大镖客2》的非官方原创像素短片。对白为创意改写，不是游戏原台词；仅采用公开开篇设定，不泄露主要结局。\n180秒，128BPM，13幕，原创芯片配乐。无语音、无游戏原声采样、无预录视频。\n空格暂停，左右键跳转一小节，R重播，F全屏，M静音。「资料」查看出处与柔和动效。\n');
for(const [file,expected] of prior)assert.equal(hash(resolve(root,file)),expected,'Existing film changed');
console.log(JSON.stringify({result:'PASS',title:TITLE,duration:DURATION,bpm:BPM,beats:TOTAL_BEATS,chapters:CHAPTERS.length,captions:CAPTIONS.length,noVoice:true,no3D:true,htmlBytes:Buffer.byteLength(html),entry:resolve(collection,'开始观看.html'),sourcePreview:resolve(dir,'WESTERN.html'),mastersha256:report.mastersha256,oldFilmsPreserved:true},null,2));