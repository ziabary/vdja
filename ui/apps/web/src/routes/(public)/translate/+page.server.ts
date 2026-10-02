import {error} from '@sveltejs/kit';
import type {PageServerLoad} from './$types';
export const load:PageServerLoad=async ({parent})=>{if(!(await parent()).publicModules.includes('translator'))error(404,'Module disabled');};
