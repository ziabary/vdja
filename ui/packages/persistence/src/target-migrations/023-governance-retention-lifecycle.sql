CREATE SCHEMA IF NOT EXISTS data_governance;
GRANT USAGE ON SCHEMA data_governance TO targoman_api,targoman_worker;
CREATE TABLE data_governance.tbl_gov_retention (
 grt_deployment_id text NOT NULL,grt_tenant_id text NOT NULL,grt_resource_id uuid NOT NULL,grt_request_id uuid NOT NULL,
 grt_state text NOT NULL,grt_policy_version text NOT NULL,grt_eligible_after timestamptz NOT NULL,grt_backup_obligation text NOT NULL,
 grt_lease_token uuid,grt_lease_until timestamptz,
 CONSTRAINT pk_gov_retention PRIMARY KEY(grt_deployment_id,grt_tenant_id,grt_resource_id),
 CONSTRAINT ck_gov_retention_state CHECK(grt_state IN ('RETIRED','RETENTION_ELIGIBLE','LEGAL_HOLD','PURGE_REQUESTED','PURGING','PURGED')),
 CONSTRAINT ck_gov_retention_lease CHECK((grt_lease_token IS NULL)=(grt_lease_until IS NULL)),
 CONSTRAINT ck_gov_retention_policy CHECK(length(grt_policy_version) BETWEEN 1 AND 128 AND length(grt_backup_obligation) BETWEEN 1 AND 256)
);
ALTER TABLE data_governance.tbl_gov_retention ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_governance.tbl_gov_retention FORCE ROW LEVEL SECURITY;
CREATE POLICY gov_retention_scope ON data_governance.tbl_gov_retention TO targoman_api,targoman_worker
 USING(grt_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND grt_tenant_id=NULLIF(current_setting('app.tenant_id',true),''))
 WITH CHECK(grt_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND grt_tenant_id=NULLIF(current_setting('app.tenant_id',true),''));
GRANT SELECT,INSERT,UPDATE ON data_governance.tbl_gov_retention TO targoman_worker;
GRANT SELECT ON data_governance.tbl_gov_retention TO targoman_api;
CREATE TRIGGER trg_gov_retention_mutation AFTER INSERT OR UPDATE OR DELETE ON data_governance.tbl_gov_retention FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('grt_deployment_id','grt_tenant_id','grt_resource_id','grt_request_id','grt_state','grt_policy_version');
INSERT INTO authority.tbl_aut_permission(aup_path,aup_module_id,aup_value_kind,aup_all_default) VALUES
 ('Governance.Documents.manage','data-governance','BOOLEAN','true'::jsonb),
 ('Governance.Documents.hold','data-governance','BOOLEAN','true'::jsonb),
 ('Governance.Documents.purge','data-governance','BOOLEAN','true'::jsonb);
