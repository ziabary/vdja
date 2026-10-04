CREATE SCHEMA IF NOT EXISTS knowledge;
GRANT USAGE ON SCHEMA knowledge TO targoman_api,targoman_worker;
CREATE TABLE knowledge.tbl_knw_generation (
  kgn_id uuid NOT NULL, kgn_deployment_id text NOT NULL, kgn_tenant_id text NOT NULL,
  kgn_profile_id text NOT NULL, kgn_embedding_profile_id text NOT NULL, kgn_dimensions integer NOT NULL,
  kgn_chunking_profile text NOT NULL, kgn_chunk_chars integer NOT NULL, kgn_overlap_chars integer NOT NULL,
  kgn_collection text NOT NULL, kgn_state text NOT NULL DEFAULT 'BUILDING', kgn_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_knw_generation PRIMARY KEY (kgn_deployment_id,kgn_tenant_id,kgn_id),
  CONSTRAINT ck_knw_generation_dimensions CHECK (kgn_dimensions BETWEEN 1 AND 65536),
  CONSTRAINT ck_knw_generation_chunking CHECK (kgn_chunking_profile='utf16-window-v1' AND kgn_chunk_chars BETWEEN 32 AND 8000 AND kgn_overlap_chars>=0 AND kgn_overlap_chars<kgn_chunk_chars),
  CONSTRAINT ck_knw_generation_collection CHECK (kgn_collection ~ '^idx_[a-f0-9]{16}_[a-f0-9]{32}$'),
  CONSTRAINT ck_knw_generation_state CHECK (kgn_state IN ('BUILDING','READY','RETIRED','FAILED'))
);
CREATE TABLE knowledge.tbl_knw_space (
  ksp_id uuid NOT NULL,ksp_deployment_id text NOT NULL,ksp_tenant_id text NOT NULL,ksp_title text NOT NULL,
  ksp_owner_id text NOT NULL,ksp_classification text NOT NULL,ksp_lifecycle text NOT NULL DEFAULT 'ACTIVE',
  ksp_security_version bigint NOT NULL DEFAULT 1,ksp_generation_id uuid,ksp_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_knw_space PRIMARY KEY (ksp_deployment_id,ksp_tenant_id,ksp_id),
  CONSTRAINT fk_knw_space_generation FOREIGN KEY (ksp_deployment_id,ksp_tenant_id,ksp_generation_id) REFERENCES knowledge.tbl_knw_generation (kgn_deployment_id,kgn_tenant_id,kgn_id),
  CONSTRAINT ck_knw_space_title CHECK (length(ksp_title) BETWEEN 1 AND 256),
  CONSTRAINT ck_knw_space_classification CHECK (ksp_classification IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  CONSTRAINT ck_knw_space_state CHECK (ksp_lifecycle IN ('ACTIVE','RETIRED') AND ksp_security_version>0)
);
CREATE TABLE knowledge.tbl_knw_membership (
  kmb_deployment_id text NOT NULL,kmb_tenant_id text NOT NULL,kmb_space__ksp_id uuid NOT NULL,kmb_document_id uuid NOT NULL,
  kmb_mode text NOT NULL,kmb_pinned_version_id uuid,kmb_security_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT pk_knw_membership PRIMARY KEY (kmb_deployment_id,kmb_tenant_id,kmb_space__ksp_id,kmb_document_id),
  CONSTRAINT fk_knw_membership_space FOREIGN KEY (kmb_deployment_id,kmb_tenant_id,kmb_space__ksp_id) REFERENCES knowledge.tbl_knw_space (ksp_deployment_id,ksp_tenant_id,ksp_id),
  CONSTRAINT ck_knw_membership_mode CHECK ((kmb_mode='CURRENT' AND kmb_pinned_version_id IS NULL) OR (kmb_mode='PINNED' AND kmb_pinned_version_id IS NOT NULL)),
  CONSTRAINT ck_knw_membership_security CHECK (kmb_security_version>0)
);
CREATE TABLE knowledge.tbl_knw_chunk (
  kch_id uuid NOT NULL,kch_deployment_id text NOT NULL,kch_tenant_id text NOT NULL,kch_generation__kgn_id uuid NOT NULL,
  kch_space__ksp_id uuid NOT NULL,kch_document_id uuid NOT NULL,kch_version_id uuid NOT NULL,kch_ordinal integer NOT NULL,
  kch_start integer NOT NULL,kch_end integer NOT NULL,kch_sha256 text NOT NULL,
  kch_document_security_version bigint NOT NULL,kch_membership_security_version bigint NOT NULL,
  CONSTRAINT pk_knw_chunk PRIMARY KEY (kch_deployment_id,kch_tenant_id,kch_generation__kgn_id,kch_space__ksp_id,kch_id),
  CONSTRAINT fk_knw_chunk_generation FOREIGN KEY (kch_deployment_id,kch_tenant_id,kch_generation__kgn_id) REFERENCES knowledge.tbl_knw_generation (kgn_deployment_id,kgn_tenant_id,kgn_id),
  CONSTRAINT fk_knw_chunk_membership FOREIGN KEY (kch_deployment_id,kch_tenant_id,kch_space__ksp_id,kch_document_id) REFERENCES knowledge.tbl_knw_membership (kmb_deployment_id,kmb_tenant_id,kmb_space__ksp_id,kmb_document_id),
  CONSTRAINT uq_knw_chunk_position UNIQUE (kch_deployment_id,kch_tenant_id,kch_generation__kgn_id,kch_space__ksp_id,kch_document_id,kch_version_id,kch_ordinal),
  CONSTRAINT ck_knw_chunk_boundary CHECK (kch_start>=0 AND kch_end>kch_start AND kch_ordinal>=0 AND kch_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT ck_knw_chunk_security CHECK (kch_document_security_version>0 AND kch_membership_security_version>0)
);
CREATE TABLE knowledge.tbl_knw_projection (
  kpr_deployment_id text NOT NULL,kpr_tenant_id text NOT NULL,kpr_generation__kgn_id uuid NOT NULL,kpr_space__ksp_id uuid NOT NULL,
  kpr_space_security_version bigint NOT NULL,kpr_chunks integer NOT NULL,kpr_state text NOT NULL,kpr_activated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_knw_projection PRIMARY KEY (kpr_deployment_id,kpr_tenant_id,kpr_generation__kgn_id,kpr_space__ksp_id),
  CONSTRAINT fk_knw_projection_generation FOREIGN KEY (kpr_deployment_id,kpr_tenant_id,kpr_generation__kgn_id) REFERENCES knowledge.tbl_knw_generation (kgn_deployment_id,kgn_tenant_id,kgn_id),
  CONSTRAINT fk_knw_projection_space FOREIGN KEY (kpr_deployment_id,kpr_tenant_id,kpr_space__ksp_id) REFERENCES knowledge.tbl_knw_space (ksp_deployment_id,ksp_tenant_id,ksp_id),
  CONSTRAINT ck_knw_projection_ready CHECK (kpr_space_security_version>0 AND kpr_chunks>0 AND kpr_state='READY')
);
CREATE FUNCTION knowledge.fn_knw_guard_generation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $body$
BEGIN
  IF (to_jsonb(NEW)-'kgn_state') IS DISTINCT FROM (to_jsonb(OLD)-'kgn_state') THEN RAISE EXCEPTION 'INDEX_GENERATION_IMMUTABLE'; END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER trg_knw_generation_immutable BEFORE UPDATE ON knowledge.tbl_knw_generation FOR EACH ROW EXECUTE FUNCTION knowledge.fn_knw_guard_generation();
ALTER TABLE knowledge.tbl_knw_generation ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.tbl_knw_generation FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge.tbl_knw_space ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.tbl_knw_space FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge.tbl_knw_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.tbl_knw_membership FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge.tbl_knw_chunk ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.tbl_knw_chunk FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge.tbl_knw_projection ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.tbl_knw_projection FORCE ROW LEVEL SECURITY;
CREATE POLICY knw_generation_scope ON knowledge.tbl_knw_generation TO targoman_api,targoman_worker
  USING (kgn_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kgn_tenant_id=NULLIF(current_setting('app.tenant_id',true),''))
  WITH CHECK (kgn_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kgn_tenant_id=NULLIF(current_setting('app.tenant_id',true),''));
CREATE POLICY knw_space_scope ON knowledge.tbl_knw_space TO targoman_api,targoman_worker
  USING (ksp_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND ksp_tenant_id=NULLIF(current_setting('app.tenant_id',true),''))
  WITH CHECK (ksp_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND ksp_tenant_id=NULLIF(current_setting('app.tenant_id',true),''));
CREATE POLICY knw_membership_scope ON knowledge.tbl_knw_membership TO targoman_api,targoman_worker
  USING (kmb_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kmb_tenant_id=NULLIF(current_setting('app.tenant_id',true),''))
  WITH CHECK (kmb_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kmb_tenant_id=NULLIF(current_setting('app.tenant_id',true),''));
CREATE POLICY knw_chunk_scope ON knowledge.tbl_knw_chunk TO targoman_api,targoman_worker
  USING (kch_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kch_tenant_id=NULLIF(current_setting('app.tenant_id',true),''))
  WITH CHECK (kch_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kch_tenant_id=NULLIF(current_setting('app.tenant_id',true),''));
CREATE POLICY knw_projection_scope ON knowledge.tbl_knw_projection TO targoman_api,targoman_worker
  USING (kpr_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kpr_tenant_id=NULLIF(current_setting('app.tenant_id',true),''))
  WITH CHECK (kpr_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kpr_tenant_id=NULLIF(current_setting('app.tenant_id',true),''));
GRANT SELECT ON knowledge.tbl_knw_generation,knowledge.tbl_knw_space,knowledge.tbl_knw_membership,knowledge.tbl_knw_chunk,knowledge.tbl_knw_projection TO targoman_api,targoman_worker;
GRANT INSERT ON knowledge.tbl_knw_space,knowledge.tbl_knw_membership TO targoman_api;
GRANT UPDATE (ksp_security_version,ksp_title,ksp_classification,ksp_lifecycle) ON knowledge.tbl_knw_space TO targoman_api;
GRANT UPDATE (kmb_mode,kmb_pinned_version_id,kmb_security_version) ON knowledge.tbl_knw_membership TO targoman_api;
GRANT INSERT ON knowledge.tbl_knw_generation,knowledge.tbl_knw_chunk,knowledge.tbl_knw_projection TO targoman_worker;
GRANT UPDATE (kgn_state) ON knowledge.tbl_knw_generation TO targoman_worker;
GRANT UPDATE (ksp_generation_id) ON knowledge.tbl_knw_space TO targoman_worker;
CREATE TRIGGER trg_knw_space_mutation AFTER INSERT OR UPDATE OR DELETE ON knowledge.tbl_knw_space FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('ksp_id','ksp_deployment_id','ksp_tenant_id','ksp_security_version','ksp_lifecycle','ksp_generation_id');
CREATE TRIGGER trg_knw_membership_mutation AFTER INSERT OR UPDATE OR DELETE ON knowledge.tbl_knw_membership FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('kmb_space__ksp_id','kmb_document_id','kmb_deployment_id','kmb_tenant_id','kmb_mode','kmb_security_version');
CREATE TRIGGER trg_knw_generation_mutation AFTER INSERT OR UPDATE OR DELETE ON knowledge.tbl_knw_generation FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('kgn_id','kgn_deployment_id','kgn_tenant_id','kgn_state','kgn_dimensions');
CREATE TRIGGER trg_knw_chunk_mutation AFTER INSERT OR UPDATE OR DELETE ON knowledge.tbl_knw_chunk FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('kch_id','kch_deployment_id','kch_tenant_id','kch_generation__kgn_id','kch_space__ksp_id','kch_document_id','kch_version_id','kch_ordinal','kch_document_security_version','kch_membership_security_version');
CREATE TRIGGER trg_knw_projection_mutation AFTER INSERT OR UPDATE OR DELETE ON knowledge.tbl_knw_projection FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('kpr_deployment_id','kpr_tenant_id','kpr_generation__kgn_id','kpr_space__ksp_id','kpr_state','kpr_chunks','kpr_space_security_version');
