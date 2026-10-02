import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(process.cwd(),'../..');
const workspaces=['apps/web','packages/contracts','packages/branding','packages/ui-core','packages/calendar-core','packages/calendar-svelte'] as const;
function json(path:string):Record<string,unknown>{return JSON.parse(readFileSync(resolve(root,path),'utf8')) as Record<string,unknown>;}

describe('first-party package namespace',()=>{
  it('uses only @targoman names and explicit workspace links in manifests and lockfile',()=>{
    const lock=json('package-lock.json').packages as Record<string,{name?:string;link?:boolean;resolved?:string}>;
    for(const path of workspaces){
      const manifest=json(`${path}/package.json`);
      expect(manifest.name).toMatch(/^@targoman\/[a-z-]+$/);
      expect(lock[path]?.name).toBe(manifest.name);
      expect(lock[`node_modules/${String(manifest.name)}`]).toMatchObject({link:true,resolved:path});
    }
    expect(readFileSync(resolve(root,'package-lock.json'),'utf8')).not.toContain('@fapa/');
  });
});
