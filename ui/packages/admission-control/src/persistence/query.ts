import type pg from 'pg';
import { reserveAdmission } from '../persistence.js';
import type { intfQueryAdmissionPort } from '../query.js';
import { resolveTargetTransaction } from '../../../persistence/src/target-transaction.js';
import { exAdmission } from '../index.js';
export function createQueryAdmissionPersistence(pool:pg.Pool):intfQueryAdmissionPort{
  return {reserve:(context,policy,inputChars,tokens,output,operationKey)=>reserveAdmission(pool,context,policy,inputChars,0,tokens,output,operationKey),
    async finish(tx,context,id,succeeded,operationKey=context.requestId){
      const state=succeeded?'SETTLED':'RELEASED';
      const result=await resolveTargetTransaction(tx).query(`UPDATE admission.tbl_adm_reservation SET adr_state=$5,adr_updated_at=clock_timestamp()
        WHERE adr_deployment_id=$1 AND adr_tenant_id=$2 AND adr_request_id=$3 AND adr_id=$4 AND adr_state='RESERVED' RETURNING adr_id`,
        [context.deploymentId,context.tenantId,operationKey,id,state]);
      if(!result.rowCount)throw new exAdmission('CONCURRENCY_CONFLICT');
    }};
}
