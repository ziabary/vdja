import assert from 'node:assert/strict';
import {test} from 'node:test';
import {targetFileFindings} from '../../scripts/t5-target-architecture.js';
test('T5 guards reject S3 and filesystem bypasses while accepting owning infrastructure',()=>{
  const source="import { S3Client } from '@aws-sdk/client-s3'; import {readFile} from 'node:fs/promises';";
  assert.equal(targetFileFindings('modules/faq/src/files.ts',source).length,2);
  assert.equal(targetFileFindings('packages/storage/src/adapters/s3.ts',source).length,0);
  assert.equal(targetFileFindings('packages/file-processing/src/parser.ts',"import {readFile} from 'node:fs/promises';").length,0);
  assert.equal(targetFileFindings('packages/knowledge/src/service.ts',"import type {intfStoragePort} from '../../storage/src/index.js'; ports.storage.open(id);").length,2);
});
test('T5 guards reject direct vectors/providers/signed URLs and retain public File Management and Router contracts',()=>{
  assert.equal(targetFileFindings('modules/faq/src/service.ts',"import {extractText} from '../../../packages/file-processing/src/index.js'; fetch(url); getSignedUrl(client,input);").length,3);
  assert.equal(targetFileFindings('packages/documents/src/service.ts',"import {QdrantClient} from '@qdrant/js-client-rest';").length,1);
  assert.equal(targetFileFindings('packages/knowledge/src/adapters/qdrant.ts',"import {QdrantClient} from '@qdrant/js-client-rest'; fetch(url);").length,0);
  assert.equal(targetFileFindings('modules/faq/src/service.ts',"import {extractTemporaryFile} from '../../../packages/file-management/src/temporary.js'; router.run(request);").length,0);
  assert.equal(targetFileFindings('src/services/ragService.ts',"import {QdrantClient} from '@qdrant/js-client-rest';").length,0);
});
