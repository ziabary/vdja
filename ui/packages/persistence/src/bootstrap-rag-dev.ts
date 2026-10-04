import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { loadConfiguration } from '../../configuration/src/index.js';
import { hashPassword } from '../../authentication/src/index.js';
import { createTargetPool, withTargetTransaction } from './target.js';

const secretRoot=resolve('.secrets.t3.local');
const snapshot=await loadConfiguration(join(secretRoot,'platform-rag.cjson'));
if(snapshot.value.deployment.id!=='development'||!snapshot.value.auth?.enabled)throw new Error('DEVELOPMENT_AUTH_CONFIG_REQUIRED');
async function localId(name:string):Promise<string>{
  const path=join(secretRoot,name);
  try{return(await readFile(path,'utf8')).trim();}catch{const id=randomUUID();await writeFile(path,id,{mode:0o600});return id;}
}
const identityId=await localId('rag-human-id'),membershipId=await localId('rag-human-membership-id');
const grantId=await localId('rag-human-grant-id'),clearanceId=identityId;
const workerId=snapshot.value.worker.identityId;
if(!workerId)throw new Error('DEVELOPMENT_WORKER_IDENTITY_REQUIRED');
const workerMembershipId=await localId('rag-worker-membership-id');
const workerGrantId=await localId('rag-worker-grant-id');
const onboardingRoleId=(await readFile(join(secretRoot,'rag-onboarding-role-id'),'utf8')).trim();
const args=process.argv;
const option=(name:string)=>{const at=args.indexOf(name);return at<0?undefined:args[at+1];};
const keyFile=option('--legacy-key-file'),digestFile=option('--legacy-md5-file'),passwordFile=option('--password-file'),oidcMapFile=option('--oidc-map-file');
if(keyFile&&digestFile)throw new Error('CHOOSE_ONE_LEGACY_KEY_SOURCE');
const rawKey=keyFile?(await readFile(keyFile,'utf8')).trimEnd():undefined;
if(rawKey&&(rawKey.length<16||rawKey.length>256||rawKey.includes('\0')))throw new Error('INVALID_LEGACY_KEY');
const digest=rawKey?createHash('sha256').update(rawKey,'utf8').digest('hex'):undefined;
const legacyDigest=rawKey?createHash('md5').update(rawKey,'utf8').digest('hex'):
  digestFile?(await readFile(digestFile,'utf8')).trim().toLowerCase():undefined;
if(legacyDigest&&!/^[a-f0-9]{32}$/.test(legacyDigest))throw new Error('INVALID_LEGACY_DIGEST');
const password=passwordFile?(await readFile(passwordFile,'utf8')).trimEnd():undefined;
const passwordHash=password?await hashPassword(password):undefined;
const oidcMap=oidcMapFile?JSON.parse(await readFile(oidcMapFile,'utf8')) as unknown:undefined;
if(oidcMap&&(!oidcMap||typeof oidcMap!=='object'||Array.isArray(oidcMap)||
  typeof (oidcMap as Record<string,unknown>).issuer!=='string'||typeof (oidcMap as Record<string,unknown>).subject!=='string'))throw new Error('INVALID_OIDC_MAP');
const map=oidcMap as {issuer:string;subject:string}|undefined;
if(map&&(!map.issuer.startsWith('https://')||!map.subject||map.subject.length>512))throw new Error('INVALID_OIDC_MAP');
const pool=await createTargetPool(snapshot,'migration',secretRoot);
try{
  const context={actorKind:'PLATFORM_SERVICE' as const,actorId:workerId,correlationId:randomUUID(),source:'DEVELOPMENT_RAG_BOOTSTRAP'};
  await withTargetTransaction(pool,context,async tx=>{
    const tenant=snapshot.value.deployment.tenantId;
    await tx.query(`INSERT INTO identity.tbl_idn_identity(idn_id,idn_kind,idn_display_name,idn_email_normalized)
      VALUES($1,'HUMAN','Development RAG User','developer@development.invalid') ON CONFLICT(idn_id) DO NOTHING`,[identityId]);
    await tx.query(`INSERT INTO identity.tbl_idn_membership(idm_id,idm_identity__idn_id,idm_tenant_id)
      VALUES($1,$2,$3) ON CONFLICT(idm_id) DO NOTHING`,[membershipId,identityId,tenant]);
    const privileges={Knowledge:{Documents:{discover:true,read:true,download:true,use:true,quote:true,manage:true},
      Spaces:{discover:true,manage:true},query:true}};
    await tx.query(`INSERT INTO authority.tbl_aut_role(aur_id,aur_tenant_id,aur_name,aur_privileges)
      VALUES($1,$2,'development-rag-onboarding',$3::jsonb) ON CONFLICT(aur_id) DO NOTHING`,
      [onboardingRoleId,tenant,JSON.stringify(privileges)]);
    await tx.query(`INSERT INTO authority.tbl_aut_grant(aug_id,aug_tenant_id,aug_identity__idn_id,aug_privileges)
      VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(aug_id) DO NOTHING`,[grantId,tenant,identityId,JSON.stringify(privileges)]);
    await tx.query(`INSERT INTO authority.tbl_aut_clearance(auc_identity__idn_id,auc_tenant_id,auc_level)
      VALUES($1,$2,'LOW') ON CONFLICT(auc_identity__idn_id,auc_tenant_id) DO NOTHING`,[clearanceId,tenant]);
    await tx.query(`INSERT INTO identity.tbl_idn_identity(idn_id,idn_kind,idn_display_name)
      VALUES($1,'PLATFORM_SERVICE','Development RAG Worker') ON CONFLICT(idn_id) DO NOTHING`,[workerId]);
    await tx.query(`INSERT INTO identity.tbl_idn_membership(idm_id,idm_identity__idn_id,idm_tenant_id)
      VALUES($1,$2,$3) ON CONFLICT(idm_id) DO NOTHING`,[workerMembershipId,workerId,tenant]);
    await tx.query(`INSERT INTO authority.tbl_aut_grant(aug_id,aug_tenant_id,aug_identity__idn_id,aug_privileges)
      VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(aug_id) DO NOTHING`,[workerGrantId,tenant,workerId,JSON.stringify({Files:{Transfers:{expire:true}}})]);
    if(digest||legacyDigest){
      if(digest)await tx.query(`INSERT INTO authentication.tbl_ath_legacy_key_credential(alk_identity__idn_id,alk_sha256)
        VALUES($1,$2) ON CONFLICT(alk_identity__idn_id) DO NOTHING`,[identityId,digest]);
      else await tx.query(`INSERT INTO authentication.tbl_ath_legacy_key_credential(alk_identity__idn_id,alk_legacy_md5)
        VALUES($1,$2) ON CONFLICT(alk_identity__idn_id) DO NOTHING`,[identityId,legacyDigest]);
      const existing=await tx.query<{alk_legacy_md5:string|null;alk_sha256:string|null}>(`SELECT alk_legacy_md5,alk_sha256 FROM authentication.tbl_ath_legacy_key_credential
        WHERE alk_identity__idn_id=$1`,[identityId]);
      if(digest&&existing.rows[0]?.alk_legacy_md5?.trim()===legacyDigest)await tx.query(`UPDATE authentication.tbl_ath_legacy_key_credential
        SET alk_legacy_md5=NULL,alk_sha256=$2 WHERE alk_identity__idn_id=$1`,[identityId,digest]);
      else if(existing.rows[0]?.alk_sha256?.trim()!==digest&&existing.rows[0]?.alk_legacy_md5?.trim()!==legacyDigest)
        throw new Error('LEGACY_KEY_ALREADY_BOUND');
    }
    if(passwordHash)await tx.query(`INSERT INTO authentication.tbl_ath_password_credential(apc_identity__idn_id,apc_password_hash)
      VALUES($1,$2) ON CONFLICT(apc_identity__idn_id) DO NOTHING`,[identityId,passwordHash]);
    if(map)await tx.query(`INSERT INTO authentication.tbl_ath_oidc_credential(aoc_id,aoc_identity__idn_id,aoc_issuer,aoc_subject)
      VALUES($1,$2,$3,$4) ON CONFLICT(aoc_issuer,aoc_subject) DO NOTHING`,[randomUUID(),identityId,map.issuer,map.subject]);
  });
  console.log(JSON.stringify({status:'READY',identityId,tenantId:snapshot.value.deployment.tenantId,
    legacyKey:digest||legacyDigest?'CONFIGURED':'NOT_CONFIGURED',
    developmentPassword:passwordHash?'CONFIGURED':'UNCHANGED',oidcMapping:map?'CONFIGURED':'UNCHANGED'}));
}finally{await pool.end();}
