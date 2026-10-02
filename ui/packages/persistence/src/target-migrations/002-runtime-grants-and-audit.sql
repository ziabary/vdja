GRANT SELECT ON usage.tbl_usg_consumption TO targoman_api;

CREATE TRIGGER trg_aud_semantic_event_mutation AFTER INSERT OR UPDATE OR DELETE ON audit.tbl_aud_semantic_event
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('ase_id', 'ase_deployment_id', 'ase_tenant_id', 'ase_module_id', 'ase_action', 'ase_result');
CREATE TRIGGER trg_usg_consumption_mutation AFTER INSERT OR UPDATE OR DELETE ON usage.tbl_usg_consumption
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('usg_id', 'usg_run_id', 'usg_module_id', 'usg_input_tokens', 'usg_output_tokens');
CREATE TRIGGER trg_adm_reservation_mutation AFTER INSERT OR UPDATE OR DELETE ON admission.tbl_adm_reservation
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('adr_id', 'adr_module_id', 'adr_state', 'adr_reserved_tokens');
CREATE TRIGGER trg_air_run_mutation AFTER INSERT OR UPDATE OR DELETE ON ai_router.tbl_air_run
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('air_id', 'air_task', 'air_status', 'air_endpoint_id', 'air_error_class');
CREATE TRIGGER trg_air_attempt_mutation AFTER INSERT OR UPDATE OR DELETE ON ai_router.tbl_air_attempt
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('aia_id', 'aia_run__air_id', 'aia_endpoint_id', 'aia_status', 'aia_error_class');
CREATE TRIGGER trg_tel_export_mutation AFTER INSERT OR UPDATE OR DELETE ON telemetry.tbl_tel_export
FOR EACH ROW EXECUTE FUNCTION audit.fn_aud_capture_safe('tex_id', 'tex_destination_id', 'tex_status', 'tex_attempt_count', 'tex_last_error_class');
