import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const name='vadja-qdrant-rag';
function docker(args,env){
  const result=spawnSync('docker',args,{encoding:'utf8',env:env??process.env});
  if(result.error)throw result.error;
  return result;
}
const found=docker(['container','inspect',name]);
if(found.status!==0){
  const key=(await readFile('.secrets.t3.local/qdrant','utf8')).trim();
  const result=docker(['run','--name',name,'--detach','--publish','127.0.0.1:6333:6333',
    '--volume','vadja-rag-qdrant:/qdrant/storage','--env','QDRANT__SERVICE__API_KEY',
    'qdrant/qdrant:v1.16.2'],{...process.env,QDRANT__SERVICE__API_KEY:key});
  if(result.status!==0)throw new Error(`QDRANT_START_FAILED: ${result.stderr.trim()}`);
}else{
  const state=JSON.parse(found.stdout)[0]?.State;
  if(!state?.Running){const result=docker(['start',name]);if(result.status!==0)throw new Error('QDRANT_START_FAILED');}
}
const key=(await readFile('.secrets.t3.local/qdrant','utf8')).trim();
let ready=false;
for(let attempt=0;attempt<30;attempt++){
  try{const response=await fetch('http://127.0.0.1:6333/collections',{headers:{'api-key':key},signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break;}}
  catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
}
if(!ready)throw new Error('QDRANT_NOT_READY');
console.log(JSON.stringify({qdrant:'READY',endpoint:'http://127.0.0.1:6333'}));
