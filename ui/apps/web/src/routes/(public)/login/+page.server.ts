import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { deploymentSnapshot } from '#lib/server/deployment.js';

export const load: PageServerLoad = async () => {
  const snapshot = await deploymentSnapshot();
  if (!snapshot.value.auth?.enabled) error(404, 'Not found');
  return { brandName: snapshot.value.brand.displayName };
};
