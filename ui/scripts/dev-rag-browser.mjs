import {createHash,X509Certificate} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const cert=new X509Certificate(await readFile('.secrets.t3.local/rag-dev-cert.pem'));
const pin=createHash('sha256').update(cert.publicKey.export({type:'spki',format:'der'})).digest('base64');
const profile=resolve('.rag-data.local/browser-profile');await mkdir(profile,{recursive:true,mode:0o700});
const browser=spawn('/usr/bin/google-chrome',['--no-first-run','--no-proxy-server',
  '--host-resolver-rules=MAP app.localhost 127.0.0.1,MAP auth.localhost 127.0.0.1',
  `--ignore-certificate-errors-spki-list=${pin}`,`--user-data-dir=${profile}`,
  'https://app.localhost:5173/login'],{stdio:'inherit'});
browser.once('error',error=>{console.error(`BROWSER_START_FAILED: ${error.message}`);process.exitCode=1;});
browser.once('exit',code=>{process.exitCode=code??1;});
