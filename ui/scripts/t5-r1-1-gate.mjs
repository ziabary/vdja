import {readFile,writeFile} from 'node:fs/promises';
import {currentEvidence} from './t5-evidence-gate.mjs';
import {ociSourceFingerprint,sourceFingerprint,verificationContractFingerprint} from './t5-r1-source.mjs';
import {verifyImageCoverage} from './t5-supply-policy.mjs';

const read=async path=>JSON.parse(await readFile(path,'utf8'));
const current={...await sourceFingerprint(),...await verificationContractFingerprint()},ociHash=await ociSourceFingerprint();
const [execution,acceptance,authority,service,supply,oci,asvs,completion,protectedPaths,preliminary,evidence]=await Promise.all([
 read('tests/reports/t5-r1-execution.json'),read('reports/security/t5-acceptance-evidence.json'),read('reports/security/t5-authority-inventory.json'),
 read('reports/security/t5-service-boundary-assessment.json'),read('reports/security/t5-supply-chain.json'),read('tests/reports/oci/acceptance.json'),
 read('reports/security/asvs-5.0-l3.json'),read('reports/security/t5-completion-gate.json'),read('reports/security/t5-protected-paths-after.json'),
 read('reports/security/t5-preliminary-gates.json'),currentEvidence()]);
const coverage=await verifyImageCoverage(supply,oci,ociHash,current.verificationContractHash);
const currentArtifact=record=>record?.sourceHash===current.sourceHash&&record?.verificationContractHash===current.verificationContractHash;
const meta=[50,89,90].map(number=>evidence.criteria.find(item=>item.criterionNumber===number));
const familyStatuses=authority.operationFamilies??[];
const familyCount=familyStatuses.filter(family=>family.status==='PASS').length;
const checks={
 currentExecution:currentArtifact(execution)&&execution.status==='PASS'&&execution.results.every(result=>result.status==='PASS'&&result.skipped===0),
 criterionMap:evidence.status==='PASS'&&evidence.criteria.length===100&&new Set(evidence.criteria.map(item=>item.criterionNumber)).size===100,
 noBroadFeaturePass:evidence.broadFeatureDerivedPassCount===0,
 metaFromCanonicalGates:meta.every(item=>item?.evidenceKind==='DERIVED_CANONICAL_GATE'&&item.status!=='NOT_VERIFIED'&&item.evidence.length===1),
 contractBound:[acceptance,authority,service,asvs.t5Assessment,completion,preliminary].every(currentArtifact)
  &&supply.sourceHash===ociHash&&supply.verificationContractHash===current.verificationContractHash,
 staleEvidenceSelfTests:execution.results.some(result=>result.name==='r1-hardening'&&result.status==='PASS'
  &&result.command.includes('tests/target/t5-evidence-selftest.test.mjs')),
 authorityInventory:currentArtifact(authority)&&authority.productionAuthorityBypasses===0&&familyStatuses.length>=15
  &&familyStatuses.every(family=>family.status==='PASS'||family.status==='NOT_VERIFIED'&&family.missingBranches?.length>0)
  &&authority.allPostT5DecisionsAudited===(familyStatuses.every(family=>family.status==='PASS')?'PASS':'NOT_VERIFIED'),
 imageCoverage:coverage.status==='PASS'&&coverage.covered===9&&coverage.uncoveredImages===0,
 serviceBoundarySplit:currentArtifact(service)&&service.boundaries.length===6&&['V12_3_5','V13_2_1'].every(key=>
  ['PASS','GAP','NOT_VERIFIED'].includes(service.controls[key]?.platformCapabilityStatus)
  &&['PASS','FAIL','NOT_VERIFIED'].includes(service.controls[key]?.customerDeploymentStatus)),
 currentAsvs:currentArtifact(asvs.t5Assessment)&&asvs.controls.length===345,
 protectedSources:protectedPaths.status==='PASS'&&protectedPaths.unauthorizedCount===0,
 finalT5Gate:currentArtifact(completion)&&completion.acceptanceEvidenceStatus==='PASS'
};
const status=Object.values(checks).every(Boolean)?'COMPLETE':'PARTIAL';
const result={generatedAt:new Date().toISOString(),sourceHash:current.sourceHash,verificationContractHash:current.verificationContractHash,status,checks,
 acceptance:{total:evidence.criteria.length,pass:evidence.passCount,fail:evidence.failCount,notVerified:evidence.notVerifiedCount,notApplicable:evidence.notApplicableCount,
  direct:evidence.directEvidenceCount,broadFeatureDerivedPass:evidence.broadFeatureDerivedPassCount},
 authority:{postT5Consumers:authority.postT5Consumers,productionBypasses:authority.productionAuthorityBypasses,operationFamiliesPassed:familyCount,
  operationFamiliesApplicable:familyStatuses.length,allPostT5DecisionsAudited:authority.allPostT5DecisionsAudited},
 imageCoverage:coverage,serviceControls:service.controls,t5:completion.T5,genai:completion.GENAI_RAG_SECURITY_GATE,
 t5Security:completion.T5_COMPLETION_SECURITY_GATE,asvsRelease:completion.ASVS_L3_RELEASE_GATE,
 asvs:asvs.postT5Counts,t5Blockers:asvs.t5Assessment.blockingFindings,releaseOnlyBlockers:asvs.t5Assessment.releaseOnlyBlockingFindings};
await writeFile('reports/security/t5-r1-1-verification.json',JSON.stringify(result,null,2)+'\n');
await writeFile('docs/verification/04-t5-r1-1-verification-fa.md',`# راستی‌آزمایی T5-R1.1\n\nمنبع ماشینی: \`reports/security/t5-r1-1-verification.json\`. زمان: ${result.generatedAt}.\n\n- وضعیت خود وظیفه: ${status}\n- هش قرارداد راستی‌آزمایی: \`${current.verificationContractHash}\`\n- معیارها: PASS ${evidence.passCount}، FAIL ${evidence.failCount}، NOT_VERIFIED ${evidence.notVerifiedCount}، N/A ${evidence.notApplicableCount}\n- PASS ناشی از feature flag کلی: ${evidence.broadFeatureDerivedPassCount}\n- خانواده‌های Authority با شاهد کامل ALLOW و DENY و Audit و SIEM: ${familyCount}/${familyStatuses.length}؛ وضعیت کل: ${authority.allPostT5DecisionsAudited}\n- تصویرهای پذیرش پوشش‌داده‌شده: ${coverage.covered}/9؛ گروه‌های scan: ${coverage.uniqueRuntimeSets}؛ بدون پوشش: ${coverage.uncoveredImages}\n- یافته‌های HIGH/CRITICAL یکتای runtime: ${coverage.shippedRuntimeHighCritical}؛ دارای اصلاح موجود: ${coverage.fixAvailable}\n- T5: ${completion.T5}؛ GenAI/RAG: ${completion.GENAI_RAG_SECURITY_GATE}؛ مجوز انتشار ASVS L3: ${completion.ASVS_L3_RELEASE_GATE}\n\nاین نتیجهٔ محلی رفتار مدل واقعی، گواهی/هویت سرویس مشتری یا انتشار را تأیید نمی‌کند. شاخه‌های اثبات‌نشدهٔ Authority، وضعیت توان پلتفرم و وضعیت استقرار برای هر مرز در artifactهای جداگانه ثبت شده‌اند.\n\n| شرط T5-R1.1 | نتیجه |\n| --- | --- |\n${Object.entries(checks).map(([name,passed])=>`| ${name} | ${passed?'PASS':'FAIL'} |`).join('\n')}\n`);
console.log(JSON.stringify({T5_R1_1:status,checks,acceptance:result.acceptance,imageCoverage:coverage}));
if(status!=='COMPLETE')process.exitCode=1;
