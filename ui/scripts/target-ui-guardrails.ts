import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {join,relative,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {parse} from 'svelte/compiler';

export type typUiRule='UI01'|'UI02'|'UI03'|'UI04'|'UI05'|'UI06'|'UI07'|'UI08'|'UI09'|'UI10'|'UI11'|'UI12'|'UI13'|'UI14'|'UI15'|'UI16'|'UI19'|'UI20'|'UI21'|'UI22'|'UI23'|'UI24';
export interface intfUiFinding {readonly rule:typUiRule;readonly path:string;readonly line:number;readonly message:string}
const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const TARGETS=['apps/web','packages/contracts','packages/branding','packages/ui-core','packages/calendar-core','packages/calendar-svelte'];
const SOURCE_EXT=new Set(['.ts','.svelte','.scss','.css','.js','.json']);
const IGNORED=new Set(['node_modules','.svelte-kit','build','dist','.vite','tests']);
const UTILITY_OWNER='apps/web/src/lib/styles/main.scss';
const COMPETING_ICONS=/(?:bootstrap-icons|lucide(?:-svelte)?|@heroicons\/|@iconify\/|material-icons|@material-design-icons\/|react-icons|phosphor-icons|@tabler\/icons)/i;
const CUSTOMER_SCOPE=/@(?:fapa|customer(?:-[a-z0-9-]+)?|client(?:-[a-z0-9-]+)?|tenant(?:-[a-z0-9-]+)?)\/[a-z0-9-]+/i;
function files(directory:string):string[]{return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?(IGNORED.has(entry.name)?[]:files(join(directory,entry.name))):SOURCE_EXT.has(extname(entry.name))?[join(directory,entry.name)]:[]);}
function lineAt(source:string,position:number):number{return source.slice(0,position).split('\n').length;}
function isAllowedTransport(path:string):boolean{return /apps\/web\/src\/lib\/(?:api|streaming)\/transport\.ts$/.test(path);}
function isCalendarOwner(path:string):boolean{return path.startsWith('packages/calendar-core/');}
function isMarkdownOwner(path:string):boolean{return path.startsWith('packages/ui-core/src/rich-content/');}
function add(findings:intfUiFinding[],rule:typUiRule,path:string,source:string,position:number,message:string):void{findings.push({rule,path,line:lineAt(source,position),message});}
function scriptRanges(source:string,path:string):readonly {text:string;offset:number}[]{
  if(!path.endsWith('.svelte'))return [{text:source,offset:0}];
  const ast=parse(source,{filename:path}) as unknown as {instance?:{content?:{start:number;end:number}};module?:{content?:{start:number;end:number}}};
  return [ast.instance?.content,ast.module?.content].filter((item):item is {start:number;end:number}=>!!item).map(item=>({text:source.slice(item.start,item.end),offset:item.start}));
}
export function evaluateUiSource(path:string,source:string):readonly intfUiFinding[]{
  const findings:intfUiFinding[]=[];
  if(path.endsWith('package.json')){
    try{const manifest=JSON.parse(source) as {name?:string;dependencies?:Record<string,string>;devDependencies?:Record<string,string>};
      if(TARGETS.some(target=>path===`${target}/package.json`)&&!/^@targoman\/[a-z0-9-]+$/.test(manifest.name??''))add(findings,'UI19',path,source,0,'Target workspace package must use @targoman/*');
      if(Object.keys({...manifest.dependencies,...manifest.devDependencies}).some(name=>CUSTOMER_SCOPE.test(name)))add(findings,'UI19',path,source,0,'Customer-specific package dependency');
      if(Object.keys({...manifest.dependencies,...manifest.devDependencies}).some(name=>COMPETING_ICONS.test(name)))add(findings,'UI21',path,source,0,'Competing functional icon dependency');
    }catch{add(findings,'UI19',path,source,0,'Invalid target package manifest');}
    if(/"(?:tailwindcss|@tailwindcss\/[^\"]+)"/.test(source))add(findings,'UI01',path,source,0,'Tailwind dependency');
    if(/"(?:@qdrant\/[^\"]+|pg|knex|mysql2?|openai)"/.test(source)&&path.startsWith('apps/web/'))add(findings,'UI06',path,source,0,'Backend/provider dependency in Web');
    return findings;
  }
  if(/\.(?:css|scss)$/.test(path)){
    if(/@tailwind|@apply\b/.test(source))add(findings,'UI01',path,source,0,'Tailwind directive');
    if(/\.(?:invisible|flex-row)\s*\{/.test(source)||/z-index\s*:\s*\d+/.test(source)||path!==UTILITY_OWNER&&/\.(?:fa-num|ltr|rtl|hidden)\s*\{/.test(source))add(findings,'UI15',path,source,0,'Global utility outside canonical owner or numeric overlay layer');
    return findings;
  }
  if(path.endsWith('.svelte')){
    for(const match of source.matchAll(/\{@html\b/g)){if(!isMarkdownOwner(path))add(findings,'UI05',path,source,match.index,'Raw HTML outside Markdown owner');}
    if(/href\s*=\s*\{\s*[^}]*\+[^}]*\}/.test(source))add(findings,'UI11',path,source,0,'Unreviewed dynamic URL concatenation');
    if(/<style[\s\S]*\.(?:fa-num|ltr|rtl|hidden)\s*\{/.test(source))add(findings,'UI15',path,source,0,'Shared utility redefined in component');
    if(/<(?:button|a)\b[^>]*>\s*\p{Extended_Pictographic}\s*<\/(?:button|a)>/u.test(source))add(findings,'UI21',path,source,0,'Emoji used as functional icon');
    if((path==='apps/web/src/routes/+layout.svelte'||path.startsWith('packages/ui-core/src/')||path.startsWith('packages/calendar-svelte/src/'))&&/(?:>\s*(?:Home|Guest|Theme|Support|Legal|Choose date|Previous month|Next month|No items|More|Close)\s*<|(?:aria-label|label)="(?:Home|Guest|Theme|Support|Legal|Choose date|Previous month|Next month|No items|More|Close)")/.test(source))add(findings,'UI23',path,source,0,'Framework-owned English label outside localization boundary');
  }
  if(path==='apps/web/src/routes/(public)/foundation/+page.server.ts'&&!/requireDevelopmentShowcase\(import\.meta\.env\.DEV\)/.test(source))add(findings,'UI24',path,source,0,'Showcase route must use server-side development guard');
  for(const {text,offset} of scriptRanges(source,path)){
    const file=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    function visit(node:ts.Node,topLevel:boolean):void{
      const position=offset+node.getStart(file);
      if(ts.isImportDeclaration(node)){
        const spec=node.moduleSpecifier;
        if(ts.isStringLiteral(spec)){
          const value=spec.text;
          if(/tailwind/i.test(value))add(findings,'UI01',path,source,position,'Tailwind import');
          if(CUSTOMER_SCOPE.test(value))add(findings,'UI19',path,source,position,'Customer-specific first-party package import');
          if(COMPETING_ICONS.test(value))add(findings,'UI21',path,source,position,'Competing functional icon import');
          if(/(?:persian-datepicker|jalali-moment|jalaali-js)/.test(value)&&!isCalendarOwner(path))add(findings,'UI04',path,source,position,'Second calendar engine');
          if(/(?:markdown-it|dompurify|jsdom|marked|sanitize-html)/.test(value)&&!isMarkdownOwner(path))add(findings,'UI05',path,source,position,'Markdown/sanitizer import outside owner');
          if(/(?:@qdrant|(^|\/)pg$|knex|mysql|openai|anthropic|redis)/.test(value)&&path.startsWith('apps/web/'))add(findings,'UI06',path,source,position,'Provider/database import in Web');
          if(/\$env\/(?:static|dynamic)\/private|\.server(?:\.ts)?$/.test(value)&&!path.includes('/server/')&&!path.endsWith('.server.ts')&&!path.endsWith('hooks.server.ts'))add(findings,'UI07',path,source,position,'Server-only import in browser graph');
          if(/\/modules\/[^/]+\/(?!web\/)/.test(value))add(findings,'UI12',path,source,position,'Private module import');
        }
      }
      if(ts.isExportDeclaration(node)&&node.exportClause===undefined)add(findings,'UI12',path,source,position,'Wildcard export');
      if(node.kind===ts.SyntaxKind.AnyKeyword)add(findings,'UI12',path,source,position,'Explicit any in target source');
      if(ts.isCallExpression(node)){
        const callee=node.expression;
        if(ts.isIdentifier(callee)&&callee.text==='fetch'&&!isAllowedTransport(path))add(findings,'UI02',path,source,position,'Direct fetch outside transport');
        if(ts.isPropertyAccessExpression(callee)&&callee.name.text==='fetch'&&!isAllowedTransport(path))add(findings,'UI02',path,source,position,'Direct fetch outside transport');
        if(ts.isPropertyAccessExpression(callee)&&['setItem','getItem'].includes(callee.name.text)&&/localStorage|sessionStorage/.test(callee.expression.getText(file)))add(findings,'UI16',path,source,position,'Browser storage read/write in target code');
      }
      if(ts.isNewExpression(node)&&/^(XMLHttpRequest|WebSocket|EventSource)$/.test(node.expression.getText(file))&&!isAllowedTransport(path))add(findings,'UI02',path,source,position,'Direct network constructor outside transport');
      if(ts.isBinaryExpression(node)&&['===','==','!==','!=','>=','<=','>','<'].includes(node.operatorToken.getText(file))&&/\.(?:role|privs|clearance|classification|ALL)\b|(?:resource|record|entity)\.ownerId\b/.test(node.getText(file)))add(findings,'UI03',path,source,position,'Frontend authorization interpretation');
      if(topLevel&&!path.startsWith('apps/web/static/')&&ts.isIdentifier(node)&&['window','document','localStorage','sessionStorage'].includes(node.text)&&!(ts.isPropertyAccessExpression(node.parent)&&node.parent.name===node))add(findings,'UI08',path,source,position,'Top-level browser global in SSR-safe module');
      if(ts.isPropertyAccessExpression(node)&&node.expression.getText(file)==='process'&&node.name.text==='env'&&!path.includes('/server/')&&!path.endsWith('.server.ts')&&!path.endsWith('hooks.server.ts')&&path!=='apps/web/vite.config.ts')add(findings,'UI07',path,source,position,'Private environment access');
      const nextTop=topLevel&&!ts.isFunctionLike(node)&&!ts.isClassDeclaration(node)&&!ts.isArrowFunction(node);
      ts.forEachChild(node,child=>visit(child,nextTop));
    }
    file.statements.forEach(statement=>visit(statement,true));
  }
  if(/\b(?:Targoman|Sepidjoo|AIAR)\b/.test(source)&&path.startsWith('apps/web/src/')&&!path.includes('/server/'))add(findings,'UI09',path,source,0,'Hard-coded reference/customer brand');
  if((path.startsWith('apps/web/src/routes/')||path.startsWith('packages/ui-core/src/')||path.startsWith('packages/calendar-svelte/src/'))&&(/(?:["'`]FAPA["'`]|>\s*FAPA\s*<)/i.test(source)||/(?:displayName|shortName|brandName|title)\s*[:=]\s*(?:packageJson|pkg|manifest)\.name\b/.test(source)))add(findings,'UI20',path,source,0,'Generic visual brand must come from BrandProfile');
  if(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(source)&&path.startsWith('apps/web/src/')&&!path.includes('/server/'))add(findings,'UI10',path,source,0,'Hard-coded deployment URL');
  if(/javascript:|onerror\s*=/.test(source)&&path.endsWith('.svelte'))add(findings,'UI11',path,source,0,'Unsafe HTML/URL sink');
  if(/Component\s*<\s*any\s*>|props\s*:\s*Record<string,\s*unknown>/.test(source))add(findings,'UI13',path,source,0,'Loose contribution component/props correlation');
  if(path==='packages/contracts/src/index.ts'&&/interface intfCursorPage<[\s\S]*?\btotal\s*[?:]/.test(source))add(findings,'UI14',path,source,0,'Default cursor page requires total');
  if(/(?:jalaliToGregorian|gregorianToJalali|daysInJalaliMonth)\s*\(/.test(source)&&!isCalendarOwner(path)&&!path.startsWith('packages/calendar-svelte/'))add(findings,'UI04',path,source,0,'Calendar conversion outside core');
  return findings;
}
export function checkTargetAssets(staticRoot:string):readonly intfUiFinding[]{
  const required=['fonts/iransansx/fontiran.css','fonts/iransansx/fonts/woff2/IRANSansX-Regular.woff2','fonts/iransansx/fonts/woff2/IRANSansX-Bold.woff2','fonts/fontawesome/v6.2.0/all.css','fonts/fontawesome/v6.2.0/webfonts/fa-solid-900.woff2'];
  const findings:intfUiFinding[]=[];
  for(const path of required){const file=join(staticRoot,path);if(!existsSync(file)||!statSync(file).isFile()||statSync(file).size===0)findings.push({rule:'UI22',path:`apps/web/static/${path}`,line:0,message:'Required legacy font/icon asset missing or empty'});}
  return findings;
}
export function scanTargetUi():readonly intfUiFinding[]{const guardPath=join(ROOT,'apps/web/src/routes/(public)/foundation/+page.server.ts');const guard=existsSync(guardPath)?[]:[{rule:'UI24' as const,path:'apps/web/src/routes/(public)/foundation/+page.server.ts',line:0,message:'Showcase server guard missing'}];return [...TARGETS.flatMap(target=>files(join(ROOT,target)).flatMap(path=>evaluateUiSource(relative(ROOT,path).replaceAll('\\','/'),readFileSync(path,'utf8')))),...checkTargetAssets(join(ROOT,'apps/web/static')),...guard];}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const findings=scanTargetUi();for(const finding of findings)process.stderr.write(`${finding.rule} ${finding.path}:${finding.line} ${finding.message}\n`);process.stdout.write(`ARCHITECTURE_VIOLATION=${findings.length}\nTEST_INFRA_FAILURE=0\n`);if(findings.length)process.exitCode=1;}
  catch(error){process.stderr.write(`${String(error)}\n`);process.stdout.write('ARCHITECTURE_VIOLATION=0\nTEST_INFRA_FAILURE=1\n');process.exitCode=2;}
}
