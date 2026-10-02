import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';

export default defineConfig({
  plugins:[sveltekit({adapter:adapter()})],
  server:{host:'0.0.0.0',port:5173,strictPort:true},
  resolve:{conditions:['browser']},
  ssr:{external:['jsdom']},
  test:{include:['tests/**/*.test.ts'],environment:'node'}
});
