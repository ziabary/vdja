import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';

export default defineConfig({
  plugins:[sveltekit({adapter:adapter(),csp:{mode:'nonce',directives:{
    'default-src':['self'],'script-src':['self'],'style-src':['self'],
    'img-src':['self','data:'],'font-src':['self'],'connect-src':['self'],
    'object-src':['none'],'base-uri':['none'],'frame-ancestors':['none'],
    'form-action':['self'],'report-uri':['/api/security/csp-report']
  }}})],
  server:{host:'0.0.0.0',port:5173,strictPort:true},
  resolve:{conditions:['browser']},
  ssr:{external:['jsdom']},
  test:{include:['tests/**/*.test.ts'],environment:'node'}
});
