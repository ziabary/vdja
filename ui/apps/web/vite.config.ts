import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const developmentTls=process.env.TARGOMAN_DEV_RAG_TLS==='1'?
  {cert:readFileSync(resolve('../../.secrets.t3.local/rag-dev-cert.pem')),
    key:readFileSync(resolve('../../.secrets.t3.local/rag-dev-key.pem'))}:undefined;

export default defineConfig({
  plugins:[sveltekit({adapter:adapter(),csp:{mode:'nonce',directives:{
    'default-src':['self'],'script-src':['self'],'style-src':['self'],
    'img-src':['self','data:'],'font-src':['self'],'connect-src':['self'],
    'object-src':['none'],'base-uri':['none'],'frame-ancestors':['none'],
    'form-action':['self'],'report-uri':['/api/security/csp-report']
  }}})],
  server:{host:developmentTls?'127.0.0.1':'0.0.0.0',port:5173,strictPort:true,...(developmentTls?{https:developmentTls}:{})},
  resolve:{conditions:['browser']},
  ssr:{external:['jsdom']},
  test:{include:['tests/**/*.test.ts'],environment:'node'}
});
