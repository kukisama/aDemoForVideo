import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const lock=fileURLToPath(new URL('./previous-films.json',import.meta.url));
const legacy=['web','feynman','x500','rdr2','rdr2-v2','odyssey','odyssey2','shortcut','export'];
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
function files(dir) {
  return readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    if(['node_modules','output','dist','.cache'].includes(e.name)||e.name.startsWith('.work-')||e.name.startsWith('.score-work-')) return [];
    const path=resolve(dir,e.name), rel=relative(root,path).replaceAll('\\','/');
    if(rel==='export/秦始皇'||rel==='export/观看说明.txt') return [];
    return e.isDirectory()?files(path):e.isFile()?[rel]:[];
  });
}
export function verifyPrevious() {
  const rows=JSON.parse(readFileSync(lock,'utf8'));
  for(const [file,digest] of Object.entries(rows)) assert.equal(sha(resolve(root,file)),digest,`Previous film changed: ${file}`);
  return Object.keys(rows).length;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.includes('--capture')) {
    assert.ok(!existsSync(lock),'Never replace an established baseline');
    const rows=Object.fromEntries(legacy.flatMap(n=>files(resolve(root,n))).sort().map(file=>[file,sha(resolve(root,file))]));
    writeFileSync(lock,JSON.stringify(rows,null,2)+'\n');
  }
  console.log(JSON.stringify({protectedFiles:verifyPrevious(),result:'PASS'}));
}