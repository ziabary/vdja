import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import ts from 'typescript';

export type typClassification = 'ARCHITECTURE_VIOLATION' | 'TARGET_NOT_IMPLEMENTED' | 'TEST_INFRA_FAILURE';
export interface intfArchitectureViolation { ruleId: string; classification: typClassification; file: string; line?: number; column?: number; message: string }
export interface intfRule { id: string; title: string; category: string; mechanism: string }
export const ROOT = resolve(import.meta.dirname, '../../..');
export const RULES: readonly intfRule[] = [
  ...['Platform dependency on module','Private cross-module import','Cross-module persistence import','Domain-specific platform core import'].map((title,i)=>({id:`ARCH-DEP-00${i+1}`,title,category:'dependencies',mechanism:'TypeScript import AST'})),
  ...['Database access ownership','ORM package dependency','Transport direct database access','Worker direct database access','SELECT star','Schema-qualified SQL'].map((title,i)=>({id:`ARCH-DB-00${i+1}`,title,category:'persistence',mechanism:i<4?'TypeScript AST and manifest':'SQL source'})),
  ...['Table name','Column prefix','Foreign-key column name','Object prefix','Routine parameter prefix','Procedural local prefix'].map((title,i)=>({id:`ARCH-DB-NAME-00${i+1}`,title,category:'naming',mechanism:'SQL source high-confidence patterns'})),
  ...['Class cls prefix','Interface intf prefix','Enum enu prefix','Type typ prefix','Exception ex prefix','Function and variable camelCase','Canonical constant UPPER_SNAKE_CASE'].map((title,i)=>({id:`ARCH-TS-NAME-00${i+1}`,title,category:'naming',mechanism:'TypeScript declaration AST'})),
  ...['Explicit any','Magic decision literal','Wildcard export','Broad anonymous public record'].map((title,i)=>({id:`ARCH-TS-00${i+1}`,title,category:'typescript',mechanism:'TypeScript AST'})),
  ...['Authority sole evaluator','Privilege helper duplication','Resource fact resolver decision leak'].map((title,i)=>({id:`ARCH-AUTH-00${i+1}`,title,category:'authority',mechanism:'TypeScript AST'})),
  ...['Direct model provider','Business model selection','Qdrant adapter ownership','AI output direct database write'].map((title,i)=>({id:`ARCH-AI-00${i+1}`,title,category:'ai',mechanism:'TypeScript AST high-confidence signals'})),
  ...['Notification provider boundary','Payment provider boundary','Provider SDK type in public contract'].map((title,i)=>({id:`ARCH-PROVIDER-00${i+1}`,title,category:'providers',mechanism:'TypeScript import AST'})),
  ...['Generic document storage in module','Business Qdrant access'].map((title,i)=>({id:`ARCH-DOC-00${i+1}`,title,category:'ai',mechanism:'TypeScript import AST'})),
  ...['Typed module manifest','Unique contribution IDs','Platform package manifest'].map((title,i)=>({id:`ARCH-MOD-00${i+1}`,title,category:'manifests',mechanism:'TypeScript manifest AST'})),
];
const RULE_IDS = new Set(RULES.map(r=>r.id));
const EXCLUDED = new Set(['node_modules','vendor','generated','dist','build','.svelte-kit','.git','tests','scripts','public']);
const ROOTS = ['src','db','apps','packages','modules'];
const ORM_PACKAGES = ['typeorm','sequelize','prisma','@prisma/client','@mikro-orm/core','mikro-orm','drizzle-orm','objection'];
const DB_PACKAGES = ['kysely','pg','knex','mssql','mysql','mysql2','sqlite3','better-sqlite3'];
const MODEL_PACKAGES = ['openai','@anthropic-ai/sdk','anthropic','ollama','@langchain/openai','llama-node','node-llama-cpp'];
const NOTIFY_PACKAGES = ['nodemailer','@sendgrid/mail','resend','postmark','twilio','@aws-sdk/client-ses','sms-ir'];
const PAYMENT_PACKAGES = ['stripe','paypal','@paypal/checkout-server-sdk','zarinpal','@adyen/api-library'];
const QDRANT = '@qdrant/js-client-rest';

export function firstPartyFiles(): string[] {
  const found: string[] = [];
  function walk(path: string): void {
    if (!existsSync(path)) return;
    for (const item of readdirSync(path,{withFileTypes:true})) {
      if (EXCLUDED.has(item.name)) continue;
      const child=join(path,item.name);
      if(item.isDirectory()) walk(child);
      else if(item.isFile() && /\.(?:tsx?|sql)$/.test(item.name) && !/\.d\.ts$/.test(item.name)) found.push(relative(ROOT,child).replaceAll('\\','/'));
    }
  }
  for(const root of ROOTS) walk(join(ROOT,root));
  return found.sort();
}
export function owner(file: string): {kind:'module'|'package'|'app'|'legacy'; name:string; layer:string} {
  const bits=file.split('/'); const kind=bits[0]==='modules'?'module':bits[0]==='packages'?'package':bits[0]==='apps'?'app':'legacy';
  const name=kind==='legacy'?'legacy':bits[1]??'';
  const lower=file.toLowerCase();
  const layer=file.startsWith('db/')||/\/((?:migrations?)|persistence|repositories?|db)(?:\/|\.|$)/.test(lower)?'persistence':/\/(?:routes?|controllers?|transport)(?:\/|\.|$)/.test(lower)?'transport':/\/(?:workers?|handlers?)(?:\/|\.|$)/.test(lower)||kind==='app'&&name==='worker'?'worker':/\/(?:domain|contracts?|ports?)(?:\/|\.|$)/.test(lower)?'domain':/\/(?:adapters?|providers?)(?:\/|\.|$)/.test(lower)?'adapter':'application';
  return {kind,name,layer};
}
export type typExecutionBoundary = 'PlatformPersistence'|'ExternalDatabaseAdapter'|'CompositionRoot'|'Transport'|'Application'|'Worker'|'Other';
export function classifyExecutionBoundary(file:string):typExecutionBoundary {
  const info=owner(file);
  if((info.kind==='package'&&info.name==='integrations'||info.kind==='module'&&info.name==='secretariat')
    && /\/(?:adapters?|connectors?)\//.test(file)
    && /(?:^|\/)(?:external[-_]?db|source[-_]?db|sql[-_]?server|postgres|mysql|mssql|database)(?:\/|\.|[-_])|(?:ExternalDatabase|SourceSql|SourceDatabase)Adapter\.tsx?$/i.test(file))return 'ExternalDatabaseAdapter';
  if(/\/(?:composition|bootstrap|container)(?:\/|\.|$)|(?:compositionRoot|bootstrap|container)\.tsx?$/i.test(file))return 'CompositionRoot';
  if(info.layer==='persistence')return 'PlatformPersistence';
  if(info.layer==='transport')return 'Transport';
  if(info.layer==='worker')return 'Worker';
  if(info.layer==='domain')return 'Other';
  return 'Application';
}
export function sortViolations(items: intfArchitectureViolation[]): intfArchitectureViolation[] {
  return items.sort((a,b)=>a.ruleId.localeCompare(b.ruleId)||a.file.localeCompare(b.file)||(a.line??0)-(b.line??0)||(a.column??0)-(b.column??0)||a.message.localeCompare(b.message));
}
function packageName(spec: string): string { return spec.startsWith('@')?spec.split('/').slice(0,2).join('/'):spec.split('/')[0]??spec; }
function importPath(file:string,spec:string): string {
  if(spec.startsWith('.')) return relative(ROOT,resolve(ROOT,dirname(file),spec)).replaceAll('\\','/');
  return spec.replace(/^@(?:targoman|platform)\//,'');
}
function rootOf(path:string): {kind:string;name:string}|null {
  const m=path.match(/(?:^|\/)(modules|packages)\/([^/]+)/); return m?{kind:m[1]!,name:m[2]!}:null;
}
function propName(node:ts.PropertyName):string|undefined {return ts.isIdentifier(node)||ts.isStringLiteral(node)||ts.isNumericLiteral(node)?node.text:undefined;}
function objectValue(node:ts.ObjectLiteralExpression,key:string):ts.Expression|undefined { const p=node.properties.find(p=>ts.isPropertyAssignment(p)&&propName(p.name)===key);return p&&ts.isPropertyAssignment(p)?p.initializer:undefined; }
function literal(node:ts.Expression|undefined):string|undefined {return node&&(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))?node.text:undefined;}
function isExported(node:ts.Node):boolean {return !!(ts.canHaveModifiers(node)&&ts.getModifiers(node)?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword));}
function source(file:string,contents?:string):ts.SourceFile {return ts.createSourceFile(file,contents??readFileSync(join(ROOT,file),'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);}
function add(out:intfArchitectureViolation[],id:string,file:string,node:ts.Node|undefined,message:string,classification:typClassification='ARCHITECTURE_VIOLATION'):void {
  if(!RULE_IDS.has(id)) throw new Error(`Unknown rule ${id}`);
  if(node){const p=node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());out.push({ruleId:id,classification,file,line:p.line+1,column:p.character+1,message});}
  else out.push({ruleId:id,classification,file,message});
}
function callName(node:ts.CallExpression):string {return node.expression.getText(node.getSourceFile());}
function isDbAccess(expr:string):boolean {return /^(?:db|database|platformDb|knex|kysely|pool|client|trx|transaction|queryRunner|atDB)(?:\.|$)/i.test(expr)&&/\.(?:query|raw|executeQuery|execute|selectFrom|insertInto|updateTable|deleteFrom|transaction|select|insert|update|delete)$/.test(expr)||/^(?:knex|atDB)$/.test(expr);}
function isPlatformPersistence(boundary:typExecutionBoundary):boolean {return boundary==='PlatformPersistence';}
function isExternalSourceCall(name:string):boolean {return /^(?:sourceDb|externalDb|sourceClient|externalClient|sourcePool)\.(?:query|execute|raw)$/.test(name);}
function isRepositoryQuery(name:string):boolean {return /^(?:\w*Repository|\w*Repo|repository|repo)\.(?:find|findById|get|list|save|insert|update|delete|query)/i.test(name);}
function isCompositionFactoryImport(node:ts.ImportDeclaration,target:string):boolean {
 if(!/\/(?:persistence|repositories?)(?:\/|\.|$)/.test(target)||/\/(?:tables?|migrations?|routines?)(?:\/|\.|$)/.test(target))return false;
 const bindings=node.importClause?.namedBindings;
 return !!bindings&&ts.isNamedImports(bindings)&&bindings.elements.length>0&&bindings.elements.every(binding=>/^(?:create|make|build|cls)[A-Z].*(?:Repository|Persistence|DatabaseAdapter|DbAdapter|Factory)$/.test(binding.propertyName?.text??binding.name.text));
}
function isPublicDomain(file:string,info:ReturnType<typeof owner>):boolean {return info.layer==='domain'||/\/(?:index|public|contracts?|domain)\.tsx?$/.test(file);}
function isModulePrivateImport(target:string):boolean {return !/\/(?:contracts?|integrations?|public)(?:\/|\.|$)/.test(target)&&!/\/index(?:\.tsx?)?$/.test(target);}

export function analyzeTypeScript(file:string,out:intfArchitectureViolation[],contents?:string):void {
 const sf=source(file,contents), info=owner(file), boundary=classifyExecutionBoundary(file); const isAuthority=info.kind==='package'&&info.name==='authority';
 const outboundContract=boundary==='ExternalDatabaseAdapter'&&/\/outbound\//.test(file)&&sf.statements.some(stmt=>ts.isImportDeclaration(stmt)&&ts.isStringLiteral(stmt.moduleSpecifier)&&/\/contracts?\//.test(stmt.moduleSpecifier.text)&&stmt.importClause?.namedBindings&&ts.isNamedImports(stmt.importClause.namedBindings)&&stmt.importClause.namedBindings.elements.some(element=>/^intf(?:ExternalDatabase|SourceDatabase)Outbound(?:Port|Connector)$/.test(element.propertyName?.text??element.name.text)));
 const identifiers=new Set<string>();
 const classBases=new Map<string,string>();
 const collectClasses=(node:ts.Node):void=>{if(ts.isClassDeclaration(node)&&node.name){const base=node.heritageClauses?.find(h=>h.token===ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression.getText(sf);if(base)classBases.set(node.name.text,base);}ts.forEachChild(node,collectClasses);};
 collectClasses(sf);
 const isExceptionBase=(name:string,visited=new Set<string>()):boolean=>{if(name==='Error'||name.endsWith('.Error')||name.startsWith('ex'))return true;if(visited.has(name))return false;visited.add(name);const base=classBases.get(name);return !!base&&isExceptionBase(base,visited);};
 const isStableDecision=(expression:ts.Expression):boolean=>{
  const name=expression.getText(sf);
  if(/(?:^|\.)(?:role|status|state|decision|permission|classification|privilege)$/.test(name))return true;
  if(/(?:^|\.)(?:resource|document|ticket|order|module|identity|account|user)\.(?:kind|mode)$/.test(name))return true;
  return /(?:^|\.)(?:payload|resource|order|ticket|document|module|identity|account|user)\.type$/.test(name);
 };
 const accessContext=(node:ts.Node):boolean=>{
  let parent:ts.Node|undefined=node.parent;
  for(let depth=0;parent&&depth<4;depth++,parent=parent.parent){
   if(ts.isPropertyAssignment(parent)&&/^(?:can[A-Z]|allowed|authorized|permission|access)/.test(propName(parent.name)??''))return true;
   if(ts.isIfStatement(parent)&&/\b(?:ALLOW|DENY|AccessDenied|authorize|permission|canRead|return\s+true|return\s+false)\b/.test(parent.thenStatement.getText(sf)))return true;
  }
  return false;
 };
 function inspect(node:ts.Node):void {
  if(ts.isIdentifier(node)) identifiers.add(node.text);
  if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)&&node.moduleSpecifier){
    const spec=ts.isStringLiteral(node.moduleSpecifier!)?node.moduleSpecifier!.text:'';
    const target=importPath(file,spec), dest=rootOf(target), pkg=packageName(spec);
    if(info.kind==='package'&&dest?.kind==='modules') {add(out,'ARCH-DEP-001',file,node,`Platform import of ${spec}`);if(['platform','contracts','ui-core'].includes(info.name))add(out,'ARCH-DEP-004',file,node,`Generic platform package imports business module ${spec}`);}
    if(info.kind==='module'&&dest?.kind==='modules'&&dest.name!==info.name){
      if(/\/(?:persistence|repositories?|tables?|migrations?|routines?)(?:\/|\.|$)/.test(target))add(out,'ARCH-DEP-003',file,node,`Cross-module persistence import ${spec}`);
      else if(isModulePrivateImport(target))add(out,'ARCH-DEP-002',file,node,`Private cross-module import ${spec}`);
    }
    const driver=DB_PACKAGES.includes(pkg);
    const platformImport=/\/(?:db|database|repositories?|persistence|tables?|sql)(?:\/|\.|$)/.test(target);
    if(driver||platformImport){
      const allowedFactory=ts.isImportDeclaration(node)&&boundary==='CompositionRoot'&&isCompositionFactoryImport(node,target);
      const allowedExternalDriver=boundary==='ExternalDatabaseAdapter'&&['pg','mysql','mysql2','mssql'].includes(pkg);
      if(!isPlatformPersistence(boundary)&&!allowedFactory&&!allowedExternalDriver)add(out,'ARCH-DB-001',file,node,`Database dependency outside owning persistence: ${spec}`);
      if(boundary==='Transport')add(out,'ARCH-DB-003',file,node,`Transport imports database dependency ${spec}`);
      if(boundary==='Worker')add(out,'ARCH-DB-004',file,node,`Worker imports database dependency ${spec}`);
    }
    if(info.kind==='module'&&MODEL_PACKAGES.includes(pkg))add(out,'ARCH-AI-001',file,node,`Module imports model provider ${spec}`);
    if(!isAuthority&&ts.isImportDeclaration(node)&&node.importClause?.namedBindings&&ts.isNamedImports(node.importClause.namedBindings))for(const binding of node.importClause.namedBindings.elements)if(/^(?:hasPriv|getPrivValue|getUserPrivValue|evaluateCRUD|resolvePrivilege|digestPrivileges)$/.test(binding.propertyName?.text??binding.name.text))add(out,'ARCH-AUTH-002',file,binding,`Canonical privilege helper imported outside Authority`);
    if(pkg===QDRANT){if(info.kind==='module')add(out,'ARCH-DOC-002',file,node,`Module imports Qdrant ${spec}`);else if(!(info.kind==='package'&&info.name==='knowledge'&&info.layer==='adapter'))add(out,'ARCH-AI-003',file,node,`Qdrant client outside Knowledge adapter ${spec}`);}
    if(info.kind==='module'&&NOTIFY_PACKAGES.includes(pkg))add(out,'ARCH-PROVIDER-001',file,node,`Module imports notification provider ${spec}`);
    if(PAYMENT_PACKAGES.includes(pkg)&&!(info.kind==='package'&&info.name==='commercial'&&info.layer==='adapter'))add(out,'ARCH-PROVIDER-002',file,node,`Payment provider outside Commercial adapter ${spec}`);
    if(info.kind==='module'&&isPublicDomain(file,info)&&[...MODEL_PACKAGES,...NOTIFY_PACKAGES,...PAYMENT_PACKAGES,QDRANT].includes(pkg))add(out,'ARCH-PROVIDER-003',file,node,`Provider SDK in domain/public contract ${spec}`);
    if(info.kind==='module'&&/^(?:@aws-sdk\/client-s3|@google-cloud\/storage|[a-z-]*s3|multer)$/.test(pkg))add(out,'ARCH-DOC-001',file,node,`Generic document/object storage dependency ${spec}`);
  }
  if(ts.isExportDeclaration(node)&&!node.exportClause)add(out,'ARCH-TS-003',file,node,'Wildcard export');
  if(node.kind===ts.SyntaxKind.AnyKeyword)add(out,'ARCH-TS-001',file,node,'Explicit any type');
  if(ts.isClassDeclaration(node)&&node.name){const name=node.name.text,isException=name.startsWith('ex')||isExceptionBase(classBases.get(name)??'');if(isException){if(!name.startsWith('ex'))add(out,'ARCH-TS-NAME-005',file,node,`Exception ${name} lacks ex prefix`);}else if(!name.startsWith('cls'))add(out,'ARCH-TS-NAME-001',file,node,`Class ${name} lacks cls prefix`);}
  if(ts.isInterfaceDeclaration(node)&&!node.name.text.startsWith('intf'))add(out,'ARCH-TS-NAME-002',file,node,`Interface ${node.name.text} lacks intf prefix`);
  if(ts.isEnumDeclaration(node)&&!node.name.text.startsWith('enu'))add(out,'ARCH-TS-NAME-003',file,node,`Enum ${node.name.text} lacks enu prefix`);
  if(ts.isTypeAliasDeclaration(node)&&!node.name.text.startsWith('typ'))add(out,'ARCH-TS-NAME-004',file,node,`Type ${node.name.text} lacks typ prefix`);
  if(ts.isFunctionDeclaration(node)&&node.name&&!/^[a-z][A-Za-z0-9]*$/.test(node.name.text))add(out,'ARCH-TS-NAME-006',file,node,`Function ${node.name.text} is not camelCase`);
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)){
    const name=node.name.text, statement=node.parent.parent;
    const canonical=isExported(statement)&&ts.isVariableDeclarationList(node.parent)&&(node.parent.flags&ts.NodeFlags.Const)!==0&&node.initializer&&(
      /^[A-Z]/.test(name)||/(?:max|min|default|retry|timeout|limit|size|count|ttl)/i.test(name)&&(
        ts.isNumericLiteral(node.initializer)||ts.isStringLiteral(node.initializer)||ts.isNoSubstitutionTemplateLiteral(node.initializer)));
    if(canonical&&!/^[A-Z][A-Z0-9_]*$/.test(name))add(out,'ARCH-TS-NAME-007',file,node,`Canonical exported constant ${name} is not UPPER_SNAKE_CASE`);
    else if(!/^[a-z][A-Za-z0-9]*$/.test(name)&&!/^[A-Z][A-Z0-9_]*$/.test(name)&&!/^[_$]/.test(name))add(out,'ARCH-TS-NAME-006',file,node,`Variable ${name} is not camelCase`);
  }
  if((ts.isIfStatement(node)&&ts.isBinaryExpression(node.expression)||ts.isCaseClause(node)&&ts.isCaseBlock(node.parent)&&ts.isSwitchStatement(node.parent.parent)&&isStableDecision(node.parent.parent.expression))){
    const expr=ts.isIfStatement(node)?node.expression:node.expression;
    if(ts.isCaseClause(node)&&ts.isStringLiteral(expr)||ts.isBinaryExpression(expr)&&[ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(expr.operatorToken.kind)&&((ts.isStringLiteral(expr.right)&&isStableDecision(expr.left))||(ts.isStringLiteral(expr.left)&&isStableDecision(expr.right))))add(out,'ARCH-TS-002',file,node,'Raw string in stable decision logic');
  }
  if(!isAuthority&&ts.isBinaryExpression(node)&&[ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken,ts.SyntaxKind.GreaterThanEqualsToken,ts.SyntaxKind.LessThanEqualsToken].includes(node.operatorToken.kind)){
    const expression=node.getText(sf);
    const directPrivilege=/(?:\.privs|\.ALL|\bprivs\b)/.test(expression);
    const mandatoryCompare=/(?:clearance|classification)/i.test(expression)&&/(?:>=|<=|===|!==)/.test(expression);
    const ownerOrRole=/(?:ownerId|\.role|\brole\b|\.acl|\.scope)/.test(expression);
    if(directPrivilege||mandatoryCompare||ownerOrRole&&accessContext(node))add(out,'ARCH-AUTH-001',file,node,'Authorization fact interpreted outside Authority');
  }
  if(!isAuthority&&ts.isFunctionDeclaration(node)&&node.name&&/^(?:hasPriv|getPrivValue|getUserPrivValue|evaluateCRUD|resolvePrivilege|digestPrivileges)$/.test(node.name.text))add(out,'ARCH-AUTH-002',file,node,`Canonical privilege helper ${node.name.text} outside Authority`);
  if(!isAuthority&&ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&/^(?:hasPriv|getPrivValue|getUserPrivValue|evaluateCRUD|resolvePrivilege|digestPrivileges)$/.test(node.name.text))add(out,'ARCH-AUTH-002',file,node,`Canonical privilege helper ${node.name.text} outside Authority`);
  if(/resourcefactresolver/i.test(file)||ts.isInterfaceDeclaration(node)&&/ResourceFactResolver/.test(node.name.text)){
    if(ts.isPropertySignature(node)||ts.isPropertyAssignment(node)){const name=propName(node.name);if(name&&/^(?:allowed|authorized|canRead|permissionGranted)$/.test(name))add(out,'ARCH-AUTH-003',file,node,`Resource fact resolver returns decision field ${name}`);}
  }
  if(info.kind==='module'&&ts.isPropertyAssignment(node)&&/^(?:model|modelName|provider|endpoint|gpu|servingEngine|fallback)$/.test(propName(node.name)??'')&&literal(node.initializer))add(out,'ARCH-AI-002',file,node,`Module selects ${propName(node.name)} directly`);
  if(ts.isCallExpression(node)){
    const name=callName(node);
    const externalSource=boundary==='ExternalDatabaseAdapter'&&isExternalSourceCall(name);
    if((isDbAccess(name)||boundary==='CompositionRoot'&&isRepositoryQuery(name))&&!isPlatformPersistence(boundary)&&!externalSource){add(out,'ARCH-DB-001',file,node,`Database execution ${name} outside persistence`);if(boundary==='Transport')add(out,'ARCH-DB-003',file,node,`Transport database execution ${name}`);if(boundary==='Worker')add(out,'ARCH-DB-004',file,node,`Worker database execution ${name}`);}
    if(/(?:\.raw|\.query|\.execute)\s*$/.test(name)&&node.arguments.some(a=>ts.isStringLiteral(a)&&/\b(?:CALL\s+sp_|SELECT\s+fn_)\b/i.test(a.text))&&!isPlatformPersistence(boundary)&&!externalSource)add(out,'ARCH-DB-001',file,node,'Stored routine invocation outside persistence');
    if(/^(?:(?:db|database|pool|client|trx|knex|kysely|atDB|queryRunner|sourceDb|externalDb|sourceClient|externalClient|sourcePool)\.)?(?:query|raw|execute|executeQuery)$/.test(name)){
      for(const argument of node.arguments)if(ts.isStringLiteral(argument)||ts.isNoSubstitutionTemplateLiteral(argument))inspectSqlExpression(argument,argument.text);
    }
    if(/(?:^|\/)(?:ai-router|ai|tasks?)\//.test(file)&&/(?:\.save|\.insert|\.update|\.delete|\.query|\.raw)$/.test(name)&&node.arguments.some(argument=>!ts.isStringLiteral(argument)&&!ts.isNoSubstitutionTemplateLiteral(argument)&&/(?:modelOutput|completion(?:Text|Content)|response(?:Text|Content)|generated(?:Text|Content)|output(?:Text|Content)|\.output\b|\.completion\b)/i.test(argument.getText(sf))))add(out,'ARCH-AI-004',file,node,'AI output passed directly to persistence write');
  }
  if(ts.isTaggedTemplateExpression(node)&&node.tag.getText(sf)==='sql'&&(ts.isNoSubstitutionTemplateLiteral(node.template)))inspectSqlExpression(node.template,node.template.text);
  if(ts.isTypeReferenceNode(node)&&node.typeName.getText(sf)==='Record'&&node.typeArguments?.length===2&&node.typeArguments[0]?.kind===ts.SyntaxKind.StringKeyword&&node.typeArguments[1]?.kind===ts.SyntaxKind.UnknownKeyword&&isPublicDomain(file,info)){
    let parent:ts.Node|undefined=node.parent;
    while(parent&&!ts.isSourceFile(parent)&&!isExported(parent))parent=parent.parent;
    if(parent&&ts.isTypeAliasDeclaration(parent)&&/(?:Input|Command|Result|Event|Facts|Resource)$/.test(parent.name.text))add(out,'ARCH-TS-004',file,node,'Broad anonymous Record in public domain contract');
  }
  ts.forEachChild(node,inspect);
 }
 function inspectSqlExpression(node:ts.Node,sqlText:string):void {
  if(!/^\s*(?:SELECT|INSERT|UPDATE|DELETE|CALL|WITH|CREATE|ALTER|DROP)\b/i.test(sqlText))return;
  if(boundary==='ExternalDatabaseAdapter'){
   if(/\b(?:platform|authority|audit|security_telemetry|usage|admission|reconciliation|governance|ai|jobs|documents|knowledge|notifications|tickets|commercial|crm|widget|secretariat|letter|followup)\.(?:tbl_|fn_|sp_)[a-z_0-9]+\b/i.test(sqlText))add(out,'ARCH-DB-001',file,node,'External database adapter addresses Platform authoritative object');
   if(/^\s*(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(sqlText)&&!outboundContract)add(out,'ARCH-DB-001',file,node,'Read-only external source adapter executes write SQL');
   return;
  }
  const sqlViolations:intfArchitectureViolation[]=[];
  analyzeSql(file,sqlText,sqlViolations);
  const position=sf.getLineAndCharacterOfPosition(node.getStart(sf));
  for(const finding of sqlViolations)out.push({...finding,line:position.line+1,column:position.character+1,message:finding.message});
  if(ts.isTaggedTemplateExpression(node.parent)&&!isPlatformPersistence(boundary))add(out,'ARCH-DB-001',file,node,'SQL template execution outside persistence');
 }
 inspect(sf);
 void identifiers;
}

const SQL_NAME_RULES:readonly [RegExp,string,string][]=[
 [/(?:CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION)\s+(?:[a-z_][\w]*\.)?([a-z_][\w]*)/gi,'ARCH-DB-NAME-004','fn_'],
 [/(?:CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE)\s+(?:[a-z_][\w]*\.)?([a-z_][\w]*)/gi,'ARCH-DB-NAME-004','sp_'],
 [/(?:CREATE\s+TRIGGER)\s+([a-z_][\w]*)/gi,'ARCH-DB-NAME-004','trg_'],
 [/(?:CREATE\s+(?:OR\s+REPLACE\s+)?VIEW)\s+(?:[a-z_][\w]*\.)?([a-z_][\w]*)/gi,'ARCH-DB-NAME-004','vw_'],
 [/(?:CREATE\s+MATERIALIZED\s+VIEW)\s+(?:[a-z_][\w]*\.)?([a-z_][\w]*)/gi,'ARCH-DB-NAME-004','mvw_'],
 [/(?:CREATE\s+(?:UNIQUE\s+)?INDEX)\s+([a-z_][\w]*)/gi,'ARCH-DB-NAME-004','idx_'],
 [/(?:CREATE\s+SEQUENCE)\s+(?:[a-z_][\w]*\.)?([a-z_][\w]*)/gi,'ARCH-DB-NAME-004','seq_'],
 [/(?:CREATE\s+EVENT)\s+(?:[a-z_][\w]*\.)?([a-z_][\w]*)/gi,'ARCH-DB-NAME-004','ev_'],
 [/(?:CONSTRAINT)\s+([a-z_][\w]*)\s+(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)/gi,'ARCH-DB-NAME-004',''],
];
function sqlAdd(out:intfArchitectureViolation[],id:string,file:string,text:string,index:number,message:string):void {const before=text.slice(0,index),line=before.split('\n').length,column=index-(before.lastIndexOf('\n')+1)+1;out.push({ruleId:id,classification:'ARCHITECTURE_VIOLATION',file,line,column,message});}
export function analyzeSql(file:string,text:string,out:intfArchitectureViolation[]):void {
 const cleaned=text.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g,m=>' '.repeat(m.length));
 const vendorDialect=file.endsWith('.sql')&&/(?:MySQL Community Server|ENGINE\s*=\s*InnoDB|CREATE\s+DATABASE\s+IF\s+NOT\s+EXISTS|\bUSE\s+master\s*;\s*GO\b|sys\.sql_logins)/i.test(text);
 if(!vendorDialect)for(const match of cleaned.matchAll(/\bSELECT\s+\*(?!\s*\))/gi))sqlAdd(out,'ARCH-DB-005',file,text,match.index,`SELECT * in authoritative SQL`);
 const objectPatterns=[
  /\b(?:FROM|JOIN|INTO|REFERENCES|CALL)\s+([a-z_][\w]*(?:\.[a-z_][\w]*)?)/gi,
  /(?:^|[;\n])\s*UPDATE\s+([a-z_][\w]*(?:\.[a-z_][\w]*)?)/gim,
  /\b(?:CREATE|ALTER|DROP)\s+TABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?([a-z_][\w]*(?:\.[a-z_][\w]*)?)/gi,
 ];
 for(const pattern of objectPatterns)for(const match of cleaned.matchAll(pattern)){
  const object=match[1]!;
  if(!vendorDialect&&!object.includes('.')&&!['SELECT','VALUES','UNNEST','GENERATE_SERIES','LATERAL','IF','NOT','EXISTS','SQLITE_MASTER','PUBLIC'].includes(object.toUpperCase()))sqlAdd(out,'ARCH-DB-006',file,text,match.index,`Unqualified SQL object ${object}`);
 }
 for(const match of cleaned.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[a-z_][\w]*\.)?([a-z_][\w]*)\s*\(([^;]*?)\)\s*;/gis)){
  const table=match[1]!,body=match[2]!;
  if(!/^tbl_[a-z][a-z0-9]*_[a-z][a-z0-9_]*$/.test(table))sqlAdd(out,'ARCH-DB-NAME-001',file,text,match.index,`Table ${table} violates tbl_<module>_<entity>`);
  const prefixMap:Record<string,string>={tbl_aaa_user:'usr',tbl_aaa_group:'grp',tbl_tkt_ticket:'tkt',tbl_com_voucher:'vch'};
  const prefix=prefixMap[table];
  for(const col of body.split(',')){
    const cm=col.trim().match(/^([a-z_][\w]*)\s+(?:varchar|text|integer|bigint|uuid|boolean|timestamp|numeric|jsonb|date|serial)/i);if(!cm)continue;
    const name=cm[1]!;
    if(prefix&&!name.startsWith(`${prefix}_`))sqlAdd(out,'ARCH-DB-NAME-002',file,text,match.index,`Column ${name} does not use registered ${prefix}_ prefix`);
    else if(!prefix&&/^(?:id|name|type|status|created_at|updated_at|deleted_at)$/.test(name))sqlAdd(out,'ARCH-DB-NAME-002',file,text,match.index,`Generic unprefixed column ${name}`);
    if(/\bREFERENCES\b/i.test(col)&&!/^([a-z]{3,5})_[a-z][a-z0-9_]*__([a-z]{3,5})_[a-z][a-z0-9_]*$/.test(name))sqlAdd(out,'ARCH-DB-NAME-003',file,text,match.index,`FK column ${name} lacks role__referenced-prefix form`);
  }
  for(const fk of body.matchAll(/\bFOREIGN\s+KEY\s*\(\s*([a-z_][\w]*)\s*\)/gi))if(!/^([a-z]{3,5})_[a-z][a-z0-9_]*__([a-z]{3,5})_[a-z][a-z0-9_]*$/.test(fk[1]!))sqlAdd(out,'ARCH-DB-NAME-003',file,text,match.index,`FK column ${fk[1]} lacks role__referenced-prefix form`);
 }
 for(const [pattern,id,prefix] of SQL_NAME_RULES)for(const m of cleaned.matchAll(pattern)){const name=m[1]!;const expected=prefix||({'PRIMARY KEY':'pk_','FOREIGN KEY':'fk_','UNIQUE':'uq_','CHECK':'ck_'}[m[2]?.toUpperCase()??'']??'');if(expected&&!name.startsWith(expected))sqlAdd(out,id,file,text,m.index,`Object ${name} requires ${expected} prefix`);}
 for(const m of cleaned.matchAll(/\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+[\w.]+\s*\(([^)]*)\)/gi))for(const p of m[1]!.split(',')){const pm=p.trim().match(/^(?:(INOUT|OUT|IN)\s+)?([a-z_][\w]*)\s+/i);if(pm){const expected=pm[1]?.toUpperCase()==='OUT'?'o_':pm[1]?.toUpperCase()==='INOUT'?'io_':'i_';if(!pm[2]!.startsWith(expected))sqlAdd(out,'ARCH-DB-NAME-005',file,text,m.index,`Routine parameter ${pm[2]} requires ${expected}`);}}
 for(const m of cleaned.matchAll(/\bDECLARE\s+([\s\S]*?)\bBEGIN\b/gi))for(const decl of m[1]!.split(';')){const dm=decl.trim().match(/^([a-z_][\w]*)\s+(CONSTANT\s+)?(RECORD|REFCURSOR|[a-z_][\w]*(?:\[\])?)/i);if(dm){const type=dm[3]!.toUpperCase(),expected=dm[2]?'c_':type==='REFCURSOR'?'cur_':type==='RECORD'?'r_':'v_';if(!dm[1]!.startsWith(expected))sqlAdd(out,'ARCH-DB-NAME-006',file,text,m.index,`Procedural local ${dm[1]} requires ${expected}`);}}
}

function packageManifests(out:intfArchitectureViolation[]):void {
 for(const folder of readdirSync(join(ROOT,'packages'),{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name)){
  const file=`packages/${folder}/package.json`;if(!existsSync(join(ROOT,file))){add(out,'ARCH-MOD-003',file,undefined,`Package manifest missing`, 'TARGET_NOT_IMPLEMENTED');continue;}
  const data=JSON.parse(readFileSync(join(ROOT,file),'utf8')) as {dependencies?:Record<string,string>;devDependencies?:Record<string,string>};
  for(const dep of Object.keys({...data.dependencies,...data.devDependencies}))if(ORM_PACKAGES.includes(dep))add(out,'ARCH-DB-002',file,undefined,`Prohibited ORM dependency ${dep}`);
 }
 const root=JSON.parse(readFileSync(join(ROOT,'package.json'),'utf8')) as {dependencies?:Record<string,string>;devDependencies?:Record<string,string>};
 for(const dep of Object.keys({...root.dependencies,...root.devDependencies}))if(ORM_PACKAGES.includes(dep))add(out,'ARCH-DB-002','package.json',undefined,`Prohibited ORM dependency ${dep}`);
}
function canonicalManifest(sf:ts.SourceFile):{object:ts.ObjectLiteralExpression;typed:boolean}|undefined {
 const unwrap=(expr:ts.Expression):ts.Expression=>ts.isSatisfiesExpression(expr)||ts.isAsExpression(expr)||ts.isParenthesizedExpression(expr)?unwrap(expr.expression):expr;
 const contract=(node:ts.TypeNode):boolean=>ts.isTypeReferenceNode(node)&&/^(?:intf|typ)ModuleManifest$/.test(node.typeName.getText(sf));
 for(const stmt of sf.statements)if(ts.isVariableStatement(stmt)&&isExported(stmt))for(const decl of stmt.declarationList.declarations){
  if(!ts.isIdentifier(decl.name)||!['MODULE_MANIFEST','manifest'].includes(decl.name.text)||!decl.initializer)continue;
  const value=unwrap(decl.initializer);
  if(ts.isObjectLiteralExpression(value))return {object:value,typed:!!(decl.type&&contract(decl.type)||ts.isSatisfiesExpression(decl.initializer)&&contract(decl.initializer.type))};
 }
 return undefined;
}
function contributionIds(node:ts.Expression|undefined,prefix:string,found:{kind:string;id:string;node:ts.Node}[],scope:string):void {
 if(!node)return;
 if(ts.isObjectLiteralExpression(node)){
  if(prefix==='route'){
   const path=literal(objectValue(node,'path'));
   const method=literal(objectValue(node,'method'));
   const surface=literal(objectValue(node,'surface'))??scope;
   const binding=literal(objectValue(node,'bindingId'))??'relative';
   if(path&&method)found.push({kind:'routeEffective',id:`${surface}:${binding}:${method.toUpperCase()} ${path}`,node});
  }
  for(const p of node.properties)if(ts.isPropertyAssignment(p)){
   const key=propName(p.name)??'';const value=p.initializer;
   if(['id','resourceTypeId','privilegeId','taskId','notificationTypeId','meterId','routeId'].includes(key)){const id=literal(value);if(id)found.push({kind:prefix==='route'?'routeContribution':prefix||key,id,node:p});}
   const category:Record<string,string>={resourceTypes:'resourceType',privileges:'privilege',privilegePaths:'privilege',tasks:'aiTask',aiTasks:'aiTask',notificationTypes:'notificationType',meters:'usageMeter',usageMeters:'usageMeter',routes:'route'};
   contributionIds(value,category[key]??prefix,found,scope);
  }
 }else if(ts.isArrayLiteralExpression(node))for(const item of node.elements)contributionIds(item,prefix,found,scope);
}
export function analyzeManifestSource(file:string,contents:string,out:intfArchitectureViolation[],seen:Map<string,string>):void {
  const sf=source(file,contents),canonical=canonicalManifest(sf);if(!canonical){add(out,'ARCH-MOD-001',file,sf,'Manifest must export canonical MODULE_MANIFEST or manifest object declaration');return;}
  const obj=canonical.object;
  if(!canonical.typed)add(out,'ARCH-MOD-001',file,obj,'Canonical exported manifest must have an explicit Module Manifest type or satisfies clause');
  const id=literal(objectValue(obj,'id'));if(!id)add(out,'ARCH-MOD-001',file,obj,'Manifest requires literal module id');
  for(const key of ['version','compatibility','instanceModel','capabilities'])if(!objectValue(obj,key))add(out,'ARCH-MOD-001',file,obj,`Manifest missing ${key}`);
  if(objectValue(obj,'version')&&!literal(objectValue(obj,'version')))add(out,'ARCH-MOD-001',file,obj,'Manifest version must be a static string');
  for(const key of ['compatibility','capabilities']){const value=objectValue(obj,key);if(value&&!ts.isObjectLiteralExpression(value))add(out,'ARCH-MOD-001',file,value,`${key} must be a typed object declaration`);}
  const capabilities=objectValue(obj,'capabilities');if(capabilities&&ts.isObjectLiteralExpression(capabilities)&&!objectValue(capabilities,'required'))add(out,'ARCH-MOD-001',file,capabilities,'Capabilities must declare required dependencies');
  for(const key of ['authorization','backend','frontend','persistence','jobs','events','integrations','documents','ai','notifications','ticketing','usage','admission','commercial','governance','observability']){
   const value=objectValue(obj,key);if(value&&!ts.isObjectLiteralExpression(value)&&!ts.isArrayLiteralExpression(value))add(out,'ARCH-MOD-001',file,value,`Contribution ${key} must be declarative object/array`);
  }
  const ids:{kind:string;id:string;node:ts.Node}[]=[];if(id)ids.push({kind:'module',id,node:obj});
  for(const [field,kind] of [['authorization','privilege'],['backend','route'],['frontend','route'],['persistence','persistence'],['jobs','job'],['events','event'],['integrations','integration'],['documents','resourceType'],['ai','aiTask'],['notifications','notificationType'],['ticketing','ticket'],['usage','usageMeter'],['admission','admission'],['commercial','commercial'],['governance','governance'],['observability','observability']] as const)contributionIds(objectValue(obj,field),kind,ids,field);
  for(const entry of ids){const key=`${entry.kind}:${entry.kind==='routeEffective'?`${id??file}:`:''}${entry.id}`,previous=seen.get(key);if(previous)add(out,'ARCH-MOD-002',file,entry.node,`Duplicate ${key}; first seen in ${previous}`);else seen.set(key,file);}
}
function manifests(out:intfArchitectureViolation[]):void {
 const seen=new Map<string,string>();
 for(const module of readdirSync(join(ROOT,'modules'),{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name)){
  const file=`modules/${module}/manifest.ts`;if(!existsSync(join(ROOT,file))){add(out,'ARCH-MOD-001',file,undefined,'Typed module manifest missing','TARGET_NOT_IMPLEMENTED');continue;}
  analyzeManifestSource(file,readFileSync(join(ROOT,file),'utf8'),out,seen);
 }
}
export function analyzeRepository():intfArchitectureViolation[] {
 const out:intfArchitectureViolation[]=[];
 for(const file of firstPartyFiles()){
  if(file.endsWith('.sql'))analyzeSql(file,readFileSync(join(ROOT,file),'utf8'),out);
  else analyzeTypeScript(file,out);
 }
 packageManifests(out);manifests(out);
 return sortViolations(out);
}
