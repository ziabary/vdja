-- Canonical requested-generation status survives failure before any vector write.
ALTER TABLE knowledge.tbl_knw_space ADD COLUMN ksp_pending_generation_id uuid;
ALTER TABLE knowledge.tbl_knw_space ADD COLUMN ksp_index_state text NOT NULL DEFAULT 'BUILDING';
ALTER TABLE knowledge.tbl_knw_space ADD CONSTRAINT ck_knw_space_index_state CHECK (ksp_index_state IN ('BUILDING','READY','FAILED'));
GRANT UPDATE (ksp_pending_generation_id,ksp_index_state) ON knowledge.tbl_knw_space TO targoman_api,targoman_worker;
DROP TRIGGER trg_knw_space_mutation ON knowledge.tbl_knw_space;
CREATE TRIGGER trg_knw_space_mutation AFTER INSERT OR UPDATE OR DELETE ON knowledge.tbl_knw_space
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('ksp_id','ksp_deployment_id','ksp_tenant_id','ksp_security_version','ksp_lifecycle','ksp_generation_id','ksp_pending_generation_id','ksp_index_state');
