import {error} from '@sveltejs/kit';
/** Production deployments do not expose the local design-system fixture. */
export function requireDevelopmentShowcase(development:boolean):void {if(!development)error(404,'Not found');}
