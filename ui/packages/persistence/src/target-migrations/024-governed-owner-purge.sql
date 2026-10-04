-- Published factual Governance persistence contract. This is not an Authority engine.
CREATE FUNCTION data_governance.fn_gov_assert_purge(i_deployment text,i_tenant text,i_resource uuid,i_lease uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_deployment text := NULLIF(current_setting('app.deployment_id',true),''); v_tenant text := NULLIF(current_setting('app.tenant_id',true),'');
BEGIN
 IF i_deployment IS DISTINCT FROM v_deployment OR i_tenant IS DISTINCT FROM v_tenant THEN RAISE EXCEPTION 'RETENTION_DENIED'; END IF;
 PERFORM grt_resource_id FROM data_governance.tbl_gov_retention WHERE grt_deployment_id=i_deployment AND grt_tenant_id=i_tenant AND grt_resource_id=i_resource AND grt_state='PURGING' AND grt_lease_token=i_lease AND grt_lease_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PURGE_LEASE_LOST'; END IF;
END $$;
REVOKE ALL ON FUNCTION data_governance.fn_gov_assert_purge(text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION data_governance.fn_gov_assert_purge(text,text,uuid,uuid) TO targoman_worker;
CREATE FUNCTION documents.fn_doc_purge_content(i_deployment text,i_tenant text,i_document uuid,i_lease uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM data_governance.fn_gov_assert_purge(i_deployment,i_tenant,i_document,i_lease);
 PERFORM doc_id FROM documents.tbl_doc_document WHERE doc_deployment_id=i_deployment AND doc_tenant_id=i_tenant AND doc_id=i_document AND doc_lifecycle='RETIRED' AND doc_business_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'RETENTION_NOT_ELIGIBLE'; END IF;
 UPDATE documents.tbl_doc_document SET doc_current_version_id=NULL,doc_title='PURGED',doc_security_version=doc_security_version+1 WHERE doc_deployment_id=i_deployment AND doc_tenant_id=i_tenant AND doc_id=i_document;
 DELETE FROM documents.tbl_doc_asset WHERE ast_deployment_id=i_deployment AND ast_tenant_id=i_tenant AND ast_document__doc_id=i_document;
 DELETE FROM documents.tbl_doc_version WHERE dvr_deployment_id=i_deployment AND dvr_tenant_id=i_tenant AND dvr_document__doc_id=i_document;
END $$;
REVOKE ALL ON FUNCTION documents.fn_doc_purge_content(text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION documents.fn_doc_purge_content(text,text,uuid,uuid) TO targoman_worker;
CREATE FUNCTION file_management.fn_fil_purge_metadata(i_deployment text,i_tenant text,i_document uuid,i_lease uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM data_governance.fn_gov_assert_purge(i_deployment,i_tenant,i_document,i_lease);
 DELETE FROM file_management.tbl_fil_part WHERE fpt_deployment_id=i_deployment AND fpt_tenant_id=i_tenant AND fpt_transfer__ftr_id IN (SELECT ftr_id FROM file_management.tbl_fil_transfer WHERE ftr_deployment_id=i_deployment AND ftr_tenant_id=i_tenant AND ftr_document__doc_id=i_document);
 DELETE FROM file_management.tbl_fil_transfer WHERE ftr_deployment_id=i_deployment AND ftr_tenant_id=i_tenant AND ftr_document__doc_id=i_document;
END $$;
REVOKE ALL ON FUNCTION file_management.fn_fil_purge_metadata(text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION file_management.fn_fil_purge_metadata(text,text,uuid,uuid) TO targoman_worker;
CREATE FUNCTION knowledge.fn_knw_purge_document(i_deployment text,i_tenant text,i_document uuid,i_lease uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM data_governance.fn_gov_assert_purge(i_deployment,i_tenant,i_document,i_lease);
 IF EXISTS (SELECT 1 FROM knowledge.tbl_knw_membership JOIN knowledge.tbl_knw_space ON kmb_deployment_id=ksp_deployment_id AND kmb_tenant_id=ksp_tenant_id AND kmb_space__ksp_id=ksp_id WHERE kmb_deployment_id=i_deployment AND kmb_tenant_id=i_tenant AND kmb_document_id=i_document AND ksp_lifecycle='ACTIVE') THEN RAISE EXCEPTION 'RETAINED_REFERENCE'; END IF;
 DELETE FROM knowledge.tbl_knw_chunk WHERE kch_deployment_id=i_deployment AND kch_tenant_id=i_tenant AND kch_document_id=i_document;
 DELETE FROM knowledge.tbl_knw_membership WHERE kmb_deployment_id=i_deployment AND kmb_tenant_id=i_tenant AND kmb_document_id=i_document;
END $$;
REVOKE ALL ON FUNCTION knowledge.fn_knw_purge_document(text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION knowledge.fn_knw_purge_document(text,text,uuid,uuid) TO targoman_worker;
