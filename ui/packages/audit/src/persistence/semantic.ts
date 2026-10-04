import type pg from 'pg';
import type { intfSiemConfiguration } from '../../../configuration/src/index.js';
import { resolveTargetTransaction } from '../../../persistence/src/target-transaction.js';
import { scheduleSiemExport } from '../../../security-telemetry/src/persistence.js';
import type { intfExecutionContext } from '../../../contracts/src/index.js';
import type { intfSemanticAuditEvent,intfSemanticAuditPort } from '../semantic.js';
import { recordAuditBatch } from '../persistence.js';
export async function recordSemanticAudit(client:pg.PoolClient,context:intfExecutionContext,event:intfSemanticAuditEvent):Promise<string>{
  return (await recordAuditBatch(client,context,[event]))[0]!;
}
export function createSemanticAuditPersistence(siem:intfSiemConfiguration):intfSemanticAuditPort{
  return{async record(transaction,context,event){const client=resolveTargetTransaction(transaction),id=await recordSemanticAudit(client,context,event);
    await scheduleSiemExport(client,id,event.action,siem);return id;}};
}
