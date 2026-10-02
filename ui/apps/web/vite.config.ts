import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';

export default defineConfig(({command})=>{
  const apiOrigin=process.env.DEV_API_ORIGIN??'http://127.0.0.1:3000';
  if(command==='serve'&&!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(apiOrigin))throw new Error('DEV_API_ORIGIN must be a loopback HTTP origin');
  return {plugins:[sveltekit({adapter:adapter()})],server:{host:'0.0.0.0',port:5173,strictPort:true,proxy:command==='serve'?{'/api':{target:apiOrigin,changeOrigin:false}}:undefined},resolve:{conditions:['browser']},ssr:{external:['jsdom']},test:{include:['tests/**/*.test.ts'],environment:'node'}};
});
