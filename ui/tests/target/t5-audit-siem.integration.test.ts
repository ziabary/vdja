import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:https';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {startT5RuntimeFixture} from './support/t5-runtime-fixture.js';
import {createTargetPool,withTargetTransaction} from '../../packages/persistence/src/target.js';
import {createSiemExportPersistence} from '../../packages/security-telemetry/src/persistence.js';
import {deliverNext,type intfExportEnvelope} from '../../packages/security-telemetry/src/worker.js';
import {createSemanticAuditPersistence} from '../../packages/audit/src/persistence/semantic.js';
import {createTransactionPort} from '../../packages/persistence/src/target-transaction.js';

const tlsRoot=process.env.T5_TEST_TLS_DIR;
if(process.env.T5_REQUIRE_LIVE==='1'&&!tlsRoot)throw new Error('RUN_T5_AUDIT_SIEM_WORKFLOW_FOR_VERIFIED_TLS');
test('real T5 Audit and TLS SIEM delivery preserve correlation, immutability, redaction and restart semantics',{skip:!tlsRoot,timeout:120000},async t=>{
  const received:intfExportEnvelope[]=[],ids:string[]=[];let mode:'ACK'|'LOST_ACK'|'OUTAGE'='ACK';
  const server=createServer({key:await readFile(join(tlsRoot!,'key.pem')),cert:await readFile(join(tlsRoot!,'cert.pem'))},async(req,res)=>{
    if(req.method==='HEAD'){res.writeHead(mode==='OUTAGE'?503:200).end();return;}
    const chunks:Buffer[]=[];let bytes=0;for await(const raw of req){const chunk=Buffer.from(raw);bytes+=chunk.length;if(bytes>65536){req.destroy();return;}chunks.push(chunk);}
    const value:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert.ok(value&&typeof value==='object');
    const event=value as intfExportEnvelope;assert.equal(req.headers['idempotency-key'],event.eventId);ids.push(event.eventId);received.push(event);
    if(mode==='LOST_ACK'){res.destroy();return;}if(mode==='OUTAGE'){res.writeHead(503).end();return;}
    res.writeHead(200,{'x-event-ack':event.eventId}).end();
  });await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
  const selected=['authority.decision','file.upload.completed','file.asset.committed','file.processing.completed','file.download.denied','knowledge.query.completed','knowledge.output.rejected','knowledge.index.ready'];
  const siem={enabled:true,destinationId:`t5-siem-${randomUUID().slice(0,8)}`,url:`https://127.0.0.1:${address.port}/events`,timeoutMs:1000,maxAttempts:2,events:selected,deliveryGuarantee:'IDEMPOTENT' as const};
  const fixture=await startT5RuntimeFixture('LOCAL',undefined,siem);const pool=await createTargetPool(fixture.snapshot,'api',fixture.secretRoot),worker=await createTargetPool(fixture.snapshot,'worker',fixture.secretRoot);
  const documentId=randomUUID(),spaceId=randomUUID(),sentinel='T5_PROTECTED_BODY_NEVER_IN_AUDIT_OR_SIEM',question='T5_PROTECTED_QUESTION_NEVER_IN_TELEMETRY';
  const json=(value:unknown)=>({headers:{'content-type':'application/json'},body:JSON.stringify(value)});
  const storage=()=>createSiemExportPersistence(worker,{...fixture.context,actorKind:'PLATFORM_SERVICE',actorId:fixture.snapshot.value.worker.identityId!,sessionId:null,source:'T5_SIEM_WORKER'});
  const drain=async()=>{for(let count=0;count<1000;count+=1){const result=await deliverNext(storage(),siem);if(result==='EMPTY')return;assert.equal(result,'DELIVERED');}throw new Error('UNBOUNDED_SIEM_BACKLOG');};
  const due=async()=>withTargetTransaction(fixture.migration,fixture.context,tx=>tx.query("UPDATE telemetry.tbl_tel_export SET tex_next_attempt_at=clock_timestamp()-interval '1 second' WHERE tex_destination_id=$1 AND tex_status IN ('RETRY','UNKNOWN')",[siem.destinationId]));
  try{
    await t.test('actual upload/processing/index/query evidence reaches a TLS receiver with matching original Session/request',async()=>{
      assert.equal((await fixture.request('/documents',{method:'POST',...json({id:documentId,title:'Confidential source',classification:'LOW'})})).status,201);
      const bytes=Buffer.from(sentinel),sha256=createHash('sha256').update(bytes).digest('hex');
      const transfer=await(await fixture.request('/transfers',{method:'POST',...json({documentId,idempotencyKey:'tls-siem-upload',filename:'secret-source.txt',mediaType:'text/plain',bytes:bytes.length,sha256})})).json() as {id:string};
      assert.equal((await fixture.request(`/transfers/${transfer.id}/parts/1`,{method:'PUT',headers:{'content-type':'application/octet-stream','x-content-sha256':sha256},body:bytes})).status,200);
      assert.equal((await fixture.request(`/transfers/${transfer.id}/complete`,{method:'POST'})).status,200);
      for(let count=0;count<8;count+=1)if(await fixture.worker.jobs!.next()==='EMPTY')break;
      assert.equal((await fixture.request('/spaces',{method:'POST',...json({id:spaceId,title:'Protected space',classification:'LOW'})})).status,201);
      assert.equal((await fixture.request(`/spaces/${spaceId}/memberships/${documentId}`,{method:'PUT',...json({mode:'CURRENT',pinnedVersionId:null})})).status,204);
      for(let count=0;count<8;count+=1)if(await fixture.worker.jobs!.next()==='EMPTY')break;
      fixture.provider.state.answer={answer:'Safe abstract conclusion.',citations:['S1']};
      const response=await fixture.request(`/spaces/${spaceId}/query`,{method:'POST',...json({question})});assert.equal(response.status,200);
      const correlation=response.headers.get('x-correlation-id')!,request=response.headers.get('x-request-id')!;await drain();
      for(const action of ['file.upload.completed','file.asset.committed','file.processing.completed','knowledge.index.ready','knowledge.query.completed'])assert.ok(received.some(event=>event.action===action),action);
      const query=received.filter(event=>event.correlationId===correlation);assert.ok(query.some(event=>event.action==='knowledge.query.completed'));
      assert.ok(query.every(event=>event.requestId===request&&event.actorId===fixture.context.actorId&&event.tenantId===fixture.context.tenantId&&event.sessionId===fixture.context.sessionId));
      assert.ok(query.some(event=>event.action==='authority.decision'&&event.authorityContext));
      const mutation=await fixture.migration.query('SELECT aud_tenant_id,aud_session_id,aud_request_id,aud_module_id FROM audit.tbl_aud_mutation WHERE aud_correlation_id=$1',[correlation]);assert.ok(mutation.rows.length>0);assert.ok(mutation.rows.every(row=>row.aud_request_id===request&&row.aud_tenant_id===fixture.context.tenantId));
      const runs=await fixture.migration.query('SELECT air_request_id,air_session_id,air_correlation_id FROM ai_router.tbl_air_run WHERE air_correlation_id=$1',[correlation]);assert.equal(runs.rows.length,3);assert.ok(runs.rows.every(row=>row.air_request_id===request&&row.air_session_id===fixture.context.sessionId));
    });
    await t.test('ordinary API and Worker cannot rewrite Audit or disable mutation evidence; rollback leaves no event/outbox',async()=>{
      for(const runtime of[pool,worker])for(const sql of["UPDATE audit.tbl_aud_semantic_event SET ase_reason='REWRITTEN' WHERE ase_tenant_id=$1",'DELETE FROM audit.tbl_aud_semantic_event WHERE ase_tenant_id=$1','ALTER TABLE documents.tbl_doc_document DISABLE TRIGGER trg_doc_document_mutation']){
        await assert.rejects(withTargetTransaction(runtime,fixture.context,tx=>tx.query(sql,sql.includes('$1')?[fixture.context.tenantId]:[])),/permission denied|must be owner/);
      }
      const ctx={...fixture.context,correlationId:randomUUID(),requestId:randomUUID()},audit=createSemanticAuditPersistence(siem);
      await assert.rejects(createTransactionPort(pool).run(ctx,async tx=>{await audit.record(tx,ctx,{action:'knowledge.query.completed',result:'FAILED'});throw new Error('ROLLBACK_PROOF');}),/ROLLBACK_PROOF/);
      assert.equal((await fixture.migration.query('SELECT ase_id FROM audit.tbl_aud_semantic_event WHERE ase_correlation_id=$1',[ctx.correlationId])).rowCount,0);
    });
    await t.test('lost acknowledgement retries only with stable receiver idempotency; maxAttempts is bounded',async()=>{
      const audit=createSemanticAuditPersistence(siem),ctx={...fixture.context,requestId:randomUUID(),correlationId:randomUUID()};
      await createTransactionPort(pool).run(ctx,tx=>audit.record(tx,ctx,{action:'knowledge.query.completed',result:'FAILED'}));mode='LOST_ACK';
      assert.equal(await deliverNext(storage(),siem),'RETRY');const first=ids.at(-1)!;await due();mode='ACK';assert.equal(await deliverNext(storage(),siem),'DELIVERED');assert.equal(ids.at(-1),first);
      await createTransactionPort(pool).run({...ctx,requestId:randomUUID()},tx=>audit.record(tx,ctx,{action:'knowledge.query.completed',result:'FAILED'}));mode='OUTAGE';
      assert.equal(await deliverNext(storage(),siem),'RETRY');await due();assert.equal(await deliverNext(storage(),siem),'FAILED');await due();assert.equal(await deliverNext(storage(),siem),'EMPTY');mode='ACK';
    });
    await t.test('restart recovers an expired claim and stale Worker cannot settle its replacement',async()=>{
      await createTransactionPort(pool).run(fixture.context,tx=>createSemanticAuditPersistence(siem).record(tx,fixture.context,{action:'knowledge.query.completed',result:'SUCCEEDED'}));
      const abandoned=await storage().claim(siem.destinationId,true,2);assert.ok(abandoned);
      await withTargetTransaction(fixture.migration,fixture.context,tx=>tx.query("UPDATE telemetry.tbl_tel_export SET tex_claimed_until=clock_timestamp()-interval '1 second' WHERE tex_id=$1",[abandoned.tex_id]));
      assert.equal(await deliverNext(storage(),siem),'DELIVERED');
      await assert.rejects(storage().finish(abandoned,{kind:'DELIVERED',ack:'stale'},'DELIVERED',0),/SIEM_CLAIM_LEASE_LOST/);
    });
    await t.test('optional SIEM outage leaves real RAG successful and NONE guarantees never blindly repeat UNKNOWN',async()=>{
      mode='OUTAGE';fixture.provider.state.answer={answer:'Safe abstract conclusion.',citations:[]};
      assert.equal((await fixture.request(`/spaces/${spaceId}/query`,{method:'POST',...json({question})})).status,200);mode='LOST_ACK';
      assert.equal(await deliverNext(storage(),{...siem,deliveryGuarantee:'NONE'}),'UNKNOWN');const unknownId=ids.at(-1)!;await due();mode='ACK';
      for(let count=0;count<1000;count+=1){const result=await deliverNext(storage(),{...siem,deliveryGuarantee:'NONE'});if(result==='EMPTY')break;assert.equal(result,'DELIVERED');}
      assert.equal(ids.filter(id=>id===unknownId).length,1);
      assert.equal((await fixture.migration.query("SELECT tex_id FROM telemetry.tbl_tel_export WHERE tex_destination_id=$1 AND tex_event__ase_id=$2 AND tex_status='UNKNOWN'",[siem.destinationId,unknownId])).rowCount,1);
      await drain();
      const pending=await fixture.migration.query("SELECT tex_id FROM telemetry.tbl_tel_export WHERE tex_destination_id=$1 AND tex_status='UNKNOWN'",[siem.destinationId]);
      // The prior UNKNOWN can be retried only when the operator explicitly enables idempotent receiver semantics.
      assert.equal(pending.rows.length,0);
    });
    await t.test('sensitive contents, prompts, answers and locators are absent from exported/canonical evidence',async()=>{
      const semantic=await fixture.migration.query('SELECT ase_action,ase_reason,ase_authority_context,ase_source,ase_resource_type,ase_resource_id FROM audit.tbl_aud_semantic_event WHERE ase_tenant_id=$1',[fixture.context.tenantId]);
      const mutation=await fixture.migration.query('SELECT aud_before,aud_after FROM audit.tbl_aud_mutation WHERE aud_tenant_id=$1',[fixture.context.tenantId]);
      const runs=await fixture.migration.query('SELECT air_task,air_model_id,air_error_class FROM ai_router.tbl_air_run WHERE air_tenant_id=$1',[fixture.context.tenantId]);
      const evidence=JSON.stringify([received,semantic.rows,mutation.rows,runs.rows]);assert.ok(!evidence.includes(sentinel));assert.ok(!evidence.includes(question));assert.ok(!evidence.includes('Safe abstract conclusion.'));assert.ok(!evidence.includes('secret-source.txt'));assert.doesNotMatch(evidence,/ast_storage_key|ftr_remote_upload_id|password|refreshToken|accessToken/);
      assert.ok(received.every(event=>selected.includes(event.action)));assert.ok(received.every(event=>Object.keys(event).every(key=>['eventId','deploymentId','tenantId','moduleId','actorKind','actorId','sessionId','requestId','correlationId','action','result','reason','occurredAt','authorityContext','source','resource','initiator'].includes(key))));
    });
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();await worker.end();await fixture.close();}
});
