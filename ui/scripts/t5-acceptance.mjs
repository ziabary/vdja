import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const required=['T4_PG_CONFIG','T4_SECRETS_DIR'];for(const key of required)if(!process.env[key])throw new Error(`T5_ACCEPTANCE_CONFIGURATION_REQUIRED: ${key}`);
if(process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw new Error('T5_TLS_VERIFICATION_REQUIRED');
const environment={...process.env,NODE_TLS_REJECT_UNAUTHORIZED:'1',T5_REQUIRE_LIVE:'1',T5_REQUIRE_QDRANT:'1',T5_REQUIRE_S3:'1',T5_REQUIRE_BROWSER:'1',T4_REQUIRE_LIVE:'1'};
const suites=[['strict-target','npm',['run','check:target']],['strict-web','npm',['run','check:web']],
  ['target-architecture','npm',['run','test:architecture:target']],['t5-architecture','node',['--import','tsx','scripts/t5-target-architecture.ts']],
  ['t5-foundations','node',['--import','tsx','--test','--test-concurrency=1',
    'tests/architecture/staticAnalysis.test.ts','tests/architecture/t5TargetArchitecture.test.ts','tests/configuration/t5-file-management.test.ts',
    'tests/target/t5-chunking.test.ts','tests/target/t5-storage-contract.test.ts','tests/target/t5-file-cache.test.ts','tests/target/t5-file-staging.test.ts',
    'tests/target/t4-file-security.test.ts','tests/target/t5-process-errors.test.ts']],
  ['t5-integrations','node',['--import','tsx','--test','--test-concurrency=1',
    'tests/target/t5-document-jobs.integration.test.ts','tests/target/t5-transfer-persistence.integration.test.ts',
    'tests/target/t5-file-management.integration.test.ts','tests/target/t5-s3-storage.integration.test.ts',
    'tests/target/t5-knowledge-projection.integration.test.ts','tests/target/t5-protected-ai.integration.test.ts',
    'tests/target/t5-rag-security.integration.test.ts','tests/target/t5-runtime.integration.test.ts','tests/target/t5-failure-runtime.integration.test.ts',
    'tests/target/t5-worker.integration.test.ts','tests/target/t5-machine-expiry.integration.test.ts','tests/target/t5-file-limits.integration.test.ts',
    'tests/target/t5-legacy-migration.test.ts','tests/target/t5-storage-migration.integration.test.ts']],
  ['authority-conformance','npm',['run','test:conformance:authority']],
  ['authority-live','node',['--import','tsx','--test','tests/target/t44-authority-live.integration.test.ts']],
  ['auth-http-regression','node',['--import','tsx','--test','tests/target/t4-auth-http.integration.test.ts']],
  ['build-web','npm',['run','build:web']],['t5-browser','node',['--import','tsx','--test','tests/target/t5-browser.integration.test.mjs']],
  ['t5-audit-siem','node',['scripts/t5-audit-siem.mjs']]];
await mkdir('tests/reports',{recursive:true});const results=[];
for(const[name,command,args]of suites){
  console.log(`T5 acceptance: ${name}`);const started=Date.now();let output='';
  const code=await new Promise((resolve,reject)=>{const child=spawn(command,args,{env:environment,stdio:['ignore','pipe','pipe']});
    const collect=chunk=>{output+=chunk.toString();if(output.length>16*1024*1024){child.kill('SIGTERM');reject(new Error('T5_TEST_OUTPUT_LIMIT'));}};
    child.stdout.on('data',collect);child.stderr.on('data',collect);child.once('error',reject);child.once('exit',code=>resolve(code));});
  const count=field=>Number([...output.matchAll(new RegExp(`^# ${field} (\\d+)\\s*$`,'gm'))].at(-1)?.[1]??0);
  const skipped=count('skipped'),failed=count('fail'),passed=count('pass');
  const status=code===0&&skipped===0&&failed===0?'PASS':'FAIL';
  results.push({name,status,exitCode:code,passed,failed,skipped,durationMs:Date.now()-started,
    command:[command,...args],evidence:`tests/reports/${name}.log`});
  await writeFile(`tests/reports/${name}.log`,output);await writeFile('tests/reports/t5-acceptance.json',JSON.stringify({generatedAt:new Date().toISOString(),status:results.some(value=>value.status!=='PASS')?'FAIL':results.length===suites.length?'PASS':'IN_PROGRESS',providerScope:'PROTOCOL_FIXTURES_NOT_LIVE_VLLM',results},null,2)+'\n');
  console.log(`${name}: ${status}; passed=${passed}; failed=${failed}; skipped=${skipped}`);
  if(status!=='PASS'){console.error(output.slice(-8000));process.exitCode=1;break;}
}
