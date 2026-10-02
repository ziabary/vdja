import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfiguration } from '../packages/configuration/src/index.ts';

const args = process.argv.slice(2);
function option(name, fallback) { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; }
const dryRun = args.includes('--dry-run');
const customerOption = option('--customer', 'all');
const customers = customerOption === 'all' ? ['customer-a', 'customer-b', 'customer-c'] : [customerOption];
if (customers.some(x => !/^customer-[abc]$/.test(x))) throw new Error('Supported example customers: customer-a, customer-b, customer-c');
const platformVersion = option('--version', JSON.parse(await readFile('package.json', 'utf8')).version);
if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(platformVersion)) throw new Error('Invalid platform version');
const outDir = resolve(option('--out', 'deploy/releases'), platformVersion);
const sourceCommit = run('git', ['rev-parse', 'HEAD']).trim();
const buildTimestamp = new Date().toISOString();
const canonicalSourceHash = await sourceHash();
const runtimeLockBytes = await readFile('deploy/runtime/package-lock.json');
const lock = JSON.parse(runtimeLockBytes.toString('utf8'));
const sbom = JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1,
  metadata: { component: { type: 'application', name: 'targoman-platform', version: platformVersion } },
  components: Object.entries(lock.packages).filter(([path, item]) => path.startsWith('node_modules/') && item.version && !item.dev)
    .map(([path, item]) => ({ type: 'library', name: item.name ?? path.slice('node_modules/'.length), version: item.version,
      ...(item.integrity?.startsWith('sha512-') ? { hashes: [{ alg: 'SHA-512', content: Buffer.from(item.integrity.slice(7), 'base64').toString('hex') }] } : {}),
      ...(item.license ? { licenses: [{ license: { id: item.license } }] } : {}) })).sort((a, b) => a.name.localeCompare(b.name)) }, null, 2) + '\n';
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'dependencies.cdx.json'), sbom);
const sbomHash = sha(sbom);

for (const customer of customers) {
  if (await sourceHash() !== canonicalSourceHash) throw new Error('Canonical source changed between customer builds');
  const example = resolve('deploy/examples', customer);
  const config = await loadConfiguration(join(example, 'platform.cjson'));
  if (config.value.deployment.id !== customer || config.value.deployment.tenantId !== customer) throw new Error(`${customer}: deployment identity mismatch`);
  const releaseDir = join(outDir, customer);
  await mkdir(join(releaseDir, 'brand'), { recursive: true });
  await cp(join(example, 'platform.cjson'), join(releaseDir, 'platform.cjson'));
  await cp(join(example, 'brand'), join(releaseDir, 'brand'), { recursive: true });
  await cp('packages/persistence/src/target-migrations', join(releaseDir, 'migrations'), { recursive: true });
  await mkdir(join(releaseDir, 'data'), { recursive: true });
  await cp('src/db/data/multi-dic.json', join(releaseDir, 'data/multi-dic.json'));
  const assets = Object.fromEntries(await Promise.all(['logo.svg', 'favicon.svg'].map(async name => [name, sha(await readFile(join(example, 'brand', name)))])));
  const images = {};
  for (const role of ['web', 'api', 'worker']) {
    const tag = `targoman/${customer}-${role}:${platformVersion}`;
    if (!dryRun) {
      run('docker', ['build', '-f', 'deploy/customer.Dockerfile', '--build-arg', `CUSTOMER=${customer}`, '--build-arg', `ROLE=${role}`,
        '--build-arg', `SOURCE_COMMIT=${sourceCommit}`, '--build-arg', `PLATFORM_VERSION=${platformVersion}`,
        '--build-arg', `RELEASE_ID=${config.value.deployment.releaseId}`, '--build-arg', `CONFIG_FINGERPRINT=${config.fingerprint}`,
        '--build-arg', `BUILD_TIMESTAMP=${buildTimestamp}`, '-t', tag, '.'], true);
    }
    const imageId = dryRun ? null : run('docker', ['image', 'inspect', tag, '--format', '{{.Id}}']).trim();
    images[role] = { tag, imageId };
  }
  const manifest = { releaseSchemaVersion: 1, customer, releaseId: config.value.deployment.releaseId, platformVersion,
    sourceCommit, canonicalSourceHash, configurationSchemaVersion: config.value.configVersion, configurationFingerprint: config.fingerprint,
    buildTimestamp, dependencyLockHash: sha(runtimeLockBytes), buildDependencyLockHash: sha(await readFile('package-lock.json')),
    sbomHash, brandAssetHashes: assets,
    images, built: !dryRun, postgresImage: 'postgres:16.15-bookworm', migrations: 'migrations/',
    dictionarySource: { path: 'data/multi-dic.json', sha256: sha(await readFile('src/db/data/multi-dic.json')) },
    externalSecrets: ['pg-api', 'pg-worker', 'pg-migration'] };
  await writeFile(join(releaseDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(join(releaseDir, 'compose.yaml'), compose(customer, images));
  process.stdout.write(`${customer}: ${Object.values(images).map(x => x.tag).join(', ')} config=${config.fingerprint} ${dryRun ? 'planned' : 'built'}\n`);
}

function sha(value) { return createHash('sha256').update(value).digest('hex'); }
function run(command, commandArgs, inherit = false) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe' });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr?.trim() ?? ''}`);
  return result.stdout ?? '';
}
async function sourceHash() {
  const entries = [];
  async function walk(path) {
    for (const item of await readdir(path, { withFileTypes: true })) {
      if (['node_modules', 'build', 'dist', '.svelte-kit', 'tests', 'examples'].includes(item.name)) continue;
      const child = join(path, item.name);
      if (item.isDirectory()) await walk(child);
      else if (item.isFile() && /\.(?:ts|js|mjs|json|svelte|css|svg|sql)$/.test(item.name)) entries.push(child);
    }
  }
  for (const path of ['apps', 'modules', 'packages']) await walk(path);
  entries.push('package.json', 'package-lock.json', 'deploy/runtime/package.json', 'deploy/runtime/package-lock.json',
    'deploy/customer.Dockerfile', 'deploy/entrypoint.mjs', 'src/db/data/multi-dic.json');
  const hash = createHash('sha256');
  for (const path of entries.sort()) { hash.update(path); hash.update(await readFile(path)); }
  return hash.digest('hex');
}
function compose(customer, images) {
  return `name: ${customer}\nservices:\n  web:\n    image: ${images.web.tag}\n    ports:\n      - "127.0.0.1:8080:3000"\n    environment:\n      HOST: 0.0.0.0\n      PORT: "3000"\n    networks: [customer_private]\n    read_only: true\n    tmpfs: [/tmp]\n  api:\n    image: ${images.api.tag}\n    secrets: [pg-api]\n    networks: [customer_private]\n    read_only: true\n    tmpfs: [/tmp]\n  worker:\n    image: ${images.worker.tag}\n    secrets: [pg-worker]\n    networks: [customer_private]\n    read_only: true\n    tmpfs: [/tmp]\nnetworks:\n  customer_private:\n    external: true\n    name: ${'$'}{TARGOMAN_CUSTOMER_NETWORK}\nsecrets:\n  pg-api:\n    file: ${'$'}{TARGOMAN_RELEASE_SECRETS_DIR}/pg-api\n  pg-worker:\n    file: ${'$'}{TARGOMAN_RELEASE_SECRETS_DIR}/pg-worker\n`;
}
