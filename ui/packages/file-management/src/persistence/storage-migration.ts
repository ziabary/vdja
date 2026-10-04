import {randomUUID} from 'node:crypto';
import {resolveTargetTransaction} from '../../../persistence/src/target-transaction.js';
import {exStorageMigration,type intfStorageMigrationJournal,type typStorageMigrationState} from '../storage-migration.js';
export function createStorageMigrationJournal():intfStorageMigrationJournal{return{
  async claim(tx,context,intent){
    if(!context.deploymentId||!context.tenantId)throw new exStorageMigration('STORAGE_MIGRATION_DENIED');
    const client=resolveTargetTransaction(tx),scope=[context.deploymentId,context.tenantId,intent.id];
    await client.query(`INSERT INTO file_management.tbl_fil_storage_migration
      (fsm_deployment_id,fsm_tenant_id,fsm_id,fsm_intent) VALUES ($1,$2,$3,$4::jsonb)
      ON CONFLICT (fsm_deployment_id,fsm_tenant_id,fsm_id) DO NOTHING`,[...scope,JSON.stringify(intent)]);
    const result=await client.query<{same:boolean;fsm_remote_upload_id:string|null;fsm_state:typStorageMigrationState;busy:boolean}>(`SELECT fsm_intent=$4::jsonb AS same,fsm_remote_upload_id,fsm_state,
      (fsm_lease_until>clock_timestamp()) AS busy FROM file_management.tbl_fil_storage_migration
      WHERE fsm_deployment_id=$1 AND fsm_tenant_id=$2 AND fsm_id=$3 FOR UPDATE`,[...scope,JSON.stringify(intent)]);
    const known=result.rows[0];if(!known?.same)throw new exStorageMigration('STORAGE_MIGRATION_CONFLICT');
    if(!known)throw new exStorageMigration('STORAGE_MIGRATION_CONFLICT');if(known.busy)throw new exStorageMigration('STORAGE_MIGRATION_BUSY');
    const lease=randomUUID();await client.query(`UPDATE file_management.tbl_fil_storage_migration SET fsm_lease=$4,fsm_lease_until=clock_timestamp()+interval '120 seconds'
      WHERE fsm_deployment_id=$1 AND fsm_tenant_id=$2 AND fsm_id=$3`,[...scope,lease]);
    return{lease,remoteUploadId:known.fsm_remote_upload_id,state:known.fsm_state};
  },
  async save(tx,context,id,lease,remote,state,release){
    const result=await resolveTargetTransaction(tx).query(`UPDATE file_management.tbl_fil_storage_migration SET fsm_remote_upload_id=$5,fsm_state=$6,
      fsm_lease_until=CASE WHEN $7::boolean THEN NULL ELSE clock_timestamp()+interval '120 seconds' END
      WHERE fsm_deployment_id=$1 AND fsm_tenant_id=$2 AND fsm_id=$3 AND fsm_lease=$4 AND fsm_lease_until>clock_timestamp()`,
      [context.deploymentId,context.tenantId,id,lease,remote,state,release]);
    if(result.rowCount!==1)throw new exStorageMigration('STORAGE_MIGRATION_LEASE_LOST');
  }
};}
