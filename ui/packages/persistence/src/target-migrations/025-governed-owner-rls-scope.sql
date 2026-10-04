-- FORCE RLS also applies to the table owner in SECURITY DEFINER routines.
-- Published owner routines must see only their explicit execution scope.
CREATE POLICY gov_retention_owner_scope ON data_governance.tbl_gov_retention TO targoman_migration
 USING(grt_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND grt_tenant_id=NULLIF(current_setting('app.tenant_id',true),''))
 WITH CHECK(grt_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND grt_tenant_id=NULLIF(current_setting('app.tenant_id',true),''));
CREATE POLICY knw_space_owner_scope ON knowledge.tbl_knw_space TO targoman_migration
 USING(ksp_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND ksp_tenant_id=NULLIF(current_setting('app.tenant_id',true),''))
 WITH CHECK(ksp_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND ksp_tenant_id=NULLIF(current_setting('app.tenant_id',true),''));
CREATE POLICY knw_generation_owner_scope ON knowledge.tbl_knw_generation TO targoman_migration
 USING(kgn_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kgn_tenant_id=NULLIF(current_setting('app.tenant_id',true),''))
 WITH CHECK(kgn_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kgn_tenant_id=NULLIF(current_setting('app.tenant_id',true),''));
CREATE POLICY knw_membership_owner_scope ON knowledge.tbl_knw_membership TO targoman_migration
 USING(kmb_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kmb_tenant_id=NULLIF(current_setting('app.tenant_id',true),''))
 WITH CHECK(kmb_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kmb_tenant_id=NULLIF(current_setting('app.tenant_id',true),''));
CREATE POLICY knw_chunk_owner_scope ON knowledge.tbl_knw_chunk TO targoman_migration
 USING(kch_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kch_tenant_id=NULLIF(current_setting('app.tenant_id',true),''))
 WITH CHECK(kch_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kch_tenant_id=NULLIF(current_setting('app.tenant_id',true),''));
CREATE POLICY knw_projection_owner_scope ON knowledge.tbl_knw_projection TO targoman_migration
 USING(kpr_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kpr_tenant_id=NULLIF(current_setting('app.tenant_id',true),''))
 WITH CHECK(kpr_deployment_id=NULLIF(current_setting('app.deployment_id',true),'') AND kpr_tenant_id=NULLIF(current_setting('app.tenant_id',true),''));
