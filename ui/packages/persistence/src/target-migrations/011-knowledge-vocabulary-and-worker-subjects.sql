INSERT INTO authority.tbl_aut_permission (aup_path,aup_module_id,aup_value_kind,aup_all_default)
VALUES
  ('Knowledge.Documents.discover','knowledge','BOOLEAN','true'::jsonb),
  ('Knowledge.Documents.read','knowledge','BOOLEAN','true'::jsonb),
  ('Knowledge.Documents.download','knowledge','BOOLEAN','true'::jsonb),
  ('Knowledge.Documents.use','knowledge','BOOLEAN','true'::jsonb),
  ('Knowledge.Documents.quote','knowledge','BOOLEAN','true'::jsonb),
  ('Knowledge.Documents.manage','knowledge','BOOLEAN','true'::jsonb),
  ('Knowledge.Spaces.discover','knowledge','BOOLEAN','true'::jsonb),
  ('Knowledge.Spaces.manage','knowledge','BOOLEAN','true'::jsonb),
  ('Knowledge.query','knowledge','BOOLEAN','true'::jsonb)
ON CONFLICT (aup_path) DO NOTHING;

-- A Worker resolves/audits the original HUMAN subject; it has no grant mutation privileges.
GRANT USAGE ON SCHEMA identity, authority, session_core TO targoman_worker;
GRANT SELECT (idn_id,idn_kind,idn_state) ON identity.tbl_idn_identity TO targoman_worker;
GRANT SELECT (idm_id,idm_identity__idn_id,idm_tenant_id,idm_state,idm_authorization_version)
  ON identity.tbl_idn_membership TO targoman_worker;
GRANT SELECT (ses_id,ses_identity__idn_id,ses_membership__idm_id,ses_tenant_id,ses_authorization_version,
  ses_revoked_at,ses_expires_at,ses_last_activity_at) ON session_core.tbl_ses_session TO targoman_worker;
GRANT SELECT ON authority.tbl_aut_permission, authority.tbl_aut_role, authority.tbl_aut_grant,
  authority.tbl_aut_resource_acl, authority.tbl_aut_clearance, authority.tbl_aut_org_edge TO targoman_worker;
CREATE POLICY aut_role_worker_scope ON authority.tbl_aut_role FOR SELECT TO targoman_worker
  USING (aur_tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
CREATE POLICY aut_grant_worker_scope ON authority.tbl_aut_grant FOR SELECT TO targoman_worker
  USING (aug_tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
CREATE POLICY aut_acl_worker_scope ON authority.tbl_aut_resource_acl FOR SELECT TO targoman_worker
  USING (ara_tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
CREATE POLICY aut_clearance_worker_scope ON authority.tbl_aut_clearance FOR SELECT TO targoman_worker
  USING (auc_tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
