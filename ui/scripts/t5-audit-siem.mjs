import {mkdtemp,readFile,rm,mkdir,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync,spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
if(!process.env.T4_PG_CONFIG||!process.env.T4_SECRETS_DIR)throw new Error('T5_LIVE_CONFIGURATION_REQUIRED');
const root=await mkdtemp(join(tmpdir(),'t5-siem-tls-'));
try{
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(root,'key.pem'),'-out',join(root,'cert.pem'),'-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
  await chmod(join(root,'key.pem'),0o600);await readFile(join(root,'cert.pem'));await mkdir('tests/reports',{recursive:true});
  const log=createWriteStream('tests/reports/t5-audit-siem.tap');
  const child=spawn(process.execPath,['--import','tsx','--test','tests/target/t5-audit-siem.integration.test.ts'],{env:{...process.env,
    NODE_TLS_REJECT_UNAUTHORIZED:'1',NODE_EXTRA_CA_CERTS:join(root,'cert.pem'),T5_TEST_TLS_DIR:root,T5_REQUIRE_LIVE:'1',T5_REQUIRE_QDRANT:'1'},stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});await new Promise(resolve=>log.end(resolve));
  process.exitCode=code??1;process.stdout.write(`T5 Audit/SIEM: exit ${code}; tests/reports/t5-audit-siem.tap\n`);
}finally{await rm(root,{recursive:true,force:true});}
