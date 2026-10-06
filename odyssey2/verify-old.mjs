import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const baseline=fileURLToPath(new URL('./output/protected-baseline.json',import.meta.url));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const paths=[];
function scan(folder,all=false){
  if(!existsSync(folder))return;
  for(const entry of readdirSync(folder,{withFileTypes:true})){
    if(['node_modules','output','dist','.git'].includes(entry.name))continue;
    const p=resolve(folder,entry.name);
    if(entry.isDirectory())scan(p,all);
    else if(all||/\.(?:mjs|js|ts|css|html)$/.test(entry.name)||entry.name==='master.mp3')paths.push(p);
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--capture')){
  assert.ok(!existsSync(baseline),'已有保护基线，不覆盖。');
  for(const name of ['web','feynman','x500','rdr2','odyssey'])scan(resolve(root,name));
  for(const name of ['一念万物','知识之塔','X500','西部余烬','奥德赛'])scan(resolve(root,'export',name),true);
  const entries=Object.fromEntries(paths.sort().map(p=>[relative(root,p),sha(p)]));
  mkdirSync(resolve(baseline,'..'),{recursive:true});
  writeFileSync(baseline,JSON.stringify({capturedAt:new Date().toISOString(),entries},null,2));
  console.log(JSON.stringify({result:'CAPTURED',protectedFiles:Object.keys(entries).length}));
}else{
  assert.ok(existsSync(baseline),'缺少旧片保护基线');
  const {entries}=JSON.parse(readFileSync(baseline,'utf8'));
  for(const [p,expected]of Object.entries(entries))assert.equal(sha(resolve(root,p)),expected,`旧片被修改：${p}`);
  console.log(JSON.stringify({result:'PASS',protectedFiles:Object.keys(entries).length,oldProjectsUnchanged:true}));
}