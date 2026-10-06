import assert from 'node:assert/strict';
import {build} from '../web/node_modules/vite/dist/node/index.js';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {DURATION,BPM,STAGES,EVENTS} from './timeline.mjs';
import './verify-old.mjs';
const dir=fileURLToPath(new URL('./',import.meta.url)),root=resolve(dir,'..');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const report=JSON.parse(readFileSync(resolve(dir,'audio/report.json'),'utf8'));
assert.equal(report.validation.passed,true);assert.equal(report.themeAdaptation,false);assert.equal(report.duration,DURATION);assert.equal(report.bpm,BPM);
assert.equal(report.timelineSha256,sha(resolve(dir,'timeline.mjs')));assert.equal(report.generatorSha256,sha(resolve(dir,'score.mjs')));
for(const role of ['master','demo','sfx'])assert.equal(report.files[role].sha256,sha(resolve(dir,`audio/${role}.mp3`)));
const fontRoot=resolve(root,'web/node_modules/@fontsource');
const fonts=[['Space Grotesk',400,'space-grotesk/files/space-grotesk-latin-400-normal.woff2'],['Space Grotesk',500,'space-grotesk/files/space-grotesk-latin-500-normal.woff2'],['IBM Plex Mono',400,'ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2']];
const fontCSS=fonts.map(([name,weight,path])=>`@font-face{font-family:'${name}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${readFileSync(resolve(fontRoot,path)).toString('base64')}) format('woff2')}`).join('\n');
const license=['space-grotesk','ibm-plex-mono'].map(name=>{const folder=resolve(fontRoot,name),file=readdirSync(folder).find(n=>/^(license|ofl)/i.test(n));assert.ok(file);return `${name}\n${readFileSync(resolve(folder,file),'utf8')}`;}).join('\n\n')+'\n\nTHREE.JS\n'+readFileSync(resolve(root,'web/node_modules/three/LICENSE'),'utf8');
const three=resolve(root,'web/node_modules/three').replaceAll('\\','/');
const inline={name:'odyssey2-offline',enforce:'post',generateBundle(_,bundle){
  const page=bundle['index.html'];assert.ok(page&&page.type==='asset');let html=String(page.source);
  html=html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/g,(_tag,path)=>{const key=path.replace(/^\.?\//,''),chunk=bundle[key];assert.equal(chunk?.type,'chunk');delete bundle[key];return `<script type="module">${chunk.code.replaceAll('</script','<\\/script')}</script>`;});
  html=html.replace(/<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>/g,(_tag,path)=>{const key=path.replace(/^\.?\//,''),asset=bundle[key];assert.equal(asset?.type,'asset');delete bundle[key];return `<style>${String(asset.source).replaceAll('</style','<\\/style')}</style>`;});
  html=html.replace('<!--__FONTS__-->',`<style>${fontCSS}</style>`);assert.ok(!html.includes('<!--__FONTS__-->'));
  assert.ok(!/<script\b[^>]*src=/.test(html),'External module dependency remains');
  page.source=html;
}};
await build({configFile:false,root:dir,base:'./',publicDir:false,plugins:[inline],
  resolve:{alias:[{find:/^three\/addons\//,replacement:three+'/examples/jsm/'},{find:/^three$/,replacement:three+'/build/three.module.js'}]},
  build:{outDir:resolve(dir,'output/bundle'),emptyOutDir:true,copyPublicDir:false,assetsInlineLimit:100000000,cssCodeSplit:false,modulePreload:false,chunkSizeWarningLimit:1800},
});
const built=resolve(dir,'output/bundle/index.html'),html=readFileSync(built,'utf8'),target=resolve(root,'export/奥德赛2');
mkdirSync(resolve(target,'audio'),{recursive:true});copyFileSync(built,resolve(target,'开始观看.html'));copyFileSync(built,resolve(dir,'ODYSSEY2.html'));
for(const role of ['master','demo','sfx'])copyFileSync(resolve(dir,`audio/${role}.mp3`),resolve(target,`audio/${role}.mp3`));
writeFileSync(resolve(target,'LICENSES.txt'),license);
copyFileSync(resolve(dir,'验收状态.txt'),resolve(target,'验收状态.txt'));
writeFileSync(resolve(target,'说明.txt'),[
  '奥德赛 II · 空弦 / 30秒HD-2D动作演示',
  '打开「开始观看.html」，用完整Chrome/Edge点击开始或全屏观看。需要WebGL2；无需联网、Node或开发服务器。默认音频/脚本均已内嵌，可单独复制HTML。',
  '独立工程，不修改之前的奥德赛。原创像素角色与动作、真实立体殿堂、HDR灯光、深度景深、粒子和武器轨迹。',
  '音乐说明：当前为原创演示底轨，不是官方主题变奏。本轮未取得原片音频，尚未完成用户要求的电影主题辨识。',
  '封面「配乐与观看设置」可选择有权使用的本地配乐、片段起点，保留14个同步动作音效；文件仅驻留浏览器，不上传或复制。',
  '空间回声保留本地配乐音高，仅为混音选项，不等于重新编曲。',
  '默认1280×720电影档；可手动选均衡档或柔和冲击。不自动因当前设备降低质量。',
  '空格暂停/继续，左右键逐秒跳转，R重播，F全屏，M静音。播放时控件自动隐藏，可自行录屏。',
  'audio目录另外保留三条声音供独立试听。没有使用影视/游戏画面、音源或人物资产。本片非官方、非电影镜头复刻。',
  '原片主题变奏尚缺素材。硬件性能按用户要求跳过，不作为交付阻碍；以目标机器性能足够为前提保留完整电影档。详见「验收状态.txt」。',
].join('\n')+'\n');
writeFileSync(resolve(dir,'output/build-report.json'),JSON.stringify({result:'PASS',duration:DURATION,bpm:BPM,stages:STAGES.length,events:EVENTS.length,
  entry:resolve(target,'开始观看.html'),htmlsha256:sha(resolve(target,'开始观看.html')),mastersha256:report.files.master.sha256,themeAdaptation:false,
  bytes:Buffer.byteLength(html),oldProjectsProtected:true,hardwarePerformance:{status:'SKIPPED_BY_USER',reason:'Target playback hardware is assumed adequate per user; local FPS is not an acceptance gate.'}},null,2));
console.log(JSON.stringify({result:'PASS',entry:resolve(target,'开始观看.html'),duration:DURATION,stages:STAGES.length,events:EVENTS.length,htmlBytes:Buffer.byteLength(html),themeAdaptation:false},null,2));