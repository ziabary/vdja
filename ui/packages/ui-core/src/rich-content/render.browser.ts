import createDOMPurify from 'dompurify';
import {markdownToHtml,SANITIZE_OPTIONS} from './pipeline.js';
export function renderMarkdownTrusted(source:string):string {return createDOMPurify(window).sanitize(markdownToHtml(source),SANITIZE_OPTIONS);}
