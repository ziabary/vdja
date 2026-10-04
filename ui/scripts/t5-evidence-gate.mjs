import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {hash,sourceFingerprint,verificationContractFingerprint} from './t5-r1-source.mjs';

export const EVIDENCE_KINDS=new Set(['DIRECT_EXECUTED_TEST','DERIVED_CANONICAL_GATE','STATIC_ARCHITECTURE_EVIDENCE','LIVE_EXTERNAL_EVIDENCE','DEPLOYMENT_EVIDENCE']);
const STATUSES=new Set(['PASS','FAIL','NOT_VERIFIED','NOT_APPLICABLE']);
const META_FIELDS=new Map([[50,'counts.t5Scope'],[89,'counts.t5Scope'],[90,'GENAI_RAG_SECURITY_GATE']]);

const fieldAt=(record,path)=>path.split('.').reduce((value,key)=>value?.[key],record);
export function caseAssertionCount(source,name,sourceAnchor=name){
 const tree=ts.createSourceFile('evidence.test.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let count=0;
 const helpers=new Set();
 const findHelpers=node=>{if(ts.isFunctionDeclaration(node)&&node.name&&node.body){let asserted=false;
  const scan=child=>{if(ts.isCallExpression(child)&&/^assert(?:\.|\()/u.test(child.expression.getText(tree)))asserted=true;ts.forEachChild(child,scan);};
  scan(node.body);if(asserted)helpers.add(node.name.text);
 }ts.forEachChild(node,findHelpers);};findHelpers(tree);
 const visit=node=>{
  if(ts.isCallExpression(node)&&/\btest$/u.test(node.expression.getText(tree))){
   const first=node.arguments[0],label=first?.getText(tree)??'';
   if((ts.isStringLiteral(first)&&first.text===name)||label.includes(sourceAnchor)){
    const callback=node.arguments.find(arg=>ts.isArrowFunction(arg)||ts.isFunctionExpression(arg));
    if(callback){const inspect=child=>{if(ts.isCallExpression(child)&&(/^assert(?:\.|\()/u.test(child.expression.getText(tree))||helpers.has(child.expression.getText(tree))))count++;ts.forEachChild(child,inspect);};inspect(callback.body);}
   }
  }ts.forEachChild(node,visit);
 };visit(tree);return count;
}

export function acceptanceCriteria(source){
 const section=source.split('80. T5 ACCEPTANCE CRITERIA')[1]?.split('81. FINAL RESPONSE')[0];
 if(!section)throw new Error('T5_ACCEPTANCE_SOURCE_MISSING');
 const criteria=[...section.matchAll(/^(\d+)\. (.+)$/gm)].map(([,number,criterionText])=>({criterionNumber:Number(number),criterionText:criterionText.trim()}));
 if(criteria.length!==100||criteria.some((criterion,index)=>criterion.criterionNumber!==index+1))throw new Error('T5_ACCEPTANCE_SOURCE_INCOMPLETE');
 return criteria;
}

/** Evidence validity is separate from whether every T5 requirement is satisfied. */
export async function verifyAcceptanceEvidence(map,execution,current,read=path=>readFile(path,'utf8'),expectedCriteria){
 const errors=[],numbers=new Set(),results=[];
 if(!Array.isArray(map?.criteria)||map.criteria.length!==100)errors.push('CRITERIA_COUNT');
 if(!execution||!Array.isArray(execution.results))errors.push('EXECUTION_REPORT_MISSING');
 if(map?.sourceHash!==current.sourceHash||execution?.sourceHash!==current.sourceHash)errors.push('SOURCE_CHANGED');
 if(!current.verificationContractHash||map?.verificationContractHash!==current.verificationContractHash||execution?.verificationContractHash!==current.verificationContractHash)errors.push('VERIFICATION_CONTRACT_CHANGED');
 for(const criterion of map?.criteria??[]){
  const issues=[],number=criterion.criterionNumber;
  if(!Number.isInteger(number)||number<1||number>100||numbers.has(number))issues.push('DUPLICATE_OR_UNKNOWN_CRITERION');numbers.add(number);
  if(!criterion.criterionText||!STATUSES.has(criterion.status)||!EVIDENCE_KINDS.has(criterion.evidenceKind)||typeof criterion.reason!=='string')issues.push('INVALID_CRITERION');
  if(expectedCriteria&&criterion.criterionText!==expectedCriteria[number-1]?.criterionText)issues.push('CRITERION_TEXT_CHANGED');
  if(META_FIELDS.has(number)&&criterion.evidenceKind!=='DERIVED_CANONICAL_GATE')issues.push('META_REQUIRES_DERIVED_GATE');
  if(META_FIELDS.has(number)&&['PASS','FAIL'].includes(criterion.status)&&criterion.evidence?.length!==1)issues.push('META_GATE_EVIDENCE_REQUIRED');
  if(criterion.status==='PASS'&&!criterion.evidence?.length)issues.push('PASS_WITHOUT_EVIDENCE');
  if(criterion.status==='NOT_VERIFIED'&&!criterion.reason)issues.push('UNEXPLAINED_NOT_VERIFIED');
  const claims=new Set();
  for(const evidence of criterion.evidence??[]){
   if(evidence.sourceHash!==current.sourceHash||evidence.verificationContractHash!==current.verificationContractHash)issues.push('EVIDENCE_FINGERPRINT_CHANGED');
   if(criterion.evidenceKind==='DERIVED_CANONICAL_GATE'){
    if(!evidence.gateArtifact?.startsWith('reports/security/')||!evidence.gateArtifactHash||!evidence.gateSourceHash||!evidence.derivedField||!Object.hasOwn(evidence,'expectedValue')){issues.push('INCOMPLETE_DERIVED_EVIDENCE');continue;}
    if(META_FIELDS.has(number)&&evidence.derivedField!==META_FIELDS.get(number))issues.push('WRONG_META_FIELD');
    try{
     const bytes=await read(evidence.gateArtifact),gate=JSON.parse(bytes),value=fieldAt(gate,evidence.derivedField);
     if(hash(bytes)!==evidence.gateArtifactHash||gate.sourceHash!==current.sourceHash||gate.sourceHash!==evidence.gateSourceHash||gate.verificationContractHash!==current.verificationContractHash)issues.push('STALE_GATE_EVIDENCE');
     if(value===undefined||criterion.status!==(value===evidence.expectedValue?'PASS':'FAIL'))issues.push('DERIVED_STATUS_MISMATCH');
    }catch{issues.push('DERIVED_GATE_MISSING');}
    continue;
   }
   if(criterion.status!=='PASS')continue;
   if(criterion.evidenceKind==='DIRECT_EXECUTED_TEST'){
    const identity=`${evidence.testFile}:${evidence.testCase}:${evidence.evidenceClaim}`;
    if(claims.has(identity))issues.push('DUPLICATE_CLAIM');claims.add(identity);
    if(!evidence.testFile?.startsWith('tests/')||!evidence.testCase||!evidence.evidenceClaim?.trim()||evidence.assertionId!=='CASE_ASSERTION_SET'||!evidence.productionPath||!evidence.reportArtifact?.startsWith('tests/reports/')||!evidence.artifactHash||!Array.isArray(evidence.testCommand)||!evidence.testCommand.length){issues.push('INCOMPLETE_DIRECT_EVIDENCE');continue;}
    if(!current.files[evidence.testFile]||current.files[evidence.testFile]!==execution?.files?.[evidence.testFile]||!current.files[evidence.productionPath]||current.files[evidence.productionPath]!==execution?.files?.[evidence.productionPath])issues.push('SOURCE_BINDING_MISSING');
    const suite=execution?.results?.find(result=>result.artifact===evidence.reportArtifact&&JSON.stringify(result.command)===JSON.stringify(evidence.testCommand));
    const test=suite?.cases?.find(value=>value.file===evidence.testFile&&value.name===evidence.testCase);
    if(!suite||suite.status!=='PASS'||suite.exitCode!==0||suite.skipped!==0||!test||test.status!=='PASS'||test.skipped)issues.push('CASE_NOT_EXECUTED_OR_SKIPPED');
    try{
     const bytes=await read(evidence.reportArtifact),source=await read(evidence.testFile);
     if(hash(bytes)!==evidence.artifactHash||suite?.artifactHash!==evidence.artifactHash)issues.push('ARTIFACT_CHANGED');
     const events=bytes.split('\n').flatMap(line=>{try{return[JSON.parse(line)];}catch{return[];}});
     if(!events.some(event=>event.type==='test:pass'&&event.name===evidence.testCase&&event.file?.endsWith('/'+evidence.testFile)&&!event.skip&&!event.todo))issues.push('SUMMARY_ONLY_EVIDENCE');
     if(!caseAssertionCount(source,evidence.testCase,evidence.sourceAnchor??evidence.testCase))issues.push('CASE_ASSERTION_MISSING');
    }catch{issues.push('EVIDENCE_ARTIFACT_MISSING');}
   }else if(criterion.evidenceKind==='LIVE_EXTERNAL_EVIDENCE'){
    if(!evidence.providerId||!evidence.modelId||!evidence.artifactRevision||!evidence.executionId||!evidence.reportArtifact||!evidence.artifactHash)issues.push('INCOMPLETE_LIVE_MODEL_EVIDENCE');
    try{const bytes=await read(evidence.reportArtifact),model=JSON.parse(bytes);
     if(hash(bytes)!==evidence.artifactHash||model.sourceHash!==current.sourceHash||model.verificationContractHash!==current.verificationContractHash
      ||model.status!=='PASS'||!model.scope?.includes('ACTUAL_MODELS')||model.executionId!==evidence.executionId
      ||!model.models?.some(item=>item.id===evidence.modelId&&item.artifactRevision===evidence.artifactRevision))issues.push('FIXTURE_NOT_REAL_MODEL');
    }catch{issues.push('LIVE_MODEL_ARTIFACT_MISSING');}
   }else if(criterion.evidenceKind==='STATIC_ARCHITECTURE_EVIDENCE'){
    if(!evidence.productionPath||!evidence.reportArtifact||!evidence.artifactHash||!evidence.evidenceClaim||!current.files[evidence.productionPath])issues.push('STATIC_EVIDENCE_INCOMPLETE');
    try{if(hash(await read(evidence.reportArtifact))!==evidence.artifactHash)issues.push('STATIC_ARTIFACT_CHANGED');}catch{issues.push('STATIC_ARTIFACT_MISSING');}
   }else if(criterion.evidenceKind==='DEPLOYMENT_EVIDENCE'){
    if(evidence.currentState!=='PASS'||!evidence.reportArtifact||!evidence.artifactHash||!evidence.requiredEvidence)issues.push('DEPLOYMENT_EVIDENCE_INCOMPLETE');
    try{if(hash(await read(evidence.reportArtifact))!==evidence.artifactHash)issues.push('DEPLOYMENT_ARTIFACT_CHANGED');}catch{issues.push('DEPLOYMENT_ARTIFACT_MISSING');}
   }
  }
  errors.push(...issues.map(issue=>`${number}:${issue}`));results.push({...criterion,status:issues.length?'NOT_VERIFIED':criterion.status,evidenceIssues:issues});
 }
 for(let number=1;number<=100;number++)if(!numbers.has(number))errors.push(`${number}:CRITERION_MISSING`);
 return{status:errors.length?'FAIL':'PASS',errors,criteria:results,passCount:results.filter(c=>c.status==='PASS').length,failCount:results.filter(c=>c.status==='FAIL').length,notVerifiedCount:results.filter(c=>c.status==='NOT_VERIFIED').length,notApplicableCount:results.filter(c=>c.status==='NOT_APPLICABLE').length,directEvidenceCount:results.filter(c=>c.status==='PASS'&&c.evidenceKind==='DIRECT_EXECUTED_TEST').length,broadFeatureDerivedPassCount:0};
}

export async function currentEvidence(){
 const current={...await sourceFingerprint(),...await verificationContractFingerprint()},expected=acceptanceCriteria(await readFile('docs/prompts/T5-final.md','utf8'));
 const map=JSON.parse(await readFile('reports/security/t5-acceptance-evidence.json','utf8'));
 let execution;try{execution=JSON.parse(await readFile('tests/reports/t5-r1-execution.json','utf8'));}catch{execution=null;}
 return verifyAcceptanceEvidence(map,execution,current,undefined,expected);
}
