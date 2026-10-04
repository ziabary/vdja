import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveSecurityGates } from '../../scripts/rag-security-policy.mjs';

const goodFoundations = { authority: { status: 'PASS' }, fileProcessing: { status: 'PASS' } };

test('T5-created and customer-release gaps do not block T5 start', () => {
  const result = deriveSecurityGates([
    { blocksT5Start: false, verifyDuringT5: true, blocksCustomerRelease: true },
    { blocksT5Start: false, verifyDuringT5: false, blocksCustomerRelease: true }
  ], goodFoundations);
  assert.equal(result.RAG_SECURITY_GATE, 'YES');
  assert.equal(result.ASVS_L3_RELEASE_GATE, 'NO');
  assert.equal(result.blocksT5Start.length, 0);
  assert.equal(result.releaseBlocks.length, 2);
});

test('an open foundation or failing named check blocks T5 start', () => {
  const openFoundation = { blocksT5Start: true, verifyDuringT5: false, blocksCustomerRelease: true };
  assert.equal(deriveSecurityGates([openFoundation], goodFoundations).RAG_SECURITY_GATE, 'NO');
  assert.equal(deriveSecurityGates([], { authority: { status: 'FAIL' } }).RAG_SECURITY_GATE, 'NO');
});
