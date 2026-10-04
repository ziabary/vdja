import {readFile,writeFile} from 'node:fs/promises';
import {acceptanceCriteria,currentEvidence} from './t5-evidence-gate.mjs';
import {ociSourceFingerprint,sourceFingerprint,verificationContractFingerprint} from './t5-r1-source.mjs';
import {verifyImageCoverage} from './t5-supply-policy.mjs';

const read=async path=>JSON.parse(await readFile(path,'utf8'));
const optional=async(path,fallback)=>{try{return await read(path);}catch{return fallback;}};
const current={...await sourceFingerprint(),...await verificationContractFingerprint()},ociSourceHash=await ociSourceFingerprint();
const sourceCriteria=acceptanceCriteria(await readFile('docs/prompts/T5-final.md','utf8'));
const evidence=await currentEvidence().catch(error=>({status:'FAIL',errors:[String(error)],criteria:sourceCriteria.map(value=>({
 ...value,status:'NOT_VERIFIED',evidenceKind:'DIRECT_EXECUTED_TEST',reason:'Evidence map missing or unreadable',evidence:[]})),
 passCount:0,failCount:0,notApplicableCount:0,directEvidenceCount:0,notVerifiedCount:100,broadFeatureDerivedPassCount:0}));
const assessment=await read('reports/security/asvs-5.0-l3.json');
const startGate=await read('reports/security/rag-security-gate.json');
const execution=await optional('tests/reports/t5-r1-execution.json',null);
const protectedPaths=await optional('reports/security/t5-protected-paths-after.json',{unauthorizedCount:null,status:'NOT_VERIFIED'});
const supply=await optional('reports/security/t5-supply-chain.json',{status:'NOT_VERIFIED'});
const oci=await optional('tests/reports/oci/acceptance.json',{status:'NOT_VERIFIED'});
const models=await optional('reports/security/t5-live-model-evidence.json',{status:'NOT_VERIFIED',reason:'ACTUAL_APPROVED_MODEL_CONFIG_REQUIRED'});
const inventory=await optional('reports/security/t5-authority-inventory.json',{sourceHash:null,postT5Consumers:0,productionAuthorityBypasses:null,allPostT5DecisionsAudited:'NOT_VERIFIED'});
const preliminary=await optional('reports/security/t5-preliminary-gates.json',{sourceHash:null,GENAI_RAG_SECURITY_GATE:'FAIL',T5_COMPLETION_SECURITY_GATE:'FAIL',genaiChecks:{}});
const suite=name=>execution?.sourceHash===current.sourceHash&&execution.results?.some(result=>result.name===name&&result.status==='PASS'&&result.exitCode===0&&result.skipped===0);
const currentExecution=execution?.sourceHash===current.sourceHash&&execution?.verificationContractHash===current.verificationContractHash&&execution.status==='PASS';
const currentAssessment=assessment.t5Assessment?.sourceHash===current.sourceHash&&assessment.t5Assessment?.verificationContractHash===current.verificationContractHash;
const currentInventory=inventory.sourceHash===current.sourceHash&&inventory.verificationContractHash===current.verificationContractHash;
const currentPreliminary=preliminary.sourceHash===current.sourceHash&&preliminary.verificationContractHash===current.verificationContractHash;
const currentOci=oci.status==='PASS'&&oci.results?.every(result=>result.sourceHash===ociSourceHash);
const supplyCoverage=await verifyImageCoverage(supply,oci,ociSourceHash,current.verificationContractHash);
const currentSupply=supply.status==='PASS'&&currentOci&&supplyCoverage.status==='PASS'&&supplyCoverage.fixAvailable===0;
const protectedCurrent=protectedPaths.status==='PASS'&&protectedPaths.unauthorizedCount===0;
const genaiChecks=currentPreliminary?preliminary.genaiChecks:{};
const genai=currentPreliminary?preliminary.GENAI_RAG_SECURITY_GATE:'FAIL';
const t5Blockers=currentAssessment?assessment.t5Assessment.blockingFindings:null;
const releaseBlockers=currentAssessment?assessment.t5Assessment.releaseOnlyBlockingFindings:null;
const security=currentPreliminary&&preliminary.T5_COMPLETION_SECURITY_GATE==='PASS'&&t5Blockers===0&&currentSupply&&protectedCurrent?'PASS':'FAIL';
const completion=startGate.RAG_SECURITY_GATE==='YES'&&security==='PASS'&&currentExecution&&currentOci
 &&evidence.status==='PASS'&&evidence.passCount===100&&evidence.notVerifiedCount===0&&evidence.failCount===0
 &&suite('r1-hardening')&&suite('browser')&&suite('t5-architecture')?'COMPLETE':'PARTIAL';
const unmet=[];
if(!currentExecution)unmet.push('CURRENT_T5_R1_EXECUTION_REQUIRED');
if(evidence.status!=='PASS')unmet.push('ACCEPTANCE_EVIDENCE_MAP_INVALID');
if(evidence.notVerifiedCount)unmet.push('ACCEPTANCE_CRITERIA_NOT_VERIFIED');
if(!currentAssessment)unmet.push('CURRENT_ASVS_REASSESSMENT_REQUIRED');
if(!currentInventory)unmet.push('CURRENT_AUTHORITY_INVENTORY_REQUIRED');
if(!currentPreliminary)unmet.push('CURRENT_PRELIMINARY_GATES_REQUIRED');
if(inventory.allPostT5DecisionsAudited!=='PASS')unmet.push('POST_T5_ALLOW_DENY_AUDIT_COVERAGE_REQUIRED');
if(!currentOci)unmet.push('CURRENT_OCI_ACCEPTANCE_REQUIRED');
if(!currentSupply)unmet.push('CURRENT_SHIPPED_RUNTIME_SUPPLY_SCAN_REQUIRED');
if(models.status!=='PASS')unmet.push(models.reason??'ACTUAL_APPROVED_MODEL_CONFIG_REQUIRED');
if(!protectedCurrent)unmet.push('CURRENT_PROTECTED_PATH_GATE_REQUIRED');
const result={generatedAt:new Date().toISOString(),sourceHash:current.sourceHash,verificationContractHash:current.verificationContractHash,T5:completion,
 T5_START_GATE:startGate.RAG_SECURITY_GATE==='YES'?'PASS':'FAIL',T5_COMPLETION_SECURITY_GATE:security,
 RAG_SECURITY_GATE:startGate.RAG_SECURITY_GATE,GENAI_RAG_SECURITY_GATE:genai,
 ASVS_L3_RELEASE_GATE:currentAssessment?assessment.t5Assessment.ASVS_L3_RELEASE_GATE:'NO',
 featureAcceptance:currentExecution?'PASS':'NOT_VERIFIED',ociAcceptance:currentOci?'PASS':'NOT_VERIFIED',
 modelAcceptance:models.status,supplyChainAcceptance:currentSupply?'PASS':supply.status==='FAIL'?'FAIL':'NOT_VERIFIED',
 genaiChecks,asvs:currentAssessment?assessment.postT5Counts:null,t5BlockingFindings:t5Blockers,
 releaseOnlyBlockingFindings:releaseBlockers,unauthorizedProtectedChanges:protectedPaths.unauthorizedCount,
 postT5AuthorityConsumers:currentInventory?inventory.postT5Consumers:null,productionAuthorityBypasses:currentInventory?inventory.productionAuthorityBypasses:null,
 allPostT5DecisionsAudited:inventory.allPostT5DecisionsAudited,acceptanceEvidenceStatus:evidence.status,
 acceptanceCriteriaPass:evidence.passCount,acceptanceCriteriaFail:evidence.failCount,acceptanceCriteriaNotApplicable:evidence.notApplicableCount,
 acceptanceCriteriaWithDirectEvidence:evidence.directEvidenceCount,acceptanceCriteriaNotVerified:evidence.notVerifiedCount,
 broadFeatureFlagDerivedPass:evidence.broadFeatureDerivedPassCount,approvedExceptions:assessment.t5Assessment?.approvedExceptions??0,
 customerReleaseAuthorized:false,readyForNextBusinessModule:completion==='COMPLETE',additionalUnmetRequirements:[...new Set(unmet)],
 criteria:evidence.criteria};
await writeFile('reports/security/t5-completion-gate.json',JSON.stringify(result,null,2)+'\n');
const rows=evidence.criteria.map(c=>`| ${c.criterionNumber} | ${c.criterionText.replaceAll('|','\\|')} | ${c.status} | ${c.evidence?.map(item=>item.testCase).join('; ')||c.reason||'—'} |`);
await writeFile('docs/security/03-t5-rag-security-delta-fa.md',`# وضعیت جاری امنیت Document / Knowledge / RAG پس از T5-R1

این سند از \`reports/security/t5-completion-gate.json\` و نقشهٔ شاهد معیارها تولید می‌شود. تاریخ: ${result.generatedAt}.

| Gate | نتیجه |
| --- | --- |
| T5 | ${completion} |
| T5_COMPLETION_SECURITY_GATE | ${security} |
| GENAI_RAG_SECURITY_GATE | ${genai} |
| ASVS_L3_RELEASE_GATE | ${result.ASVS_L3_RELEASE_GATE} |
| معیار با شاهد مستقیم و اجرای جاری | ${evidence.directEvidenceCount}/100 |
| معیار NOT_VERIFIED | ${evidence.notVerifiedCount} |
| PASS مشتق از feature flag کلی | ${evidence.broadFeatureDerivedPassCount} |
| مانع T5 با ارزیابی جاری | ${t5Blockers??'NOT_VERIFIED'} |
| تغییر غیرمجاز protected | ${protectedPaths.unauthorizedCount??'NOT_VERIFIED'} |

آزمون‌های محلی از PostgreSQL، Qdrant، Storage و fixture پروتکل provider استفاده می‌کنند. این‌ها شاهد رفتار مدل واقعی یا زیرساخت مشتری نیستند. نتیجهٔ قدیمی PASS معیارها به وضعیت جاری منتقل نشده است.

## الزامات باز

${result.additionalUnmetRequirements.map(value=>'- '+value).join('\n')}

## معیارهای پذیرش

| شماره | معیار | نتیجه | شاهد مستقیم یا علت باز بودن |
| --- | --- | --- | --- |
${rows.join('\n')}

مجوز انتشار سطح ۳ مشتری: NO.
`);
console.log(JSON.stringify({T5:completion,T5_COMPLETION_SECURITY_GATE:security,GENAI_RAG_SECURITY_GATE:genai,
 acceptanceEvidenceStatus:evidence.status,directEvidenceCount:evidence.directEvidenceCount,notVerifiedCount:evidence.notVerifiedCount}));
if(completion!=='COMPLETE')process.exitCode=1;
