import {readFileSync,writeFileSync,existsSync,rmSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const audio=fileURLToPath(new URL('./',import.meta.url));
const root=fileURLToPath(new URL('../../',import.meta.url));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const report=JSON.parse(readFileSync(join(audio,'report.json'),'utf8'));
assert.equal(report.validation.passed,true);
assert.equal(sha(resolve(audio,'../timeline.mjs')),report.timelineSha256);
assert.equal(sha(resolve(audio,'../score.mjs')),report.generatorSha256);
for(const role of ['demo','sfx','master'])assert.equal(sha(join(audio,`${role}.mp3`)),report.files[role].sha256);
const {entries}=JSON.parse(readFileSync(resolve(audio,'../output/protected-baseline.json'),'utf8'));
for(const [path,expected]of Object.entries(entries))assert.equal(sha(resolve(root,path)),expected,`Protected original changed: ${path}`);
const removed=[];
for(const name of ['.render-5n1hzO','.render-NRIaao']){
  const path=join(audio,name);
  if(existsSync(path)){rmSync(path,{recursive:true});removed.push(name);}
}
const taskDir=join(audio,'.vscode');
if(existsSync(taskDir)&&readdirSync(taskDir).length===0)rmSync(taskDir,{recursive:true});
const result={passed:true,protectedFiles:Object.keys(entries).length,oldProjectsUnchanged:true,removedOwnedTemporaryDirectories:removed,
  timelineSha256:report.timelineSha256,generatorSha256:report.generatorSha256,
  maxLocalSfxOverMusicDb:Math.max(...report.measurements.balances.map(e=>e.maxLocal60msOverMusicDb)),
  masterFightRmsDbFS:report.measurements.tracks.master.fight.rmsDbFS,masterSuspenseRmsDbFS:report.measurements.tracks.master.suspense.rmsDbFS,
  losslessStemSumRelativeDb:report.measurements.losslessStemSum.relativeRmsDb,sharedLimiterMinGainDb:report.processing.limiter.minGainDb,
  files:report.files};
writeFileSync(join(audio,'final-check.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:true,protectedFiles:result.protectedFiles,removed}));