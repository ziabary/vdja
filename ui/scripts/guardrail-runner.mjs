import { spawnSync } from 'node:child_process';

const suites = [
  ['architecture', 'node scripts/architecture-runner.mjs'],
  ['authority', 'node --import tsx --test tests/conformance/authority/authorityBehavior.test.ts'],
];

let overallFailed = false;
let infrastructureFailed = false;

for (const [name, command] of suites) {
  console.log(`\n=== Running ${name} suite ===`);
  const result = spawnSync(command, { shell: true, stdio: 'inherit' });
  if (result.status !== 0) {
    console.log(`Suite ${name} failed with exit code ${result.status ?? 'unknown'}; continuing to run remaining suites.`);
    overallFailed = true;
    if(result.status===2)infrastructureFailed=true;
  }
}

if (overallFailed) {
  console.log('\nOne or more guardrail suites failed.');
  process.exit(infrastructureFailed?2:1);
}

console.log('\nAll guardrail suites passed.');
