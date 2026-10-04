-- Explicit service grant required; ALL never invents a cleanup grant.
INSERT INTO authority.tbl_aut_permission (aup_path,aup_module_id,aup_value_kind,aup_all_default)
VALUES ('Files.Transfers.expire','file-management','BOOLEAN','false'::jsonb)
ON CONFLICT (aup_path) DO NOTHING;
