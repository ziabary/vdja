import type {typTargetClient} from '../../persistence/src/target.js';

/** Authority owns the only development onboarding role assignment entry point. */
export async function assignDevelopmentOnboardingRole(tx:typTargetClient,identityId:string,tenantId:string,roleId:string):Promise<void>{
  await tx.query('SELECT authority.fn_aut_assign_dev_onboarding_role($1::uuid,$2::text,$3::uuid)',
    [identityId,tenantId,roleId]);
}
