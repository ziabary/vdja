import assert from 'node:assert/strict';
import {test} from 'node:test';
import {hash} from '../../scripts/t5-r1-source.mjs';
import {verifyAcceptanceEvidence,caseAssertionCount} from '../../scripts/t5-evidence-gate.mjs';
import {blockerClass} from '../../scripts/t5-asvs-evidence.mjs';

const testFile='tests/target/direct.test.ts',productionPath='packages/example/src/service.ts',artifact='tests/reports/direct.log',gatePath='reports/security/current-gate.json';
const bytes=JSON.stringify({type:'test:pass',name:'direct assertion',file:'/repo/'+testFile,skip:false,todo:false})+'\n';
const source="test('direct assertion',()=>assert.equal(decision,'DENY'))";
function valid(){
 const current={sourceHash:'CURRENT',verificationContractHash:'CONTRACT',files:{[testFile]:'TEST_HASH',[productionPath]:'PRODUCTION_HASH'}};
 const evidence={sourceHash:'CURRENT',verificationContractHash:'CONTRACT',testFile,productionPath,testCase:'direct assertion',assertionId:'CASE_ASSERTION_SET',
  evidenceClaim:'This decision assertion checks denial.',testCommand:['node','--test',testFile],reportArtifact:artifact,artifactHash:hash(bytes)};
 const gate={sourceHash:'CURRENT',verificationContractHash:'CONTRACT',counts:{t5Scope:0}};
 const gateBytes=JSON.stringify(gate)+'\n';
 const derived={sourceHash:'CURRENT',verificationContractHash:'CONTRACT',gateArtifact:gatePath,gateArtifactHash:hash(gateBytes),gateSourceHash:'CURRENT',derivedField:'counts.t5Scope',expectedValue:0};
 const map={sourceHash:'CURRENT',verificationContractHash:'CONTRACT',criteria:Array.from({length:100},(_,i)=>({criterionNumber:i+1,criterionText:'criterion '+(i+1),
  status:i===0||i===49?'PASS':'NOT_VERIFIED',reason:i===0||i===49?'':'Evidence pending',
  evidenceKind:i===49||i===88||i===89?'DERIVED_CANONICAL_GATE':'DIRECT_EXECUTED_TEST',evidence:i===0?[evidence]:i===49?[derived]:[]}))};
 const execution={...current,files:{...current.files},providerScope:'PROTOCOL_FIXTURE',results:[{status:'PASS',exitCode:0,skipped:0,
  command:evidence.testCommand,artifact,artifactHash:hash(bytes),cases:[{file:testFile,name:'direct assertion',status:'PASS',skipped:false}]}]};
 const read=async path=>{if(path===artifact)return bytes;if(path===testFile)return source;if(path===gatePath)return gateBytes;throw new Error('MISSING');};
 return{map,current,execution,read,evidence,derived,gateBytes};
}
test('current direct and canonical derived evidence pass',async()=>{const v=valid(),result=await verifyAcceptanceEvidence(v.map,v.execution,v.current,v.read);assert.equal(result.status,'PASS');assert.equal(result.passCount,2);});
test('one executed assertion may support related criteria with distinct claims',async()=>{const v=valid();v.map.criteria[1]={...v.map.criteria[1],status:'PASS',reason:'',evidence:[{...v.evidence,evidenceClaim:'This same assertion also checks the related denial boundary.'}]};assert.equal((await verifyAcceptanceEvidence(v.map,v.execution,v.current,v.read)).status,'PASS');});
test('AST recognizes an assertion inside the exact test callback',()=>{assert.equal(caseAssertionCount(source,'direct assertion'),1);assert.equal(caseAssertionCount("test('direct assertion',()=>{})",'direct assertion'),0);});
test('AST recognizes a local assertion helper but not an arbitrary helper',()=>{
 assert.equal(caseAssertionCount("function expect(){assert.equal(1,1)} test('direct assertion',()=>expect())",'direct assertion'),1);
 assert.equal(caseAssertionCount("function expect(){} test('direct assertion',()=>expect())",'direct assertion'),0);
});
const negatives={
 'missing criterion':v=>{v.map.criteria.pop();},
 'duplicate criterion':v=>{v.map.criteria[1].criterionNumber=1;},
 'unknown criterion':v=>{v.map.criteria[1].criterionNumber=101;},
 'stale source hash':v=>{v.map.sourceHash='OLD';},
 'stale verification contract hash':v=>{v.map.verificationContractHash='OLD';},
 'stale execution contract hash':v=>{v.execution.verificationContractHash='OLD';},
 'missing artifact':v=>{v.read=async()=>{throw new Error('MISSING');};},
 'changed artifact hash':v=>{v.evidence.artifactHash='FORGED';},
 'skipped test':v=>{v.execution.results[0].cases[0].skipped=true;},
 'failed test':v=>{v.execution.results[0].cases[0].status='FAIL';},
 'test case absent from source':v=>{const old=v.read;v.read=async path=>path===testFile?"test('other',()=>assert.ok(true))":old(path);},
 'test case absent from execution':v=>{v.execution.results[0].cases=[];},
 'broad feature flag alone':v=>{v.map.criteria[0].evidence=[];v.map.criteria[0].features=true;},
 'direct case without assertion':v=>{const old=v.read;v.read=async path=>path===testFile?"test('direct assertion',()=>{})":old(path);},
 'stale derived gate evidence':v=>{const old=v.read;v.read=async path=>path===gatePath?JSON.stringify({sourceHash:'OLD',verificationContractHash:'CONTRACT',counts:{t5Scope:0}})+'\n':old(path);},
 'derived result forged PASS':v=>{v.map.criteria[49].status='FAIL';},
 'fixture declared actual model':v=>{v.map.criteria[1]={...v.map.criteria[1],status:'PASS',reason:'',evidenceKind:'LIVE_EXTERNAL_EVIDENCE',evidence:[{sourceHash:'CURRENT',verificationContractHash:'CONTRACT',providerId:'p',modelId:'m',artifactRevision:'r',executionId:'e'}]};}
};
for(const[name,mutate]of Object.entries(negatives))test('evidence gate rejects '+name,async()=>{const v=valid();mutate(v);assert.equal((await verifyAcceptanceEvidence(v.map,v.execution,v.current,v.read)).status,'FAIL');});
test('ASVS blocker classification uses prefixed control IDs',()=>{assert.equal(blockerClass('v5.0.0-V12.3.5'),'CODE_FIX_REQUIRED');assert.equal(blockerClass('v5.0.0-V15.2.1'),'SUPPLY_CHAIN_REQUIRED');});
