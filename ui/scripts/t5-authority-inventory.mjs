import {readdir,readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
import {sourceFingerprint,verificationContractFingerprint} from './t5-r1-source.mjs';
const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(['node_modules','build','dist','.svelte-kit','reports'].includes(e.name))continue;const p=dir+'/'+e.name;if(e.isDirectory())await walk(p);else if(/\.(?:[cm]?[jt]sx?|svelte)$/u.test(p))files.push(p);}}
for(const directory of ['apps','packages','modules','tests'])await walk(directory);
const inventory=[],bypasses=[];
const legacy=file=>file.startsWith('modules/translator/src/persistence/migrate')||file.startsWith('packages/persistence/src/migrations/');
for(const file of files){
 if(legacy(file))continue;let source=await readFile(file,'utf8');if(file.endsWith('.svelte'))source=[...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gu)].map(m=>m[1]).join('\n');
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);const pureAliases=new Set(['evaluateAuthority','getPrivValue']);
 function imports(node){if(ts.isImportSpecifier(node)&&['evaluateAuthority','getPrivValue'].includes(node.propertyName?.text??node.name.text))pureAliases.add(node.name.text);ts.forEachChild(node,imports);}imports(tree);
 function visit(node){if(ts.isCallExpression(node)){
  const expression=node.expression.getText(tree),last=ts.isPropertyAccessExpression(node.expression)?node.expression.name.text:ts.isIdentifier(node.expression)?node.expression.text:'';
  const pure=pureAliases.has(last),consumer=['authorize','authorizeBatch','authorizeMany','authorizeFields','authorizePublicTool','materializeAuthorized','materializeFields','fileLimitTier'].includes(last);
  if(pure||consumer){const testOnly=file.startsWith('tests/'),internal=file.startsWith('packages/authority/');
   const classification=testOnly?'TEST_ONLY':internal?'AUTHORITY_INTERNAL':pure?'BYPASS':'CANONICAL_AUTHORITY_SERVICE';
   const entry={file,line:tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1,expression,classification,
    mediatedByDocumentCore:!internal&&/documents|\.authorizeMany/u.test(expression),pathExpression:node.arguments.map(a=>a.getText(tree).slice(0,500)).join(',')};
   inventory.push(entry);if(classification==='BYPASS')bypasses.push(entry);
  }}ts.forEachChild(node,visit);}visit(tree);
}
const fingerprint=await sourceFingerprint(),contract=await verificationContractFingerprint();
const production=inventory.filter(e=>e.classification==='CANONICAL_AUTHORITY_SERVICE');
const consumers=production.filter(e=>/documents|knowledge|file-management|data-governance|apps\/runtime/u.test(e.file));
const familyNames=['Document discover','Document read','Document download','Document use','Document quote','Document manage',
 'Knowledge Space access','RAG coarse use authorization','final RAG candidate authorization','File Management download','File Management internal materialization/use',
 'tenant deny','ACL deny','classification deny','revoked subject'];
const operationFamilies=familyNames.map(name=>({name,applicable:true,consumerCallSites:consumers.filter(e=>
 name.startsWith('Document')?e.file.startsWith('packages/documents/'):
 name.startsWith('Knowledge')||name.startsWith('RAG')?e.file.startsWith('packages/knowledge/'):
 name.startsWith('File Management')?e.file.startsWith('packages/file-management/')||e.file.startsWith('packages/documents/'):
 true).map(e=>({file:e.file,line:e.line,expression:e.expression})),allowEvidence:[],denyEvidence:[],auditEvidence:[],siemEvidence:[],
 missingBranches:['ALLOW_DECISION_WITH_AUDIT','DENY_DECISION_WITH_AUDIT','CONFIGURED_SIEM_DELIVERY_FOR_FAMILY'],status:'NOT_VERIFIED'}));
const allPostT5DecisionsAudited=operationFamilies.every(family=>family.status==='PASS')?'PASS':'NOT_VERIFIED';
const result={generatedAt:new Date().toISOString(),sourceHash:fingerprint.sourceHash,verificationContractHash:contract.verificationContractHash,
 productionFilesScanned:files.filter(f=>!f.startsWith('tests/')).length,inventory,consumers,postT5Consumers:consumers.length,
 operationFamilies,productionAuthorityBypasses:bypasses.length,
 coverageLimitations:['AST inventory establishes call sites and bypass count. Generic Authority Audit/SIEM tests do not independently prove ALLOW and DENY for each T5 consumer family.'],allPostT5DecisionsAudited};
await writeFile('reports/security/t5-authority-inventory.json',JSON.stringify(result,null,2)+'\n');
await writeFile('docs/security/08-t5-authority-decision-boundary-fa.md',`# مرز تصمیم Authority پس از T5 و R1\n\nCURRENT — منبع: reports/security/t5-authority-inventory.json\n\nفایل‌های production بررسی‌شده: ${result.productionFilesScanned}. call siteهای consumer جدید T5: ${result.postT5Consumers}. bypass production: ${bypasses.length}.\n\nتصمیم ALLOW/DENY در clsAuthorityService ثبت می‌شود و شکست Audit تصمیم را متوقف می‌کند. Document Core، Knowledge و composition rootها به facade متصل‌اند. کنترل DB synchronization مجوز ایجاد نمی‌کند.\n\nاثبات ALLOW و DENY و durable SIEM eligibility برای **تمام شاخه‌های تمام مصرف‌کنندگان** هنوز NOT_VERIFIED است؛ وضعیت T4 برای V16.3.2 به دامنهٔ تازه ارث داده نمی‌شود.\n\n| فایل:خط | فراخوانی | طبقه |\n| --- | --- | --- |\n${inventory.map(e=>`| ${e.file}:${e.line} | ${e.expression.replaceAll('|','\\|')} | ${e.classification} |`).join('\n')}\n`);
console.log(JSON.stringify({files:result.productionFilesScanned,postT5Consumers:result.postT5Consumers,bypasses:bypasses.length}));if(bypasses.length)process.exitCode=1;
