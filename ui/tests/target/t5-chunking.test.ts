import assert from 'node:assert/strict';
import {test} from 'node:test';
import {chunkNormalized,verifyChunk} from '../../packages/knowledge/src/chunking.js';
const profile={id:'test',embeddingProfileId:'embed',dimensions:3,chunkingProfile:'utf16-window-v1',chunkChars:32,overlapChars:31};
test('maximal overlap and surrogate-pair boundaries always advance and reproduce canonical spans',{timeout:1000},()=>{
  const text='a'.repeat(30)+'😀'.repeat(40)+'finish';const chunks=chunkNormalized(text,'version-id',profile);
  assert.deepEqual(chunkNormalized(text,'version-id',profile),chunks);
  assert.ok(chunks.length<=text.length);assert.equal(chunks[0]?.start,0);assert.equal(chunks.at(-1)?.end,text.length);
  for(let index=0;index<chunks.length;index+=1){const chunk=chunks[index]!;assert.equal(verifyChunk(text,chunk.start,chunk.end,chunk.sha256),text.slice(chunk.start,chunk.end));
    assert.ok(!/[\uDC00-\uDFFF]/u.test(text[chunk.start]!));assert.ok(!/[\uD800-\uDBFF]/u.test(text[chunk.end-1]!));if(index)assert.ok(chunk.start>chunks[index-1]!.start);}
});
test('unsafe overlap expansion is bounded before allocating unbounded chunk metadata',()=>{
  assert.throws(()=>chunkNormalized('a'.repeat(30000),'version-id',profile),/CONTEXT_BUDGET_EXCEEDED/);
});
