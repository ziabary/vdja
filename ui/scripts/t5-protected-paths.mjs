import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const baseline=JSON.parse(await readFile('reports/security/t5-protected-paths-before.json','utf8'));
const files={};
const {execFileSync}=await import('node:child_process');
async function walk(path,all=false){for(const entry of await readdir(path,{withFileTypes:true})){if(['.git','node_modules','.svelte-kit','build','dist','.aws','.codex','.agents'].includes(entry.name))continue;
 const child=join(path,entry.name);if(entry.isDirectory())await walk(child,all||['docs/architecture','docs/prompts','docs/governance','docs/adr'].includes(child));
 else if(all||entry.name==='AGENTS.md')files[child]=createHash('sha256').update(await readFile(child)).digest('hex');}}
for(const path of ['docs/architecture','docs/prompts','docs/governance','docs/adr']){try{await walk(path,true);}catch(error){if(error.code!=='ENOENT')throw error;}}
for(const path of execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard','--','**/AGENTS.md','AGENTS.md'],{encoding:'utf8'}).split('\0').filter(Boolean)){files[path]=createHash('sha256').update(await readFile(path)).digest('hex');}
// join('.', path) is normalized; baseline files pre-date this task's only authorized AGENTS edit.
const trackedBaseline=Object.keys(baseline.files),authorized=new Set(baseline.authorizedChanges);
const baselineScoped=trackedBaseline.filter(path=>path.endsWith('AGENTS.md'));
// Older start artifact enumerated docs and root only. Existing scoped instruction files were read,
// but have no hash baseline. Verify them against git HEAD and report that distinct comparison.
const comparisons=Object.keys(files).filter(path=>path.endsWith('AGENTS.md')&&!trackedBaseline.includes(path)).map(path=>{
 let prior;try{prior=execFileSync('git',['show',`HEAD:ui/${path}`],{encoding:null,stdio:['ignore','pipe','ignore']});}catch{throw new Error(`SCOPED_INSTRUCTION_BASELINE_MISSING:${path}`);}
 return{path,basis:'GIT_HEAD_FOR_UNCHANGED_SCOPED_INSTRUCTIONS',unchanged:files[path]===createHash('sha256').update(prior).digest('hex')};
});
const changes=[...new Set([...trackedBaseline,...Object.keys(files).filter(path=>!path.endsWith('AGENTS.md')||trackedBaseline.includes(path))])]
 .filter(path=>files[path]!==baseline.files[path]).map(path=>({path,authorized:authorized.has(path),before:baseline.files[path]??null,after:files[path]??null}));
const violations=changes.filter(change=>!change.authorized).length+comparisons.filter(value=>!value.unchanged).length;
const result={generatedAt:new Date().toISOString(),status:violations===0?'PASS':'FAIL',unauthorizedCount:violations,changes,scopedComparisons:comparisons,files};
await writeFile('reports/security/t5-protected-paths-after.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,unauthorizedCount:violations,comparedFiles:Object.keys(files).length}));if(violations)process.exitCode=1;
