import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import mysql from 'mysql2/promise';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const config=JSON.parse(readFileSync(resolve(root,'.config.json'),'utf8'));
const db=config.db?.mysql;
if(config.db?.activeType!=='mysql'||!db||!['127.0.0.1','localhost'].includes(db.host)||db.database!=='TargomanLLM'){
  throw new Error('SEED_REFUSED: only the configured local TargomanLLM development database is permitted');
}
let connection;
try{
  connection=await mysql.createConnection({...db,connectTimeout:8000});
  await connection.beginTransaction();
  const [migration]=await connection.query("SELECT name FROM knex_migrations WHERE name = '3_tblUser.cjs'");
  const [groups]=await connection.query('SELECT grpID FROM tblGroup WHERE grpID = 1');
  const [[users]]=await connection.query('SELECT COUNT(*) AS count FROM tblUser');
  if(migration.length!==1||groups.length!==1||users.count!==0){
    throw new Error('SEED_REFUSED: expected migration, anonymous group or empty user table condition not met');
  }
  // Restore only the initial row defined in unchanged migration 3_tblUser.cjs.
  await connection.query(`INSERT INTO tblUser
    (usrID,usrName,usrKey,usrEmail,usrMobile,usrOpenID,usrAssigned_grpID,usrSpecialPrivs,usrRefreshHash,usrLasLogin,usrLastLogout,usrCreatedAt,usrStatus)
    VALUES (1,'unknown',NULL,NULL,NULL,NULL,1,NULL,NULL,'2026-01-29 20:33:35',NULL,'2026-01-29 20:33:35','Active')`);
  await connection.commit();
  process.stdout.write('LEGACY_ANONYMOUS_USER_RESTORED: migration-defined development row 1\n');
}catch(error){
  await connection?.rollback().catch(()=>{});
  if(error instanceof Error&&error.message.startsWith('SEED_REFUSED'))throw error;
  throw new Error(`SEED_FAILED: ${error?.code??'UNKNOWN'}`);
}finally{await connection?.end()}
