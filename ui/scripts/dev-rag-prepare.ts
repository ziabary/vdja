import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfiguration } from '../packages/configuration/src/index.js';

const root=resolve('.secrets.t3.local'), data=resolve('.rag-data.local');
await mkdir(root,{recursive:true,mode:0o700});
for(const directory of ['canonical','cache','breach'])await mkdir(join(data,directory),{recursive:true,mode:0o700});
const staging=join(tmpdir(),'targoman-rag-staging');await mkdir(staging,{recursive:true,mode:0o700});
async function ensure(name:string,value:()=>string){
  const path=join(root,name);
  try{return(await readFile(path,'utf8')).trim();}catch{
    const created=value();await writeFile(path,created,{mode:0o600});await chmod(path,0o600);return created;
  }
}
await ensure('qdrant',()=>randomBytes(32).toString('base64url'));
const workerId=await ensure('rag-worker-id',randomUUID);
const onboardingRoleId=await ensure('rag-onboarding-role-id',randomUUID);
try{await readFile(join(root,'access-private'),'utf8');await readFile(join(root,'access-public'),'utf8');}
catch{
  const pair=generateKeyPairSync('ed25519');
  await writeFile(join(root,'access-private'),pair.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
  await writeFile(join(root,'access-public'),pair.publicKey.export({type:'spki',format:'pem'}),{mode:0o600});
}
const cert=spawnSync('python3',['scripts/dev-rag-cert.py',root],{stdio:'inherit'});
if(cert.status!==0)throw new Error('DEVELOPMENT_TLS_CERTIFICATE_REQUIRED');
type typDevConfig=Record<string,unknown>&{ai:Record<string,unknown>;admission:Record<string,Record<string,unknown>>;
  http:Record<string,unknown>;worker:Record<string,unknown>;auth?:Record<string,unknown>};
const baseline=JSON.parse(await readFile('deploy/examples/development/platform.cjson','utf8')) as typDevConfig;
baseline.database={...(baseline.database as Record<string,unknown>),name:'targoman_platform_rag'};
baseline.brand={...(baseline.brand as Record<string,unknown>),displayName:'ترگمان',shortName:'ترگمان',
  logo:'/brand/targoman-rag.png',logoLight:'/brand/targoman-login.png',favicon:'/brand/targoman-rag.png',primaryColor:'#0d6efd'};
type typPublicEndpoint={id:string;enabled:boolean;baseUrl:string;model:string};
const publicEndpoints=baseline.ai.endpoints as typPublicEndpoint[];
const selectedModelAt=process.argv.indexOf('--public-model-id');
const selectedModel=selectedModelAt>=0?process.argv[selectedModelAt+1]:undefined;
if(selectedModelAt>=0&&!selectedModel)throw new Error('MISSING_PUBLIC_MODEL_ID');
const publicModelStatus:string[]=[];
for(const endpoint of publicEndpoints.filter(item=>item.enabled)){
  try{
    const response=await fetch(new URL('/v1/models',endpoint.baseUrl),{redirect:'error',signal:AbortSignal.timeout(3000)});
    if(!response.ok)throw new Error('MODEL_DISCOVERY_FAILED');
    const body=await response.json() as unknown;
    if(!body||typeof body!=='object'||!Array.isArray((body as {data?:unknown}).data))throw new Error('INVALID_MODEL_DISCOVERY');
    const models=(body as {data:unknown[]}).data.flatMap(item=>
      item&&typeof item==='object'&&typeof (item as {id?:unknown}).id==='string'?[(item as {id:string}).id]:[]);
    const model=selectedModel?models.find(item=>item===selectedModel):models.length===1?models[0]:undefined;
    if(!model)throw new Error(selectedModel?'PUBLIC_AI_MODEL_NOT_SERVED':'PUBLIC_AI_MODEL_SELECTION_REQUIRED');
    endpoint.model=model;
    publicModelStatus.push(`${endpoint.id}:READY:${model}`);
  }catch(error){
    endpoint.enabled=false;
    publicModelStatus.push(`${endpoint.id}:${error instanceof Error?error.message:'MODEL_DISCOVERY_FAILED'}`);
  }
}
const app='https://app.localhost:5173',auth='https://auth.localhost:5174';
const admission=Object.fromEntries(Object.entries(baseline.admission).map(([name,policy])=>
  [name,{...policy,outputTokens:name==='faq'?40000:4000}]));
baseline.web={publicOrigin:app};
baseline.http={...baseline.http,allowedOrigins:[app]};
baseline.worker={...baseline.worker,identityId:workerId};
baseline.auth={enabled:true,issuer:auth,audience:'targoman-api',publicOrigin:auth,allowedApplicationOrigins:[app],
  accessTokenSeconds:300,activeKid:'rag-dev-v1',privateKeyRef:'file:/run/secrets/access-private',
  publicKeys:[{kid:'rag-dev-v1',publicKeyRef:'file:/run/secrets/access-public'}],
  session:{absoluteLifetimeSeconds:3600,refreshLifetimeSeconds:3600,inactivityLifetimeSeconds:1800},
  password:{contextWords:[],compromised:{kind:'LOCAL_SHA1',directory:join(data,'breach')}},
  authenticatedAdmission:admission,privilegedAdmission:admission,
  methods:{organizationalOidc:{enabled:false},legacyKey:{enabled:true,selfProvision:!process.argv.includes('--no-legacy-self-provision'),
    onboardingTenantId:'development',onboardingRoleId},developmentPassword:process.argv.includes('--password-file')}};
baseline.fileManagement={enabled:true,storage:{kind:'LOCAL',profileId:'rag-dev',root:join(data,'canonical')},
  uploads:{mode:'PROXY',partBytes:5242880,ttlMs:60000,timeoutMs:10000,maxConcurrent:4,maxBytes:10485760,
    maxPendingBytes:41943040,maxTenantStorageBytes:104857600,maxTenantAssets:100},
  downloads:{ranges:true,conditional:true,maxConcurrent:4},
  cache:{scope:'REPLICA_PRIVATE',root:join(data,'cache'),maxBytes:10485760,maxEntries:5,ttlMs:60000,timeoutMs:10000},
  staging:{root:staging,maxBytes:10485760},
  security:{privateOnly:true,integrityRequired:true,malware:{mode:'DISABLED_LOW_ASSURANCE',timeoutMs:1000,maxBytes:10485760,policyVersion:'development-local-v1'}}};
baseline.knowledge={enabled:true,indexProfileId:'rag-dev-v1',chunkingProfile:'utf16-window-v1',chunkChars:256,overlapChars:0,
  qdrant:{endpoint:'http://127.0.0.1:6333',apiKeyRef:'file:/run/secrets/qdrant',timeoutMs:5000,maxResponseBytes:1048576},
  query:{maxQuestionBytes:1024,candidateLimit:20,contextBytes:10000,maxOutputTokens:200},
  admission:{requestsPerMinute:30,concurrent:5,dailyRequests:1000,dailyInputChars:1000000,inputChars:10000,
    uploadBytes:0,outputTokens:1000,tokenBudget:1000000}};
const modelsAt=process.argv.indexOf('--models-config');
if(modelsAt>=0){
  const path=process.argv[modelsAt+1];if(!path)throw new Error('MISSING_MODELS_CONFIG_PATH');
  const models=JSON.parse(await readFile(path,'utf8')) as {protected:unknown;dataGovernance:unknown};
  baseline.ai.protected=models.protected;baseline.dataGovernance=models.dataGovernance;
}
const oidcAt=process.argv.indexOf('--oidc-config');
if(oidcAt>=0){
  const path=process.argv[oidcAt+1];if(!path)throw new Error('MISSING_OIDC_CONFIG_PATH');
  const policy=JSON.parse(await readFile(path,'utf8')) as unknown;
  (baseline.auth!.methods as Record<string,unknown>).organizationalOidc=policy;
}
const configPath=join(root,'platform-rag.cjson');
await writeFile(configPath,JSON.stringify(baseline,null,2)+'\n',{mode:0o600});
await loadConfiguration(configPath);
console.log(JSON.stringify({status:'PREPARED',config:configPath,web:app,auth,knowledgeEnabled:true,
  publicModels:publicModelStatus,modelConfiguration:modelsAt>=0?'SUPPLIED':'DEVELOPMENT_RAG_MODEL_CONFIGURATION_REQUIRED'}));
