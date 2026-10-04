import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {sourceFingerprint} from '../../scripts/t5-r1-source.mjs';
test('post T5 production Authority inventory has no pure-kernel bypass and includes Document Knowledge Runtime consumers',async()=>{
 const inventory=JSON.parse(await readFile('reports/security/t5-authority-inventory.json','utf8'));
 assert.equal(inventory.sourceHash,(await sourceFingerprint()).sourceHash);assert.equal(inventory.productionAuthorityBypasses,0);
 for(const prefix of ['packages/documents/','packages/knowledge/','apps/runtime/'])assert.ok(inventory.inventory.some(e=>e.file.startsWith(prefix)&&e.classification==='CANONICAL_AUTHORITY_SERVICE'));
 assert.ok(inventory.productionFilesScanned>100);
});
