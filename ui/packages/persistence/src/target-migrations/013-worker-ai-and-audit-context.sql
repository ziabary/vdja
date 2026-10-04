GRANT USAGE ON SCHEMA ai_router TO targoman_worker;
GRANT SELECT,INSERT ON ai_router.tbl_air_run,ai_router.tbl_air_attempt TO targoman_worker;
GRANT UPDATE (air_endpoint_id,air_capacity_expires_at,air_model_id,air_status,air_input_tokens,air_output_tokens,air_error_class,air_finished_at)
  ON ai_router.tbl_air_run TO targoman_worker;
GRANT UPDATE (aia_status,aia_error_class,aia_finished_at) ON ai_router.tbl_air_attempt TO targoman_worker;
GRANT SELECT,INSERT ON usage.tbl_usg_consumption TO targoman_worker;
GRANT SELECT,INSERT ON admission.tbl_adm_reservation TO targoman_worker;
GRANT UPDATE (adr_state,adr_updated_at,adr_input_chars) ON admission.tbl_adm_reservation TO targoman_worker;
GRANT INSERT ON telemetry.tbl_tel_export TO targoman_worker;
CREATE FUNCTION knowledge.fn_knw_guard_chunk() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $body$
BEGIN RAISE EXCEPTION 'KNOWLEDGE_CHUNK_IMMUTABLE'; END;
$body$;
CREATE TRIGGER trg_knw_chunk_immutable BEFORE UPDATE ON knowledge.tbl_knw_chunk FOR EACH ROW EXECUTE FUNCTION knowledge.fn_knw_guard_chunk();
CREATE FUNCTION knowledge.fn_knw_guard_projection() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $body$
BEGIN RAISE EXCEPTION 'KNOWLEDGE_PROJECTION_IMMUTABLE'; END;
$body$;
CREATE TRIGGER trg_knw_projection_immutable BEFORE UPDATE ON knowledge.tbl_knw_projection FOR EACH ROW EXECUTE FUNCTION knowledge.fn_knw_guard_projection();
CREATE INDEX idx_knw_membership_document ON knowledge.tbl_knw_membership (kmb_deployment_id,kmb_tenant_id,kmb_document_id,kmb_space__ksp_id);
ALTER TABLE audit.tbl_aud_semantic_event ADD COLUMN ase_source text;
ALTER TABLE audit.tbl_aud_semantic_event ADD COLUMN ase_initiator_actor_kind text;
ALTER TABLE audit.tbl_aud_semantic_event ADD COLUMN ase_initiator_actor_id text;
ALTER TABLE audit.tbl_aud_mutation ADD COLUMN aud_deployment_id text;
ALTER TABLE audit.tbl_aud_mutation ADD COLUMN aud_tenant_id text;
ALTER TABLE audit.tbl_aud_mutation ADD COLUMN aud_module_id text;
ALTER TABLE audit.tbl_aud_mutation ADD COLUMN aud_request_id text;
ALTER TABLE audit.tbl_aud_mutation ADD COLUMN aud_authorization_version bigint;
ALTER TABLE audit.tbl_aud_mutation ADD COLUMN aud_initiator_actor_kind text;
ALTER TABLE audit.tbl_aud_mutation ADD COLUMN aud_initiator_actor_id text;
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
    NULLIF(current_setting('app.authorization_version',true),'')::bigint,v_actor_kind,NULLIF(current_setting('app.actor_id',true),''));
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$body$;
