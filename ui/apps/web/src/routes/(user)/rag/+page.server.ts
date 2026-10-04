import {error} from '@sveltejs/kit';
import type {PageServerLoad} from './$types';
import {deploymentSnapshot} from '#lib/server/deployment.js';
export const load:PageServerLoad=async()=>{const snapshot=await deploymentSnapshot();
  if(!snapshot.value.knowledge?.enabled||!snapshot.value.auth?.enabled)error(404,'Not found');
  return{modelConfigured:!!snapshot.value.ai.protected&&!!snapshot.value.dataGovernance,
    brandName:snapshot.value.brand.displayName,brandLogo:snapshot.value.brand.logo,
    maxUploadBytes:snapshot.value.fileManagement?.enabled?snapshot.value.fileManagement.uploads.maxBytes:0};
};
