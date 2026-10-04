import {enuMalwareMode} from '../../packages/file-processing/src/malware.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateFileManagement } from '../../packages/configuration/src/index.js';

const MAX_UPLOAD = 20000000;
function profile(): Record<string, unknown> {
  return { enabled: true, storage: { kind: 'LOCAL', profileId: 'primary', root: '/var/lib/targoman/assets' },
    uploads: { mode: 'PROXY', partBytes: 5242880, ttlMs: 3600000, timeoutMs: 30000, maxConcurrent: 3,
      maxBytes: MAX_UPLOAD, maxPendingBytes: 60000000, maxTenantStorageBytes: 100000000, maxTenantAssets: 100 },
    downloads: { ranges: true, conditional: true, maxConcurrent: 3 },
    cache: { scope: 'REPLICA_PRIVATE', root: '/tmp/targoman-cache', maxBytes: 40000000, maxEntries: 10, ttlMs: 60000, timeoutMs: 30000 },
    staging: { root: '/tmp/targoman-staging', maxBytes: 60000000 }, security: { privateOnly: true, integrityRequired: true,malware:{mode:enuMalwareMode.Disabled,timeoutMs:1000,maxBytes:MAX_UPLOAD,policyVersion:'test-low-assurance-v1'} } };
}
test('managed transfer configuration selects one adapter with external credentials and strict bounds', () => {
  assert.equal(validateFileManagement(profile(), 'test-files', MAX_UPLOAD).enabled, true);
  const remote = profile(); remote.storage = { kind: 'S3_COMPATIBLE', profileId: 'primary', endpoint: 'https://s3.example.invalid',
    region: 'local', bucket: 'private-assets', forcePathStyle: true, timeoutMs: 30000,
    accessKeyRef: 'file:/run/secrets/storage-access', secretKeyRef: 'file:/run/secrets/storage-secret' };
  const result = validateFileManagement(remote, 'customer-a', MAX_UPLOAD);
  assert.ok(result.enabled); assert.equal(result.storage.kind, 'S3_COMPATIBLE');
  for (const mutate of [
    (x: Record<string, unknown>) => { (x.storage as Record<string, unknown>).secretKeyRef = 'inline-secret'; },
    (x: Record<string, unknown>) => { (x.uploads as Record<string, unknown>).mode = 'DIRECT'; },
    (x: Record<string, unknown>) => { (x.uploads as Record<string, unknown>).partBytes = 1024; },
    (x: Record<string, unknown>) => { (x.cache as Record<string, unknown>).root = '/tmp/targoman-staging/nested'; },
    (x: Record<string, unknown>) => { (x.security as Record<string, unknown>).integrityRequired = false; },
    (x: Record<string, unknown>) => { (x.cache as Record<string, unknown>).maxBytes = 1000; },
    (x: Record<string, unknown>) => { (x.storage as Record<string, unknown>).endpoint = 'http://127.0.0.1:9000'; },
    (x: Record<string, unknown>) => { (x.storage as Record<string, unknown>).endpoint = 'https://user:password@s3.example.invalid'; },
    (x: Record<string, unknown>) => { (x.staging as Record<string, unknown>).root = '/tmp/../secrets'; }
  ]) { const invalid = structuredClone(remote); mutate(invalid);
    assert.throws(() => validateFileManagement(invalid, 'customer-a', MAX_UPLOAD)); }
  const loopback = structuredClone(remote); (loopback.storage as Record<string, unknown>).endpoint = 'http://127.0.0.1:9000';
  assert.equal(validateFileManagement(loopback, 'test-files', MAX_UPLOAD).enabled, true);
  assert.throws(() => validateFileManagement({ enabled: false, storage: {} }, 'test-files', MAX_UPLOAD));
});
test('identity tiers cannot exceed hard platform limits or lower the privileged tier', () => {
  const limits={maxBytes:100,maxConcurrent:1,maxPendingBytes:200,maxStorageBytes:1000,maxAssets:2};
  const raw=profile();raw.limitTiers={authenticated:limits,privileged:{...limits,maxBytes:200,maxPendingBytes:400}};
  assert.ok(validateFileManagement(raw,'test-files',MAX_UPLOAD).enabled);
  for(const replacement of [{...limits,maxBytes:MAX_UPLOAD+1},{...limits,maxConcurrent:4},{...limits,maxStorageBytes:100000001},{...limits,maxAssets:101},{...limits,maxBytes:99}]){
    raw.limitTiers={authenticated:limits,privileged:replacement};assert.throws(()=>validateFileManagement(raw,'test-files',MAX_UPLOAD));
  }
});
