import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {hash} from '../../scripts/t5-r1-source.mjs';
import {compareProtectedFiles} from '../../scripts/t5-protected-policy.mjs';
for(const path of ['AGENTS.md','docs/architecture/rule.md','docs/prompts/task.md'])test('R1 protected gate rejects unauthorized change to '+path,()=>{
 const before={task:'T5-R1',authorizedChanges:[],files:{[path]:'BEFORE'}};assert.equal(compareProtectedFiles(before,{[path]:'AFTER'}).unauthorizedCount,1);
 assert.throws(()=>compareProtectedFiles({...before,authorizedChanges:[path]},{[path]:'AFTER'}),/R1_PROTECTED_AUTHORIZATION_FORBIDDEN/);
});
test('R1 protected governing files match the task-specific baseline with no inherited exceptions',async()=>{
 const baseline=JSON.parse(await readFile('reports/security/t5-r1-protected-before.json','utf8'));assert.equal(baseline.task,'T5-R1');assert.deepEqual(baseline.authorizedChanges,[]);
 const current={};for(const path of Object.keys(baseline.files))current[path]=hash(await readFile(path));assert.equal(compareProtectedFiles(baseline,current).unauthorizedCount,0);
});
