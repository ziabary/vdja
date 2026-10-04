import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {test} from 'node:test';
import {loadConfiguration} from '../../packages/configuration/src/index.js';
import {createTargetPool,withTargetTransaction} from '../../packages/persistence/src/target.js';
import {authenticateLegacyKey} from '../../packages/authentication/src/persistence.js';

test('development legacy self-provision uses only the explicit Authority role and a durable address cap',
  {skip:process.env.T5_R2_REQUIRE_LIVE!=='1',timeout:30000},async()=>{
    const root='.secrets.t3.local',snapshot=await loadConfiguration(`${root}/platform-rag.cjson`);
    assert.ok(snapshot.value.auth?.enabled);
    const configured=snapshot.value.auth.methods?.legacyKey;
    assert.ok(configured?.onboardingRoleId);
    const policy={enabled:true,selfProvision:true,onboardingTenantId:'development',onboardingRoleId:configured.onboardingRoleId};
    const api=await createTargetPool(snapshot,'api',root),migration=await createTargetPool(snapshot,'migration',root);
    const created:string[]=[],address=`r2-provision-${randomUUID()}`;
    try{
      const outside=await authenticateLegacyKey(api,randomBytes(24).toString('base64url'),address,policy,'customer');
      assert.equal(outside.kind,'INVALID');
      assert.equal((await authenticateLegacyKey(api,'a'.repeat(16),address,policy,'development')).kind,'INVALID');
      const concurrentKey=randomBytes(24).toString('base64url');
      const concurrent=await Promise.all([
        authenticateLegacyKey(api,concurrentKey,address,policy,'development'),
        authenticateLegacyKey(api,concurrentKey,address,policy,'development')]);
      assert.equal(concurrent[0].kind,'AUTHENTICATED');
      assert.equal(concurrent[1].kind,'AUTHENTICATED');
      if(concurrent[0].kind==='AUTHENTICATED'&&concurrent[1].kind==='AUTHENTICATED'){
        assert.equal(concurrent[0].identityId,concurrent[1].identityId);
        assert.equal(concurrent.filter(item=>item.kind==='AUTHENTICATED'&&item.provisioned===true).length,1);
        created.push(concurrent[0].identityId);
      }
      for(let count=0;count<4;count++){
        const rawKey=randomBytes(24).toString('base64url');
        const result=await authenticateLegacyKey(api,rawKey,address,policy,'development');
        assert.equal(result.kind,'AUTHENTICATED');
        if(result.kind==='AUTHENTICATED'){
          assert.equal(result.provisioned,true);created.push(result.identityId);
          const credential=await migration.query<{alk_sha256:string|null;alk_legacy_md5:string|null}>(
            `SELECT alk_sha256,alk_legacy_md5 FROM authentication.tbl_ath_legacy_key_credential WHERE alk_identity__idn_id=$1`,[result.identityId]);
          assert.equal(credential.rows[0]?.alk_sha256?.trim(),createHash('sha256').update(rawKey).digest('hex'));
          assert.equal(credential.rows[0]?.alk_legacy_md5,null);
          assert.ok(!JSON.stringify(credential.rows[0]).includes(rawKey));
        }
      }
      assert.equal((await authenticateLegacyKey(api,randomBytes(24).toString('base64url'),address,policy,'development')).kind,'RATE_LIMITED');
      const grants=await migration.query<{aug_identity__idn_id:string;aur_name:string;aur_privileges:unknown}>(
        `SELECT g.aug_identity__idn_id,r.aur_name,r.aur_privileges FROM authority.tbl_aut_grant g
         JOIN authority.tbl_aut_role r ON r.aur_id=g.aug_role__aur_id WHERE g.aug_identity__idn_id=ANY($1::uuid[])`,[created]);
      assert.equal(grants.rows.length,5);
      for(const row of grants.rows){assert.equal(row.aur_name,'development-rag-onboarding');assert.ok(!JSON.stringify(row.aur_privileges).includes('ALL'));}
    }finally{
      if(created.length)await withTargetTransaction(migration,{actorKind:'PLATFORM_SERVICE',actorId:snapshot.value.worker.identityId!,
        correlationId:randomUUID(),source:'T5_R2_TEST_CLEANUP'},async tx=>{
        await tx.query('DELETE FROM authority.tbl_aut_grant WHERE aug_identity__idn_id=ANY($1::uuid[])',[created]);
        await tx.query('DELETE FROM authentication.tbl_ath_legacy_key_credential WHERE alk_identity__idn_id=ANY($1::uuid[])',[created]);
        await tx.query('DELETE FROM identity.tbl_idn_membership WHERE idm_identity__idn_id=ANY($1::uuid[])',[created]);
        await tx.query('DELETE FROM identity.tbl_idn_identity WHERE idn_id=ANY($1::uuid[])',[created]);
      });
      await api.end();await migration.end();
    }
  });
