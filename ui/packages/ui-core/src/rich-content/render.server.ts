import createDOMPurify from 'dompurify';
import {createRequire} from 'node:module';
import {markdownToHtml,SANITIZE_OPTIONS} from './pipeline.js';
const nodeRequire=createRequire(import.meta.url);
const {JSDOM}=nodeRequire('jsdom') as typeof import('jsdom');
const purifier=createDOMPurify(new JSDOM('').window);
export function renderMarkdownTrusted(source:string):string{return purifier.sanitize(markdownToHtml(source),SANITIZE_OPTIONS);}
