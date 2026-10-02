const role = process.env.TARGOMAN_ROLE;
if (role === 'web') {
  await import('../apps/web/build/index.js');
} else if (role === 'api') {
  process.argv = [process.argv[0], '/app/apps/api/src/index.ts', '--config', '/etc/targoman/platform.cjson'];
  await import('../dist/target-api.js');
} else if (role === 'worker') {
  process.argv = [process.argv[0], '/app/apps/worker/src/index.ts', '--config', '/etc/targoman/platform.cjson'];
  await import('../dist/target-worker.js');
} else {
  throw new Error('Invalid release role');
}
