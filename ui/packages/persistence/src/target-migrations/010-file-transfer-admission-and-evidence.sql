CREATE SCHEMA IF NOT EXISTS file_management;
GRANT USAGE ON SCHEMA file_management TO targoman_api, targoman_worker;
ALTER TABLE audit.tbl_aud_semantic_event ADD COLUMN ase_resource_type text;
ALTER TABLE audit.tbl_aud_semantic_event ADD COLUMN ase_resource_id text;
GRANT INSERT ON audit.tbl_aud_semantic_event TO targoman_worker;
GRANT USAGE ON SCHEMA audit, admission, usage TO targoman_worker;

ALTER TABLE jobs.tbl_job_work ADD CONSTRAINT ck_job_work_required_subject
  CHECK (jsonb_typeof(job_subject->'tenantId') = 'string' AND job_subject ? 'tenantId'
    AND jsonb_typeof(job_subject->'deploymentId') = 'string' AND job_subject ? 'deploymentId'
    AND jsonb_typeof(job_subject->'actorId') = 'string' AND job_subject ? 'actorId'
    AND job_subject->>'actorKind' IN ('HUMAN','PLATFORM_SERVICE','SERVICE_ACCOUNT','API_CLIENT','INTEGRATION')
    AND job_subject ? 'actorKind');
ALTER TABLE documents.tbl_doc_version ADD CONSTRAINT ck_doc_version_ready_content
  CHECK (dvr_processing_state <> 'READY' OR dvr_content_hash IS NOT NULL);

CREATE TABLE file_management.tbl_fil_transfer (
  ftr_id uuid NOT NULL,
  ftr_deployment_id text NOT NULL,
  ftr_tenant_id text NOT NULL,
  ftr_document__doc_id uuid NOT NULL,
  ftr_idempotency_key text NOT NULL,
  ftr_asset_id uuid NOT NULL,
  ftr_proposed_version_id uuid NOT NULL,
  ftr_version_id uuid,
  ftr_storage_key text NOT NULL,
  ftr_storage_profile text NOT NULL,
  ftr_remote_upload_id text,
  ftr_filename text NOT NULL,
  ftr_media_type text NOT NULL,
  ftr_bytes bigint NOT NULL,
  ftr_sha256 text NOT NULL,
  ftr_part_bytes integer NOT NULL,
  ftr_state text NOT NULL DEFAULT 'INITIATED',
  ftr_operation text,
  ftr_lease_token uuid,
  ftr_lease_expires_at timestamptz,
  ftr_expires_at timestamptz NOT NULL,
  ftr_error_class text,
  ftr_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ftr_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_fil_transfer PRIMARY KEY (ftr_deployment_id, ftr_tenant_id, ftr_id),
  CONSTRAINT uq_fil_transfer_idempotency UNIQUE (ftr_deployment_id, ftr_tenant_id, ftr_document__doc_id, ftr_idempotency_key),
  CONSTRAINT uq_fil_transfer_storage_key UNIQUE (ftr_storage_profile, ftr_storage_key),
  CONSTRAINT ck_fil_transfer_hash CHECK (ftr_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT ck_fil_transfer_bytes CHECK (ftr_bytes > 0 AND ftr_bytes <= 200000000 AND ftr_part_bytes BETWEEN 5242880 AND 20971520),
  CONSTRAINT ck_fil_transfer_idempotency CHECK (length(ftr_idempotency_key) BETWEEN 1 AND 256),
  CONSTRAINT ck_fil_transfer_state CHECK (ftr_state IN ('INITIATED','UPLOADING','UPLOADED','VERIFYING','COMMITTED','FAILED','EXPIRED','UNRESOLVED')),
  CONSTRAINT ck_fil_transfer_operation CHECK (ftr_operation IS NULL OR ftr_operation IN ('BEGIN','PART','COMPLETE','RECONCILE','EXPIRE')),
  CONSTRAINT ck_fil_transfer_lease CHECK ((ftr_lease_token IS NULL) = (ftr_lease_expires_at IS NULL)),
  CONSTRAINT ck_fil_transfer_committed CHECK ((ftr_state = 'COMMITTED') = (ftr_version_id IS NOT NULL))
);
CREATE INDEX idx_fil_transfer_expiry ON file_management.tbl_fil_transfer (ftr_deployment_id, ftr_tenant_id, ftr_expires_at)
WHERE ftr_state NOT IN ('COMMITTED','FAILED','EXPIRED');
CREATE TABLE file_management.tbl_fil_part (
  fpt_deployment_id text NOT NULL,
  fpt_tenant_id text NOT NULL,
  fpt_transfer__ftr_id uuid NOT NULL,
  fpt_number integer NOT NULL,
  fpt_bytes integer NOT NULL,
  fpt_sha256 text NOT NULL,
  fpt_etag text,
  CONSTRAINT pk_fil_part PRIMARY KEY (fpt_deployment_id, fpt_tenant_id, fpt_transfer__ftr_id, fpt_number),
  CONSTRAINT fk_fil_part_transfer FOREIGN KEY (fpt_deployment_id, fpt_tenant_id, fpt_transfer__ftr_id)
    REFERENCES file_management.tbl_fil_transfer (ftr_deployment_id, ftr_tenant_id, ftr_id),
  CONSTRAINT ck_fil_part_number CHECK (fpt_number BETWEEN 1 AND 10000),
  CONSTRAINT ck_fil_part_bytes CHECK (fpt_bytes BETWEEN 1 AND 20971520),
  CONSTRAINT ck_fil_part_hash CHECK (fpt_sha256 ~ '^[a-f0-9]{64}$')
);
ALTER TABLE file_management.tbl_fil_transfer ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_management.tbl_fil_part ENABLE ROW LEVEL SECURITY;
CREATE POLICY fil_transfer_scope ON file_management.tbl_fil_transfer TO targoman_api, targoman_worker
  USING (ftr_tenant_id = NULLIF(current_setting('app.tenant_id', true), '') AND ftr_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''))
  WITH CHECK (ftr_tenant_id = NULLIF(current_setting('app.tenant_id', true), '') AND ftr_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''));
CREATE POLICY fil_part_scope ON file_management.tbl_fil_part TO targoman_api, targoman_worker
  USING (fpt_tenant_id = NULLIF(current_setting('app.tenant_id', true), '') AND fpt_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''))
  WITH CHECK (fpt_tenant_id = NULLIF(current_setting('app.tenant_id', true), '') AND fpt_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''));
GRANT SELECT, INSERT ON file_management.tbl_fil_transfer, file_management.tbl_fil_part TO targoman_api, targoman_worker;
GRANT UPDATE (ftr_version_id, ftr_remote_upload_id, ftr_state, ftr_operation, ftr_lease_token, ftr_lease_expires_at, ftr_error_class, ftr_updated_at)
  ON file_management.tbl_fil_transfer TO targoman_api, targoman_worker;
GRANT UPDATE (fpt_etag) ON file_management.tbl_fil_part TO targoman_api, targoman_worker;
CREATE TRIGGER trg_fil_transfer_mutation AFTER INSERT OR UPDATE OR DELETE ON file_management.tbl_fil_transfer
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('ftr_id','ftr_deployment_id','ftr_tenant_id','ftr_document__doc_id','ftr_state','ftr_bytes','ftr_version_id','ftr_error_class');
CREATE TRIGGER trg_fil_part_mutation AFTER INSERT OR UPDATE OR DELETE ON file_management.tbl_fil_part
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('fpt_transfer__ftr_id','fpt_deployment_id','fpt_tenant_id','fpt_number','fpt_bytes');

CREATE TABLE admission.tbl_adm_file_reservation (
  afr_id uuid NOT NULL,
  afr_deployment_id text NOT NULL,
  afr_tenant_id text NOT NULL,
  afr_kind text NOT NULL,
  afr_bytes bigint NOT NULL,
  afr_state text NOT NULL DEFAULT 'RESERVED',
  afr_expires_at timestamptz NOT NULL,
  afr_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_adm_file_reservation PRIMARY KEY (afr_deployment_id, afr_tenant_id, afr_id),
  CONSTRAINT ck_adm_file_reservation_kind CHECK (afr_kind IN ('UPLOAD','DOWNLOAD','PROCESSING')),
  CONSTRAINT ck_adm_file_reservation_state CHECK (afr_state IN ('RESERVED','COMMITTED','RELEASED')),
  CONSTRAINT ck_adm_file_reservation_bytes CHECK (afr_bytes > 0)
);
CREATE INDEX idx_adm_file_reservation_active ON admission.tbl_adm_file_reservation (afr_deployment_id, afr_tenant_id, afr_kind, afr_state);
ALTER TABLE admission.tbl_adm_file_reservation ENABLE ROW LEVEL SECURITY;
CREATE POLICY adm_file_reservation_scope ON admission.tbl_adm_file_reservation TO targoman_api, targoman_worker
  USING (afr_tenant_id = NULLIF(current_setting('app.tenant_id', true), '') AND afr_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''))
  WITH CHECK (afr_tenant_id = NULLIF(current_setting('app.tenant_id', true), '') AND afr_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''));
GRANT SELECT, INSERT ON admission.tbl_adm_file_reservation TO targoman_api, targoman_worker;
GRANT UPDATE (afr_state) ON admission.tbl_adm_file_reservation TO targoman_api, targoman_worker;
CREATE TRIGGER trg_adm_file_reservation_mutation AFTER INSERT OR UPDATE OR DELETE ON admission.tbl_adm_file_reservation
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('afr_id','afr_deployment_id','afr_tenant_id','afr_kind','afr_bytes','afr_state');

CREATE TABLE usage.tbl_usg_file_consumption (
  ufc_operation_id uuid NOT NULL,
  ufc_deployment_id text NOT NULL,
  ufc_tenant_id text NOT NULL,
  ufc_actor_kind text NOT NULL,
  ufc_actor_id text,
  ufc_session_id text,
  ufc_request_id text NOT NULL,
  ufc_correlation_id text NOT NULL,
  ufc_uploaded_bytes bigint NOT NULL,
  ufc_downloaded_bytes bigint NOT NULL,
  ufc_storage_bytes bigint NOT NULL,
  ufc_files integer NOT NULL,
  ufc_processing_bytes bigint NOT NULL,
  ufc_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_usg_file_consumption PRIMARY KEY (ufc_deployment_id, ufc_tenant_id, ufc_operation_id),
  CONSTRAINT ck_usg_file_consumption_nonnegative CHECK (ufc_uploaded_bytes >= 0 AND ufc_downloaded_bytes >= 0
    AND ufc_storage_bytes >= 0 AND ufc_files >= 0 AND ufc_processing_bytes >= 0)
);
ALTER TABLE usage.tbl_usg_file_consumption ENABLE ROW LEVEL SECURITY;
CREATE POLICY usg_file_consumption_scope ON usage.tbl_usg_file_consumption TO targoman_api, targoman_worker
  USING (ufc_tenant_id = NULLIF(current_setting('app.tenant_id', true), '') AND ufc_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''))
  WITH CHECK (ufc_tenant_id = NULLIF(current_setting('app.tenant_id', true), '') AND ufc_deployment_id = NULLIF(current_setting('app.deployment_id', true), ''));
GRANT SELECT, INSERT ON usage.tbl_usg_file_consumption TO targoman_api, targoman_worker;
CREATE TRIGGER trg_usg_file_consumption_mutation AFTER INSERT OR UPDATE OR DELETE ON usage.tbl_usg_file_consumption
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('ufc_operation_id','ufc_deployment_id','ufc_tenant_id','ufc_uploaded_bytes','ufc_downloaded_bytes','ufc_storage_bytes','ufc_files','ufc_processing_bytes');
