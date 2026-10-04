CREATE TABLE usage.tbl_usg_rag_consumption (
  urc_operation_id uuid NOT NULL,urc_deployment_id text NOT NULL,urc_tenant_id text NOT NULL,
  urc_actor_kind text NOT NULL,urc_actor_id text,urc_session_id text,urc_request_id text NOT NULL,
  urc_correlation_id text NOT NULL,urc_module_id text NOT NULL,urc_meter_version integer NOT NULL DEFAULT 1,
  urc_queries bigint NOT NULL,urc_documents_processed bigint NOT NULL,urc_embedding_items bigint NOT NULL,
  urc_retrieval_candidates bigint NOT NULL,urc_authorized_chunks bigint NOT NULL,urc_rerank_items bigint NOT NULL,
  urc_generation_calls bigint NOT NULL,urc_indexed_chunks bigint NOT NULL,urc_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_usg_rag_consumption PRIMARY KEY (urc_deployment_id,urc_tenant_id,urc_operation_id),
  CONSTRAINT ck_usg_rag_consumption_version CHECK (urc_meter_version=1),
  CONSTRAINT ck_usg_rag_consumption_counts CHECK (urc_queries>=0 AND urc_documents_processed>=0 AND urc_embedding_items>=0
    AND urc_retrieval_candidates>=0 AND urc_authorized_chunks>=0 AND urc_rerank_items>=0 AND urc_generation_calls>=0 AND urc_indexed_chunks>=0)
);
ALTER TABLE usage.tbl_usg_rag_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage.tbl_usg_rag_consumption FORCE ROW LEVEL SECURITY;
CREATE POLICY usg_rag_consumption_scope ON usage.tbl_usg_rag_consumption TO targoman_api,targoman_worker
  USING (urc_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND urc_tenant_id=NULLIF(current_setting('app.tenant_id',true),''))
  WITH CHECK (urc_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND urc_tenant_id=NULLIF(current_setting('app.tenant_id',true),''));
GRANT SELECT,INSERT ON usage.tbl_usg_rag_consumption TO targoman_api,targoman_worker;
CREATE TRIGGER trg_usg_rag_consumption_mutation AFTER INSERT OR UPDATE OR DELETE ON usage.tbl_usg_rag_consumption
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('urc_operation_id','urc_deployment_id','urc_tenant_id','urc_module_id','urc_meter_version',
  'urc_queries','urc_documents_processed','urc_embedding_items','urc_retrieval_candidates','urc_authorized_chunks','urc_rerank_items','urc_generation_calls','urc_indexed_chunks');
