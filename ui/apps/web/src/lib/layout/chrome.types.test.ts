import type {typChromeContribution} from './chrome.svelte.js';
const title:typChromeContribution={key:'title',props:{text:'Safe title'}};
void title;
// @ts-expect-error A toolbar command cannot be registered with title props.
const mismatched:typChromeContribution={key:'toolbar',props:{text:'Wrong props'}};
void mismatched;
