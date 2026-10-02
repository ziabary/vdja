import type { intfConfigurationSnapshot } from '../../../packages/configuration/src/index.js';
import { createTargetDatabaseAdapter } from '../../../packages/persistence/src/target.js';
import { createSiemExportPersistence } from '../../../packages/security-telemetry/src/persistence.js';

export async function createWorkerRuntime(snapshot: intfConfigurationSnapshot, secretRoot: string) {
  const pool = await createTargetDatabaseAdapter(snapshot, 'worker', secretRoot);
  return { storage: createSiemExportPersistence(pool), close: () => pool.end() };
}
