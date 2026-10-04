import {error} from '@sveltejs/kit';
import type {PageServerLoad} from './$types';
import {deploymentSnapshot} from '#lib/server/deployment.js';
export const load:PageServerLoad=async()=>{const snapshot=await deploymentSnapshot();if(!snapshot.value.knowledge?.enabled)error(404,'Not found');return{modelConfigured:!!snapshot.value.ai.protected&&!!snapshot.value.dataGovernance};};
