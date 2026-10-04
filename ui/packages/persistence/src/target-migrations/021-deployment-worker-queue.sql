-- Infrastructure queue visibility is deployment-scoped. Business tables retain tenant RLS.
-- An active registered machine in its bootstrap tenant may inspect/claim queue metadata,
-- never Document content or another tenant's authorization grants.
CREATE POLICY job_deployment_worker_queue ON jobs.tbl_job_work TO targoman_worker
USING (
 job_deployment_id = NULLIF(current_setting('app.deployment_id',true),'')
 AND current_setting('app.actor_kind',true) = 'PLATFORM_SERVICE'
 AND EXISTS (SELECT 1 FROM identity.tbl_idn_identity JOIN identity.tbl_idn_membership
   ON idn_id=idm_identity__idn_id
   WHERE idn_id::text=current_setting('app.actor_id',true)
    AND idn_kind='PLATFORM_SERVICE' AND idn_state='ACTIVE'
    AND idm_tenant_id=current_setting('app.tenant_id',true) AND idm_state='ACTIVE')
)
WITH CHECK (
 job_deployment_id = NULLIF(current_setting('app.deployment_id',true),'')
 AND current_setting('app.actor_kind',true) = 'PLATFORM_SERVICE'
 AND EXISTS (SELECT 1 FROM identity.tbl_idn_identity JOIN identity.tbl_idn_membership
   ON idn_id=idm_identity__idn_id
   WHERE idn_id::text=current_setting('app.actor_id',true)
    AND idn_kind='PLATFORM_SERVICE' AND idn_state='ACTIVE'
    AND idm_tenant_id=current_setting('app.tenant_id',true) AND idm_state='ACTIVE')
);
CREATE INDEX idx_job_deployment_claim ON jobs.tbl_job_work(job_deployment_id,job_available_at,job_created_at)
WHERE job_state IN ('PENDING','RUNNING');
