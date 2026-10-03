CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS authentication;
CREATE SCHEMA IF NOT EXISTS session_core;
CREATE SCHEMA IF NOT EXISTS authority;

CREATE TABLE identity.tbl_idn_identity (
  idn_id uuid NOT NULL,
  idn_kind text NOT NULL,
  idn_display_name text NOT NULL,
  idn_email_normalized text,
  idn_state text NOT NULL DEFAULT 'ACTIVE',
  idn_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  idn_updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_idn_identity PRIMARY KEY (idn_id),
  CONSTRAINT uq_idn_identity_email UNIQUE (idn_email_normalized),
  CONSTRAINT ck_idn_identity_kind CHECK (idn_kind IN ('HUMAN','SERVICE_ACCOUNT','API_CLIENT','PLATFORM_SERVICE','INTEGRATION')),
  CONSTRAINT ck_idn_identity_state CHECK (idn_state IN ('ACTIVE','SUSPENDED','TERMINATED')),
  CONSTRAINT ck_idn_human_email CHECK (idn_kind <> 'HUMAN' OR idn_email_normalized IS NOT NULL)
);

CREATE TABLE identity.tbl_idn_membership (
  idm_id uuid NOT NULL,
  idm_identity__idn_id uuid NOT NULL,
  idm_tenant_id text NOT NULL,
  idm_state text NOT NULL DEFAULT 'ACTIVE',
  idm_authorization_version bigint NOT NULL DEFAULT 1,
  idm_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  idm_updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_idn_membership PRIMARY KEY (idm_id),
  CONSTRAINT fk_idn_membership_identity FOREIGN KEY (idm_identity__idn_id) REFERENCES identity.tbl_idn_identity (idn_id),
  CONSTRAINT uq_idn_membership_identity_tenant UNIQUE (idm_identity__idn_id, idm_tenant_id),
  CONSTRAINT ck_idn_membership_state CHECK (idm_state IN ('ACTIVE','SUSPENDED','TERMINATED')),
  CONSTRAINT ck_idn_membership_version CHECK (idm_authorization_version > 0)
);
CREATE INDEX idx_idn_membership_tenant ON identity.tbl_idn_membership (idm_tenant_id, idm_identity__idn_id);

CREATE TABLE authentication.tbl_ath_password_credential (
  apc_identity__idn_id uuid NOT NULL,
  apc_password_hash text NOT NULL,
  apc_updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_ath_password_credential PRIMARY KEY (apc_identity__idn_id),
  CONSTRAINT fk_ath_password_identity FOREIGN KEY (apc_identity__idn_id) REFERENCES identity.tbl_idn_identity (idn_id)
);
CREATE TABLE authentication.tbl_ath_login_guard (
  alg_key_sha256 char(64) NOT NULL,
  alg_failed_count integer NOT NULL DEFAULT 0,
  alg_locked_until timestamptz,
  alg_updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_ath_login_guard PRIMARY KEY (alg_key_sha256),
  CONSTRAINT ck_ath_login_guard_count CHECK (alg_failed_count >= 0)
);

CREATE TABLE session_core.tbl_ses_session (
  ses_id uuid NOT NULL,
  ses_identity__idn_id uuid NOT NULL,
  ses_membership__idm_id uuid NOT NULL,
  ses_tenant_id text NOT NULL,
  ses_family_id uuid NOT NULL,
  ses_authorization_version bigint NOT NULL,
  ses_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ses_expires_at timestamptz NOT NULL,
  ses_last_activity_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ses_revoked_at timestamptz,
  ses_revoke_reason text,
  ses_client_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pk_ses_session PRIMARY KEY (ses_id),
  CONSTRAINT fk_ses_identity FOREIGN KEY (ses_identity__idn_id) REFERENCES identity.tbl_idn_identity (idn_id),
  CONSTRAINT fk_ses_membership FOREIGN KEY (ses_membership__idm_id) REFERENCES identity.tbl_idn_membership (idm_id),
  CONSTRAINT ck_ses_expiry CHECK (ses_expires_at > ses_created_at),
  CONSTRAINT ck_ses_authz_version CHECK (ses_authorization_version > 0)
);
CREATE INDEX idx_ses_identity_active ON session_core.tbl_ses_session (ses_identity__idn_id, ses_revoked_at, ses_expires_at);
CREATE INDEX idx_ses_tenant_active ON session_core.tbl_ses_session (ses_tenant_id, ses_revoked_at, ses_expires_at);

CREATE TABLE session_core.tbl_ses_refresh_token (
  srt_id uuid NOT NULL,
  srt_session__ses_id uuid NOT NULL,
  srt_token_sha256 char(64) NOT NULL,
  srt_issued_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  srt_expires_at timestamptz NOT NULL,
  srt_used_at timestamptz,
  CONSTRAINT pk_ses_refresh_token PRIMARY KEY (srt_id),
  CONSTRAINT fk_ses_refresh_session FOREIGN KEY (srt_session__ses_id) REFERENCES session_core.tbl_ses_session (ses_id),
  CONSTRAINT uq_ses_refresh_hash UNIQUE (srt_token_sha256),
  CONSTRAINT ck_ses_refresh_expiry CHECK (srt_expires_at > srt_issued_at)
);
CREATE UNIQUE INDEX idx_ses_refresh_current ON session_core.tbl_ses_refresh_token (srt_session__ses_id) WHERE srt_used_at IS NULL;

CREATE TABLE authority.tbl_aut_permission (
  aup_path text NOT NULL,
  aup_module_id text NOT NULL,
  aup_value_kind text NOT NULL DEFAULT 'BOOLEAN',
  aup_all_default jsonb,
  CONSTRAINT pk_aut_permission PRIMARY KEY (aup_path),
  CONSTRAINT ck_aut_permission_kind CHECK (aup_value_kind IN ('BOOLEAN','INTEGER','STRING','STRING_LIST','CRUD'))
);
CREATE TABLE authority.tbl_aut_role (
  aur_id uuid NOT NULL,
  aur_tenant_id text NOT NULL,
  aur_name text NOT NULL,
  aur_privileges jsonb NOT NULL,
  aur_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_aut_role PRIMARY KEY (aur_id),
  CONSTRAINT uq_aut_role_name UNIQUE (aur_tenant_id, aur_name)
);
CREATE TABLE authority.tbl_aut_grant (
  aug_id uuid NOT NULL,
  aug_tenant_id text NOT NULL,
  aug_identity__idn_id uuid NOT NULL,
  aug_role__aur_id uuid,
  aug_privileges jsonb,
  aug_scope text,
  aug_valid_from timestamptz,
  aug_valid_until timestamptz,
  aug_recurring jsonb,
  aug_is_deny boolean NOT NULL DEFAULT false,
  aug_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_aut_grant PRIMARY KEY (aug_id),
  CONSTRAINT fk_aut_grant_identity FOREIGN KEY (aug_identity__idn_id) REFERENCES identity.tbl_idn_identity (idn_id),
  CONSTRAINT fk_aut_grant_role FOREIGN KEY (aug_role__aur_id) REFERENCES authority.tbl_aut_role (aur_id),
  CONSTRAINT ck_aut_grant_value CHECK (aug_role__aur_id IS NOT NULL OR aug_privileges IS NOT NULL),
  CONSTRAINT ck_aut_grant_window CHECK (aug_valid_until IS NULL OR aug_valid_from IS NULL OR aug_valid_until > aug_valid_from)
);
CREATE INDEX idx_aut_grant_subject ON authority.tbl_aut_grant (aug_tenant_id, aug_identity__idn_id);
CREATE TABLE authority.tbl_aut_resource_acl (
  ara_id uuid NOT NULL,
  ara_tenant_id text NOT NULL,
  ara_resource_type text NOT NULL,
  ara_resource_id text NOT NULL,
  ara_identity__idn_id uuid NOT NULL,
  ara_effect text NOT NULL,
  ara_permission text NOT NULL,
  CONSTRAINT pk_aut_resource_acl PRIMARY KEY (ara_id),
  CONSTRAINT fk_aut_acl_identity FOREIGN KEY (ara_identity__idn_id) REFERENCES identity.tbl_idn_identity (idn_id),
  CONSTRAINT ck_aut_acl_effect CHECK (ara_effect IN ('ALLOW','DENY')),
  CONSTRAINT uq_aut_resource_acl UNIQUE (ara_tenant_id, ara_resource_type, ara_resource_id, ara_identity__idn_id, ara_permission)
);
CREATE TABLE authority.tbl_aut_clearance (
  auc_identity__idn_id uuid NOT NULL,
  auc_tenant_id text NOT NULL,
  auc_level text NOT NULL,
  CONSTRAINT pk_aut_clearance PRIMARY KEY (auc_identity__idn_id, auc_tenant_id),
  CONSTRAINT fk_aut_clearance_identity FOREIGN KEY (auc_identity__idn_id) REFERENCES identity.tbl_idn_identity (idn_id),
  CONSTRAINT ck_aut_clearance_level CHECK (auc_level IN ('LOW','MEDIUM','HIGH','CRITICAL'))
);

GRANT USAGE ON SCHEMA identity, authentication, session_core, authority TO targoman_api;
GRANT SELECT, INSERT, UPDATE ON identity.tbl_idn_identity, identity.tbl_idn_membership,
  authentication.tbl_ath_password_credential, authentication.tbl_ath_login_guard,
  session_core.tbl_ses_session, session_core.tbl_ses_refresh_token TO targoman_api;
GRANT SELECT ON authority.tbl_aut_permission, authority.tbl_aut_role, authority.tbl_aut_grant,
  authority.tbl_aut_resource_acl, authority.tbl_aut_clearance TO targoman_api;

CREATE TRIGGER trg_idn_identity_mutation AFTER INSERT OR UPDATE OR DELETE ON identity.tbl_idn_identity
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('idn_id', 'idn_kind', 'idn_state');
CREATE TRIGGER trg_idn_membership_mutation AFTER INSERT OR UPDATE OR DELETE ON identity.tbl_idn_membership
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('idm_id', 'idm_tenant_id', 'idm_state', 'idm_authorization_version');
CREATE TRIGGER trg_ath_password_mutation AFTER INSERT OR UPDATE OR DELETE ON authentication.tbl_ath_password_credential
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('apc_identity__idn_id', 'apc_updated_at');
CREATE TRIGGER trg_ses_session_mutation AFTER INSERT OR UPDATE OR DELETE ON session_core.tbl_ses_session
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('ses_id', 'ses_tenant_id', 'ses_revoked_at', 'ses_revoke_reason');
CREATE TRIGGER trg_ses_refresh_mutation AFTER INSERT OR UPDATE OR DELETE ON session_core.tbl_ses_refresh_token
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('srt_id', 'srt_session__ses_id', 'srt_used_at');
