import { loadConfiguration, redactConfiguration } from './index.js';

function pathFromArgs(args: readonly string[]): string {
  const at = args.indexOf('--config');
  if (at < 0) return '/etc/targoman/platform.cjson';
  const path=args[at+1];
  if (!path) throw new Error('--config requires a path');
  return path;
}

const command = process.argv[2];
try {
  if (!command||!['validate', 'print-effective', 'fingerprint'].includes(command)) throw new Error('Expected validate, print-effective, or fingerprint');
  const snapshot = await loadConfiguration(pathFromArgs(process.argv.slice(3)));
  if (command === 'validate') console.log(JSON.stringify({ status: 'VALID', configVersion: snapshot.value.configVersion, fingerprint: snapshot.fingerprint }));
  else if (command === 'fingerprint') console.log(snapshot.fingerprint);
  else console.log(JSON.stringify(redactConfiguration(snapshot.value), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Configuration failed');
  process.exitCode = 1;
}
