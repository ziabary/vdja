import { randomUUID,generateKeyPairSync,randomBytes } from 'node:crypto';
import { mkdtemp,cp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { loadConfiguration,type intfSiemConfiguration } from '../../../packages/configuration/src/index.js';
import { createTargetPool,withTargetTransaction } from '../../../packages/persistence/src/target.js';
import { loadAccessTokenKeys,issueAccessToken } from '../../../packages/session/src/access-token.js';
import { createPublicApi } from '../../../apps/api/src/index.js';
import { createWorkerRuntime } from '../../../apps/worker/src/composition.js';
import { createT5Subject } from './t5-live-subject.js';
import { startQdrantFixture } from './t5-qdrant-fixture.js';
import { startProviderFixture } from './t5-provider-fixture.js';
import { startS3Fixture } from './t5-s3-fixture.js';
import { S3Client,CreateBucketCommand } from '@aws-sdk/client-s3';
import { hashPassword } from '../../../packages/authentication/src/index.js';
import type {intfProtectedAiConfiguration} from '../../../packages/contracts/src/protected-ai.js';
import type {intfGovernanceConfiguration} from '../../../packages/data-governance/src/index.js';

export async function startT5RuntimeFixture(kind:'LOCAL'|'S3_COMPATIBLE'='LOCAL',origins?:Readonly<{application:string;auth:string;apiPort:number}>,siem?:intfSiemConfiguration,
  approvedModels?:Readonly<{ai:intfProtectedAiConfiguration;governance:intfGovernanceConfiguration}>){
  const cleanup:(()=>Promise<unknown>)[]=[];
  try {
  const configPath=process.env.T4_PG_CONFIG,secretsPath=process.env.T4_SECRETS_DIR;
  if(!configPath||!secretsPath)throw new Error('T5_LIVE_CONFIGURATION_REQUIRED');
  const baseline=await loadConfiguration(configPath),migration=await createTargetPool(baseline,'migration',secretsPath),apiPool=await createTargetPool(baseline,'api',secretsPath),workerPool=await createTargetPool(baseline,'worker',secretsPath);
  cleanup.push(()=>migration.end(),()=>apiPool.end(),()=>workerPool.end());
  const identity=await createT5Subject(baseline,migration,apiPool,workerPool),context=identity.context;
  cleanup.push(()=>identity.clean());
  const root=await mkdtemp(join(tmpdir(),'t5-runtime-')),secretRoot=join(root,'secrets');
  cleanup.push(()=>rm(root,{recursive:true,force:true}));
  await cp(secretsPath,secretRoot,{recursive:true});
  const qdrant=await startQdrantFixture();cleanup.push(()=>qdrant.close());
  const provider=await startProviderFixture();cleanup.push(()=>provider.close());
  const s3=kind==='S3_COMPATIBLE'?await startS3Fixture():null;if(s3)cleanup.push(()=>s3.close());
  await writeFile(join(secretRoot,'qdrant'),qdrant.apiKey,{mode:0o600});
  const serviceId=randomUUID(),serviceMembership=randomUUID();
  await withTargetTransaction(migration,context,async tx=>{
    await tx.query("INSERT INTO identity.tbl_idn_identity (idn_id,idn_kind,idn_display_name) VALUES ($1,'PLATFORM_SERVICE','T5 runtime Worker')",[serviceId]);
    await tx.query('INSERT INTO identity.tbl_idn_membership (idm_id,idm_identity__idn_id,idm_tenant_id) VALUES ($1,$2,$3)',[serviceMembership,serviceId,context.tenantId]);
  });
  cleanup.push(()=>withTargetTransaction(migration,context,async tx=>{await tx.query('DELETE FROM identity.tbl_idn_membership WHERE idm_id=$1',[serviceMembership]);await tx.query('DELETE FROM identity.tbl_idn_identity WHERE idn_id=$1',[serviceId]);}));
  const keysFixture=generateKeyPairSync('ed25519');
  await writeFile(join(secretRoot,'access-private'),keysFixture.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
  await writeFile(join(secretRoot,'access-public'),keysFixture.publicKey.export({type:'spki',format:'pem'}),{mode:0o600});
  const authenticatedAdmission=Object.fromEntries(Object.entries(baseline.value.admission).map(([module,policy])=>[module,{...policy,inputChars:Math.min(2000000,policy.inputChars*2),outputTokens:module==='faq'?40000:4000,requestsPerMinute:policy.requestsPerMinute*2,concurrent:policy.concurrent*2}]));
  const privilegedAdmission=Object.fromEntries(Object.entries(authenticatedAdmission).map(([module,policy])=>[module,{...policy,inputChars:Math.min(2000000,policy.inputChars*2),outputTokens:module==='faq'?80000:8000,requestsPerMinute:policy.requestsPerMinute*2,concurrent:policy.concurrent*2}]));
  const applicationOrigin=origins?.application??'https://app.example.invalid',authOrigin=origins?.auth??'https://auth.example.invalid';
  const fixtureAuth={enabled:true,issuer:authOrigin,publicOrigin:authOrigin,allowedApplicationOrigins:[applicationOrigin],audience:'targoman-api',accessTokenSeconds:300,activeKid:'v1',privateKeyRef:'file:/run/secrets/access-private',publicKeys:[{kid:'v1',publicKeyRef:'file:/run/secrets/access-public'}],session:{absoluteLifetimeSeconds:3600,refreshLifetimeSeconds:3600,inactivityLifetimeSeconds:1800},password:{contextWords:[],compromised:{kind:'LOCAL_SHA1',directory:join(root,'breach')}},authenticatedAdmission,privilegedAdmission};
  const local={kind:'LOCAL',profileId:'fixture',root:join(root,'canonical')};
  let storage:unknown=local;
  if(s3){
    await writeFile(join(secretRoot,'storage-access'),s3.credentials.accessKeyId,{mode:0o600});await writeFile(join(secretRoot,'storage-secret'),s3.credentials.secretAccessKey,{mode:0o600});
    const client=new S3Client({endpoint:s3.endpoint,region:'us-east-1',forcePathStyle:true,credentials:s3.credentials,maxAttempts:1});
    try{await client.send(new CreateBucketCommand({Bucket:'t5-runtime-private'}));}finally{client.destroy();}
    storage={kind,profileId:'fixture',endpoint:s3.endpoint,region:'us-east-1',forcePathStyle:true,bucket:'t5-runtime-private',timeoutMs:5000,accessKeyRef:'file:/run/secrets/storage-access',secretKeyRef:'file:/run/secrets/storage-secret'};
  }
  const raw={...baseline.value,auth:fixtureAuth,web:{publicOrigin:applicationOrigin},http:{...baseline.value.http,allowedOrigins:[applicationOrigin],...(origins?{apiPort:origins.apiPort,apiInternalUrl:`http://127.0.0.1:${origins.apiPort}`}:{})},deployment:{...baseline.value.deployment,tenantId:context.tenantId},worker:{...baseline.value.worker,identityId:serviceId},
    siem:siem??{...baseline.value.siem,enabled:false},ai:{...baseline.value.ai,protected:approvedModels?.ai??provider.configuration},dataGovernance:approvedModels?.governance??provider.governance,
    fileManagement:{enabled:true,storage,uploads:{mode:'PROXY',partBytes:5242880,ttlMs:60000,timeoutMs:10000,maxConcurrent:4,maxBytes:10485760,maxPendingBytes:41943040,maxTenantStorageBytes:104857600,maxTenantAssets:100},
      downloads:{ranges:true,conditional:true,maxConcurrent:4},cache:{scope:'REPLICA_PRIVATE',root:join(root,'cache'),maxBytes:10485760,maxEntries:5,ttlMs:60000,timeoutMs:10000},staging:{root:join(root,'staging'),maxBytes:10485760},security:{privateOnly:true,integrityRequired:true}},
    knowledge:{enabled:true,indexProfileId:'fixture-profile-v1',chunkingProfile:'utf16-window-v1',chunkChars:256,overlapChars:0,qdrant:{endpoint:qdrant.endpoint,apiKeyRef:'file:/run/secrets/qdrant',timeoutMs:5000,maxResponseBytes:1048576},
      query:{maxQuestionBytes:1024,candidateLimit:20,contextBytes:10000,maxOutputTokens:200},admission:{requestsPerMinute:1000,concurrent:5,dailyRequests:1000,dailyInputChars:1000000,inputChars:10000,uploadBytes:0,outputTokens:1000,tokenBudget:1000000}}};
  const configurationPath=join(root,'platform.cjson');await writeFile(configurationPath,JSON.stringify(raw),{mode:0o600});const snapshot=await loadConfiguration(configurationPath);
  if(!snapshot.value.auth?.enabled||!snapshot.value.web)throw new Error('T5_AUTHENTICATED_WEB_CONFIGURATION_REQUIRED');
  const auth=snapshot.value.auth,keys=await loadAccessTokenKeys(auth,secretRoot);
  const bearer=()=>issueAccessToken({identityId:context.actorId!,tenantId:context.tenantId,sessionId:context.sessionId!,authorizationVersion:context.authorizationVersion!},keys,{issuer:auth.issuer,audience:auth.audience,lifetimeSeconds:auth.accessTokenSeconds});
  const api=await createPublicApi(snapshot,secretRoot);cleanup.push(()=>api.close());
  const worker=await createWorkerRuntime(snapshot,secretRoot);cleanup.push(()=>worker.close());const host=new URL(snapshot.value.web.publicOrigin).host;
  const server=await new Promise<ReturnType<typeof api.app.listen>>(resolve=>{const listening=api.app.listen(origins?.apiPort??0,'127.0.0.1',()=>resolve(listening));});
  cleanup.push(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  const address=server.address();if(!address||typeof address==='string')throw new Error('INVALID_RUNTIME_BINDING');const origin=`http://127.0.0.1:${address.port}`;
  return{root,configurationPath,secretRoot,snapshot,identity,context,migration,provider,qdrant,worker,origin,host,bearer,
    async enableLogin(){const password=randomBytes(24).toString('base64')+' fixture',email=`${context.actorId}@example.invalid`;
      const hash=await hashPassword(password);
      await withTargetTransaction(migration,context,tx=>tx.query('INSERT INTO authentication.tbl_ath_password_credential (apc_identity__idn_id,apc_password_hash) VALUES ($1,$2)',[context.actorId,hash]));return{email,password};},
    request(path:string,init:RequestInit={},anonymous=false):Promise<Response>{
      const headers=new Headers(init.headers);headers.set('host',host);if(!anonymous)headers.set('authorization',`Bearer ${bearer()}`);
      return new Promise((resolve,reject)=>{const req=httpRequest(path==='/ready'?`${origin}/ready`:`${origin}/api/knowledge${path}`,{method:init.method??'GET',headers:Object.fromEntries(headers),signal:init.signal??AbortSignal.timeout(30000)},res=>{
        const chunks:Buffer[]=[];let bytes=0;res.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>20971520){res.destroy(new Error('RESPONSE_LIMIT'));return;}chunks.push(chunk);});res.once('error',reject);
        res.once('end',()=>{const output=new Headers();for(const[name,value]of Object.entries(res.headers))if(typeof value==='string')output.set(name,value);
          const status=res.statusCode??500;resolve(new Response(status===204||status===304?null:Buffer.concat(chunks),{status,headers:output}));});
      });req.once('error',reject);if(typeof init.body==='string'||init.body instanceof Uint8Array)req.write(init.body);req.end();});
    },
    async close(){
      server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await worker.close();await api.close();
      await withTargetTransaction(migration,context,async tx=>{
        await tx.query('DELETE FROM usage.tbl_usg_rag_consumption WHERE urc_tenant_id=$1',[context.tenantId]);
        await tx.query('DELETE FROM session_core.tbl_ses_refresh_token WHERE srt_session__ses_id IN (SELECT ses_id FROM session_core.tbl_ses_session WHERE ses_identity__idn_id=$1)',[context.actorId]);
        await tx.query('DELETE FROM session_core.tbl_ses_session WHERE ses_identity__idn_id=$1',[context.actorId]);
        await tx.query('DELETE FROM authentication.tbl_ath_password_credential WHERE apc_identity__idn_id=$1',[context.actorId]);
        await tx.query('DELETE FROM knowledge.tbl_knw_projection WHERE kpr_tenant_id=$1',[context.tenantId]);await tx.query('UPDATE knowledge.tbl_knw_space SET ksp_generation_id=NULL WHERE ksp_tenant_id=$1',[context.tenantId]);
        for(const[table,column]of[['knowledge.tbl_knw_chunk','kch_tenant_id'],['knowledge.tbl_knw_membership','kmb_tenant_id'],['knowledge.tbl_knw_space','ksp_tenant_id'],['knowledge.tbl_knw_generation','kgn_tenant_id'],['file_management.tbl_fil_part','fpt_tenant_id'],['file_management.tbl_fil_transfer','ftr_tenant_id'],['jobs.tbl_job_work','job_tenant_id']]as const)await tx.query(`DELETE FROM ${table} WHERE ${column}=$1`,[context.tenantId]);
        await tx.query('UPDATE documents.tbl_doc_document SET doc_current_version_id=NULL WHERE doc_tenant_id=$1',[context.tenantId]);
        for(const[table,column]of[['documents.tbl_doc_asset','ast_tenant_id'],['documents.tbl_doc_version','dvr_tenant_id'],['documents.tbl_doc_document','doc_tenant_id'],['admission.tbl_adm_file_reservation','afr_tenant_id'],['usage.tbl_usg_file_consumption','ufc_tenant_id']]as const)await tx.query(`DELETE FROM ${table} WHERE ${column}=$1`,[context.tenantId]);
        await tx.query('DELETE FROM identity.tbl_idn_membership WHERE idm_id=$1',[serviceMembership]);await tx.query('DELETE FROM identity.tbl_idn_identity WHERE idn_id=$1',[serviceId]);
      });await identity.clean();await apiPool.end();await workerPool.end();await migration.end();await provider.close();await qdrant.close();await s3?.close();await rm(root,{recursive:true,force:true});
    }};
  } catch(error) {for(const release of cleanup.reverse())try{await release();}catch{/* preserve the primary setup failure */}throw error;}
}
