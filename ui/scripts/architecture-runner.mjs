import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const suites=['dependencies','persistence','authority','ai','providers','typescript','naming','manifests','all'];
let failed=false;
const self=spawnSync(process.execPath,['--import','tsx','--test','tests/architecture/staticAnalysis.test.ts'],{stdio:'inherit'});
const infraFailed=self.status!==0;
console.log(`architecture self-tests: ${infraFailed?'TEST_INFRA_FAILURE':'PASS'} (exit ${self.status??'signal'})`);
for(const suite of suites){
 const result=spawnSync(process.execPath,['--import','tsx','scripts/static-architecture.ts',suite],{stdio:'inherit'});
 console.log(`architecture ${suite}: exit ${result.status??'signal'}`);
 if(result.status!==0)failed=true;
}
if(infraFailed){
 const path='tests/reports/architecture-violations.json';
 if(existsSync(path)){
  const report=JSON.parse(readFileSync(path,'utf8'));
  report.classificationCounts.TEST_INFRA_FAILURE=(report.classificationCounts.TEST_INFRA_FAILURE??0)+1;
  report.violations.push({ruleId:'ARCH-INFRA-SELF',classification:'TEST_INFRA_FAILURE',file:'tests/architecture/staticAnalysis.test.ts',message:'Analyzer self-tests failed'});
  report.violations.sort((a,b)=>a.ruleId.localeCompare(b.ruleId)||a.file.localeCompare(b.file)||(a.line??0)-(b.line??0)||(a.column??0)-(b.column??0)||a.message.localeCompare(b.message));
  writeFileSync(path,JSON.stringify(report,null,2)+'\n');
 }
}
process.exitCode=infraFailed?2:failed?1:0;
