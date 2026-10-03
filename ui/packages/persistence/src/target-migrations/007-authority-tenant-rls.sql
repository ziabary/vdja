ALTER TABLE authority.tbl_aut_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE authority.tbl_aut_grant ENABLE ROW LEVEL SECURITY;
ALTER TABLE authority.tbl_aut_resource_acl ENABLE ROW LEVEL SECURITY;
ALTER TABLE authority.tbl_aut_clearance ENABLE ROW LEVEL SECURITY;

CREATE POLICY aut_role_tenant_select ON authority.tbl_aut_role FOR SELECT TO targoman_api
  USING (aur_tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
CREATE POLICY aut_grant_tenant_select ON authority.tbl_aut_grant FOR SELECT TO targoman_api
  USING (aug_tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
CREATE POLICY aut_acl_tenant_select ON authority.tbl_aut_resource_acl FOR SELECT TO targoman_api
  USING (ara_tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
CREATE POLICY aut_clearance_tenant_select ON authority.tbl_aut_clearance FOR SELECT TO targoman_api
  USING (auc_tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
