import type {PageServerLoad} from './$types';
import {requireDevelopmentShowcase} from '#lib/server/showcase.js';
export const load:PageServerLoad=()=>{requireDevelopmentShowcase(import.meta.env.DEV);return {};};
