ALTER TABLE authority.tbl_aut_permission
  ADD COLUMN aup_policy_version integer NOT NULL DEFAULT 1;
ALTER TABLE authority.tbl_aut_permission
  ADD CONSTRAINT ck_aut_permission_policy_version CHECK (aup_policy_version > 0);

CREATE TABLE authority.tbl_aut_org_edge (
  aoe_tenant_id text NOT NULL,
  aoe_child_id text NOT NULL,
  aoe_parent_id text NOT NULL,
  CONSTRAINT pk_aut_org_edge PRIMARY KEY (aoe_tenant_id, aoe_child_id),
  CONSTRAINT ck_aut_org_edge_distinct CHECK (aoe_child_id <> aoe_parent_id)
);
CREATE INDEX idx_aut_org_edge_parent ON authority.tbl_aut_org_edge (aoe_tenant_id, aoe_parent_id);
GRANT SELECT ON authority.tbl_aut_org_edge TO targoman_api;
CREATE TRIGGER trg_aut_org_edge_mutation AFTER INSERT OR UPDATE OR DELETE ON authority.tbl_aut_org_edge
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('aoe_tenant_id', 'aoe_child_id', 'aoe_parent_id');

ALTER TABLE audit.tbl_aud_semantic_event
  ADD COLUMN ase_authority_context jsonb;
ALTER TABLE audit.tbl_aud_semantic_event
  ADD CONSTRAINT ck_aud_authority_context_object CHECK
    (ase_authority_context IS NULL OR jsonb_typeof(ase_authority_context) = 'object');
