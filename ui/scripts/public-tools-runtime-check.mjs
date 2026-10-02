import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import mysql from 'mysql2/promise';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const config=JSON.parse(readFileSync(resolve(root,'.config.json'),'utf8'));
const db=config.db?.mysql;
if(config.db?.activeType!=='mysql'||!db){
  throw new Error('ENVIRONMENT_NOT_READY: existing API must select its configured MySQL database');
}
let connection;
try{
  connection=await mysql.createConnection({...db,connectTimeout:8000});
  const [applied]=await connection.query('SELECT name FROM knex_migrations ORDER BY id');
  const expected=readdirSync(resolve(root,'src/db/schema')).filter(name=>/^\d+_.+\.cjs$/.test(name));
  const names=new Set(applied.map(row=>row.name));
  if(expected.some(name=>!names.has(name))){
    throw new Error('ENVIRONMENT_NOT_READY: existing MySQL schema is missing legacy migrations');
  }
  const [anonymous]=await connection.query('SELECT usrID FROM tblUser WHERE usrID = 1');
  if(anonymous.length!==1){
    throw new Error('ENVIRONMENT_NOT_READY: legacy anonymous user 1 is missing; run the explicit development seed command');
  }
  process.stdout.write(`MYSQL_READY: ${expected.length} existing migrations recorded\n`);
}catch(error){
  if(error instanceof Error&&error.message.startsWith('ENVIRONMENT_NOT_READY'))throw error;
  throw new Error(`ENVIRONMENT_NOT_READY: existing MySQL check failed (${error?.code??'UNKNOWN'})`);
}finally{await connection?.end()}

for(const service of ['translate','summarize']){
  const target=config.llmServers?.[service];
  if(!target?.url||!target?.model)throw new Error(`ENVIRONMENT_NOT_READY: ${service} model configuration is missing`);
  let response;
  try{response=await fetch(new URL('/v1/models',target.url),{signal:AbortSignal.timeout(8000)});}
  catch{throw new Error(`ENVIRONMENT_NOT_READY: ${service} model endpoint is unreachable`)}
  if(!response.ok)throw new Error(`ENVIRONMENT_NOT_READY: ${service} model health returned HTTP ${response.status}`);
  const models=await response.json();
  if(!Array.isArray(models?.data)||!models.data.some(model=>model?.id===target.model)){
    throw new Error(`ENVIRONMENT_NOT_READY: configured ${service} model is not served`);
  }
  process.stdout.write(`MODEL_READY: ${service} configured model is served\n`);
}
