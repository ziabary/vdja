CREATE TABLE platform.tbl_plt_migration (
  mig_name text NOT NULL,
  mig_sha256 char(64) NOT NULL,
  mig_applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_plt_migration PRIMARY KEY (mig_name),
  CONSTRAINT ck_plt_migration_sha256 CHECK (mig_sha256 ~ '^[0-9a-f]{64}$')
);
GRANT SELECT ON platform.tbl_plt_migration TO t2_runtime;

CREATE TABLE audit.tbl_aud_mutation (
  aud_id bigint GENERATED ALWAYS AS IDENTITY,
  aud_schema text NOT NULL,
  aud_table text NOT NULL,
  aud_record_id text NOT NULL,
  aud_operation text NOT NULL,
  aud_database_actor text NOT NULL,
  aud_actor_id text NOT NULL,
  aud_correlation_id text NOT NULL,
  aud_source text NOT NULL,
  aud_before jsonb,
  aud_after jsonb,
  aud_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_aud_mutation PRIMARY KEY (aud_id),
  CONSTRAINT ck_aud_operation CHECK (aud_operation IN ('INSERT', 'UPDATE', 'SOFT_DELETE', 'DELETE'))
);
REVOKE ALL ON audit.tbl_aud_mutation FROM PUBLIC, t2_runtime;

CREATE FUNCTION audit.fn_aud_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_actor text;
  v_correlation text;
  v_source text;
  v_operation text;
  v_record_id text;
BEGIN
  v_actor := NULLIF(current_setting('app.actor_id', true), '');
  v_correlation := NULLIF(current_setting('app.correlation_id', true), '');
  v_source := NULLIF(current_setting('app.source', true), '');
  IF v_actor IS NULL OR v_correlation IS NULL OR v_source IS NULL THEN
    RAISE EXCEPTION 'missing transaction-local audit context' USING ERRCODE = 'P0001';
  END IF;
  v_before := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_after := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_record_id := COALESCE(v_after, v_before)->>TG_ARGV[0];
  IF v_record_id IS NULL THEN RAISE EXCEPTION 'missing audited record identity'; END IF;
  v_operation := TG_OP;
  IF TG_OP = 'UPDATE' AND TG_NARGS > 1
     AND v_before->>TG_ARGV[1] IS NULL AND v_after->>TG_ARGV[1] IS NOT NULL THEN
    v_operation := 'SOFT_DELETE';
  END IF;
  INSERT INTO audit.tbl_aud_mutation
    (aud_schema, aud_table, aud_record_id, aud_operation, aud_database_actor,
     aud_actor_id, aud_correlation_id, aud_source, aud_before, aud_after)
  VALUES
    (TG_TABLE_SCHEMA, TG_TABLE_NAME, v_record_id, v_operation, session_user,
     v_actor, v_correlation, v_source, v_before, v_after);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION audit.fn_aud_capture() FROM PUBLIC;
