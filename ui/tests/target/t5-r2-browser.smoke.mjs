import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,X509Certificate} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import WebSocket from 'ws';

async function until(work,label){for(let attempt=0;attempt<150;attempt++){
  try{const value=await work();if(value)return value;}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
}throw new Error(`TIMEOUT: ${label}`);}

test('live Chrome generates a private key and opens Knowledge without model fixtures',
  {skip:process.env.T5_R2_REQUIRE_BROWSER!=='1',timeout:60000},async()=>{
    const cert=new X509Certificate(await readFile('.secrets.t3.local/rag-dev-cert.pem'));
    const pin=createHash('sha256').update(cert.publicKey.export({type:'spki',format:'der'})).digest('base64');
    const root=await mkdtemp(join(tmpdir(),'t5-r2-browser-'));
    const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage',
      '--disable-gpu','--no-first-run',`--ignore-certificate-errors-spki-list=${pin}`,'--no-proxy-server',
      '--host-resolver-rules=MAP app.localhost 127.0.0.1,MAP auth.localhost 127.0.0.1',
      '--remote-debugging-port=0',`--user-data-dir=${join(root,'profile')}`,'about:blank'],{stdio:'ignore'});
    let socket;
    try{
      const port=Number((await until(()=>readFile(join(root,'profile','DevToolsActivePort'),'utf8'),'Chrome startup')).split('\n')[0]);
      const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page=pages.find(item=>item.type==='page');assert.ok(page?.webSocketDebuggerUrl);
      socket=new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
      let id=0;const pending=new Map(),authRequests=[];
      socket.on('message',raw=>{const message=JSON.parse(raw.toString());
        if(message.method==='Network.requestWillBeSent'&&message.params.request.method==='POST'&&message.params.request.url.includes('/api/auth/legacy-key'))
          authRequests.push(message.params.request.postData??'');
        if(!message.id)return;const entry=pending.get(message.id);if(!entry)return;pending.delete(message.id);
        if(message.error)entry.reject(new Error(message.error.message));else entry.resolve(message.result);
      });
      const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params}));});
      const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
        if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value;};
      await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
      await send('Page.navigate',{url:'https://app.localhost:5173/login?returnTo=/knowledge'});
      await until(()=>evaluate('document.querySelector("#login-legacy-key") !== null'),'legacy login form');
      assert.deepEqual(await evaluate(`fetch('https://auth.localhost:5174/api/auth/methods',{credentials:'include'}).then(response=>response.json())`),
        {organizationalOidc:false,legacyKey:true,developmentPassword:false});
      await until(()=>evaluate('!document.querySelector("form button[type=submit]")?.disabled'),'login readiness');
      await evaluate('document.querySelector(".login-actions button[type=button]").click()');
      const key=await evaluate('document.querySelector("#login-legacy-key").value');
      assert.equal(key.length,32);
      await evaluate('document.querySelector("form button[type=submit]").click()');
      try{await until(()=>evaluate('location.pathname === "/knowledge"'),'Knowledge navigation');}
      catch(error){console.error('Browser login diagnostics',await evaluate('({path:location.pathname,alerts:[...document.querySelectorAll("[role=alert]")].map(item=>item.textContent)})'));throw error;}
      const view=await evaluate('document.body.innerText');
      assert.match(view,/DEVELOPMENT_RAG_MODEL_CONFIGURATION_REQUIRED/);
      assert.ok(!view.includes('ورود با کلید'));
      await until(()=>evaluate('document.querySelector("#knowledge-title") !== null'),'Knowledge workspace');
      assert.equal(await evaluate(`document.querySelector('section[aria-labelledby="knowledge-title"] a[href$="/login"]') !== null`),false);
      assert.equal(await evaluate(`document.querySelector('nav a[href$="/rag"]') !== null`),true);
      assert.equal(authRequests.length,1);
      assert.ok(authRequests[0].includes(key),'browser submits raw key');
      console.log('AUTH_AND_KNOWLEDGE_UI_SMOKE=PASS RAG_MODEL_SMOKE=NOT_VERIFIED');
    }finally{
      socket?.close();chrome.kill('SIGTERM');
      await Promise.race([new Promise(resolve=>chrome.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);
      await rm(root,{recursive:true,force:true}).catch(()=>{});
    }
  });
