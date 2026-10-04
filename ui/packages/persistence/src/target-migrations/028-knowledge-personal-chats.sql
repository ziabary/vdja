CREATE TABLE knowledge.tbl_knw_conversation (
  kcv_id uuid NOT NULL,
  kcv_deployment_id text NOT NULL,
  kcv_tenant_id text NOT NULL,
  kcv_owner_id text NOT NULL,
  kcv_space__ksp_id uuid NOT NULL,
  kcv_title text NOT NULL DEFAULT 'گفتگوی جدید',
  kcv_lifecycle text NOT NULL DEFAULT 'ACTIVE',
  kcv_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  kcv_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_knw_conversation PRIMARY KEY(kcv_deployment_id,kcv_tenant_id,kcv_id),
  CONSTRAINT fk_knw_conversation_space FOREIGN KEY(kcv_deployment_id,kcv_tenant_id,kcv_space__ksp_id)
    REFERENCES knowledge.tbl_knw_space(ksp_deployment_id,ksp_tenant_id,ksp_id),
  CONSTRAINT ck_knw_conversation_title CHECK(length(kcv_title) BETWEEN 1 AND 256),
  CONSTRAINT ck_knw_conversation_lifecycle CHECK(kcv_lifecycle IN ('ACTIVE','RETIRED'))
);
CREATE TABLE knowledge.tbl_knw_chat_message (
  kcm_id uuid NOT NULL,
  kcm_deployment_id text NOT NULL,
  kcm_tenant_id text NOT NULL,
  kcm_conversation__kcv_id uuid NOT NULL,
  kcm_sequence bigint NOT NULL,
  kcm_role text NOT NULL,
  kcm_text text NOT NULL,
  kcm_citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  kcm_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_knw_chat_message PRIMARY KEY(kcm_deployment_id,kcm_tenant_id,kcm_id),
  CONSTRAINT fk_knw_chat_message_conversation FOREIGN KEY(kcm_deployment_id,kcm_tenant_id,kcm_conversation__kcv_id)
    REFERENCES knowledge.tbl_knw_conversation(kcv_deployment_id,kcv_tenant_id,kcv_id),
  CONSTRAINT uq_knw_chat_message_sequence UNIQUE(kcm_deployment_id,kcm_tenant_id,kcm_conversation__kcv_id,kcm_sequence),
  CONSTRAINT ck_knw_chat_message_role CHECK(kcm_role IN ('USER','ASSISTANT')),
  CONSTRAINT ck_knw_chat_message_text CHECK(length(kcm_text) BETWEEN 1 AND 65536),
  CONSTRAINT ck_knw_chat_message_citations CHECK(jsonb_typeof(kcm_citations)='array')
);
ALTER TABLE knowledge.tbl_knw_conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.tbl_knw_conversation FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge.tbl_knw_chat_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.tbl_knw_chat_message FORCE ROW LEVEL SECURITY;
CREATE POLICY knw_conversation_scope ON knowledge.tbl_knw_conversation TO targoman_api
  USING(kcv_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kcv_tenant_id=NULLIF(current_setting('app.tenant_id',true),'') AND kcv_owner_id=NULLIF(current_setting('app.actor_id',true),''))
  WITH CHECK(kcv_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kcv_tenant_id=NULLIF(current_setting('app.tenant_id',true),'') AND kcv_owner_id=NULLIF(current_setting('app.actor_id',true),''));
CREATE POLICY knw_chat_message_scope ON knowledge.tbl_knw_chat_message TO targoman_api
  USING(kcm_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kcm_tenant_id=NULLIF(current_setting('app.tenant_id',true),'')
    AND EXISTS(SELECT 1 FROM knowledge.tbl_knw_conversation WHERE kcv_deployment_id=kcm_deployment_id AND kcv_tenant_id=kcm_tenant_id AND kcv_id=kcm_conversation__kcv_id))
  WITH CHECK(kcm_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kcm_tenant_id=NULLIF(current_setting('app.tenant_id',true),'')
    AND EXISTS(SELECT 1 FROM knowledge.tbl_knw_conversation WHERE kcv_deployment_id=kcm_deployment_id AND kcv_tenant_id=kcm_tenant_id AND kcv_id=kcm_conversation__kcv_id));
GRANT SELECT,INSERT,UPDATE(kcv_title,kcv_lifecycle,kcv_updated_at) ON knowledge.tbl_knw_conversation TO targoman_api;
GRANT SELECT,INSERT ON knowledge.tbl_knw_chat_message TO targoman_api;
CREATE TRIGGER trg_knw_conversation_mutation AFTER INSERT OR UPDATE ON knowledge.tbl_knw_conversation FOR EACH ROW
  EXECUTE FUNCTION audit.fn_aud_capture_safe('kcv_id','kcv_deployment_id','kcv_tenant_id','kcv_owner_id','kcv_space__ksp_id','kcv_lifecycle');
CREATE TRIGGER trg_knw_chat_message_mutation AFTER INSERT ON knowledge.tbl_knw_chat_message FOR EACH ROW
  EXECUTE FUNCTION audit.fn_aud_capture_safe('kcm_id','kcm_deployment_id','kcm_tenant_id','kcm_conversation__kcv_id','kcm_sequence','kcm_role');
ALTER TABLE knowledge.tbl_knw_membership ADD COLUMN kmb_lifecycle text NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE knowledge.tbl_knw_membership ADD CONSTRAINT ck_knw_membership_lifecycle CHECK(kmb_lifecycle IN ('ACTIVE','RETIRED'));
GRANT UPDATE(kmb_lifecycle) ON knowledge.tbl_knw_membership TO targoman_api;
DROP TRIGGER trg_knw_membership_mutation ON knowledge.tbl_knw_membership;
CREATE TRIGGER trg_knw_membership_mutation AFTER INSERT OR UPDATE OR DELETE ON knowledge.tbl_knw_membership FOR EACH ROW
  EXECUTE FUNCTION audit.fn_aud_capture_safe('kmb_space__ksp_id','kmb_document_id','kmb_deployment_id','kmb_tenant_id','kmb_mode','kmb_security_version','kmb_lifecycle');
CREATE INDEX idx_knw_conversation_owner_updated ON knowledge.tbl_knw_conversation
  (kcv_deployment_id,kcv_tenant_id,kcv_owner_id,kcv_space__ksp_id,kcv_updated_at DESC) WHERE kcv_lifecycle='ACTIVE';
