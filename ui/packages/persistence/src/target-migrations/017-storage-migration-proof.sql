CREATE TABLE file_management.tbl_fil_storage_migration (
  fsm_deployment_id text NOT NULL,fsm_tenant_id text NOT NULL,fsm_id uuid NOT NULL,fsm_intent jsonb NOT NULL,
  fsm_remote_upload_id text,fsm_state text NOT NULL DEFAULT 'NEW',fsm_lease uuid,fsm_lease_until timestamptz,
  fsm_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_fil_storage_migration PRIMARY KEY (fsm_deployment_id,fsm_tenant_id,fsm_id),
  CONSTRAINT ck_fil_storage_migration_state CHECK (fsm_state IN ('NEW','COPYING','COMPLETING','UNKNOWN','VERIFIED'))
);
ALTER TABLE file_management.tbl_fil_storage_migration ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_management.tbl_fil_storage_migration FORCE ROW LEVEL SECURITY;
CREATE POLICY fil_storage_migration_scope ON file_management.tbl_fil_storage_migration TO targoman_api,targoman_worker
USING (fsm_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND fsm_tenant_id=NULLIF(current_setting('app.tenant_id',true),''))
WITH CHECK (fsm_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND fsm_tenant_id=NULLIF(current_setting('app.tenant_id',true),''));
GRANT SELECT,INSERT ON file_management.tbl_fil_storage_migration TO targoman_api,targoman_worker;
GRANT UPDATE (fsm_remote_upload_id,fsm_state,fsm_lease,fsm_lease_until) ON file_management.tbl_fil_storage_migration TO targoman_api,targoman_worker;
CREATE TRIGGER trg_fil_storage_migration_mutation AFTER INSERT OR UPDATE OR DELETE ON file_management.tbl_fil_storage_migration
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('fsm_id','fsm_deployment_id','fsm_tenant_id','fsm_state');
