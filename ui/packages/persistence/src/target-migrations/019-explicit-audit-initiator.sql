-- Preserve the original initiator when registered services clean up expired transfer staging.
CREATE OR REPLACE FUNCTION audit.fn_aud_capture_safe() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_column text; v_record_id text; v_actor_kind text; v_correlation text; v_source text; v_index integer;
BEGIN
  v_actor_kind := NULLIF(current_setting('app.actor_kind',true),'');
  v_correlation := NULLIF(current_setting('app.correlation_id',true),'');
  v_source := NULLIF(current_setting('app.source',true),'');
  IF v_actor_kind IS NULL OR v_correlation IS NULL OR v_source IS NULL THEN RAISE EXCEPTION 'missing mutation audit context' USING ERRCODE='P0001'; END IF;
  IF TG_OP<>'INSERT' THEN FOR v_index IN 1..TG_NARGS-1 LOOP v_column:=TG_ARGV[v_index];v_before:=v_before||jsonb_build_object(v_column,to_jsonb(OLD)->v_column);END LOOP;END IF;
  IF TG_OP<>'DELETE' THEN FOR v_index IN 1..TG_NARGS-1 LOOP v_column:=TG_ARGV[v_index];v_after:=v_after||jsonb_build_object(v_column,to_jsonb(NEW)->v_column);END LOOP;END IF;
  v_record_id:=COALESCE(to_jsonb(NEW)->>TG_ARGV[0],to_jsonb(OLD)->>TG_ARGV[0]);
  IF v_record_id IS NULL THEN RAISE EXCEPTION 'missing audited record identity';END IF;
  INSERT INTO audit.tbl_aud_mutation (aud_schema,aud_table,aud_record_id,aud_operation,aud_database_actor,aud_actor_kind,aud_actor_id,
    aud_session_id,aud_correlation_id,aud_source,aud_before,aud_after,aud_deployment_id,aud_tenant_id,aud_module_id,aud_request_id,
    aud_authorization_version,aud_initiator_actor_kind,aud_initiator_actor_id)
  VALUES (TG_TABLE_SCHEMA,TG_TABLE_NAME,v_record_id,TG_OP,session_user,v_actor_kind,NULLIF(current_setting('app.actor_id',true),''),
    NULLIF(current_setting('app.session_id',true),''),v_correlation,v_source,
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE v_before END,CASE WHEN TG_OP='DELETE' THEN NULL ELSE v_after END,
    NULLIF(current_setting('app.deployment_id',true),''),NULLIF(current_setting('app.tenant_id',true),''),
    NULLIF(current_setting('app.module_id',true),''),NULLIF(current_setting('app.request_id',true),''),
    NULLIF(current_setting('app.authorization_version',true),'')::bigint,COALESCE(NULLIF(current_setting('app.initiator_actor_kind',true),''),v_actor_kind),COALESCE(NULLIF(current_setting('app.initiator_actor_id',true),''),NULLIF(current_setting('app.actor_id',true),'')));
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$body$;
