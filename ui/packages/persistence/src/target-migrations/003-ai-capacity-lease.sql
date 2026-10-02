ALTER TABLE ai_router.tbl_air_run ADD COLUMN air_capacity_expires_at timestamptz;
CREATE INDEX idx_air_run_capacity ON ai_router.tbl_air_run (air_endpoint_id, air_capacity_expires_at)
WHERE air_status = 'RUNNING';
