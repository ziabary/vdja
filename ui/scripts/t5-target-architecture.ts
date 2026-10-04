import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import ts from 'typescript';
import {TARGET_PREFIXES,type intfTargetFinding} from './t4-target-architecture.js';
const PREFIXES=[...TARGET_PREFIXES,'apps/web/src/'];
export function targetFileFindings(file:string,source:string):readonly intfTargetFinding[]{
  if(!PREFIXES.some(prefix=>file.startsWith(prefix))||!file.endsWith('.ts'))return[];
  // Existing read-only migration CLI is a separate artifact, never a runtime module.
  if(file==='modules/translator/src/persistence/migrate.ts')return[];
  const findings:intfTargetFinding[]=[],add=(ruleId:string,message:string)=>findings.push({ruleId,file,message});
  const storage=file.startsWith('packages/storage/src/adapters/'),knowledgeAdapter=file==='packages/knowledge/src/adapters/qdrant.ts';
  const business=file.startsWith('modules/'),knowledge=file.startsWith('packages/knowledge/src/');
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  function visit(node:ts.Node):void{
    if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)){
      const spec=node.moduleSpecifier.text;
      if(/^@aws-sdk\/|^aws-sdk(?:\/|$)/u.test(spec)&&!storage)add('T5-FILE-001','S3 SDK outside approved Storage adapter');
      if(/^(?:@qdrant\/|qdrant(?:-client)?(?:\/|$))/u.test(spec)&&!knowledgeAdapter)add('T5-RAG-001','Qdrant client outside Knowledge vector adapter');
      if((business||knowledge)&&/^(?:node:)?fs(?:\/promises)?$/u.test(spec))add('T5-FILE-002','Filesystem dependency in business/Knowledge application code');
      if(knowledge&&!knowledgeAdapter&&/storage\/src|@targoman\/storage/u.test(spec))add('T5-RAG-002','RAG Storage access bypasses File Management');
      if(business&&/file-processing\/(?:src\/)?(?:index|service)/u.test(spec))add('T5-FILE-003','Business file operation bypasses File Management');
      if(business&&/ai-router\/.*(?:providers?|protected)|openai|vllm/u.test(spec))add('T5-RAG-003','Business provider selection bypasses semantic Router boundary');
    }
    if(ts.isCallExpression(node)){
      const name=node.expression.getText(tree);
      if((business||knowledge&&!knowledgeAdapter)&&/^(?:fetch|axios\.(?:post|get)|https?\.request)$/u.test(name))add('T5-RAG-004','Direct provider/network call in business or Knowledge application');
      if(/(?:getSignedUrl|createPresignedPost|\.presign)$/u.test(name)&&!file.startsWith('packages/file-management/src/'))add('T5-FILE-004','Signed managed transfer outside File Management');
      if((business||knowledge)&&/(?:storage|s3|bucket)\.(?:open|getObject|putObject|send|readFile|createReadStream)$/iu.test(name))add('T5-FILE-005','Direct managed bytes access outside File Management');
    }
    ts.forEachChild(node,visit);
  }visit(tree);return findings;
}
if(process.argv[1]?.endsWith('t5-target-architecture.ts')){
  const files=new Set<string>();
  for(const prefix of PREFIXES){const directory=prefix.endsWith('/')?prefix.slice(0,-1):prefix.slice(0,prefix.lastIndexOf('/'));
    function walk(path:string):void{for(const entry of readdirSync(path,{withFileTypes:true})){const child=join(path,entry.name);if(entry.isDirectory())walk(child);else if(entry.isFile()&&child.endsWith('.ts')&&PREFIXES.some(value=>child.startsWith(value)))files.add(child);}}
    try{walk(directory);}catch{/* absent capability is assessed by acceptance tests */}
  }
  const findings=[...files].flatMap(file=>targetFileFindings(file,readFileSync(file,'utf8')));
  mkdirSync('tests/reports',{recursive:true});writeFileSync('tests/reports/t5-target-architecture.json',JSON.stringify({findings},null,2)+'\n');
  console.log(`T5 target file/RAG architecture: ${findings.length} findings`);for(const finding of findings)console.log(`${finding.ruleId} ${finding.file}: ${finding.message}`);if(findings.length)process.exitCode=1;
}
