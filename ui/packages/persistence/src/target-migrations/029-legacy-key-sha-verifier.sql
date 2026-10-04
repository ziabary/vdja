-- Existing imported credentials retain MD5 until the owner presents the raw key.
-- New credentials use only a SHA-256 verifier; neither form stores the raw key.
ALTER TABLE authentication.tbl_ath_legacy_key_credential
  ALTER COLUMN alk_legacy_md5 DROP NOT NULL,
  ADD COLUMN alk_sha256 char(64),
  ADD CONSTRAINT uq_ath_legacy_key_sha256 UNIQUE (alk_sha256),
  ADD CONSTRAINT ck_ath_legacy_key_sha256 CHECK (alk_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT ck_ath_legacy_key_one_verifier CHECK
    ((alk_legacy_md5 IS NOT NULL AND alk_sha256 IS NULL)
      OR (alk_legacy_md5 IS NULL AND alk_sha256 IS NOT NULL));

GRANT UPDATE (alk_legacy_md5, alk_sha256)
  ON authentication.tbl_ath_legacy_key_credential TO targoman_api;
