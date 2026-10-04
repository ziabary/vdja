CREATE TABLE authentication.tbl_ath_legacy_key_credential (
  alk_identity__idn_id uuid NOT NULL REFERENCES identity.tbl_idn_identity(idn_id),
  alk_legacy_md5 char(32) NOT NULL,
  alk_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_ath_legacy_key_credential PRIMARY KEY (alk_identity__idn_id),
  CONSTRAINT uq_ath_legacy_key_digest UNIQUE (alk_legacy_md5),
  CONSTRAINT ck_ath_legacy_key_digest CHECK (alk_legacy_md5 ~ '^[0-9a-f]{32}$')
);
CREATE TABLE authentication.tbl_ath_oidc_credential (
  aoc_id uuid NOT NULL,
  aoc_identity__idn_id uuid NOT NULL REFERENCES identity.tbl_idn_identity(idn_id),
  aoc_issuer text NOT NULL,
  aoc_subject text NOT NULL,
  aoc_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_ath_oidc_credential PRIMARY KEY (aoc_id),
  CONSTRAINT uq_ath_oidc_external UNIQUE (aoc_issuer,aoc_subject)
);
CREATE TABLE authentication.tbl_ath_oidc_flow (
  aof_state_sha256 char(64) NOT NULL,
  aof_code_verifier text NOT NULL,
  aof_nonce text NOT NULL,
  aof_return_path text NOT NULL,
  aof_expires_at timestamptz NOT NULL,
  aof_consumed_at timestamptz,
  CONSTRAINT pk_ath_oidc_flow PRIMARY KEY (aof_state_sha256)
);
GRANT SELECT, INSERT ON authentication.tbl_ath_legacy_key_credential,
  authentication.tbl_ath_oidc_credential TO targoman_api;
GRANT INSERT, SELECT, UPDATE ON authentication.tbl_ath_oidc_flow TO targoman_api;
CREATE TRIGGER trg_ath_legacy_key_mutation AFTER INSERT OR UPDATE OR DELETE ON authentication.tbl_ath_legacy_key_credential
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('alk_identity__idn_id','alk_created_at');
CREATE TRIGGER trg_ath_oidc_mutation AFTER INSERT OR UPDATE OR DELETE ON authentication.tbl_ath_oidc_credential
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('aoc_id','aoc_identity__idn_id');
CREATE TRIGGER trg_ath_oidc_flow_mutation AFTER INSERT OR UPDATE OR DELETE ON authentication.tbl_ath_oidc_flow
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('aof_expires_at','aof_consumed_at');
