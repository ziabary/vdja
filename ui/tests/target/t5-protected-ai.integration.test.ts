import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { loadConfiguration } from '../../packages/configuration/src/index.js';
import { validateProtectedAi, validateAiGovernance } from '../../packages/configuration/src/protected-ai.js';
import { createTargetPool, withTargetTransaction } from '../../packages/persistence/src/target.js';
import { createT5Subject } from './support/t5-live-subject.js';
import { createAiRunPersistence } from '../../packages/ai-router/src/persistence.js';
import { clsProtectedAiRouter } from '../../packages/ai-router/src/protected.js';
import { createUsagePersistence } from '../../packages/usage/src/persistence.js';
import { clsAiEgressGovernance } from '../../packages/data-governance/src/index.js';
import { enuProtectedAiTask } from '../../packages/contracts/src/protected-ai.js';
const config=process.env.T4_PG_CONFIG,secrets=process.env.T4_SECRETS_DIR;
if(process.env.T5_REQUIRE_LIVE==='1'&&(!config||!secrets))throw new Error('T5_LIVE_CONFIGURATION_REQUIRED');
test('protected Router uses actual provider HTTP and PostgreSQL run/capacity evidence with governance on every fallback',
  {skip:!config||!secrets},async t=>{
    const snapshot=await loadConfiguration(config!),api=await createTargetPool(snapshot,'api',secrets),worker=await createTargetPool(snapshot,'worker',secrets),migration=await createTargetPool(snapshot,'migration',secrets);
    const subject=await createT5Subject(snapshot,migration,api,worker),context=subject.context;
    const received:unknown[]=[];let mode:'valid'|'wrong-dimension'|'duplicate-index'|'nan'|'wrong-model'|'oversize'|'unavailable'|'redirect'='valid';
    const server=createServer(async(request,response)=>{
      const chunks:Buffer[]=[];for await(const chunk of request)chunks.push(Buffer.from(chunk));
      const body=JSON.parse(Buffer.concat(chunks).toString()) as Record<string,unknown>;received.push({path:request.url,body});
      if(mode==='unavailable'){response.writeHead(503).end();return;}
      if(mode==='redirect'){response.writeHead(307,{Location:'http://127.0.0.1:1/protected-egress'}).end();return;}
      response.setHeader('Content-Type','application/json');
      const model=mode==='wrong-model'?'unapproved-model':body.model;
      if(request.url==='/v1/embeddings'){
        const input=body.input as string[];
        response.end(JSON.stringify({model,usage:{prompt_tokens:4,total_tokens:4},data:input.map((_,index)=>({index:mode==='duplicate-index'?0:index,
          embedding:mode==='wrong-dimension'?[1,2]:mode==='nan'?[1,null,2]:[1,2,3]})),...(mode==='oversize'?{unexpected:'a'.repeat(100000)}:{})}));
      }else if(request.url==='/score')response.end(JSON.stringify({model,usage:{prompt_tokens:6,total_tokens:6},data:(body.text_2 as string[]).map((_,index)=>({index,score:index+0.1}))}));
      else response.end(JSON.stringify({model,usage:{prompt_tokens:10,completion_tokens:3},choices:[{finish_reason:'stop',message:{content:'{"answer":"پاسخ مجاز","citations":[]}'}}]}));
    });await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    const address=server.address();assert.ok(address&&typeof address!=='string');const baseUrl=`http://127.0.0.1:${address.port}`;
    const protectedAi=validateProtectedAi({models:[
      {id:'embedding-v1',modelId:'embedding-model',artifactRevision:'revision-v1',kind:'EMBEDDING',dimensions:3,maxInputBytes:100000,contextTokens:131072,maxOutputTokens:0},
      {id:'rerank-v1',modelId:'rerank-model',artifactRevision:'revision-v1',kind:'RERANK',dimensions:0,maxInputBytes:100000,contextTokens:131072,maxOutputTokens:0},
      {id:'answer-v1',modelId:'answer-model',artifactRevision:'revision-v1',kind:'GENERATION',dimensions:0,maxInputBytes:100000,contextTokens:131072,maxOutputTokens:1024}
    ],endpoints:[
      {id:'embed-approved',modelProfileId:'embedding-v1',enabled:true,baseUrl,capabilities:[enuProtectedAiTask.DocumentEmbed,enuProtectedAiTask.QueryEmbed],maxConcurrent:2,timeoutMs:3000},
      {id:'embed-unapproved',modelProfileId:'embedding-v1',enabled:true,baseUrl,capabilities:[enuProtectedAiTask.DocumentEmbed,enuProtectedAiTask.QueryEmbed],maxConcurrent:2,timeoutMs:3000},
      {id:'rerank-approved',modelProfileId:'rerank-v1',enabled:true,baseUrl,capabilities:[enuProtectedAiTask.Rerank],maxConcurrent:2,timeoutMs:3000},
      {id:'answer-approved',modelProfileId:'answer-v1',enabled:true,baseUrl,capabilities:[enuProtectedAiTask.Answer],maxConcurrent:2,timeoutMs:3000}
    ],tasks:Object.fromEntries(Object.values(enuProtectedAiTask).map(task=>[task,{modelProfileId:task===enuProtectedAiTask.Answer?'answer-v1':task===enuProtectedAiTask.Rerank?'rerank-v1':'embedding-v1',
      preferredEndpoints:task===enuProtectedAiTask.Answer?['answer-approved']:task===enuProtectedAiTask.Rerank?['rerank-approved']:['embed-approved','embed-unapproved'],maxAttempts:2,maxInputBytes:100000,maxResponseBytes:32768}]))},'test-router');
    const governanceConfig=validateAiGovernance({policyVersion:'policy-v1',destinations:['embed-approved','rerank-approved','answer-approved'].map(endpointId=>({endpointId,origin:baseUrl,boundary:'PRIVATE_INTERNAL',region:'test-private',permittedTasks:Object.values(enuProtectedAiTask),permittedClassifications:['LOW','CRITICAL'],retention:'NO_RETENTION',training:'PROHIBITED'}))},'test-router',protectedAi);
    const evidence:unknown[]=[];
    const router=new clsProtectedAiRouter({configuration:()=>({value:protectedAi,fingerprint:snapshot.fingerprint}),store:createAiRunPersistence(api),subject:subject.subject,usage:createUsagePersistence(api),
      governance:new clsAiEgressGovernance(governanceConfig,async(ctx,event)=>{evidence.push({requestId:ctx.requestId,...event});})});
    const request=(overrides:Record<string,unknown>={})=>({context:{...context,requestId:randomUUID()},task:enuProtectedAiTask.DocumentEmbed,sources:[{classification:'LOW' as const}],texts:['authorized source one','authorized source two'],...overrides});
    try{
      await t.test('embedding, query, reranking and answer preserve semantic tasks/model revision and actual usage',async()=>{
        const embedding=await router.execute(request());assert.deepEqual(embedding.vectors,[[1,2,3],[1,2,3]]);assert.equal(embedding.profile.artifactRevision,'revision-v1');assert.equal(embedding.inputTokens,4);
        const query=await router.execute(request({task:enuProtectedAiTask.QueryEmbed,texts:['protected question'],sources:[{classification:'CRITICAL'}]}));assert.deepEqual(query.vectors,[[1,2,3]]);
        const rerank=await router.execute(request({task:enuProtectedAiTask.Rerank,query:'question'}));assert.deepEqual(rerank.scores,[0.1,1.1]);
        const answer=await router.execute(request({task:enuProtectedAiTask.Answer,texts:undefined,messages:[{role:'system',content:'Trusted task instruction'},{role:'user',content:'Untrusted source data'}],maxOutputTokens:100}));assert.ok(answer.text?.includes('پاسخ'));
      });
      await t.test('unapproved fallback receives zero bytes and approved provider failure does not grant egress',async()=>{
        const before=received.length;mode='unavailable';await assert.rejects(router.execute(request()),(error:unknown)=>!!error&&typeof error==='object'&&'safeClass' in error&&error.safeClass==='PROVIDER_5XX');assert.equal(received.length,before+1);
        assert.ok(JSON.stringify(evidence).includes('EGRESS_DENIED'));mode='valid';
        const denied=received.length;await assert.rejects(router.execute(request({sources:[{classification:'HIGH'}]})),/PROTECTED_EGRESS_DENIED/);assert.equal(received.length,denied);
      });
      await t.test('malformed vectors, index duplicates, wrong model, oversized responses and redirects fail before result publication',async()=>{
        for(const invalid of ['wrong-dimension','duplicate-index','nan','wrong-model','oversize','redirect'] as const){mode=invalid;const before=received.length;await assert.rejects(router.execute(request()));assert.equal(received.length,before+1);}
        mode='valid';const before=received.length;await assert.rejects(router.execute(request({texts:['a'.repeat(100001)]})),(error:unknown)=>!!error&&typeof error==='object'&&'safeClass' in error&&error.safeClass==='CONTEXT_BUDGET_EXCEEDED');assert.equal(received.length,before);
      });
      await t.test('AI Run/Attempt records retain metadata only and context cannot be fabricated from inactive Session',async()=>{
        const runs=await migration.query<{air_task:string;air_status:string}>('SELECT air_task,air_status FROM ai_router.tbl_air_run WHERE air_tenant_id=$1',[context.tenantId]);
        assert.ok(runs.rowCount&&runs.rowCount>=10);assert.ok(runs.rows.some(row=>row.air_task===enuProtectedAiTask.Rerank&&row.air_status==='SUCCEEDED'));
        const columns=await migration.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema='ai_router' AND table_name='tbl_air_run'");
        assert.ok(columns.rows.every(row=>!/(prompt|content|query|messages|text|vector)/u.test(row.column_name)));
        const before=received.length;await assert.rejects(router.execute(request({context:{...context,sessionId:randomUUID()}})),/EXECUTION_SUBJECT_INACTIVE/);assert.equal(received.length,before);
      });
    }finally{
      server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await subject.clean();await api.end();await worker.end();await migration.end();
    }
  });
