const role = process.env.TARGOMAN_ROLE;
if (role === 'web') {
  const { server } = await import('../apps/web/build/index.js');
  const { installWebSecurityHeaders } = await import('./web-security-headers.mjs');
  installWebSecurityHeaders(server);
} else if (role === 'api') {
  process.argv = [process.argv[0], '/app/apps/api/src/index.ts', '--config', '/etc/targoman/platform.cjson'];
  await import('../dist/target-api.js');
} else if (role === 'worker') {
  process.argv = [process.argv[0], '/app/apps/worker/src/index.ts', '--config', '/etc/targoman/platform.cjson'];
  await import('../dist/target-worker.js');
} else {
  throw new Error('Invalid release role');
}
