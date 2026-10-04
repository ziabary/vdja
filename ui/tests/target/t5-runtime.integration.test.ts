import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {startT5RuntimeFixture} from './support/t5-runtime-fixture.js';
import {createTargetPool,withTargetTransaction} from '../../packages/persistence/src/target.js';
const live=!!process.env.T4_PG_CONFIG&&!!process.env.T4_SECRETS_DIR&&process.env.T5_REQUIRE_QDRANT==='1';
if(process.env.T5_REQUIRE_LIVE==='1'&&!live)throw new Error('T5_LIVE_RUNTIME_CONFIGURATION_REQUIRED');
function object(value:unknown):Record<string,unknown>{assert.ok(value&&typeof value==='object'&&!Array.isArray(value));return value as Record<string,unknown>;}
async function json(response:Response,expected=200):Promise<Record<string,unknown>>{const body:unknown=await response.json();assert.equal(response.status,expected,JSON.stringify(body));return object(body);}
for(const kind of ['LOCAL','S3_COMPATIBLE']as const)test(`authenticated target API + durable Worker + ${kind} + derived Qdrant run without legacy RAG/Auth/MySQL`,{skip:!live},async t=>{
  const fixture=await startT5RuntimeFixture(kind),documentId=randomUUID(),spaceId=randomUUID();let versionId='';
  const body=(value:unknown)=>({headers:{'content-type':'application/json'},body:JSON.stringify(value)});
  const upload=async(text:string,key:string)=>{const bytes=Buffer.from(text),sha256=createHash('sha256').update(bytes).digest('hex');
    const transfer=await json(await fixture.request('/transfers',{method:'POST',...body({documentId,idempotencyKey:key,filename:'private.txt',mediaType:'text/plain',bytes:bytes.length,sha256})}),201),id=String(transfer.id);
    await json(await fixture.request(`/transfers/${id}/parts/1`,{method:'PUT',headers:{'content-type':'application/octet-stream','x-content-sha256':sha256},body:bytes}));
    return json(await fixture.request(`/transfers/${id}/complete`,{method:'POST'}));};
  const drain=async()=>{assert.ok(fixture.worker.jobs);for(let count=0;count<15;count+=1){const result=await fixture.worker.jobs.next();if(result==='EMPTY')break;assert.equal(result,'SUCCEEDED');}};
  try{
    await t.test('readiness reports private Storage, Qdrant and configured protected models; missing model degrades the capability',async()=>{
      const ready=object(await(await fixture.request('/ready')).json()),dependencies=object(ready.dependencies);
      assert.equal(dependencies.files,'READY');assert.equal(dependencies.knowledge,'READY');assert.equal(dependencies.protectedAi,'READY');
      fixture.provider.state.models=[];
      const missing=object(await(await fixture.request('/ready')).json());assert.equal(object(missing.dependencies).protectedAi,'UNAVAILABLE');
      assert.equal((missing.unavailableTasks as unknown[]).filter(value=>String(value).startsWith('knowledge.')).length,4);
      assert.equal(fixture.provider.calls.length,0);delete fixture.provider.state.models;
    });
    await t.test('anonymous/mismatched tenant fail and all file operations run through the API File Management boundary',async()=>{
      assert.equal((await fixture.request('/documents',{},true)).status,401);
      assert.equal((await fixture.request('/documents',{headers:{'x-tenant-id':'other-tenant'}})).status,401);
      await json(await fixture.request('/documents',{method:'POST',...body({id:documentId,title:'Private runtime document',classification:'LOW'})}),201);
      const version=await upload('PRIVATE_RUNTIME_SOURCE: safe operations and documentation.','first');versionId=String(version.id);
      const list=await json(await fixture.request(`/documents/${documentId}/versions`));assert.equal((list.items as unknown[]).length,1);assert.equal(object((list.items as unknown[])[0]).processingState,'PENDING');
      await drain();const processed=await json(await fixture.request(`/documents/${documentId}/versions`));assert.equal(object((processed.items as unknown[])[0]).processingState,'READY');
      const download=await fixture.request(`/documents/${documentId}/versions/${versionId}/download`,{headers:{range:'bytes=0-6'}});assert.equal(download.status,206);assert.equal(await download.text(),'PRIVATE');assert.equal(download.headers.get('cache-control'),'private, no-store, max-age=0');
      const etag=download.headers.get('etag')!;assert.equal((await fixture.request(`/documents/${documentId}/versions/${versionId}/download`,{headers:{'if-none-match':etag}})).status,304);
    });
    await t.test('membership schedules indexing atomically, Router runs protected tasks and real citations can be independently read',async()=>{
      await json(await fixture.request('/spaces',{method:'POST',...body({id:spaceId,title:'Private runtime space',classification:'LOW'})}),201);
      assert.equal((await fixture.request(`/spaces/${spaceId}/memberships/${documentId}`,{method:'PUT',...body({mode:'CURRENT',pinnedVersionId:null})})).status,204);
      await drain();assert.equal((await json(await fixture.request(`/spaces/${spaceId}`))).state,'READY');fixture.provider.calls.length=0;
      fixture.provider.state.answer={answer:'تحلیل کلی داده‌ها.',citations:['S1']};const answer=await json(await fixture.request(`/spaces/${spaceId}/query`,{method:'POST',...body({question:'Explain the project'})}));assert.equal((answer.citations as unknown[]).length,1);assert.equal(object((answer.citations as unknown[])[0]).versionId,versionId);
      const content=await json(await fixture.request(`/documents/${documentId}/versions/${versionId}/content`));assert.ok(String(content.text).includes('PRIVATE_RUNTIME_SOURCE'));
      assert.deepEqual(fixture.provider.calls.map(call=>call.path),['/v1/embeddings','/score','/v1/chat/completions']);
    });
    await t.test('SSE publishes only a fully validated answer followed by authorized citations and DONE; rejected output emits no delta',async()=>{
      const expected='محتوای پاسخ امن و تأییدشده. '.repeat(40);fixture.provider.state.answer={answer:expected,citations:['S1']};
      const response=await fixture.request(`/spaces/${spaceId}/query`,{method:'POST',...body({question:'Stream a safe answer'}),headers:{'content-type':'application/json',accept:'text/event-stream'}});
      assert.equal(response.status,200);assert.match(response.headers.get('content-type')!,/^text\/event-stream; charset=utf-8/);
      const frames=(await response.text()).trim().split('\n\n').map(frame=>{const lines=frame.split('\n');return{event:lines[0]!.slice(7),data:JSON.parse(lines[1]!.slice(6))};});
      assert.equal(frames.filter(frame=>frame.event==='answer.delta').map(frame=>frame.data.text).join(''),expected);
      assert.equal(frames.at(-2)?.event,'answer.citations');assert.equal(frames.at(-2)?.data.citations[0].versionId,versionId);assert.equal(frames.at(-1)?.event,'answer.done');
      fixture.provider.state.answer={answer:'An invalid citation answer',citations:['UNKNOWN_LABEL']};
      const denied=await fixture.request(`/spaces/${spaceId}/query`,{method:'POST',...body({question:'Reject before streaming'}),headers:{'content-type':'application/json',accept:'text/event-stream'}});
      assert.equal(denied.status,403);assert.ok(!(await denied.text()).includes('answer.delta'));
    });
    await t.test('new version processing automatically schedules reindex without changing Document identity; revocation blocks a warm download',async()=>{
      const updated=await upload('NEW_VERSION_CONTENT: new canonical document source.','second');assert.notEqual(updated.id,versionId);await drain();
      fixture.provider.calls.length=0;fixture.provider.state.answer={answer:'تحلیل کلی داده‌ها.',citations:['S1']};const answer=await json(await fixture.request(`/spaces/${spaceId}/query`,{method:'POST',...body({question:'Explain the updated document'})}));assert.equal(object((answer.citations as unknown[])[0]).versionId,updated.id);assert.ok(JSON.stringify(fixture.provider.calls).includes('NEW_VERSION_CONTENT'));assert.ok(!JSON.stringify(fixture.provider.calls).includes('PRIVATE_RUNTIME_SOURCE'));
      await fixture.identity.setPermissions({Knowledge:{query:true,Documents:{read:true}}});assert.equal((await fixture.request(`/documents/${documentId}/versions/${versionId}/download`)).status,403);
      fixture.provider.calls.length=0;const neutral=await json(await fixture.request(`/spaces/${spaceId}/query`,{method:'POST',...body({question:'Read is not use'})}));assert.equal((neutral.citations as unknown[]).length,0);assert.equal(fixture.provider.calls.length,0);
    });
    await t.test('RAG records actual rejected-generation consumption and denies rewriting Usage facts',async()=>{
      await fixture.identity.setPermissions({Knowledge:{ALL:true}});
      fixture.provider.state.answer={answer:'Invalid citation result',citations:['UNKNOWN_LABEL']};
      assert.equal((await fixture.request(`/spaces/${spaceId}/query`,{method:'POST',...body({question:'Reject invented citation'})})).status,403);
      const usagePool=await createTargetPool(fixture.snapshot,'api',fixture.secretRoot);
      const consumed=await withTargetTransaction(usagePool,fixture.context,tx=>tx.query<{queries:string;embedding:string;rerank:string;generation:string;indexed:string;processed:string}>(`SELECT SUM(urc_queries) AS queries,SUM(urc_embedding_items) AS embedding,
        SUM(urc_rerank_items) AS rerank,SUM(urc_generation_calls) AS generation,SUM(urc_indexed_chunks) AS indexed,SUM(urc_documents_processed) AS processed
        FROM usage.tbl_usg_rag_consumption WHERE urc_tenant_id=$1`,[fixture.context.tenantId]));
      await usagePool.end();
      const row=consumed.rows[0]!;assert.ok(Number(row.queries)>=4);assert.ok(Number(row.embedding)>=5);assert.ok(Number(row.rerank)>=3);assert.ok(Number(row.generation)>=3);assert.ok(Number(row.indexed)>=2);assert.equal(Number(row.processed),2);
      const pool=await createTargetPool(fixture.snapshot,'api',fixture.secretRoot);
      try{await assert.rejects(withTargetTransaction(pool,fixture.context,tx=>tx.query('UPDATE usage.tbl_usg_rag_consumption SET urc_queries=0 WHERE urc_tenant_id=$1',[fixture.context.tenantId])),/permission denied/);}
      finally{await pool.end();}
    });
    await t.test('terminal indexing failure before vector construction is visible and leaves no queryable generation',async()=>{
      const failingSpace=randomUUID();await fixture.identity.setPermissions({Knowledge:{ALL:true}});
      await json(await fixture.request('/spaces',{method:'POST',...body({id:failingSpace,title:'Failure status',classification:'LOW'})}),201);
      assert.equal((await fixture.request(`/spaces/${failingSpace}/memberships/${documentId}`,{method:'PUT',...body({mode:'CURRENT',pinnedVersionId:null})})).status,204);
      await fixture.identity.setPermissions({Knowledge:{Spaces:{discover:true}}});
      for(let attempt=0;attempt<15;attempt++){
        const result=await fixture.worker.jobs!.next();assert.notEqual(result,'LEASE_LOST');
        if((await json(await fixture.request(`/spaces/${failingSpace}`))).state==='FAILED')break;
        assert.notEqual(result,'EMPTY');
      }
      assert.equal((await json(await fixture.request(`/spaces/${failingSpace}`))).state,'FAILED');
      assert.equal((await fixture.request(`/spaces/${failingSpace}/query`,{method:'POST',...body({question:'No published generation'})})).status,403);
    });
  }finally{await fixture.close();}
});
