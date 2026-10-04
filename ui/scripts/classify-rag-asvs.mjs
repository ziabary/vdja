import { readFile, writeFile } from 'node:fs/promises';

const assessment = JSON.parse(await readFile('reports/security/asvs-5.0-l3.json', 'utf8'));
const T5_CAPABILITIES = {
  'RAG input, output, and rendering': 'V1.1.1 V1.1.2 V1.2.1 V1.2.2 V1.2.3 V1.2.9 V1.3.2 V1.3.3 V1.3.5 V1.3.7 V1.3.10 V1.3.12 V1.4.1 V1.4.2 V1.4.3 V1.5.1 V1.5.2 V1.5.3',
  'Document and File Management lifecycle': 'V2.1.1 V2.1.2 V2.1.3 V2.2.1 V2.2.3 V2.3.1 V2.3.2 V2.3.3 V2.3.4 V5.1.1 V5.2.2 V5.2.4 V5.4.1',
  'Authenticated RAG Web and API': 'V3.2.1 V3.2.2 V3.2.3 V3.4.3 V3.4.5 V3.4.6 V3.4.7 V3.4.8 V3.5.1 V3.5.2 V3.5.7 V3.5.8 V4.1.1 V4.1.4',
  'Document authorization and transfer': 'V8.1.3 V8.1.4 V8.4.2 V10.1.1 V15.3.1 V15.4.2',
  'Storage, S3, and protected egress': 'V4.2.5 V11.2.5 V11.5.1 V11.5.2 V12.3.1 V12.3.2 V12.3.3 V12.3.4 V12.3.5 V13.1.1 V13.1.2 V13.1.3 V13.2.1 V13.2.2 V13.2.3 V13.2.4 V13.2.5 V13.2.6 V13.3.2 V15.3.2',
  'Document and RAG sensitive data': 'V11.7.2 V14.1.1 V14.1.2 V14.2.2 V14.2.3 V14.2.4 V14.2.5 V14.2.6 V14.2.7 V14.3.1 V14.3.2',
  'RAG resources and dangerous components': 'V15.1.3 V15.1.4 V15.1.5 V15.2.5 V15.3.6 V15.3.7 V15.4.3 V15.4.4',
  'T5 Audit and recovery': 'V16.1.1 V16.2.1 V16.2.2 V16.2.3 V16.2.5 V16.3.3 V16.3.4 V16.4.1 V16.4.2 V16.4.3 V16.5.3 V16.5.4'
};
const PRE_T5_FOUNDATIONS = new Map(Object.entries({
  'V8.2.2': 'Object-level Authority decisions must precede protected Document retrieval.',
  'V8.2.3': 'Field-level Authority decisions must precede protected Document field materialization.',
  'V8.3.3': 'The originating HUMAN must survive delegated protected retrieval.',
  'V16.3.2': 'Every current production Authority decision must emit durable semantic Audit before returning.',
  'V5.2.5': 'Current archive symlink rejection must be safe before Document ingress extends it.',
  'V5.3.3': 'Current archive path validation must be safe before Document ingress extends it.'
}));
const t5ById = new Map();
for (const [capability, list] of Object.entries(T5_CAPABILITIES)) {
  for (const id of list.split(' ')) {
    if (t5ById.has(id)) throw new Error(`DUPLICATE_T5_CONTROL: ${id}`);
    t5ById.set(id, capability);
  }
}
const open = assessment.controls.filter(control => ['FAIL', 'NOT_VERIFIED'].includes(control.postT4));
const byShortId = new Map(assessment.controls.map(control => [control.id.replace(/^v5\.0\.0-/, ''), control]));
for (const [id, foundation] of PRE_T5_FOUNDATIONS) {
  const control = byShortId.get(id);
  if (!control) throw new Error(`PRE_T5_CONTROL_MISSING: ${id}`);
  if (control.postT4 !== 'PASS' && !foundation) throw new Error(`PRE_T5_REASON_MISSING: ${id}`);
}
for (const id of t5ById.keys()) if (!byShortId.has(id)) throw new Error(`T5_CONTROL_MISSING: ${id}`);
const controls = open.map(control => {
  const shortId = control.id.replace(/^v5\.0\.0-/, '');
  const foundation = PRE_T5_FOUNDATIONS.get(shortId);
  const t5Capability = t5ById.get(shortId);
  // A future T5 surface cannot be evidence for a prerequisite to starting T5.
  if (foundation && t5Capability) throw new Error(`FOUNDATION_T5_CONFLICT: ${shortId}`);
  const blocksT5Start = Boolean(foundation);
  const verifyDuringT5 = Boolean(t5Capability);
  const reason = foundation
    ? `If ${shortId} is not proven before T5 starts, T5 would be built on an unsafe foundation because ${foundation} Open requirement: ${control.descriptionEn}`
    : t5Capability
      ? `${shortId} requires evidence from the T5 ${t5Capability} surface. ${control.descriptionEn} This evidence is mandatory during T5 and cannot be complete before that surface exists.`
      : `${shortId} remains open for customer Level 3 release. ${control.descriptionEn} Current gap: ${control.missingEvidence ?? control.remediation} This gap does not require a foundational change before T5 development begins.`;
  return {
    id: control.id,
    asvsStatus: control.postT4,
    description: control.descriptionEn,
    blocksT5Start,
    verifyDuringT5,
    blocksCustomerRelease: true,
    reason,
    ownerCapability: t5Capability ?? control.ownerCapability ?? control.chapter,
    evidence: control.sourceOrTestPaths,
    requiredPhase: blocksT5Start ? 'PRE_T5' : verifyDuringT5 ? 'T5' : 'CUSTOMER_RELEASE'
  };
});
const delta = controls.filter(control => control.verifyDuringT5).map(control => {
  const source = byShortId.get(control.id.replace(/^v5\.0\.0-/, ''));
  return {
    asvsId: control.id,
    description: control.description,
    reason: control.reason,
    t5Capability: control.ownerCapability,
    requiredEvidence: source.missingEvidence ?? source.remediation,
    expectedTest: `Test ${control.description} against the implemented ${control.ownerCapability} path; include a failing case and the relevant tenant/authorization boundary where applicable, then record source and test evidence.`,
    releaseImpact: 'Blocks ASVS Level 3 customer release until PASS or justified NOT_APPLICABLE.'
  };
});
await writeFile('reports/security/rag-asvs-classification.json', `${JSON.stringify({
  source: 'reports/security/asvs-5.0-l3.json',
  standard: 'OWASP ASVS 5.0 Level 3',
  policy: 'Each open control has independent T5-start, T5-verification, and customer-release dimensions. T5-created surfaces cannot block T5 start; all open applicable controls block customer release.',
  controls
}, null, 2)}\n`);
await writeFile('reports/security/t5-security-delta-backlog.json', `${JSON.stringify({
  source: 'reports/security/rag-asvs-classification.json',
  governingContract: 'docs/prompts/T5-final.md',
  securityGate: 'docs/security/06-t5-genai-rag-security-gate.md',
  controls: delta
}, null, 2)}\n`);
console.log(`Classified ${controls.length} open controls: ${controls.filter(control => control.blocksT5Start).length} T5-start blockers, ${delta.length} T5 delta, ${controls.length} release blockers`);
