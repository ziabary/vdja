CREATE SCHEMA t2_fixture AUTHORIZATION t2_migration;
GRANT USAGE ON SCHEMA t2_fixture TO t2_runtime;
CREATE TABLE t2_fixture.tbl_t2f_parent (
  par_id bigint GENERATED ALWAYS AS IDENTITY,
  par_name text NOT NULL,
  CONSTRAINT pk_t2f_parent PRIMARY KEY (par_id),
  CONSTRAINT uq_t2f_parent_name UNIQUE (par_name)
);
CREATE TABLE t2_fixture.tbl_t2f_item (
  itm_id bigint GENERATED ALWAYS AS IDENTITY,
  itm_parent__par_id bigint NOT NULL,
  itm_code text NOT NULL,
  itm_quantity integer NOT NULL,
  itm_deleted_at timestamptz,
  CONSTRAINT pk_t2f_item PRIMARY KEY (itm_id),
  CONSTRAINT fk_t2f_item_parent__par_id FOREIGN KEY (itm_parent__par_id) REFERENCES t2_fixture.tbl_t2f_parent (par_id),
  CONSTRAINT uq_t2f_item_code UNIQUE (itm_code),
  CONSTRAINT ck_t2f_item_quantity CHECK (itm_quantity > 0)
);
CREATE INDEX idx_t2f_item_parent ON t2_fixture.tbl_t2f_item (itm_parent__par_id);
ALTER SEQUENCE t2_fixture.tbl_t2f_parent_par_id_seq RENAME TO seq_t2f_parent;
ALTER SEQUENCE t2_fixture.tbl_t2f_item_itm_id_seq RENAME TO seq_t2f_item;
CREATE TRIGGER trg_t2f_item_audit AFTER INSERT OR UPDATE OR DELETE ON t2_fixture.tbl_t2f_item
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture('itm_id', 'itm_deleted_at');
GRANT SELECT, INSERT, UPDATE ON t2_fixture.tbl_t2f_parent, t2_fixture.tbl_t2f_item TO t2_runtime;
GRANT USAGE ON SEQUENCE t2_fixture.seq_t2f_parent, t2_fixture.seq_t2f_item TO t2_runtime;
