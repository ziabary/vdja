import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {planLegacyRagMigration} from '../packages/knowledge/src/legacy-migration.js';
function argument(name:string):string{const index=process.argv.indexOf(name),value=process.argv[index+1];if(index<0||!value||value.startsWith('--'))throw new Error(`Required: ${name}`);return value;}
async function readJson(path:string):Promise<unknown>{const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{const details=await file.stat();if(!details.isFile()||details.size>16*1024*1024)throw new Error('LEGACY_MANIFEST_LIMIT');return JSON.parse(await file.readFile('utf8'))as unknown;}
  finally{await file.close();}}
try{
  const records=await readJson(argument('--records')),owners=await readJson(argument('--owners'));
  const plan=planLegacyRagMigration(argument('--source-system'),records,owners);
  const output=await open(argument('--out'),constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
  try{await output.writeFile(`${JSON.stringify(plan,null,2)}\n`);await output.sync();}finally{await output.close();}
  console.log(JSON.stringify({digest:plan.digest,planned:plan.items.length,excluded:plan.excluded.length,status:'PLANNED_NOT_APPLIED'}));
}catch(error){console.error(error instanceof Error?error.message:'LEGACY_MIGRATION_INVALID');process.exitCode=1;}
