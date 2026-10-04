import type pg from 'pg';
import type { intfExecutionContext } from '../../../contracts/src/index.js';
import type { intfSiemConfiguration } from '../../../configuration/src/index.js';
import { withTargetTransaction } from '../../../persistence/src/target.js';
import { scheduleSiemExport,scheduleSiemExports } from '../../../security-telemetry/src/persistence.js';
import type { intfAuthorityAuditMetadata,typAuditResult,typSecurityAuditAction } from '../index.js';
import { recordAudit,recordAuditBatch } from '../persistence.js';
export function createSecurityAuditPersistence(pool:pg.Pool,siem:intfSiemConfiguration){
  const persistence={
    async recordAuthorityDecisions(context:intfExecutionContext,evidence:readonly intfAuthorityAuditMetadata[]):Promise<void>{
      if(!evidence.length)return;
      await withTargetTransaction(pool,{...context,source:'authority-decision'},async tx=>{
        const ids=await recordAuditBatch(tx,context,evidence.map(authority=>({action:'authority.decision',result:authority.decision==='ALLOW'?'SUCCEEDED':'DENIED',reason:authority.reason,authority})));
        await scheduleSiemExports(tx,ids,'authority.decision',siem);
      });
    },
    async recordAuthorityDecision(context:intfExecutionContext,evidence:intfAuthorityAuditMetadata):Promise<void>{
      return persistence.recordAuthorityDecisions(context,[evidence]);
    },
    async record(context:intfExecutionContext,action:typSecurityAuditAction,result:typAuditResult,reason?:string):Promise<void>{
      await withTargetTransaction(pool,{...context,source:'security-audit'},async tx=>{
        const id=await recordAudit(tx,context,action,result,reason);await scheduleSiemExport(tx,id,action,siem);
      });
    }
  };return persistence;
}
