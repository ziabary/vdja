import {readFile,writeFile} from 'node:fs/promises';
import {acceptanceCriteria,verifyAcceptanceEvidence} from './t5-evidence-gate.mjs';
import {ociSourceFingerprint,sourceFingerprint,verificationContractFingerprint} from './t5-r1-source.mjs';
import {verifyImageCoverage} from './t5-supply-policy.mjs';

const read=async path=>JSON.parse(await readFile(path,'utf8'));
const optional=async path=>{try{return await read(path);}catch{return null;}};
const current={...await sourceFingerprint(),...await verificationContractFingerprint()};
const [execution,direct,assessment,inventory,supply,oci,models,protectedPaths]=await Promise.all([
 read('tests/reports/t5-r1-execution.json'),read('reports/security/t5-direct-evidence.json'),read('reports/security/asvs-5.0-l3.json'),
 read('reports/security/t5-authority-inventory.json'),optional('reports/security/t5-supply-chain.json'),read('tests/reports/oci/acceptance.json'),
 optional('reports/security/t5-live-model-evidence.json'),optional('reports/security/t5-protected-paths-after.json')]);
const expected=acceptanceCriteria(await readFile('docs/prompts/T5-final.md','utf8'));
const verified=await verifyAcceptanceEvidence(direct,execution,current,undefined,expected);
const sourceCurrent=execution.sourceHash===current.sourceHash&&execution.verificationContractHash===current.verificationContractHash&&execution.status==='PASS';
const asvsCurrent=assessment.t5Assessment?.sourceHash===current.sourceHash&&assessment.t5Assessment.verificationContractHash===current.verificationContractHash;
const inventoryCurrent=inventory.sourceHash===current.sourceHash&&inventory.verificationContractHash===current.verificationContractHash;
const ociSourceHash=await ociSourceFingerprint(),ociCurrent=oci.status==='PASS'&&oci.results?.length===3&&oci.results.every(result=>result.sourceHash===ociSourceHash&&result.status==='PASS');
const supplyCoverage=await verifyImageCoverage(supply,oci,ociSourceHash,current.verificationContractHash);
const supplyCurrent=supplyCoverage.status==='PASS'&&supplyCoverage.fixAvailable===0;
const modelCurrent=models?.status==='PASS'&&models?.sourceHash===current.sourceHash&&models?.verificationContractHash===current.verificationContractHash&&models?.scope?.includes('ACTUAL_MODELS');
const specific=(...ids)=>ids.every(id=>verified.criteria.find(item=>item.criterionNumber===id)?.status==='PASS');
const platformChecks={authorityBeforeRetrieval:specific(14),finalCandidateBeforeMaterialization:specific(15),tenantAndClassificationIsolation:specific(21,22),
 rerankerAndLlmExclusion:specific(16,17),citationAndQuote:specific(19,20),protectedEgress:specific(25,26),boundedContext:specific(31),
 promptInjectionPlatform:specific(32),browserEscaping:specific(38),auditAndSiem:sourceCurrent&&execution.results.some(item=>item.name==='audit-siem'&&item.status==='PASS'&&item.skipped===0)};
const genaiChecks={...platformChecks,actualApprovedModels:modelCurrent,actualModelBrowser:modelCurrent&&models.browserEndToEnd==='PASS'};
const genai=verified.status==='PASS'&&Object.values(genaiChecks).every(Boolean)?'PASS':'FAIL';
const security=sourceCurrent&&asvsCurrent&&assessment.t5Assessment.blockingFindings===0&&inventoryCurrent&&inventory.productionAuthorityBypasses===0
 &&inventory.allPostT5DecisionsAudited==='PASS'&&ociCurrent&&supplyCurrent&&protectedPaths?.status==='PASS'&&protectedPaths.unauthorizedCount===0&&genai==='PASS'?'PASS':'FAIL';
const result={generatedAt:new Date().toISOString(),sourceHash:current.sourceHash,verificationContractHash:current.verificationContractHash,
 directEvidenceStatus:verified.status,platformChecks,genaiChecks,GENAI_RAG_SECURITY_GATE:genai,T5_COMPLETION_SECURITY_GATE:security,
 ASVS_L3_RELEASE_GATE:asvsCurrent?assessment.t5Assessment.ASVS_L3_RELEASE_GATE:'NO',checks:{sourceCurrent,asvsCurrent,inventoryCurrent,ociCurrent,supplyCurrent,modelCurrent,
  protectedCurrent:protectedPaths?.status==='PASS'&&protectedPaths.unauthorizedCount===0},modelReason:modelCurrent?null:models?.reason??'ACTUAL_APPROVED_MODEL_CONFIG_REQUIRED'};
await writeFile('reports/security/t5-preliminary-gates.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({GENAI_RAG_SECURITY_GATE:genai,T5_COMPLETION_SECURITY_GATE:security,directEvidenceStatus:verified.status,checks:result.checks}));
if(verified.status!=='PASS')process.exitCode=1;
