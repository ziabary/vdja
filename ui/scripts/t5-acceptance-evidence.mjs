import {readFile,writeFile} from 'node:fs/promises';
import {acceptanceCriteria,caseAssertionCount} from './t5-evidence-gate.mjs';
import {hash,sourceFingerprint,verificationContractFingerprint} from './t5-r1-source.mjs';

// One explicit executed case per criterion. Unmapped criteria remain NOT_VERIFIED.
// Case identities are explicit; a nearby assertion is not claimed as proof of a criterion.
const CASES=new Map([
 [3,['PostgreSQL Document versions and jobs survive retries, concurrency and Worker replacement','packages/documents/src/service.ts']],
 [4,['normalized content is immutable and out-of-order activation cannot replace a newer version','packages/documents/src/service.ts']],
 [5,['version/asset/job/usage/audit are atomic and resumable partial bytes are never downloadable','packages/documents/src/persistence.ts']],
 [6,['local multipart contract is immutable, resumable, bounded by opaque identity, and hash verified','packages/storage/src/adapters/local.ts']],
 [7,['office parser cleans its conversion directory and profile after processing','packages/file-processing/src/index.ts']],
 [8,['membership schedules indexing atomically, Router runs protected tasks and real citations can be independently read','packages/knowledge/src/service.ts']],
 [9,['real Qdrant restart keeps derived bytes while PostgreSQL remains canonical and scope fails closed','packages/knowledge/src/adapters/qdrant.ts']],
 [10,['fresh Qdrant rebuild, idempotent upsert and authorized filters return only opaque references','packages/knowledge/src/service.ts']],
 [11,['activation requires complete counts and immutable snapshot; concurrent replacement cannot regress','packages/knowledge/src/persistence.ts']],
 [12,['PostgreSQL Document versions and jobs survive retries, concurrency and Worker replacement','packages/jobs/src/persistence.ts']],
 [13,['retry preserves immutable generation/chunk identity and a conflicting profile fails','packages/knowledge/src/service.ts']],
 [14,['Authority before retrieval limits the real vector query; revoked source bytes never reach reranker or LLM','packages/knowledge/src/service.ts']],
 [15,['final candidate validation rejects a malicious derived hit before File Management materializes its Version','packages/knowledge/src/service.ts']],
 [16,['security revocation after materialization before reranker prevents next provider dispatch','packages/knowledge/src/service.ts']],
 [17,['security revocation after reranker before generation prevents next provider dispatch','packages/knowledge/src/service.ts']],
 [18,['read is not use; use does not disclose/download; unknown citations and direct quotation fail closed','packages/documents/src/service.ts']],
 [19,['platform disclosure rejects malicious output for citation-manipulation','packages/knowledge/src/service.ts']],
 [20,['platform disclosure rejects malicious output for unauthorized-quote','packages/knowledge/src/service.ts']],
 [21,['classification, ownership, scope, and missing facts fail closed','packages/authority/src/persistence.generic.ts']],
 [22,['one deployment Worker claims interleaved A1 B1 A2 B2 preserving Human subjects and tenant boundaries','packages/jobs/src/persistence.ts']],
 [23,['resource ACL explicit deny wins over ordinary grant','packages/authority/src/index.ts']],
 [24,['root ALL cannot cross tenant boundary','packages/authority/src/index.ts']],
 [25,['Governance denial rejects generation before external content leaves its Router','packages/ai-router/src/protected.ts']],
 [26,['unapproved fallback receives zero bytes and approved provider failure does not grant egress','packages/ai-router/src/protected.ts']],
 [27,['embedding, query, reranking and answer preserve semantic tasks/model revision and actual usage','packages/ai-router/src/protected.ts']],
 [30,['T5 guards reject direct vectors/providers/signed URLs and retain public File Management and Router contracts','scripts/t5-target-architecture.ts']],
 [31,['malicious metadata and question resource excess cause bounded errors without provider work','packages/knowledge/src/service.ts']],
 [33,['RAG records actual rejected-generation consumption and denies rewriting Usage facts','packages/usage/src/persistence/rag.ts']],
 [34,['distributed query reservations reject additional API work before provider dispatch','packages/admission-control/src/persistence/query.ts']],
 [35,['actual upload/processing/index/query evidence reaches a TLS receiver with matching original Session/request','packages/audit/src/persistence/semantic.ts']],
 [36,['database mutation evidence omits names, locators and content','packages/documents/src/persistence.ts']],
 [38,['built Svelte RAG UI uses real Identity/Session/Authority, managed upload, durable processing, derived retrieval and authorized citations','apps/web/src/lib/knowledge/Workspace.svelte']],
 [41,['legacy mapping fails closed for missing/ambiguous owners, privilege imports, duplicate identity and derived source','packages/knowledge/src/legacy-migration.ts']],
 [43,['approved legacy original migrates through canonical Document/File Management and retries without duplicate versions; index rebuild is fresh','packages/knowledge/src/legacy-migration.ts']],
 [44,['fresh derived index rebuild uses retained canonical content and preserves Document/Version/Asset identities','packages/knowledge/src/service.ts']],
 [45,['parallel intake has unique sequences and source retry returns one version','packages/documents/src/persistence.ts']],
 [46,['embedding revision change requires a separate generation and atomically switches only after full reindex','packages/knowledge/src/service.ts']],
 [47,['authenticated target API + durable Worker + LOCAL + derived Qdrant run without legacy RAG/Auth/MySQL','apps/runtime/src/composition.ts']],
 [49,['T5 guards reject S3 and filesystem bypasses while accepting owning infrastructure','scripts/t5-target-architecture.ts']],
 [51,['File Management enforces real Session/Authority before verified upload commit and cache/range downloads','packages/file-management/src/service.ts']],
 [53,['anonymous/mismatched tenant fail and all file operations run through the API File Management boundary','apps/api/src/knowledge.ts']],
 [56,['local multipart contract is immutable, resumable, bounded by opaque identity, and hash verified','packages/storage/src/index.ts']],
 [57,['real S3 multipart parity, process/server restart and ambiguous completion reconcile safely','packages/storage/src/adapters/s3.ts']],
 [58,['managed transfer configuration selects one adapter with external credentials and strict bounds','packages/configuration/src/index.ts']],
 [61,['canonical bytes survive storage server replacement/restart and anonymous access is denied','packages/storage/src/adapters/s3.ts']],
 [62,['invalid signature/hash never creates Asset, Version, or processing Job','packages/file-management/src/service.ts']],
 [63,['noncanonical staging streams bounded verified bytes, cleans failure and never exposes partial content','packages/file-management/src/staging.ts']],
 [64,['partial upload is invisible and duplicate part is stable across adapter restart','packages/file-management/src/transfers.ts']],
 [65,['lost response after actual commit is UNKNOWN, never blindly retried, and full bytes prove outcome','packages/file-management/src/transfers.ts']],
 [66,['private bounded cache is version/tenant aware, rebuildable and verifies full bytes before ranges','packages/file-management/src/cache.ts']],
 [68,['warm/disposable cache, range and conditional requests cannot skip independent download authorization','packages/file-management/src/service.ts']],
 [70,['private bounded cache is version/tenant aware, rebuildable and verifies full bytes before ranges','packages/file-management/src/cache.ts']],
 [71,['revocation after download authorization and before first byte yields no protected content','packages/file-management/src/service.ts']],
 [72,['range boundaries reject multiple, malformed and unsafe ranges','packages/file-management/src/range.ts']],
 [73,['warm/disposable cache, range and conditional requests cannot skip independent download authorization','packages/file-management/src/transfers.ts']],
 [75,['File Management enforces real Session/Authority before verified upload commit and cache/range downloads','packages/file-management/src/transfers.ts']],
 [76,['read is not use; use does not disclose/download; unknown citations and direct quotation fail closed','packages/file-management/src/service.ts']],
 [78,['T5 guards reject S3 and filesystem bypasses while accepting owning infrastructure','packages/file-management/src/index.ts']],
 [79,['office precheck rejects malicious archives before LibreOffice','packages/file-processing/src/office-archive.ts']],
 [80,['upload media type, extension, signature, and temporary path agree','packages/file-processing/src/index.ts']],
 [81,['Authority selects file tiers; Admission enforces distributed actor and hard limits after elevation and revocation','packages/admission-control/src/files.ts']],
 [82,['lost response after actual commit is UNKNOWN, never blindly retried, and full bytes prove outcome','packages/storage/src/adapters/s3.ts']],
 [83,['Usage is immutable/idempotent and file semantic and mutation evidence exclude sensitive metadata','packages/audit/src/persistence/semantic.ts']],
 [85,['actual upload/processing/index/query evidence reaches a TLS receiver with matching original Session/request','packages/security-telemetry/src/worker.ts']],
 [86,['T5 guards reject direct vectors/providers/signed URLs and retain public File Management and Router contracts','scripts/t5-target-architecture.ts']],
 [91,['real T5 Audit and TLS SIEM delivery preserve correlation, immutability, redaction and restart semantics','packages/security-telemetry/src/worker.ts']],
 [92,['ordinary API and Worker cannot rewrite Audit or disable mutation evidence; rollback leaves no event/outbox','packages/audit/src/persistence/semantic.ts']],
 [93,['sensitive contents, prompts, answers and locators are absent from exported/canonical evidence','packages/audit/src/persistence/semantic.ts']],
 [94,['actual upload/processing/index/query evidence reaches a TLS receiver with matching original Session/request','packages/security-telemetry/src/worker.ts']],
 [95,['lost acknowledgement retries only with stable receiver idempotency; maxAttempts is bounded','packages/security-telemetry/src/worker.ts']],
 [96,['restart recovers an expired claim and stale Worker cannot settle its replacement','packages/security-telemetry/src/worker.ts']],
 [97,['optional SIEM outage leaves real RAG successful and NONE guarantees never blindly repeat UNKNOWN','packages/security-telemetry/src/worker.ts']],
 [98,['HUMAN origin, mandatory Audit, SIEM retry, redaction and audit immutability','packages/authority/src/service.ts']],
 [99,['R1 protected governing files match the task-specific baseline with no inherited exceptions','scripts/t5-protected-policy.mjs']]
]);

const current=await sourceFingerprint(),contract=await verificationContractFingerprint(),execution=JSON.parse(await readFile('tests/reports/t5-r1-execution.json','utf8'));
const criteria=acceptanceCriteria(await readFile('docs/prompts/T5-final.md','utf8'));
if(execution.sourceHash!==current.sourceHash||execution.verificationContractHash!==contract.verificationContractHash)throw new Error('T5_R1_EXECUTION_OR_CONTRACT_CHANGED');
const directOnly=process.argv.includes('--direct-only');
const meta=new Map([[50,['reports/security/t5-r1-open-findings.json','counts.t5Scope',0]],[89,['reports/security/t5-r1-open-findings.json','counts.t5Scope',0]],[90,['reports/security/t5-preliminary-gates.json','GENAI_RAG_SECURITY_GATE','PASS']]]);
const staticCriteria=new Set([1,2,37,39,40,42,48,52,54,55,59,60,67,69,74,77,84,87,88,100]);
const makeEvidence=(found,name,productionPath,claim,sourceAnchor)=>({sourceHash:current.sourceHash,verificationContractHash:contract.verificationContractHash,
 testCommand:found.result.command,testFile:found.test.file,testCase:name,assertionId:'CASE_ASSERTION_SET',evidenceClaim:claim,
 productionPath,reportArtifact:found.result.artifact,artifactHash:found.result.artifactHash,...(sourceAnchor?{sourceAnchor}:{})});
async function deriveGate(path,field,expectedValue){
 try{const bytes=await readFile(path,'utf8'),gate=JSON.parse(bytes),value=field.split('.').reduce((item,key)=>item?.[key],gate);
  if(gate.sourceHash!==current.sourceHash||gate.verificationContractHash!==contract.verificationContractHash||value===undefined)throw new Error('STALE_GATE');
  return{status:value===expectedValue?'PASS':'FAIL',reason:value===expectedValue?'':'CANONICAL_GATE_OPEN',evidence:[{sourceHash:current.sourceHash,verificationContractHash:contract.verificationContractHash,
   gateArtifact:path,gateArtifactHash:hash(bytes),gateSourceHash:gate.sourceHash,derivedField:field,expectedValue}]};
 }catch{return{status:'NOT_VERIFIED',reason:'CURRENT_CANONICAL_GATE_UNAVAILABLE',evidence:[]};}
}
const mapped=[];
for(const criterion of criteria){
 const number=criterion.criterionNumber,spec=CASES.get(number),derived=meta.get(number);
 const base={...criterion,evidenceKind:derived?'DERIVED_CANONICAL_GATE':staticCriteria.has(number)?'STATIC_ARCHITECTURE_EVIDENCE':'DIRECT_EXECUTED_TEST',evidence:[]};
 if(derived){mapped.push({...base,...(directOnly?{status:'NOT_VERIFIED',reason:'WAITING_FOR_CANONICAL_GATES',evidence:[]}:await deriveGate(...derived))});continue;}
 if(number===32){
  const candidates=execution.results.flatMap(result=>(result.cases??[]).filter(test=>test.file==='tests/target/t5-genai-adversarial.test.ts'&&test.name.startsWith('platform disclosure rejects malicious output for ')&&test.status==='PASS'&&!test.skipped).map(test=>({result,test})));
  const source=await readFile('tests/target/t5-genai-adversarial.test.ts','utf8'),anchor='platform disclosure rejects malicious output for ';
  if(candidates.length<22||!caseAssertionCount(source,candidates[0]?.test.name??'',anchor)){mapped.push({...base,status:'NOT_VERIFIED',reason:'PLATFORM_ADVERSARIAL_CASES_NOT_PROVEN'});continue;}
  mapped.push({...base,status:'PASS',reason:'PLATFORM_PROMPT_INJECTION_SECURITY_ONLY; actual model behavior remains in criterion 90',evidence:candidates.map(found=>makeEvidence(found,found.test.name,'packages/knowledge/src/disclosure.ts',`Malicious ${found.test.name.slice(anchor.length)} output cannot change Authority, disclose hidden source, fabricate citations or execute tools.`,anchor))});continue;
 }
 if(!spec){mapped.push({...base,status:'NOT_VERIFIED',reason:'CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED'});continue;}
 const [name,productionPath]=spec;
 const candidates=execution.results.flatMap(result=>(result.cases??[]).filter(value=>value.name===name&&value.status==='PASS'&&!value.skipped)
  .map(value=>({result,test:value})));
 const found=candidates.find(({result,test})=>result.status==='PASS'&&result.exitCode===0&&result.skipped===0&&current.files[test.file]&&current.files[productionPath]);
 if(!found){mapped.push({...base,status:'NOT_VERIFIED',reason:'DIRECT_CASE_MISSING'});continue;}
 const source=await readFile(found.test.file,'utf8');
 const anchor=name.startsWith('security revocation after materialization')||name.startsWith('security revocation after reranker')?'security revocation after ':name.startsWith('platform disclosure rejects malicious output for ')?'platform disclosure rejects malicious output for ':name;
 if(!caseAssertionCount(source,name,anchor)){mapped.push({...base,status:'NOT_VERIFIED',reason:'CASE_ASSERTION_NOT_IDENTIFIED_IN_SOURCE'});continue;}
 const evidence=[makeEvidence(found,name,productionPath,`Executed case checks ${criterion.criterionText}`,anchor===name?undefined:anchor)];
 if(number===66){
  const stagingName='noncanonical staging streams bounded verified bytes, cleans failure and never exposes partial content';
  const staging=execution.results.flatMap(result=>(result.cases??[]).filter(test=>test.name===stagingName&&test.status==='PASS'&&!test.skipped).map(test=>({result,test})))[0];
  if(!staging||!caseAssertionCount(await readFile(staging.test.file,'utf8'),stagingName)){mapped.push({...base,status:'NOT_VERIFIED',reason:'CACHE_AND_STAGING_BOTH_REQUIRED'});continue;}
  evidence.push(makeEvidence(staging,stagingName,'packages/file-management/src/staging.ts','Staging has independent bounded, noncanonical byte lifecycle.'));
 }
 mapped.push({...base,status:'PASS',reason:'',evidence});
}
const result={generatedAt:new Date().toISOString(),sourceHash:current.sourceHash,...contract,criterionSource:'docs/prompts/T5-final.md',status:'CRITERION_SPECIFIC',criteria:mapped};
await writeFile(directOnly?'reports/security/t5-direct-evidence.json':'reports/security/t5-acceptance-evidence.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({criteria:mapped.length,direct:mapped.filter(value=>value.status==='PASS').length,
 notVerified:mapped.filter(value=>value.status==='NOT_VERIFIED').length,fail:mapped.filter(value=>value.status==='FAIL').length,directOnly}));
