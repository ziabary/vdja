import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('customer release stops before creating artifacts while ASVS Level 3 is open', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/customer-release.mjs',
    '--dry-run', '--customer', 'customer-a', '--out', '/tmp/t44-release-policy-test'],
  { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ASVS_L3_RELEASE_GATE_NO/);
});
