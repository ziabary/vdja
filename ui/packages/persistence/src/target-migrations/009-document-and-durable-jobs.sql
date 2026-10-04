CREATE SCHEMA IF NOT EXISTS documents;
CREATE SCHEMA IF NOT EXISTS jobs;
GRANT USAGE ON SCHEMA documents, jobs TO targoman_api, targoman_worker;

CREATE TABLE documents.tbl_doc_document (
  doc_id uuid NOT NULL,
  doc_deployment_id text NOT NULL,
  doc_tenant_id text NOT NULL,
  doc_title text NOT NULL,
  doc_owner_id text NOT NULL,
  doc_classification text NOT NULL,
  doc_business_type text,
  doc_business_id text,
  doc_source_identity text,
  doc_current_version_id uuid,
  doc_security_version bigint NOT NULL DEFAULT 1,
  doc_lifecycle text NOT NULL DEFAULT 'ACTIVE',
  doc_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_doc_document PRIMARY KEY (doc_deployment_id, doc_tenant_id, doc_id),
  CONSTRAINT ck_doc_document_title CHECK (length(doc_title) BETWEEN 1 AND 256),
  CONSTRAINT ck_doc_document_classification CHECK (doc_classification IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT ck_doc_document_lifecycle CHECK (doc_lifecycle IN ('ACTIVE', 'RETIRED')),
  CONSTRAINT ck_doc_document_security_version CHECK (doc_security_version > 0),
  CONSTRAINT ck_doc_document_relation CHECK ((doc_business_type IS NULL) = (doc_business_id IS NULL))
);
CREATE TABLE documents.tbl_doc_version (
  dvr_id uuid NOT NULL,
  dvr_deployment_id text NOT NULL,
  dvr_tenant_id text NOT NULL,
  dvr_document__doc_id uuid NOT NULL,
  dvr_sequence integer NOT NULL,
  dvr_source_identity text NOT NULL,
  dvr_processing_state text NOT NULL DEFAULT 'PENDING',
  dvr_processor text,
  dvr_content_hash text,
  dvr_normalized_text text,
  dvr_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_doc_version PRIMARY KEY (dvr_deployment_id, dvr_tenant_id, dvr_id),
  CONSTRAINT fk_doc_version_document FOREIGN KEY (dvr_deployment_id, dvr_tenant_id, dvr_document__doc_id)
    REFERENCES documents.tbl_doc_document (doc_deployment_id, doc_tenant_id, doc_id),
  CONSTRAINT uq_doc_version_sequence UNIQUE (dvr_deployment_id, dvr_tenant_id, dvr_document__doc_id, dvr_sequence),
  CONSTRAINT uq_doc_version_source UNIQUE (dvr_deployment_id, dvr_tenant_id, dvr_document__doc_id, dvr_source_identity),
  CONSTRAINT ck_doc_version_sequence CHECK (dvr_sequence > 0),
  CONSTRAINT ck_doc_version_source CHECK (length(dvr_source_identity) BETWEEN 1 AND 256),
  CONSTRAINT ck_doc_version_state CHECK (dvr_processing_state IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')),
  CONSTRAINT ck_doc_version_content CHECK ((dvr_normalized_text IS NULL AND dvr_content_hash IS NULL AND dvr_processor IS NULL)
    OR (dvr_normalized_text IS NOT NULL AND length(dvr_normalized_text) > 0
      AND dvr_content_hash ~ '^[a-f0-9]{64}$' AND dvr_processor IS NOT NULL)),
  CONSTRAINT uq_doc_version_document_identity UNIQUE (dvr_deployment_id, dvr_tenant_id, dvr_document__doc_id, dvr_id)
);
ALTER TABLE documents.tbl_doc_document ADD CONSTRAINT fk_doc_document_current_version
  FOREIGN KEY (doc_deployment_id, doc_tenant_id, doc_id, doc_current_version_id)
  REFERENCES documents.tbl_doc_version (dvr_deployment_id, dvr_tenant_id, dvr_document__doc_id, dvr_id)
  DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE documents.tbl_doc_asset (
  ast_id uuid NOT NULL,
  ast_deployment_id text NOT NULL,
  ast_tenant_id text NOT NULL,
  ast_document__doc_id uuid NOT NULL,
  ast_version__dvr_id uuid NOT NULL,
  ast_storage_key text NOT NULL,
  ast_storage_profile text NOT NULL,
  ast_sha256 text NOT NULL,
  ast_bytes bigint NOT NULL,
  ast_media_type text NOT NULL,
  ast_filename text NOT NULL,
  ast_lifecycle text NOT NULL DEFAULT 'APPROVED',
  ast_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_doc_asset PRIMARY KEY (ast_deployment_id, ast_tenant_id, ast_id),
  CONSTRAINT fk_doc_asset_version FOREIGN KEY (ast_deployment_id, ast_tenant_id, ast_document__doc_id, ast_version__dvr_id)
    REFERENCES documents.tbl_doc_version (dvr_deployment_id, dvr_tenant_id, dvr_document__doc_id, dvr_id),
  CONSTRAINT uq_doc_asset_version UNIQUE (ast_deployment_id, ast_tenant_id, ast_version__dvr_id),
  CONSTRAINT uq_doc_asset_key UNIQUE (ast_storage_profile, ast_storage_key),
  CONSTRAINT ck_doc_asset_hash CHECK (ast_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT ck_doc_asset_bytes CHECK (ast_bytes > 0),
  CONSTRAINT ck_doc_asset_lifecycle CHECK (ast_lifecycle IN ('APPROVED', 'QUARANTINED', 'RETIRED')),
  CONSTRAINT ck_doc_asset_filename CHECK (length(ast_filename) BETWEEN 1 AND 256)
);

CREATE FUNCTION documents.fn_doc_guard_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $body$
BEGIN
  IF ROW(NEW.dvr_id, NEW.dvr_deployment_id, NEW.dvr_tenant_id, NEW.dvr_document__doc_id,
    NEW.dvr_sequence, NEW.dvr_source_identity, NEW.dvr_created_at)
    IS DISTINCT FROM ROW(OLD.dvr_id, OLD.dvr_deployment_id, OLD.dvr_tenant_id, OLD.dvr_document__doc_id,
      OLD.dvr_sequence, OLD.dvr_source_identity, OLD.dvr_created_at)
    OR (OLD.dvr_content_hash IS NOT NULL AND ROW(NEW.dvr_content_hash, NEW.dvr_normalized_text, NEW.dvr_processor)
      IS DISTINCT FROM ROW(OLD.dvr_content_hash, OLD.dvr_normalized_text, OLD.dvr_processor)) THEN
    RAISE EXCEPTION 'DOCUMENT_VERSION_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER trg_doc_version_immutable BEFORE UPDATE ON documents.tbl_doc_version
FOR EACH ROW EXECUTE FUNCTION documents.fn_doc_guard_version();
CREATE FUNCTION documents.fn_doc_guard_asset() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $body$
BEGIN
  IF (to_jsonb(NEW) - 'ast_lifecycle') IS DISTINCT FROM (to_jsonb(OLD) - 'ast_lifecycle') THEN
    RAISE EXCEPTION 'DOCUMENT_ASSET_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER trg_doc_asset_immutable BEFORE UPDATE ON documents.tbl_doc_asset
FOR EACH ROW EXECUTE FUNCTION documents.fn_doc_guard_asset();

ALTER TABLE documents.tbl_doc_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents.tbl_doc_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents.tbl_doc_asset ENABLE ROW LEVEL SECURITY;
CREATE POLICY doc_document_scope ON documents.tbl_doc_document TO targoman_api, targoman_worker
  USING (doc_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
    AND doc_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''))
  WITH CHECK (doc_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
    AND doc_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''));
CREATE POLICY doc_version_scope ON documents.tbl_doc_version TO targoman_api, targoman_worker
  USING (dvr_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
    AND dvr_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''))
  WITH CHECK (dvr_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
    AND dvr_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''));
CREATE POLICY doc_asset_scope ON documents.tbl_doc_asset TO targoman_api, targoman_worker
  USING (ast_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
    AND ast_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''))
  WITH CHECK (ast_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
    AND ast_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''));
GRANT SELECT, INSERT ON documents.tbl_doc_document, documents.tbl_doc_version, documents.tbl_doc_asset TO targoman_api;
GRANT SELECT ON documents.tbl_doc_document, documents.tbl_doc_version, documents.tbl_doc_asset TO targoman_worker;
GRANT UPDATE (doc_current_version_id, doc_lifecycle, doc_security_version) ON documents.tbl_doc_document TO targoman_api, targoman_worker;
GRANT UPDATE (dvr_processing_state, dvr_processor, dvr_content_hash, dvr_normalized_text) ON documents.tbl_doc_version TO targoman_worker;
GRANT UPDATE (ast_lifecycle) ON documents.tbl_doc_asset TO targoman_api, targoman_worker;
CREATE TRIGGER trg_doc_document_mutation AFTER INSERT OR UPDATE OR DELETE ON documents.tbl_doc_document
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('doc_id', 'doc_deployment_id', 'doc_tenant_id', 'doc_classification', 'doc_current_version_id', 'doc_lifecycle', 'doc_security_version');
CREATE TRIGGER trg_doc_version_mutation AFTER INSERT OR UPDATE OR DELETE ON documents.tbl_doc_version
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('dvr_id', 'dvr_deployment_id', 'dvr_tenant_id', 'dvr_document__doc_id', 'dvr_sequence', 'dvr_processing_state');
CREATE TRIGGER trg_doc_asset_mutation AFTER INSERT OR UPDATE OR DELETE ON documents.tbl_doc_asset
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('ast_id', 'ast_deployment_id', 'ast_tenant_id', 'ast_document__doc_id', 'ast_version__dvr_id', 'ast_bytes', 'ast_lifecycle');

CREATE TABLE jobs.tbl_job_work (
  job_id uuid NOT NULL,
  job_deployment_id text NOT NULL,
  job_tenant_id text NOT NULL,
  job_kind text NOT NULL,
  job_idempotency_key text NOT NULL,
  job_payload_version integer NOT NULL,
  job_payload jsonb NOT NULL,
  job_subject jsonb NOT NULL,
  job_state text NOT NULL DEFAULT 'PENDING',
  job_attempts integer NOT NULL DEFAULT 0,
  job_max_attempts integer NOT NULL,
  job_available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  job_lease_token uuid,
  job_lease_until timestamptz,
  job_error_class text,
  job_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  job_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_job_work PRIMARY KEY (job_deployment_id, job_tenant_id, job_id),
  CONSTRAINT uq_job_work_idempotency UNIQUE (job_deployment_id, job_tenant_id, job_kind, job_idempotency_key),
  CONSTRAINT ck_job_work_state CHECK (job_state IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  CONSTRAINT ck_job_work_attempts CHECK (job_attempts BETWEEN 0 AND job_max_attempts AND job_max_attempts BETWEEN 1 AND 10),
  CONSTRAINT ck_job_work_payload CHECK (job_payload_version > 0 AND jsonb_typeof(job_payload) = 'object'
    AND pg_column_size(job_payload) <= 16384 AND jsonb_typeof(job_subject) = 'object'),
  CONSTRAINT ck_job_work_subject_scope CHECK (job_subject->>'tenantId' = job_tenant_id
    AND job_subject->>'deploymentId' = job_deployment_id),
  CONSTRAINT ck_job_work_lease CHECK ((job_state = 'RUNNING' AND job_lease_token IS NOT NULL AND job_lease_until IS NOT NULL)
    OR (job_state <> 'RUNNING' AND job_lease_token IS NULL AND job_lease_until IS NULL))
);
CREATE INDEX idx_job_work_claim ON jobs.tbl_job_work (job_deployment_id, job_tenant_id, job_available_at, job_created_at)
WHERE job_state IN ('PENDING', 'RUNNING');
ALTER TABLE jobs.tbl_job_work ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_work_scope ON jobs.tbl_job_work TO targoman_api, targoman_worker
  USING (job_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
    AND job_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''))
  WITH CHECK (job_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
    AND job_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''));
GRANT SELECT, INSERT ON jobs.tbl_job_work TO targoman_api, targoman_worker;
GRANT UPDATE (job_state, job_attempts, job_available_at, job_lease_token, job_lease_until, job_error_class, job_updated_at)
  ON jobs.tbl_job_work TO targoman_worker;
CREATE TRIGGER trg_job_work_mutation AFTER INSERT OR UPDATE OR DELETE ON jobs.tbl_job_work
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('job_id', 'job_deployment_id', 'job_tenant_id', 'job_kind', 'job_state', 'job_attempts', 'job_error_class');
