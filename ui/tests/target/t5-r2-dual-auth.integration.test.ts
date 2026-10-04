import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {loadConfiguration} from '../../packages/configuration/src/index.js';
import {createTargetPool,withTargetTransaction} from '../../packages/persistence/src/target.js';
import {createAuthenticationPersistence} from '../../packages/authentication/src/persistence.js';
import {clsAuthenticationService} from '../../packages/authentication/src/service.js';
import {createSessionPersistence} from '../../packages/session/src/persistence.js';
import {loadAccessTokenKeys,verifyAccessToken} from '../../packages/session/src/access-token.js';

test('migrated key and issuer plus subject resolve one Identity and canonical Session',
  {skip:process.env.T5_R2_REQUIRE_LIVE!=='1',timeout:30000},async()=>{
    const root='.secrets.t3.local',snapshot=await loadConfiguration(`${root}/platform-rag.cjson`);
    assert.ok(snapshot.value.auth?.enabled);
    const auth=snapshot.value.auth;
    const migration=await createTargetPool(snapshot,'migration',root),api=await createTargetPool(snapshot,'api',root);
    const identityId=randomUUID(),membershipId=randomUUID(),oidcId=randomUUID();
    const rawKey=`r2-${randomUUID()}-legacy-key`,digest=createHash('md5').update(rawKey).digest('hex');
    const issuer='https://r2-test-idp.invalid',subject=randomUUID(),tenantId=snapshot.value.deployment.tenantId;
    const flowStates:string[]=[];
    const context={actorKind:'PLATFORM_SERVICE' as const,actorId:snapshot.value.worker.identityId!,correlationId:randomUUID(),source:'T5_R2_TEST'};
    try{
      await withTargetTransaction(migration,context,async tx=>{
        await tx.query(`INSERT INTO identity.tbl_idn_identity(idn_id,idn_kind,idn_display_name,idn_email_normalized)
          VALUES($1,'HUMAN','R2 fixture',$2)`,[identityId,`${identityId}@example.invalid`]);
        await tx.query(`INSERT INTO identity.tbl_idn_membership(idm_id,idm_identity__idn_id,idm_tenant_id)
          VALUES($1,$2,$3)`,[membershipId,identityId,tenantId]);
        await tx.query(`INSERT INTO authentication.tbl_ath_legacy_key_credential(alk_identity__idn_id,alk_legacy_md5)
          VALUES($1,$2)`,[identityId,digest]);
        await tx.query(`INSERT INTO authentication.tbl_ath_oidc_credential(aoc_id,aoc_identity__idn_id,aoc_issuer,aoc_subject)
          VALUES($1,$2,$3,$4)`,[oidcId,identityId,issuer,subject]);
      });
      const persistence=createAuthenticationPersistence(api);
      const address=`r2-test-${randomUUID()}`;
      assert.equal((await persistence.authenticateLegacyKey('short',address)).kind,'INVALID');
      assert.equal((await persistence.authenticateLegacyKey(`unknown-${randomUUID()}`,address)).kind,'INVALID');
      assert.equal((await persistence.authenticateLegacyKey(digest,address)).kind,'INVALID');
      const legacy=await persistence.authenticateLegacyKey(rawKey,address);
      const upgraded=await migration.query<{alk_sha256:string|null;alk_legacy_md5:string|null}>(
        `SELECT alk_sha256,alk_legacy_md5 FROM authentication.tbl_ath_legacy_key_credential WHERE alk_identity__idn_id=$1`,[identityId]);
      assert.equal(upgraded.rows[0]?.alk_sha256?.trim(),createHash('sha256').update(rawKey).digest('hex'));
      assert.equal(upgraded.rows[0]?.alk_legacy_md5,null);
      const oidc=await persistence.resolveOidcIdentity(issuer,subject);
      assert.equal(legacy.kind,'AUTHENTICATED');assert.equal(oidc.kind,'AUTHENTICATED');
      if(legacy.kind!=='AUTHENTICATED'||oidc.kind!=='AUTHENTICATED')throw new Error('LOGIN_FAILED');
      assert.equal(legacy.identityId,identityId);assert.equal(oidc.identityId,identityId);
      assert.deepEqual(legacy.memberships,oidc.memberships);
      const keys=await loadAccessTokenKeys(auth,root);
      const service=new clsAuthenticationService({...persistence,...createSessionPersistence(api,auth.session)},keys,
        {issuer:auth.issuer,audience:auth.audience,lifetimeSeconds:auth.accessTokenSeconds});
      const signed=await service.loginLegacyKey(rawKey,address);
      assert.equal(signed.kind,'SIGNED_IN');
      if(signed.kind!=='SIGNED_IN')throw new Error('SESSION_FAILED');
      assert.equal(signed.identityId,identityId);assert.equal(signed.tenantId,tenantId);
      assert.equal(verifyAccessToken(signed.accessToken,keys,{issuer:auth.issuer,audience:auth.audience,
        lifetimeSeconds:auth.accessTokenSeconds}).identityId,identityId);
      const claimsText=Buffer.from(signed.accessToken.split('.')[1]!,'base64url').toString('utf8');
      assert.ok(!claimsText.includes(digest)&&!claimsText.includes(rawKey));
      const fromOidc=await service.loginOidcIdentity(issuer,subject);
      assert.equal(fromOidc.kind,'SIGNED_IN');if(fromOidc.kind==='SIGNED_IN')assert.equal(fromOidc.identityId,identityId);
      const state=randomUUID().replaceAll('-','');
      flowStates.push(state);
      await persistence.startOidcFlow(state,'verifier','nonce','/knowledge');
      assert.deepEqual(await persistence.consumeOidcFlow(state),{verifier:'verifier',nonce:'nonce',returnPath:'/knowledge'});
      assert.equal(await persistence.consumeOidcFlow(state),null);
      const expired=randomUUID().replaceAll('-','');
      flowStates.push(expired);
      await persistence.startOidcFlow(expired,'verifier','nonce','/knowledge');
      await withTargetTransaction(migration,context,tx=>tx.query(`UPDATE authentication.tbl_ath_oidc_flow
        SET aof_expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second'
        WHERE aof_state_sha256=$1`,[createHash('sha256').update('oidc-state').update('\0').update(expired).digest('hex')]).then(()=>{}));
      assert.equal(await persistence.consumeOidcFlow(expired),null);
      await withTargetTransaction(migration,context,tx=>tx.query(`UPDATE identity.tbl_idn_membership SET idm_state='SUSPENDED'
        WHERE idm_id=$1`,[membershipId]).then(()=>{}));
      assert.equal((await persistence.authenticateLegacyKey(rawKey,address)).kind,'INVALID');
      await withTargetTransaction(migration,context,tx=>tx.query(`UPDATE identity.tbl_idn_membership SET idm_state='ACTIVE'
        WHERE idm_id=$1`,[membershipId]).then(()=>{}));
      await withTargetTransaction(migration,context,tx=>tx.query(`UPDATE identity.tbl_idn_identity SET idn_state='SUSPENDED'
        WHERE idn_id=$1`,[identityId]).then(()=>{}));
      assert.equal((await persistence.authenticateLegacyKey(rawKey,address)).kind,'INVALID');
      assert.equal((await persistence.resolveOidcIdentity(issuer,subject)).kind,'INVALID');
      const attackAddress=`r2-rate-${randomUUID()}`;
      for(let i=0;i<20;i++)assert.equal((await persistence.authenticateLegacyKey(`unknown-${randomUUID()}`,attackAddress)).kind,'INVALID');
      assert.equal((await persistence.authenticateLegacyKey(rawKey,attackAddress)).kind,'RATE_LIMITED');
      const audit=await migration.query<{leak:boolean}>(`SELECT EXISTS(SELECT 1 FROM audit.tbl_aud_mutation
        WHERE aud_record_id LIKE ANY($1::text[]) OR aud_before::text LIKE ANY($1::text[])
          OR aud_after::text LIKE ANY($1::text[])) AS leak`,[[`%${rawKey}%`,`%${digest}%`,`%${upgraded.rows[0]?.alk_sha256?.trim()}%`]]);
      assert.equal(audit.rows[0]?.leak,false);
    }finally{
      await withTargetTransaction(migration,context,async tx=>{
        for(const state of flowStates)await tx.query('DELETE FROM authentication.tbl_ath_oidc_flow WHERE aof_state_sha256=$1',
          [createHash('sha256').update('oidc-state').update('\0').update(state).digest('hex')]);
        await tx.query(`DELETE FROM session_core.tbl_ses_refresh_token WHERE srt_session__ses_id IN
          (SELECT ses_id FROM session_core.tbl_ses_session WHERE ses_identity__idn_id=$1)`,[identityId]);
        await tx.query(`DELETE FROM session_core.tbl_ses_session WHERE ses_identity__idn_id=$1`,[identityId]);
        await tx.query(`DELETE FROM authentication.tbl_ath_oidc_credential WHERE aoc_identity__idn_id=$1`,[identityId]);
        await tx.query(`DELETE FROM authentication.tbl_ath_legacy_key_credential WHERE alk_identity__idn_id=$1`,[identityId]);
        await tx.query(`DELETE FROM identity.tbl_idn_membership WHERE idm_identity__idn_id=$1`,[identityId]);
        await tx.query(`DELETE FROM identity.tbl_idn_identity WHERE idn_id=$1`,[identityId]);
      });
      await api.end();await migration.end();
    }
  });
