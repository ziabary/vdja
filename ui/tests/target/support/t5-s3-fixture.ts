import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);
export const S3_FIXTURE_IMAGE = 'andrewgaul/s3proxy@sha256:87662b2a5afcdfa5f478a1c61650bae4c87bbd15f6ff2823236bcfd66ef7fe04';
export interface intfS3Fixture {
  readonly endpoint: string;
  readonly secretRoot: string;
  readonly credentials: Readonly<{ accessKeyId: string; secretAccessKey: string }>;
  restart(): Promise<void>;
  close(): Promise<void>;
}
async function ready(endpoint: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { const response = await fetch(endpoint, { signal: AbortSignal.timeout(1000) });
      if (response.status === 403 || response.status === 400) return; }
    catch { /* a fresh fixture may still be starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('S3_FIXTURE_STARTUP_FAILED');
}
export async function startS3Fixture(): Promise<intfS3Fixture> {
  const root = await mkdtemp(join(tmpdir(), 't5-s3-'));
  const name = `t5-s3-${randomUUID()}`, accessKeyId = randomBytes(16).toString('hex'), secretAccessKey = randomBytes(32).toString('hex');
  const environment = join(root, 'fixture.env');
  await writeFile(environment, `S3PROXY_IDENTITY=${accessKeyId}\nS3PROXY_CREDENTIAL=${secretAccessKey}\nLOG_LEVEL=error\n`, { mode: 0o600 });
  await writeFile(join(root, 'access'), accessKeyId, { mode: 0o600 });
  await writeFile(join(root, 'secret'), secretAccessKey, { mode: 0o600 });
  try {
    await run('docker', ['run', '--detach', '--name', name, '--label', 'targoman.test=t5', '--env-file', environment,
      '--publish', '127.0.0.1::80', '--entrypoint', '/bin/sh', S3_FIXTURE_IMAGE, '-c',
      // The pinned upstream entrypoint uses non-idempotent mkdir. Retain the
      // native server/configuration and make only datastore creation restartable.
      "sed 's/^mkdir /mkdir -p /' /opt/s3proxy/run-docker-container.sh > /tmp/t5-entrypoint.sh && exec /bin/sh /tmp/t5-entrypoint.sh"], { timeout: 30000 });
    const port = await run('docker', ['port', name, '80'], { timeout: 5000 });
    const match = /^127\.0\.0\.1:(\d+)\s*$/u.exec(port.stdout.trim());
    if (!match) throw new Error('INVALID_S3_FIXTURE_BINDING');
    let endpoint = `http://127.0.0.1:${match[1]}`;
    await ready(endpoint);
    return { get endpoint() { return endpoint; }, secretRoot: root, credentials: { accessKeyId, secretAccessKey },
      async restart() {
        await run('docker', ['restart', name], { timeout: 30000 });
        const binding = await run('docker', ['port', name, '80'], { timeout: 5000 });
        const restartedPort = /^127\.0\.0\.1:(\d+)\s*$/u.exec(binding.stdout.trim());
        if (!restartedPort) throw new Error('INVALID_S3_FIXTURE_BINDING');
        endpoint = `http://127.0.0.1:${restartedPort[1]}`;
        try { await ready(endpoint); } catch {
          const logs = await run('docker', ['logs', '--tail', '30', name], { timeout: 5000 });
          throw new Error(`S3_FIXTURE_RESTART_FAILED: ${`${logs.stdout}${logs.stderr}`.replaceAll(accessKeyId, '[REDACTED]').replaceAll(secretAccessKey, '[REDACTED]')}`);
        }
      },
      async close() { await run('docker', ['rm', '--force', name], { timeout: 30000 }); await rm(root, { recursive: true, force: true }); } };
  } catch {
    await run('docker', ['rm', '--force', name], { timeout: 30000 }).catch(() => undefined);
    await rm(root, { recursive: true, force: true });
    throw new Error('S3_FIXTURE_STARTUP_FAILED');
  }
}
