import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,copyFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {build} from '../web/node_modules/vite/dist/node/index.js';
import {verifyOriginal} from './protect-original.mjs';
import {TITLE,COLLECTION,TAGLINE,DURATION,BPM,BEAT,BAR,TOTAL_BEATS,CHAPTERS,CAPTIONS,SHOTS,CUES,SOURCES,NOTES} from './story.mjs';
const dir=fileURLToPath(new URL('./',import.meta.url)),root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>readFileSync(resolve(dir,name),'utf8'),hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const before=verifyOriginal(),report=JSON.parse(read('audio/report.json'));
assert.equal(report.validation.passed,true);assert.equal(report.noVoice,true);assert.equal(report.duration,DURATION);assert.equal(report.bpm,BPM);
assert.equal(report.storysha256,hash(resolve(dir,'story.mjs')),'Music and new story must match');assert.equal(report.mastersha256,hash(resolve(dir,'audio/master.mp3')),'Verified soundtrack changed');
assert.equal(DURATION/BEAT,TOTAL_BEATS);assert.equal(CHAPTERS.reduce((n,ch)=>n+ch.bars,0),60);
for(const list of [CHAPTERS,SHOTS]){assert.equal(list[0].start,0);assert.equal(list.at(-1).end,DURATION);for(let i=0;i<list.length;i++){assert.ok(list[i].end>list[i].start);if(i)assert.equal(list[i-1].end,list[i].start);}}
for(let i=0;i<CAPTIONS.length;i++){const cue=CAPTIONS[i];assert.ok(cue.start>=0&&cue.end<=DURATION&&cue.end>cue.start);if(i)assert.ok(cue.start>=CAPTIONS[i-1].end);if(cue.kind==='fact')assert.ok(SOURCES[cue.source]);}
const fonts=[['Space Grotesk',400,'space-grotesk/files/space-grotesk-latin-400-normal.woff2'],['Space Grotesk',500,'space-grotesk/files/space-grotesk-latin-500-normal.woff2'],['IBM Plex Mono',400,'ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2']].map(([family,weight,path])=>`@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${readFileSync(resolve(root,'web/node_modules/@fontsource',path)).toString('base64')}) format('woff2')}`).join('\n');
const fontLicenses=['space-grotesk','ibm-plex-mono'].map(name=>{const folder=resolve(root,'web/node_modules/@fontsource',name),file=readdirSync(folder).find(f=>/^(license|ofl)/i.test(f));assert.ok(file);return `${name}\n${readFileSync(resolve(folder,file),'utf8')}`;}).join('\n\n');
const threeLicense=readFileSync(resolve(root,'web/node_modules/three/LICENSE'),'utf8');
const bundled=await build({root:dir,configFile:false,publicDir:false,logLevel:'warn',resolve:{alias:[{find:/^three$/,replacement:resolve(root,'web/node_modules/three/build/three.module.js')},{find:/^three\//,replacement:resolve(root,'web/node_modules/three')+'/'}]},build:{write:false,emptyOutDir:false,target:'es2022',minify:true,lib:{entry:resolve(dir,'player.mjs'),name:'WesternTwo',formats:['iife']}}});
const outputs=(Array.isArray(bundled)?bundled:[bundled]).flatMap(result=>result.output),chunks=outputs.filter(item=>item.type==='chunk');
assert.equal(chunks.length,1,'Delivery must inline a single JS bundle');assert.equal(chunks[0].imports.length,0,'No runtime module import');assert.equal(chunks[0].dynamicImports.length,0);
const data={title:TITLE,collection:COLLECTION,tagline:TAGLINE,duration:DURATION,bpm:BPM,bar:BAR,chapters:CHAPTERS,captions:CAPTIONS,shots:SHOTS,cues:CUES,sources:SOURCES,notes:NOTES};
// Callback replacements preserve literal $&, $` and $' inside dependency code.
const script=chunks[0].code.replace(/<\/script/gi,'<\\/script');
const html=read('index.template.html').replace('/*__STYLE__*/',()=>fonts+'\n'+read('style.css')).replace('/*__DATA__*/',()=>JSON.stringify(data).replaceAll('<','\\u003c')).replace('/*__SCRIPT__*/',()=>script);
assert.ok(!html.includes('/*__'));assert.ok(!/<script[^>]+src=/i.test(html));
const executable=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].filter(match=>!match[1].includes('application/json'));
assert.equal(executable.length,1,'Unexpected executable script boundary');assert.equal(executable[0][2],script,'Inline dependency code was altered');new Script(executable[0][2],{filename:'western2-inline.js'});
const collection=resolve(root,'export',COLLECTION);mkdirSync(resolve(collection,'audio'),{recursive:true});mkdirSync(resolve(dir,'output'),{recursive:true});
writeFileSync(resolve(dir,'WESTERN2.html'),html);writeFileSync(resolve(collection,'开始观看.html'),html);copyFileSync(resolve(dir,'audio/master.mp3'),resolve(collection,'audio/master.mp3'));
writeFileSync(resolve(collection,'FONT-LICENSES.txt'),fontLicenses);writeFileSync(resolve(collection,'THIRD-PARTY-LICENSES.txt'),'Three.js\n'+threeLicense);
writeFileSync(resolve(collection,'说明.txt'),'西部2 · 明天以西\n\n双击「开始观看.html」，用 Chrome / Edge 打开，再点击「全屏观看」。\n复制整个「西部2」文件夹到其他机器，保留 audio/master.mp3；无需联网或安装依赖。\n\n180秒，24镜头，21段字幕；原创HD-2D像素人物与三维空间光影。\n原创80BPM口哨与芯片西部配乐，无旁白。部分段落只有风与动作声，是有意留白。\n需要WebGL2；建议横屏与浏览器硬件加速。本版不自动降级为旧二维画面。\n\n全部对白、三次计划、推车和渡口场面为原创压缩演绎，不是游戏原台词、任务实录或正史结局。\n未使用游戏原声、美术素材或八方旅人资产。无官方关联或背书。\n\n空格暂停，左右键跳转三秒，R重播，F全屏，M静音；「说明」可切换柔和动效。\n原版「西部余烬」及其rdr2工程独立保留。当前目录没有ZIP、预录视频、开发依赖或测试输出。\n');
const after=verifyOriginal();assert.equal(before.protectedFiles,after.protectedFiles);
const result={result:'PASS',title:TITLE,duration:DURATION,bpm:BPM,chapters:CHAPTERS.length,shots:SHOTS.length,captions:CAPTIONS.length,captionSeconds:Number(CAPTIONS.reduce((n,c)=>n+c.end-c.start,0).toFixed(2)),htmlBytes:Buffer.byteLength(html),htmlsha256:hash(resolve(collection,'开始观看.html')),mastersha256:report.mastersha256,renderer:'WebGL2 / HD-2D',...after,entry:resolve(collection,'开始观看.html')};
writeFileSync(resolve(dir,'output/build-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));