import { loadConfiguration, resolveSecretRef } from '../../../packages/configuration/src/index.js';
import { createWorkerRuntime } from './composition.js';
import { deliverNext } from '../../../packages/security-telemetry/src/worker.js';
import { logOperational } from '../../../packages/observability/src/index.js';

function arg(name: string, fallback: string): string { const at = process.argv.indexOf(name); return at < 0 ? fallback : process.argv[at + 1] ?? fallback; }
const config = await loadConfiguration(arg('--config', '/etc/targoman/platform.cjson'));
const secretRoot = arg('--secrets-dir', '/run/secrets');
await Promise.all([resolveSecretRef(config.value.database.workerPasswordRef, secretRoot), ...(config.value.siem.credentialRef ? [resolveSecretRef(config.value.siem.credentialRef, secretRoot)] : [])]);
const runtime = await createWorkerRuntime(config, secretRoot);
let stopping = false;
process.once('SIGTERM', () => { stopping = true; }); process.once('SIGINT', () => { stopping = true; });
try {
  while (!stopping) {
    try {
      const result = await deliverNext(runtime.storage, config.value.siem, undefined, secretRoot);
      if (result !== 'EMPTY') logOperational({ severity: result === 'DELIVERED' ? 'INFO' : 'WARN', component: 'siem-worker', event: 'delivery', status: result });
    } catch { logOperational({ severity: 'ERROR', component: 'siem-worker', event: 'claim_or_delivery_failed', errorClass: 'WORKER_ERROR' }); }
    await new Promise(resolve => setTimeout(resolve, config.value.worker.pollMs));
  }
} finally { await runtime.close(); }
