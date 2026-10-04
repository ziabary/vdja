import { loadConfiguration, resolveSecretRef } from '../../../packages/configuration/src/index.js';
import { createWorkerRuntime } from './composition.js';
import { deliverNext } from '../../../packages/security-telemetry/src/worker.js';
import { logOperational } from '../../../packages/observability/src/index.js';
import {installProcessErrorHandlers} from '../../../packages/observability/src/process-errors.js';

let drain=async()=>{};
installProcessErrorHandlers('target-worker',()=>drain());

function arg(name: string, fallback: string): string { const at = process.argv.indexOf(name); return at < 0 ? fallback : process.argv[at + 1] ?? fallback; }
const config = await loadConfiguration(arg('--config', '/etc/targoman/platform.cjson'));
const secretRoot = arg('--secrets-dir', '/run/secrets');
await Promise.all([resolveSecretRef(config.value.database.workerPasswordRef, secretRoot), ...(config.value.siem.credentialRef ? [resolveSecretRef(config.value.siem.credentialRef, secretRoot)] : [])]);
const runtime = await createWorkerRuntime(config, secretRoot);
let stopping = false;
const shutdown = new AbortController();
let drained:()=>void=()=>{};
const completion=new Promise<void>(resolve=>{drained=resolve;});
drain=async()=>{stopping=true;shutdown.abort();await completion;};
process.once('SIGTERM', () => { stopping = true; shutdown.abort(); }); process.once('SIGINT', () => { stopping = true; shutdown.abort(); });
try {
  while (!stopping) {
    if (runtime.jobs) {
      try { await runtime.machineReady(); const result = await runtime.jobs.next(shutdown.signal);
        if (result !== 'EMPTY') logOperational({severity:result==='SUCCEEDED'?'INFO':'WARN',component:'document-knowledge-worker',event:'job_completed',status:result});
      } catch { logOperational({severity:'ERROR',component:'document-knowledge-worker',event:'claim_or_execution_failed',errorClass:'WORKER_ERROR'}); }
    }
    try {
      const result = await deliverNext(runtime.storage, config.value.siem, undefined, secretRoot);
      if (result !== 'EMPTY') logOperational({ severity: result === 'DELIVERED' ? 'INFO' : 'WARN', component: 'siem-worker', event: 'delivery', status: result });
    } catch { logOperational({ severity: 'ERROR', component: 'siem-worker', event: 'claim_or_delivery_failed', errorClass: 'WORKER_ERROR' }); }
    await new Promise(resolve => setTimeout(resolve, config.value.worker.pollMs));
  }
} finally { try{await runtime.close();}finally{drained();} }
