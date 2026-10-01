import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { collectPathsFromGitStatus, ensureFilenameFormat, listedPaths, normalizeRepositoryPath, validFinalStatus, validatePurpose } from '../../scripts/activity-report.ts';

const ROOT=resolve(import.meta.dirname,'../..');
const SCRIPT=join(ROOT,'scripts/activity-report.ts');
const TSX=join(ROOT,'node_modules/tsx/dist/cli.mjs');
function run(cwd:string,command:string,arg?:string):{status:number|null;stdout:string;stderr:string}{
 const result=spawnSync(process.execPath,[TSX,SCRIPT,command,...(arg?[arg]:[])],{cwd,encoding:'utf8'});
 return {status:result.status,stdout:result.stdout,stderr:result.stderr};
}
function replaceSection(contents:string,name:string,body:string):string {
 const marker=`## ${name}\n`,start=contents.indexOf(marker);
 assert.ok(start>=0,name);
 const from=start+marker.length,next=contents.indexOf('\n## ',from);
 return contents.slice(0,from)+'\n'+body+'\n'+contents.slice(next<0?contents.length:next);
}
test('purpose, filename, final status, and generic paths are validated',()=>{
 assert.equal(validatePurpose('GUARDRAIL-PRECISION'),'GUARDRAIL-PRECISION');
 assert.throws(()=>validatePurpose('guardrail-precision'));
 ensureFilenameFormat('20261002-0312-GUARDRAIL-PRECISION.md');
 assert.throws(()=>ensureFilenameFormat('bad.md'));
 for(const value of ['COMPLETE','PARTIAL','BLOCKED'])assert.equal(validFinalStatus(value),true);
 for(const value of ['VERIFIED','IN_PROGRESS','complete'])assert.equal(validFinalStatus(value),false);
 assert.deepEqual([...listedPaths('- README.md\n- docker-compose.yml\n- compose.yaml\n- eslint.config.js\n- .github/workflows/ci.yml\n- Dockerfile\n- Makefile\n- `nested/file with spaces.txt`')],['README.md','docker-compose.yml','compose.yaml','eslint.config.js','.github/workflows/ci.yml','Dockerfile','Makefile','nested/file with spaces.txt']);
 for(const invalid of ['/etc/passwd','../outside','folder/../outside','C:/outside'])assert.throws(()=>normalizeRepositoryPath(invalid));
});
test('porcelain inventory preserves individual untracked and deleted paths',()=>{
 const paths=collectPathsFromGitStatus('?? ui/nested/one.txt\n?? ui/nested/two.txt\n D ui/deleted.txt\n');
 assert.deepEqual([...paths].sort(),['deleted.txt','nested/one.txt','nested/two.txt']);
});
for(const finalStatus of ['COMPLETE','PARTIAL','BLOCKED'])test(`isolated lifecycle accepts ${finalStatus}, clears marker, then starts next task`,()=>{
 const cwd=mkdtempSync(join(tmpdir(),'activity-report-test-'));
 try {
  execFileSync('git',['init','-q'],{cwd});
  mkdirSync(join(cwd,'nested'));mkdirSync(join(cwd,'.github/workflows'),{recursive:true});
  for(const file of ['README.md','docker-compose.yml','nested/one.txt','nested/two.txt','.github/workflows/ci.yml','deleted.txt'])writeFileSync(join(cwd,file),'fixture\n');
  execFileSync('git',['add','deleted.txt'],{cwd});unlinkSync(join(cwd,'deleted.txt'));
  const status=execFileSync('git',['status','--porcelain=v1','--untracked-files=all','--','.'],{cwd,encoding:'utf8'});
  assert.ok(status.includes('?? nested/one.txt'));assert.ok(status.includes('?? nested/two.txt'));
  assert.equal(run(cwd,'start','lowercase').status,1);
  const started=run(cwd,'start','TEST-REPORT');
  assert.equal(started.status,0,started.stderr);
  const reportPath=started.stdout.trim(),marker=join(cwd,'.git/activity-report/current-report.txt');
  assert.ok(existsSync(marker));
  assert.equal(run(cwd,'verify').status,1,'IN_PROGRESS must be rejected');
  assert.equal(run(cwd,'finalize','VERIFIED').status,1,'VERIFIED is not a task status');
  let contents=readFileSync(reportPath,'utf8');
  contents=replaceSection(contents,'Pre-existing Workspace Changes','- README.md\n- docker-compose.yml\n- nested/one.txt\n- nested/two.txt\n- .github/workflows/ci.yml');
  contents=replaceSection(contents,'Files Added','- '+reportPath.slice(cwd.length+1));
  contents=replaceSection(contents,'Files Modified','- None.');
  contents=replaceSection(contents,'Files Deleted','- deleted.txt');
  contents=replaceSection(contents,'Tests and Verification','- PASS; exit 0.');
  contents=replaceSection(contents,'Acceptance Criteria','| Criterion | Result | Evidence |\n|---|---|---|\n| 1 | PASS | Isolated lifecycle test |');
  writeFileSync(reportPath,contents);
  assert.equal(run(cwd,'finalize',finalStatus).status,0);
  const verified=run(cwd,'verify');
  assert.equal(verified.status,0,verified.stderr);
  assert.equal(existsSync(marker),false);
  assert.equal(run(cwd,'start','SECOND-TASK').status,0);
 } finally {rmSync(cwd,{recursive:true,force:true});}
});
