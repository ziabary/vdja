ALTER TABLE ai_router.tbl_air_run ADD COLUMN air_session_id text;
ALTER TABLE ai_router.tbl_air_run ADD COLUMN air_authorization_version bigint;
ALTER TABLE ai_router.tbl_air_run ADD COLUMN air_source text;
ALTER TABLE audit.tbl_aud_semantic_event ALTER COLUMN ase_source SET DEFAULT NULLIF(current_setting('app.source',true),'');
ALTER TABLE audit.tbl_aud_semantic_event ALTER COLUMN ase_initiator_actor_kind SET DEFAULT NULLIF(current_setting('app.actor_kind',true),'');
ALTER TABLE audit.tbl_aud_semantic_event ALTER COLUMN ase_initiator_actor_id SET DEFAULT NULLIF(current_setting('app.actor_id',true),'');
