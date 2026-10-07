// Build-time font subsetting through Google's public font API. No runtime requests.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('./',import.meta.url)),dir=resolve(root,'assets');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function fontText(){
  const source=['story.mjs','index.template.html','player.js','art.js'].map(n=>readFileSync(resolve(root,n),'utf8')).join('');
  const cn=source.match(/[\p{Script=Han}、，。？！：；·“”‘’（）《》—…]/gu)||[];
  return [...new Set([...cn,...'0123456789 /:.-+()→←↻↗⛶▶ⅡABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'])].sort().join('');
}
async function get(url){
  try{const res=await fetch(url,{signal:AbortSignal.timeout(25000)});assert.ok(res.ok,`Font HTTP ${res.status}`);return Buffer.from(await res.arrayBuffer());}
  catch{
    // urllib uses the user's existing system proxy if necessary; no values logged.
    const py="import sys,urllib.request\nwith urllib.request.urlopen(sys.argv[1],timeout=35) as r: sys.stdout.buffer.write(r.read())";
    const r=spawnSync('python',['-c',py,url],{windowsHide:true,maxBuffer:12*1024*1024,timeout:40000});
    assert.ok(!r.error&&r.status===0,'Public font download unavailable');return r.stdout;
  }
}
export async function prepareFonts(){
  mkdirSync(dir,{recursive:true});const text=fontText(),textSha256=sha(text),manifest=resolve(dir,'fonts.json');
  if(existsSync(manifest)){
    const m=JSON.parse(readFileSync(manifest,'utf8'));
    if(m.textSha256===textSha256&&m.fonts.every(f=>existsSync(resolve(dir,f.file))&&sha(readFileSync(resolve(dir,f.file)))===f.sha256)&&existsSync(resolve(dir,'OFL.txt')))return m;
  }
  const css=(await get(`https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&text=${encodeURIComponent(text)}`)).toString('utf8');
  const fonts=[];
  for(const block of css.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)){
    const body=block[1],weight=Number(body.match(/font-weight:\s*(\d+)/)?.[1]);
    const match=body.match(/src:\s*url\(([^)]+)\)\s*format\(['"]([^'"]+)/);
    assert.ok(match&&[400,600,700].includes(weight),'Unexpected font stylesheet');
    const url=match[1].replace(/^['"]|['"]$/g,''),format=match[2];assert.equal(new URL(url).hostname,'fonts.gstatic.com');
    const bytes=await get(url),extension=format==='truetype'?'ttf':format==='woff2'?'woff2':'woff',file=`qin-serif-${weight}.${extension}`;
    assert.ok(bytes.length>1000,'Empty font');writeFileSync(resolve(dir,file),bytes);fonts.push({weight,format,file,sha256:sha(bytes),bytes:bytes.length});
  }
  assert.deepEqual(fonts.map(f=>f.weight).sort(),[400,600,700]);
  const license=await get('https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/OFL.txt');
  assert.ok(license.toString('utf8').includes('SIL OPEN FONT LICENSE'));writeFileSync(resolve(dir,'OFL.txt'),license);
  const m={family:'Noto Serif SC',text,textSha256,fonts,license:'SIL Open Font License 1.1',licenseSha256:sha(license),source:'https://fonts.google.com/noto/specimen/Noto+Serif+SC'};
  writeFileSync(manifest,JSON.stringify(m,null,2)+'\n');return m;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await prepareFonts(),null,2));