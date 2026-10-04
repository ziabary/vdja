import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const gate = process.argv[2];
if (gate === 'asvs-l3') {
  const assessment = JSON.parse(await readFile('reports/security/asvs-5.0-l3.json', 'utf8'));
  if (assessment.version !== '5.0.0' || assessment.controls.length !== 345) throw new Error('ASVS_EVIDENCE_INCOMPLETE');
  const ids = new Set();
  for (const control of assessment.controls) {
    if (ids.has(control.id) || !/^v5\.0\.0-V\d+\.\d+\.\d+$/.test(control.id)) throw new Error('ASVS_DUPLICATE_OR_INVALID_ID');
    ids.add(control.id);
    if (!control.descriptionEn?.trim() || !control.descriptionFa?.trim())
      throw new Error(`ASVS_DESCRIPTION_MISSING: ${control.id}`);
    if (!['PASS', 'FAIL', 'NOT_APPLICABLE', 'NOT_VERIFIED'].includes(control.postT4)) throw new Error(`ASVS_INVALID_STATUS: ${control.id}`);
    if (control.postT4 === 'PASS' && (!control.evidence?.length || !control.sourceOrTestPaths?.length))
      throw new Error(`ASVS_PASS_WITHOUT_EVIDENCE: ${control.id}`);
    if (control.postT4 === 'FAIL' && (!control.evidence?.length || !control.sourceOrTestPaths?.length))
      throw new Error(`ASVS_FAIL_WITHOUT_EVIDENCE: ${control.id}`);
    if (control.postT4 === 'NOT_APPLICABLE' && (!control.notApplicableReason?.trim() || !control.sourceOrTestPaths?.length))
      throw new Error(`ASVS_NA_WITHOUT_REASON: ${control.id}`);
    if (control.postT4 === 'NOT_VERIFIED' && (!control.missingEvidence?.trim() || !control.sourceOrTestPaths?.length))
      throw new Error(`ASVS_UNVERIFIED_WITHOUT_GAP: ${control.id}`);
  }
  const counts = { total: assessment.controls.length,
    postPass: assessment.controls.filter(control => control.postT4 === 'PASS').length,
    fail: assessment.controls.filter(control => control.postT4 === 'FAIL').length,
    notVerified: assessment.controls.filter(control => control.postT4 === 'NOT_VERIFIED').length,
    notApplicable: assessment.controls.filter(control => control.postT4 === 'NOT_APPLICABLE').length,
    applicable: assessment.controls.filter(control => control.postT4 !== 'NOT_APPLICABLE').length,
    blocking: assessment.controls.filter(control => control.postT4 !== 'PASS' && control.postT4 !== 'NOT_APPLICABLE').length };
  for (const [key, value] of Object.entries(counts)) if (assessment.counts[key] !== value) throw new Error(`ASVS_STALE_COUNT: ${key}`);
  for(const control of assessment.controls)if(control.postT5!==undefined){
    if(!['PASS','FAIL','NOT_APPLICABLE','NOT_VERIFIED'].includes(control.postT5)||!control.t5Verification?.observed||!control.t5Verification?.evidencePaths?.length)
      throw new Error(`ASVS_T5_EVIDENCE_INCOMPLETE:${control.id}`);
  }
  if(assessment.postT5Counts)for(const status of ['PASS','FAIL','NOT_APPLICABLE','NOT_VERIFIED'])
    if(assessment.postT5Counts[status]!==assessment.controls.filter(control=>(control.postT5??control.postT4)===status).length)throw new Error(`ASVS_T5_STALE_COUNT:${status}`);
  const open = assessment.controls.filter(control => {
    const status=control.postT5??control.postT4;
    return status!=='PASS'&&!(status==='NOT_APPLICABLE'&&(control.t5Verification?.observed||control.notApplicableReason));
  });
  if (open.length) throw new Error(`ASVS_L3_GATE_OPEN: ${open.length} requirements are not verified as PASS or justified N/A`);
  console.log('ASVS 5.0.0 Level 3 gate PASS');
} else if (['tenant-isolation', 'public-tools-anonymous', 'public-tools-authenticated', 'public-tools-limits'].includes(gate)) {
  if (!process.env.T4_PG_CONFIG || !process.env.T4_SECRETS_DIR)
    throw new Error(`T4_LIVE_CONFIG_REQUIRED: ${gate} requires T4_PG_CONFIG and T4_SECRETS_DIR`);
  const result = spawnSync(process.execPath,
    ['--import', 'tsx', '--test', 'tests/target/t4-authenticated-public.integration.test.ts'],
    { stdio: 'inherit', env: { ...process.env, T4_REQUIRE_LIVE: '1' } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`T4_GATE_FAILED: ${gate} (${result.status ?? 'signal'})`);
} else {
  throw new Error(`Unknown T4 gate: ${gate ?? '(missing)'}`);
}
