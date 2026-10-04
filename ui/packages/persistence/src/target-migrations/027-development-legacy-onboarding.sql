CREATE FUNCTION authority.fn_aut_assign_dev_onboarding_role(
  i_identity_id uuid, i_tenant_id text, i_role_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF current_setting('app.deployment_id',true) <> 'development'
     OR current_setting('app.source',true) <> 'authentication.legacy_key'
     OR current_setting('app.actor_kind',true) <> 'ANONYMOUS'
     OR i_tenant_id <> 'development'
     OR current_setting('app.tenant_id',true) <> i_tenant_id THEN
    RAISE EXCEPTION 'DEVELOPMENT_ONBOARDING_DENIED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM authority.tbl_aut_role
    WHERE aur_id=i_role_id AND aur_tenant_id=i_tenant_id AND aur_name='development-rag-onboarding') THEN
    RAISE EXCEPTION 'DEVELOPMENT_ONBOARDING_ROLE_REQUIRED';
  END IF;
  INSERT INTO authority.tbl_aut_grant(aug_id,aug_tenant_id,aug_identity__idn_id,aug_role__aur_id)
    VALUES(gen_random_uuid(),i_tenant_id,i_identity_id,i_role_id);
END $$;
REVOKE ALL ON FUNCTION authority.fn_aut_assign_dev_onboarding_role(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authority.fn_aut_assign_dev_onboarding_role(uuid,text,uuid) TO targoman_api;
