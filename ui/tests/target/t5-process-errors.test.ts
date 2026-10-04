import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
test('last-resort handler redacts exception payload and drains before supervisor replacement',async()=>{
 const environment={...process.env};delete environment.NODE_TEST_CONTEXT;
 for(const failure of ['throw new Error("PROTECTED_SECRET_IN_EXCEPTION")','Promise.reject(new Error("PROTECTED_SECRET_IN_EXCEPTION"))']){
  const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',
   `import {installProcessErrorHandlers} from './packages/observability/src/process-errors.ts'; installProcessErrorHandlers('test',async()=>{process.stdout.write('DRAIN_COMPLETE\\n');},1000);setTimeout(()=>{${failure}},0);`],{stdio:['ignore','pipe','pipe'],env:environment});
  let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
  const code=await new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  assert.equal(code,1);assert.match(output,/process_fatal/);assert.match(output,/DRAIN_COMPLETE/);assert.doesNotMatch(output,/PROTECTED_SECRET_IN_EXCEPTION/);
 }
});
