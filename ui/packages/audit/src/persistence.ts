import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { typPublicAuditAction,typSecurityAuditAction,typAuditResult,intfAuthorityAuditMetadata } from './index.js';
export interface intfAuditPersistenceEvent {
  readonly action:string;readonly result:typAuditResult;readonly reason?:string;
  readonly authority?:intfAuthorityAuditMetadata;readonly resource?:Readonly<{type:string;id:string}>;
}
function reference(value:string|null):string|null{
  if(value!==null&&!/^[A-Za-z0-9._:-]{1,128}$/u.test(value))throw new Error('INVALID_AUDIT_EVIDENCE');return value;
}
function event(value:intfAuditPersistenceEvent):Record<string,unknown>{
  if(!/^[a-z][a-z0-9._-]{1,127}$/u.test(value.action)||!['REQUESTED','SUCCEEDED','FAILED','CANCELLED','DENIED'].includes(value.result)
    ||(value.reason!==undefined&&!/^[A-Z0-9_]{1,64}$/u.test(value.reason)))throw new Error('INVALID_AUDIT_EVIDENCE');
  let authority:Record<string,unknown>|null=null;
  if(value.authority){const metadata=value.authority;
    if(!/^[A-Za-z][A-Za-z0-9_.]{0,127}$/u.test(metadata.path)||!['ALLOW','DENY'].includes(metadata.decision)||!/^[A-Z][A-Z0-9_]{0,63}$/u.test(metadata.reason)
      ||(metadata.policyVersion!==null&&(!Number.isSafeInteger(metadata.policyVersion)||metadata.policyVersion<1))
      ||(metadata.authorizationVersion!==null&&(!Number.isSafeInteger(metadata.authorizationVersion)||metadata.authorizationVersion<1)))throw new Error('INVALID_AUTHORITY_AUDIT_METADATA');
    authority={path:metadata.path,decision:metadata.decision,reason:metadata.reason,resourceType:reference(metadata.resourceType),resourceId:reference(metadata.resourceId),
      policyVersion:metadata.policyVersion,authorizationVersion:metadata.authorizationVersion};
  }
  if(value.resource&&!/^[a-z][a-z0-9._-]{1,63}$/u.test(value.resource.type))throw new Error('INVALID_AUDIT_EVIDENCE');
  return{id:randomUUID(),action:value.action,result:value.result,reason:value.reason??null,authority,
    resource_type:value.resource?.type??null,resource_id:reference(value.resource?.id??null)};
}
/** One serialization owner for single and batched semantic/security evidence. */
export async function recordAuditBatch(tx:pg.PoolClient,context:intfExecutionContext,values:readonly intfAuditPersistenceEvent[]):Promise<readonly string[]>{
  if(values.length<1||values.length>1000)throw new Error('INVALID_AUDIT_BATCH');const rows=values.map(event);
  await tx.query(`INSERT INTO audit.tbl_aud_semantic_event
    (ase_id,ase_deployment_id,ase_tenant_id,ase_module_id,ase_actor_kind,ase_actor_id,ase_session_id,ase_request_id,ase_correlation_id,
     ase_action,ase_result,ase_reason,ase_config_fingerprint,ase_authority_context,ase_resource_type,ase_resource_id,
     ase_source,ase_initiator_actor_kind,ase_initiator_actor_id)
    SELECT batch.id,$1,$2,$3,$4,$5,$6,$7,$8,batch.action,batch.result,batch.reason,$9,batch.authority,batch.resource_type,batch.resource_id,$10,$12,$13
    FROM pg_catalog.jsonb_to_recordset($11::jsonb) AS batch(id uuid,action text,result text,reason text,authority jsonb,resource_type text,resource_id text)`,
    [context.deploymentId,context.tenantId,context.moduleId,context.actorKind,context.actorId,context.sessionId,context.requestId,
      context.correlationId,context.configFingerprint,context.source,JSON.stringify(rows),context.initiator?.actorKind??context.actorKind,
      reference(context.initiator?.actorId??context.actorId)]);
  return rows.map(row=>String(row.id));
}
export async function recordAudit(tx:pg.PoolClient,context:intfExecutionContext,action:typPublicAuditAction|typSecurityAuditAction,
  result:typAuditResult,reason?:string,authority?:intfAuthorityAuditMetadata):Promise<string>{
  return (await recordAuditBatch(tx,context,[{action,result,...(reason?{reason}:{}),...(authority?{authority}:{})}]))[0]!;
}
