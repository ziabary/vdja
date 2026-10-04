import { readFile, writeFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { deriveSecurityGates } from './rag-security-policy.mjs';

const assessment = JSON.parse(await readFile('reports/security/asvs-5.0-l3.json', 'utf8'));
const classification = JSON.parse(await readFile('reports/security/rag-asvs-classification.json', 'utf8'));
const backlog = JSON.parse(await readFile('reports/security/t5-security-delta-backlog.json', 'utf8'));
if (assessment.version !== '5.0.0' || assessment.controls.length !== 345) throw new Error('ASVS_BASELINE_INVALID');
const ids = new Set();
for (const control of assessment.controls) {
  if (ids.has(control.id) || !/^v5\.0\.0-V\d+\.\d+\.\d+$/.test(control.id)) throw new Error('ASVS_CONTROL_ID_INVALID');
  ids.add(control.id);
  if (!['PASS', 'FAIL', 'NOT_VERIFIED', 'NOT_APPLICABLE'].includes(control.postT4)
    || !control.descriptionEn?.trim() || !control.sourceOrTestPaths?.length
    || (control.postT4 === 'NOT_APPLICABLE' && !control.notApplicableReason?.trim()))
    throw new Error(`ASVS_CONTROL_EVIDENCE_INVALID: ${control.id}`);
}
for (const [status, count] of [['PASS', assessment.counts.postPass], ['FAIL', assessment.counts.fail],
  ['NOT_VERIFIED', assessment.counts.notVerified], ['NOT_APPLICABLE', assessment.counts.notApplicable]]) {
  if (assessment.controls.filter(control => control.postT4 === status).length !== count)
    throw new Error(`ASVS_COUNT_STALE: ${status}`);
}
const open = assessment.controls.filter(control => ['FAIL', 'NOT_VERIFIED'].includes(control.postT4));
const mapped = new Map(classification.controls.map(control => [control.id, control]));
if (mapped.size !== open.length || classification.controls.length !== open.length) throw new Error('RAG_ASVS_CLASSIFICATION_COUNT');
for (const control of open) {
  const row = mapped.get(control.id);
  if (!row || row.asvsStatus !== control.postT4 || row.description !== control.descriptionEn
    || typeof row.blocksT5Start !== 'boolean' || typeof row.verifyDuringT5 !== 'boolean'
    || typeof row.blocksCustomerRelease !== 'boolean' || !row.blocksCustomerRelease
    || !row.reason?.trim() || !row.ownerCapability?.trim() || !row.evidence?.length
    || !['PRE_T5', 'T5', 'CUSTOMER_RELEASE'].includes(row.requiredPhase)
    || (row.requiredPhase === 'PRE_T5') !== row.blocksT5Start
    || (row.requiredPhase === 'T5') !== row.verifyDuringT5
    || (row.blocksT5Start && row.verifyDuringT5))
    throw new Error(`RAG_ASVS_UNCLASSIFIED: ${control.id}`);
}
const t5Delta = classification.controls.filter(control => control.verifyDuringT5);
const backlogIds = new Set(backlog.controls.map(control => control.asvsId));
if (backlogIds.size !== t5Delta.length || backlog.controls.length !== t5Delta.length
  || backlog.source !== 'reports/security/rag-asvs-classification.json') throw new Error('T5_BACKLOG_COUNT');
for (const control of t5Delta) {
  const row = backlog.controls.find(item => item.asvsId === control.id);
  if (!row || row.description !== control.description || row.reason !== control.reason
    || row.t5Capability !== control.ownerCapability || !row.requiredEvidence?.trim()
    || !row.expectedTest?.trim() || !row.releaseImpact?.trim()) throw new Error(`T5_BACKLOG_MISSING: ${control.id}`);
}
const missingPaths = [];
for (const control of classification.controls) for (const path of control.evidence) {
  if (typeof path === 'string' && !path.startsWith('http') && !(await stat(path).catch(() => null))) missingPaths.push(path);
}
if (missingPaths.length) throw new Error(`RAG_ASVS_EVIDENCE_PATH_MISSING: ${missingPaths.slice(0, 5).join(', ')}`);
for (const path of [backlog.governingContract, backlog.securityGate,
  'docs/security/05-t4-rag-security-readiness-fa.md', 'docs/security/07-t4-authority-decision-boundary.md']) {
  if (!(await stat(path).catch(() => null))) throw new Error(`T5_GOVERNING_SOURCE_MISSING: ${path}`);
}
const t5Prompt = await readFile(backlog.governingContract, 'utf8');
for (const source of [backlog.securityGate,
  'docs/security/05-t4-rag-security-readiness-fa.md', 'reports/security/rag-security-gate.json',
  'reports/security/t5-security-delta-backlog.json', 'T5_START_GATE', 'T5_COMPLETION_SECURITY_GATE']) {
  if (!t5Prompt.includes(source)) throw new Error(`T5_PROMPT_GOVERNING_SOURCE_MISSING: ${source}`);
}
for (const obligation of ['FILE MANAGEMENT IS A SHARED PLATFORM CAPABILITY',
  'S3-COMPATIBLE STORAGE', 'AUTHORIZATION AND CACHE', 'POST-T5 SECURITY DELTA',
  'SIEM END-TO-END REVERIFICATION']) {
  if (!t5Prompt.includes(obligation)) throw new Error(`T5_FILE_MANAGEMENT_CONTRACT_MISSING: ${obligation}`);
}
const checks = [
  ['gateSemantics', 'test:security:rag-gate-policy'],
  ['targetTypecheck', 'check:target'],
  ['authorityConformance', 'test:conformance:authority'],
  ['persistedAuthority', 'test:authority:live'],
  ['fileProcessing', 'test:file-security'],
  ['staticHeaders', 'test:security:static-headers'],
  ['releasePolicy', 'test:security:release-policy'],
  ['configuration', 'test:configuration'],
  ['aiRouter', 'test:ai-router'],
  ['securityTelemetry', 'test:security-telemetry'],
  ['tenantIsolation', 'test:tenant-isolation'],
  ['anonymousPublicTools', 'test:public-tools:anonymous'],
  ['authenticatedPublicTools', 'test:public-tools:authenticated'],
  ['architectureAnalyzer', 'test:architecture:self'],
  ['targetArchitecture', 'test:architecture:target'],
  ['targetUiArchitecture', 'test:architecture:target-ui']
];
const results = {};
for (const [name, script] of checks) {
  const result = spawnSync('npm', ['run', script], { env: process.env, encoding: 'utf8', timeout: 180_000 });
  results[name] = {
    status: result.status === 0 && !result.error ? 'PASS' : 'FAIL',
    script,
    exitCode: result.status,
    evidence: `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().slice(-1500)
  };
  console.log(`${name}: ${results[name].status}`);
}
const required = {
  gateSemantics: ['gateSemantics'],
  identity: ['tenantIsolation', 'authenticatedPublicTools'],
  sessionValidation: ['authenticatedPublicTools'],
  tenantIsolation: ['tenantIsolation'],
  authorityCanonicalOwnership: ['architectureAnalyzer', 'targetArchitecture', 'targetUiArchitecture'],
  authorityConformance39: ['authorityConformance'],
  genericPersistedAuthority: ['persistedAuthority'],
  objectAuthorization: ['persistedAuthority'],
  fieldAuthorization: ['persistedAuthority'],
  acl: ['persistedAuthority'],
  classification: ['persistedAuthority'],
  clearance: ['persistedAuthority'],
  ownership: ['persistedAuthority'],
  hierarchicalScope: ['persistedAuthority'],
  explicitDeny: ['persistedAuthority'],
  timedRecurringGrants: ['persistedAuthority'],
  authorizationVersionInvalidation: ['persistedAuthority'],
  originatingSubject: ['persistedAuthority', 'authenticatedPublicTools'],
  authorityDecisionAudit: ['persistedAuthority', 'authenticatedPublicTools', 'architectureAnalyzer'],
  authorityToSiem: ['persistedAuthority', 'securityTelemetry', 'authenticatedPublicTools'],
  auditIntegrityAndRedaction: ['persistedAuthority', 'securityTelemetry'],
  configurationAndSecrets: ['configuration'],
  sqlPersistenceOwnership: ['targetArchitecture'],
  aiRouterBoundary: ['aiRouter', 'targetArchitecture'],
  fileProcessingSafety: ['fileProcessing'],
  crossTenantAttackTests: ['tenantIsolation', 'persistedAuthority'],
  staticSecurityHeaders: ['staticHeaders'],
  customerReleaseBlockedWhileAsvsOpen: ['releasePolicy'],
  targetArchitectureZeroFindings: ['targetArchitecture', 'targetUiArchitecture']
};
const requiredControls = Object.fromEntries(Object.entries(required).map(([name, scripts]) => [name, {
  status: scripts.every(script => results[script].status === 'PASS') ? 'PASS' : 'FAIL',
  evidence: scripts.map(script => `npm run ${results[script].script}`)
}]));
for (const id of ['V8.2.2', 'V8.2.3', 'V8.3.3', 'V16.3.2', 'V5.2.5', 'V5.3.3']) {
  const control = assessment.controls.find(item => item.id === `v5.0.0-${id}`);
  const key = id === 'V8.2.2' ? 'objectAuthorization' : id === 'V8.2.3' ? 'fieldAuthorization'
    : id === 'V8.3.3' ? 'originatingSubject' : id === 'V16.3.2' ? 'authorityDecisionAudit' : 'fileProcessingSafety';
  if (control?.postT4 !== 'PASS') {
    requiredControls[key].status = 'FAIL';
    requiredControls[key].evidence.push(`reports/security/asvs-5.0-l3.json#v5.0.0-${id}`);
  }
}
const pass = Object.entries(requiredControls).filter(([, value]) => value.status === 'PASS').map(([name]) => name);
const { blocksT5Start, releaseBlocks, failedFoundations: fail,
  RAG_SECURITY_GATE: ragGate, ASVS_L3_RELEASE_GATE: asvsGate } = deriveSecurityGates(classification.controls, requiredControls);
const report = {
  status: ragGate,
  checkedAt: new Date().toISOString(),
  RAG_SECURITY_GATE: ragGate,
  T5_START_GATE: ragGate,
  ASVS_L3_RELEASE_GATE: asvsGate,
  openAsvsTotal: open.length,
  blocksT5StartControls: blocksT5Start.map(control => control.id),
  verifyDuringT5Controls: t5Delta.map(control => control.id),
  blocksCustomerReleaseControls: releaseBlocks.map(control => control.id),
  requiredControls,
  pass,
  fail,
  targetArchitectureFindings: results.targetArchitecture.status === 'PASS' && results.targetUiArchitecture.status === 'PASS' ? 0 : null,
  sourceEvidence: ['reports/security/asvs-5.0-l3.json', 'reports/security/rag-asvs-classification.json',
    'reports/security/t5-security-delta-backlog.json', 'docs/security/07-t4-authority-decision-boundary.md',
    ...checks.map(([, script]) => `npm run ${script}`)],
  testResults: results
};
await writeFile('reports/security/rag-security-gate.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`RAG_SECURITY_GATE=${ragGate} ASVS_L3_RELEASE_GATE=${asvsGate} blocksT5Start=${blocksT5Start.length} verifyDuringT5=${t5Delta.length}`);
if (ragGate !== 'YES') process.exitCode = 1;
