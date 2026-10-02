CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS translator;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS usage;
CREATE SCHEMA IF NOT EXISTS admission;
CREATE SCHEMA IF NOT EXISTS ai_router;
CREATE SCHEMA IF NOT EXISTS telemetry;

CREATE TABLE platform.tbl_plt_migration (
  mig_name text NOT NULL,
  mig_sha256 char(64) NOT NULL,
  mig_applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_plt_migration PRIMARY KEY (mig_name),
  CONSTRAINT ck_plt_migration_sha256 CHECK (mig_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE translator.tbl_trn_dictionary (
  trd_id bigint GENERATED ALWAYS AS IDENTITY,
  trd_source_kind text NOT NULL,
  trd_source_key text NOT NULL,
  trd_lookup_key text NOT NULL,
  trd_phrase text NOT NULL,
  trd_payload jsonb NOT NULL,
  trd_source_sha256 char(64) NOT NULL,
  trd_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  trd_updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_trn_dictionary PRIMARY KEY (trd_id),
  CONSTRAINT uq_trn_dictionary_source UNIQUE (trd_source_kind, trd_source_key),
  CONSTRAINT ck_trn_dictionary_kind CHECK (trd_source_kind IN ('JSON_FILE', 'MYSQL')),
  CONSTRAINT ck_trn_dictionary_lookup CHECK (length(trd_lookup_key) > 0),
  CONSTRAINT ck_trn_dictionary_sha CHECK (trd_source_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE INDEX idx_trn_dictionary_lookup ON translator.tbl_trn_dictionary (trd_lookup_key, trd_source_kind, trd_id);

CREATE TABLE audit.tbl_aud_semantic_event (
  ase_id uuid NOT NULL,
  ase_deployment_id text NOT NULL,
  ase_tenant_id text NOT NULL,
  ase_module_id text NOT NULL,
  ase_actor_kind text NOT NULL,
  ase_actor_id text,
  ase_session_id text,
  ase_request_id text NOT NULL,
  ase_correlation_id text NOT NULL,
  ase_action text NOT NULL,
  ase_result text NOT NULL,
  ase_reason text,
  ase_config_fingerprint char(64) NOT NULL,
  ase_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_aud_semantic_event PRIMARY KEY (ase_id),
  CONSTRAINT ck_aud_semantic_actor CHECK ((ase_actor_kind = 'ANONYMOUS' AND ase_actor_id IS NULL AND ase_session_id IS NULL) OR (ase_actor_kind <> 'ANONYMOUS'))
);
CREATE INDEX idx_aud_semantic_tenant_time ON audit.tbl_aud_semantic_event (ase_tenant_id, ase_created_at DESC);

CREATE TABLE audit.tbl_aud_mutation (
  aud_id bigint GENERATED ALWAYS AS IDENTITY,
  aud_schema text NOT NULL,
  aud_table text NOT NULL,
  aud_record_id text NOT NULL,
  aud_operation text NOT NULL,
  aud_database_actor text NOT NULL,
  aud_actor_kind text NOT NULL,
  aud_actor_id text,
  aud_correlation_id text NOT NULL,
  aud_source text NOT NULL,
  aud_before jsonb,
  aud_after jsonb,
  aud_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_aud_mutation PRIMARY KEY (aud_id),
  CONSTRAINT ck_aud_mutation_operation CHECK (aud_operation IN ('INSERT', 'UPDATE', 'SOFT_DELETE', 'DELETE'))
);

CREATE FUNCTION audit.fn_aud_capture_safe() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_column text;
  v_record_id text;
  v_operation text;
  v_actor_kind text;
  v_correlation text;
  v_source text;
  v_index integer;
BEGIN
  v_actor_kind := NULLIF(current_setting('app.actor_kind', true), '');
  v_correlation := NULLIF(current_setting('app.correlation_id', true), '');
  v_source := NULLIF(current_setting('app.source', true), '');
  IF v_actor_kind IS NULL OR v_correlation IS NULL OR v_source IS NULL THEN
    RAISE EXCEPTION 'missing mutation audit context' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP <> 'INSERT' THEN
    FOR v_index IN 1..TG_NARGS - 1 LOOP
      v_column := TG_ARGV[v_index];
      v_before := v_before || jsonb_build_object(v_column, to_jsonb(OLD)->v_column);
    END LOOP;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    FOR v_index IN 1..TG_NARGS - 1 LOOP
      v_column := TG_ARGV[v_index];
      v_after := v_after || jsonb_build_object(v_column, to_jsonb(NEW)->v_column);
    END LOOP;
  END IF;
  v_record_id := COALESCE(to_jsonb(NEW)->>TG_ARGV[0], to_jsonb(OLD)->>TG_ARGV[0]);
  IF v_record_id IS NULL THEN RAISE EXCEPTION 'missing audited record identity'; END IF;
  v_operation := TG_OP;
  INSERT INTO audit.tbl_aud_mutation
    (aud_schema, aud_table, aud_record_id, aud_operation, aud_database_actor, aud_actor_kind, aud_actor_id,
     aud_correlation_id, aud_source, aud_before, aud_after)
  VALUES
    (TG_TABLE_SCHEMA, TG_TABLE_NAME, v_record_id, v_operation, session_user, v_actor_kind,
     NULLIF(current_setting('app.actor_id', true), ''), v_correlation, v_source,
     CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE v_before END,
     CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_after END);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION audit.fn_aud_capture_safe() FROM PUBLIC;

CREATE TRIGGER trg_trn_dictionary_audit AFTER INSERT OR UPDATE OR DELETE ON translator.tbl_trn_dictionary
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('trd_id', 'trd_source_kind', 'trd_source_key', 'trd_source_sha256');

CREATE TABLE usage.tbl_usg_consumption (
  usg_id uuid NOT NULL,
  usg_run_id uuid NOT NULL,
  usg_deployment_id text NOT NULL,
  usg_tenant_id text NOT NULL,
  usg_module_id text NOT NULL,
  usg_actor_kind text NOT NULL,
  usg_actor_id text,
  usg_request_id text NOT NULL,
  usg_input_chars bigint NOT NULL,
  usg_uploaded_bytes bigint NOT NULL,
  usg_input_tokens bigint NOT NULL,
  usg_output_tokens bigint NOT NULL,
  usg_provider_ms bigint NOT NULL,
  usg_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_usg_consumption PRIMARY KEY (usg_id),
  CONSTRAINT uq_usg_consumption_run UNIQUE (usg_run_id),
  CONSTRAINT ck_usg_nonnegative CHECK (usg_input_chars >= 0 AND usg_uploaded_bytes >= 0 AND usg_input_tokens >= 0 AND usg_output_tokens >= 0 AND usg_provider_ms >= 0)
);

CREATE TABLE admission.tbl_adm_reservation (
  adr_id uuid NOT NULL,
  adr_deployment_id text NOT NULL,
  adr_tenant_id text NOT NULL,
  adr_module_id text NOT NULL,
  adr_request_id text NOT NULL,
  adr_state text NOT NULL,
  adr_reserved_tokens bigint NOT NULL,
  adr_input_chars bigint NOT NULL,
  adr_expires_at timestamptz NOT NULL,
  adr_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  adr_updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_adm_reservation PRIMARY KEY (adr_id),
  CONSTRAINT uq_adm_request UNIQUE (adr_deployment_id, adr_tenant_id, adr_module_id, adr_request_id),
  CONSTRAINT ck_adm_state CHECK (adr_state IN ('RESERVED', 'SETTLED', 'RELEASED', 'EXPIRED')),
  CONSTRAINT ck_adm_nonnegative CHECK (adr_reserved_tokens >= 0 AND adr_input_chars >= 0)
);
CREATE INDEX idx_adm_scope_state_time ON admission.tbl_adm_reservation (adr_deployment_id, adr_tenant_id, adr_module_id, adr_state, adr_created_at);

CREATE TABLE ai_router.tbl_air_run (
  air_id uuid NOT NULL,
  air_deployment_id text NOT NULL,
  air_tenant_id text NOT NULL,
  air_module_id text NOT NULL,
  air_request_id text NOT NULL,
  air_correlation_id text NOT NULL,
  air_actor_kind text NOT NULL,
  air_actor_id text,
  air_task text NOT NULL,
  air_config_fingerprint char(64) NOT NULL,
  air_status text NOT NULL,
  air_endpoint_id text,
  air_model_id text,
  air_input_tokens bigint,
  air_output_tokens bigint,
  air_error_class text,
  air_started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  air_finished_at timestamptz,
  CONSTRAINT pk_air_run PRIMARY KEY (air_id),
  CONSTRAINT ck_air_run_status CHECK (air_status IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'INTERRUPTED'))
);
CREATE TABLE ai_router.tbl_air_attempt (
  aia_id uuid NOT NULL,
  aia_run__air_id uuid NOT NULL REFERENCES ai_router.tbl_air_run (air_id),
  aia_sequence integer NOT NULL,
  aia_endpoint_id text NOT NULL,
  aia_model_id text NOT NULL,
  aia_status text NOT NULL,
  aia_error_class text,
  aia_started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aia_finished_at timestamptz,
  CONSTRAINT pk_air_attempt PRIMARY KEY (aia_id),
  CONSTRAINT uq_air_attempt_sequence UNIQUE (aia_run__air_id, aia_sequence)
);

CREATE TABLE telemetry.tbl_tel_export (
  tex_id uuid NOT NULL,
  tex_event__ase_id uuid NOT NULL REFERENCES audit.tbl_aud_semantic_event (ase_id),
  tex_destination_id text NOT NULL,
  tex_status text NOT NULL,
  tex_attempt_count integer NOT NULL DEFAULT 0,
  tex_next_attempt_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tex_claimed_until timestamptz,
  tex_last_error_class text,
  tex_ack text,
  tex_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tex_updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_tel_export PRIMARY KEY (tex_id),
  CONSTRAINT uq_tel_event_destination UNIQUE (tex_event__ase_id, tex_destination_id),
  CONSTRAINT ck_tel_export_status CHECK (tex_status IN ('PENDING', 'CLAIMED', 'RETRY', 'DELIVERED', 'FAILED', 'UNKNOWN'))
);
CREATE INDEX idx_tel_due ON telemetry.tbl_tel_export (tex_next_attempt_at) WHERE tex_status IN ('PENDING', 'RETRY', 'UNKNOWN');

-- Runtime grants are deliberately narrow. Bootstrap creates roles before migration.
GRANT USAGE ON SCHEMA platform, translator, audit, usage, admission, ai_router, telemetry TO targoman_api;
GRANT USAGE ON SCHEMA platform, audit, telemetry TO targoman_worker;
GRANT SELECT ON platform.tbl_plt_migration TO targoman_api, targoman_worker;
GRANT SELECT ON translator.tbl_trn_dictionary TO targoman_api;
GRANT SELECT, INSERT ON audit.tbl_aud_semantic_event TO targoman_api;
GRANT INSERT ON usage.tbl_usg_consumption TO targoman_api;
GRANT SELECT, INSERT, UPDATE ON admission.tbl_adm_reservation TO targoman_api;
GRANT SELECT, INSERT, UPDATE ON ai_router.tbl_air_run, ai_router.tbl_air_attempt TO targoman_api;
GRANT SELECT, INSERT ON telemetry.tbl_tel_export TO targoman_api;
GRANT SELECT ON audit.tbl_aud_semantic_event TO targoman_worker;
GRANT SELECT, UPDATE ON telemetry.tbl_tel_export TO targoman_worker;
