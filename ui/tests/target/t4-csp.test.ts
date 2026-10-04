import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCspReport } from '../../packages/security-telemetry/src/csp-report.js';

test('CSP report parser retains only safe directive categories', () => {
  const raw = Buffer.from(JSON.stringify({ 'csp-report': {
    'effective-directive': 'script-src', 'blocked-uri': 'https://evil.example/?token=secret',
    'document-uri': 'https://app.example/private?access_token=secret', sample: '<script>secret</script>'
  } }));
  assert.deepEqual(parseCspReport(raw, 'application/csp-report', 8192), { directive: 'script-src', blockedKind: 'REMOTE' });
  const modern = Buffer.from(JSON.stringify([{ type: 'csp-violation', body: { effectiveDirective: 'frame-ancestors', blockedURL: 'inline' } }]));
  assert.deepEqual(parseCspReport(modern, 'application/reports+json', 8192), { directive: 'frame-ancestors', blockedKind: 'INLINE' });
  assert.throws(() => parseCspReport(raw, 'text/plain', 8192), /INVALID_CSP_REPORT/);
  assert.throws(() => parseCspReport(raw, 'application/csp-report', 10), /INVALID_CSP_REPORT/);
  assert.throws(() => parseCspReport(Buffer.from(JSON.stringify({ 'csp-report': { 'effective-directive': 'script-src', nested: { token: 'secret' } } })), 'application/csp-report', 8192), /INVALID_CSP_REPORT/);
});
