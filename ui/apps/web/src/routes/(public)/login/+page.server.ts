import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { deploymentSnapshot } from '#lib/server/deployment.js';

export const load: PageServerLoad = async ({url}) => {
  const snapshot = await deploymentSnapshot();
  if (!snapshot.value.auth?.enabled) error(404, 'Not found');
  const methods=snapshot.value.auth.methods;
  const returnTo=url.searchParams.get('returnTo')??(url.searchParams.get('back')==='rag'?'/rag':null);
  return { brandName: snapshot.value.brand.displayName,brandLogo:snapshot.value.brand.logoLight??snapshot.value.brand.logo,authOrigin:snapshot.value.auth.publicOrigin,
    returnTo:typeof returnTo==='string'&&/^\/[a-z0-9/_-]*$/iu.test(returnTo)&&!returnTo.startsWith('//')?returnTo:'/rag',
    methods:{organizationalOidc:methods?.organizationalOidc.enabled===true,legacyKey:methods?.legacyKey.enabled===true,
      legacyKeySelfProvision:methods?.legacyKey.enabled===true&&methods.legacyKey.selfProvision===true,
      developmentPassword:methods?.developmentPassword??snapshot.value.security.assuranceProfile==='DEVELOPMENT_PASSWORD'} };
};
