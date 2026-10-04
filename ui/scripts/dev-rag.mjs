import {spawn,spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {request as httpsRequest} from 'node:https';

// This launcher never inherits a process-wide TLS verification bypass.
delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
const flags=process.argv.slice(2);
const option=name=>{const at=flags.indexOf(name);return at<0?undefined:flags[at+1];};
function run(command,args){
  const result=spawnSync(command,args,{stdio:'inherit'});
  if(result.error||result.status!==0)throw new Error(`${command} ${args.join(' ')} failed`);
}
run('npm',['run','db:pg:start']);
run('npm',['run','db:target:dev:bootstrap','--','--database','targoman_platform_rag']);
run('node',['--import','tsx','scripts/dev-rag-prepare.ts',
  ...(option('--models-config')?['--models-config',option('--models-config')]:[]),
  ...(option('--public-model-id')?['--public-model-id',option('--public-model-id')]:[]),
  ...(option('--oidc-config')?['--oidc-config',option('--oidc-config')]:[]),
  ...(option('--password-file')?['--password-file',option('--password-file')]:[]),
  ...(flags.includes('--no-legacy-self-provision')?['--no-legacy-self-provision']:[])]);
run('npm',['run','db:target:migrate','--','--config','.secrets.t3.local/platform-rag.cjson','--secrets-dir','.secrets.t3.local']);
run('node',['--import','tsx','packages/persistence/src/bootstrap-rag-dev.ts',
  ...(option('--password-file')?['--password-file',option('--password-file')]:[]),
  ...(option('--oidc-map-file')?['--oidc-map-file',option('--oidc-map-file')]:[])]);
run('node',['scripts/dev-rag-qdrant.mjs']);

const children=[];
let finish;
const completion=new Promise(resolve=>{finish=resolve;});
const launch=(name,command,args,env={})=>{
  const child=spawn(command,args,{stdio:'inherit',env:{...process.env,...env}});
  child.once('exit',(code)=>{if(!stopping){console.error(`${name} exited: ${code}`);shutdown();process.exitCode=1;}});
  children.push(child);return child;
};
let stopping=false;
function shutdown(){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');finish();}
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
launch('API','npm',['run','dev:target:api','--','--config','.secrets.t3.local/platform-rag.cjson','--secrets-dir','.secrets.t3.local']);
launch('Worker','npm',['run','dev:target:worker','--','--config','.secrets.t3.local/platform-rag.cjson','--secrets-dir','.secrets.t3.local']);
launch('Web','npm',['run','dev:web'],{TARGOMAN_CONFIG_PATH:new URL('../.secrets.t3.local/platform-rag.cjson',import.meta.url).pathname,TARGOMAN_DEV_RAG_TLS:'1'});
launch('Auth TLS','node',['scripts/dev-rag-auth-proxy.mjs']);

const ca=await readFile('.secrets.t3.local/rag-dev-ca.pem');
function probe(host,port,path){return new Promise(resolve=>{
  const request=httpsRequest({hostname:'127.0.0.1',port,path,servername:host,headers:{host:`${host}:${port}`},ca,timeout:1500},response=>{
    response.resume();resolve(response.statusCode??0);
  });request.once('error',()=>resolve(0));request.once('timeout',()=>{request.destroy();resolve(0);});request.end();
});}
let api=false,web=false,auth=false;
for(let attempt=0;attempt<30&&!stopping;attempt++){
  try{const response=await fetch('http://127.0.0.1:3100/health',{signal:AbortSignal.timeout(1000)});api=response.ok;}catch{}
  web=(await probe('app.localhost',5173,'/login'))===200;
  auth=(await probe('auth.localhost',5174,'/api/auth/methods'))===200;
  if(api&&web&&auth)break;
  await new Promise(resolve=>setTimeout(resolve,500));
}
const config=JSON.parse(await readFile('.secrets.t3.local/platform-rag.cjson','utf8'));
const protectedAi=config.ai.protected;
let readiness=null;
try{readiness=await(await fetch('http://127.0.0.1:3100/ready',{signal:AbortSignal.timeout(10000)})).json();}catch{}
const tasks=[['DOCUMENT_EMBED','knowledge.document.embed'],['QUERY_EMBED','knowledge.query.embed'],['RERANK','knowledge.rerank'],['RAG_ANSWER','knowledge.answer']];
console.log('\nDevelopment RAG readiness');
for(const [name,status] of [['Web',web?'READY':'FAIL'],['Auth',auth?'READY':'FAIL'],
  ['Public AI model',config.ai.endpoints.filter(endpoint=>endpoint.enabled).map(endpoint=>endpoint.model).join(', ')||'CONFIG_REQUIRED'],
  ['Organizational OIDC',config.auth.methods.organizationalOidc.enabled?'CONFIGURED':'ORGANIZATIONAL_OIDC_CONFIG_REQUIRED'],
  ['Legacy Key Login',auth?'READY':'FAIL'],['PostgreSQL',api?'READY':'FAIL'],
  ['Worker',children[1]?.exitCode===null?'RUNNING':'FAIL'],['Storage',readiness?.dependencies?.files==='READY'?'READY':'FAIL'],['Qdrant','READY'],
  ...tasks.map(([label,task])=>[label,!protectedAi?.tasks?.[task]?'CONFIG_REQUIRED':readiness?.unavailableTasks?.includes(task)?'FAIL':readiness?.dependencies?.protectedAi==='READY'?'READY':'FAIL']),
  ['RAG UI','https://app.localhost:5173/rag']])console.log(`${name.padEnd(22)} ${status}`);
if(!protectedAi)console.log('DEVELOPMENT_RAG_MODEL_CONFIGURATION_REQUIRED: DOCUMENT_EMBED, QUERY_EMBED, RERANK, RAG_ANSWER');
if(!api||!web||!auth){process.exitCode=1;shutdown();}
await completion;
