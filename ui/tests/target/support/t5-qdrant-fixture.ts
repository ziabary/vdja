import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const run=promisify(execFile);
export const QDRANT_FIXTURE_IMAGE='qdrant/qdrant@sha256:dab6de32f7b2cc599985a7c764db3e8b062f70508fb85ca074aa856f829bf335';
export async function startQdrantFixture() {
  const root=await mkdtemp(join(tmpdir(),'t5-qdrant-')), name=`t5-qdrant-${randomUUID()}`, apiKey=randomBytes(32).toString('hex');
  const env=join(root,'fixture.env'); await writeFile(env,`QDRANT__SERVICE__API_KEY=${apiKey}\nQDRANT__LOG_LEVEL=ERROR\nQDRANT__TELEMETRY_DISABLED=true\n`,{mode:0o600});
  let endpoint='';
  async function binding() { const port=await run('docker',['port',name,'6333'],{timeout:5000});
    const match=/^127\.0\.0\.1:(\d+)\s*$/u.exec(port.stdout.trim()); if (!match) throw new Error('INVALID_QDRANT_FIXTURE_BINDING');
    endpoint=`http://127.0.0.1:${match[1]}`;
    for (let attempt=0;attempt<100;attempt+=1) {
      try { if ((await fetch(`${endpoint}/collections`,{headers:{'api-key':apiKey},signal:AbortSignal.timeout(1000)})).ok) return; } catch { /* startup */ }
      await new Promise(resolve=>setTimeout(resolve,100));
    } throw new Error('QDRANT_FIXTURE_STARTUP_FAILED'); }
  try {
    await run('docker',['run','--detach','--name',name,'--label','targoman.test=t5','--env-file',env,'--publish','127.0.0.1::6333',QDRANT_FIXTURE_IMAGE],{timeout:30000});
    await binding();
    return {get endpoint(){return endpoint;},apiKey,async pause(){await run('docker',['stop','--time','5',name],{timeout:10000});},async restart(){await run('docker',['restart',name],{timeout:30000});await binding();},
      async close(){await run('docker',['rm','--force',name],{timeout:30000});await rm(root,{recursive:true,force:true});}};
  } catch { await run('docker',['rm','--force',name],{timeout:30000}).catch(()=>undefined);await rm(root,{recursive:true,force:true});throw new Error('QDRANT_FIXTURE_STARTUP_FAILED'); }
}
