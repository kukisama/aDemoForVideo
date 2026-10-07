import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const file=fileURLToPath(new URL('./previous-films.json',import.meta.url));
const sourceRoots=['web/src','web/public','feynman','x500','rdr2','rdr2-v2','odyssey','odyssey2'];
const ignored=name=>['node_modules','output','dist','coverage','test-results','playwright-report','.git'].includes(name)||/^\.(stage|work|score-work)-/.test(name);
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
function walk(path){const entries=[];for(const ent of readdirSync(path,{withFileTypes:true})){if(ignored(ent.name)||ent.isSymbolicLink())continue;const child=resolve(path,ent.name);if(ent.isDirectory())entries.push(...walk(child));else if(ent.isFile())entries.push(child);}return entries;}
export function capture(){
  assert.ok(!existsSync(file),'Never replace an established old-film baseline');
  const paths=sourceRoots.filter(p=>existsSync(resolve(root,p))).flatMap(p=>walk(resolve(root,p)));
  for(const ent of readdirSync(resolve(root,'export'),{withFileTypes:true}))if(ent.isDirectory()&&ent.name!=='赶路的人')paths.push(...walk(resolve(root,'export',ent.name)));
  const files=Object.fromEntries(paths.sort().map(path=>[relative(root,path).split(sep).join('/'),sha(path)]));
  writeFileSync(file,JSON.stringify({scope:'Existing film sources/assets and export directories; excludes QA/caches, root indexes and the new shortcut film.',files},null,2));return Object.keys(files).length;
}
export function verifyPrevious(){const saved=JSON.parse(readFileSync(file,'utf8'));for(const [name,expected] of Object.entries(saved.files)){assert.ok(existsSync(resolve(root,name)),`Missing old film file: ${name}`);assert.equal(sha(resolve(root,name)),expected,`Old film changed: ${name}`);}return Object.keys(saved.files).length;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify({result:'PASS',files:process.argv.includes('--capture')?capture():verifyPrevious(),operation:process.argv.includes('--capture')?'capture':'verify'}));