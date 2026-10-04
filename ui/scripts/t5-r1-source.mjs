import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const VERIFICATION_CONTRACT_FILES=['docs/prompts/T5-final.md','docs/security/06-t5-genai-rag-security-gate.md','scripts/t5-evidence-gate.mjs'];
export const VERIFICATION_SCHEMA_VERSION='T5-R1.1-EVIDENCE-2';
/** The exact policy bytes are independent of implementation and OCI source hashes. */
export async function verificationContractFingerprint(root='.'){
 const files={};for(const path of VERIFICATION_CONTRACT_FILES)files[path]=hash(await readFile(`${root}/${path}`));
 return {verificationContractHash:hash(JSON.stringify({schema:VERIFICATION_SCHEMA_VERSION,files})),contractFiles:files};
}
export async function sourceFingerprint(root='.'){
 const files=[];
 async function walk(dir){for(const entry of await readdir(`${root}/${dir}`,{withFileTypes:true})){
  if(['node_modules','build','dist','.svelte-kit','reports'].includes(entry.name))continue;
  const path=`${dir}/${entry.name}`;if(entry.isSymbolicLink())throw new Error(`SOURCE_SYMLINK:${path}`);
  if(entry.isDirectory())await walk(path);else if(/\.(?:[cm]?[jt]sx?|svelte|json|cjson|sql|ya?ml)$/u.test(path)||/Dockerfile/u.test(path))files.push(path);
 }}
 for(const dir of ['apps','packages','modules','scripts','tests','deploy'])await walk(dir);
 for(const file of ['package.json','package-lock.json','tsconfig.target.json','tsconfig.persistence.json'])files.push(file);
 const hashes={};for(const file of files.sort())hashes[file]=hash(await readFile(`${root}/${file}`));
 return {sourceHash:hash(JSON.stringify(hashes)),files:hashes};
}

/** Keep OCI report freshness tied to the exact source set used by t5-oci-acceptance. */
export async function ociSourceFingerprint(root='.'){
 const paths=[];
 async function walk(path){for(const item of await readdir(`${root}/${path}`,{withFileTypes:true})){
  if(['node_modules','build','dist','.svelte-kit'].includes(item.name))continue;
  const child=`${path}/${item.name}`;if(item.isDirectory())await walk(child);else if(item.isFile())paths.push(child);
 }}
 for(const path of ['apps','modules','packages','deploy'])await walk(path);
 paths.push('package.json','package-lock.json','tsconfig.target.json');
 const digest=createHash('sha256');
 for(const path of paths.sort()){digest.update(path);digest.update(await readFile(`${root}/${path}`));}
 return digest.digest('hex');
}
