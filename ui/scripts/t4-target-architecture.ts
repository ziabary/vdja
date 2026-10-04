import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeRepository } from '../tests/architecture/support/staticAnalysis.js';

export const TARGET_PREFIXES = [
  'apps/api/src/', 'apps/worker/src/', 'apps/runtime/src/',
  'modules/translator/src/', 'modules/summarizer/src/', 'modules/faq/src/',
  'packages/authority/src/', 'packages/authentication/src/', 'packages/session/src/',
  'packages/ai-router/src/', 'packages/security-telemetry/src/', 'packages/platform/src/',
  'packages/configuration/src/', 'packages/admission-control/src/', 'packages/usage/src/',
  'packages/audit/src/', 'packages/file-processing/src/', 'packages/observability/src/',
  'packages/documents/src/', 'packages/storage/src/', 'packages/jobs/src/', 'packages/file-management/src/',
  'packages/knowledge/src/', 'packages/data-governance/src/',
  'packages/identity/src/',
  'packages/persistence/src/target', 'packages/contracts/src/'
];
export interface intfTargetFinding { readonly ruleId: string; readonly file: string; readonly message: string }
function target(file: string): boolean { return TARGET_PREFIXES.some(prefix => file.startsWith(prefix)); }

/** High-confidence T4 boundary checks, independent of the broader legacy baseline. */
export function targetAuthFindings(file: string, source: string): readonly intfTargetFinding[] {
  if (!target(file) || !file.endsWith('.ts') || file.endsWith('/persistence/migrate.ts')) return [];
  const findings: intfTargetFinding[] = [];
  const add = (ruleId: string, message: string) => findings.push({ ruleId, file, message });
  if (!file.startsWith('packages/authentication/src/') && !file.startsWith('packages/session/src/') && /\b(?:jwt\.verify|jwt\.decode|jsonwebtoken|jose\.jwtVerify)\b/.test(source)) add('T4-AUTH-001', 'JWT parsing outside Authentication/Session');
  if (!file.startsWith('packages/authentication/src/') && /\b(?:scrypt|argon2|bcrypt|verifyPassword)\s*\(/.test(source)) add('T4-AUTH-002', 'Password verification outside Authentication');
  if (!file.startsWith('packages/authority/src/') && /\bauthority\.tbl_aut_[a-z_]+\b/.test(source)) add('T4-AUTH-003', 'Authority table addressed outside Authority persistence');
  if (!file.startsWith('packages/authority/src/') && /\b(?:privs\.ALL|privs\.includes|user\.role\s*===|clearance\s*(?:>=|>)\s*classification)\b/.test(source)) add('T4-AUTH-004', 'Authorization fact interpreted outside Authority');
  return findings;
}

if (process.argv[1]?.endsWith('t4-target-architecture.ts')) {
  const all = analyzeRepository().filter(finding => target(finding.file)).map(finding => ({ ruleId: finding.ruleId, file: finding.file, message: finding.message }));
  const files: string[] = [];
  for (const prefix of TARGET_PREFIXES) {
    const directory = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix.slice(0, prefix.lastIndexOf('/'));
    function walk(path: string): void {
      for (const item of readdirSync(path, { withFileTypes: true })) {
        const child = join(path, item.name);
        if (item.isDirectory()) walk(child);
        else if (item.isFile() && child.endsWith('.ts') && target(child)) files.push(child);
      }
    }
    try { walk(directory); } catch { /* package may be absent in an early phase */ }
  }
  for (const file of new Set(files)) all.push(...targetAuthFindings(file, readFileSync(file, 'utf8')));
  const lock = JSON.parse(readFileSync('deploy/runtime/package-lock.json', 'utf8')) as { packages: Record<string, unknown> };
  if (Object.keys(lock.packages).some(name => /^node_modules\/(?:mysql|mysql2|knex)(?:\/|$)/.test(name))) all.push({ ruleId: 'T4-RUNTIME-001', file: 'deploy/runtime/package-lock.json', message: 'Migration-only MySQL dependency in normal runtime' });
  const distinct = [...new Map(all.map(finding => [`${finding.ruleId}:${finding.file}:${finding.message}`, finding])).values()];
  mkdirSync('tests/reports', { recursive: true });
  writeFileSync('tests/reports/t4-target-architecture.json', JSON.stringify({ findings: distinct }, null, 2) + '\n');
  console.log(`T4 target architecture: ${distinct.length} findings`);
  for (const finding of distinct) console.log(`${finding.ruleId} ${finding.file}: ${finding.message}`);
  if (distinct.length) process.exitCode = 1;
}
