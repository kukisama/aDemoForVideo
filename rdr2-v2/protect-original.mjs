import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const target=fileURLToPath(new URL('./original-lock.json',import.meta.url));
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
function tree(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(item=>{const path=resolve(dir,item.name);return item.isDirectory()?tree(path):[{path:relative(root,path).replaceAll('\\','/'),sha256:hash(path)}];}).sort((a,b)=>a.path.localeCompare(b.path));}
function collect(){return ['rdr2','export/西部余烬'].flatMap(dir=>tree(resolve(root,dir)));}
export function verifyOriginal(){assert.ok(existsSync(target),'Capture the original before making the new film');const baseline=JSON.parse(readFileSync(target,'utf8'));const current=collect();assert.deepEqual(current,baseline.files,'Original source or delivery changed; refuse to continue');return{result:'PASS',protectedFiles:current.length,originalUnchanged:true};}
if(process.argv.includes('--capture')){assert.ok(!existsSync(target),'Never replace an existing baseline');const files=collect();writeFileSync(target,JSON.stringify({capturedAt:new Date().toISOString(),scope:['rdr2/','export/西部余烬/'],files},null,2));console.log(JSON.stringify({result:'LOCKED',files:files.length}));}
else if(process.argv.includes('--verify'))console.log(JSON.stringify(verifyOriginal()));