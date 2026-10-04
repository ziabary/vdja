-- Explicit opt-in elevation; hard deployment/tenant limits remain authoritative.
INSERT INTO authority.tbl_aut_permission (aup_path,aup_module_id,aup_value_kind,aup_all_default)
VALUES ('Knowledge.Files.elevatedLimits','knowledge','BOOLEAN','false'::jsonb)
ON CONFLICT (aup_path) DO NOTHING;
-- Historical reservations have unknown owners and count conservatively for each actor.
ALTER TABLE admission.tbl_adm_file_reservation ADD COLUMN afr_actor_id uuid;
CREATE INDEX idx_adm_file_reservation_actor ON admission.tbl_adm_file_reservation
  (afr_deployment_id,afr_tenant_id,afr_actor_id,afr_state);
