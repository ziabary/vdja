import {redirect} from '@sveltejs/kit';
import {resolve} from '$app/paths';
import type {PageServerLoad} from './$types';
export const load:PageServerLoad=({url})=>redirect(308,`${resolve('/(public)/translate')}${url.search}`);
