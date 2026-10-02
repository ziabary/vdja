import { loadConfiguration } from '../../configuration/src/index.js';
import { createTargetPool, migrateTarget } from './target.js';

const at = process.argv.indexOf('--config');
const secretAt = process.argv.indexOf('--secrets-dir');
const path = at >= 0 ? process.argv[at + 1] : '/etc/targoman/platform.cjson';
if (!path) throw new Error('--config requires a path');
const snapshot = await loadConfiguration(path);
const pool = await createTargetPool(snapshot, 'migration', secretAt >= 0 ? process.argv[secretAt + 1] : undefined);
try { console.log(JSON.stringify({ applied: await migrateTarget(pool), fingerprint: snapshot.fingerprint })); }
finally { await pool.end(); }
