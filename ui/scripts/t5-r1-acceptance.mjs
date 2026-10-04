import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {relative} from 'node:path';
import {hash,sourceFingerprint,verificationContractFingerprint} from './t5-r1-source.mjs';
const env={...process.env,NODE_TLS_REJECT_UNAUTHORIZED:'1',T4_REQUIRE_LIVE:'1',T5_REQUIRE_LIVE:'1',T5_REQUIRE_QDRANT:'1',T5_REQUIRE_S3:'1',T5_REQUIRE_BROWSER:'1'};delete env.NODE_TEST_CONTEXT;env.T5_R1_REPORTER='./scripts/t5-r1-reporter.mjs';
if(!env.T4_PG_CONFIG||!env.T4_SECRETS_DIR)throw new Error('T5_R1_LIVE_CONFIGURATION_REQUIRED');
const nodeTests=(...files)=>['node',['--import','tsx','--test','--test-concurrency=1','--test-reporter=./scripts/t5-r1-reporter.mjs',...files]];
const suites=[
 ['strict-target','npm',['run','check:target']],['strict-web','npm',['run','check:web']],
 ['authority-conformance',...nodeTests('tests/conformance/authority/authorityBehavior.test.ts')],
 ['authority-live',...nodeTests('tests/target/t44-authority-live.integration.test.ts')],
 ['auth-http',...nodeTests('tests/target/t4-auth-http.integration.test.ts')],
 ['foundations',...nodeTests('tests/architecture/staticAnalysis.test.ts','tests/architecture/t5TargetArchitecture.test.ts','tests/configuration/t5-file-management.test.ts','tests/target/t5-chunking.test.ts','tests/target/t5-storage-contract.test.ts','tests/target/t5-file-cache.test.ts','tests/target/t5-file-staging.test.ts','tests/target/t4-file-security.test.ts','tests/target/t5-process-errors.test.ts')],
 ['integrations',...nodeTests('tests/target/t5-document-jobs.integration.test.ts','tests/target/t5-transfer-persistence.integration.test.ts','tests/target/t5-file-management.integration.test.ts','tests/target/t5-s3-storage.integration.test.ts','tests/target/t5-knowledge-projection.integration.test.ts','tests/target/t5-protected-ai.integration.test.ts','tests/target/t5-rag-security.integration.test.ts','tests/target/t5-runtime.integration.test.ts','tests/target/t5-failure-runtime.integration.test.ts','tests/target/t5-worker.integration.test.ts','tests/target/t5-machine-expiry.integration.test.ts','tests/target/t5-file-limits.integration.test.ts','tests/target/t5-legacy-migration.test.ts','tests/target/t5-storage-migration.integration.test.ts')],
 ['authority-inventory','node',['scripts/t5-authority-inventory.mjs']],
 ['r1-hardening',...nodeTests('tests/target/t5-worker-multitenant.integration.test.ts','tests/target/t5-job-idempotency-security.integration.test.ts','tests/target/t5-cache-concurrency.test.ts','tests/target/t5-security-race.integration.test.ts','tests/target/t5-malware-policy.test.ts','tests/target/t5-parser-sandbox.test.ts','tests/target/t5-retention-purge.integration.test.ts','tests/target/t5-genai-adversarial.test.ts','tests/target/t5-authority-post-t5-inventory.test.mjs','tests/target/t5-protected-policy.test.mjs','tests/target/t5-evidence-selftest.test.mjs','tests/target/t5-supply-policy.test.mjs')],
 ['build-web','npm',['run','build:web']],['browser',...nodeTests('tests/target/t5-browser.integration.test.mjs')],
 ['audit-siem','node',['scripts/t5-audit-siem.mjs']],
 ['architecture','npm',['run','test:architecture:target']],['t5-architecture','node',['--import','tsx','scripts/t5-target-architecture.ts']],
 ['ui','npm',['run','test:ui']]];
env.AUTHORITY_CONFORMANCE_ADAPTER='tests/conformance/authority/productionAdapter.ts';
const before=await sourceFingerprint(),contract=await verificationContractFingerprint();const results=[];await mkdir('tests/reports/t5-r1',{recursive:true});
for(const [name,command,args] of suites){
 console.log(`T5-R1 ${name}: RUNNING`);let output='';
 const exitCode=await new Promise((resolve,reject)=>{const child=spawn(command,args,{env,stdio:['ignore','pipe','pipe']});
 const collect=chunk=>{output+=chunk.toString();if(output.length>32*1024*1024){child.kill('SIGTERM');reject(new Error('EVIDENCE_OUTPUT_LIMIT'));}};
 child.stdout.on('data',collect);child.stderr.on('data',collect);child.once('error',reject);child.once('close',resolve);});
 const artifact=`tests/reports/t5-r1/${name}.log`;if(name==='audit-siem')output+=await (await import('node:fs/promises')).readFile('tests/reports/t5-audit-siem.tap','utf8');await writeFile(artifact,output);
 const events=output.split('\n').flatMap(line=>{try{const value=JSON.parse(line);return value.type?.startsWith('test:')?[value]:[];}catch{return[];}});
 const cases=events.filter(e=>e.type==='test:pass'||e.type==='test:fail').map(e=>({file:e.file?relative(process.cwd(),e.file):null,name:e.name,line:e.line,status:e.type==='test:pass'?'PASS':'FAIL',skipped:e.skip||e.todo}));
 const skipped=cases.filter(c=>c.skipped).length,failed=cases.filter(c=>c.status==='FAIL').length;
 const status=exitCode===0&&failed===0&&skipped===0?'PASS':'FAIL';
 results.push({name,command:[command,...args],status,exitCode,failed,skipped,cases,artifact,artifactHash:hash(output),sourceHash:before.sourceHash});
 const after=await sourceFingerprint(),afterContract=await verificationContractFingerprint();if(after.sourceHash!==before.sourceHash)throw new Error('SOURCE_CHANGED_DURING_VERIFICATION');
 if(afterContract.verificationContractHash!==contract.verificationContractHash)throw new Error('VERIFICATION_CONTRACT_CHANGED_DURING_RUN');
 await writeFile('tests/reports/t5-r1-execution.json',JSON.stringify({generatedAt:new Date().toISOString(),...before,...contract,status:results.every(r=>r.status==='PASS')&&results.length===suites.length?'PASS':'PARTIAL',providerScope:'PROTOCOL_FIXTURE',results},null,2)+'\n');
 console.log(`T5-R1 ${name}: ${status}; cases=${cases.length}; skips=${skipped}`);
 if(status==='FAIL'){console.error(output.slice(-5000));process.exitCode=1;break;}
}
// Criterion evidence is generated only after ASVS, Authority, supply and GenAI gates are current.
