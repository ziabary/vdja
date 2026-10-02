import {describe,it,expect} from 'vitest';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const pairs=[
  ['public/fonts/IranSansX','apps/web/static/fonts/iransansx'],
  ['public/fonts/fontawesome/v6.2.0','apps/web/static/fonts/fontawesome/v6.2.0']
] as const;
function files(directory:string):string[]{return readdirSync(directory,{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(join(directory,item.name)):[join(directory,item.name)]);}

describe('migrated legacy font and icon assets',()=>{
  it('retains exact existing bytes and the original provenance comments',()=>{
    for(const [source,target] of pairs){
      const sourceRoot=join(root,source),targetRoot=join(root,target);
      const expected=files(sourceRoot).filter(path=>!path.endsWith('.ttf.1')).map(path=>relative(sourceRoot,path)).sort();
      const actual=files(targetRoot).map(path=>relative(targetRoot,path)).sort();
      expect(actual).toEqual(expected);
      for(const name of actual)expect(readFileSync(join(targetRoot,name)).equals(readFileSync(join(sourceRoot,name))),name).toBe(true);
    }
    expect(readFileSync(join(root,'apps/web/static/fonts/iransansx/fontiran.css'),'utf8')).toContain('Commercial/Proprietary Software');
    expect(readFileSync(join(root,'apps/web/static/fonts/fontawesome/v6.2.0/all.css'),'utf8')).toContain('Font Awesome Pro 6.2.0');
  });
  it('resolves every locally referenced stylesheet font URL',()=>{
    for(const css of ['apps/web/static/fonts/iransansx/fontiran.css','apps/web/static/fonts/fontawesome/v6.2.0/all.css','apps/web/static/fonts/fontawesome/v6.2.0/sharp-solid.css']){
      const file=join(root,css),contents=readFileSync(file,'utf8');
      const references=[...contents.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)].map(match=>match[1]).filter((path):path is string=>!!path&&!path.startsWith('data:'));
      expect(references.length).toBeGreaterThan(0);
      for(const reference of references){const asset=resolve(dirname(file),reference);expect(existsSync(asset),`${css} -> ${reference}`).toBe(true);expect(statSync(asset).size).toBeGreaterThan(0);}
    }
  });
});
