-- Canonical Authority synchronization only; it never grants permission.
-- Tenant mutations serialize with short authorized snapshots. Global identity/
-- vocabulary mutations use the global fence. No fence spans external providers.
CREATE FUNCTION authority.fn_aut_security_fence() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
DECLARE v_old jsonb; v_new jsonb; v_tenant text; v_previous text;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;
  IF TG_ARGV[0] = 'GLOBAL' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('authority.global', 0));
  ELSE
    PERFORM pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('authority.global', 0));
    v_tenant := COALESCE(v_new->>TG_ARGV[0], v_old->>TG_ARGV[0]);
    v_previous := v_old->>TG_ARGV[0];
    -- Changing tenant ownership is fenced in a stable order for both tenants.
    IF v_previous IS NOT NULL AND v_previous <> v_tenant THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('authority.tenant.' || LEAST(v_tenant,v_previous), 0));
      PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('authority.tenant.' || GREATEST(v_tenant,v_previous), 0));
    ELSE
      PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('authority.tenant.' || v_tenant, 0));
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_aut_permission_fence BEFORE INSERT OR UPDATE OR DELETE ON authority.tbl_aut_permission FOR EACH ROW EXECUTE FUNCTION authority.fn_aut_security_fence('GLOBAL');
CREATE TRIGGER trg_aut_role_fence BEFORE INSERT OR UPDATE OR DELETE ON authority.tbl_aut_role FOR EACH ROW EXECUTE FUNCTION authority.fn_aut_security_fence('aur_tenant_id');
CREATE TRIGGER trg_aut_grant_fence BEFORE INSERT OR UPDATE OR DELETE ON authority.tbl_aut_grant FOR EACH ROW EXECUTE FUNCTION authority.fn_aut_security_fence('aug_tenant_id');
CREATE TRIGGER trg_aut_acl_fence BEFORE INSERT OR UPDATE OR DELETE ON authority.tbl_aut_resource_acl FOR EACH ROW EXECUTE FUNCTION authority.fn_aut_security_fence('ara_tenant_id');
CREATE TRIGGER trg_aut_clearance_fence BEFORE INSERT OR UPDATE OR DELETE ON authority.tbl_aut_clearance FOR EACH ROW EXECUTE FUNCTION authority.fn_aut_security_fence('auc_tenant_id');
CREATE TRIGGER trg_aut_org_fence BEFORE INSERT OR UPDATE OR DELETE ON authority.tbl_aut_org_edge FOR EACH ROW EXECUTE FUNCTION authority.fn_aut_security_fence('aoe_tenant_id');
CREATE TRIGGER trg_idn_identity_fence BEFORE UPDATE OR DELETE ON identity.tbl_idn_identity FOR EACH ROW EXECUTE FUNCTION authority.fn_aut_security_fence('GLOBAL');
CREATE TRIGGER trg_idn_membership_fence BEFORE INSERT OR UPDATE OR DELETE ON identity.tbl_idn_membership FOR EACH ROW EXECUTE FUNCTION authority.fn_aut_security_fence('idm_tenant_id');
CREATE TRIGGER trg_ses_security_fence BEFORE INSERT OR UPDATE OR DELETE ON session_core.tbl_ses_session FOR EACH ROW EXECUTE FUNCTION authority.fn_aut_security_fence('ses_tenant_id');
