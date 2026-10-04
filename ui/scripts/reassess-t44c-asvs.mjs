import { readFile, writeFile } from 'node:fs/promises';

const path = 'reports/security/asvs-5.0-l3.json';
const assessment = JSON.parse(await readFile(path, 'utf8'));
const proven = new Map(Object.entries({
  'V8.2.2': {
    finding: 'Current target object decisions use persisted Authority facts and an audited application service; denied fixture payloads are never materialized.',
    paths: ['packages/authority/src/service.ts', 'packages/authority/src/persistence.generic.ts', 'tests/target/t44-authority-live.integration.test.ts', 'tests/architecture/staticAnalysis.test.ts']
  },
  'V8.2.3': {
    finding: 'Current target field permission paths are evaluated by the canonical Authority service; actors receive distinct authorized projections.',
    paths: ['packages/authority/src/service.ts', 'tests/target/t44-authority-live.integration.test.ts']
  },
  'V8.3.3': {
    finding: 'The target API carries the initiating HUMAN identity from the verified session; delegated service tests retain that actor, tenant, request, correlation and session for Authority and Audit.',
    paths: ['apps/api/src/index.ts', 'packages/authority/src/service.ts', 'tests/target/t44-authority-live.integration.test.ts', 'tests/target/t4-authenticated-public.integration.test.ts']
  },
  'V5.2.5': {
    finding: 'The current DOCX/ODT ingress precheck rejects ZIP symlink entries before parser invocation; the target path accepts no general-purpose ZIP upload.',
    paths: ['packages/file-processing/src/office-archive.ts', 'packages/file-processing/src/index.ts', 'tests/target/t4-file-security.test.ts']
  },
  'V5.3.3': {
    finding: 'The current office archive precheck rejects traversal and absolute member paths, and conversion uses generated temporary paths rather than user filenames.',
    paths: ['packages/file-processing/src/office-archive.ts', 'packages/file-processing/src/index.ts', 'tests/target/t4-file-security.test.ts']
  },
  'V3.4.4': {
    finding: 'The target API applies nosniff in global middleware and the release Web process applies it before SvelteKit handles static and HTML responses.',
    paths: ['apps/api/src/index.ts', 'deploy/web-security-headers.mjs', 'tests/target/t44-static-headers.integration.test.mjs', 'tests/target/t4-auth-http.integration.test.ts']
  },
  'V16.3.2': {
    finding: 'All current target production Authority consumers route through clsAuthorityService. ALLOW and DENY, including sensitive object access, commit redacted semantic Audit before the result is returned; a static guard prohibits pure-evaluator bypasses.',
    paths: ['apps/api/src/index.ts', 'apps/api/src/composition.ts', 'packages/authority/src/service.ts', 'packages/audit/src/persistence/security.ts', 'tests/target/t44-authority-live.integration.test.ts', 'tests/target/t4-authenticated-public.integration.test.ts', 'tests/architecture/staticAnalysis.test.ts']
  }
}));
const updatedOpen = new Map(Object.entries({
  'V3.4.3': 'The release Web process now covers static assets and HTML has nonce CSP, but CSP coverage across the API response surface and customer edge has not been proved.',
  'V3.4.6': 'The release Web process now sends frame-ancestors for static and HTML responses, but the API and customer edge still need response-wide evidence.',
  'V3.4.7': 'The release Web process now sends report-uri on static and HTML responses and the API accepts bounded reports; response-wide and customer-edge evidence remains open.',
  'V5.2.2': 'Current extension, MIME and signature checks are tested, but the exact file-content guarantee across all accepted formats and the future T5 File Management ingress remains unverified.',
  'V16.4.2': 'API and Worker database roles cannot update or delete canonical semantic Audit; protection of all operational log stores and customer infrastructure remains unverified.'
}));
for (const control of assessment.controls) {
  const id = control.id.replace(/^v5\.0\.0-/, '');
  const proof = proven.get(id);
  if (proof) {
    control.postT4 = 'PASS';
    control.evidence = [proof.finding];
    control.sourceOrTestPaths = proof.paths;
    control.missingEvidence = null;
    control.remediation = 'Verified for the current target production surface; re-evaluate new T5 surfaces during T5.';
    control.riskIfFailed = null;
    control.implementationRequired = false;
    control.manualDeploymentVerificationRequired = false;
    control.recommendedNextPhase = 'T5_DELTA';
    control.reviewedAt = '2026-10-03';
  } else if (updatedOpen.has(id)) {
    const finding = updatedOpen.get(id);
    control.evidence = [finding];
    control.missingEvidence = finding;
    control.remediation = finding;
    control.reviewedAt = '2026-10-03';
  }
}
for (const id of proven.keys()) if (!assessment.controls.some(control => control.id === `v5.0.0-${id}`))
  throw new Error(`ASVS_CONTROL_MISSING: ${id}`);
assessment.counts.postPass = assessment.controls.filter(control => control.postT4 === 'PASS').length;
assessment.counts.fail = assessment.controls.filter(control => control.postT4 === 'FAIL').length;
assessment.counts.notVerified = assessment.controls.filter(control => control.postT4 === 'NOT_VERIFIED').length;
assessment.counts.notApplicable = assessment.controls.filter(control => control.postT4 === 'NOT_APPLICABLE').length;
assessment.counts.applicable = assessment.controls.length - assessment.counts.notApplicable;
assessment.counts.blocking = assessment.counts.fail + assessment.counts.notVerified;
assessment.applicabilityPolicy = 'T4.4-C reassessment applies the exact ASVS wording to current target production surfaces only. New T5 Document, File Management and RAG surfaces require T5 delta verification. PASS requires source and executed test evidence; customer release still requires closure of all applicable controls.';
await writeFile(path, `${JSON.stringify(assessment, null, 2)}\n`);
console.log(JSON.stringify(assessment.counts));
