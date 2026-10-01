import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeRepository } from './support/staticAnalysis.ts';

test('typed TypeScript module manifests conform and contribution IDs are unique',()=>{
 const violations=analyzeRepository().filter(v=>v.ruleId==='ARCH-MOD-001'||v.ruleId==='ARCH-MOD-002');
 assert.deepEqual(violations,[],JSON.stringify(violations,null,2));
});
